/**
 * Offline: the store the query client is persisted to, the online state the
 * screens render, and the one rule for what may happen without a connection.
 *
 * A driver in a garage or on the airport's lower level keeps seeing what the
 * app last knew, marked as such, and is never told that something happened
 * when it did not. See okf/architecture/offline.md and, for the layer that
 * now holds the answers, okf/architecture/data-layer.md.
 *
 * Three pieces, all brand neutral:
 *
 * - The store. IndexedDB `taxi-app-cache`, one object store, one record per
 *   query of the TanStack Query client: key = sha-256 of the query's hash
 *   plus the caller's OIDC subject, value = the dehydrated query and a
 *   `storedAt` instant. `offlinePersister` is the Persister the client is
 *   written through, see hooks/query.ts. The subject in the key and an owner
 *   record keep two accounts apart on one phone, and a logout clears
 *   everything. Storage may be missing or throw (private mode, quota, an old
 *   WebView), and then the persister is a pass-through: nothing is restored,
 *   writes are dropped, and the client behaves as if this file did not exist.
 *   The hand-rolled read cache that answered the fetcher from this store is
 *   gone: an answer from the cache while offline is what the query client
 *   does by itself.
 * - The state. `online` is what the screens render the banner from. It is
 *   the query client's onlineManager, so a change here is what makes the
 *   client refetch when the connection returns. It goes false on the
 *   browser's `offline` event and whenever a fetch fails for want of a
 *   network, and true on the `online` event, on a successful probe and on
 *   the next successful fetch. `storedAt` is the instant of the newest answer
 *   shown since the connection went (the query's `dataUpdatedAt`, reported by
 *   the hooks), which is what "Offline, Stand 14:32" says.
 * - The rule. `throughCache` wraps one send. A query that finds no network
 *   fails with the layer's OfflineError, and the query client keeps what it
 *   held. A mutation is never stored, never replayed, and refused on the
 *   device while offline, so that it reaches the pylon zero times: a
 *   dispatcher who sees "unterwegs" has to be able to trust it.
 *
 * Nothing here imports the client or the hooks. The client imports this, the
 * hooks import the client, so the dependency runs one way.
 */
import {useEffect, useRef, useState} from 'react'
import {onlineManager} from '@tanstack/react-query'
import type {PersistedClient, Persister} from '@tanstack/react-query-persist-client'
import {useAuth} from 'jaen'
import type {I18nCode} from './i18n'
import {getI18nOffline, type OfflineStrings} from './locales/i18nOffline'

// --------------- The store ---------------

/** The database and store names, the same on both brands by decision. */
export const OFFLINE_DB_NAME = 'taxi-app-cache'
export const OFFLINE_STORE_NAME = 'answers'
const OFFLINE_DB_VERSION = 1

/** The one record that is not an answer: whose answers the store holds. */
const OWNER_KEY = '__owner'

/** How long a persisted answer is worth restoring, and how long the client keeps one in memory. */
export const PERSIST_MAX_AGE = 7 * 24 * 60 * 60 * 1000

export interface StoredAnswer {
  /** The dehydrated query, as the client hands it to the persister. */
  response: unknown
  /** ISO 8601, when the answer was fetched. */
  storedAt: string
}

let dbPromise: Promise<IDBDatabase> | undefined

/**
 * The open database, opened once per page. A failure to open is not cached:
 * a quota that was full a minute ago may not be now, and retrying costs one
 * rejected promise.
 */
const openDb = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('no indexedDB'))
      return
    }
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(OFFLINE_STORE_NAME)) db.createObjectStore(OFFLINE_STORE_NAME)
    }
    request.onsuccess = () => {
      const db = request.result
      // Another tab upgrading the schema, or the user clearing site data:
      // let go, and the next call opens again.
      db.onversionchange = () => {
        db.close()
        dbPromise = undefined
      }
      resolve(db)
    }
    request.onerror = () => reject(request.error ?? new Error('indexedDB open failed'))
    request.onblocked = () => reject(new Error('indexedDB open blocked'))
  })
  dbPromise.catch(() => {
    dbPromise = undefined
  })
  return dbPromise
}

/**
 * One transaction over the store. `run` issues its requests and may return a
 * value read through them, the promise settles when the transaction does, so
 * a write that is reported done is on disk.
 */
const transaction = <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => T): Promise<T> =>
  openDb().then(
    db =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(OFFLINE_STORE_NAME, mode)
        let result: T
        try {
          result = run(tx.objectStore(OFFLINE_STORE_NAME))
        } catch (err) {
          reject(err)
          return
        }
        tx.oncomplete = () => resolve(result)
        tx.onerror = () => reject(tx.error ?? new Error('indexedDB transaction failed'))
        tx.onabort = () => reject(tx.error ?? new Error('indexedDB transaction aborted'))
      })
  )

/**
 * The store's generation: bumped by every clear and read by the persister
 * before it writes. A persist that was computed across the sign-out would
 * otherwise land its records after the clear, and the next person to open
 * the app on that phone would find the last one's answers in the store.
 */
let generation = 0

const clearListeners = new Set<() => void>()

/** What else empties with the store: the query client registers itself here. */
export const onOfflineStoreCleared = (listener: () => void): (() => void) => {
  clearListeners.add(listener)
  return () => {
    clearListeners.delete(listener)
  }
}

/** Everything, including the owner record. The sign-out calls this, see OfflineSession. */
export const clearOfflineStore = async (): Promise<void> => {
  generation += 1
  written.clear()
  ownerWritten = undefined
  clearListeners.forEach(l => l())
  try {
    await transaction('readwrite', store => {
      store.clear()
    })
  } catch {
    // Nothing to clear when there is no storage.
  }
}

/** How many answers are stored, for a screen or a test that wants to know. */
export const countAnswers = async (): Promise<number> => {
  try {
    return await transaction('readonly', store => {
      const n = store.count()
      const owner = store.get(OWNER_KEY)
      return {n, owner}
    }).then(({n, owner}) => Math.max(0, n.result - (owner.result === undefined ? 0 : 1)))
  } catch {
    return 0
  }
}

// --------------- The subject ---------------

declare const __JAEN_ZITADEL_GQL__: {authority?: string; clientId?: string} | undefined

let lastRaw: string | null | undefined
let lastSubject: string | undefined

/**
 * The subject of the OIDC session in this tab, read from the same storage
 * the GraphQL client takes its bearer token from. Read on every call, parsed
 * only when the stored session changed, because the hooks ask on every
 * render.
 */
export const sessionSubject = (): string | undefined => {
  try {
    const z = typeof __JAEN_ZITADEL_GQL__ !== 'undefined' ? __JAEN_ZITADEL_GQL__ : null
    if (!z?.authority || !z?.clientId) return undefined
    const raw = window.sessionStorage?.getItem(`oidc.user:${z.authority}:${z.clientId}`)
    if (raw === lastRaw) return lastSubject
    lastRaw = raw
    const sub = raw ? JSON.parse(raw)?.profile?.sub : undefined
    lastSubject = typeof sub === 'string' && sub ? sub : undefined
    return lastSubject
  } catch {
    return undefined
  }
}

// --------------- The key ---------------

const hex = (bytes: ArrayBuffer): string =>
  Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('')

const keyCache = new Map<string, Promise<string>>()

/**
 * The record key: sha-256 of the query's hash and the subject. Rejects when
 * there is no subtle crypto, which the persister reads as "no storage".
 */
export const recordKey = (queryHash: string, subject: string): Promise<string> => {
  const text = `${queryHash}\n${subject}`
  let promise = keyCache.get(text)
  if (!promise) {
    promise = crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(hex)
    promise.catch(() => keyCache.delete(text))
    keyCache.set(text, promise)
  }
  return promise
}

// --------------- The persister ---------------

/** A dehydrated query, the part of the client's shape the persister reads. */
interface DehydratedQueryLike {
  queryHash: string
  queryKey: unknown
  state: {
    data?: unknown
    dataUpdatedAt: number
    [k: string]: unknown
  }
  [k: string]: unknown
}

const isDehydratedQuery = (v: unknown): v is DehydratedQueryLike =>
  !!v &&
  typeof v === 'object' &&
  typeof (v as DehydratedQueryLike).queryHash === 'string' &&
  !!(v as DehydratedQueryLike).state &&
  typeof (v as DehydratedQueryLike).state.dataUpdatedAt === 'number'

/** The `dataUpdatedAt` last written per key, so an unchanged answer is not written again. */
const written = new Map<string, number>()
let ownerWritten: string | undefined

/**
 * What a record holds of a query: the answer and when it was fetched, as a
 * success. A query that failed offline after it had an answer is persisted
 * as the answer it had, not as the failure, because the failure is not what
 * a reload wants back.
 */
const asStored = (q: DehydratedQueryLike): StoredAnswer => ({
  response: {
    ...q,
    state: {
      ...q.state,
      status: 'success',
      error: null,
      fetchStatus: 'idle',
      fetchFailureCount: 0,
      fetchFailureReason: null,
      errorUpdateCount: 0
    }
  },
  storedAt: new Date(q.state.dataUpdatedAt).toISOString()
})

/**
 * The persister the query client is written through, see hooks/query.ts.
 *
 * `persistClient` writes one record per query and drops the records of
 * queries the client no longer holds, in one transaction. Without a subject
 * nothing is written: a visitor's answers are nobody's. `restoreClient`
 * reads every record back as the client's dehydrated state, and a store that
 * belongs to another subject is cleared instead of restored, which is what
 * keeps two accounts apart on a phone handed from one driver to the next
 * without a sign-out. Every failure is swallowed: no storage, no store.
 */
export const offlinePersister: Persister = {
  persistClient: async (client: PersistedClient) => {
    const subject = sessionSubject()
    if (!subject) return
    const gen = generation
    const queries = (client.clientState.queries as unknown[]).filter(isDehydratedQuery)
    let entries: Array<{key: string; query: DehydratedQueryLike}>
    try {
      entries = await Promise.all(
        queries.map(async query => ({key: await recordKey(query.queryHash, subject), query}))
      )
    } catch {
      return
    }
    if (gen !== generation) return
    const pending = new Map<string, number>()
    try {
      await transaction('readwrite', store => {
        const keep = new Set(entries.map(e => e.key))
        keep.add(OWNER_KEY)
        const all = store.getAllKeys()
        all.onsuccess = () => {
          for (const k of all.result) if (!keep.has(String(k))) store.delete(k)
        }
        for (const {key, query} of entries) {
          const at = query.state.dataUpdatedAt
          if (written.get(key) === at) continue
          store.put(asStored(query), key)
          pending.set(key, at)
        }
        if (ownerWritten !== subject) store.put(subject, OWNER_KEY)
      })
      if (gen !== generation) return
      pending.forEach((at, key) => written.set(key, at))
      ownerWritten = subject
    } catch {
      // Swallowed on purpose: quota, private mode, a closed database. The
      // screen has its answer, only the next offline visit will not.
    }
  },

  restoreClient: async () => {
    const subject = sessionSubject()
    if (!subject) return undefined
    try {
      const {owner, keys, values} = await transaction('readonly', store => ({
        owner: store.get(OWNER_KEY),
        keys: store.getAllKeys(),
        values: store.getAll()
      })).then(({owner, keys, values}) => ({owner: owner.result, keys: keys.result, values: values.result}))

      if (owner !== subject) {
        // Another account's answers, or a store that was emptied by hand and
        // lost its owner: nothing of it is this subject's.
        if (owner !== undefined || keys.length) {
          await transaction('readwrite', store => {
            store.clear()
          })
        }
        return undefined
      }

      const queries: unknown[] = []
      let newest = 0
      keys.forEach((k, i) => {
        const value = values[i] as StoredAnswer | undefined
        if (String(k) === OWNER_KEY || !value || !isDehydratedQuery(value.response)) return
        queries.push(value.response)
        newest = Math.max(newest, value.response.state.dataUpdatedAt)
        written.set(String(k), value.response.state.dataUpdatedAt)
      })
      ownerWritten = subject
      if (!queries.length) return undefined
      return {
        timestamp: newest,
        buster: subject,
        clientState: {queries: queries as PersistedClient['clientState']['queries'], mutations: []}
      }
    } catch {
      // No storage, nothing to restore.
      return undefined
    }
  },

  removeClient: async () => {
    written.clear()
    ownerWritten = undefined
    try {
      await transaction('readwrite', store => {
        store.clear()
      })
    } catch {
      // Nothing to remove when there is no storage.
    }
  }
}

/** A document whose first operation is a mutation. Comments before it are skipped. */
export const isMutationDocument = (query: string): boolean =>
  /^(?:\s|#[^\n]*\n?)*mutation\b/.test(query)

// --------------- The state ---------------

export interface OfflineState {
  /** False while the browser says so or the last fetch found no network. */
  online: boolean
  /** ISO 8601, the newest answer shown since the connection went. */
  storedAt?: string
}

const browserOnline = (): boolean => (typeof navigator === 'undefined' ? true : navigator.onLine !== false)

let storedAt: string | undefined
let state: OfflineState = {online: true}

const listeners = new Set<(s: OfflineState) => void>()

const publish = () => {
  const online = onlineManager.isOnline()
  const next: OfflineState = {online, storedAt: online ? undefined : storedAt}
  if (next.online === state.online && next.storedAt === state.storedAt) return
  state = next
  listeners.forEach(l => l(state))
}

export const offlineState = (): OfflineState => state

/** True unless the browser or the last fetch said otherwise. */
export const isOnline = (): boolean => state.online

/**
 * A fetch reached the backend: the connection is back, whatever the banner
 * said. The query client hears it through its onlineManager and refetches
 * what is stale.
 */
export const markOnline = () => {
  stopProbing()
  storedAt = undefined
  onlineManager.setOnline(true)
  publish()
}

/**
 * A fetch found no network, or an answer is being shown without one. `at` is
 * the instant of that answer, and the banner shows the newest one seen
 * while offline.
 */
export const markOffline = (at?: string) => {
  storedAt = [storedAt, at].filter((s): s is string => !!s).sort().pop()
  onlineManager.setOnline(false)
  startProbing()
  publish()
}

/**
 * The browser is the authority when it says offline, and its `online` event
 * is what brings the banner down on a phone. The onlineManager listens to
 * both events itself, this file listens to the onlineManager, and the first
 * subscriber is what wires it, so a server render touches nothing. The
 * manager starts out online whatever the browser says, so a page opened
 * without a connection is told so here.
 */
let wired = false
const wire = () => {
  if (wired || typeof window === 'undefined') return
  wired = true
  onlineManager.subscribe(online => {
    if (online) {
      stopProbing()
      storedAt = undefined
    } else {
      startProbing()
    }
    publish()
  })
  if (!browserOnline()) onlineManager.setOnline(false)
  publish()
}

export const subscribeOffline = (listener: (s: OfflineState) => void): (() => void) => {
  wire()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// --------------- The probe ---------------

/**
 * Between the network going and the browser noticing there is a gap, and a
 * page that was reloaded while offline can believe it is online for good
 * (Chromium hands a new document `navigator.onLine === true` under an
 * emulated outage, and then never fires `online`). So while the state is
 * offline and the browser does not say so, the client's probe is asked
 * every ten seconds. A probe that answers marks the state online, which is
 * what refetches the screens. The probe is the client's, because this file
 * does not know the backend's URL, and a probe that is never registered
 * leaves the `online` event as the only way back, which is what it was.
 */
export const OFFLINE_PROBE_MS = 10_000

let probe: (() => Promise<boolean>) | undefined
let probeTimer: number | undefined

export const setOnlineProbe = (fn: () => Promise<boolean>) => {
  probe = fn
}

const startProbing = () => {
  if (probeTimer !== undefined || typeof window === 'undefined') return
  probeTimer = window.setInterval(() => {
    if (!probe || !browserOnline()) return
    void probe()
      .then(ok => {
        if (ok) markOnline()
      })
      .catch(() => {
        // Still offline. The next tick asks again.
      })
  }, OFFLINE_PROBE_MS)
}

const stopProbing = () => {
  if (probeTimer === undefined) return
  window.clearInterval(probeTimer)
  probeTimer = undefined
}

// --------------- The words ---------------

let language: I18nCode | undefined

/**
 * The language the refusals are worded in. The shell sets it from the
 * account's language on every render, so an error thrown from the layer,
 * outside React, reads like the screen around it. Before the shell has
 * rendered once, the session's locale claim and the browser decide.
 */
export const setOfflineLanguage = (code: I18nCode) => {
  language = code
}

const guessLanguage = (): I18nCode => {
  const codes: I18nCode[] = ['en-US', 'de-AT', 'tr-TR', 'ar-EG']
  const match = (raw: unknown): I18nCode | undefined => {
    const base = typeof raw === 'string' ? raw.replace('_', '-').split('-')[0]?.toLowerCase() : undefined
    return base ? codes.find(c => c.slice(0, 2) === base) : undefined
  }
  try {
    const z = typeof __JAEN_ZITADEL_GQL__ !== 'undefined' ? __JAEN_ZITADEL_GQL__ : null
    if (z?.authority && z?.clientId) {
      const raw = window.sessionStorage?.getItem(`oidc.user:${z.authority}:${z.clientId}`)
      const claim = raw ? match(JSON.parse(raw)?.profile?.locale) : undefined
      if (claim) return claim
    }
  } catch {
    // No session, the browser decides.
  }
  try {
    return match(navigator.languages?.[0] ?? navigator.language) ?? 'de-AT'
  } catch {
    return 'de-AT'
  }
}

export const offlineStrings = (): OfflineStrings => getI18nOffline(language ?? guessLanguage()).strings

const ALL_CODES: I18nCode[] = ['de-AT', 'en-US', 'tr-TR', 'ar-EG']

/**
 * Whether a message a screen holds is the layer's "no connection and nothing
 * stored", in any of the four languages. A hook keeps the message and not
 * the error, and the shell decides its title by it.
 */
export const isOfflineMessage = (text: string | null | undefined): boolean =>
  !!text && ALL_CODES.some(c => getI18nOffline(c).strings.NoConnectionNoData === text)

/** The error the layer throws. `code` is what a screen can branch on, the message is for people. */
export class OfflineError extends Error {
  readonly code = 'OFFLINE'
  constructor(message: string) {
    super(message)
    this.name = 'OfflineError'
  }
}

export const isOfflineError = (err: unknown): err is OfflineError =>
  err instanceof OfflineError || (err instanceof Error && (err as {code?: unknown}).code === 'OFFLINE')

/**
 * A fetch that failed for want of a network. `fetch` rejects with a TypeError
 * for that and for nothing that a GraphQL answer would carry, and the
 * browser saying offline settles it whatever the error was.
 */
export const isNetworkFailure = (err: unknown): boolean => !browserOnline() || err instanceof TypeError

// --------------- The rule ---------------

export interface GraphQLResponse {
  data?: unknown
  errors?: unknown[]
}

export interface CacheKeyParts {
  operationName?: string | null
  query: string
  variables?: unknown
  subject?: string
}

/**
 * One request through the layer. `send` is the fetch, and everything the
 * layer decides is decided here:
 *
 * - a mutation: refused on the device while offline, sent otherwise, never
 *   stored, and a network failure on the way is the same refusal;
 * - a query while the browser says offline: the decided error, and the
 *   query client keeps showing what it holds;
 * - a query otherwise: sent, and on a network failure the decided error.
 *
 * The name and the parts are the fetcher's contract from the time this
 * function also stored and served answers. The query client holds them now,
 * see hooks/query.ts, and the parts are read for nothing but the document.
 */
export async function throughCache(
  parts: CacheKeyParts,
  send: () => Promise<GraphQLResponse>
): Promise<GraphQLResponse> {
  wire()
  if (isMutationDocument(parts.query)) {
    if (!browserOnline()) {
      markOffline()
      throw new OfflineError(offlineStrings().NotPossibleOffline)
    }
    try {
      const response = await send()
      markOnline()
      return response
    } catch (err) {
      if (!isNetworkFailure(err)) throw err
      markOffline()
      throw new OfflineError(offlineStrings().NotPossibleOffline)
    }
  }

  if (!browserOnline()) {
    markOffline()
    throw new OfflineError(offlineStrings().NoConnectionNoData)
  }

  let response: GraphQLResponse
  try {
    response = await send()
  } catch (err) {
    if (!isNetworkFailure(err)) throw err
    markOffline()
    throw new OfflineError(offlineStrings().NoConnectionNoData)
  }
  markOnline()
  return response
}

// --------------- The hooks ---------------

/**
 * The state, for the banner and the slider. The first render is online
 * whatever the browser says, so a screen rendered on the server and hydrated
 * without a connection does not disagree with its own HTML. The effect
 * corrects it before the frame is painted.
 */
export function useOnline(): OfflineState {
  const [value, setValue] = useState<OfflineState>({online: true})
  useEffect(() => {
    const unsubscribe = subscribeOffline(setValue)
    setValue(state)
    return unsubscribe
  }, [])
  return value
}

/**
 * Refetch once when the connection comes back. The `online` event, a
 * successful probe or any successful fetch flips the state, and every
 * screen that shows a stored answer replaces it with a fresh one then. The
 * query client refetches its stale queries on the same signal by itself,
 * and a refetch of a read already on its way is folded into it, so a screen
 * that still calls this costs nothing. The first render never refetches: the
 * hook it belongs to is loading already.
 */
export function useRefetchOnReconnect(refetch: () => void) {
  const {online} = useOnline()
  const wasOffline = useRef(false)
  const latest = useRef(refetch)
  latest.current = refetch
  useEffect(() => {
    if (!online) {
      wasOffline.current = true
      return
    }
    if (wasOffline.current) {
      wasOffline.current = false
      latest.current()
    }
  }, [online])
}

// --------------- The sign-out ---------------

/**
 * Nothing in the app signs anybody out: jaen's /logout page does, through
 * oidc-client-ts, and the app has no hook in that page. What it has is the
 * user manager's `userUnloaded` event, which fires when the session is
 * removed from storage, before the browser is sent to the identity server.
 * This component subscribes to it and clears the store then, and the query
 * client with it. It renders nothing and is mounted by the plugin's
 * wrapPageElement on every page, because /logout is a page of its own and
 * the shell is not on it.
 *
 * jaen's `useAuth` carries react-oidc-context's `events` only once the OIDC
 * runtime is loaded, which it is on every page that requires a session, so
 * the subscription follows the events object and is a no-op before that.
 */
export function OfflineSession(): null {
  const auth = useAuth() as {events?: {addUserUnloaded: (cb: () => void) => () => void}}
  const events = auth.events
  useEffect(() => {
    if (!events || typeof events.addUserUnloaded !== 'function') return
    return events.addUserUnloaded(() => {
      void clearOfflineStore()
    })
  }, [events])
  return null
}

/** The names a test reads the store by, and the one store to inspect. */
export const OFFLINE_STORE = {db: OFFLINE_DB_NAME, store: OFFLINE_STORE_NAME, ownerKey: OWNER_KEY} as const

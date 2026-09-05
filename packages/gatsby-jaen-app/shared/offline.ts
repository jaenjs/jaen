/**
 * Offline: the store of last answers, the online state the screens render,
 * and the one rule for what may happen without a connection.
 *
 * A driver in a garage or on the airport's lower level keeps seeing what the
 * app last knew, marked as such, and is never told that something happened
 * when it did not. See okf/architecture/offline.md, this file is that page.
 *
 * Three pieces, all brand neutral:
 *
 * - The store. IndexedDB `taxi-app-cache`, one object store, key = sha-256
 *   of the document plus its variables plus the caller's OIDC subject, value
 *   = the response and a `storedAt` instant. The subject in the key and an
 *   owner record keep two accounts apart on one phone, and a logout clears
 *   everything. Storage may be missing or throw (private mode, quota, an
 *   old WebView), and then every function here is a pass-through: reads
 *   answer nothing, writes are dropped, and the layer around queryFetcher
 *   behaves as if this file did not exist.
 * - The state. `online` is what the screens render the banner from. It goes
 *   false on the browser's `offline` event and whenever a fetch fails for
 *   want of a network, and true on the `online` event and on the next
 *   successful fetch. `storedAt` is the instant of the newest stored answer
 *   served since the connection went, which is what "Offline, Stand 14:32"
 *   says.
 * - The rule. `throughCache` wraps one send. A query is stored on success and
 *   answered from the store on a network failure. A mutation is never stored,
 *   never replayed, and refused on the device while offline, so that it
 *   reaches the pylon zero times: a dispatcher who sees "unterwegs" has to be
 *   able to trust it.
 *
 * Nothing here imports the client. The client imports this, and the hooks
 * import the client, so the dependency runs one way.
 */
import {useEffect, useRef, useState} from 'react'
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

export interface StoredAnswer {
  response: unknown
  /** ISO 8601, when the response was stored. */
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

const request = <T>(run: (store: IDBObjectStore) => IDBRequest<T>, mode: IDBTransactionMode): Promise<T> =>
  openDb().then(
    db =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(OFFLINE_STORE_NAME, mode)
        const req = run(tx.objectStore(OFFLINE_STORE_NAME))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error ?? new Error('indexedDB request failed'))
        tx.onabort = () => reject(tx.error ?? new Error('indexedDB transaction aborted'))
      })
  )

/** The stored answer under `key`, or undefined, and undefined when storage throws. */
export const readAnswer = async (key: string): Promise<StoredAnswer | undefined> => {
  try {
    const value = await request<unknown>(store => store.get(key), 'readonly')
    if (value && typeof value === 'object' && typeof (value as StoredAnswer).storedAt === 'string') {
      return value as StoredAnswer
    }
    return undefined
  } catch {
    // Swallowed on purpose: no storage means no stored answer, and the
    // caller then shows the error it would have shown before this layer.
    return undefined
  }
}

/** Store one answer. Never throws, a dropped write is the pass-through. */
export const writeAnswer = async (key: string, response: unknown): Promise<void> => {
  try {
    const value: StoredAnswer = {response, storedAt: new Date().toISOString()}
    await request(store => store.put(value, key), 'readwrite')
  } catch {
    // Swallowed on purpose: quota, private mode, a closed database. The
    // screen has its answer, only the next offline visit will not.
  }
}

/**
 * The store's generation: bumped by every clear, read by every request before
 * it sends and again before it writes. A query that was in flight across the
 * sign-out would otherwise land its answer after the clear, which a slow
 * pylon makes visible, and the next person to open the app on that phone
 * would find one answer of the last one in the store.
 */
let generation = 0

/** Everything, including the owner record. The sign-out calls this, see OfflineSession. */
export const clearOfflineStore = async (): Promise<void> => {
  generation += 1
  // The next subject stamps the owner record again, whoever it is.
  ownerReconcile = undefined
  try {
    await request(store => store.clear(), 'readwrite')
  } catch {
    // Nothing to clear when there is no storage.
  }
}

/** How many answers are stored, for a screen or a test that wants to know. */
export const countAnswers = async (): Promise<number> => {
  try {
    const n = await request<number>(store => store.count(), 'readonly')
    // The owner record is not an answer.
    const owner = await request<unknown>(store => store.get(OWNER_KEY), 'readonly')
    return Math.max(0, n - (owner === undefined ? 0 : 1))
  } catch {
    return 0
  }
}

/**
 * The store belongs to one subject. When a different account uses the
 * layer, what the previous account left behind is cleared first. The key
 * already carries the subject, so this is belt and braces against a phone
 * that is handed from one driver to the next without a logout. A request
 * without a subject touches nothing: a second tab of the same site has no
 * session of its own and must not empty the store under the first one, the
 * logout is what empties it.
 *
 * One reconcile per subject per page, and every request of that subject
 * awaits it: the first answers of a session used to be written while the
 * clear was still on its way and were wiped by it, so the very documents a
 * screen opens with, the introspection and the list, were the ones missing
 * offline.
 */
let ownerReconcile: {subject: string; done: Promise<void>} | undefined

export const reconcileOwner = (subject: string | undefined): Promise<void> => {
  if (!subject) return Promise.resolve()
  if (ownerReconcile?.subject === subject) return ownerReconcile.done
  const done = (async () => {
    try {
      const owner = await request<unknown>(store => store.get(OWNER_KEY), 'readonly')
      if (owner === subject) return
      await request(store => store.clear(), 'readwrite')
      await request(store => store.put(subject, OWNER_KEY), 'readwrite')
    } catch {
      // No storage, nothing to reconcile.
    }
  })()
  ownerReconcile = {subject, done}
  return done
}

// --------------- The key ---------------

const hex = (bytes: ArrayBuffer): string =>
  Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('')

export interface CacheKeyParts {
  operationName?: string | null
  query: string
  variables?: unknown
  subject?: string
}

/**
 * The key: sha-256 of the operation name, the document, the variables and
 * the subject. The hooks write their arguments into the document as
 * literals and send no name and no variables, so the document is what
 * varies for them, and a GQty query carries its name and variables beside
 * it. All four go in so the rule is the same whoever built the request.
 * Rejects when there is no subtle crypto, which the layer reads as
 * "no storage".
 */
export const cacheKey = async (parts: CacheKeyParts): Promise<string> => {
  const text = [parts.operationName ?? '', parts.query, JSON.stringify(parts.variables ?? null), parts.subject ?? '']
    .join('\n')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return hex(digest)
}

/** A document whose first operation is a mutation. Comments before it are skipped. */
export const isMutationDocument = (query: string): boolean =>
  /^(?:\s|#[^\n]*\n?)*mutation\b/.test(query)

// --------------- The state ---------------

export interface OfflineState {
  /** False while the browser says so or the last fetch found no network. */
  online: boolean
  /** ISO 8601, the newest stored answer served since the connection went. */
  storedAt?: string
}

const browserOnline = (): boolean => (typeof navigator === 'undefined' ? true : navigator.onLine !== false)

let state: OfflineState = {online: browserOnline()}

const listeners = new Set<(s: OfflineState) => void>()

const publish = (next: OfflineState) => {
  if (next.online === state.online && next.storedAt === state.storedAt) return
  state = next
  listeners.forEach(l => l(state))
}

export const offlineState = (): OfflineState => state

/** True unless the browser or the last fetch said otherwise. */
export const isOnline = (): boolean => state.online

/** A fetch reached the backend: the connection is back, whatever the banner said. */
export const markOnline = () => {
  stopProbing()
  publish({online: true, storedAt: undefined})
}

/**
 * A fetch found no network. `storedAt` is the answer that was served in its
 * place, and the banner shows the newest one seen while offline.
 */
export const markOffline = (storedAt?: string) => {
  const newest = [state.storedAt, storedAt].filter((s): s is string => !!s).sort().pop()
  publish({online: false, storedAt: newest})
  startProbing()
}

/**
 * The browser is the authority when it says offline, and its `online` event
 * is what brings the banner down on a phone. Both are wired once, and the
 * first subscriber is what wires them, so a server render touches nothing.
 */
let wired = false
const wire = () => {
  if (wired || typeof window === 'undefined') return
  wired = true
  window.addEventListener('online', () => markOnline())
  window.addEventListener('offline', () => markOffline())
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

declare const __JAEN_ZITADEL_GQL__: {authority?: string; clientId?: string} | undefined

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
  /** Set by this layer on an answer served from the store. */
  offline?: true
  storedAt?: string
}

/**
 * One request through the layer. `send` is the fetch, and everything the
 * layer decides is decided here:
 *
 * - a mutation: refused on the device while offline, sent otherwise, never
 *   stored, and a network failure on the way is the same refusal;
 * - a query while the browser says offline: the stored answer, or the
 *   decided error;
 * - a query otherwise: sent, stored on success, and on a network failure
 *   the stored answer, or the decided error.
 *
 * Every stored answer served is tagged `{offline: true, storedAt}`, so a hook
 * that wants to know can, and the banner reads the same instant from the
 * state.
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

  await reconcileOwner(parts.subject)

  // No key means no storage, and the request goes through untouched.
  const key = await cacheKey(parts).catch(() => undefined)

  const fromStore = async (): Promise<GraphQLResponse> => {
    const stored = key ? await readAnswer(key) : undefined
    if (stored && stored.response && typeof stored.response === 'object') {
      markOffline(stored.storedAt)
      return {...(stored.response as GraphQLResponse), offline: true, storedAt: stored.storedAt}
    }
    markOffline()
    throw new OfflineError(offlineStrings().NoConnectionNoData)
  }

  if (!browserOnline()) return fromStore()

  const sentIn = generation
  let response: GraphQLResponse
  try {
    response = await send()
  } catch (err) {
    if (!isNetworkFailure(err)) throw err
    return fromStore()
  }

  markOnline()
  // Only a whole answer is worth keeping: a response with errors is the
  // backend's refusal, and offline it would be shown as if it were current.
  // And only an answer of this generation: a clear in between means the
  // session it was asked for is gone.
  if (
    key &&
    sentIn === generation &&
    response &&
    typeof response === 'object' &&
    !(Array.isArray(response.errors) && response.errors.length)
  ) {
    void writeAnswer(key, response)
  }
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
    setValue(state)
    return subscribeOffline(setValue)
  }, [])
  return value
}

/**
 * Refetch once when the connection comes back. The `online` event, a
 * successful probe or any successful fetch flips the state, and every
 * screen that shows a stored answer replaces it with a fresh one then. The
 * first render never refetches: the hook it belongs to is loading already.
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
 * This component subscribes to it and clears the store then. It renders
 * nothing and is mounted by the plugin's wrapPageElement on every page,
 * because /logout is a page of its own and the shell is not on it.
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

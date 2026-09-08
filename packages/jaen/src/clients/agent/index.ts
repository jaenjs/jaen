/**
 * The jaen agent's client.
 *
 * Four calls over plain `fetch` and one WebSocket, no generated client: the
 * agent is a Pylon of jaen's own and its schema moves with this package, so a
 * generated client would be a second copy of the same documents that has to be
 * regenerated on both sides of one repository. The selections below are
 * deliberately narrow for the same reason -- a field this client does not read
 * is a field the agent may still rename.
 *
 * **The draft is a revision, not a commit.** Until 2026-09-08 this client
 * carried a `headSha` and a `blobSha`, because a save was a commit and the
 * shared draft was the site's repository. `docs/architecture/draft-state.md`
 * undoes that: the draft lives in one Durable Object per site, a save bumps a
 * monotonic `revision`, and the repository is written only by a publish. So
 * the client's whole model of "where the draft is" is one number, and the two
 * shas are gone from the wire, from the store and from `localStorage`.
 *
 * See docs/architecture/draft-state.md, "The draft: one Durable Object per
 * site" and "The escape from Cloudflare".
 */
import {accessTokenFromOidcStorage} from '../../utils/oidc-session'
import type {
  JaenAuthors,
  JaenChange,
  JaenDraftData
} from '../../redux/apply-change'

export interface AgentConfig {
  url: string
  site: string
  /**
   * Where the object's WebSocket is, when it is not derived from `url`.
   *
   * Derived it is `url` with the scheme swapped to `ws`/`wss` and a trailing
   * `/graphql` replaced by `/draft`, which is the shape the agent serves. An
   * operator whose agent sits behind a proxy that terminates the socket
   * somewhere else sets this.
   */
  socketUrl?: string
  /** The interval of the poll while the tab is hidden. */
  pollMs: number
  /** The interval of the poll while the tab is visible or a save is out. */
  activePollMs: number
  /** Quiet time a field write waits out before the outbox is committed. */
  debounceMs: number
}

export interface DraftAnswer {
  site: string
  /** The object's revision this answer was read at. */
  revision: number
  /** The revision the last publish took, so the CMS can say what is live. */
  publishedRevision?: number | null
  /** False when `sinceRevision` is still the object's revision. */
  changed: boolean
  data?: JaenDraftData | null
  authors?: JaenAuthors | null
  readAt: string
}

export interface SaveAnswer {
  /** The revision the object is at after this write. */
  revision: number
  savedAt: string
  /**
   * The write was made against a base the object had already moved past, so
   * the object folded it onto the newer draft. The client asks for the delta
   * at once when this is set: its own copy is behind by definition.
   */
  rebased: boolean
  overwrote: Array<{field: string}>
}

export interface ViewerAnswer {
  site: string
  sub: string
  name: string
  at: string
}

export interface PublishAnswer {
  queued: boolean
  /** The revision this publish took, which becomes `publishedRevision`. */
  revision?: number
  workflow?: string
  runUrl?: string
  reason?: string
}

/**
 * A call that did not come back, as opposed to one that came back saying no.
 * The flusher keeps the outbox and goes to `offline` on the first and to
 * `error` on the second, which is the difference between "your changes are
 * waiting" and "your changes are not being taken".
 */
export class AgentOfflineError extends Error {
  constructor(cause: unknown) {
    super(`The jaen agent could not be reached: ${String(cause)}`)
    this.name = 'AgentOfflineError'
  }
}

export class AgentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgentError'
  }
}

const bearer = (): string | undefined => {
  try {
    return (
      accessTokenFromOidcStorage(
        sessionStorage.getItem(
          `oidc.user:${__JAEN_ZITADEL_GQL__.authority}:${__JAEN_ZITADEL_GQL__.clientId}`
        )
      ) || undefined
    )
  } catch {
    return undefined
  }
}

const request = async <T>(
  config: AgentConfig,
  query: string,
  variables: Record<string, unknown>
): Promise<T> => {
  const token = bearer()

  let response: Response

  try {
    response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? {Authorization: `Bearer ${token}`} : {})
      },
      body: JSON.stringify({query, variables})
    })
  } catch (error) {
    throw new AgentOfflineError(error)
  }

  // A 5xx or a gateway page is the same kind of nothing as a dead socket: the
  // call did not reach the agent's resolvers, so the changes stay queued.
  if (response.status >= 500) {
    throw new AgentOfflineError(`HTTP ${response.status}`)
  }

  let body: {data?: T; errors?: Array<{message: string}>}

  try {
    body = await response.json()
  } catch (error) {
    throw new AgentOfflineError(error)
  }

  if (body.errors?.length) {
    throw new AgentError(body.errors.map(e => e.message).join('; '))
  }

  if (!body.data) {
    throw new AgentError(
      `The jaen agent answered no data (HTTP ${response.status})`
    )
  }

  return body.data
}

/**
 * The revision is declared `Number` and not `Int`, and that is not a slip.
 *
 * Pylon derives the agent's schema from its TypeScript and renders a `number`
 * argument as the scalar `Number`. An operation declaring `Int` is refused
 * with `GRAPHQL_VALIDATION_FAILED` before the resolver is reached, which is
 * the same trap the storage gateway's `signedUrl` cost a run
 * (docs/architecture/private-storage.md, "Two things a caller has to know").
 */
const DRAFT = `query JaenAgentDraft($site: String!, $sinceRevision: Number) {
  draft(site: $site, sinceRevision: $sinceRevision) {
    site
    revision
    publishedRevision
    changed
    data
    authors
    readAt
  }
}`

const SAVE = `mutation JaenAgentSave($site: String!, $changes: [SaveChangesInput!]!, $baseRevision: Number) {
  save(site: $site, changes: $changes, baseRevision: $baseRevision) {
    revision
    savedAt
    rebased
    overwrote {
      field
    }
  }
}`

const VIEWER = `query JaenAgentViewer($site: String!) {
  viewer(site: $site) {
    site
    sub
    name
    at
  }
}`

const PUBLISH = `mutation JaenAgentPublish($site: String!) {
  publish(site: $site) {
    queued
    revision
    workflow
    runUrl
    reason
  }
}`

export const fetchDraft = async (
  config: AgentConfig,
  sinceRevision?: number
): Promise<DraftAnswer> => {
  const data = await request<{draft: DraftAnswer}>(config, DRAFT, {
    site: config.site,
    // Zero is a legitimate revision and `|| null` would send null for it, so
    // the test is on the type and not on the truth of the value.
    sinceRevision: typeof sinceRevision === 'number' ? sinceRevision : null
  })

  return data.draft
}

/**
 * The agent's `value` argument is the non-null scalar `Any!`.
 *
 * Pylon derives its schema from the agent's TypeScript and renders an `any` as
 * non-null, with no spelling that makes it nullable, so a change that carries
 * no value at all (`pageDelete`, and the three section kinds, which carry
 * theirs in `props`) has to send something rather than leave the field out. It
 * sends `{}`, which every branch of the agent's applier ignores. `props` is an
 * object in every kind and is nullable, so that one is left as it is.
 *
 * The input type is `SaveChangesInput` above for the same reason: pylon names
 * a generated input after the field and the argument it belongs to and never
 * after the interface, so `save(changes:)` is `SaveChangesInput`, and an
 * operation declaring `JaenChangeInput` is refused with "Unknown type".
 */
const forTheWire = (changes: JaenChange[]): JaenChange[] =>
  changes.map(change =>
    change.value === undefined ? {...change, value: {}} : change
  )

export const saveChanges = async (
  config: AgentConfig,
  changes: JaenChange[],
  baseRevision?: number
): Promise<SaveAnswer> => {
  const data = await request<{save: SaveAnswer}>(config, SAVE, {
    site: config.site,
    changes: forTheWire(changes),
    baseRevision: typeof baseRevision === 'number' ? baseRevision : null
  })

  return data.save
}

/**
 * The CMS saying hello, once, when it opens.
 *
 * The agent introspects the bearer before a resolver runs and remembers the
 * answer for a minute, per token, in a cache every isolate reads. The first
 * call with a token nobody has introspected lately pays about two seconds for
 * it, measured against the live agent on 2026-09-08 (3.77 s cold, 1.7 s warm),
 * and without this that first call is the editor's first save. It answers who
 * the caller is and reads no draft at all, so the two seconds are spent while
 * the toolbar is still coming up.
 *
 * A failure is not reported anywhere: the call proves nothing the CMS needs
 * and its only effect is on the clock.
 */
export const warmAuth = async (
  config: AgentConfig
): Promise<ViewerAnswer | null> => {
  try {
    const data = await request<{viewer: ViewerAnswer}>(config, VIEWER, {
      site: config.site
    })

    return data.viewer
  } catch (error) {
    console.debug('jaen agent: the warm up call did not come back', error)
    return null
  }
}

export const publishSite = async (
  config: AgentConfig
): Promise<PublishAnswer> => {
  const data = await request<{publish: PublishAnswer}>(config, PUBLISH, {
    site: config.site
  })

  return data.publish
}

// ---------------------------------------------------------------------------
// The socket
// ---------------------------------------------------------------------------

/**
 * Where the object's socket is.
 *
 * `https://agent.example/graphql` becomes `wss://agent.example/draft`, and the
 * site is a path segment so a proxy can route on it and a log line says which
 * site a connection belongs to without reading a frame.
 */
export const draftSocketUrl = (config: AgentConfig): string | null => {
  const base = config.socketUrl || config.url

  if (!base) return null

  try {
    const url = new URL(
      base,
      typeof location === 'undefined' ? undefined : location.href
    )

    url.protocol =
      url.protocol === 'http:'
        ? 'ws:'
        : url.protocol === 'https:'
          ? 'wss:'
          : url.protocol

    if (!config.socketUrl) {
      url.pathname = url.pathname.replace(/\/graphql\/?$/, '') + '/draft'
    }

    // The site rides in the path and never in the query, for the same reason
    // the token does not: a query string lands in a log and in a `Referer`.
    url.pathname = `${url.pathname.replace(/\/$/, '')}/${encodeURIComponent(
      config.site
    )}`

    // Deliberately nothing in the search string.
    url.search = ''

    return url.toString()
  } catch {
    return null
  }
}

export interface DraftSocketHandlers {
  /**
   * The object says it is at this revision. The caller asks the `draft` query
   * for the delta rather than trusting a frame: the socket carries revisions
   * and never content, which is what `draft-state.md` names `subscribe(site)`,
   * and it keeps one read path and one authorisation path for the data.
   */
  onRevision: (revision: number, publishedRevision?: number) => void
  /**
   * True while a socket is open, false while there is none. It drives how
   * often the poll runs and nothing else: the poll is never switched off, only
   * slowed, because an open socket that has quietly stopped delivering frames
   * looks exactly like a quiet site.
   */
  onLive: (live: boolean) => void
}

/** The reconnect backoff, in ms, then every 30 s. */
const SOCKET_RETRY_MS = [1000, 2000, 5000, 10000, 30000]

/**
 * The object's push channel, with its own reconnect.
 *
 * **The token travels as a subprotocol and never as a query parameter.** A
 * browser `WebSocket` cannot carry an `Authorization` header, and the two ways
 * round that are `?token=` and `Sec-WebSocket-Protocol`. The first is the one
 * `private-storage.md` refuses outright, because a token in a URL lands in a
 * log, in a `Referer` and in a shared link. A JWT's alphabet is legal in a
 * subprotocol token, so the second costs nothing.
 *
 * Returns the closer. Calling it stops the reconnect as well as the socket.
 */
export const openDraftSocket = (
  config: AgentConfig,
  handlers: DraftSocketHandlers
): (() => void) => {
  const url = draftSocketUrl(config)

  if (!url || typeof WebSocket === 'undefined') {
    return () => undefined
  }

  let socket: WebSocket | undefined
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let attempts = 0
  let stopped = false
  let live = false

  const setLive = (next: boolean) => {
    if (live === next) return
    live = next
    handlers.onLive(next)
  }

  const scheduleRetry = () => {
    if (stopped || retryTimer) return

    const wait =
      SOCKET_RETRY_MS[Math.min(attempts, SOCKET_RETRY_MS.length - 1)] || 30000

    attempts += 1

    retryTimer = setTimeout(() => {
      retryTimer = undefined
      open()
    }, wait)
  }

  const open = () => {
    if (stopped || socket) return

    const token = bearer()

    let next: WebSocket

    try {
      next = token
        ? new WebSocket(url, ['jaen-draft.v1', `bearer.${token}`])
        : new WebSocket(url, ['jaen-draft.v1'])
    } catch (error) {
      // A blocked or malformed socket is not an outage: the poll is still
      // reading the same draft over the same HTTP the saves go over.
      console.debug('jaen agent: the draft socket did not open', error)
      scheduleRetry()
      return
    }

    socket = next

    next.onopen = () => {
      attempts = 0
      setLive(true)
    }

    next.onmessage = event => {
      let payload: any

      try {
        payload = JSON.parse(String(event.data))
      } catch {
        return
      }

      // Lenient about the name of the frame and strict about the field. The
      // agent may call it `hello`, `revision` or `changed`; what this client
      // acts on is a number it did not have, and acting on it is asking the
      // `draft` query, so a frame that means nothing costs one read at worst.
      if (payload && typeof payload.revision === 'number') {
        handlers.onRevision(
          payload.revision,
          typeof payload.publishedRevision === 'number'
            ? payload.publishedRevision
            : undefined
        )
      }
    }

    next.onerror = () => {
      // `onclose` always follows, and that is where the retry is scheduled.
      // Doing it here as well would open two sockets.
    }

    next.onclose = () => {
      if (socket === next) socket = undefined
      setLive(false)
      scheduleRetry()
    }
  }

  open()

  return () => {
    stopped = true
    setLive(false)

    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = undefined
    }

    if (socket) {
      const closing = socket
      socket = undefined
      closing.onclose = null
      closing.onmessage = null
      closing.onerror = null
      closing.onopen = null

      try {
        closing.close()
      } catch {
        // A socket that never opened throws on close in some browsers.
      }
    }
  }
}

/**
 * The agent as the plugin configured it, or null on a site without the option,
 * which is every site until it is rebuilt. Nothing in this package changes
 * behaviour when this is null.
 */
export const agentConfig = (): AgentConfig | null => {
  const raw = typeof __JAEN_AGENT__ === 'undefined' ? undefined : __JAEN_AGENT__

  if (!raw?.url || !raw?.site) {
    return null
  }

  return {
    url: raw.url,
    site: raw.site,
    socketUrl: raw.socketUrl,
    pollMs: raw.pollMs || 5000,
    activePollMs: raw.activePollMs || 1500,
    debounceMs: raw.debounceMs || 1000
  }
}

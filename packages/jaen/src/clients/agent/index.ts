/**
 * The jaen agent's client.
 *
 * Three calls over plain `fetch`, no generated client: the agent is a Pylon of
 * jaen's own and its schema moves with this package, so a generated client
 * would be a second copy of the same three documents that has to be
 * regenerated on both sides of one repository. The selections below are
 * deliberately narrow for the same reason -- a field this client does not read
 * is a field the agent may still rename.
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
  /** The interval of the poll while the tab is hidden. */
  pollMs: number
  /** The interval of the poll while the tab is visible or a save is out. */
  activePollMs: number
  /** Quiet time before a keystroke stream is committed. */
  debounceMs: number
}

export interface DraftAnswer {
  site: string
  headSha: string
  blobSha?: string
  changed: boolean
  data?: JaenDraftData | null
  authors?: JaenAuthors | null
  readAt: string
}

export interface SaveAnswer {
  headSha: string
  blobSha?: string
  commitSha?: string
  commitUrl?: string
  savedAt: string
  rebased: boolean
  overwrote: Array<{field: string}>
  /** The head files the save wrote. `jaen-data/live.json`, the catalogue, or both. */
  wrote?: string[]
}

export interface ViewerAnswer {
  site: string
  sub: string
  name: string
  at: string
}

export interface PublishAnswer {
  queued: boolean
  headSha?: string
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

const DRAFT = `query JaenAgentDraft($site: String!, $sinceSha: String) {
  draft(site: $site, sinceSha: $sinceSha) {
    site
    headSha
    blobSha
    changed
    data
    authors
    readAt
  }
}`

const SAVE = `mutation JaenAgentSave($site: String!, $changes: [SaveChangesInput!]!, $baseSha: String) {
  save(site: $site, changes: $changes, baseSha: $baseSha) {
    headSha
    blobSha
    commitSha
    commitUrl
    savedAt
    rebased
    wrote
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
    headSha
    workflow
    runUrl
    reason
  }
}`

export const fetchDraft = async (
  config: AgentConfig,
  sinceSha?: string
): Promise<DraftAnswer> => {
  const data = await request<{draft: DraftAnswer}>(config, DRAFT, {
    site: config.site,
    sinceSha: sinceSha || null
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
  baseSha?: string
): Promise<SaveAnswer> => {
  const data = await request<{save: SaveAnswer}>(config, SAVE, {
    site: config.site,
    changes: forTheWire(changes),
    baseSha: baseSha || null
  })

  return data.save
}

/**
 * The CMS saying hello, once, when it opens.
 *
 * The agent introspects the bearer before a resolver runs and remembers the
 * answer for a minute, per token, in a KV every isolate reads. The first call
 * with a token nobody has introspected lately pays about two seconds for it,
 * measured against the live agent on 2026-09-08 (3.77 s cold, 1.7 s warm),
 * and without this that first call is the editor's first save. It answers who
 * the caller is and reads no repository at all, so the two seconds are spent
 * while the toolbar is still coming up.
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
    pollMs: raw.pollMs || 5000,
    activePollMs: raw.activePollMs || 1500,
    debounceMs: raw.debounceMs || 800
  }
}

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
  pollMs: number
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

const SAVE = `mutation JaenAgentSave($site: String!, $changes: [JaenChangeInput!]!, $baseSha: String) {
  save(site: $site, changes: $changes, baseSha: $baseSha) {
    headSha
    blobSha
    commitSha
    commitUrl
    savedAt
    rebased
    overwrote {
      field
    }
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

export const saveChanges = async (
  config: AgentConfig,
  changes: JaenChange[],
  baseSha?: string
): Promise<SaveAnswer> => {
  const data = await request<{save: SaveAnswer}>(config, SAVE, {
    site: config.site,
    changes,
    baseSha: baseSha || null
  })

  return data.save
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
    debounceMs: raw.debounceMs || 800
  }
}

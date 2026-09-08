/**
 * The Worker's environment, and the site table.
 *
 * There is no database, so the list of sites the agent serves is a Worker var:
 * `SITES`, a JSON object keyed by site key. The site key names the repository,
 * the identity decides the permission (see ./auth). Both limousine sites sign
 * in against the same Zitadel with the same project and the same client, so
 * the audience cannot tell them apart and the organisation id does.
 */
import {getEnv, ServiceError} from '@getcronit/pylon'

export interface SiteEntry {
  /** `owner/name` on GitHub. */
  repository: string
  /** The branch the site builds from. DEFAULT_BRANCH when absent. */
  branch?: string
  /** Subdirectory holding jaen-data, when the site is not at the repo root. */
  cwd?: string
  /** The identity server this site's editors sign in against. */
  issuer?: string
  /** The Zitadel organisation an editor of this site must belong to. */
  organizationId: string
  /** The projects whose role claims count for this site. */
  projectIds?: string[]
  /** The role an editor needs. `jaen:admin` when absent. */
  adminRole?: string
  /** The site's identity facade, for the grant lookup. */
  iamApiUrl?: string
  /**
   * The environment variable holding the organisation manager token the grant
   * lookup through `iamApiUrl` is made with. One per site, the way the taxi
   * pylons hold theirs: the facade answers for the organisation of the token
   * it is sent, so one estate wide token would answer for one organisation and
   * fail for the other. `ORG_USER_MANAGER_TOKEN` when absent.
   */
  orgManagerTokenVar?: string
  /**
   * The environment variable holding the storage gateway credential a publish
   * uploads its migration with. One per site, the way `orgManagerTokenVar` is:
   * a file belongs to the organisation of the token that sent it, so one
   * estate wide token would stamp every brand's migration with one
   * organisation. `OSG_TOKEN` when absent.
   *
   * It is the brand's storage machine user (`osg-krc`, `osg-limosen`), which
   * holds `storage:write`, and never `osg-build-<brand>`, which
   * private-storage.md gave `storage:read` and nothing else on purpose.
   */
  osgTokenVar?: string
  /** The workflow `publish` dispatches. No build when absent. */
  publishWorkflow?: string
  /** The GitHub App installation that holds the repository, when the App is used. */
  installationId?: string
}

export interface AgentEnv {
  AUTH_ISSUER?: string
  AUTH_CACHE_TTL_MS?: string | number
  DEFAULT_BRANCH?: string
  SITES?: string
  GITHUB_API_URL?: string
  GITHUB_TOKEN?: string
  GITHUB_APP_ID?: string
  GITHUB_APP_PRIVATE_KEY?: string
  ORG_USER_MANAGER_TOKEN?: string
  /** The storage gateway a publish uploads its migration to. */
  STORAGE_URL?: string
  /** The default storage credential, when a site entry names no var of its own. */
  OSG_TOKEN?: string
  AGENT_VERSION?: string
  AGENT_COMMIT?: string
  AGENT_BUILT_AT?: string
  CACHE?: KVNamespace
  /**
   * The draft store: one Durable Object per site, addressed by the site's
   * name. Typed as unknown rather than as a DurableObjectNamespace here so
   * that nothing outside src/draft names a Cloudflare type, which is the
   * escape `draft-state.md` asks for. ./draft/durable is the one file that
   * casts it, and it is the one file a single process implementation would
   * replace.
   */
  DRAFTS?: unknown
  /** How long the object's alarm waits before it snapshots. Five minutes. */
  DRAFT_SNAPSHOT_INTERVAL_MS?: string | number
  [key: string]: unknown
}

export const env = (): AgentEnv => {
  try {
    return (getEnv() ?? {}) as AgentEnv
  } catch {
    return {} as AgentEnv
  }
}

/** The one User-Agent every outgoing request carries, see ./index. */
export const USER_AGENT = 'jaen-agent (+https://github.com/atsnek/jaen)'

let sitesCache: {raw: string; table: Record<string, SiteEntry>} | null = null

export const sites = (): Record<string, SiteEntry> => {
  const raw = env().SITES

  if (typeof raw !== 'string' || !raw.trim()) return {}
  if (sitesCache && sitesCache.raw === raw) return sitesCache.table

  let table: Record<string, SiteEntry>

  try {
    table = JSON.parse(raw) as Record<string, SiteEntry>
  } catch (error) {
    // A malformed table is a deployment mistake, not a caller's. Saying so
    // beats answering every site with "unknown site".
    throw new Error(
      `SITES is not valid JSON: ${
        (error as Error).message
      }. It is a Worker var, see wrangler.toml.`
    )
  }

  sitesCache = {raw, table}

  return table
}

/**
 * A ServiceError and not a bare Error, because pylon reports anything else as
 * "Unexpected error." with no message, and a misconfigured site key is the
 * one mistake an operator has to be able to read off the answer.
 */
export class UnknownSiteError extends ServiceError {
  constructor(key: string) {
    super(
      `unknown site "${key}". The agent serves the keys of its SITES table, ` +
        `and a site is added there and nowhere else.`,
      {statusCode: 404, code: 'UNKNOWN_SITE'}
    )
  }
}

export const site = (key: string): SiteEntry => {
  const entry = sites()[key]

  if (!entry) throw new UnknownSiteError(key)

  return entry
}

export const siteBranch = (entry: SiteEntry): string =>
  entry.branch || env().DEFAULT_BRANCH || 'main'

/** `jaen-data/live.json`, under the site's cwd when it has one. */
export const sitePath = (entry: SiteEntry, path: string): string => {
  const cwd = entry.cwd?.replace(/^\/+|\/+$/g, '') ?? ''

  return cwd ? `${cwd}/${path}` : path
}

/** The KV namespace, or null on a runner that has none bound. */
export const cache = (): KVNamespace | null => env().CACHE ?? null

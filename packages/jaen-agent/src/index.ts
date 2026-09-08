/**
 * jaen-agent
 *
 * The one process the CMS of a site talks to. Two lifecycles and two homes,
 * which is the whole design (`draft-state.md`, "The two lifecycles"):
 *
 * **The draft** lives in one Durable Object per site. `save` applies a batch
 * of changes inside that object and bumps a revision, `draft` reads what
 * changed above the revision the caller has, and `subscribe` hands out the
 * handle for the socket the object pushes revisions down. None of the three
 * touches a repository or the storage gateway, and nothing in `patches.txt`
 * ever names a draft.
 *
 * Until 2026-09-08 `save` was a git commit and the shared draft was the site's
 * repository HEAD, which produced a commit per blur and put every unfinished
 * edit into the built site. That path is gone from this service, together with
 * the head patch, the split of it and the blob sha lock it was serialised
 * with. The GitHub client stays for the one thing that writes history.
 *
 * `publish` is the only act of this service that writes a repository: one
 * migration file on the storage gateway, one line appended to
 * `jaen-data/patches.txt`, one commit in the publishing editor's name. The
 * ordered collection of those files, and nothing else, is what live and
 * published mean. See ./publish.
 *
 * See docs/architecture/draft-state.md.
 */
import {
  app,
  getContext,
  ServiceError,
  useAuth,
  type PylonConfig
} from '@getcronit/pylon'

import type {JaenChangeInput} from './apply-change'
import {cachedIntrospection} from './auth/cache'
import {editor as callerEditor, requireSiteAdmin} from './auth'
import {env, site as siteEntry, USER_AGENT, type AgentEnv} from './env'
import {connectDraftSocket, durableDraftStore} from './draft/durable'
import {publish as publishSite} from './publish'

export {JaenDraftObject} from './draft/object'

// --------------------------------------------------------------------------
// The answers
// --------------------------------------------------------------------------

export interface Version {
  agent: string
  commit: string | null
  builtAt: string | null
}

/** Where the media catalogue lives, see ./draft/store. */
export interface MediaField {
  pageId: string
  fieldType: string
  fieldName: string
}

/**
 * What changed at or above the reader's revision.
 *
 * Everything jaen shaped in here is a JSON scalar on the wire and not an
 * object type: a page node, a media node and a widget are whatever their field
 * types store, and pylon renders `Record<string, any>` as `JSONObject`. The
 * one object type is `mediaField`, because it is three known strings and the
 * client selects it as one.
 */
export interface DraftDelta {
  /** Page id to page node, the shape the redux `page` slice holds. */
  pages: Record<string, any>
  /** Media node id to node, for the field `mediaField` names. */
  media: Record<string, any>
  /** Media nodes that went. Empty in a full answer, which carries none. */
  removedMedia: string[]
  /** Present only when the site metadata changed. */
  site?: Record<string, any> | null
  widgets: Record<string, any>[]
  /** fieldKey -> {sub, name, at}, the ones this delta touched. */
  authors: Record<string, any>
  mediaField?: MediaField | null
}

export interface Draft {
  site: string
  /** The object's revision this answer was read at. */
  revision: number
  /** What the last publish took, so the CMS can say what is live. */
  publishedRevision: number
  /** False when sinceRevision is still the object's revision. */
  changed: boolean
  /**
   * The answer replaces the reader's copy instead of merging onto it, which
   * is what a reader with no revision, one below the pruned window, or one
   * above the object's own revision gets. The last of those is what a lost or
   * rebuilt object looks like from the outside.
   */
  full: boolean
  /** Null when changed is false. */
  delta?: DraftDelta | null
  updatedAt: string | null
  /** The Zitadel subject of the last writer. */
  updatedBy: string | null
  /** The backstop, so an operator can see it is being taken. */
  snapshotRevision: number
  snapshotAt: string | null
  snapshotBytes: number
  readAt: string
}

/**
 * The answer of the warm up call, which is the CMS saying hello.
 *
 * It touches no repository and reads no file. Its whole cost is the
 * introspection the auth middleware pays before a resolver runs, which is
 * exactly why the CMS makes it when it opens: the two seconds a cold token
 * costs are then spent while the editor is still looking at the toolbar
 * rather than inside their first save. See docs/architecture/draft-state.md,
 * "The budget".
 */
export interface Viewer {
  site: string
  sub: string
  name: string
  email: string
  /** The instant the agent answered, so the client can see it was reached. */
  at: string
}

export interface FieldOverwrite {
  field: string
  previousAuthor: string | null
  previousAt: string | null
}

export interface SaveResult {
  /** The object's revision after this write. */
  revision: number
  /**
   * The write was made against a base the object had already moved past, so
   * the object folded it onto the newer draft rather than refusing it. Never
   * a reason to drop a change: a stale save is rebased and never rejected.
   */
  rebased: boolean
  /** The fields whose value this write replaced, and who had written them. */
  overwrote: FieldOverwrite[]
  /** The field keys this write stamped. */
  touched: string[]
  /** How many storage keys it wrote, which is the cost of a save. */
  keys: number
  savedAt: string
}

/**
 * The handle `subscribe` mints for one socket.
 *
 * Single use and short lived, and it is not the editor's token: a browser's
 * WebSocket constructor sets no header, so the only two ways to carry a
 * credential onto a socket are a query parameter and a subprotocol, and the
 * editor's access token belongs in neither. The identity is decided here, the
 * one way, and the ticket is a handle onto that decision.
 */
export interface DraftTicket {
  site: string
  ticket: string
  /** `wss://<this agent>/draft/<site>`, built from the request's own host. */
  url: string
  expiresAt: string
  /** The object's revision when the ticket was minted. */
  revision: number
}

/**
 * What a publish did, and what it did not do.
 *
 * `published` and `queued` are two different questions and the answer keeps
 * them apart: a migration can be written and committed on a site that has no
 * Actions build, and a build can be dispatched on a publish that wrote no
 * migration because nothing had changed. A caller that reads only `queued`
 * would call the first of those a failure.
 */
export interface PublishResult {
  /** One migration file, one line, one commit were written. */
  published: boolean
  /** The draft revision this publish took. */
  revision: number | null
  /** The revision that is published after this call. */
  publishedRevision: number | null
  /** The migration on the storage gateway. */
  migrationUrl: string | null
  migrationBytes: number | null
  /** The commit that appended its line. */
  commitSha: string | null
  commitUrl: string | null
  publishedAt: string | null
  /** A build was dispatched. */
  queued: boolean
  workflow: string | null
  runUrl: string | null
  /** Why not, whenever `published` or `queued` is false. */
  reason: string | null
}

/** A call carries at most this many changes, and at most a megabyte. */
const MAX_CHANGES = 200
const MAX_BYTES = 1_000_000

class BadRequestError extends ServiceError {
  constructor(message: string) {
    super(message, {statusCode: 400, code: 'BAD_REQUEST'})
  }
}

/**
 * `wss://<the host this call arrived on>/draft/<site>`.
 *
 * Built from the request rather than from configuration, because one Worker
 * answers on one custom domain per site (`jaen-agent.booklimo.at` and
 * `jaen-agent.limosen.at`) and an editor's socket has to go back to the host
 * their CMS is already talking to. An empty answer is not a failure: the
 * client derives the same URL from its own endpoint when the agent does not
 * say.
 */
const socketUrl = (site: string): string => {
  try {
    const url = new URL(getContext().req.url)

    url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:'
    url.pathname = `${SOCKET_PATH}/${encodeURIComponent(site)}`
    url.search = ''
    url.hash = ''

    return url.toString()
  } catch {
    return ''
  }
}

/** The site rides in the path and never in the query, see ./draft/object. */
const SOCKET_PATH = '/draft'

// --------------------------------------------------------------------------
// The API
// --------------------------------------------------------------------------
//
// Positional arguments, because Pylon maps them to flat GraphQL arguments.
// Arrow properties on a plain object and never class methods, because Pylon
// v3 pulls a resolver off its parent and calls it without a receiver, so a
// method loses `this`.

export const graphql = {
  Query: {
    version: (): Version => {
      const e = env()

      return {
        agent: e.AGENT_VERSION ?? '4.0.0',
        commit: e.AGENT_COMMIT ?? null,
        builtAt: e.AGENT_BUILT_AT ?? null
      }
    },

    /**
     * Who is calling, and nothing else.
     *
     * The cheapest authenticated call the agent has: no GitHub round trip, no
     * file, no KV read but the auth cache's own. The CMS makes it once when it
     * opens so that the token is introspected and cached before the first
     * save needs it.
     */
    viewer: async (site: string): Promise<Viewer> => {
      const entry = siteEntry(site)

      await requireSiteAdmin(site, entry)

      const who = callerEditor(site)

      return {
        site,
        sub: who.sub,
        name: who.name,
        email: who.email,
        at: new Date().toISOString()
      }
    },

    /**
     * What changed in the site's draft above the revision the caller has.
     *
     * `sinceRevision` is the revision the caller already holds. When it is
     * still the object's revision the answer is `changed: false` with no
     * delta, which is what almost every poll of every open CMS is: one key
     * read inside the object and no list at all. Before this it was a GitHub
     * commit lookup over the network.
     *
     * The poll stays, next to the socket, and is never switched off. A
     * browser whose socket is refused, by a proxy or by a network that eats
     * upgrades, keeps working on the poll alone and never notices.
     */
    draft: async (site: string, sinceRevision?: number): Promise<Draft> => {
      const entry = siteEntry(site)

      await requireSiteAdmin(site, entry)

      const answer = await durableDraftStore(env()).read(
        site,
        typeof sinceRevision === 'number' ? sinceRevision : null
      )

      return {
        site: answer.site,
        revision: answer.revision,
        publishedRevision: answer.publishedRevision,
        changed: answer.changed,
        full: answer.full,
        delta: answer.delta
          ? {
              pages: answer.delta.pages,
              media: answer.delta.media as Record<string, any>,
              removedMedia: answer.delta.removedMedia,
              site: (answer.delta.site as Record<string, any>) ?? null,
              widgets: answer.delta.widgets as Record<string, any>[],
              authors: answer.delta.authors,
              mediaField: answer.delta.mediaField
            }
          : null,
        updatedAt: answer.updatedAt,
        updatedBy: answer.updatedBy,
        snapshotRevision: answer.snapshotRevision,
        snapshotAt: answer.snapshotAt,
        snapshotBytes: answer.snapshotBytes,
        readAt: answer.readAt
      }
    }
  },

  Mutation: {
    /**
     * Applies the batch inside the site's object and bumps its revision.
     *
     * `baseRevision` is the revision the client last saw. A save whose base is
     * not the object's current revision is stale: it is **rebased and never
     * rejected**, which means the changes are applied onto the draft as it is
     * now, the answer says `rebased: true`, and it names every field whose
     * value it replaced together with who had written it. Dropping an edit
     * because it was made a second late is the one failure this CMS may not
     * have.
     *
     * No commit, no gateway file, no line in patches.txt. A save is a save.
     */
    save: async (
      site: string,
      changes: JaenChangeInput[],
      baseRevision?: number
    ): Promise<SaveResult> => {
      const entry = siteEntry(site)
      const editor = await requireSiteAdmin(site, entry)

      if (!Array.isArray(changes) || changes.length === 0) {
        throw new BadRequestError('save without changes')
      }

      if (changes.length > MAX_CHANGES) {
        throw new BadRequestError(
          `save carries ${changes.length} changes, the limit is ${MAX_CHANGES}`
        )
      }

      const bytes = new TextEncoder().encode(JSON.stringify(changes)).length

      if (bytes > MAX_BYTES) {
        throw new BadRequestError(
          `save carries ${bytes} bytes, the limit is ${MAX_BYTES}`
        )
      }

      const outcome = await durableDraftStore(env()).write(site, {
        changes,
        baseRevision: typeof baseRevision === 'number' ? baseRevision : null,
        author: {sub: editor.sub, name: editor.name, email: editor.email}
      })

      return {
        revision: outcome.revision,
        rebased: outcome.rebased,
        overwrote: outcome.overwrote.map(o => ({
          field: o.field,
          previousAuthor: o.previousAuthor ?? null,
          previousAt: o.previousAt ?? null
        })),
        touched: outcome.touched,
        keys: outcome.keys,
        savedAt: outcome.savedAt
      }
    },

    /**
     * A handle for one socket, so the CMS is pushed to instead of polling.
     *
     * The identity is decided here and nowhere else, the one way, and what
     * travels onto the socket is a random single use ticket that lives for a
     * minute. The socket itself is `GET /draft/<site>` on this same Worker,
     * with the ticket offered as a subprotocol, and it carries revisions and
     * never content: the client reads the delta with the `draft` query above,
     * so there is one read path and one authorisation path for the data.
     */
    subscribe: async (site: string): Promise<DraftTicket> => {
      const entry = siteEntry(site)
      const editor = await requireSiteAdmin(site, entry)

      const minted = await durableDraftStore(env()).subscribe(site, {
        sub: editor.sub,
        name: editor.name,
        email: editor.email
      })

      return {...minted, url: socketUrl(site)}
    },

    /**
     * The only act in this service that writes a repository.
     *
     * It reads the draft out of the store, writes one migration in jaen's
     * shape, uploads it to the storage gateway with the site's machine token,
     * appends its URL as one line to `jaen-data/patches.txt`, commits that one
     * line in the publishing editor's name, records the revision it took, and
     * triggers the build where the site has one.
     *
     * A site entry without a `publishWorkflow` answers `queued: false` with
     * the reason, and so does a workflow GitHub refuses to dispatch. That is
     * the honest answer for both limousine sites today, where the build is
     * `scripts/deploy.sh` run by the operator after a pull. The migration is
     * in the chain either way, which is what `published` says and what a
     * caller has to read instead of `queued`.
     *
     * `message` is the migration's own message, the line the CMS shows in its
     * publish list. An empty one is replaced rather than refused.
     *
     * See ./publish and docs/architecture/draft-state.md, "Publish: the only
     * writer of history".
     */
    publish: async (site: string, message?: string): Promise<PublishResult> => {
      const entry = siteEntry(site)
      const admin = await requireSiteAdmin(site, entry)

      // The store is built here and passed in, so ./publish names no
      // Cloudflare type and a single process implementation of the same four
      // operations is one line's change.
      return await publishSite(durableDraftStore(env()), site, entry, {
        editor: {sub: admin.sub, name: admin.name, email: admin.email},
        message: message ?? null
      })
    }
  }
}

// --------------------------------------------------------------------------
// The Worker
// --------------------------------------------------------------------------

const upstreamFetch = globalThis.fetch

/**
 * Every outgoing request carries a User-Agent. Cloudflare fronts both the
 * identity server and the identity facade and answers a request without one
 * with `error code: 1010` in plain text, which is not JSON and which the
 * introspection then reports as a broken token.
 */
globalThis.fetch = (async (input: any, init?: any) => {
  const headers = new Headers(
    init?.headers ?? (input instanceof Request ? input.headers : undefined)
  )

  if (!headers.has('user-agent')) headers.set('user-agent', USER_AGENT)

  return upstreamFetch(input, {...init, headers})
}) as typeof fetch

/**
 * AUTH_ISSUER is mandatory and there is no unauthenticated variant of this
 * service, because the agent holds write access to every site repository of
 * the estate. Without the variable pylon installs no auth plugin at all,
 * `auth` stays empty, and every guarded call is refused with a message no one
 * can tell from a broken token, which is the trap that cost a day on
 * netsnek.com and photonq.org on 2026-08-21. A Worker cannot decline to boot,
 * so it declines to answer, and says why.
 *
 * Read from the process environment rather than from a request, because the
 * plugin list is built once at module scope. `wrangler dev` and `wrangler
 * deploy` both put a [vars] entry there.
 */
const AUTH_ISSUER =
  (typeof process !== 'undefined' ? process.env?.AUTH_ISSUER : undefined) ?? ''

const issuerMissing = !AUTH_ISSUER.trim()

if (issuerMissing) {
  console.error(
    'jaen-agent: AUTH_ISSUER is unset. The service holds write access to every ' +
      'site repository and will refuse every request until it is set.'
  )
}

app.use('*', async (ctx, next) => {
  if (!issuerMissing) return next()

  return ctx.json(
    {
      errors: [
        {
          message:
            'jaen-agent refuses to serve without AUTH_ISSUER. It holds write ' +
            'access to every site repository, so there is no unauthenticated ' +
            'variant of it. Set the var and redeploy.',
          extensions: {code: 'AUTH_ISSUER_MISSING'}
        }
      ]
    },
    500
  )
})

/**
 * The socket, which is the one route of this Worker that is not GraphQL.
 *
 * `GET /draft/<site>`, upgraded, with the ticket offered as a subprotocol.
 * The upgrade is forwarded whole to the site's object, which is the only
 * place that can say whether it minted that ticket and the only place that
 * can make the 101 answer. Nothing else about a draft leaves the object.
 *
 * It is registered before pylon's own handler, so the GraphQL endpoint is
 * untouched, and after the AUTH_ISSUER guard above, so a Worker that refuses
 * to serve refuses this too.
 */
app.get('/draft/:site', async ctx => {
  const site = ctx.req.param('site')

  if ((ctx.req.header('upgrade') ?? '').toLowerCase() !== 'websocket') {
    return ctx.json(
      {
        errors: [
          {
            message:
              'This route is the draft socket and takes a WebSocket upgrade. ' +
              'The draft itself is read with the `draft` query.',
            extensions: {code: 'UPGRADE_REQUIRED'}
          }
        ]
      },
      426
    )
  }

  try {
    siteEntry(site)
  } catch {
    return ctx.json(
      {
        errors: [
          {
            message: `unknown site "${site}"`,
            extensions: {code: 'UNKNOWN_SITE'}
          }
        ]
      },
      404
    )
  }

  // `ctx.env` is hono's own Bindings type and the agent's env is a wider
  // shape than it declares, so the cast goes through unknown.
  return connectDraftSocket(
    ctx.env as unknown as AgentEnv,
    site,
    ctx.req.raw
  )
})

/**
 * The auth plugin, with its answer remembered across requests for a minute
 * per token (./auth/cache). Wrapped rather than replaced: the plugin stays
 * the only thing that validates a token, and without the wrapper every five
 * second poll of every open CMS would pay an introspection and a userinfo
 * round trip, about 1.5 s, before a resolver ran.
 *
 * Pylon's own `@requireAuth()` is not used anywhere in this service. `useAuth`
 * sets `auth` on every request, an anonymous one included, and the decorator
 * only checks that `auth` is truthy, so an anonymous caller passes it. The
 * guard is ./auth requireSiteAdmin, which demands a subject.
 */
const authPlugin = () => {
  const plugin = useAuth({issuer: AUTH_ISSUER})

  return {
    ...plugin,
    middleware: plugin.middleware
      ? cachedIntrospection(plugin.middleware as any)
      : undefined
  }
}

export const config: PylonConfig = {
  plugins: issuerMissing ? [] : [authPlugin() as any]
}

export default app

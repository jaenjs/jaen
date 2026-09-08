/**
 * jaen-agent
 *
 * The one process that reads a site's jaen data from its repository and
 * writes every saved change back as a git commit. There is no database: the
 * repository is the store, the draft of a site is the site's own jaen data in
 * its own repository in the structure it has today, and what editors share is
 * the repository's HEAD.
 *
 * `save` and `draft` are the shared draft's two verbs and are being moved off
 * the repository and into one Durable Object per site (`draft-state.md`, "The
 * draft: one Durable Object per site").
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
  getEnv,
  ServiceError,
  useAuth,
  type PylonConfig
} from '@getcronit/pylon'

import type {JaenChangeInput} from './apply-change'
import {cachedIntrospection} from './auth/cache'
import {editor as callerEditor, requireSiteAdmin} from './auth'
import {env, site as siteEntry, USER_AGENT} from './env'
import {headFilesDraft} from './head-files-draft'
import {publish as publishSite, useDraftSource} from './publish'
import {readHead, readHeadSha, save as saveToRepository} from './store'
import type {FieldAuthors} from './types'

/**
 * The draft store publish reads.
 *
 * One line, and it is the seam `draft-state.md` asks for: the Durable Object
 * implementation of the same interface replaces the argument here and nothing
 * in ./publish moves. Until it lands the interim reader stands in, see
 * ./head-files-draft.
 */
useDraftSource(headFilesDraft)

// --------------------------------------------------------------------------
// The answers
// --------------------------------------------------------------------------

export interface Version {
  agent: string
  commit: string | null
  builtAt: string | null
}

export interface Draft {
  site: string
  /** The branch HEAD commit the answer was read at. */
  headSha: string
  /** jaen-data/live.json at that commit. Empty before the first save. */
  blobSha: string
  /** False when sinceSha is still the head. */
  changed: boolean
  /** Null when changed is false. `{pages, site, widgets}`. */
  data?: Record<string, any> | null
  /** fieldKey -> {sub, name, at}. */
  authors?: Record<string, any> | null
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
  headSha: string
  blobSha: string
  commitSha: string
  commitUrl: string
  savedAt: string
  rebased: boolean
  /** The fields whose remote value this save replaced, and who had written them. */
  overwrote: FieldOverwrite[]
  /**
   * The head files this save wrote, relative to the repository root. A text
   * change writes `jaen-data/live.json` and a picture
   * `jaen-data/live-media.json`, and neither writes the other.
   */
  wrote: string[]
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
        agent: e.AGENT_VERSION ?? '3.0.0',
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
     * The site's jaen data at the repository's HEAD.
     *
     * `sinceSha` is the head the caller already has. When it still matches,
     * the answer is `changed: false` with no body, which is the five second
     * poll of every open CMS and costs one commit lookup.
     */
    draft: async (site: string, sinceSha?: string): Promise<Draft> => {
      const entry = siteEntry(site)

      await requireSiteAdmin(site, entry)

      // The poll that answers `changed: false` reads the branch head and no
      // file at all, which is what almost every poll of every open CMS is.
      if (sinceSha) {
        const head = await readHeadSha(site, entry)

        if (head === sinceSha) {
          return {
            site,
            headSha: head,
            blobSha: '',
            changed: false,
            data: null,
            authors: null,
            readAt: new Date().toISOString()
          }
        }
      }

      const state = await readHead(site, entry)

      return {
        site,
        headSha: state.head,
        blobSha: state.blobSha ?? '',
        changed: true,
        data: state.patch.data,
        authors: (state.patch.authors ?? {}) as FieldAuthors,
        readAt: state.readAt
      }
    }
  },

  Mutation: {
    /**
     * Applies the batch and commits it, in the editor's name, one commit per
     * call.
     *
     * `baseSha` is the head sha the client last saw. A save whose baseSha is
     * not the current head is stale: it is rebased onto the document read
     * under the lock and never rejected, and the answer says so and names the
     * fields it overwrote.
     */
    save: async (
      site: string,
      changes: JaenChangeInput[],
      baseSha?: string
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

      const outcome = await saveToRepository(site, entry, {
        changes,
        baseSha: baseSha ?? null,
        author: {sub: editor.sub, name: editor.name, email: editor.email}
      })

      return {
        headSha: outcome.headSha,
        blobSha: outcome.blobSha,
        commitSha: outcome.commitSha,
        commitUrl: outcome.commitUrl,
        savedAt: outcome.savedAt,
        rebased: outcome.rebased,
        overwrote: outcome.overwrote.map(o => ({
          field: o.field,
          previousAuthor: o.previousAuthor ?? null,
          previousAt: o.previousAt ?? null
        })),
        wrote: outcome.wrote
      }
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

      const outcome = await publishSite(site, entry, {
        editor: {sub: admin.sub, name: admin.name, email: admin.email},
        message: message ?? null
      })

      return outcome
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

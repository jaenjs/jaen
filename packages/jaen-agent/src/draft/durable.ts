/**
 * The draft store on a Durable Object, which is the first implementation of
 * ./store and today the only one.
 *
 * Everything Cloudflare specific about the draft is in this file and in
 * ./object. The resolvers see the four operations and no binding, so the day
 * the estate wants its own machine the swap is one function: a store over a
 * single process with SQLite, where the serialisation this object gets from
 * being single threaded is free because there is only one process.
 *
 * The address is the site's name, `idFromName(site)`, so there is exactly one
 * instance per site and it is the same instance for every editor of it.
 */
import {ServiceError} from '@getcronit/pylon'

import type {AgentEnv} from '../env'
import type {
  DraftDiscardInput,
  DraftDiscardPreview,
  DraftDiscardResult,
  DraftMeta,
  DraftRead,
  DraftSnapshot,
  DraftStore,
  DraftTicket,
  DraftWriteInput,
  DraftWriteResult
} from './store'

export class DraftStoreUnavailableError extends ServiceError {
  constructor(reason: string) {
    super(
      `The draft store is not reachable: ${reason}. The CMS keeps its ` +
        `changes in the browser and sends them again, so nothing is lost, ` +
        `but nothing is shared until this is fixed.`,
      {statusCode: 503, code: 'DRAFT_STORE_UNAVAILABLE'}
    )
  }
}

/**
 * The one refusal the draft store makes, carried back out as itself.
 *
 * Every failure of the object below is a 500 and becomes "the draft store is
 * unreachable", which tells a client to keep its changes and retry. That is
 * right for an outage and wrong for this: a save refused because its base is
 * below a discard must make the client drop what it holds, not retry it for
 * ever. So the object answers a code and this turns it back into a refusal
 * the CMS knows by name.
 */
export class DraftDiscardedError extends ServiceError {
  constructor(
    message: string,
    readonly discardedRevision: number,
    readonly discardedAt: string | null,
    readonly discardedByName: string | null
  ) {
    super(message, {
      statusCode: 409,
      code: 'DRAFT_DISCARDED',
      // The client reads these off the error's extensions and needs no second
      // round trip to find out which revision invalidated it. Pylon's
      // ServiceError puts anything beyond the code and the status under
      // `details`, so that is where they go.
      details: {discardedRevision, discardedAt, discardedByName}
    })
  }
}

const namespace = (env: AgentEnv): DurableObjectNamespace => {
  const binding = env.DRAFTS as DurableObjectNamespace | undefined

  if (!binding) {
    // A deployment without the binding is a deployment mistake, and it is the
    // one that would otherwise look like "the site has no draft".
    throw new DraftStoreUnavailableError(
      'the DRAFTS Durable Object binding is not bound to this Worker'
    )
  }

  return binding
}

const stub = (env: AgentEnv, site: string): DurableObjectStub =>
  namespace(env).get(namespace(env).idFromName(site))

const call = async <T>(
  env: AgentEnv,
  site: string,
  op: string,
  body: Record<string, unknown>
): Promise<T> => {
  const response = await stub(env, site).fetch(`https://draft/${op}`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({site, ...body})
  })

  const text = await response.text()

  if (!response.ok) {
    let reason = text.slice(0, 300)
    let known: {
      error?: string
      code?: string | null
      discardedRevision?: number
      discardedAt?: string | null
      discardedByName?: string | null
    } = {}

    try {
      known = JSON.parse(text)
      reason = known.error ?? reason
    } catch {
      // Not JSON, which means the runtime answered rather than the object.
    }

    if (known.code === 'DRAFT_DISCARDED') {
      throw new DraftDiscardedError(
        reason,
        known.discardedRevision ?? 0,
        known.discardedAt ?? null,
        known.discardedByName ?? null
      )
    }

    throw new DraftStoreUnavailableError(
      `${op} answered ${response.status}, ${reason}`
    )
  }

  return JSON.parse(text) as T
}

export const durableDraftStore = (env: AgentEnv): DraftStore => ({
  read: (site, sinceRevision) =>
    call<DraftRead>(env, site, 'read', {
      sinceRevision: typeof sinceRevision === 'number' ? sinceRevision : null
    }),

  write: (site, input: DraftWriteInput) =>
    call<DraftWriteResult>(env, site, 'write', {input}),

  subscribe: (site, viewer) =>
    call<DraftTicket>(env, site, 'subscribe', {viewer}),

  snapshot: site => call<DraftSnapshot>(env, site, 'snapshot', {}),

  markPublished: (site, revision, published) =>
    call<DraftMeta>(env, site, 'published', {
      revision,
      published: published ?? null
    }),

  discardPreview: site =>
    call<DraftDiscardPreview>(env, site, 'discardPreview', {}),

  discard: (site, input: DraftDiscardInput) =>
    call<DraftDiscardResult>(env, site, 'discard', {input}),

  discardedSnapshot: async site =>
    (await call<{snapshot: DraftSnapshot | null}>(env, site, 'discarded', {}))
      .snapshot
})

/**
 * The upgrade, handed to the object as it arrived.
 *
 * Transport and not one of the four operations, see ./store. The request is
 * forwarded whole because the 101 answer carries a socket that only the
 * runtime can make, and the ticket is checked inside the object, which is the
 * only place that knows whether it minted it.
 */
export const connectDraftSocket = async (
  env: AgentEnv,
  site: string,
  request: Request
): Promise<Response> => {
  const url = new URL('https://draft/connect')

  url.searchParams.set('site', site)

  // `new Request(url, request)` and not a second argument: the upgrade's own
  // headers have to survive the hop, and only a Request carries them.
  return stub(env, site).fetch(new Request(url.toString(), request))
}

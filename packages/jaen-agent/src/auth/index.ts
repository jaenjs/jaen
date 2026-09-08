// src/auth/index.ts
//
// Who is calling, and which site they may touch.
//
// Two answers, kept apart on purpose, the same two the taxi pylon gives:
//   AUTH_REQUIRED  no valid token at all, statusCode 401
//   FORBIDDEN      a valid token whose identity does not allow the call, 403
//
// Pylon's own @requireAuth() is not used. `useAuth` sets `auth` on every
// request, an anonymous one included, and the decorator only checks that
// `auth` is truthy, so anonymous callers pass it (measured 2026-08-22: 24
// tokenless requests, 24 times HTTP 200). This file demands `auth.sub`.
import {getContext, ServiceError} from '@getcronit/pylon'

import {env, USER_AGENT, type SiteEntry} from '../env'
import {
  AUTH_CACHE_ENTRY_KEY,
  persistCallerGrants,
  ROLES_CACHE_KEY,
  type AuthCacheEntry
} from './cache'

export const DEFAULT_ADMIN_ROLE = 'jaen:admin'

export class AuthRequiredError extends ServiceError {
  constructor(message = 'Authentication required') {
    super(message, {statusCode: 401, code: 'AUTH_REQUIRED'})
  }
}

export class ForbiddenError extends ServiceError {
  constructor(message = 'Forbidden') {
    super(message, {statusCode: 403, code: 'FORBIDDEN'})
  }
}

/**
 * The third answer, and the one this file did not have until 2026-09-08.
 *
 * A caller's roles are read from the token's own claims where the issuer
 * asserts them and, failing that, from one lookup through the site's identity
 * facade. A lookup that fails answers the same empty list as a lookup that
 * succeeds and finds nothing, and until this existed the guard read both as
 * "this person holds no roles" and refused the person.
 *
 * `okf/decisions/hard-rules.md` has the rule and it is there because it cost
 * a morning: "an empty identity answer is never evidence that the directory
 * is empty". `private-storage.md` draws the same line for the gateway, where
 * a failed introspection is a 500 and never a 401, "a broken credential
 * served as 'you are not signed in' is the failure that hides longest".
 *
 * So a decision that depended on a lookup that failed is not made at all.
 * The editor is told the identity service could not be reached, the CMS keeps
 * the change in its outbox and retries, and nothing is lost. Refusing the
 * person instead is what happened on the live booklimo.at on 2026-09-08, for
 * seven minutes and sixteen calls, to an account that held `jaen:admin`
 * throughout.
 */
export class IdentityUnavailableError extends ServiceError {
  constructor(
    message = 'The identity service could not be reached, so this call cannot be decided.'
  ) {
    super(message, {statusCode: 503, code: 'IDENTITY_UNAVAILABLE'})
  }
}

/**
 * What pylon v3's `useAuth` leaves on the context.
 *
 * `auth` is `{openidConfig}` on every request, an anonymous one included, and
 * grows a `user` only when a token introspected as active. `user` is the
 * issuer's userinfo answer plus `roles`, which the plugin derives from the
 * introspection's `urn:zitadel:iam:org:projects:roles` claim and reduces to
 * the bare keys, dropping the organisations that granted them. That is why
 * the organisation below comes from the userinfo claim or, failing that, from
 * the site's identity facade.
 */
type AuthUser = {
  sub?: string
  name?: string
  email?: string
  preferred_username?: string
  roles?: unknown
  'urn:zitadel:iam:user:resourceowner:id'?: string
  [claim: string]: unknown
}

type AuthState = {
  user?: AuthUser
  openidConfig?: unknown
}

/**
 * Zitadel spells the project roles claim in more than one way, generic and
 * project scoped, and which one arrives depends on the project's role
 * assertion setting. The value is `{"<roleKey>": {"<orgId>": "<domain>"}}`,
 * so the role keys are the keys of that object and the organisations that
 * granted them are the keys of each value.
 */
const ROLES_CLAIM = /^urn:zitadel:iam:org:projects?:(\d+:)?roles$/

const authState = (): AuthUser | undefined => {
  try {
    return (getContext().get('auth') as AuthState | undefined)?.user
  } catch {
    return undefined
  }
}

/** The Zitadel user id of the caller, or null when nobody is signed in. */
export const callerId = (): string | null => {
  const sub = authState()?.sub
  return typeof sub === 'string' && sub.trim() ? sub.trim() : null
}

/** Dedupe, and next to `<projectId>:jaen:admin` keep the bare `jaen:admin`. */
const normalise = (raw: Iterable<unknown>): string[] => {
  const out = new Set<string>()

  for (const value of raw) {
    if (typeof value !== 'string') continue
    const key = value.trim()
    if (!key) continue
    out.add(key)
    const scoped = /^\d+:(.+)$/.exec(key)
    if (scoped?.[1]) out.add(scoped[1])
  }

  return Array.from(out)
}

/**
 * The role claims, together with the organisations that granted each of them.
 *
 * The organisation matters as much as the key: `jaen:admin` granted by
 * limosen's organisation is not `jaen:admin` on booklimo, and both sites sign
 * in against the same Zitadel with the same project and the same client, so
 * the audience cannot tell them apart.
 */
const grantsFromClaims = (
  auth: AuthUser
): Array<{key: string; orgs: string[]}> => {
  const found: Array<{key: string; orgs: string[]}> = []

  for (const [claim, value] of Object.entries(auth)) {
    if (!ROLES_CLAIM.test(claim)) continue
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue

    for (const [key, orgs] of Object.entries(
      value as Record<string, unknown>
    )) {
      found.push({
        key,
        orgs:
          orgs && typeof orgs === 'object' && !Array.isArray(orgs)
            ? Object.keys(orgs as Record<string, unknown>)
            : []
      })
    }
  }

  return found
}

export interface CallerGrant {
  key: string
  /** The organisations that granted it. Empty when the source cannot say. */
  orgs: string[]
}

export interface ResolvedCaller {
  grants: CallerGrant[]
  /** Every organisation the caller is known to belong to. */
  orgs: Set<string>
  /**
   * The identity facade was asked and could not answer, so what is above is
   * what the token said and nothing more. A refusal built on it would be a
   * guess. Never true when the claims alone settled the question.
   */
  unavailable?: boolean
}

/**
 * Who the caller is, as far as the site's own identity can say.
 *
 * Three sources, in order, and the later ones are only asked when the earlier
 * ones said nothing:
 *   1. the roles claim of the userinfo answer, which carries the granting
 *      organisation per role where the issuer asserts it;
 *   2. pylon's own `user.roles`, the bare keys of the introspection's
 *      `urn:zitadel:iam:org:projects:roles`, with the organisations dropped;
 *   3. one lookup through the site's identity facade, `idm.<brand>`, made
 *      with the Worker's own ORG_USER_MANAGER_TOKEN and never with the
 *      caller's token, which answers both the roles and the `resourceOwner`.
 *
 * A lookup that fails is told apart from a lookup that finds nothing: the
 * first sets `unavailable` and the second does not, and only the second is a
 * caller with no roles. A resolution carrying `unavailable` is never cached,
 * on the request or in the shared tier, because a transient that is written
 * into a sixty second cache is a lockout that outlives its own cause: KV's
 * expiry has a minute as its floor, so one failed lookup used to refuse the
 * person for at least that long, and every refresh past half the entry's life
 * re-ran the same failing lookup. Otherwise cached on the request, and with
 * the token for its minute.
 */
export const resolveCaller = async (
  entry: SiteEntry
): Promise<ResolvedCaller> => {
  const auth = authState()

  if (!auth) return {grants: [], orgs: new Set()}

  let ctx: any

  try {
    ctx = getContext()
  } catch {
    ctx = undefined
  }

  /**
   * The resolution is cached per SITE and not per token, and that is a
   * correction and not a refinement.
   *
   * The cache below the whole of this file is keyed by the SHA-256 of the
   * bearer, in this isolate and in the KV both, because it remembers an
   * identity. A resolution is not an identity: the same person is an admin on
   * one site and a stranger on the other, the facade that answers for one is
   * not the facade that answers for the other, and both sites sign in against
   * one Zitadel with one project and one client so the token cannot tell them
   * apart. Keyed by the token alone, the empty grants of the site a caller is
   * a stranger on were written under their token and then read back on the
   * site they are an admin of, refusing them for the cache's minute and being
   * rewritten by every refresh past half its life. Measured 2026-09-08 on the
   * deployed agent: the limosen admin, asked for booklimo's draft and then
   * for limosen's, was refused its own site. That is the shape of the seven
   * minute lockout of the same morning, which healed on its own once the
   * calls stopped, and it is why `draft-state.md` could not find a cause on
   * any identity server.
   *
   * The scope is the organisation and the facade, which is everything the
   * answer depends on, so two sites of one organisation still share it.
   */
  const scope = `${entry.organizationId}\n${entry.iamApiUrl ?? ''}`
  const byScope = (ctx?.get(ROLES_CACHE_KEY) ?? {}) as Record<string, unknown>
  const cached =
    byScope && typeof byScope === 'object' ? byScope[scope] : undefined

  if (cached && Array.isArray((cached as any).grants)) {
    const hit = cached as {grants: CallerGrant[]; orgs: string[]}
    return {grants: hit.grants, orgs: new Set(hit.orgs)}
  }

  const fromPylon = Array.isArray(auth.roles)
    ? normalise(auth.roles).map(key => ({key, orgs: [] as string[]}))
    : []

  let grants: CallerGrant[] = [...grantsFromClaims(auth), ...fromPylon]

  // Expand `<projectId>:jaen:admin` to the bare key, keeping the orgs.
  grants = grants.flatMap(grant => {
    const scoped = /^\d+:(.+)$/.exec(grant.key)
    return scoped?.[1] ? [grant, {key: scoped[1], orgs: grant.orgs}] : [grant]
  })

  const orgs = new Set<string>()
  const owner = callerResourceOwner()

  if (owner) orgs.add(owner)
  for (const grant of grants) for (const org of grant.orgs) orgs.add(org)

  // Nothing said which roles the caller holds, or nothing said where the
  // account lives. Either leaves the site check unable to decide, so ask the
  // facade once. It answers both.
  let unavailable = false

  if (grants.length === 0 || orgs.size === 0) {
    const facade = await facadeGrants(entry, callerId() as string)

    unavailable = facade.unavailable === true
    grants = grants.length === 0 ? facade.grants : grants
    for (const org of facade.orgs) orgs.add(org)
  }

  const resolved: ResolvedCaller = {grants, orgs, unavailable}

  // A resolution the facade could not confirm is this request's alone. Caching
  // it would hand the next request an answer that was never an answer.
  if (unavailable) return resolved

  const resolvedByScope = {
    ...(byScope && typeof byScope === 'object' ? byScope : {}),
    [scope]: {grants, orgs: Array.from(orgs)}
  }

  ctx?.set(ROLES_CACHE_KEY, resolvedByScope)

  const cacheEntry = ctx?.get(AUTH_CACHE_ENTRY_KEY) as
    | AuthCacheEntry
    | undefined

  if (cacheEntry && typeof cacheEntry === 'object') {
    ;(cacheEntry as any).grants = resolvedByScope

    // Into the shared tier as well, or the next cold isolate reads the
    // identity out of the KV and pays the facade lookup all over again.
    if (ctx) persistCallerGrants(ctx, cacheEntry)
  }

  return resolved
}

const FACADE_QUERY = `query JaenAgentCaller($id: String!) {
  user(args: {id: $id}) {
    id
    __typename
    ... on HumanUser { resourceOwner roles { edges { node { key } } } }
    ... on MachineUser { resourceOwner roles { edges { node { key } } } }
  }
}`

/**
 * The control question, and the reason this file can tell a refusal from an
 * outage at all.
 *
 * Measured against `idm.booklimo.at` and `idm.limosen.at` on 2026-09-08: the
 * facade answers `user(args: {id})` with `INTERNAL_SERVER_ERROR` and
 * `data: null` for **every** id it will not talk about, an account of another
 * organisation and an id that does not exist alike, so the caller's own lookup
 * cannot tell "not yours" from "cannot say".
 *
 * `currentUser` can, and it is the one question every credential may ask: it
 * answers who the Worker's own token is and which organisation that account
 * lives in. Two things follow from one round trip. The facade answered, so it
 * is up and the credential is live. And the directory it answered from is the
 * site's own, or it is not, which is precisely the failure
 * `okf/decisions/hard-rules.md` was written after: a wrong
 * `ORG_USER_MANAGER_TOKEN` made every KRC driver roleless for a morning
 * because "an empty identity answer is never evidence that the directory is
 * empty".
 *
 * `organization(id)` was tried first and rejected: it answers `null` rather
 * than an error for an organisation the credential may not read, which is the
 * behaviour this needs, and reading an organisation at all takes a role the
 * site's own admin accounts do not hold, so the control would have said "the
 * facade cannot see this organisation" about a perfectly healthy one.
 */
const CONTROL_QUERY = `query JaenAgentControl {
  currentUser {
    __typename
    ... on HumanUser { id resourceOwner }
    ... on MachineUser { id resourceOwner }
  }
}`

/** A healthy control, per credential and organisation, for its minute. */
const controlSeenUntil = new Map<string, number>()

const CONTROL_TTL_MS = 60_000

type FacadeAnswer = {
  reached: boolean
  status: number
  json: any
}

const askFacade = async (
  url: string,
  bearer: string,
  query: string,
  variables: Record<string, unknown>
): Promise<FacadeAnswer> => {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${bearer}`,
        // Cloudflare fronts the facade and answers a request without one with
        // `error code: 1010` in plain text, which is not JSON.
        'User-Agent': USER_AGENT
      },
      body: JSON.stringify({query, variables})
    })

    const json = await res.json().catch(() => undefined)

    // A body that is not JSON, or a status that is not a success, is the
    // facade not answering rather than the facade answering nothing. A token
    // that has expired is a 401 here, and it is the case that must never be
    // read as "this person holds no roles".
    return {reached: res.ok && json !== undefined, status: res.status, json}
  } catch (error) {
    console.error('jaen-agent: the identity facade could not be reached', error)
    return {reached: false, status: 0, json: undefined}
  }
}

/**
 * Whether the facade answered, and whether it answered for this site.
 *
 * `true` and `false` are answers. `undefined` is "the control itself could not
 * be taken", which is deliberately not an outage: a facade that does not carry
 * `currentUser`, or carries it in another shape, would otherwise turn every
 * refusal on every site into a 503. Where the control cannot be taken this
 * file falls back to what it did before it existed.
 */
const facadeAnswersFor = async (
  url: string,
  bearer: string,
  organizationId: string
): Promise<boolean | undefined> => {
  if (!organizationId) return undefined

  const key = `${url}\n${organizationId}`
  const seen = controlSeenUntil.get(key)

  // Only a healthy control is remembered. Caching the unhealthy one would
  // hold a site shut for a minute after its cause had gone.
  if (seen !== undefined && seen > Date.now()) return true

  const answer = await askFacade(url, bearer, CONTROL_QUERY, {})

  if (!answer.reached) return false

  const owner = answer.json?.data?.currentUser?.resourceOwner

  if (typeof owner === 'string' && owner) {
    if (owner === organizationId) {
      controlSeenUntil.set(key, Date.now() + CONTROL_TTL_MS)
      return true
    }

    console.error(
      'jaen-agent: the identity credential for this site lives in',
      owner,
      'and the site is',
      organizationId
    )

    return false
  }

  console.error(
    'jaen-agent: the identity control question was not answered',
    answer.json?.errors?.[0]?.message ?? `HTTP ${answer.status}`
  )

  return undefined
}

const facadeGrants = async (
  entry: SiteEntry,
  userId: string
): Promise<{grants: CallerGrant[]; orgs: string[]; unavailable?: boolean}> => {
  const url = entry.iamApiUrl
  // One token per site, the way the taxi pylons hold theirs: the facade
  // answers for the organisation of the token it is sent, so limosen's
  // manager asked about a booklimo account answers nothing.
  const bearer =
    (entry.orgManagerTokenVar
      ? (env()[entry.orgManagerTokenVar] as string | undefined)
      : undefined) || env().ORG_USER_MANAGER_TOKEN

  // Nothing to ask with. That is a configuration this deployment was given
  // and not a transient, so it is not `unavailable`: an agent with no facade
  // configured decides on the claims alone, which is what it has always done.
  if (!url || !bearer || !userId) return {grants: [], orgs: []}

  const answer = await askFacade(url, bearer, FACADE_QUERY, {id: userId})
  const user = answer.reached ? answer.json?.data?.user : undefined

  if (user) {
    const orgs = user.resourceOwner ? [String(user.resourceOwner)] : []

    const grants = (user.roles?.edges ?? [])
      .map((edge: any) => edge?.node?.key)
      .filter((key: unknown): key is string => typeof key === 'string')
      .map((key: string) => ({key, orgs}))

    return {grants, orgs}
  }

  // Nothing came back about this caller, and the facade says the same thing
  // about a stranger and about an outage. The control question decides which
  // it was. See CONTROL_QUERY above.
  const sees = answer.reached
    ? await facadeAnswersFor(url, bearer, entry.organizationId)
    : false

  if (sees === true) {
    // The facade is answering for this site's organisation and it will not
    // name this caller, so the caller is not in it. A refusal.
    return {grants: [], orgs: []}
  }

  if (sees === false) {
    console.error(
      'jaen-agent: the identity facade did not answer for',
      entry.organizationId,
      'so the roles of',
      userId,
      'are unknown:',
      answer.json?.errors?.[0]?.message ?? `HTTP ${answer.status}`
    )

    return {grants: [], orgs: [], unavailable: true}
  }

  // The control could not be taken at all. Fall back to what this file did
  // before it existed rather than refuse every caller of every site.
  console.error(
    'jaen-agent: the grant lookup answered nothing for',
    userId,
    answer.json?.errors?.[0]?.message ?? `HTTP ${answer.status}`
  )

  return {grants: [], orgs: []}
}

/** The organisation the account itself lives in, from the userinfo claim. */
export const callerResourceOwner = (): string | undefined => {
  const value = authState()?.['urn:zitadel:iam:user:resourceowner:id']
  return typeof value === 'string' && value ? value : undefined
}

export interface Editor {
  sub: string
  name: string
  email: string
}

/**
 * The editor as the commit author line names them.
 *
 * An editor without an email claim gets `<sub>@users.noreply.<site>`, which is
 * stable and never routes anywhere. `git log --format='%an <%ae>'` on the site
 * repository is then the audit trail.
 */
export const editor = (siteKey: string): Editor => {
  const auth = authState() ?? {}
  const sub = callerId() ?? 'unknown'

  const name =
    (typeof auth.name === 'string' && auth.name) ||
    (typeof auth.preferred_username === 'string' && auth.preferred_username) ||
    sub

  const email =
    typeof auth.email === 'string' && auth.email
      ? auth.email
      : `${sub}@users.noreply.${siteKey}`

  return {sub, name, email}
}

/**
 * The one guard.
 *
 * A call is allowed when the caller holds the entry's adminRole and the
 * organisation that granted it, or failing that the organisation the account
 * lives in, is the entry's organizationId. So limosen's admin gets a
 * FORBIDDEN on booklimo, a booklimo customer gets one too, and an anonymous
 * call gets an AUTH_REQUIRED.
 *
 * The site key names the repository, the identity decides the permission. The
 * audience cannot: both sites share one Zitadel project and one client, so it
 * is identical on both.
 */
export const requireSiteAdmin = async (
  siteKey: string,
  entry: SiteEntry
): Promise<Editor> => {
  if (!callerId()) throw new AuthRequiredError()

  const role = entry.adminRole || DEFAULT_ADMIN_ROLE
  const {grants, orgs, unavailable} = await resolveCaller(entry)

  const allowed = grants.some(grant => {
    if (grant.key !== role) return false
    if (grant.orgs.length > 0) return grant.orgs.includes(entry.organizationId)
    return orgs.has(entry.organizationId)
  })

  // The claims may still carry the grant, and where they do the lookup was
  // only ever asked for the organisation: a caller who is allowed is allowed
  // whatever the facade did. It is a refusal that must not be built on a
  // lookup that failed.
  if (!allowed && unavailable) {
    throw new IdentityUnavailableError(
      `The identity service for ${siteKey} could not be reached, so whether ` +
        `this account holds ${role} is unknown. Nothing was changed.`
    )
  }

  if (!allowed) {
    throw new ForbiddenError(
      `${role} on ${siteKey} is required, and it counts only when the site's ` +
        `own organisation granted it.`
    )
  }

  return editor(siteKey)
}

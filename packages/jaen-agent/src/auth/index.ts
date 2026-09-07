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
 * A failed lookup answers nothing, which is a caller with no roles and never
 * an admin. Cached on the request, and with the token for its minute.
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

  const cached = ctx?.get(ROLES_CACHE_KEY)

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
  if (grants.length === 0 || orgs.size === 0) {
    const facade = await facadeGrants(entry, callerId() as string)

    grants = grants.length === 0 ? facade.grants : grants
    for (const org of facade.orgs) orgs.add(org)
  }

  const resolved: ResolvedCaller = {grants, orgs}

  ctx?.set(ROLES_CACHE_KEY, {grants, orgs: Array.from(orgs)})

  const cacheEntry = ctx?.get(AUTH_CACHE_ENTRY_KEY) as
    | AuthCacheEntry
    | undefined

  if (cacheEntry && typeof cacheEntry === 'object') {
    ;(cacheEntry as any).grants = {grants, orgs: Array.from(orgs)}
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
 * One grant lookup through the site's own identity facade, `idm.<brand>`.
 *
 * The facade is scoped to the site's organisation, so an account of the other
 * brand is not found there at all, which is already the refusal acceptance 3
 * asks for. `resourceOwner` is the organisation the account lives in and is
 * what the site check compares.
 */
const facadeGrants = async (
  entry: SiteEntry,
  userId: string
): Promise<{grants: CallerGrant[]; orgs: string[]}> => {
  const url = entry.iamApiUrl
  // One token per site, the way the taxi pylons hold theirs: the facade
  // answers for the organisation of the token it is sent, so limosen's
  // manager asked about a booklimo account answers nothing.
  const bearer =
    (entry.orgManagerTokenVar
      ? (env()[entry.orgManagerTokenVar] as string | undefined)
      : undefined) || env().ORG_USER_MANAGER_TOKEN

  if (!url || !bearer || !userId) return {grants: [], orgs: []}

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
      body: JSON.stringify({query: FACADE_QUERY, variables: {id: userId}})
    })

    const json = (await res.json().catch(() => ({}))) as any
    const user = json?.data?.user

    if (!res.ok || !user) {
      console.error(
        'jaen-agent: the grant lookup answered nothing for',
        userId,
        json?.errors?.[0]?.message ?? `HTTP ${res.status}`
      )
      return {grants: [], orgs: []}
    }

    const orgs = user.resourceOwner ? [String(user.resourceOwner)] : []

    const grants = (user.roles?.edges ?? [])
      .map((edge: any) => edge?.node?.key)
      .filter((key: unknown): key is string => typeof key === 'string')
      .map((key: string) => ({key, orgs}))

    return {grants, orgs}
  } catch (error) {
    console.error('jaen-agent: the grant lookup failed', error)
    return {grants: [], orgs: []}
  }
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
  const {grants, orgs} = await resolveCaller(entry)

  const allowed = grants.some(grant => {
    if (grant.key !== role) return false
    if (grant.orgs.length > 0) return grant.orgs.includes(entry.organizationId)
    return orgs.has(entry.organizationId)
  })

  if (!allowed) {
    throw new ForbiddenError(
      `${role} on ${siteKey} is required, and it counts only when the site's ` +
        `own organisation granted it.`
    )
  }

  return editor(siteKey)
}

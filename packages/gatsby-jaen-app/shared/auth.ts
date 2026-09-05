/**
 * Who is using the app, as far as the screens need to know.
 *
 * A screen branches on this to decide what to show. The backend decides what
 * is allowed: every read is scoped and every write is guarded in the resolver
 * from the same token, so a wrong answer here can only ever hide a button,
 * never open a door. See okf/architecture/permissions.md.
 *
 * The roles come from the `currentUser` query the app already relies on, read
 * as `roles { edges { node { key } } }`, and are asked for once per session:
 * every screen and the shell call useCaller(), and the answer is cached at
 * module level and keyed on the signed-in subject, so a second account in the
 * same tab starts over instead of inheriting the first account's roles.
 */
import {useEffect, useState} from 'react'
import {fetchGraphQL} from '../client/limosen'

export const ADMIN_ROLE = 'jaen:admin'
export const DRIVER_ROLE = 'limosen:driver'
export const CUSTOMER_ROLE = 'limosen:customer'

/**
 * The role keys this brand writes and reads.
 *
 * A role key names a company. limosen grants `limosen:driver` and
 * `limosen:customer`, KRC grants `krc:driver` and `krc:customer`, and an
 * account in one organization must never be given the other's key. The two
 * come from the plugin options, and the platform's own keys are the default so
 * a site that configures nothing behaves exactly as before.
 *
 * Everything that WRITES a role uses these. Reading is more forgiving, see
 * `driverRoleKeys`, because an account can still carry a key that is on its
 * way out.
 */
export const brandDriverRole = (): string => {
  try {
    return typeof __JAEN_APP_DRIVER_ROLE__ !== 'undefined' && __JAEN_APP_DRIVER_ROLE__
      ? __JAEN_APP_DRIVER_ROLE__
      : DRIVER_ROLE
  } catch {
    return DRIVER_ROLE
  }
}

export const brandCustomerRole = (): string => {
  try {
    return typeof __JAEN_APP_CUSTOMER_ROLE__ !== 'undefined' && __JAEN_APP_CUSTOMER_ROLE__
      ? __JAEN_APP_CUSTOMER_ROLE__
      : CUSTOMER_ROLE
  } catch {
    return CUSTOMER_ROLE
  }
}

/** The three keys this deployment may write, and the only ones it may write. */
export const brandKnownRoles = (): string[] => [
  ADMIN_ROLE,
  brandDriverRole(),
  brandCustomerRole()
]

export interface Caller {
  /** Holds jaen:admin: the dispatcher, sees and does everything. */
  isAdmin: boolean
  /** Holds the driver role: own rides, no prices. */
  isDriver: boolean
  /** Holds limosen:customer: own bookings and statements. */
  isCustomer: boolean
  /** The Zitadel user id, or undefined while loading or signed out. */
  userId?: string
  /** Every project role key the account holds. Empty is a caller with no roles. */
  roles: string[]
  /** True until the first answer arrives. Screens render nothing role-bound before that. */
  loading: boolean
  /** Set when the roles could not be read. The caller is treated as holding none. */
  error?: string
}

const NOBODY: Caller = {
  isAdmin: false,
  isDriver: false,
  isCustomer: false,
  userId: undefined,
  roles: [],
  loading: true
}

declare const __JAEN_ZITADEL_GQL__:
  | {authority?: string; clientId?: string}
  | undefined

declare const __JAEN_APP_DRIVER_ROLE__: string | null | undefined
declare const __JAEN_APP_CUSTOMER_ROLE__: string | null | undefined

/**
 * The driver role, as decided: `limosen:driver` on both brands. The plugin
 * option `driverRoleKey` is honoured as well, because booklimo's config still
 * says `krc:driver` and a driver must not lose the app over a config line that
 * is being retired. Both keys mean driver until that option is gone.
 */
const driverRoleKeys = (): string[] => {
  const keys = [DRIVER_ROLE]
  try {
    const configured =
      typeof __JAEN_APP_DRIVER_ROLE__ !== 'undefined' && __JAEN_APP_DRIVER_ROLE__
        ? __JAEN_APP_DRIVER_ROLE__
        : undefined
    if (configured && !keys.includes(configured)) keys.push(configured)
  } catch {
    /* the define is absent in the preview build, and that is the default */
  }
  return keys
}

/**
 * The subject of the OIDC session in this tab, read from the same storage the
 * GraphQL client takes its bearer token from. It is the cache key: as long as
 * it is unchanged, the roles are unchanged.
 */
const sessionSubject = (): string | undefined => {
  try {
    const z =
      typeof __JAEN_ZITADEL_GQL__ !== 'undefined' ? __JAEN_ZITADEL_GQL__ : null
    if (!z?.authority || !z?.clientId) return undefined
    const raw = window.sessionStorage?.getItem(
      `oidc.user:${z.authority}:${z.clientId}`
    )
    if (!raw) return undefined
    return JSON.parse(raw)?.profile?.sub
  } catch {
    return undefined
  }
}

const fromRoles = (userId: string | undefined, roles: string[]): Caller => {
  const drivers = driverRoleKeys()
  const customers = Array.from(new Set([CUSTOMER_ROLE, brandCustomerRole()]))
  return {
    isAdmin: roles.includes(ADMIN_ROLE),
    isDriver: roles.some(r => drivers.includes(r)),
    isCustomer: roles.some(r => customers.includes(r)),
    userId,
    roles,
    loading: false
  }
}

const fetchCaller = async (): Promise<Caller> => {
  const result: any = await fetchGraphQL(
    {
      query: 'query { currentUser { id roles { edges { node { key } } } } }',
      variables: undefined,
      operationName: undefined
    },
    {}
  )

  if (result?.errors?.length) {
    throw new Error(String(result.errors[0]?.message || 'GraphQL error'))
  }

  const user = result?.data?.currentUser
  const roles: string[] = (user?.roles?.edges ?? [])
    .map((e: any) => e?.node?.key)
    .filter((k: unknown): k is string => typeof k === 'string' && k.length > 0)

  return fromRoles(typeof user?.id === 'string' ? user.id : undefined, roles)
}

// One answer per signed-in subject per tab. `value` is what every subscriber
// renders, `promise` is what dedups the requests while it is in flight.
let cache:
  | {subject: string | undefined; promise: Promise<Caller>; value: Caller}
  | undefined

const listeners = new Set<(c: Caller) => void>()

const publish = (value: Caller) => {
  if (cache) cache.value = value
  listeners.forEach(l => l(value))
}

const load = (): Caller => {
  const subject = sessionSubject()

  if (cache && cache.subject === subject) return cache.value

  const promise = fetchCaller()
    .then(caller => {
      // A sign-in that happened while the request was out belongs to a
      // different cache entry, so only the entry that started it publishes.
      if (cache?.promise === promise) publish(caller)
      return caller
    })
    .catch((err: unknown) => {
      // Swallowed on purpose: a caller with no roles sees the shell and an
      // empty navigation, which is the honest rendering of "we could not
      // find out who you are". The message is kept so a screen can say so.
      const failed: Caller = {
        ...NOBODY,
        loading: false,
        error: err instanceof Error ? err.message : String(err)
      }
      if (cache?.promise === promise) publish(failed)
      return failed
    })

  cache = {subject, promise, value: NOBODY}
  return cache.value
}

/** Forget the cached answer, for a screen that just changed the caller's own roles. */
export const resetCaller = () => {
  cache = undefined
}

/**
 * The caller, for the shell and every screen.
 *
 * Renders `loading: true` until the roles are known, so a screen can hold its
 * role-bound parts back for one render rather than flashing the wrong one.
 */
export function useCaller(): Caller {
  const [caller, setCaller] = useState<Caller>(() =>
    typeof window === 'undefined' ? NOBODY : load()
  )

  useEffect(() => {
    listeners.add(setCaller)
    // The session may have appeared or changed since the initial render, the
    // OIDC redirect lands on /loading and only then reaches the app.
    setCaller(load())
    return () => {
      listeners.delete(setCaller)
    }
  }, [])

  return caller
}

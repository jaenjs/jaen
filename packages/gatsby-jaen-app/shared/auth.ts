/**
 * Who is using the app, as far as the screens need to know.
 *
 * A screen branches on this to decide what to show. The backend decides what
 * is allowed: every read is scoped and every write is guarded in the resolver
 * from the same token, so a wrong answer here can only ever hide a button,
 * never open a door. See okf/architecture/permissions.md.
 *
 * The roles come from the `currentUser` query the app already relies on, read
 * as `roles { edges { node { key } } }`, and are one query of the client in
 * hooks/query.ts, `['caller', subject]`: every screen and the shell call
 * useCaller(), the answer is held for five minutes and keyed on the signed-in
 * subject, so a second account in the same tab starts over instead of
 * inheriting the first account's roles, and a reload offline answers from
 * the persisted store, which is what lets the driver's rides render without
 * a connection. See okf/architecture/data-layer.md.
 */
import {fetchGraphQL} from '../client/limosen'
import {keys, queryClient, useAppQuery} from './hooks/query'
import {sessionSubject} from './offline'

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

/** Forget the cached answer, for a screen that just changed the caller's own roles. */
export const resetCaller = () => {
  void queryClient.invalidateQueries({queryKey: ['caller']})
}

/**
 * The caller, for the shell and every screen.
 *
 * Renders `loading: true` until the roles are known, so a screen can hold its
 * role-bound parts back for one render rather than flashing the wrong one.
 * The session may appear or change between renders, the OIDC redirect lands
 * on /loading and only then reaches the app, so the subject is read on every
 * render and a new subject is a new query.
 */
export function useCaller(): Caller {
  const subject = typeof window === 'undefined' ? undefined : sessionSubject()
  const {query, error} = useAppQuery({
    queryKey: keys.caller(subject),
    queryFn: fetchCaller
  })
  if (query.data) return query.data
  // A caller with no roles sees the shell and an empty navigation, which is
  // the honest rendering of "we could not find out who you are". The message
  // is kept so a screen can say so.
  if (error) return {...NOBODY, loading: false, error}
  return NOBODY
}

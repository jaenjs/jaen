/**
 * The people screens' reads and writes: the directory, one account, the
 * driver's money settings, and the Zitadel-side account management.
 *
 * Every read is admin only on the backend (users, user, usersByRole carry the
 * jaen:admin guard, see okf/architecture/permissions.md), so a screen built on
 * these hooks shows a FORBIDDEN banner to anyone else. That is intended: the
 * shell hides the entry, the backend refuses the read, and this file does not
 * try to be a third gate.
 *
 * The reads are queries of the one client in ./query.ts, `['users', args]`
 * per page, `['user', id]` per account, and the mutations invalidate them.
 * The hooks keep their names and shapes, see okf/architecture/data-layer.md.
 */
import {useCallback, useMemo, useState} from 'react'
import {keepPreviousData} from '@tanstack/react-query'
import {fetchGraphQL} from '../../client/limosen'
import {ADMIN_ROLE, brandKnownRoles, CUSTOMER_ROLE, DRIVER_ROLE} from '../auth'
import {setDriverColorMutation, type PaginationState} from '../hooks'
import {fetchDashboard} from './dashboard'
import {cachedRead, keys, queryClient, useAppQuery, usePager} from './query'
import {readDriverColors} from './colors'

export {setDriverColorMutation}

// --------------- One document, arguments inline ---------------

/**
 * The same literal renderer the query helper in shared/hooks.ts uses, and
 * for the same reason: an argument written as a literal names no input type,
 * so the document is valid against either deployment. The helper there is
 * not exported and that file is not to be edited, so the twenty lines live
 * here again. TODO(integrator): export `query` from shared/hooks.ts and
 * delete this copy.
 */
class EnumValue {
  constructor(public readonly name: string) {}
}

export const enumValue = (name: string) => new EnumValue(name)

const literal = (value: unknown): string => {
  if (value instanceof EnumValue) return value.name
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return JSON.stringify(value)
  if (typeof value === 'string') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(literal).join(', ')}]`
  if (typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}: ${literal(v)}`)
      .join(', ')}}`
  }
  return 'null'
}

export const gql = async (
  field: string,
  args: Record<string, unknown> | undefined,
  selection: string,
  kind: 'query' | 'mutation' = 'query'
): Promise<any> => {
  const rendered = args
    ? `(${Object.entries(args)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}: ${literal(v)}`)
        .join(', ')})`
    : ''

  const result: any = await fetchGraphQL(
    {
      query: `${kind} { ${field}${rendered} ${selection} }`,
      variables: undefined,
      operationName: undefined
    },
    {}
  )

  if (result?.errors?.length) {
    throw new Error(String(result.errors[0]?.message || 'GraphQL error'))
  }

  return result?.data?.[field]
}

/**
 * What a mutation answers with is the backend's business, and the account
 * mutations are being built beside this file: createDriver may answer with
 * the user, setUserRoles with a boolean. A selection on a scalar is a
 * validation error and a missing selection on an object is another, so the
 * mutation type is introspected once per session and the selection follows
 * its shape. `__typename` is valid on any object, which is all a screen needs
 * back from "deactivate this account" before it refetches.
 */
const unwrap = (t: any): any => (t?.ofType ? unwrap(t.ofType) : t)

const readMutationShapes = async (): Promise<Record<string, string>> => {
  const shapes: Record<string, string> = {}
  const result: any = await fetchGraphQL(
    {
      query:
        'query { __schema { mutationType { fields { name type { kind ofType { kind ofType { kind ofType { kind } } } } } } } }',
      variables: undefined,
      operationName: undefined
    },
    {}
  )
  const fields = result?.data?.__schema?.mutationType?.fields
  if (Array.isArray(fields)) {
    for (const f of fields)
      shapes[String(f?.name)] = String(unwrap(f?.type)?.kind ?? '')
  }
  return shapes
}

/**
 * Through the query client, cached and persisted with the rest. An endpoint
 * that will not introspect gets the scalar guess. A wrong guess is a loud
 * validation error, not a silent one.
 */
const mutationShapes = async (): Promise<Map<string, string>> => {
  try {
    return new Map(
      Object.entries(
        await cachedRead(keys.schema('mutations'), readMutationShapes)
      )
    )
  } catch {
    return new Map()
  }
}

const selectionFor = async (
  field: string,
  ifObject = '{ __typename }'
): Promise<string> => {
  const kind = (await mutationShapes()).get(field)
  return kind === 'OBJECT' || kind === 'INTERFACE' || kind === 'UNION'
    ? ifObject
    : ''
}

export const mutate = async (
  field: string,
  args: Record<string, unknown>,
  objectSelection = '{ __typename }'
): Promise<any> =>
  gql(field, args, await selectionFor(field, objectSelection), 'mutation')

declare const __JAEN_ZITADEL_GQL__:
  | {authority?: string; clientId?: string; organizationId?: string}
  | undefined

/** The brand's Zitadel organization, the same plugin option the CMS signs in against. */
export const organizationId = (): string | undefined => {
  try {
    const z =
      typeof __JAEN_ZITADEL_GQL__ !== 'undefined' ? __JAEN_ZITADEL_GQL__ : null
    return z?.organizationId || undefined
  } catch {
    return undefined
  }
}

// --------------- Types ---------------

export interface DirectoryUser {
  id: string
  email: string
  username: string
  firstName?: string
  lastName?: string
  phone?: string
  createdAt: string | null
  isActive: boolean
  /** Project role keys, jaen:admin and the like. */
  roles: string[]
  /** Hex, or undefined when nobody chose one. */
  driverColor?: string
}

export interface UserDetail extends DirectoryUser {
  avatarUrl?: string
  preferredLanguage?: string
  /** 0..100, undefined when the account has no DriverData row or the read failed. */
  payoutPercent?: number
}

export const fullName = (u: {
  firstName?: string
  lastName?: string
  username: string
  email?: string
}) =>
  [u.firstName, u.lastName].filter(Boolean).join(' ') ||
  u.username ||
  u.email ||
  ''

const isActiveState = (state: unknown) =>
  state === 'USER_STATE_ACTIVE' ||
  String(state ?? '').toLowerCase() === 'active'

const PROFILE_FRAGMENT =
  '... on HumanUser { profiles { edges { node { email firstName lastName phone avatarUrl preferredLanguage } } } }'
const ROLES_FRAGMENT = 'roles { edges { node { key } } }'

const mapNode = (n: any): DirectoryUser => {
  const profile = n?.profiles?.edges?.[0]?.node
  const roles: string[] = (n?.roles?.edges ?? [])
    .map((e: any) => e?.node?.key)
    .filter((k: unknown): k is string => typeof k === 'string' && k.length > 0)
  return {
    id: String(n?.id ?? ''),
    email: profile?.email ?? n?.preferredLoginName ?? '',
    username: n?.userName ?? '',
    firstName: profile?.firstName ?? undefined,
    lastName: profile?.lastName ?? undefined,
    phone: profile?.phone ?? undefined,
    createdAt: n?.creationDate ?? n?.changeDate ?? null,
    isActive: isActiveState(n?.state),
    roles,
    driverColor: undefined
  }
}

/**
 * One account's colour through the batch read of ./colors.ts, so the detail
 * page after the directory asks nothing. The silver default means "nobody
 * chose a colour" and is mapped to undefined there, the same way
 * shared/hooks.ts does it. A failed read is also undefined: the colour is
 * decoration and must not take the row with it, and that is exactly what
 * hides a missing backend field, so look in colors.ts first when every dot
 * is grey.
 */
const readColor = async (userId: string): Promise<string | undefined> =>
  userId ? (await readDriverColors([userId]))[userId] : undefined

// --------------- The directory ---------------

const DEFAULT_PAGE_SIZE = 25

interface DirectoryPage {
  rows: DirectoryUser[]
  endCursor: string | null
  hasNextPage: boolean
  totalCount: number
}

const EMPTY_USERS: DirectoryUser[] = []

const readDirectoryPage = async (args: {
  first: number
  after?: string
  organizationId?: string
}): Promise<DirectoryPage> => {
  const base = 'id userName state preferredLoginName creationDate changeDate'
  const connection = `{ totalCount pageInfo { endCursor hasNextPage } edges { node { __typename ${base} ${PROFILE_FRAGMENT} ${ROLES_FRAGMENT} } } }`

  // The profile and the roles are asked for with the page. Should a
  // deployment refuse that shape, the plain page is asked for instead,
  // so the list shows names or, failing that, login names, never nothing.
  const result = await gql('users', {args}, connection).catch(() =>
    gql(
      'users',
      {args},
      `{ totalCount pageInfo { endCursor hasNextPage } edges { node { __typename ${base} } } }`
    )
  )

  const rows: DirectoryUser[] = (
    Array.isArray(result?.edges) ? result.edges : []
  )
    .map((e: any) => e?.node)
    .filter(Boolean)
    .map(mapNode)

  // One request for the page's colours, never one per account.
  const colours = await readDriverColors(rows.map(r => r.id))
  for (const row of rows) {
    const c = colours[row.id]
    if (c) row.driverColor = c
  }

  return {
    rows,
    endCursor: result?.pageInfo?.endCursor ?? null,
    hasNextPage: !!result?.pageInfo?.hasNextPage,
    totalCount:
      typeof result?.totalCount === 'number' ? result.totalCount : rows.length
  }
}

export function useUserDirectory(pageSize = DEFAULT_PAGE_SIZE) {
  const pager = usePager(JSON.stringify({kind: 'directory', first: pageSize}))
  const args = useMemo(
    () => ({
      first: pageSize,
      after: pager.after,
      organizationId: organizationId()
    }),
    [pageSize, pager.after]
  )

  const {
    query: q,
    isLoading,
    error,
    isFetching,
    refetch
  } = useAppQuery({
    queryKey: keys.users({kind: 'directory', ...args}),
    queryFn: () => readDirectoryPage(args),
    placeholderData: keepPreviousData
  })

  const page = q.data
  const users = page?.rows ?? EMPTY_USERS
  const pagination = useMemo<PaginationState>(() => {
    const totalCount = page?.totalCount ?? 0
    return {
      hasNextPage: !!page?.hasNextPage,
      hasPreviousPage: pager.page > 1,
      endCursor: page?.endCursor ?? null,
      startCursor: null,
      totalCount,
      currentPage: pager.page,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize))
    }
  }, [page, pager.page, pageSize])

  const nextPage = useCallback(() => {
    if (page?.hasNextPage && page.endCursor) pager.next(page.endCursor)
  }, [page, pager])
  const prevPage = pager.prev

  return {
    users,
    isLoading,
    error,
    isFetching,
    pagination,
    nextPage,
    prevPage,
    refetch
  }
}

// --------------- One account ---------------

const readUser = async (userId: string): Promise<UserDetail | null> => {
  const args = {id: userId, organizationId: organizationId()}
  const base =
    '__typename id userName state preferredLoginName creationDate changeDate'

  // Three reads rather than one, kept apart so a brand that lacks the
  // profile or the roles still answers the account. The colour and the
  // payout share are the fleet database's and fail soft on their own.
  const [node, profileEdges, roleEdges, color, payoutPercent] =
    await Promise.all([
      gql('user', {args}, `{ ${base} }`),
      gql('user', {args}, `{ ${PROFILE_FRAGMENT} }`)
        .then((u: any) => u?.profiles?.edges)
        .catch(() => null),
      gql('user', {args}, `{ ${ROLES_FRAGMENT} }`)
        .then((u: any) => u?.roles?.edges)
        .catch(() => null),
      readColor(userId),
      readPayoutPercent(userId)
    ])

  if (!node) return null

  const mapped = mapNode({
    ...node,
    profiles: {edges: profileEdges ?? []},
    roles: {edges: roleEdges ?? []}
  })
  const profile = (profileEdges as any[])?.[0]?.node

  return {
    ...mapped,
    avatarUrl: profile?.avatarUrl ?? undefined,
    preferredLanguage: profile?.preferredLanguage ?? undefined,
    driverColor: color,
    payoutPercent
  }
}

export function useUserDetail(userId: string) {
  const {
    query: q,
    isLoading,
    error,
    isFetching,
    refetch
  } = useAppQuery({
    queryKey: keys.user(userId),
    queryFn: () => readUser(userId),
    enabled: !!userId
  })
  return {user: q.data ?? undefined, isLoading, error, isFetching, refetch}
}

/**
 * The driver's share, from the DriverData node under `userData`. The node is
 * only there for an account holding the driver role, so undefined means
 * "not a driver" as often as it means "not set". Undefined on failure too:
 * the share is one card on the detail screen, not the screen.
 */
const readPayoutPercent = async (
  userId: string
): Promise<number | undefined> => {
  try {
    const conn = await gql(
      'userData',
      {args: {userId, organizationId: organizationId()}},
      '{ edges { node { __typename ... on DriverData { payoutPercent } } } }'
    )
    const node = (conn?.edges ?? [])
      .map((e: any) => e?.node)
      .find((n: any) => n?.__typename === 'DriverData')
    return typeof node?.payoutPercent === 'number'
      ? node.payoutPercent
      : undefined
  } catch {
    return undefined
  }
}

// --------------- This month's numbers for one driver ---------------

export interface DriverMonthStats {
  completed: number
  revenue: number
  cash: number
  payoutDue: number
}

export const monthKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

/**
 * The driver's row of the dashboard query, `dashboard(args:{month})
 * { drivers { id completed revenue cash payoutDue } }`, selected out of the
 * one dashboard read the client holds under `['dashboard', month]`. The
 * dashboard is admin only, which is right: this card sits on the admin's
 * user screen and nowhere else. `stats` stays undefined when the account
 * has no row, which is every account that is not a driver.
 */
export function useDriverMonthStats(userId: string, month: string) {
  const select = useCallback(
    (
      dashboard: Awaited<ReturnType<typeof fetchDashboard>>
    ): DriverMonthStats | null => {
      const row = dashboard.drivers.find(d => d.id === userId)
      return row
        ? {
            completed: row.completed,
            revenue: row.revenue,
            cash: row.cash,
            payoutDue: row.payoutDue
          }
        : null
    },
    [userId]
  )
  const {
    query: q,
    isLoading,
    error,
    refetch
  } = useAppQuery({
    queryKey: keys.dashboard(month),
    queryFn: () => fetchDashboard(month),
    enabled: !!userId,
    select
  })
  return {stats: q.data ?? undefined, isLoading, error, refetch}
}

// --------------- Expenses ---------------

export interface DriverExpense {
  id: string
  /** YYYY-MM-DD */
  date: string
  amount: number
  note?: string
}

const mapExpense = (r: any): DriverExpense => ({
  id: String(r?.id ?? ''),
  date: String(r?.date ?? '').slice(0, 10),
  amount: Number(r?.amount ?? 0),
  note: r?.note ?? undefined
})

/**
 * Yoga's validation error for a field the schema does not have. The message
 * is stable across graphql-js releases and is the one signal that separates
 * "this deployment cannot list expenses yet" from a refusal or an outage.
 */
const isUnknownField = (err: unknown, field: string) =>
  err instanceof Error &&
  /Cannot query field/i.test(err.message) &&
  err.message.includes(field)

/**
 * The expenses an admin entered for this driver.
 *
 * TODO(integrator): the shared decisions name `addDriverExpense` and nothing
 * that lists what was added. This reads `driverExpenses(args:{userId, month})
 * { id date amount note }`, admin only, and the finance module has to provide
 * it. Until it does, `unsupported` is true, the card says so in the account's
 * language, and the rows added in this session are kept from the mutation's
 * own answer so the dispatcher still sees what they just typed. Any other
 * failure is the backend's own message.
 */
const EMPTY_EXPENSES: DriverExpense[] = []

const readExpenses = async (
  userId: string,
  month: string | undefined
): Promise<DriverExpense[]> => {
  const rows = await gql(
    'driverExpenses',
    {args: {userId, month}},
    '{ id date amount note }'
  )
  return (Array.isArray(rows) ? rows : []).map(mapExpense)
}

export function useDriverExpenses(userId: string, month?: string) {
  const {
    query: q,
    isLoading,
    error: message,
    refetch
  } = useAppQuery({
    queryKey: keys.expenses(userId, month),
    queryFn: () => readExpenses(userId, month),
    enabled: !!userId
  })
  // Rows added in a session against a deployment without the list are kept
  // on the query, and the card keeps saying the list is not there.
  const [localOnly, setLocalOnly] = useState(false)
  const unsupported = localOnly || isUnknownField(q.error, 'driverExpenses')
  const error = unsupported ? null : message
  const expenses = q.data ?? EMPTY_EXPENSES

  /**
   * After a successful add: refetch where the list exists, otherwise keep the
   * created row locally when it falls into the month on screen.
   */
  const added = useCallback(
    async (expense: DriverExpense) => {
      if (!unsupported) {
        await queryClient.invalidateQueries({
          queryKey: keys.expenses(userId, month)
        })
        return
      }
      setLocalOnly(true)
      if (!month || expense.date.startsWith(month)) {
        queryClient.setQueryData<DriverExpense[]>(
          keys.expenses(userId, month),
          prev => [...(prev ?? []), expense]
        )
      }
    },
    [unsupported, userId, month]
  )

  return {expenses, isLoading, error, unsupported, refetch, added}
}

// --------------- Mutations ---------------

/** The directory, the pickers and, when one is named, the account: read again after a write. */
const invalidatePeople = async (userId?: string) => {
  await Promise.all(
    [['users'], ['drivers'], ...(userId ? [keys.user(userId)] : [])].map(
      queryKey => queryClient.invalidateQueries({queryKey})
    )
  )
}

export interface CreateDriverArgs {
  email: string
  givenName: string
  familyName: string
  phone?: string
  password?: string
}

export interface CreatedDriver {
  userId: string
  /** Set once, only when the server generated it. Shown to the dispatcher and never asked for again. */
  temporaryPassword?: string
  /** False when the account exists but the driver role could not be granted. setUserRoles finishes the job. */
  roleGranted: boolean
}

/** `createDriver(args:{email, givenName, familyName, phone?, password?})`, answering CreatedDriver. */
export async function createDriverMutation(
  args: CreateDriverArgs
): Promise<CreatedDriver> {
  const result = await mutate(
    'createDriver',
    {
      args: {
        ...args,
        phone: args.phone || undefined,
        password: args.password || undefined
      }
    },
    '{ __typename userId temporaryPassword roleGranted }'
  )
  await invalidatePeople()
  return {
    userId: String(result?.userId ?? ''),
    temporaryPassword:
      typeof result?.temporaryPassword === 'string' && result.temporaryPassword
        ? result.temporaryPassword
        : undefined,
    roleGranted: result?.roleGranted !== false
  }
}

/**
 * `setUserRoles(args:{userId, roleKeys})` takes this brand's three keys and
 * refuses any other, keeping foreign grants on its own. So only those are
 * sent, whatever else the account carries.
 *
 * They are the brand's keys and not the platform's, because a role key names a
 * company: a KRC account is granted `krc:driver` and `krc:customer` and must
 * never be given the other brand's, which is what this screen used to do.
 */
export const KNOWN_ROLES: readonly string[] = [
  ADMIN_ROLE,
  DRIVER_ROLE,
  CUSTOMER_ROLE
]

export async function setUserRolesMutation(
  userId: string,
  roleKeys: string[]
): Promise<void> {
  const ours = brandKnownRoles()
  const wanted = Array.from(new Set(roleKeys.filter(k => ours.includes(k))))
  await mutate('setUserRoles', {args: {userId, roleKeys: wanted}})
  await invalidatePeople(userId)
}

export async function deactivateUserMutation(userId: string): Promise<void> {
  await mutate('deactivateUser', {args: {userId}})
  await invalidatePeople(userId)
}

export async function reactivateUserMutation(userId: string): Promise<void> {
  await mutate('reactivateUser', {args: {userId}})
  await invalidatePeople(userId)
}

/** `percent` is a percentage, 0 to 100, never a fraction. */
export async function setDriverPayoutPercentMutation(
  userId: string,
  percent: number
): Promise<void> {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new Error('percent must be between 0 and 100')
  }
  await mutate('setDriverPayoutPercent', {args: {userId, percent}})
  await queryClient.invalidateQueries({queryKey: keys.user(userId)})
}

export interface AddDriverExpenseArgs {
  userId: string
  /** YYYY-MM-DD */
  date: string
  amount: number
  note: string
}

/** Answers the created row, `DriverExpense { id date amount note }`, so a screen can show it without a list query. */
export async function addDriverExpenseMutation(
  args: AddDriverExpenseArgs
): Promise<DriverExpense> {
  const created = await mutate(
    'addDriverExpense',
    {args: {...args, note: args.note || undefined}},
    '{ __typename id date amount note }'
  )
  return created && typeof created === 'object'
    ? mapExpense(created)
    : {
        // A local key only, for a deployment that answers a scalar here.
        id: `local:${Date.now()}`,
        date: args.date,
        amount: args.amount,
        note: args.note || undefined
      }
}

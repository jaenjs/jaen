/**
 * Data hooks for the app.
 * Server-side cursor pagination: each hook fetches only one page at a time.
 *
 * Every read goes through the GQty client generated from the pylon's schema.
 * There used to be a second path beside it, a hand-written document sent with
 * fetch, and it was the reason the app could not talk to both brands: those
 * documents declare their variables by type name, `query($args:
 * TransfersArgsInput)`, and Pylon derives those names from the resolver
 * signature. The booklimo deployment is an older build whose equivalent input
 * is called ArgsInput_4Input, so every such document failed validation there
 * with "Unknown type TransfersArgsInput" and the screen showed nothing but
 * "Loading failed".
 *
 * GQty builds its selections from the generated schema and passes arguments
 * inline, so no input type is ever named in a document and the same code works
 * against either deployment. It also brings the auth header and the per-brand
 * endpoint with it, which is why this file no longer needs either.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchGraphQL } from '../client/limosen'

/**
 * One GraphQL document, with its arguments written into the document itself.
 *
 * This is the whole reason a hand-built document is still here. GQty does not
 * inline arguments: it declares them as variables, and it takes the type name
 * for each from the schema it was generated against, so it sends
 * `query($a: TransfersArgsInput)`. Pylon derives those names from the resolver
 * signature and they are not stable across builds, so that document is refused
 * outright by the booklimo deployment with `Unknown type "TransfersArgsInput"`,
 * which is the error the app showed instead of a list. Switching the reads to
 * the generated client did not fix that, it only moved where the name came
 * from.
 *
 * An argument written as a literal names no type, so the same document is valid
 * against either deployment. The generated client stays in use for everything
 * that is not a top level read, and the fetcher below is the client's own, so
 * the auth header and the per brand endpoint are still its business.
 *
 * This is a workaround for two deployments running different builds. Once both
 * run the same pylon, the generated client can take these back.
 */
/**
 * A GraphQL enum member is spelled bare, not quoted, and it is indistinguishable
 * from a string once it is a JavaScript value. Wrapping it says which it is.
 */
class EnumValue {
  constructor(public readonly name: string) {}
}

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

const query = async (
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

declare const __JAEN_ZITADEL_GQL__:
  | {authority?: string; clientId?: string; organizationId?: string}
  | undefined

/**
 * The Zitadel organization this brand's users live in.
 *
 * Every user field takes it and none of them require it, and leaving it out is
 * why the driver picker was empty: without it the identity facade answers from
 * whatever organization its own service token belongs to, which is neither
 * brand's. limosen and booklimo have separate organizations on purpose, that
 * being the whole point of running two brands off one codebase.
 *
 * It comes from the same plugin option the CMS signs in against, so it is
 * always the organization the signed-in account actually belongs to.
 */
const organizationId = (): string | undefined => {
  try {
    const z =
      typeof __JAEN_ZITADEL_GQL__ !== 'undefined' ? __JAEN_ZITADEL_GQL__ : null

    return z?.organizationId || undefined
  } catch {
    return undefined
  }
}

/**
 * Which fields the deployment's Transfer type actually has.
 *
 * The two brands do not run the same build. limosen serves the February pylon,
 * booklimo still serves the one from January, and between them four columns
 * were renamed: price was amountEUR, paymentMethode was payment, payingParty
 * was billingParty, and extras, reference, referenceId and referencedBy did not
 * exist yet. A selection written for one is rejected outright by the other with
 * "Cannot query field price on type Transfer", which is what the app reported
 * as a GraphQL error.
 *
 * So the selection is built from what the endpoint says it has. This is the one
 * query GQty cannot express, introspection not being part of a generated
 * schema, and it is asked once per session and then remembered. The mapping
 * below already treats every one of these fields as optional, so a deployment
 * that lacks them renders without a price rather than not at all.
 *
 * The right fix is for both brands to run the same pylon. This keeps the app
 * usable until they do, and keeps it usable the next time they drift.
 */
let transferFieldsPromise: Promise<Set<string>> | undefined

const transferFields = (): Promise<Set<string>> => {
  if (!transferFieldsPromise) {
    // The fetcher is allowed to answer synchronously, so it is wrapped rather
    // than chained.
    transferFieldsPromise = (async () => {
      try {
        const result: any = await fetchGraphQL(
          {
            query: 'query { __type(name: "Transfer") { fields { name } } }',
            variables: undefined,
            operationName: undefined
          },
          {}
        )

        const fields = result?.data?.__type?.fields

        return new Set<string>(
          Array.isArray(fields)
            ? fields.map((f: any) => String(f?.name)).filter(Boolean)
            : []
        )
      } catch {
        // An endpoint that will not introspect is not a reason to render
        // nothing: assume the current schema and let the read decide.
        return new Set<string>()
      }
    })()
  }

  return transferFieldsPromise
}

/**
 * getDriverColor is a plain scalar field, and it is absent from the booklimo
 * schema entirely. A caller that cannot read it gets undefined rather than an
 * error, which is what every call site already expected.
 */
async function resolveDriverColor(userId: string): Promise<string | undefined> {
  try {
    const color = await query('getDriverColor', { userId }, '')
    return typeof color === 'string' && color !== '#C0C0C0' ? color : undefined
  } catch {
    return undefined
  }
}

// --------------- Domain Types ---------------

export interface ResourceTransfer {
  id: string
  customerId: string
  driverId?: string
  pickup: string
  dropoff: string
  roomOrName?: string
  details?: {
    flightNumber?: string
    message?: string
    luggage?: string
    childSeats?: string
  }
  rideDateISO: string
  rideTime: string
  requestedAtISO: string
  price?: number
  paymentMethode?: string
  payingParty?: string
  state: string
  vehicle?: string
  driverName?: string
  driverPhone?: string
  customerName?: string
  customerPhone?: string
  passengerCount?: number
  carLicensePlate?: string
  carClass?: string
  carColor?: string
  referenceId?: string
  extras?: Array<{ type: string; amount: number }>
  transferCategory?: string
  transferType?: string
  driverColor?: string
}

export interface ResourceUser {
  id: string
  primaryEmailAddress: string
  username: string
  createdAt: string | null
  details?: {
    avatarURL?: string
    firstName?: string
    lastName?: string
  }
  isActive: boolean
  isAdmin: boolean
  roles: Array<{ id: string; description: string }>
  driverColor?: string
  revenue?: number
  transferCount?: number
  monthlyRevenue?: number
  monthlyCount?: number
}

export type LocationKind = 'driver' | 'customer'

export type ResourceLocationRow = {
  kind: LocationKind
  id: string
  userId: string
  latitude: number
  longitude: number
  accuracy?: number
  recordedAtISO?: string
  updatedAtISO?: string
}

// --------------- Shared Pagination State ---------------

export interface PaginationState {
  hasNextPage: boolean
  hasPreviousPage: boolean
  endCursor: string | null
  startCursor: string | null
  totalCount: number
  currentPage: number
  totalPages: number
}

// --------------- Mappers ---------------

const pad2 = (n: number) => String(n).padStart(2, '0')

const mapTransferRow = (transfer: any): ResourceTransfer => {
  const pickupDateTime = transfer?.pickupDateTime
  let rideDateISO = ''
  let rideTime = ''
  if (pickupDateTime) {
    try {
      const d = new Date(pickupDateTime)
      if (!Number.isNaN(d.getTime())) {
        rideDateISO = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
        rideTime = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
      }
    } catch { /* ignore */ }
  }
  const requestedAt = transfer?.requestedAt
  const requestedAtISO = requestedAt ? new Date(requestedAt).toISOString() : ''
  const subject = typeof transfer?.subject === 'string' ? transfer.subject : undefined
  const referenceId = typeof transfer?.referenceId === 'string' ? transfer.referenceId : undefined
  const transferCategory = transfer?.transferCategory != null ? String(transfer.transferCategory) : undefined
  const transferType = transfer?.transferType != null ? String(transfer.transferType) : undefined

  return {
    id: transfer?.id ?? '',
    customerId: transfer?.customerId ?? '',
    driverId: transfer?.driverId ?? undefined,
    pickup: transfer?.pickupLocation ?? '',
    dropoff: transfer?.dropoffLocation ?? '',
    roomOrName: subject ?? undefined,
    rideDateISO,
    rideTime,
    requestedAtISO,
    price: typeof transfer?.price === 'number' ? transfer.price : undefined,
    paymentMethode: transfer?.paymentMethode ?? undefined,
    payingParty: transfer?.payingParty ?? undefined,
    state: (transfer?.state as string) ?? 'pending',
    vehicle: transfer?.carId ?? undefined,
    referenceId,
    transferCategory,
    transferType,
  }
}

const mapUserRow = (user: any): ResourceUser => {
  const loginName = user?.preferredLoginName ?? user?.userName ?? ''
  return {
    id: user?.id ?? '',
    primaryEmailAddress: loginName,
    username: user?.userName ?? '',
    createdAt: user?.creationDate ?? user?.changeDate ?? null,
    details: {
      avatarURL: undefined,
      firstName: undefined,
      lastName: undefined,
    },
    isActive: user?.state === 'USER_STATE_ACTIVE' || user?.state?.toLowerCase?.() === 'active',
    isAdmin: false,
    roles: [],
    driverColor: undefined,
  }
}

const mapUserRowFull = (user: any): ResourceUser => {
  return {
    id: user?.id ?? '',
    primaryEmailAddress: user?.preferredLoginName ?? '',
    username: user?.userName ?? '',
    createdAt: user?.creationDate ?? user?.changeDate ?? null,
    details: {},
    isActive: user?.state === 'USER_STATE_ACTIVE' || user?.state?.toLowerCase?.() === 'active',
    isAdmin: false,
    roles: [],
    driverColor: undefined,
  }
}

// --------------- useTransfers (paginated) ---------------

const DEFAULT_TRANSFER_PAGE_SIZE = 15

export interface TransferDateFilter {
  fromISO?: string
  toISO?: string
}

export function useTransfers(pageSize = DEFAULT_TRANSFER_PAGE_SIZE, dateFilter?: TransferDateFilter) {
  const [isLoading, setIsLoading] = useState(true)
  const [transfers, setTransfers] = useState<ResourceTransfer[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<PaginationState>({
    hasNextPage: false, hasPreviousPage: false,
    endCursor: null, startCursor: null,
    totalCount: 0, currentPage: 1, totalPages: 1,
  })
  const cursorStackRef = useRef<string[]>([])
  const currentAfterRef = useRef<string | undefined>(undefined)

  const fromISO = dateFilter?.fromISO
  const toISO = dateFilter?.toISO

  const fetchPage = useCallback(async (after?: string, page = 1) => {
    setIsLoading(true)
    setError(null)
    try {
      const args: any = { first: pageSize }
      if (after) args.after = after
      if (fromISO) args.fromISO = fromISO
      if (toISO) args.toISO = toISO

      const available = await transferFields()

      const optional = ['price', 'paymentMethode', 'payingParty', 'referenceId']
        .filter(name => available.size === 0 || available.has(name))
        .join(' ')

      const result = await query(
        'transfers',
        { args },
        `{ totalCount pageInfo { endCursor startCursor hasNextPage hasPreviousPage } edges { node { id customerId driverId pickupDateTime ` +
          `pickupLocation dropoffLocation subject state requestedAt carId ` +
          `transferCategory transferType ${optional} } } }`
      )

      const edges: any[] = Array.isArray(result?.edges) ? result.edges : []
      const items = edges.map((e: any) => e?.node).filter(Boolean).map(mapTransferRow)
      const totalCount = typeof result?.totalCount === 'number' ? result.totalCount : 0

      setTransfers(items)
      setPagination({
        hasNextPage: !!result?.pageInfo?.hasNextPage,
        hasPreviousPage: page > 1,
        endCursor: result?.pageInfo?.endCursor ?? null,
        startCursor: result?.pageInfo?.startCursor ?? null,
        totalCount,
        currentPage: page,
        totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transfers')
    } finally {
      setIsLoading(false)
    }
  }, [pageSize, fromISO, toISO])

  useEffect(() => {
    cursorStackRef.current = []
    currentAfterRef.current = undefined
    fetchPage(undefined, 1)
  }, [fetchPage])

  const nextPage = useCallback(() => {
    if (pagination.hasNextPage && pagination.endCursor) {
      cursorStackRef.current = [...cursorStackRef.current, currentAfterRef.current ?? '']
      currentAfterRef.current = pagination.endCursor
      fetchPage(pagination.endCursor, pagination.currentPage + 1)
    }
  }, [pagination, fetchPage])

  const prevPage = useCallback(() => {
    if (pagination.currentPage > 1) {
      const stack = [...cursorStackRef.current]
      const prev = stack.pop()
      cursorStackRef.current = stack
      const cursor = prev || undefined
      currentAfterRef.current = cursor
      fetchPage(cursor, pagination.currentPage - 1)
    }
  }, [pagination, fetchPage])

  const goToPage = useCallback((page: number) => {
    if (page === 1) {
      cursorStackRef.current = []
      currentAfterRef.current = undefined
      fetchPage(undefined, 1)
    }
  }, [fetchPage])

  const refetch = useCallback(() => {
    fetchPage(currentAfterRef.current, pagination.currentPage)
  }, [fetchPage, pagination.currentPage])

  return { transfers, isLoading, error, pagination, nextPage, prevPage, goToPage, refetch }
}

// --------------- useUsers (paginated) ---------------

const DEFAULT_USER_PAGE_SIZE = 20

export function useUsers(pageSize = DEFAULT_USER_PAGE_SIZE) {
  const [isLoading, setIsLoading] = useState(true)
  const [users, setUsers] = useState<ResourceUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<PaginationState>({
    hasNextPage: false, hasPreviousPage: false,
    endCursor: null, startCursor: null,
    totalCount: 0, currentPage: 1, totalPages: 1,
  })
  const cursorStackRef = useRef<string[]>([])
  const currentAfterRef = useRef<string | undefined>(undefined)

  const fetchPage = useCallback(async (after?: string, page = 1) => {
    setIsLoading(true)
    setError(null)
    try {
      const args: any = { first: pageSize }
      if (after) args.after = after

      const result = await query(
        'users',
        { args: { ...args, organizationId: organizationId() } },
        `{ totalCount pageInfo { endCursor startCursor hasNextPage hasPreviousPage } edges { node { __typename id userName state ` +
          `preferredLoginName creationDate changeDate } } }`
      )

      const edges: any[] = Array.isArray(result?.edges) ? result.edges : []
      const items = edges.map((e: any) => e?.node).filter(Boolean).map(mapUserRow)
      const totalCount = typeof result?.totalCount === 'number' ? result.totalCount : 0

      const enriched = await Promise.all(
        items.map(async u => ({
          ...u,
          driverColor: await resolveDriverColor(u.id)
        }))
      )

      setUsers(enriched)
      setPagination({
        hasNextPage: !!result?.pageInfo?.hasNextPage,
        hasPreviousPage: page > 1,
        endCursor: result?.pageInfo?.endCursor ?? null,
        startCursor: result?.pageInfo?.startCursor ?? null,
        totalCount,
        currentPage: page,
        totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setIsLoading(false)
    }
  }, [pageSize])

  useEffect(() => {
    cursorStackRef.current = []
    currentAfterRef.current = undefined
    fetchPage(undefined, 1)
  }, [fetchPage])

  const nextPage = useCallback(() => {
    if (pagination.hasNextPage && pagination.endCursor) {
      cursorStackRef.current = [...cursorStackRef.current, currentAfterRef.current ?? '']
      currentAfterRef.current = pagination.endCursor
      fetchPage(pagination.endCursor, pagination.currentPage + 1)
    }
  }, [pagination, fetchPage])

  const prevPage = useCallback(() => {
    if (pagination.currentPage > 1) {
      const stack = [...cursorStackRef.current]
      const prev = stack.pop()
      cursorStackRef.current = stack
      const cursor = prev || undefined
      currentAfterRef.current = cursor
      fetchPage(cursor, pagination.currentPage - 1)
    }
  }, [pagination, fetchPage])

  const refetch = useCallback(() => {
    fetchPage(currentAfterRef.current, pagination.currentPage)
  }, [fetchPage, pagination.currentPage])

  return { users, isLoading, error, pagination, nextPage, prevPage, refetch }
}

// --------------- useUser (single) ---------------

export function useUser(userId: string) {
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<ResourceUser>()
  const [error, setError] = useState<string | null>(null)

  const fetchUser = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await query(
        'user',
        { args: { id: userId, organizationId: organizationId() } },
        '{ __typename id userName state preferredLoginName creationDate changeDate loginNames }'
      )
      let mapped = result ? mapUserRowFull(result) : undefined

      if (mapped) {
        // Three reads rather than one: profiles is only on HumanUser, roles is
        // absent from booklimo's user interface, and getDriverColor is not in
        // its schema at all. Kept apart, a brand that lacks one still answers
        // the other two instead of failing the whole screen.
        const [profileEdges, roleEdges, color] = await Promise.all([
          query(
            'user',
            { args: { id: userId, organizationId: organizationId() } },
            '{ ... on HumanUser { profiles { edges { node { id email firstName lastName ' +
              'avatarUrl displayName phone preferredLanguage } } } } }'
          )
            .then((u: any) => u?.profiles?.edges)
            .catch(() => null),
          query('user', { args: { id: userId, organizationId: organizationId() } },
            '{ roles { edges { node { id key displayName } } } }')
            .then((u: any) => u?.roles?.edges)
            .catch(() => null),
          resolveDriverColor(mapped.id)
        ])

        const firstProfile = (profileEdges as any[])?.[0]?.node
        if (firstProfile) {
          mapped = {
            ...mapped,
            primaryEmailAddress: firstProfile.email ?? mapped.primaryEmailAddress,
            details: {
              avatarURL: firstProfile.avatarUrl ?? mapped.details?.avatarURL,
              firstName: firstProfile.firstName ?? mapped.details?.firstName,
              lastName: firstProfile.lastName ?? mapped.details?.lastName,
            },
          }
        }

        const roles = ((roleEdges as any[]) || [])
          .map((e: any) => e?.node)
          .filter(Boolean)
          .map((r: any) => ({ id: r.id ?? r.key ?? '', description: r.displayName ?? r.key ?? '' }))
        if (roles.length) {
          mapped = { ...mapped, roles }
        }

        if (color) {
          mapped = { ...mapped, driverColor: color }
        }
      }
      setUser(mapped)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user')
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => { fetchUser() }, [fetchUser])

  return { user, isLoading, error }
}

// --------------- useLocations (paginated) ---------------

const DEFAULT_LOCATION_PAGE_SIZE = 20

export function useLocations(pageSize = DEFAULT_LOCATION_PAGE_SIZE) {
  const [isLoading, setIsLoading] = useState(true)
  const [locations, setLocations] = useState<ResourceLocationRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<PaginationState>({
    hasNextPage: false, hasPreviousPage: false,
    endCursor: null, startCursor: null,
    totalCount: 0, currentPage: 1, totalPages: 1,
  })
  const cursorStackRef = useRef<string[]>([])
  const currentAfterRef = useRef<string | undefined>(undefined)

  const fetchPage = useCallback(async (after?: string, page = 1) => {
    setIsLoading(true)
    setError(null)
    try {
      const args: any = { first: pageSize }
      if (after) args.after = after

      const driverConn = await query(
        'driverLocations',
        { args },
        `{ totalCount pageInfo { endCursor startCursor hasNextPage hasPreviousPage } edges { node { id latitude longitude accuracy recordedAt updatedAt driverId } } }`
      )

      const customerConn = await query(
        'customerLocations',
        { args },
        `{ totalCount pageInfo { endCursor startCursor hasNextPage hasPreviousPage } edges { node { id latitude longitude accuracy recordedAt updatedAt customerId } } }`
      ).catch(() => null)

      const out: ResourceLocationRow[] = []

      const driverEdges: any[] = Array.isArray(driverConn?.edges) ? driverConn.edges : []
      for (const e of driverEdges) {
        const n = e?.node
        if (!n) continue
        out.push({
          kind: 'driver',
          id: String(n?.id ?? ''),
          userId: String(n?.driverId ?? ''),
          latitude: Number(n?.latitude ?? 0),
          longitude: Number(n?.longitude ?? 0),
          accuracy: typeof n?.accuracy === 'number' ? n.accuracy : undefined,
          recordedAtISO: n?.recordedAt ? String(n.recordedAt) : undefined,
          updatedAtISO: n?.updatedAt ? String(n.updatedAt) : undefined,
        })
      }

      const customerEdges: any[] = Array.isArray(customerConn?.edges) ? customerConn.edges : []
      for (const e of customerEdges) {
        const n = e?.node
        if (!n) continue
        out.push({
          kind: 'customer',
          id: String(n?.id ?? ''),
          userId: String(n?.customerId ?? ''),
          latitude: Number(n?.latitude ?? 0),
          longitude: Number(n?.longitude ?? 0),
          accuracy: typeof n?.accuracy === 'number' ? n.accuracy : undefined,
          recordedAtISO: n?.recordedAt ? String(n.recordedAt) : undefined,
          updatedAtISO: n?.updatedAt ? String(n.updatedAt) : undefined,
        })
      }

      out.sort((a, b) => String(b.updatedAtISO ?? '').localeCompare(String(a.updatedAtISO ?? '')))

      const driverTotal = typeof driverConn?.totalCount === 'number' ? driverConn.totalCount : driverEdges.length
      const customerTotal = typeof customerConn?.totalCount === 'number' ? customerConn.totalCount : customerEdges.length
      const totalCount = driverTotal + customerTotal
      const hasNextPage = !!driverConn?.pageInfo?.hasNextPage || !!customerConn?.pageInfo?.hasNextPage

      setLocations(out)
      setPagination({
        hasNextPage,
        hasPreviousPage: page > 1,
        endCursor: driverConn?.pageInfo?.endCursor ?? customerConn?.pageInfo?.endCursor ?? null,
        startCursor: null,
        totalCount,
        currentPage: page,
        totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load locations')
    } finally {
      setIsLoading(false)
    }
  }, [pageSize])

  useEffect(() => {
    cursorStackRef.current = []
    currentAfterRef.current = undefined
    fetchPage(undefined, 1)
  }, [fetchPage])

  const nextPage = useCallback(() => {
    if (pagination.hasNextPage && pagination.endCursor) {
      cursorStackRef.current = [...cursorStackRef.current, currentAfterRef.current ?? '']
      currentAfterRef.current = pagination.endCursor
      fetchPage(pagination.endCursor, pagination.currentPage + 1)
    }
  }, [pagination, fetchPage])

  const prevPage = useCallback(() => {
    if (pagination.currentPage > 1) {
      const stack = [...cursorStackRef.current]
      const prev = stack.pop()
      cursorStackRef.current = stack
      const cursor = prev || undefined
      currentAfterRef.current = cursor
      fetchPage(cursor, pagination.currentPage - 1)
    }
  }, [pagination, fetchPage])

  const refetch = useCallback(() => {
    fetchPage(currentAfterRef.current, pagination.currentPage)
  }, [fetchPage, pagination.currentPage])

  return { locations, isLoading, error, pagination, nextPage, prevPage, refetch }
}

// --------------- Cars ---------------

export interface ResourceCar {
  id: string
  carName?: string
  licensePlate: string
  color: string
  carClass?: string
  driverId?: string
  driverName?: string
}

export function useCars() {
  const [isLoading, setIsLoading] = useState(true)
  const [cars, setCars] = useState<ResourceCar[]>([])
  const [error, setError] = useState<string | null>(null)

  const fetchCars = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      // One path now. The try/catch around a raw document with the GQty call
      // as its fallback existed because the document failed on booklimo; the
      // fallback is the only half that ever worked there, so it is all that
      // is left.
      const conn = await query(
        'cars',
        { args: { first: 200 } },
        `{ totalCount pageInfo { endCursor startCursor hasNextPage hasPreviousPage } edges { node { id carName licensePlate color ` +
          `carClass driverId driverName } } }`
      )
      const edges: any[] = Array.isArray(conn?.edges) ? conn.edges : []

      const items: ResourceCar[] = edges.map((e: any) => {
        const n = e?.node
        return {
          id: String(n?.id ?? ''),
          carName: n?.carName ?? undefined,
          licensePlate: String(n?.licensePlate ?? ''),
          color: String(n?.color ?? ''),
          carClass: n?.carClass ?? undefined,
          driverId: n?.driverId ?? undefined,
          driverName: n?.driverName ?? undefined,
        }
      })
      setCars(items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cars')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchCars() }, [fetchCars])

  return { cars, isLoading, error, refetch: fetchCars }
}

// --------------- Mutations ---------------

export async function assignDriverMutation(transferId: string, driverId: string): Promise<ResourceTransfer> {
  const result = await query(
    'assignDriver',
    { transferId, driverId },
    '{ id state driverId carId customerId pickupLocation dropoffLocation pickupDateTime referenceId price }',
    'mutation'
  )
  return mapTransferRow(result)
}

export async function assignCarMutation(transferId: string, carId: string): Promise<ResourceTransfer> {
  const result = await query(
    'assignCar',
    { transferId, carId },
    '{ id state driverId carId customerId pickupLocation dropoffLocation pickupDateTime referenceId price }',
    'mutation'
  )
  return mapTransferRow(result)
}

export async function updateTransferStateMutation(transferId: string, state: string): Promise<ResourceTransfer> {
  // state is an enum member on the server, so it goes into the document bare.
  const result = await query(
    'updateTransferState',
    { transferId, state: new EnumValue(state) },
    '{ id state driverId carId customerId pickupLocation dropoffLocation pickupDateTime referenceId price }',
    'mutation'
  )
  return mapTransferRow(result)
}

export async function setPriceMutation(transferId: string, price: number): Promise<ResourceTransfer> {
  const result = await query(
    'setPrice',
    { transferId, price },
    '{ id state driverId carId customerId pickupLocation dropoffLocation pickupDateTime referenceId price }',
    'mutation'
  )
  return mapTransferRow(result)
}

export interface CreateTransferArgs {
  customerId: string
  pickupLocation: string
  dropoffLocation: string
  pickupDateTime: string
  payingParty?: string
  paymentMethode?: string
  carId?: string
}

export interface BookTransferArgs {
  pickupLocation: string
  dropoffLocation: string
  pickupDateTime: string
  subject?: string
  paymentMethode?: string
  payingParty?: string
}

export async function createTransferMutation(args: CreateTransferArgs): Promise<ResourceTransfer> {
  const result = await query(
    'createTransfer',
    { args },
    '{ id state driverId carId customerId pickupLocation dropoffLocation pickupDateTime referenceId price }',
    'mutation'
  )
  return mapTransferRow(result)
}

export async function bookTransferMutation(args: BookTransferArgs): Promise<ResourceTransfer> {
  const result = await query(
    'bookTransfer',
    { args },
    '{ id state driverId carId customerId pickupLocation dropoffLocation pickupDateTime referenceId price }',
    'mutation'
  )
  return mapTransferRow(result)
}

// --------------- Driver Color ---------------

export async function fetchDriverColor(userId: string): Promise<string | undefined> {
  return resolveDriverColor(userId)
}

export async function setDriverColorMutation(userId: string, color: string): Promise<boolean> {
  const result = await query('setDriverColor', { userId, color }, '', 'mutation')
  return !!result
}

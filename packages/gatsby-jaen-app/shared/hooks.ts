declare const __JAEN_ZITADEL_GQL__: {authority?: string; clientId?: string} | undefined

/**
 * Data hooks for the preview app.
 * Server-side cursor pagination: each hook fetches only one page at a time.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { resolve } from '../client/limosen'

// --------------- Raw GraphQL fetch (bypasses GQty) ---------------

/**
 * The backend comes from the plugin's `pylonUrl` option, not from a constant.
 *
 * Both endpoints were hardcoded to limosen's pylon, which is invisible as long as
 * only limosen mounts the plugin and wrong the moment a second brand does: the
 * booklimo build carried api.booklimo.at in its config and still read limosen's
 * transfers, users and locations. `__JAEN_APP_PYLON_URL__` is the define
 * gatsby-node injects from that option; the literal stays as the fallback so a
 * consumer that sets no option behaves exactly as before.
 */
declare const __JAEN_APP_PYLON_URL__: string | undefined

const PYLON_URL =
  typeof __JAEN_APP_PYLON_URL__ !== 'undefined' && __JAEN_APP_PYLON_URL__
    ? __JAEN_APP_PYLON_URL__
    : 'https://api.limosen.at/graphql'

const API_URL = PYLON_URL

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  try {
    // A DefinePlugin value is substituted for the bare IDENTIFIER only, never for
    // a `globalThis.` member access, so the old spelling read undefined at runtime
    // no matter which name it used. Renamed with jaen's zitadel -> zitadelGql move
    // and unwrapped, the way client/limosen/index.ts already does it.
    const z: any =
      typeof __JAEN_ZITADEL_GQL__ !== 'undefined' ? __JAEN_ZITADEL_GQL__ : null
    if (z?.authority && z?.clientId) {
      const raw = sessionStorage.getItem(`oidc.user:${z.authority}:${z.clientId}`)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.access_token) headers['Authorization'] = `Bearer ${parsed.access_token}`
      }
    }
  } catch { /* ignore */ }
  return headers
}

async function gqlFetch<T = any>(query: string, variables?: Record<string, any>): Promise<T> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ query, variables }),
    mode: 'cors',
  })
  const json = await response.json()
  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message || 'GraphQL error')
  }
  return json.data
}

const TRANSFERS_QUERY = `
  query($args: TransfersArgsInput) {
    transfers(args: $args) {
      totalCount
      pageInfo {
        endCursor
        startCursor
        hasNextPage
        hasPreviousPage
      }
      edges {
        node {
          id
          customerId
          driverId
          pickupDateTime
          pickupLocation
          dropoffLocation
          subject
          price
          paymentMethode
          payingParty
          state
          requestedAt
          carId
          referenceId
          transferCategory
          transferType
        }
      }
    }
  }
`

const USER_QUERY = `
  query($args: UserArgsInput!) {
    user(args: $args) {
      __typename
      id
      userName
      state
      preferredLoginName
      creationDate
      changeDate
      loginNames
    }
  }
`

const USER_PROFILES_QUERY = `
  query($args: UserArgsInput!) {
    user(args: $args) {
      ... on HumanUser {
        profiles {
          edges {
            node {
              id
              email
              firstName
              lastName
              avatarUrl
              displayName
              phone
              preferredLanguage
            }
          }
        }
      }
    }
  }
`

const USER_ROLES_QUERY = `
  query($args: UserArgsInput!) {
    user(args: $args) {
      roles {
        edges {
          node {
            id
            key
            displayName
          }
        }
      }
    }
  }
`

const USERS_QUERY = `
  query($args: UsersArgsInput) {
    users(args: $args) {
      totalCount
      pageInfo {
        endCursor
        startCursor
        hasNextPage
        hasPreviousPage
      }
      edges {
        node {
          __typename
          id
          userName
          state
          preferredLoginName
          creationDate
          changeDate
        }
      }
    }
  }
`

const DRIVER_COLOR_QUERY = `
  query($userId: String!) {
    getDriverColor(userId: $userId)
  }
`

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

      const data = await gqlFetch(TRANSFERS_QUERY, { args })
      const result = data?.transfers

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

      const data = await gqlFetch(USERS_QUERY, { args })
      const result = data?.users

      const edges: any[] = Array.isArray(result?.edges) ? result.edges : []
      const items = edges.map((e: any) => e?.node).filter(Boolean).map(mapUserRow)
      const totalCount = typeof result?.totalCount === 'number' ? result.totalCount : 0

      const enriched = await Promise.all(
        items.map(async (u) => {
          try {
            const colorData = await gqlFetch(DRIVER_COLOR_QUERY, { userId: u.id })
            const color = colorData?.getDriverColor
            return { ...u, driverColor: color && color !== '#C0C0C0' ? color : undefined }
          } catch {
            return u
          }
        })
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
      const data = await gqlFetch(USER_QUERY, { args: { id: userId } })
      const result = data?.user
      let mapped = result ? mapUserRowFull(result) : undefined

      if (mapped) {
        const queryArgs = { args: { id: userId } }

        const [profilesResult, rolesResult, colorResult] = await Promise.all([
          gqlFetch(USER_PROFILES_QUERY, queryArgs).catch(() => null),
          gqlFetch(USER_ROLES_QUERY, queryArgs).catch(() => null),
          gqlFetch(DRIVER_COLOR_QUERY, { userId: mapped.id }).catch(() => null),
        ])

        const profileEdges = profilesResult?.user?.profiles?.edges || []
        const firstProfile = profileEdges[0]?.node
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

        const roleEdges = rolesResult?.user?.roles?.edges || []
        const roles = roleEdges
          .map((e: any) => e?.node)
          .filter(Boolean)
          .map((r: any) => ({ id: r.id ?? r.key ?? '', description: r.displayName ?? r.key ?? '' }))
        if (roles.length) {
          mapped = { ...mapped, roles }
        }

        const color = colorResult?.getDriverColor
        if (color && color !== '#C0C0C0') {
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

      const driverConn = await resolve(
        ({ query }) => {
          const q: any = query
          const c = typeof q.driverLocations === 'function' ? q.driverLocations({ args }) : q.driverLocations
          void c?.pageInfo?.endCursor
          void c?.pageInfo?.hasNextPage
          void c?.totalCount
          const firstNode = c?.edges?.[0]?.node
          if (firstNode) {
            void firstNode.id; void firstNode.driverId
            void firstNode.latitude; void firstNode.longitude
            void firstNode.accuracy; void firstNode.recordedAt; void firstNode.updatedAt
          }
          return c
        },
        { cachePolicy: 'no-store' }
      )

      const customerConn = await resolve(
        ({ query }) => {
          const q: any = query
          const c = typeof q.customerLocations === 'function' ? q.customerLocations({ args }) : q.customerLocations
          void c?.pageInfo?.endCursor
          void c?.pageInfo?.hasNextPage
          void c?.totalCount
          const firstNode = c?.edges?.[0]?.node
          if (firstNode) {
            void firstNode.id; void firstNode.customerId
            void firstNode.latitude; void firstNode.longitude
            void firstNode.accuracy; void firstNode.recordedAt; void firstNode.updatedAt
          }
          return c
        },
        { cachePolicy: 'no-store' }
      )

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

const CARS_QUERY = `
  query($args: CarsArgsInput) {
    cars(args: $args) {
      totalCount
      pageInfo {
        endCursor
        hasNextPage
      }
      edges {
        node {
          id
          carName
          licensePlate
          color
          carClass
          driverId
          driverName
        }
      }
    }
  }
`

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
      let edges: any[] = []

      try {
        const data = await gqlFetch(CARS_QUERY, { args: { first: 200 } })
        edges = Array.isArray(data?.cars?.edges) ? data.cars.edges : []
      } catch {
        const conn = await resolve(
          ({ query }) => {
            const c = (query as any).cars({ args: { first: 200 } })
            void c?.pageInfo?.endCursor
            void c?.pageInfo?.hasNextPage
            const firstNode = c?.edges?.[0]?.node
            if (firstNode) {
              void firstNode.id
              void firstNode.carName
              void firstNode.licensePlate
              void firstNode.color
              void firstNode.carClass
              void firstNode.driverId
              void firstNode.driverName
            }
            return c
          },
          { cachePolicy: 'no-store' }
        )
        edges = Array.isArray(conn?.edges) ? conn.edges : []
      }

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
  const result = await resolve(
    ({ mutation }) => {
      const t = (mutation as any).assignDriver({ transferId, driverId })
      void t?.id; void t?.state; void t?.driverId
      void t?.pickupLocation; void t?.dropoffLocation; void t?.pickupDateTime
      void t?.referenceId; void t?.price
      return t
    },
    { cachePolicy: 'no-store' }
  )
  return mapTransferRow(result)
}

export async function assignCarMutation(transferId: string, carId: string): Promise<ResourceTransfer> {
  const result = await resolve(
    ({ mutation }) => {
      const t = (mutation as any).assignCar({ transferId, carId })
      void t?.id; void t?.state; void t?.carId
      void t?.pickupLocation; void t?.dropoffLocation; void t?.pickupDateTime
      void t?.referenceId; void t?.price
      return t
    },
    { cachePolicy: 'no-store' }
  )
  return mapTransferRow(result)
}

export async function updateTransferStateMutation(transferId: string, state: string): Promise<ResourceTransfer> {
  const result = await resolve(
    ({ mutation }) => {
      const t = (mutation as any).updateTransferState({ transferId, state })
      void t?.id; void t?.state; void t?.driverId
      void t?.pickupLocation; void t?.dropoffLocation; void t?.pickupDateTime
      void t?.referenceId; void t?.price
      return t
    },
    { cachePolicy: 'no-store' }
  )
  return mapTransferRow(result)
}

export async function setPriceMutation(transferId: string, price: number): Promise<ResourceTransfer> {
  const result = await resolve(
    ({ mutation }) => {
      const t = (mutation as any).setPrice({ transferId, price })
      void t?.id; void t?.state; void t?.price
      void t?.pickupLocation; void t?.dropoffLocation; void t?.pickupDateTime
      void t?.referenceId
      return t
    },
    { cachePolicy: 'no-store' }
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
  const result = await resolve(
    ({ mutation }) => {
      const t = (mutation as any).createTransfer({ args })
      void t?.id; void t?.state
      void t?.pickupLocation; void t?.dropoffLocation; void t?.pickupDateTime
      void t?.referenceId; void t?.price; void t?.customerId
      return t
    },
    { cachePolicy: 'no-store' }
  )
  return mapTransferRow(result)
}

export async function bookTransferMutation(args: BookTransferArgs): Promise<ResourceTransfer> {
  const result = await resolve(
    ({ mutation }) => {
      const t = (mutation as any).bookTransfer({ args })
      void t?.id; void t?.state
      void t?.pickupLocation; void t?.dropoffLocation; void t?.pickupDateTime
      void t?.referenceId; void t?.price; void t?.customerId
      void t?.subject; void t?.paymentMethode
      return t
    },
    { cachePolicy: 'no-store' }
  )
  return mapTransferRow(result)
}

// --------------- Driver Color ---------------

export async function fetchDriverColor(userId: string): Promise<string | undefined> {
  try {
    const data = await gqlFetch(DRIVER_COLOR_QUERY, { userId })
    const result = data?.getDriverColor
    return typeof result === 'string' && result !== '#C0C0C0' ? result : undefined
  } catch {
    return undefined
  }
}

export async function setDriverColorMutation(userId: string, color: string): Promise<boolean> {
  const result = await resolve(
    ({ mutation }) => (mutation as any).setDriverColor({ userId, color }),
    { cachePolicy: 'no-store' }
  )
  return !!result
}

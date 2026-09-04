declare const __JAEN_ZITADEL_GQL__: {authority?: string; clientId?: string} | undefined

// src/index.ts
import {useNotificationsContext} from 'jaen'
import {useCallback, useEffect, useRef, useState} from 'react'
import {GQtyError} from 'gqty'

import {resolve} from '../client/limosen'
import type {UserNode, Transfer} from '../client/limosen'

// Re-export app hooks so pages import from `src/index.ts`
export {usePushNotifications} from './hooks/usePushNotifications'

// ---------------------------
// Domain models
// ---------------------------

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
  roles: Array<{id: string; description: string}>
  // Optional per-customer prices metadata (invoice/self)
  prices?: any
  // Optional driver color (hex string) for users with role `limosen:driver`
  driverColor?: string

  // --- Driver financial stats (from IAM user fields) ---
  revenue?: number
  transferCount?: number
  monthlyRevenue?: number
  monthlyCount?: number

  // payout helper (35%)
  payoutPercent?: number
  earnedThisMonth?: number
  earnedTotal?: number
}

export interface UserCreateInput {
  emailAddress: string
  username: string
  details?: {
    firstName?: string
    lastName?: string
  }
  password?: string
}

export interface ResourceTransfer {
  id: string
  customerId: string
  driverId?: string
  pickup: string
  dropoff: string
  roomOrName?: string
  /**
   * TransferDetails (1:1) from backend schema.
   * These fields are optional and may be absent for legacy transfers.
   */
  details?: {
    flightNumber?: string
    message?: string
    luggage?: string
    childSeats?: string
    extraTime?: string
    preferredCarClass?: string
    preferredCarName?: string
  }
  rideDateISO: string
  rideTime: string
  requestedAtISO: string
  price?: number
  paymentMethode?: string
  payingParty?: string
  state: string
  vehicle?: string

  // --- Dashboard redesign: nested fields ---
  driverName?: string
  driverPhone?: string
  customerName?: string
  customerPhone?: string
  passengerCount?: number
  carLicensePlate?: string
  carClass?: string
  carColor?: string
  referenceId?: string
  extras?: Array<{type: string; amount: number}>
  transferCategory?: string
  transferType?: string
  /** Driver colour (hex) resolved from the driver's DriverData */
  driverColor?: string
}

export interface TransferCreateInput {
  rideDateISO: string
  rideTime: string
  pickup: string
  dropoff: string
  roomOrName?: string
  vehicle?: string
  price?: number
  paymentMethode?: string
  payingParty?: string
  /**
   * Optional TransferDetails input.
   * If omitted, the backend will create a transfer without details.
   */
  details?: {
    flightNumber?: string
    message?: string
    luggage?: string
    childSeats?: string
    extraTime?: string
    preferredCarClass?: string
    preferredCarName?: string
  }
}

// Shared payment options (English labels)
export const PAYMENT_OPTIONS: string[] = ['Cash', 'Card', 'Voucher', 'Invoice']

// ---------------------------
// Mappers
// ---------------------------

type MapUserOptions = {
  /** If true, we also resolve roles/isAdmin (expensive on Cloudflare Worker) */
  includeRoles?: boolean
  /** If true, also resolve `prices` metadata */
  includePrices?: boolean
  /** If true, also resolve `driverColor` metadata */
  includeDriverColor?: boolean
}

/**
 * Map UserNode -> ResourceUser
 *
 * IMPORTANT: Roles are optional and can be skipped to avoid a ton of
 * subrequests (Zitadel project-role lookups) on Cloudflare.
 */
const mapIamUserToResourceUser = (
  user: UserNode | null | undefined,
  options?: MapUserOptions
): ResourceUser => {
  const includeRoles = options?.includeRoles ?? false

  let roles: Array<{id: string; description: string}> = []
  let isAdmin = false

  if (includeRoles && user) {
    // Only touch user.roles when explicitly requested – this is what triggers
    // project-role resolution inside the Worker.
    const roleObjs = Array.isArray((user as any).roles)
      ? ((user as any).roles as any[])
      : []

    roles = roleObjs
      .map(r => {
        const key = typeof r?.key === 'string' ? r.key : undefined
        if (!key) return null

        const description =
          typeof r?.displayName === 'string' && r.displayName.length > 0
            ? r.displayName
            : key

        return {id: key, description}
      })
      .filter(Boolean) as Array<{id: string; description: string}>

    isAdmin = roleObjs.some(r => r && r.key === 'jaen:admin')
  }

  // optionally map prices (metadata key `prices` from IAM)
  let prices: any | undefined = undefined
  if (options?.includePrices && user) {
    try {
      prices = (user as any).prices ?? undefined
    } catch {
      prices = undefined
    }
  }

  // optionally map driverColor
  let driverColor: string | undefined = undefined
  if (options?.includeDriverColor && user) {
    try {
      driverColor = (user as any).driverColor ?? undefined
    } catch {
      driverColor = undefined
    }
  }

  const avatarURL: string | undefined =
    user && (user as any).avatarUrl ? (user as any).avatarUrl : undefined

  // ---- financial fields (scalars) ----
  const revenue =
    user && typeof (user as any).revenue === 'number' ? (user as any).revenue : 0

  const transferCount =
    user && typeof (user as any).transferCount === 'number'
      ? (user as any).transferCount
      : 0

  const monthlyRevenue =
    user && typeof (user as any).monthlyRevenue === 'number'
      ? (user as any).monthlyRevenue
      : 0

  const monthlyCount =
    user && typeof (user as any).monthlyCount === 'number'
      ? (user as any).monthlyCount
      : 0

  const payoutPercent = 0.35
  const earnedThisMonth = monthlyRevenue * payoutPercent
  const earnedTotal = revenue * payoutPercent

  // Force GQty to include __typename for IUserNode so the server can resolve the concrete type
  void (user as any)?.__typename

  // UserNode can be HumanUser or MachineUser - access via $on or type guard
  const humanUser = user && (user as any).$on ? ((user as any).$on as any).HumanUser : user
  const profiles = humanUser && typeof (humanUser as any).profiles === 'function' 
    ? (humanUser as any).profiles() 
    : null
  const profileEdges = profiles?.edges || []
  const firstProfile = profileEdges[0]?.node

  return {
    id: user?.id ?? '',
    primaryEmailAddress: (firstProfile as any)?.email ?? (user as any).preferredLoginName ?? '',
    username: user?.userName ?? '',
    createdAt: user?.creationDate ?? user?.changeDate ?? null,
    details: {
      avatarURL: (firstProfile as any)?.avatarUrl ?? avatarURL,
      firstName: (firstProfile as any)?.firstName ?? undefined,
      lastName: (firstProfile as any)?.lastName ?? undefined
    },
    // state is a plain String in the schema – support both legacy + new values
    isActive:
      user?.state === 'USER_STATE_ACTIVE' ||
      user?.state?.toLowerCase?.() === 'active',
    isAdmin,
    roles,
    prices,
    driverColor,

    revenue,
    transferCount,
    monthlyRevenue,
    monthlyCount,
    payoutPercent,
    earnedThisMonth,
    earnedTotal
  }
}

const mapTransferRowToResourceTransfer = (
  transfer: Transfer | null | undefined
): ResourceTransfer => {
  const price =
    typeof (transfer as any)?.price === 'number' ? (transfer as any).price : undefined

  // Transfer uses pickupLocation/dropoffLocation and pickupDateTime (DateTimeISO)
  const pickupDateTime = transfer?.pickupDateTime
  const requestedAt = transfer?.requestedAt
  let rideDateISO = ''
  let rideTime = ''

  const pad2 = (n: number) => String(n).padStart(2, '0')
  if (pickupDateTime) {
    try {
      const d = new Date(pickupDateTime as any)
      if (!Number.isNaN(d.getTime())) {
        // Local date/time (so "today/tomorrow" pagination matches user expectation)
        rideDateISO = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(
          d.getDate()
        )}`
        rideTime = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(
          d.getSeconds()
        )}`
      } else {
        rideDateISO = ''
        rideTime = ''
      }
    } catch {
      rideDateISO = ''
      rideTime = ''
    }
  }
  const requestedAtISO = requestedAt ? new Date(requestedAt as any).toISOString() : ''

  const rawDetails: any = (transfer as any)?.details
  const flightNumber: string | undefined =
    typeof rawDetails?.flightNumber === 'string' ? rawDetails.flightNumber : undefined
  const message: string | undefined =
    typeof rawDetails?.message === 'string' ? rawDetails.message : undefined
  const luggage: string | undefined =
    typeof rawDetails?.luggage === 'string' ? rawDetails.luggage : undefined
  const childSeats: string | undefined =
    typeof rawDetails?.childSeats === 'string' ? rawDetails.childSeats : undefined
  const extraTime: string | undefined =
    typeof rawDetails?.extraTime === 'string' ? rawDetails.extraTime : undefined
  const preferredCarClass: string | undefined =
    typeof rawDetails?.preferredCarClass === 'string'
      ? rawDetails.preferredCarClass
      : undefined
  const preferredCarName: string | undefined =
    typeof rawDetails?.preferredCarName === 'string'
      ? rawDetails.preferredCarName
      : undefined

  const subject: string | undefined =
    typeof transfer?.subject === 'string' ? transfer.subject : undefined

  // --------------- NEW: nested fields for dashboard redesign ---------------

  // Passenger count (touch passengers connection for totalCount only)
  let passengerCount: number | undefined = undefined
  try {
    const passConn =
      typeof (transfer as any)?.passengers === 'function'
        ? (transfer as any).passengers()
        : (transfer as any)?.passengers
    const count = passConn?.totalCount
    passengerCount = typeof count === 'number' ? count : undefined
  } catch {
    passengerCount = undefined
  }

  // Full car details
  const carObj = (transfer as any)?.car
  const carLicensePlate: string | undefined =
    typeof carObj?.licensePlate === 'string' ? carObj.licensePlate : undefined
  const carClass: string | undefined =
    carObj?.carClass != null ? String(carObj.carClass) : undefined
  const carColor: string | undefined =
    typeof carObj?.color === 'string' ? carObj.color : undefined

  // Driver name / phone from profiles
  let driverName: string | undefined = undefined
  let driverPhone: string | undefined = undefined
  let driverColor: string | undefined = undefined
  try {
    const driverUser = (transfer as any)?.driver
    void driverUser?.__typename
    if (driverUser) {
      const human = driverUser?.$on?.HumanUser ?? driverUser
      const profileConn =
        typeof human?.profiles === 'function' ? human.profiles() : human?.profiles
      const profileEdges = profileConn?.edges || []
      const profile = profileEdges[0]?.node
      if (profile) {
        const first = (profile as any)?.firstName || ''
        const last = (profile as any)?.lastName || ''
        driverName = [first, last].filter(Boolean).join(' ') || undefined
        driverPhone =
          typeof (profile as any)?.phone === 'string' ? (profile as any).phone : undefined
      }
      // Driver colour from DriverData
      const dataConn =
        typeof human?.data === 'function' ? human.data() : human?.data
      const dataEdges = dataConn?.edges || []
      for (const de of dataEdges) {
        const dn = de?.node
        const nodeColor = (dn as any)?.$on?.DriverData?.color ?? (dn as any)?.color
        if (typeof nodeColor === 'string') {
          driverColor = nodeColor
          break
        }
      }
    }
  } catch {
    // ignore – profile resolution is best-effort
  }

  // Customer name / phone from profiles
  let customerName: string | undefined = undefined
  let customerPhone: string | undefined = undefined
  try {
    const customerUser = (transfer as any)?.customer
    void customerUser?.__typename
    if (customerUser) {
      const human = customerUser?.$on?.HumanUser ?? customerUser
      const profileConn =
        typeof human?.profiles === 'function' ? human.profiles() : human?.profiles
      const profileEdges = profileConn?.edges || []
      const profile = profileEdges[0]?.node
      if (profile) {
        const first = (profile as any)?.firstName || ''
        const last = (profile as any)?.lastName || ''
        customerName = [first, last].filter(Boolean).join(' ') || undefined
        customerPhone =
          typeof (profile as any)?.phone === 'string' ? (profile as any).phone : undefined
      }
    }
  } catch {
    // ignore
  }

  // Extras (TravelAddons)
  let extras: Array<{type: string; amount: number}> | undefined = undefined
  try {
    const extrasConn =
      typeof (transfer as any)?.extras === 'function'
        ? (transfer as any).extras({args: {first: 100}})
        : (transfer as any)?.extras
    const extrasEdges: any[] = Array.isArray(extrasConn?.edges)
      ? extrasConn.edges
      : []
    if (extrasEdges.length > 0) {
      extras = extrasEdges
        .map((e: any) => {
          const n = e?.node
          const t = typeof n?.type === 'string' ? n.type : ''
          const a = typeof n?.amount === 'number' ? n.amount : 1
          return t ? {type: t, amount: a} : null
        })
        .filter(Boolean) as Array<{type: string; amount: number}>
    }
  } catch {
    // ignore
  }

  // Reference ID (origin transfer code) — requires schema regeneration to take effect
  const referenceId: string | undefined =
    typeof (transfer as any)?.referenceId === 'string'
      ? (transfer as any).referenceId
      : undefined

  // Transfer category & type
  const transferCategory: string | undefined =
    (transfer as any)?.transferCategory != null
      ? String((transfer as any).transferCategory)
      : undefined
  const transferType: string | undefined =
    (transfer as any)?.transferType != null
      ? String((transfer as any).transferType)
      : undefined

  return {
    id: transfer?.id ?? '',
    customerId: transfer?.customerId ?? '',
    driverId: transfer?.driverId ?? undefined,
    pickup: transfer?.pickupLocation ?? '',
    dropoff: transfer?.dropoffLocation ?? '',
    roomOrName: subject ?? message ?? undefined,
    details: rawDetails
      ? {
          flightNumber,
          message,
          luggage,
          childSeats,
          extraTime,
          preferredCarClass,
          preferredCarName
        }
      : undefined,
    rideDateISO,
    rideTime,
    requestedAtISO,
    price,
    paymentMethode: (transfer as any)?.paymentMethode ?? undefined,
    payingParty: (transfer as any)?.payingParty ?? undefined,
    // TransferState enum in schema -> plain string in ResourceTransfer
    state: (transfer?.state as unknown as string) ?? 'pending',
    vehicle: (transfer?.car as any)?.carName ?? transfer?.carId ?? undefined,
    // New nested fields
    driverName,
    driverPhone,
    customerName,
    customerPhone,
    passengerCount,
    carLicensePlate,
    carClass,
    carColor,
    referenceId,
    extras,
    transferCategory,
    transferType,
    driverColor
  }
}

// ---------------------------
// useUser
// ---------------------------

export const useUser = (userId: string) => {
  const {toast} = useNotificationsContext()
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<ResourceUser>()

  const fetchUser = useCallback(async () => {
    setIsLoading(true)

    try {
      const result = await resolve(({query}) => {
        // limosen schema: Query.user(args: ArgsInputInput!)
        // ArgsInputInput: { id: String!, organizationId?: String }
        const iamUser = (query as any).user({args: {id: userId}})
        // For user detail view we usually want roles
        // include prices as well for admin user details
        return mapIamUserToResourceUser(iamUser, {
          includeRoles: true,
          includePrices: true,
          includeDriverColor: true
        })
      })

      setUser(result)
    } catch (err) {
      const message =
        err instanceof GQtyError
          ? 'Failed to load the user from the IAM service.'
          : err instanceof Error
            ? err.message
            : 'Failed to load the user.'

      toast({
        title: 'Error',
        description: message,
        status: 'error',
        duration: 5000,
        isClosable: true
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast, userId])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  return {
    user,
    isLoading
  }
}

// ---------------------------
// useCurrentUserFinancials (dashboard)
// ---------------------------

export type CurrentUserFinancials = {
  payoutPercent: number
  monthlyRevenue: number
  monthlyCount: number
  revenue: number
  transferCount: number

  // NEW: cash/expenses/earnings (from getCurrentUserStats)
  monthlyCash: number
  cashTotal: number
  expensesMonth: number
  expensesTotal: number
  earnedThisMonth: number
  earnedTotal: number

  fromDateISO?: string
  toDateISO?: string
}

export const useCurrentUserFinancials = () => {
  const {toast} = useNotificationsContext()
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState<CurrentUserFinancials>()

  const fetchStats = useCallback(async () => {
    setIsLoading(true)

    try {
      const result = await resolve(
        ({query}) => {
          const payoutPercent = 0.35

          // Use currentUser query from limosen schema
          const u: any = (query as any).currentUser()
          void u?.__typename

          // Use new stats query computed from D1
          const s: any =
            typeof (query as any).getCurrentUserStats === 'function'
              ? (query as any).getCurrentUserStats()
              : (query as any).getCurrentUserStats

          // ---- IMPORTANT ----
          // Touch the fields we need so GQty includes them in the selection set.
          const monthlyCash =
            typeof s?.monthlyCash === 'number' ? s.monthlyCash : 0
          const cashTotal =
            typeof s?.cashTotal === 'number' ? s.cashTotal : 0
          const expensesMonth =
            typeof s?.expensesMonth === 'number' ? s.expensesMonth : 0
          const expensesTotal =
            typeof s?.expensesTotal === 'number' ? s.expensesTotal : 0
          const earnedThisMonthServer =
            typeof s?.earnedThisMonth === 'number' ? s.earnedThisMonth : undefined
          const earnedTotalServer =
            typeof s?.earnedTotal === 'number' ? s.earnedTotal : undefined

          const fromDateISO =
            typeof s?.fromDateISO === 'string' ? s.fromDateISO : undefined
          const toDateISO =
            typeof s?.toDateISO === 'string' ? s.toDateISO : undefined

          const monthlyRevenue =
            typeof s?.monthlyRevenue === 'number'
              ? s.monthlyRevenue
              : typeof u?.monthlyRevenue === 'number'
                ? u.monthlyRevenue
                : 0

          const monthlyCount =
            typeof s?.monthlyCount === 'number'
              ? s.monthlyCount
              : typeof u?.monthlyCount === 'number'
                ? u.monthlyCount
                : 0

          const revenue =
            typeof s?.revenue === 'number'
              ? s.revenue
              : typeof u?.revenue === 'number'
                ? u.revenue
                : 0

          const transferCount =
            typeof s?.transferCount === 'number'
              ? s.transferCount
              : typeof u?.transferCount === 'number'
                ? u.transferCount
                : 0

          const earnedThisMonth =
            typeof earnedThisMonthServer === 'number'
              ? earnedThisMonthServer
              : monthlyRevenue * payoutPercent - monthlyCash - expensesMonth

          const earnedTotal =
            typeof earnedTotalServer === 'number'
              ? earnedTotalServer
              : revenue * payoutPercent - cashTotal - expensesTotal

          return {
            payoutPercent,
            monthlyRevenue,
            monthlyCount,
            revenue,
            transferCount,

            monthlyCash,
            cashTotal,
            expensesMonth,
            expensesTotal,
            earnedThisMonth,
            earnedTotal,

            fromDateISO,
            toDateISO
          } as CurrentUserFinancials
        },
        {cachePolicy: 'no-store'}
      )

      setStats(result)
    } catch (err) {
      const message =
        err instanceof GQtyError
          ? 'Failed to load your revenue stats from the IAM service.'
          : err instanceof Error
            ? err.message
            : 'Failed to load your revenue stats.'

      toast({
        title: 'Error',
        description: message,
        status: 'error',
        duration: 5000,
        isClosable: true
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return {stats, isLoading, refetch: fetchStats}
}

// ---------------------------
// useShareLocation (PWA / driver)
// ---------------------------

type GeoPermission = 'granted' | 'denied' | 'prompt' | 'unknown'

export type DriverLocationInput = {
  latitude: number
  longitude: number
  accuracy?: number
  altitude?: number
  altitudeAccuracy?: number
  heading?: number
  speed?: number
  recordedAtISO?: string
}

export type ShareLocationState = {
  isSupported: boolean
  permission: GeoPermission
  isEnabled: boolean
  isWatching: boolean
  isSending: boolean
  lastSentAt?: number
  lastError?: string
  lastLocation?: DriverLocationInput
}

const SHARE_LOCATION_STORAGE_KEY = 'limosen:shareLocationEnabled'

function readShareLocationEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(SHARE_LOCATION_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function writeShareLocationEnabled(next: boolean) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SHARE_LOCATION_STORAGE_KEY, next ? 'true' : 'false')
  } catch {
    // ignore
  }
}

function finiteNumberOrUndefined(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

function buildDriverLocationInput(pos: GeolocationPosition): DriverLocationInput {
  const c = pos.coords
  return {
    latitude: c.latitude,
    longitude: c.longitude,
    accuracy: finiteNumberOrUndefined(c.accuracy),
    altitude: finiteNumberOrUndefined(c.altitude),
    altitudeAccuracy: finiteNumberOrUndefined(c.altitudeAccuracy),
    heading: finiteNumberOrUndefined(c.heading),
    speed: finiteNumberOrUndefined(c.speed),
    recordedAtISO: Number.isFinite(pos.timestamp) ? new Date(pos.timestamp).toISOString() : undefined
  }
}

function tryGetAuthorizationHeader(): string | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    // A DefinePlugin value is substituted for the bare IDENTIFIER only, never for
    // a `globalThis.` member access, so the old spelling read undefined at runtime
    // no matter which name it used. Renamed with jaen's zitadel -> zitadelGql move
    // and unwrapped, the way client/limosen/index.ts already does it.
    const z: any =
      typeof __JAEN_ZITADEL_GQL__ !== 'undefined' ? __JAEN_ZITADEL_GQL__ : null
    const authority = z?.authority
    const clientId = z?.clientId
    if (!authority || !clientId) return undefined

    const raw = window.sessionStorage?.getItem(`oidc.user:${authority}:${clientId}`)
    if (!raw) return undefined

    const parsed = JSON.parse(raw)
    const token = parsed?.access_token
    return token ? `Bearer ${String(token)}` : undefined
  } catch {
    return undefined
  }
}

export const useShareLocation = (opts?: {
  /**
   * Minimum time between location sends (ms).
   * Prevents watchPosition from spamming the backend.
   */
  minIntervalMs?: number
  enableHighAccuracy?: boolean
  maximumAgeMs?: number
  timeoutMs?: number
}): ShareLocationState & {
  enable: () => Promise<boolean>
  disable: () => void
  sendOnce: () => Promise<boolean>
} => {
  const {toast} = useNotificationsContext()

  const [isSupported, setIsSupported] = useState(false)
  const [permission, setPermission] = useState<GeoPermission>('unknown')
  const [isEnabled, setIsEnabled] = useState<boolean>(() => readShareLocationEnabled())

  const [isWatching, setIsWatching] = useState(false)
  const [isSending, setIsSending] = useState(false)

  const [lastSentAt, setLastSentAt] = useState<number | undefined>(undefined)
  const [lastError, setLastError] = useState<string | undefined>(undefined)
  const [lastLocation, setLastLocation] = useState<DriverLocationInput | undefined>(undefined)

  const watchIdRef = useRef<number | null>(null)
  const lastAttemptAtRef = useRef<number>(0)
  const sendingRef = useRef(false)

  const minIntervalMs = typeof opts?.minIntervalMs === 'number' ? opts.minIntervalMs : 15_000
  const enableHighAccuracy =
    typeof opts?.enableHighAccuracy === 'boolean' ? opts.enableHighAccuracy : true
  const maximumAge =
    typeof opts?.maximumAgeMs === 'number' ? Math.max(0, opts.maximumAgeMs) : 10_000
  const timeout = typeof opts?.timeoutMs === 'number' ? Math.max(1, opts.timeoutMs) : 15_000

  useEffect(() => {
    const supported =
      typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'geolocation' in navigator
    setIsSupported(supported)
  }, [])

  useEffect(() => {
    if (!isSupported) return
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
      setPermission('unknown')
      return
    }

    let cancelled = false
    let removeListener: (() => void) | null = null

    navigator.permissions
      .query({name: 'geolocation'} as PermissionDescriptor)
      .then(s => {
        if (cancelled) return
        setPermission((s.state as GeoPermission) ?? 'unknown')

        const onChange = () => setPermission((s.state as GeoPermission) ?? 'unknown')

        // Some browsers support addEventListener, some only onchange
        if (typeof (s as any).addEventListener === 'function') {
          ;(s as any).addEventListener('change', onChange)
          removeListener = () => {
            try {
              ;(s as any).removeEventListener('change', onChange)
            } catch {
              // ignore
            }
          }
        } else {
          ;(s as any).onchange = onChange
          removeListener = () => {
            try {
              ;(s as any).onchange = null
            } catch {
              // ignore
            }
          }
        }
      })
      .catch(() => {
        setPermission('unknown')
      })

    return () => {
      cancelled = true
      try {
        removeListener?.()
      } catch {
        // ignore
      }
    }
  }, [isSupported])

  const postLocationToServiceWorker = useCallback(async (location: DriverLocationInput) => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false
    try {
      const authorization = tryGetAuthorizationHeader()
      const reg = await navigator.serviceWorker.ready
      reg.active?.postMessage({
        type: 'LIMOSEN_SET_DRIVER_LOCATION',
        location,
        authorization
      })
      return true
    } catch {
      return false
    }
  }, [])

  const sendToBackend = useCallback(
    async (location: DriverLocationInput): Promise<boolean> => {
      if (!isSupported) return false

      const now = Date.now()
      if (sendingRef.current) return false
      if (now - lastAttemptAtRef.current < minIntervalMs) return false
      lastAttemptAtRef.current = now

      sendingRef.current = true
      setIsSending(true)
      try {
        await resolve(
          ({mutation}) => {
            const m: any = mutation as any
            if (typeof m.setDriverLocation !== 'function') {
              throw new Error('setDriverLocation mutation not available')
            }

            const result = m.setDriverLocation({
              args: location
            })

            // IMPORTANT: touch fields so GQty sends selection set
            void result?.id
            void result?.updatedAt

            return result?.id
          },
          {
            cachePolicy: 'no-store'
          }
        )

        setLastSentAt(now)
        setLastError(undefined)
        return true
      } catch (err) {
        const message =
          err instanceof GQtyError
            ? 'Failed to send location via GraphQL.'
            : err instanceof Error
              ? err.message
              : 'Failed to send location.'

        setLastError(message)

        // Best-effort fallback: let the Service Worker try a raw GraphQL fetch
        void postLocationToServiceWorker(location)
        return false
      } finally {
        sendingRef.current = false
        setIsSending(false)
      }
    },
    [isSupported, minIntervalMs, postLocationToServiceWorker]
  )

  const stopWatching = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    if (watchIdRef.current != null) {
      try {
        navigator.geolocation.clearWatch(watchIdRef.current)
      } catch {
        // ignore
      }
      watchIdRef.current = null
    }
    setIsWatching(false)
  }, [])

  const startWatching = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    if (watchIdRef.current != null) return

    setIsWatching(true)
    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => {
        const location = buildDriverLocationInput(pos)
        setLastLocation(location)
        void sendToBackend(location)
      },
      err => {
        const message = err?.message ? String(err.message) : 'Failed to read location.'
        setLastError(message)
        if (err?.code === 1) setPermission('denied')
      },
      {
        enableHighAccuracy,
        maximumAge,
        timeout
      }
    )
  }, [enableHighAccuracy, maximumAge, timeout, sendToBackend])

  const enable = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      toast({
        title: 'Location not supported',
        description: 'This browser does not support geolocation.',
        status: 'error',
        duration: 5000,
        isClosable: true
      })
      return false
    }

    try {
      const pos = await new Promise<GeolocationPosition>((resolvePos, rejectPos) => {
        navigator.geolocation.getCurrentPosition(resolvePos, rejectPos, {
          enableHighAccuracy,
          maximumAge,
          timeout
        })
      })

      const location = buildDriverLocationInput(pos)
      setLastLocation(location)

      setIsEnabled(true)
      writeShareLocationEnabled(true)
      setPermission('granted')

      // send immediately once
      await sendToBackend(location)

      return true
    } catch (err: any) {
      const message = err?.message ? String(err.message) : 'Failed to request location permission.'
      setLastError(message)
      if (err?.code === 1) setPermission('denied')

      toast({
        title: 'Location permission',
        description: message,
        status: 'error',
        duration: 5000,
        isClosable: true
      })

      return false
    }
  }, [enableHighAccuracy, isSupported, maximumAge, sendToBackend, timeout, toast])

  const disable = useCallback(() => {
    setIsEnabled(false)
    writeShareLocationEnabled(false)
    stopWatching()
  }, [stopWatching])

  const sendOnce = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false

    try {
      const pos = await new Promise<GeolocationPosition>((resolvePos, rejectPos) => {
        navigator.geolocation.getCurrentPosition(resolvePos, rejectPos, {
          enableHighAccuracy,
          maximumAge,
          timeout
        })
      })

      const location = buildDriverLocationInput(pos)
      setLastLocation(location)
      return await sendToBackend(location)
    } catch (err: any) {
      const message = err?.message ? String(err.message) : 'Failed to read location.'
      setLastError(message)
      if (err?.code === 1) setPermission('denied')
      return false
    }
  }, [enableHighAccuracy, isSupported, maximumAge, sendToBackend, timeout])

  useEffect(() => {
    if (!isSupported) return

    if (!isEnabled) {
      stopWatching()
      return
    }

    startWatching()
    return () => stopWatching()
  }, [isEnabled, isSupported, startWatching, stopWatching])

  return {
    isSupported,
    permission,
    isEnabled,
    isWatching,
    isSending,
    lastSentAt,
    lastError,
    lastLocation,
    enable,
    disable,
    sendOnce
  }
}

// ---------------------------
// useLocations (admin / overview)
// ---------------------------

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
  createdAtISO?: string
}

export const useLocations = () => {
  const {toast} = useNotificationsContext()
  const [isLoading, setIsLoading] = useState(true)
  const [locations, setLocations] = useState<ResourceLocationRow[]>([])

  const fetchLocations = useCallback(async () => {
    setIsLoading(true)

    try {
      const PAGE_SIZE = 100
      const MAX_PAGES = 500

      const out: ResourceLocationRow[] = []

      // ---------------------------
      // Driver locations (public)
      // ---------------------------
      let afterDriver: string | undefined
      for (let i = 0; i < MAX_PAGES; i++) {
        const args: any = {first: PAGE_SIZE}
        if (afterDriver) args.after = afterDriver

        const conn = await resolve(
          ({query}) => {
            const q: any = query as any
            const c: any = typeof q.driverLocations === 'function'
              ? q.driverLocations({args})
              : q.driverLocations

            // Touch pagination + totalCount
            void c?.pageInfo?.endCursor
            void c?.pageInfo?.hasNextPage
            void c?.totalCount

            const edges: any[] = Array.isArray(c?.edges) ? c.edges : []
            for (const e of edges) {
              void e?.cursor
              const n = e?.node
              void n?.id
              void n?.driverId
              void n?.latitude
              void n?.longitude
              void n?.accuracy
              void n?.recordedAt
              void n?.updatedAt
              void n?.createdAt
            }

            return c
          },
          {cachePolicy: 'no-store'}
        )

        const edges: any[] = Array.isArray((conn as any)?.edges) ? (conn as any).edges : []
        for (const e of edges) {
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
            createdAtISO: n?.createdAt ? String(n.createdAt) : undefined
          })
        }

        const endCursor = (conn as any)?.pageInfo?.endCursor
        const hasNextPage = !!(conn as any)?.pageInfo?.hasNextPage
        if (!hasNextPage || !endCursor) break
        afterDriver = String(endCursor)
      }

      // ---------------------------
      // Customer locations (auth)
      // ---------------------------
      let afterCustomer: string | undefined
      for (let i = 0; i < MAX_PAGES; i++) {
        const args: any = {first: PAGE_SIZE}
        if (afterCustomer) args.after = afterCustomer

        const conn = await resolve(
          ({query}) => {
            const q: any = query as any
            const c: any = typeof q.customerLocations === 'function'
              ? q.customerLocations({args})
              : q.customerLocations

            void c?.pageInfo?.endCursor
            void c?.pageInfo?.hasNextPage
            void c?.totalCount

            const edges: any[] = Array.isArray(c?.edges) ? c.edges : []
            for (const e of edges) {
              void e?.cursor
              const n = e?.node
              void n?.id
              void n?.customerId
              void n?.latitude
              void n?.longitude
              void n?.accuracy
              void n?.recordedAt
              void n?.updatedAt
              void n?.createdAt
            }

            return c
          },
          {cachePolicy: 'no-store'}
        )

        const edges: any[] = Array.isArray((conn as any)?.edges) ? (conn as any).edges : []
        for (const e of edges) {
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
            createdAtISO: n?.createdAt ? String(n.createdAt) : undefined
          })
        }

        const endCursor = (conn as any)?.pageInfo?.endCursor
        const hasNextPage = !!(conn as any)?.pageInfo?.hasNextPage
        if (!hasNextPage || !endCursor) break
        afterCustomer = String(endCursor)
      }

      // newest first (ISO strings sort lexicographically)
      out.sort((a, b) => String(b.updatedAtISO ?? '').localeCompare(String(a.updatedAtISO ?? '')))

      setLocations(out)
    } catch (err) {
      const message =
        err instanceof GQtyError
          ? 'Failed to load locations via GraphQL.'
          : err instanceof Error
            ? err.message
            : 'Failed to load locations.'

      toast({
        title: 'Error',
        description: message,
        status: 'error',
        duration: 5000,
        isClosable: true
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchLocations()
  }, [fetchLocations])

  return {
    locations,
    isLoading,
    refetch: fetchLocations
  }
}

// ---------------------------
// useUsers (admin list)
// ---------------------------

export const useUsers = () => {
  const {toast} = useNotificationsContext()
  const [isLoading, setIsLoading] = useState(true)
  const [users, setUsers] = useState<ResourceUser[]>([])

  const fetchUsers = useCallback(async () => {
    setIsLoading(true)

    try {
      const result = await resolve(({query}) => {
        const userConnection = (query as any).users()
        const iamUsers = userConnection?.edges?.map((e: any) => e.node) || []
        // Admin users table: we *do* want roles/isAdmin here.
        return iamUsers.map((u: any) =>
          mapIamUserToResourceUser(u, {includeRoles: true, includeDriverColor: true})
        )
      })

      setUsers(result)
    } catch (err) {
      const message =
        err instanceof GQtyError
          ? 'Failed to load users from the IAM service.'
          : err instanceof Error
            ? err.message
            : 'Failed to load users.'

      toast({
        title: 'Error',
        description: message,
        status: 'error',
        duration: 5000,
        isClosable: true
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const addUser = useCallback(
    async (values: UserCreateInput) => {
      try {
        await resolve(
          ({mutation}) => {
            return (mutation as any).userCreate({
              values: {
                emailAddress: values.emailAddress,
                username: values.username,
                password: values.password,
                details: {
                  firstName: values.details?.firstName,
                  lastName: values.details?.lastName
                }
              }
            })
          },
          {
            cachePolicy: 'no-store'
          }
        )

        toast({
          title: 'User created',
          description: 'The user has been created successfully.',
          status: 'success',
          duration: 5000,
          isClosable: true
        })

        await fetchUsers()
        return true
      } catch (err) {
        const message =
          err instanceof GQtyError
            ? 'Failed to create user via the IAM service.'
            : err instanceof Error
              ? err.message
              : 'Failed to create user.'

        toast({
          title: 'Error',
          description: message,
          status: 'error',
          duration: 5000,
          isClosable: true
        })

        return false
      }
    },
    [toast, fetchUsers]
  )

  const updateUser = useCallback(
    async (id: string, values: Record<string, unknown>) => {
      try {
        await resolve(
          ({mutation}) => {
            return (mutation as any).updateUser({
              userId: id,
              changes: values as any
            })
          },
          {
            cachePolicy: 'no-store'
          }
        )

        toast({
          title: 'User updated',
          description: 'The user has been updated successfully.',
          status: 'success',
          duration: 5000,
          isClosable: true
        })

        await fetchUsers()
        return true
      } catch (err) {
        const message =
          err instanceof GQtyError
            ? 'Failed to update user via the IAM service.'
            : err instanceof Error
              ? err.message
              : 'Failed to update user.'

        toast({
          title: 'Error',
          description: message,
          status: 'error',
          duration: 5000,
          isClosable: true
        })

        return false
      }
    },
    [toast, fetchUsers]
  )

  const deleteUser = useCallback(
    async (id: string) => {
      try {
        await resolve(
          ({mutation}) => {
            return (mutation as any).deleteUser({
              userId: id
            })
          },
          {
            cachePolicy: 'no-store'
          }
        )

        toast({
          title: 'User deleted',
          description: 'The user has been deleted successfully.',
          status: 'success',
          duration: 5000,
          isClosable: true
        })

        await fetchUsers()
        return true
      } catch (err) {
        const message =
          err instanceof GQtyError
            ? 'Failed to delete user via the IAM service.'
            : err instanceof Error
              ? err.message
              : 'Failed to delete user.'

        toast({
          title: 'Error',
          description: message,
          status: 'error',
          duration: 5000,
          isClosable: true
        })

        return false
      }
    },
    [toast, fetchUsers]
  )

  return {
    users,
    isLoading,
    addUser,
    updateUser,
    deleteUser
  }
}

// ---------------------------
// Prices helpers
// ---------------------------

export const fetchCustomerPrices = async (userId: string) => {
  try {
    const result = await resolve(({query}) =>
      (query as any).getCustomerPrices({userId})
    )
    return result
  } catch (err) {
    throw err
  }
}

export const setCustomerPrices = async (targetUserId: string, prices: any) => {
  try {
    await resolve(
      ({mutation}) => (mutation as any).setCustomerPrices({targetUserId, prices}),
      {cachePolicy: 'no-store'}
    )
    return true
  } catch (err) {
    throw err
  }
}

export const fetchCurrentUserPrices = async () => {
  try {
    const result = await resolve(({query}) => (query as any).getCurrentUserPrices())
    return result
  } catch (err) {
    throw err
  }
}

// ---------------------------
// Driver color helpers
// ---------------------------

export const fetchDriverColor = async (userId: string) => {
  try {
    const result = await resolve(({query}) => (query as any).getDriverColor({userId}))
    return result
  } catch (err) {
    throw err
  }
}

export const setDriverColor = async (userId: string, color: string | null) => {
  try {
    await resolve(
      ({mutation}) => (mutation as any).setDriverColor({userId, color: color || '#C0C0C0'}),
      {cachePolicy: 'no-store'}
    )
    return true
  } catch (err) {
    throw err
  }
}

export const fetchCurrentUserColor = async () => {
  try {
    const result = await resolve(({query}) => (query as any).getCurrentUserColor())
    return result
  } catch (err) {
    throw err
  }
}

// ---------------------------
// useTransfers (admin vs driver-safe, no cross-calls)
// ---------------------------

export const useTransfers = (
  driverUserId?: string,
  options?: {isAdmin?: boolean}
) => {
  const {toast} = useNotificationsContext()
  const [isLoading, setIsLoading] = useState(true)
  const [transfers, setTransfers] = useState<ResourceTransfer[]>([])
  const [totalCount, setTotalCount] = useState<number>(0)

  // Track latest request so older responses can't overwrite newer ones
  const requestIdRef = useRef(0)

  // IMPORTANT:
  // - isAdmin === true  => MUST use getAllTransfers
  // - isAdmin === false => MUST use getDriverTransfers
  // - isAdmin === undefined => we don't know yet, do not call any query
  const isAdmin = options?.isAdmin

  const fetchTransfers = useCallback(async () => {
    // Auth/roles not resolved yet -> don't call anything
    if (typeof isAdmin !== 'boolean') {
      setIsLoading(false)
      return
    }

    // Non-admin but we don't yet know driverUserId -> also don't call anything
    if (!isAdmin && !driverUserId) {
      setIsLoading(false)
      return
    }

    const currentRequestId = ++requestIdRef.current
    setIsLoading(true)

    try {
      // IMPORTANT: We want ALL transfers (across all pages), but we page
      // the GraphQL connection internally using `after` + `first`.
      const PAGE_SIZE = 250
      const all: ResourceTransfer[] = []
      let after: string | undefined = undefined
      let serverTotalCount: number | undefined = undefined

      // Safety guard to avoid infinite loops
      for (let i = 0; i < 10000; i++) {
        const args: any = {first: PAGE_SIZE}
        if (after) args.after = after
        if (!isAdmin) args.driverId = driverUserId!

        // Fetch one page of the connection.
        // NOTE: We return the connection itself (not derived arrays) so we don't
        // accidentally freeze "pre-fetch" proxy values into plain objects.
        const transferConnection = await resolve(
          ({query}) => {
            const conn = (query as any).transfers({args})

            // Touch pagination + totalCount so they are requested
            void conn?.pageInfo?.endCursor
            void conn?.pageInfo?.hasNextPage
            void (conn as any)?.totalCount

            // Touch node fields once so they are included for all edges.
            const firstNode = conn?.edges?.[0]?.node
            if (firstNode) {
              void mapTransferRowToResourceTransfer(firstNode)
            }

            return conn
          },
          {cachePolicy: 'no-store'}
        )

        const edges: any[] = Array.isArray((transferConnection as any)?.edges)
          ? ((transferConnection as any).edges as any[])
          : []

        const items = edges
          .map((e: any) => e?.node)
          .filter(Boolean)
          .map(mapTransferRowToResourceTransfer)

        all.push(...items)

        const totalCountRaw = (transferConnection as any)?.totalCount
        const totalCountNum =
          typeof totalCountRaw === 'number'
            ? totalCountRaw
            : typeof totalCountRaw === 'string'
              ? Number(totalCountRaw)
              : undefined
        const totalCountSafe =
          typeof totalCountNum === 'number' && Number.isFinite(totalCountNum)
            ? totalCountNum
            : undefined

        if (typeof serverTotalCount !== 'number' && typeof totalCountSafe === 'number') {
          serverTotalCount = totalCountSafe
        }

        // Abort if a newer request started
        if (requestIdRef.current !== currentRequestId) return

        const endCursor = (transferConnection as any)?.pageInfo?.endCursor
        const hasNextPage = !!(transferConnection as any)?.pageInfo?.hasNextPage

        if (!hasNextPage || !endCursor) {
          break
        }

        after = String(endCursor)
      }

      // Ignore stale responses from previous calls
      if (requestIdRef.current !== currentRequestId) {
        return
      }

      setTransfers(all)
      setTotalCount(typeof serverTotalCount === 'number' ? serverTotalCount : all.length)
    } catch (err) {
      const message =
        err instanceof GQtyError
          ? 'Failed to load transfers from the IAM service.'
          : err instanceof Error
            ? err.message
            : 'Failed to load transfers.'

      toast({
        title: 'Error',
        description: message,
        status: 'error',
        duration: 5000,
        isClosable: true
      })
    } finally {
      if (requestIdRef.current === currentRequestId) {
        setIsLoading(false)
      }
    }
  }, [toast, driverUserId, isAdmin])

  useEffect(() => {
    fetchTransfers()
  }, [fetchTransfers])

  const upsertTransfer = useCallback((next: ResourceTransfer) => {
    setTransfers(prev => {
      const idx = prev.findIndex(t => t.id === next.id)
      if (idx === -1) {
        // keep count roughly in sync without requiring a refetch
        setTotalCount(c => (typeof c === 'number' && c > 0 ? c + 1 : c))
        return [...prev, next]
      }
      const copy = prev.slice()
      copy[idx] = {...copy[idx]!, ...next}
      return copy
    })
  }, [])

  /**
   * Update a transfer state via GraphQL and return the updated transfer.
   * This function ensures a return field is selected so the mutation triggers.
   */
  const updateTransferState = useCallback(
    async (transferId: string, state: string): Promise<ResourceTransfer | null> => {
      try {
        const updated = await resolve(
          ({mutation}) => {
            const result = (mutation as any).updateTransferState({
              transferId,
              state: state as any
            })
            // IMPORTANT: map (touch fields) so GQty builds a selection set
            return mapTransferRowToResourceTransfer(result)
          },
          {cachePolicy: 'no-store'}
        )

        upsertTransfer(updated)
        return updated
      } catch (err) {
        const message =
          err instanceof GQtyError
            ? 'Failed to update transfer state via the IAM service.'
            : err instanceof Error
              ? err.message
              : 'Failed to update transfer state.'

        toast({
          title: 'Error',
          description: message,
          status: 'error',
          duration: 5000,
          isClosable: true
        })

        return null
      }
    },
    [toast, upsertTransfer]
  )

  /**
   * Assign a driver to a transfer
   * 
   * Note: The driverId (userId) is unique and should not require organizationId.
   * If you encounter "Organisation doesn't exist" errors, this is likely a backend
   * issue where the system is incorrectly trying to validate organization grants.
   * 
   * @param transferId - The ID of the transfer to assign a driver to
   * @param driverUserId - The unique user ID of the driver (should have limosen:driver role)
   * @returns Promise<boolean> - true if successful, false otherwise
   */
  const assignDriver = useCallback(
    async (transferId: string, driverUserId: string) => {
      try {
        // Call assignDriver mutation and use returned Transfer to update local state
        const updated = await resolve(
          ({mutation}) => {
            const result = (mutation as any).assignDriver({
              transferId,
              driverId: driverUserId
            })
            // IMPORTANT: select a return value
            return mapTransferRowToResourceTransfer(result)
          },
          {
            cachePolicy: 'no-store'
          }
        )

        upsertTransfer(updated)

        toast({
          title: 'Driver assigned',
          description: 'The driver has been assigned to the transfer.',
          status: 'success',
          duration: 5000,
          isClosable: true
        })

        return true
      } catch (err) {
        // Enhanced error handling for organization-related errors
        let message = 'Failed to assign driver.'
        if (err instanceof GQtyError) {
          message = 'Failed to assign driver via the IAM service.'
          // Check for organization-related error messages
          const errorStr = err.message || String(err)
          if (errorStr.includes('Organisation') || errorStr.includes('Organization')) {
            message = 'Failed to assign driver: Organization validation error. Please ensure the driver has the correct role (limosen:driver).'
          }
        } else if (err instanceof Error) {
          message = err.message
        }

        toast({
          title: 'Error',
          description: message,
          status: 'error',
          duration: 5000,
          isClosable: true
        })

        return false
      }
    },
    [toast, upsertTransfer]
  )

  const assignPrice = useCallback(
    async (transferId: string, priceEUR: number) => {
      try {
        const updated = await resolve(
          ({mutation}) => {
            const m: any = mutation as any
            // New schema: setPrice(price, transferId)
            if (typeof m.setPrice === 'function') {
              const r = m.setPrice({transferId, price: priceEUR})
              return mapTransferRowToResourceTransfer(r)
            }
            // Legacy schema(s): assignPrice(amountEUR, transferId)
            if (typeof m.assignPrice === 'function') {
              const r = m.assignPrice({transferId, amountEUR: priceEUR})
              return mapTransferRowToResourceTransfer(r)
            }
            // Fallbacks for older naming, still with amountEUR arg
            if (typeof m.assignPriceTransfer === 'function') {
              const r = m.assignPriceTransfer({transferId, amountEUR: priceEUR})
              return mapTransferRowToResourceTransfer(r)
            }
            if (typeof m.assignPriceToTransfer === 'function') {
              const r = m.assignPriceToTransfer({transferId, amountEUR: priceEUR})
              return mapTransferRowToResourceTransfer(r)
            }
            throw new Error('assignPrice mutation not found')
          },
          {
            cachePolicy: 'no-store'
          }
        )

        upsertTransfer(updated)

        toast({
          title: 'Price assigned',
          description: 'The price has been assigned to the transfer.',
          status: 'success',
          duration: 5000,
          isClosable: true
        })

        return true
      } catch (err) {
        const message =
          err instanceof GQtyError
            ? 'Failed to assign price via the IAM service.'
            : err instanceof Error
              ? err.message
              : 'Failed to assign price.'

        toast({
          title: 'Error',
          description: message,
          status: 'error',
          duration: 5000,
          isClosable: true
        })

        return false
      }
    },
    [toast, upsertTransfer]
  )

  const completeTransfer = useCallback(
    async (transferId: string) => {
      try {
        const updated = await updateTransferState(transferId, 'COMPLETED')
        if (!updated) return false

        toast({
          title: 'Transfer completed',
          description: 'The transfer has been marked as complete.',
          status: 'success',
          duration: 5000,
          isClosable: true
        })

        return true
      } catch (err) {
        const message =
          err instanceof GQtyError
            ? 'Failed to mark transfer as complete via the IAM service.'
            : err instanceof Error
              ? err.message
              : 'Failed to mark transfer as complete.'

      toast({
          title: 'Error',
          description: message,
          status: 'error',
          duration: 5000,
          isClosable: true
        })

        return false
      }
    },
    [toast, updateTransferState]
  )

  const createTransfer = useCallback(
    async (
      customerId: string,
      values: TransferCreateInput
    ): Promise<boolean> => {
      try {
        const created = await resolve(
          ({mutation}) => {
            // Combine rideDateISO and rideTime into pickupDateTime (DateTimeISO format)
            const pickupDateTime = values.rideDateISO && values.rideTime
              ? `${values.rideDateISO}T${values.rideTime}:00`
              : values.rideDateISO
                ? `${values.rideDateISO}T00:00:00`
                : new Date().toISOString()

            const result = (mutation as any).createTransfer({
              args: {
                customerId,
                pickupDateTime,
                pickupLocation: values.pickup,
                dropoffLocation: values.dropoff,
                subject: values.roomOrName,
                carId: values.vehicle,
                paymentMethode: values.paymentMethode,
                payingParty: values.payingParty,
                price:
                  typeof values.price === 'number'
                    ? values.price
                    : undefined,
                details: values.details
                  ? {
                      flightNumber: values.details.flightNumber,
                      message: values.details.message,
                      luggage: values.details.luggage,
                      childSeats: values.details.childSeats,
                      extraTime: values.details.extraTime,
                      preferredCarClass: values.details.preferredCarClass,
                      preferredCarName: values.details.preferredCarName
                    }
                  : undefined
              }
            })
            // IMPORTANT: return a mapped object so GQty executes the mutation
            return mapTransferRowToResourceTransfer(result)
          },
          {
            cachePolicy: 'no-store'
          }
        )

        upsertTransfer(created)

        toast({
          title: 'Transfer created',
          description: created?.id
            ? `The transfer has been created (ID: ${created.id}).`
            : 'The transfer has been created successfully.',
          status: 'success',
          duration: 5000,
          isClosable: true
        })

        return true
      } catch (err) {
        const message =
          err instanceof GQtyError
            ? 'Failed to create transfer via the IAM service.'
            : err instanceof Error
              ? err.message
              : 'Failed to create transfer.'

        toast({
          title: 'Error',
          description: message,
          status: 'error',
          duration: 5000,
          isClosable: true
        })

        return false
      }
    },
    [toast, upsertTransfer]
  )

  const assignCar = useCallback(
    async (transferId: string, carId: string) => {
      try {
        const updated = await resolve(
          ({mutation}) => {
            const result = (mutation as any).assignCar({transferId, carId})
            return mapTransferRowToResourceTransfer(result)
          },
          {cachePolicy: 'no-store'}
        )

        upsertTransfer(updated)

        toast({
          title: 'Car assigned',
          description: 'The vehicle has been assigned to the transfer.',
          status: 'success',
          duration: 5000,
          isClosable: true
        })

        return true
      } catch (err) {
        const message =
          err instanceof GQtyError
            ? 'Failed to assign car via the IAM service.'
            : err instanceof Error
              ? err.message
              : 'Failed to assign car.'

        toast({
          title: 'Error',
          description: message,
          status: 'error',
          duration: 5000,
          isClosable: true
        })

        return false
      }
    },
    [toast, upsertTransfer]
  )

  const addTransferExtra = useCallback(
    async (transferId: string, type: string, amount?: number) => {
      try {
        const updated = await resolve(
          ({mutation}) => {
            const result = (mutation as any).addTransferExtra({
              transferId,
              type,
              amount: amount ?? undefined
            })
            return mapTransferRowToResourceTransfer(result)
          },
          {cachePolicy: 'no-store'}
        )

        upsertTransfer(updated)

        toast({
          title: 'Extra added',
          description: 'The extra has been added to the transfer.',
          status: 'success',
          duration: 5000,
          isClosable: true
        })

        return true
      } catch (err) {
        const message =
          err instanceof GQtyError
            ? 'Failed to add extra via the IAM service.'
            : err instanceof Error
              ? err.message
              : 'Failed to add extra.'

        toast({
          title: 'Error',
          description: message,
          status: 'error',
          duration: 5000,
          isClosable: true
        })

        return false
      }
    },
    [toast, upsertTransfer]
  )

  const removeTransferExtra = useCallback(
    async (transferId: string, type: string) => {
      try {
        const updated = await resolve(
          ({mutation}) => {
            const result = (mutation as any).removeTransferExtra({
              transferId,
              type
            })
            return mapTransferRowToResourceTransfer(result)
          },
          {cachePolicy: 'no-store'}
        )

        upsertTransfer(updated)

        toast({
          title: 'Extra removed',
          description: 'The extra has been removed from the transfer.',
          status: 'success',
          duration: 5000,
          isClosable: true
        })

        return true
      } catch (err) {
        const message =
          err instanceof GQtyError
            ? 'Failed to remove extra via the IAM service.'
            : err instanceof Error
              ? err.message
              : 'Failed to remove extra.'

        toast({
          title: 'Error',
          description: message,
          status: 'error',
          duration: 5000,
          isClosable: true
        })

        return false
      }
    },
    [toast, upsertTransfer]
  )

  const terminateTransfer = useCallback(
    async (transferId: string) => {
      try {
        // New schema uses updateTransferState; keep legacy terminateTransfer fallback
        const updated = await (async () => {
          try {
            const legacy = await resolve(
              ({mutation}) => {
                const m: any = mutation as any
                if (typeof m.terminateTransfer === 'function') {
                  const r = m.terminateTransfer({transferId})
                  return mapTransferRowToResourceTransfer(r)
                }
                throw new Error('terminateTransfer mutation not found')
              },
              {cachePolicy: 'no-store'}
            )
            return legacy
          } catch {
            return await updateTransferState(transferId, 'TERMINATED')
          }
        })()

        if (!updated) return false

        toast({
          title: 'Transfer terminated',
          description: 'The transfer has been terminated.',
          status: 'success',
          duration: 5000,
          isClosable: true
        })

        return true
      } catch (err) {
        const message =
          err instanceof GQtyError
            ? 'Failed to terminate transfer via the IAM service.'
            : err instanceof Error
              ? err.message
              : 'Failed to terminate transfer.'

        toast({
          title: 'Error',
          description: message,
          status: 'error',
          duration: 5000,
          isClosable: true
        })

        return false
      }
    },
    [toast, updateTransferState]
  )

  return {
    transfers,
    totalCount: typeof totalCount === 'number' && totalCount > 0 ? totalCount : transfers.length,
    isLoading,
    refetch: fetchTransfers,
    updateTransferState,
    assignDriver,
    assignCar,
    assignPrice,
    completeTransfer,
    createTransfer,
    terminateTransfer,
    addTransferExtra,
    removeTransferExtra
  }
}

// ---------------------------
// useBookings (customer bookings)
// ---------------------------

export const useBookings = (customerId?: string) => {
  const {toast} = useNotificationsContext()
  const [isLoading, setIsLoading] = useState(true)
  const [bookings, setBookings] = useState<ResourceTransfer[]>([])

  const requestIdRef = useRef(0)

  const fetchBookings = useCallback(async () => {
    // If there's no logged-in user, don't call the API
    if (!customerId) {
      setBookings([])
      setIsLoading(false)
      return
    }

    const currentRequestId = ++requestIdRef.current
    setIsLoading(true)

    try {
      const result = await resolve(({query}) => {
        // Use transfers query with customerId filter
        const transferConnection = (query as any).transfers({
          args: {
            customerId: customerId
          }
        })
        const rows = transferConnection?.edges?.map((e: any) => e.node) || []
        return rows.map(mapTransferRowToResourceTransfer)
      })

      if (requestIdRef.current !== currentRequestId) {
        return
      }

      setBookings(result)
    } catch (err) {
      const message =
        err instanceof GQtyError
          ? 'Failed to load bookings from the IAM service.'
          : err instanceof Error
            ? err.message
            : 'Failed to load bookings.'

      toast({
        title: 'Error',
        description: message,
        status: 'error',
        duration: 5000,
        isClosable: true
      })
    } finally {
      if (requestIdRef.current === currentRequestId) {
        setIsLoading(false)
      }
    }
  }, [toast, customerId])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  const upsertBooking = useCallback((next: ResourceTransfer) => {
    setBookings(prev => {
      const idx = prev.findIndex(t => t.id === next.id)
      if (idx === -1) {
        return [...prev, next]
      }
      const copy = prev.slice()
      copy[idx] = {...copy[idx]!, ...next}
      return copy
    })
  }, [])

  const bookTransfer = useCallback(
    async (values: TransferCreateInput): Promise<boolean> => {
      try {
        const created = await resolve(
          ({mutation}) => {
            // Combine rideDateISO and rideTime into pickupDateTime (DateTimeISO format)
            const pickupDateTime = values.rideDateISO && values.rideTime
              ? `${values.rideDateISO}T${values.rideTime}:00`
              : values.rideDateISO
                ? `${values.rideDateISO}T00:00:00`
                : new Date().toISOString()

            const result = (mutation as any).bookTransfer({
              args: {
                pickupDateTime,
                pickupLocation: values.pickup,
                dropoffLocation: values.dropoff,
                subject: values.roomOrName,
                paymentMethode: values.paymentMethode,
                payingParty: values.payingParty,
                details: values.details
                  ? {
                      flightNumber: values.details.flightNumber,
                      message: values.details.message,
                      luggage: values.details.luggage,
                      childSeats: values.details.childSeats,
                      extraTime: values.details.extraTime,
                      preferredCarClass: values.details.preferredCarClass,
                      preferredCarName: values.details.preferredCarName
                    }
                  : undefined
              }
            })
            return mapTransferRowToResourceTransfer(result)
          },
          {
            cachePolicy: 'no-store'
          }
        )

        upsertBooking(created)

        toast({
          title: 'Booking created',
          description: `Your transfer has been booked (ID: ${created.id}).`,
          status: 'success',
          duration: 5000,
          isClosable: true
        })

        return true
      } catch (err) {
        const message =
          err instanceof GQtyError
            ? 'Failed to create booking via the IAM service.'
            : err instanceof Error
              ? err.message
              : 'Failed to create booking.'

        toast({
          title: 'Error',
          description: message,
          status: 'error',
          duration: 5000,
          isClosable: true
        })

        return false
      }
    },
    [toast, upsertBooking]
  )

  const cancelBooking = useCallback(
    async (transferId: string) => {
      try {
        const updated = await resolve(
          ({mutation}) => {
            const result = (mutation as any).updateTransferState({
              transferId,
              state: 'CANCELED'
            })
            return mapTransferRowToResourceTransfer(result)
          },
          {cachePolicy: 'no-store'}
        )

        upsertBooking(updated)

        toast({
          title: 'Booking canceled',
          description: 'Your transfer booking has been canceled.',
          status: 'success',
          duration: 5000,
          isClosable: true
        })

        return true
      } catch (err) {
        const message =
          err instanceof GQtyError
            ? 'Failed to cancel booking via the IAM service.'
            : err instanceof Error
              ? err.message
              : 'Failed to cancel booking.'

        toast({
          title: 'Error',
          description: message,
          status: 'error',
          duration: 5000,
          isClosable: true
        })

        return false
      }
    },
    [toast, upsertBooking]
  )

  return {
    bookings,
    isLoading,
    refetch: fetchBookings,
    bookTransfer,
    cancelBooking
  }
}

// ---------------------------
// useUsersByRole (lightweight – no roles)
// ---------------------------

/**
 * Hook to fetch users filtered by a specific roleKey via the GraphQL query `getUsersByRole`.
 *
 * For this one (used e.g. in the "Assign driver" modal) we **intentionally
 * do not resolve roles** to avoid a ton of project-role subrequests
 * on the Cloudflare Worker.
 */
export const useUsersByRole = (roleKey: string) => {
  const {toast} = useNotificationsContext()
  const [isLoading, setIsLoading] = useState(true)
  const [users, setUsers] = useState<ResourceUser[]>([])

  const fetchUsersByRole = useCallback(async () => {
    if (!roleKey) {
      setUsers([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    try {
      const result = await resolve(({query}) => {
        const userConnection = (query as any).usersByRole({
          args: {
            roleKey
          }
        })
        const iamUsers = userConnection?.edges?.map((e: any) => e.node) || []

        // LIGHT variant: do NOT include roles here => no project-role lookups.
        return iamUsers.map((u: any) =>
          mapIamUserToResourceUser(u, {includeRoles: false, includeDriverColor: true})
        )
      })

      setUsers(result)
    } catch (err) {
      const message =
        err instanceof GQtyError
          ? 'Failed to load users by role from the IAM service.'
          : err instanceof Error
            ? err.message
            : 'Failed to load users by role.'

      toast({
        title: 'Error',
        description: message,
        status: 'error',
        duration: 5000,
        isClosable: true
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast, roleKey])

  useEffect(() => {
    fetchUsersByRole()
  }, [fetchUsersByRole])

  return {
    users,
    isLoading,
    refetch: fetchUsersByRole
  }
}

// ---------------------------
// NEW: Current user helpers (no "me")
// ---------------------------

export const fetchCurrentUser = async () => {
  try {
    const result = await resolve(({query}) => {
      const u: any = (query as any).currentUser()
      void u?.__typename
      return u
    })
    return result
  } catch (err) {
    throw err
  }
}

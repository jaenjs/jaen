/**
 * The customer's bookings: the list, one booking, booking a ride, cancelling.
 *
 * Every read sends no customerId. Who sees what is the resolver's decision,
 * made from the token: a customer gets their own rows, a dispatcher gets all
 * of them, and the same screen renders either answer. A customerId sent from
 * here would be ignored for the customer and would only narrow the admin, so
 * it is left out on purpose. See okf/architecture/permissions.md.
 *
 * Documents are hand written with their arguments inlined, for the reason
 * shared/hooks.ts gives at length: Pylon names its input types after the
 * resolver signature and those names differ between deployments, a literal
 * names nothing. The helper is a copy of the one in hooks.ts, which is not
 * exported and which this file must not edit.
 *
 * The reads are queries of the one client in ./query.ts, `['bookings',
 * args]` per page, `['booking', idOrCode]` per booking, `['bookingDriver',
 * driverId]` per driver on a page, and the two writes invalidate what shows
 * a transfer. See okf/architecture/data-layer.md.
 */
import {useCallback, useMemo} from 'react'
import {keepPreviousData, useQueries} from '@tanstack/react-query'
import {fetchGraphQL} from '../../client/limosen'
import {
  invalidateTransfers,
  keys,
  queryClient,
  useAppQuery,
  usePager,
  useRestored
} from './query'
import {
  hasCarField,
  hasTransferField,
  transferCode,
  transferSlug
} from './transfers'

/**
 * A GraphQL enum member is spelled bare, not quoted, and it is indistinguishable
 * from a string once it is a JavaScript value. Wrapping it says which it is.
 */
export class EnumValue {
  constructor(public readonly name: string) {}
}

const literal = (value: unknown): string => {
  if (value instanceof EnumValue) return value.name
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  // NaN is what an empty number input reads as, and it is not a value.
  if (typeof value === 'number')
    return Number.isFinite(value) ? String(value) : 'null'
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

/**
 * One root field, with its arguments written into the document.
 *
 * An error is thrown only when the field itself has no answer. An error on a
 * nested nullable field, the driver's profile say, comes back beside the data
 * and the row is still a row: a customer who may not read the driver's
 * account still sees their booking, without the name.
 */
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

  const data = result?.data?.[field]

  if ((data === undefined || data === null) && result?.errors?.length) {
    const first = result.errors[0]
    const code = first?.extensions?.code
    const message = String(first?.message || 'GraphQL error')
    const err = new Error(message) as Error & {code?: string}
    if (typeof code === 'string') err.code = code
    throw err
  }

  return data
}

// --------------- Types ---------------

export const PAYMENT_METHODS = ['CASH', 'CARD', 'VOUCHER', 'INVOICE'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/** The states from which a customer may still withdraw, the backend's CUSTOMER_CANCELABLE_FROM. */
export const CANCELABLE_STATES = ['PENDING', 'ASSIGNED'] as const

export interface Booking {
  /** `transfer:<uuid>`, for the API. Never shown, see hard-rules.md. */
  id: string
  /**
   * What the customer reads and quotes on the phone: `BQ7Q4W-1`, the same
   * stem with `-2` for the return, minted by the pylon. The stripped id is the
   * fallback only while the deployed schema has no `code`.
   */
  code: string
  customerId: string
  driverId?: string
  driverName?: string
  state: string
  /** The money side, NEW to PAID or DECLINED, shown to the customer in words. Undefined on a schema without it. */
  customerStatus?: string
  /** The booking's language, de | en | tr | ar. */
  language?: string
  pickup: string
  dropoff: string
  /** Zimmer/Name, what the hotel wrote on the booking. */
  subject?: string
  pickupAtISO: string
  rideDateISO: string
  rideTime: string
  requestedAtISO?: string
  /** Null for a driver caller, the backend resolves it that way. */
  price?: number | null
  paymentMethode?: string | null
  payingParty?: string | null
  transferCategory?: string
  transferType?: string
  car?: {
    name?: string
    licensePlate?: string
    carClass?: string
    /** The car's paint, #RRGGBB, for the colour dot on the customer's card. */
    color?: string
    /**
     * The car's picture. The pylon answers it to a customer only once the
     * driver said yes (okf/architecture/media.md), so a picture on the row
     * is itself the sign that the ride is confirmed.
     */
    imageUrl?: string
    imageThumbUrl?: string
  }
  /** The driver's answer, NONE to WITHDRAWN. Undefined on a schema without it. */
  driverStatus?: string
  details?: {
    flightNumber?: string
    message?: string
    luggage?: string
    childSeats?: string
  }
  passengerCount?: number
  extras: Array<{type: string; amount: number}>
}

export interface BookingPage {
  hasNextPage: boolean
  hasPreviousPage: boolean
  endCursor: string | null
  totalCount: number
  currentPage: number
  totalPages: number
}

const pad2 = (n: number) => String(n).padStart(2, '0')

const text = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim().length ? v : undefined

/**
 * The driver's name as the profile spells it, or nothing. `driver` is a
 * nested read against the identity facade and may be refused for a customer
 * token, in which case it is null and the row simply has no name.
 */
const nameOf = (user: any): string | undefined => {
  const profile = user?.profiles?.edges?.[0]?.node
  const full = [profile?.firstName, profile?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim()
  return full || text(profile?.displayName) || undefined
}

export const mapBooking = (t: any): Booking => {
  let rideDateISO = ''
  let rideTime = ''
  let pickupAtISO = ''
  if (t?.pickupDateTime) {
    const d = new Date(t.pickupDateTime)
    if (!Number.isNaN(d.getTime())) {
      pickupAtISO = d.toISOString()
      rideDateISO = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
      rideTime = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
    }
  }

  const id = String(t?.id ?? '')
  const details = t?.details
  const car = t?.car

  return {
    id,
    code: text(t?.code) ?? transferCode(id, text(t?.referenceId)),
    customerId: String(t?.customerId ?? ''),
    driverId: text(t?.driverId),
    driverName: nameOf(t?.driver),
    state: String(t?.state ?? 'PENDING'),
    customerStatus: text(t?.customerStatus),
    language: text(t?.language),
    pickup: String(t?.pickupLocation ?? ''),
    dropoff: String(t?.dropoffLocation ?? ''),
    subject: text(t?.subject),
    pickupAtISO,
    rideDateISO,
    rideTime,
    requestedAtISO: t?.requestedAt
      ? new Date(t.requestedAt).toISOString()
      : undefined,
    price: typeof t?.price === 'number' ? t.price : null,
    paymentMethode: text(t?.paymentMethode) ?? null,
    payingParty: text(t?.payingParty) ?? null,
    transferCategory: text(t?.transferCategory),
    transferType: text(t?.transferType),
    car: car
      ? {
          name: text(car.carName),
          licensePlate: text(car.licensePlate),
          carClass: text(car.carClass),
          color: text(car.color),
          imageUrl: text(car.imageUrl),
          imageThumbUrl: text(car.imageThumbUrl)
        }
      : undefined,
    driverStatus: text(t?.driverStatus),
    details: details
      ? {
          flightNumber: text(details.flightNumber),
          message: text(details.message),
          luggage: text(details.luggage),
          childSeats: text(details.childSeats)
        }
      : undefined,
    passengerCount:
      typeof t?.passengers?.totalCount === 'number' &&
      t.passengers.totalCount > 0
        ? t.passengers.totalCount
        : undefined,
    extras: Array.isArray(t?.extras?.edges)
      ? t.extras.edges
          .map((e: any) => e?.node)
          .filter(Boolean)
          .map((n: any) => ({
            type: String(n.type ?? ''),
            amount: Number(n.amount ?? 1)
          }))
      : []
  }
}

/**
 * What a booking screen reads of a transfer. One selection for the list, the
 * detail and the two writes. `code` is asked for when the deployed schema
 * carries it, so a site built ahead of its pylon still lists the bookings.
 */
const bookingSelection = async (): Promise<string> =>
  `{ id ${(await hasTransferField('code')) ? 'code ' : ''}${(await hasTransferField('customerStatus')) ? 'customerStatus language ' : ''}customerId driverId pickupDateTime pickupLocation dropoffLocation subject state requestedAt ` +
  `referenceId price paymentMethode payingParty transferCategory transferType ` +
  `${(await hasTransferField('driverStatus')) ? 'driverStatus ' : ''}` +
  `car { carName licensePlate carClass color${(await hasCarField('imageThumbUrl')) ? ' imageUrl imageThumbUrl' : ''} } ` +
  `details { flightNumber message luggage childSeats } ` +
  `passengers { totalCount } ` +
  `extras { edges { node { type amount } } } ` +
  `driver { ... on HumanUser { profiles { edges { node { firstName lastName displayName } } } } } }`

/** The path segment of a booking's link: the code, the pylon resolves it. */
export const bookingPath = (b: {id: string; code: string}): string =>
  `/booking/${transferSlug(b)}`

// --------------- The list ---------------

const DEFAULT_PAGE_SIZE = 15

/**
 * The caller's bookings, newest pickup first. That is the backend's own
 * order, pickupDateTime descending, so the first page is the next ride and
 * the pages behind it are the past. Cursor pagination, one page in memory.
 */
interface BookingsPage {
  rows: Booking[]
  endCursor: string | null
  hasNextPage: boolean
  totalCount: number
}

const EMPTY_BOOKINGS: Booking[] = []

const readBookingsPage = async (args: {
  first: number
  after?: string
}): Promise<BookingsPage> => {
  const listArgs: Record<string, unknown> = {first: args.first}
  if (args.after) listArgs.after = args.after

  const result = await gql(
    'transfers',
    {args: listArgs},
    `{ totalCount pageInfo { endCursor hasNextPage } edges { node ${await bookingSelection()} } }`
  )

  const edges: any[] = Array.isArray(result?.edges) ? result.edges : []
  return {
    rows: edges
      .map(e => e?.node)
      .filter(Boolean)
      .map(mapBooking),
    endCursor: result?.pageInfo?.endCursor ?? null,
    hasNextPage: !!result?.pageInfo?.hasNextPage,
    totalCount: typeof result?.totalCount === 'number' ? result.totalCount : 0
  }
}

export function useBookings(pageSize = DEFAULT_PAGE_SIZE) {
  // The size is the pager's: the reader's choice for this table, remembered
  // beside its column layout, `pageSize` the default until somebody chooses.
  const pager = usePager('bookings', {
    tableId: 'bookings',
    defaultSize: pageSize
  })
  const size = pager.pageSize
  const args = useMemo(
    () => ({first: size, after: pager.after}),
    [size, pager.after]
  )

  const {
    query: q,
    isLoading,
    error,
    refetch
  } = useAppQuery({
    queryKey: keys.bookings(args),
    queryFn: () => readBookingsPage(args),
    placeholderData: keepPreviousData
  })

  const current = q.data
  const bookings = current?.rows ?? EMPTY_BOOKINGS
  const page = useMemo<BookingPage>(() => {
    const totalCount = current?.totalCount ?? 0
    return {
      hasNextPage: !!current?.hasNextPage,
      hasPreviousPage: pager.page > 1,
      endCursor: current?.endCursor ?? null,
      totalCount,
      currentPage: pager.page,
      totalPages: Math.max(1, Math.ceil(totalCount / size))
    }
  }, [current, pager.page, size])

  const nextPage = useCallback(() => {
    if (current?.hasNextPage && current.endCursor) pager.next(current.endCursor)
  }, [current, pager])
  const prevPage = pager.prev

  return {
    bookings,
    isLoading,
    error,
    page,
    pageSize: size,
    setPageSize: pager.setPageSize,
    nextPage,
    prevPage,
    refetch
  }
}

// --------------- One booking ---------------

/**
 * One booking by id or by code.
 *
 * `transfer(transferId)` takes either and answers within the caller's scope.
 * A deployment that does not know the root field, which no brand has run
 * since 1.0.0, answers with a validation error and the list is walked
 * instead, page by page within the caller's scope, matching id or code.
 */
export async function fetchBooking(
  transferId: string
): Promise<Booking | null> {
  const selection = await bookingSelection()
  try {
    const node = await gql('transfer', {transferId}, selection)
    if (node) return mapBooking(node)
    return null
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (!/Cannot query field "transfer"/.test(message)) throw err
  }

  let after: string | undefined
  for (let i = 0; i < 10; i++) {
    const args: Record<string, unknown> = {first: 100}
    if (after) args.after = after
    const result = await gql(
      'transfers',
      {args},
      `{ pageInfo { endCursor hasNextPage } edges { node ${selection} } }`
    )
    const edges: any[] = Array.isArray(result?.edges) ? result.edges : []
    const hit = edges
      .map(e => e?.node)
      .find(n => n?.id === transferId || n?.code === transferId)
    if (hit) return mapBooking(hit)
    if (!result?.pageInfo?.hasNextPage || !result?.pageInfo?.endCursor) break
    after = result.pageInfo.endCursor
  }
  return null
}

/** A booking as a screen or a write answered it, into every detail that shows it. */
const rememberBooking = (booking: Booking) => {
  queryClient.setQueriesData<Booking | null>({queryKey: ['booking']}, held =>
    held && held.id === booking.id ? booking : held
  )
}

export function useBooking(transferId: string) {
  const {
    query: q,
    isLoading,
    error,
    isFetching,
    refetch
  } = useAppQuery({
    queryKey: keys.booking(transferId),
    queryFn: () => fetchBooking(transferId),
    enabled: !!transferId
  })

  const setBooking = useCallback(
    (booking: Booking | null) => {
      if (booking) rememberBooking(booking)
      queryClient.setQueryData<Booking | null>(
        keys.booking(transferId),
        booking
      )
    },
    [transferId]
  )

  return {
    booking: q.data ?? null,
    isLoading,
    error,
    isFetching,
    refetch,
    setBooking
  }
}

// --------------- Booking a ride ---------------

export interface BookRideInput {
  /** YYYY-MM-DD, as the date input gives it. */
  date: string
  /** HH:MM, as the time input gives it. */
  time: string
  pickup: string
  dropoff: string
  /** Zimmer/Name. */
  subject?: string
  paymentMethode?: PaymentMethod | ''
  passengers?: number
  luggage?: number
  childSeats?: number
  flightNumber?: string
  wishes?: string
  /** The language the passenger reads, for the messages the backend sends. */
  language?: string
}

/**
 * The date and time the person typed are in their own clock. The backend
 * stores one instant, so the two are combined in the browser's zone and sent
 * as UTC: a pickup typed as 10:00 in Vienna is 08:00Z in the row and reads
 * back as 10:00 on every screen in Vienna. Sending the bare local string
 * would have the Worker, whose clock is UTC, read it as 10:00Z.
 */
export const toPickupInstant = (date: string, time: string): string | null => {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  if (!y || !m || !d || hh === undefined || mm === undefined) return null
  const at = new Date(y, m - 1, d, hh, mm, 0, 0)
  return Number.isNaN(at.getTime()) ? null : at.toISOString()
}

const count = (n: number | undefined): string | undefined =>
  typeof n === 'number' && Number.isFinite(n) && n > 0
    ? String(Math.floor(n))
    : undefined

/**
 * bookTransfer, so the booking belongs to the caller: the resolver takes the
 * owner from the token and never from an argument. An admin books the same
 * way and owns the row themselves.
 *
 * How many people are coming has no column of its own. The backend keeps a
 * Passenger row per person, and `passengers { totalCount }` is what the
 * driver's screen reads as the head count, so that many rows are created,
 * nameless. INTEGRATOR: a passengerCount on TransferDetails would make this
 * one number instead of n rows.
 */
export async function bookRide(input: BookRideInput): Promise<Booking> {
  const pickupDateTime = toPickupInstant(input.date, input.time)
  if (!pickupDateTime) throw new Error('Invalid pickup date or time')

  const people = Math.min(Math.max(Math.floor(input.passengers ?? 0), 0), 50)
  const passengers =
    people > 0
      ? Array.from({length: people}, () => ({
          language: input.language || undefined
        }))
      : undefined

  const details = {
    flightNumber: text(input.flightNumber),
    message: text(input.wishes),
    luggage: count(input.luggage),
    childSeats: count(input.childSeats)
  }

  const args: Record<string, unknown> = {
    pickupDateTime,
    pickupLocation: input.pickup.trim(),
    dropoffLocation: input.dropoff.trim(),
    subject: text(input.subject),
    paymentMethode: input.paymentMethode || undefined,
    passengers,
    details: Object.values(details).some(v => v !== undefined)
      ? details
      : undefined
  }

  const result = await gql(
    'bookTransfer',
    {args},
    await bookingSelection(),
    'mutation'
  )
  void invalidateTransfers()
  return mapBooking(result)
}

/**
 * The customer's one transition: CANCELED, while the ride is PENDING or
 * ASSIGNED. Anything later is FORBIDDEN from the backend and the screen does
 * not offer the button, see CANCELABLE_STATES.
 */
export async function cancelBooking(transferId: string): Promise<Booking> {
  const result = await gql(
    'updateTransferState',
    {transferId, state: new EnumValue('CANCELED')},
    await bookingSelection(),
    'mutation'
  )
  const booking = mapBooking(result)
  rememberBooking(booking)
  void invalidateTransfers()
  return booking
}

export const isCancelable = (state: string | undefined): boolean =>
  (CANCELABLE_STATES as readonly string[]).includes(
    String(state ?? '').toUpperCase()
  )

// --------------- The drivers on the list ---------------

export interface BookingDriver {
  name?: string
  /** #RRGGBB, undefined for the silver default and for a driver the caller may not read. */
  color?: string
}

/** The silver the schema defaults DriverData.color to, which every screen draws as "no colour". */
const SILVER = '#C0C0C0'

/**
 * The driver of one booking as `transferTracking` tells it: name and colour,
 * for the dispatcher, the ride's customer and its driver alike. getDriverColor
 * is an admin's and a driver's field, so this is the one read a customer has
 * for the colour of the person picking them up. A refusal or a schema without
 * the field answers an empty driver, and the row keeps the name it already has.
 */
const readBookingDriver = async (
  transferId: string
): Promise<BookingDriver> => {
  try {
    const node = await gql(
      'transferTracking',
      {args: {transferId}},
      '{ driver { id name color } }'
    )
    const driver = node?.driver
    const color = text(driver?.color)
    return {
      name: text(driver?.name),
      color: color && color.toUpperCase() !== SILVER ? color : undefined
    }
  } catch {
    return {}
  }
}

const NO_DRIVERS: Record<string, BookingDriver> = {}

/**
 * The drivers of the rows on the page, by user id. Each driver is one query
 * `['bookingDriver', driverId]` of the client, read through the first row
 * that names them, and a driver already known from an earlier page costs
 * nothing. The record is only rebuilt when an answer changes.
 */
export function useBookingDrivers(
  rows: Array<{id: string; driverId?: string}>
): Record<string, BookingDriver> {
  const restored = useRestored()

  // One row per driver, the first one on the page. The key is the driver ids,
  // so a page with the same drivers in a different order asks nothing.
  const firstRows = new Map<string, string>()
  rows.forEach(r => {
    if (r.driverId && !firstRows.has(r.driverId))
      firstRows.set(r.driverId, r.id)
  })
  const pairs = useMemo(
    () => [...firstRows.entries()].sort(([a], [b]) => a.localeCompare(b)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [[...firstRows.entries()].map(([d, t]) => `${d}=${t}`).join('|')]
  )

  return useQueries(
    {
      queries: pairs.map(([driverId, transferId]) => ({
        queryKey: keys.bookingDriver(driverId),
        queryFn: () => readBookingDriver(transferId),
        enabled: restored
      })),
      combine: results => {
        const out: Record<string, BookingDriver> = {}
        results.forEach((r, i) => {
          const driverId = pairs[i]?.[0]
          if (driverId && r.data) out[driverId] = r.data
        })
        return Object.keys(out).length ? out : NO_DRIVERS
      }
    },
    queryClient
  )
}

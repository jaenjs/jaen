/**
 * Transfers, as the screens read and write them.
 *
 * Reads are scoped by the backend: a driver gets their own rows with the money
 * fields resolved to null, a customer their own bookings, an admin everything.
 * Nothing here sends a driverId or customerId on a driver's or customer's
 * behalf, because a filter the caller supplies is a preference and never a
 * permission (okf/decisions/hard-rules.md). The list hook takes only what an
 * admin's board needs: dates, one state, the cursor.
 *
 * Every document is built with its arguments written into the document as
 * literals, never as typed variables. Pylon derives input type names from the
 * resolver signature and the two brands have run different builds, so a
 * document naming `TransfersArgsInput` is refused by the other one. The helper
 * below is the same shape as the one in ../hooks.ts, which is not exported.
 * INTEGRATOR: export `query` (and EnumValue) from shared/hooks.ts and delete
 * the copy here, or keep both until hooks.ts is retired.
 *
 * The reads are queries of the one client in ./query.ts: `['transfers',
 * args]` per page of a list and `['transfer', idOrCode]` per ride. A screen
 * that mounts renders what the client holds and refetches behind it, a
 * mutation swaps its answer into every page and every detail that shows the
 * row and invalidates the lists, and a reload offline renders the persisted
 * answer. The hooks keep their names and shapes, see
 * okf/architecture/data-layer.md.
 */
import {useCallback, useMemo} from 'react'
import {keepPreviousData} from '@tanstack/react-query'
import {fetchGraphQL} from '../../client/limosen'
import {appError, sentenceFor} from '../errors'
import {
  asTransferState,
  TRANSFER_STATES,
  type TransferState
} from '../locales/i18nStates'
import {
  cachedRead,
  invalidateTransfers,
  keys,
  queryClient,
  useAppQuery,
  usePager
} from './query'

// --------------- The document builder ---------------

/** A GraphQL enum member is spelled bare. Wrapping it says so. */
export class EnumValue {
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

/**
 * The error a resolver answered with: the reader's sentence as its message,
 * the extension code so a screen can tell FORBIDDEN from AUTH_REQUIRED, and
 * the backend's own words as `detail` for the console and for the checks that
 * branch on how the schema worded a failure (design-consistency.md rule 14,
 * shared/errors.ts). Nothing draws `detail`.
 */
export class GraphQLRequestError extends Error {
  readonly detail: string

  constructor(
    detail: string,
    public readonly code?: string
  ) {
    super(sentenceFor(code, detail))
    this.name = 'GraphQLRequestError'
    this.detail = detail
  }
}

const gql = async (
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
    const first = result.errors[0]
    throw new GraphQLRequestError(
      String(first?.message || 'GraphQL error'),
      typeof first?.extensions?.code === 'string'
        ? first.extensions.code
        : undefined
    )
  }

  return result?.data?.[field]
}

// --------------- The enums, as the schema spells them ---------------

export const PAYMENT_METHODS = ['CASH', 'CARD', 'VOUCHER', 'INVOICE'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYING_PARTIES = ['CUSTOMER', 'PASSENGER'] as const
export type PayingParty = (typeof PAYING_PARTIES)[number]

export const CAR_CLASSES = [
  'BUSINESS_CLASS',
  'ELECTRIC_CLASS',
  'FIRST_CLASS',
  'BUSINESS_VAN'
] as const
export type CarClass = (typeof CAR_CLASSES)[number]

export const TRANSFER_CATEGORIES = ['DISTANCE', 'HOURLY', 'FLATRATE'] as const
export type TransferCategory = (typeof TRANSFER_CATEGORIES)[number]

export const TRANSFER_TYPES = ['ONE_WAY', 'RETURN_TRIP'] as const
export type TransferType = (typeof TRANSFER_TYPES)[number]

/** The extras catalogue, prisma enum ExtraType. */
export const EXTRA_TYPES = [
  'CHILD_SEAT',
  'BOOSTER_SEAT',
  'EXTRA_LUGGAGE',
  'WAITING_TIME',
  'MEET_AND_GREET',
  'WATER_BOTTLE',
  'WHEELCHAIR',
  'PET_TRANSPORT'
] as const
export type ExtraType = (typeof EXTRA_TYPES)[number]

/**
 * The driver's slice of the state machine, forward only, one stop at a time.
 * The same table as DRIVER_TRANSITIONS in pylon/src/fleet/transfer/services.ts,
 * so the slider offers exactly what the resolver accepts. The two exits,
 * REJECTED and NO_SHOW, are buttons and not stops, see dispatch.md 8a.
 */
export const DRIVER_STOPS: readonly TransferState[] = [
  'ASSIGNED',
  'ON_THE_WAY',
  'AT_PICKUP',
  'ONGOING',
  'COMPLETED'
]

/**
 * The one exit that is a state. The driver's way out of ASSIGNED is not a
 * state any more: it is declineAssignment, and REJECTED is never written
 * (dispatch.md section 9), so the ride screen offers the decline itself.
 */
export const DRIVER_EXITS: Partial<Record<TransferState, TransferState>> = {
  AT_PICKUP: 'NO_SHOW'
}

// --------------- The driver's answer ---------------

/**
 * The driver's answer beside the ride state, Transfer.driverStatus. NONE
 * until somebody is asked, REQUESTED while the request is open, ACCEPTED
 * from the yes on (the ride is ASSIGNED then), DECLINED after a no (the
 * driver is taken off the row), WITHDRAWN after the dispatcher took the
 * ride back. Undefined on a row from a schema without the column.
 */
export const DRIVER_STATUSES = [
  'NONE',
  'REQUESTED',
  'ACCEPTED',
  'DECLINED',
  'WITHDRAWN'
] as const
export type DriverStatus = (typeof DRIVER_STATUSES)[number]

export const asDriverStatus = (value: unknown): DriverStatus | undefined =>
  DRIVER_STATUSES.includes(value as DriverStatus)
    ? (value as DriverStatus)
    : undefined

/** One request to one driver for one ride, as the dispatcher reads it. */
export interface AssignmentAttempt {
  id: string
  driverId: string
  requestedAt: string
  answeredAt?: string
  /** Undefined while the request is open. */
  answer?: DriverStatus
  reason?: string
  /** The dispatcher who asked, undefined on a migrated row. */
  by?: string
  /**
   * Who wrote the answer when that was not the driver: the admin who took the
   * yes on the phone (dispatch.md section 9a). Undefined when the driver
   * answered for themselves and on every row older than the column.
   */
  answeredBy?: string
}

/** The index of a state on the slider, or -1 when the driver cannot move it. */
export const driverStopIndex = (state: string | undefined): number =>
  DRIVER_STOPS.indexOf(asTransferState(state) as TransferState)

/** A ride the driver is still moving, or has just finished. */
export const isDriverStage = (state: string | undefined): boolean =>
  driverStopIndex(state) >= 0

/** States a transfer is over in, one way or another. */
export const CLOSED_STATES: readonly TransferState[] = [
  'COMPLETED',
  'CANCELED',
  'TERMINATED',
  'REJECTED',
  'ABORTED',
  'NO_SHOW',
  'FAILED'
]

export const isClosed = (state: string | undefined): boolean =>
  CLOSED_STATES.includes(asTransferState(state) as TransferState)

// --------------- The row ---------------

export interface TransferPassenger {
  id: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  language?: string
}

/**
 * The account a ride belongs to, as the detail read resolves it through the
 * pylon's `customer` field, dispatch.md section 13. It is the booker of the
 * people card: a hotel front desk, a company, a person who booked for
 * themselves, or the brand's own website account.
 *
 * The pylon answers it to an admin for any ride and to a customer for their
 * own (`Transfer.customer`), and answers null when the directory does not
 * hold the id, which is what every booklimo website booking written before
 * 2026-09-06 looks like. So undefined here is "not asked for or not
 * answered", never "there is no customer".
 */
export interface TransferCustomer {
  id: string
  /**
   * A machine account, which is what the brand's website books on. Nobody is
   * reachable there, see components/BookedBy.tsx for what the card does with
   * it.
   */
  isMachine: boolean
  name?: string
  email?: string
  phone?: string
}

export interface TransferExtra {
  type: string
  amount: number
}

export interface TransferCar {
  id: string
  carName?: string
  licensePlate?: string
  color?: string
  carClass?: string
}

export interface TransferDetails {
  flightNumber?: string
  message?: string
  luggage?: string
  childSeats?: string
  extraTime?: string
  preferredCarClass?: string
  preferredCarName?: string
}

/** A ride this one is linked to, by the two identifiers a link needs. */
export interface TransferRef {
  id: string
  code: string
}

export interface TransferRow {
  /** `transfer:<uuid>`, the key machines use. Never shown, see hard-rules.md. */
  id: string
  /**
   * What a person calls it: `BQ7Q4W-1`, minted by the pylon, the same stem with
   * `-2` for the return trip. Falls back to the stripped id only while the
   * deployed schema has no `code` yet, see transferCode.
   */
  code: string
  customerId: string
  driverId?: string
  carId?: string
  referenceId?: string
  /** The origin this ride returns from, when the detail read asked for it. */
  reference?: TransferRef
  /**
   * The rides that return from this one, when the detail read asked for it.
   * Undefined on a list row, an empty array on a ride without a return.
   */
  returns?: TransferRef[]
  state: string
  /** The planned pickup, ISO, as the backend holds it. */
  pickupDateTime: string
  /** Local calendar day, YYYY-MM-DD, for grouping and the date chips. */
  rideDateISO: string
  /** Local wall clock, HH:mm. */
  rideTime: string
  requestedAt?: string
  startDateTime?: string
  endDateTime?: string
  pickup: string
  dropoff: string
  /**
   * The address of the request as the pylon worked it out (dispatch.md
   * section 14.2). `pickup` and `dropoff` above stay what the dispatcher
   * typed; these are the canonical address, the coordinates every map reads
   * instead of geocoding again, and how it got there: `resolution` is
   * RESOLVED, GUESSED or UNRESOLVED, `resolvedBy` is GEOCODER, MODEL or
   * DISPATCHER. Undefined on a schema from before the columns and in the
   * seconds between the booking and the resolution.
   */
  pickupAddress?: string
  pickupLat?: number | null
  pickupLng?: number | null
  pickupResolution?: string
  pickupResolvedBy?: string
  dropoffAddress?: string
  dropoffLat?: number | null
  dropoffLng?: number | null
  dropoffResolution?: string
  dropoffResolvedBy?: string
  addressesResolvedAt?: string
  subject?: string
  /** null for a driver caller, the backend strips it. */
  price: number | null
  paymentMethode: string | null
  payingParty: string | null
  transferCategory?: string
  transferType?: string
  details?: TransferDetails
  passengers: TransferPassenger[]
  extras: TransferExtra[]
  car?: TransferCar
  /**
   * The account that booked, when the read asked for it. The detail read
   * does, a page of the list does not: `customer` is one call into the
   * directory per row and a board of twenty five rows is not the place for
   * twenty five of them.
   */
  customer?: TransferCustomer
  /**
   * The money side beside the ride state: NEW, OFFERED, CONFIRMED,
   * INVOICED, PAID, DECLINED, written only by the pylon. Undefined on a
   * schema from before the column, see hooks/offers.ts.
   */
  customerStatus?: string
  /** The booking's language, de | en | tr | ar, the one every document and mail uses. */
  language?: string
  /** The instants of the customer status, one per state reached, when the schema carries them. */
  offeredAt?: string
  /** The "gültig bis" of the offer mail, ISO, what expireOffers declines past. */
  offerValidUntil?: string
  confirmedAt?: string
  declinedAt?: string
  invoicedAt?: string
  paidAt?: string
  /**
   * Who wrote the customer's yes or no, when that was not the customer: the
   * dispatcher who took it on the telephone (dispatch.md section 14.1). A
   * Zitadel id, undefined where the customer answered through their own link
   * and on a schema from before the columns.
   */
  confirmedBy?: string
  declinedBy?: string
  /**
   * The cash the driver was handed on this ride (dispatch.md section 14.3):
   * the amount, the instant it was recorded and the Zitadel id of whoever
   * recorded it, the driver or the admin who corrected it. Money, so a driver
   * reads them on their own started ride only and everybody else's answer is
   * null, the same rule the fare follows.
   */
  cashReceivedAmount?: number | null
  cashReceivedAt?: string
  cashReceivedBy?: string
  /** The driver's answer, undefined on a schema without it. */
  driverStatus?: DriverStatus
  /**
   * The newest request while REQUESTED or DECLINED, for the board's driver
   * cell (the declined driver and the reason). Admin reads only.
   */
  lastAttempt?: AssignmentAttempt
  /**
   * Every request for this ride, newest first, when the detail read asked
   * for it. Undefined on a list row, an empty array on a ride nobody was
   * asked for. Admin reads only.
   */
  attempts?: AssignmentAttempt[]
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** A coordinate as the backend answered it, null for anything that is not one. */
const coord = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.length ? v : undefined

/**
 * The fallback for a row the API answered without a `code`: the origin's id
 * for a return trip, otherwise its own, prefixes dropped. Only a schema older
 * than the code column takes this path, every deployed row carries a code.
 */
export const transferCode = (id: string, referenceId?: string): string =>
  (referenceId || id).replace(/^transfer:/, '').replace(/^legacy:/, '#')

/** A code the pylon minted: six characters of the alphabet, a hyphen, the leg. */
export const MINTED_CODE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}-\d+$/

/**
 * The path segment a link to this ride uses. The pylon resolves `transfer`
 * by id or by code, and links written from now on carry the code. A legacy
 * row's code is `#<n>`, which a URL would read as a fragment, so that row is
 * linked by its id, `legacy:<n>`, which is no uuid either.
 */
export const transferSlug = (row: {id: string; code: string}): string =>
  MINTED_CODE.test(row.code) ? row.code : row.id

export const transferPath = (row: {id: string; code: string}): string =>
  `/transfers/${transferSlug(row)}`

const mapAttempt = (node: any): AssignmentAttempt | undefined => {
  const id = str(node?.id)
  const driverId = str(node?.driverId)
  if (!id || !driverId) return undefined
  return {
    id,
    driverId,
    requestedAt: str(node?.requestedAt) ?? '',
    answeredAt: str(node?.answeredAt),
    answer: asDriverStatus(node?.answer),
    reason: str(node?.reason),
    by: str(node?.by),
    answeredBy: str(node?.answeredBy)
  }
}

const ref = (node: any): TransferRef | undefined => {
  const id = str(node?.id)
  if (!id) return undefined
  return {id, code: str(node?.code) ?? transferCode(id, str(node?.referenceId))}
}

/** An address, as opposed to a login name that only looks like one. */
const ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * The account behind a ride, from the `customer` node of the detail read.
 *
 * A human account carries a profile and that is where the name, the address
 * and the number are. A machine account carries none: its `preferredLoginName`
 * is a login name, `website` on booklimo, and it is read as an address only
 * when it is one, so the card never offers a mailto that goes nowhere.
 */
const mapCustomer = (node: any): TransferCustomer | undefined => {
  const id = str(node?.id)
  if (!id) return undefined
  const profile = node?.profiles?.edges?.[0]?.node
  const login = str(node?.preferredLoginName) ?? str(node?.userName)
  const name =
    [str(profile?.firstName), str(profile?.lastName)]
      .filter(Boolean)
      .join(' ') ||
    str(profile?.displayName) ||
    login
  const email =
    str(profile?.email) ?? (login && ADDRESS.test(login) ? login : undefined)
  return {
    id,
    isMachine: str(node?.__typename) === 'MachineUser',
    name,
    email,
    phone: str(profile?.phone)
  }
}

export const mapTransfer = (node: any): TransferRow => {
  const pickupDateTime = str(node?.pickupDateTime) ?? ''
  let rideDateISO = ''
  let rideTime = ''
  if (pickupDateTime) {
    const d = new Date(pickupDateTime)
    if (!Number.isNaN(d.getTime())) {
      rideDateISO = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
      rideTime = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
    }
  }

  const details = node?.details
  const id = String(node?.id ?? '')
  const referenceId = str(node?.referenceId)

  return {
    id,
    code: str(node?.code) ?? transferCode(id, referenceId),
    customerId: String(node?.customerId ?? ''),
    driverId: str(node?.driverId),
    carId: str(node?.carId),
    referenceId,
    reference: ref(node?.reference),
    returns: Array.isArray(node?.referencedBy?.edges)
      ? node.referencedBy.edges.map((e: any) => ref(e?.node)).filter(Boolean)
      : undefined,
    state: str(node?.state) ?? 'PENDING',
    pickupDateTime,
    rideDateISO,
    rideTime,
    requestedAt: str(node?.requestedAt),
    startDateTime: str(node?.startDateTime),
    endDateTime: str(node?.endDateTime),
    pickup: String(node?.pickupLocation ?? ''),
    dropoff: String(node?.dropoffLocation ?? ''),
    pickupAddress: str(node?.pickupAddress),
    pickupLat: coord(node?.pickupLat),
    pickupLng: coord(node?.pickupLng),
    pickupResolution: str(node?.pickupResolution),
    pickupResolvedBy: str(node?.pickupResolvedBy),
    dropoffAddress: str(node?.dropoffAddress),
    dropoffLat: coord(node?.dropoffLat),
    dropoffLng: coord(node?.dropoffLng),
    dropoffResolution: str(node?.dropoffResolution),
    dropoffResolvedBy: str(node?.dropoffResolvedBy),
    addressesResolvedAt: str(node?.addressesResolvedAt),
    subject: str(node?.subject),
    price: typeof node?.price === 'number' ? node.price : null,
    paymentMethode: str(node?.paymentMethode) ?? null,
    payingParty: str(node?.payingParty) ?? null,
    transferCategory: str(node?.transferCategory),
    transferType: str(node?.transferType),
    details: details
      ? {
          flightNumber: str(details.flightNumber),
          message: str(details.message),
          luggage: str(details.luggage),
          childSeats: str(details.childSeats),
          extraTime: str(details.extraTime),
          preferredCarClass: str(details.preferredCarClass),
          preferredCarName: str(details.preferredCarName)
        }
      : undefined,
    passengers: (Array.isArray(node?.passengers?.edges)
      ? node.passengers.edges
      : []
    )
      .map((e: any) => e?.node)
      .filter(Boolean)
      .map((p: any) => ({
        id: String(p.id ?? ''),
        firstName: str(p.firstName),
        lastName: str(p.lastName),
        email: str(p.email),
        phone: str(p.phone),
        language: str(p.language)
      })),
    extras: (Array.isArray(node?.extras?.edges) ? node.extras.edges : [])
      .map((e: any) => e?.node)
      .filter(Boolean)
      .map((x: any) => ({
        type: String(x.type ?? ''),
        amount: typeof x.amount === 'number' ? x.amount : 1
      })),
    car: node?.car
      ? {
          id: String(node.car.id ?? ''),
          carName: str(node.car.carName),
          licensePlate: str(node.car.licensePlate),
          color: str(node.car.color),
          carClass: str(node.car.carClass)
        }
      : undefined,
    customer: mapCustomer(node?.customer),
    customerStatus: str(node?.customerStatus),
    language: str(node?.language),
    offeredAt: str(node?.offeredAt),
    offerValidUntil: str(node?.offerValidUntil),
    confirmedAt: str(node?.confirmedAt),
    declinedAt: str(node?.declinedAt),
    invoicedAt: str(node?.invoicedAt),
    paidAt: str(node?.paidAt),
    confirmedBy: str(node?.confirmedBy),
    declinedBy: str(node?.declinedBy),
    cashReceivedAmount:
      typeof node?.cashReceivedAmount === 'number'
        ? node.cashReceivedAmount
        : null,
    cashReceivedAt: str(node?.cashReceivedAt),
    cashReceivedBy: str(node?.cashReceivedBy),
    driverStatus: asDriverStatus(node?.driverStatus),
    lastAttempt: mapAttempt(node?.lastAttempt),
    attempts: Array.isArray(node?.attempts)
      ? node.attempts.map(mapAttempt).filter(Boolean)
      : undefined
  }
}

/** The passenger's name as a driver would read it, or the subject the booking carried. */
export const passengerName = (row: TransferRow): string | undefined => {
  const p = row.passengers[0]
  const full = `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim()
  return full || row.subject
}

/** The digits of a phone number, plus a leading +, which is all a tel: link wants. */
export const telHref = (phone: string | undefined): string | undefined => {
  if (!phone) return undefined
  const digits = phone.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '')
  return digits.length >= 3 ? `tel:${digits}` : undefined
}

/**
 * A mailto link for an address, and nothing for a value that is not one: a
 * machine account's login name reads like a name, not like a mailbox, and an
 * action that opens an empty mail is worse than no action.
 */
export const mailHref = (email: string | undefined): string | undefined => {
  const value = (email ?? '').trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    ? `mailto:${value}`
    : undefined
}

/** A map link for an address, opened by whatever map app the phone has. */
export const mapHref = (address: string | undefined): string | undefined =>
  address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : undefined

// --------------- Feature detection ---------------

interface SchemaFieldNames {
  transfer: string[]
  query: string[]
  car: string[]
  attempt: string[]
}

const readSchemaFieldNames = async (): Promise<SchemaFieldNames> => {
  const result: any = await fetchGraphQL(
    {
      query:
        'query { transfer: __type(name: "Transfer") { fields { name } } ' +
        'car: __type(name: "Car") { fields { name } } ' +
        'attempt: __type(name: "AssignmentAttempt") { fields { name } } ' +
        'root: __type(name: "Query") { fields { name } } }',
      variables: undefined,
      operationName: undefined
    },
    {}
  )
  const names = (v: any): string[] =>
    Array.isArray(v?.fields)
      ? v.fields.map((f: any) => String(f?.name)).filter(Boolean)
      : []
  return {
    transfer: names(result?.data?.transfer),
    query: names(result?.data?.root),
    car: names(result?.data?.car),
    attempt: names(result?.data?.attempt)
  }
}

/**
 * Which fields the deployed schema carries. The two brands have not always run
 * the same build: booklimo went without `price` for a while and neither had a
 * `transfer(id)` root field for a time. Asked through the query client, so a
 * reload within the schema's staleTime asks nothing and offline the last
 * answer serves, and an endpoint that will not introspect is taken to be the
 * current schema.
 */
const schemaFields = async (): Promise<{
  transfer: Set<string>
  query: Set<string>
  car: Set<string>
  attempt: Set<string>
}> => {
  try {
    const names = await cachedRead(
      keys.schema('transfer'),
      readSchemaFieldNames
    )
    return {
      transfer: new Set(names.transfer),
      query: new Set(names.query),
      car: new Set(names.car),
      attempt: new Set(names.attempt)
    }
  } catch {
    return {
      transfer: new Set<string>(),
      query: new Set<string>(),
      car: new Set<string>(),
      attempt: new Set<string>()
    }
  }
}

/** Whether the deployed Transfer type carries a field. True for every field on an endpoint that will not introspect. */
export const hasTransferField = async (name: string): Promise<boolean> => {
  const {transfer} = await schemaFields()
  return transfer.size === 0 || transfer.has(name)
}

/**
 * The same for the Car type, which grew the picture on 2026-09-07
 * (okf/architecture/media.md). A site built ahead of its pylon reads the
 * fleet without the five image fields rather than failing the whole query.
 */
export const hasCarField = async (name: string): Promise<boolean> => {
  const {car} = await schemaFields()
  return car.size === 0 || car.has(name)
}

/**
 * The fields a screen reads. The two links to the other leg of a booking
 * are one query each on the backend, so they are asked for by the detail
 * read only, never by a page of the list.
 */
const transferSelection = async (
  options: {relations?: boolean} = {}
): Promise<string> => {
  const {transfer, attempt: attemptType} = await schemaFields()
  const has = (name: string) => transfer.size === 0 || transfer.has(name)
  const hasAttempt = (name: string) =>
    attemptType.size === 0 || attemptType.has(name)

  const scalars = [
    'id',
    'code',
    'customerId',
    'driverId',
    'carId',
    'referenceId',
    'state',
    'pickupDateTime',
    'startDateTime',
    'endDateTime',
    'requestedAt',
    'pickupLocation',
    'dropoffLocation',
    // The address of the request, worked out by the pylon (dispatch.md
    // section 14.2). Asked for only where the deployed schema carries them,
    // like every other field added after a site was built.
    'pickupAddress',
    'pickupLat',
    'pickupLng',
    'pickupResolution',
    'pickupResolvedBy',
    'dropoffAddress',
    'dropoffLat',
    'dropoffLng',
    'dropoffResolution',
    'dropoffResolvedBy',
    'addressesResolvedAt',
    'subject',
    'price',
    'paymentMethode',
    'payingParty',
    'transferCategory',
    'transferType',
    // The money side and its instants, on a schema that carries them.
    'customerStatus',
    'language',
    'offeredAt',
    'offerValidUntil',
    'confirmedAt',
    'declinedAt',
    'invoicedAt',
    'paidAt',
    // Who answered for the customer, and the driver's cash: dispatch.md
    // sections 14.1 and 14.3, asked for only where the deployed schema has
    // them, so a site built ahead of its pylon reads the ride rather than
    // failing the whole query.
    'confirmedBy',
    'declinedBy',
    'cashReceivedAmount',
    'cashReceivedAt',
    'cashReceivedBy',
    'driverStatus'
  ].filter(has)

  // What the board's driver cell and the picker read of the driver's answer.
  // answeredBy arrived with dispatch.md section 9a, so it is asked for only
  // where the deployed schema carries it: a site built ahead of its pylon
  // reads the history without it rather than failing the whole query.
  const attemptFields = [
    'id',
    'driverId',
    'requestedAt',
    'answeredAt',
    'answer',
    'reason',
    'by'
  ]
    .concat(hasAttempt('answeredBy') ? ['answeredBy'] : [])
    .join(' ')
  const attempt = `{ ${attemptFields} }`

  // What a link to the other leg needs, and the fallback's input when the code is not there yet.
  const link = ['id', 'code', 'referenceId'].filter(has).join(' ')

  const nested = [
    has('details')
      ? 'details { flightNumber message luggage childSeats extraTime preferredCarClass preferredCarName }'
      : '',
    has('passengers')
      ? 'passengers { edges { node { id firstName lastName email phone language } } }'
      : '',
    has('extras') ? 'extras { edges { node { type amount } } }' : '',
    has('car') ? 'car { id carName licensePlate color carClass }' : '',
    has('lastAttempt') ? `lastAttempt ${attempt}` : '',
    // Who booked, for the people card (dispatch.md section 13). One call
    // into the directory on the pylon's side, so the detail read asks for it
    // and a page of the list never does.
    options.relations && has('customer')
      ? 'customer { __typename id userName preferredLoginName ' +
        '... on HumanUser { profiles { edges { node { firstName lastName displayName email phone } } } } }'
      : '',
    options.relations && has('attempts') ? `attempts ${attempt}` : '',
    options.relations && has('reference') ? `reference { ${link} }` : '',
    options.relations && has('referencedBy')
      ? `referencedBy { edges { node { ${link} } } }`
      : ''
  ].filter(Boolean)

  return `{ ${scalars.join(' ')} ${nested.join(' ')} }`
}

// --------------- The rows the client holds ---------------

/** One page of a list, as the query holds it. */
export interface TransferPage {
  rows: TransferRow[]
  endCursor: string | null
  hasNextPage: boolean
  totalCount: number
}

/**
 * Every page of every list the client holds, so a detail opened from a list
 * starts from the row the list already had, and a mutation's answer lands on
 * every page that shows the row.
 */
const heldPages = (): Array<[readonly unknown[], TransferPage | undefined]> =>
  queryClient.getQueriesData<TransferPage>({queryKey: ['transfers']})

/** The row an id or a code names, from the details and the pages the client holds. */
export const seenBy = (key: string): TransferRow | undefined => {
  for (const [, row] of queryClient.getQueriesData<TransferRow | null>({
    queryKey: ['transfer']
  })) {
    if (row && (row.id === key || row.code === key)) return row
  }
  for (const [, page] of heldPages()) {
    const row = page?.rows.find(r => r.id === key || r.code === key)
    if (row) return row
  }
  return undefined
}

/**
 * A row as a mutation or a screen answered it, swapped into every page and
 * every detail that shows it. A mutation answers without the links to the
 * other leg, and the links do not change with a driver or a price, so what
 * the client held of them is kept.
 */
export const rememberTransfer = (row: TransferRow) => {
  const merged = (before: TransferRow): TransferRow => ({
    ...row,
    reference: row.reference ?? before.reference,
    returns: row.returns ?? before.returns,
    attempts: row.attempts ?? before.attempts,
    customer: row.customer ?? before.customer
  })
  queryClient.setQueriesData<TransferPage>({queryKey: ['transfers']}, page =>
    page && page.rows.some(r => r.id === row.id)
      ? {...page, rows: page.rows.map(r => (r.id === row.id ? merged(r) : r))}
      : page
  )
  queryClient.setQueriesData<TransferRow | null>(
    {queryKey: ['transfer']},
    held => (held && held.id === row.id ? merged(held) : held)
  )
}

/** The rows a list has seen. The client holds them as the list's own page, nothing to do. */
export const rememberTransfers = (_rows: TransferRow[]) => undefined

/** Drop what the client holds of one ride, so the next screen reads it fresh. */
export const forgetTransfer = (id: string) => {
  const held = seenBy(id)
  const codes = held ? [held.id, held.code] : [id]
  for (const key of codes)
    queryClient.removeQueries({queryKey: keys.transfer(key), exact: true})
}

// --------------- The list ---------------

export interface TransferListArgs {
  /**
   * The table the size is remembered under, the DataTable id of the screen
   * that reads the list. The board's is `transfers`, the driver's own list
   * is `my-rides`.
   */
  tableId?: string
  pageSize?: number
  fromISO?: string
  toISO?: string
  /** One state, pushed down to the resolver. More than one is a client-side filter. */
  state?: TransferState
}

export interface TransferPagination {
  hasNextPage: boolean
  hasPreviousPage: boolean
  totalCount: number
  currentPage: number
  totalPages: number
}

const DEFAULT_PAGE_SIZE = 25

const EMPTY_ROWS: TransferRow[] = []

interface ListPageArgs {
  first: number
  after?: string
  fromISO?: string
  toISO?: string
  state?: TransferState
}

const readTransferPage = async (args: ListPageArgs): Promise<TransferPage> => {
  const listArgs: Record<string, unknown> = {first: args.first}
  if (args.after) listArgs.after = args.after
  if (args.fromISO) listArgs.fromISO = args.fromISO
  if (args.toISO) listArgs.toISO = args.toISO
  if (args.state) listArgs.state = new EnumValue(args.state)

  const selection = await transferSelection()
  const result = await gql(
    'transfers',
    {args: listArgs},
    `{ totalCount pageInfo { endCursor hasNextPage } edges { node ${selection} } }`
  )

  return {
    rows: (Array.isArray(result?.edges) ? result.edges : [])
      .map((e: any) => e?.node)
      .filter(Boolean)
      .map(mapTransfer),
    endCursor: result?.pageInfo?.endCursor ?? null,
    hasNextPage: !!result?.pageInfo?.hasNextPage,
    totalCount: typeof result?.totalCount === 'number' ? result.totalCount : 0
  }
}

export function useTransferList(args: TransferListArgs = {}) {
  const pageSize = args.pageSize ?? DEFAULT_PAGE_SIZE
  const {fromISO, toISO, state} = args

  // The size is the pager's: the reader's choice for this table, remembered
  // beside its column layout, `pageSize` the default until somebody chooses.
  const pager = usePager(JSON.stringify({fromISO, toISO, state}), {
    tableId: args.tableId ?? 'transfers',
    defaultSize: pageSize
  })
  const size = pager.pageSize
  const pageArgs = useMemo<ListPageArgs>(
    () => ({first: size, after: pager.after, fromISO, toISO, state}),
    [size, pager.after, fromISO, toISO, state]
  )

  const {
    query: q,
    isLoading,
    error,
    isFetching,
    refetch
  } = useAppQuery({
    queryKey: keys.transfers({...pageArgs}),
    queryFn: () => readTransferPage(pageArgs),
    // The page shown stays while the next one is read, as it always did.
    placeholderData: keepPreviousData
  })

  const page = q.data
  const rows = page?.rows ?? EMPTY_ROWS
  const pagination = useMemo<TransferPagination>(() => {
    const totalCount = page?.totalCount ?? 0
    return {
      hasNextPage: !!page?.hasNextPage,
      hasPreviousPage: pager.page > 1,
      totalCount,
      currentPage: pager.page,
      totalPages: Math.max(1, Math.ceil(totalCount / size))
    }
  }, [page, pager.page, size])

  const nextPage = useCallback(() => {
    if (page?.hasNextPage && page.endCursor) pager.next(page.endCursor)
  }, [page, pager])
  const prevPage = pager.prev
  const firstPage = pager.first

  /** Swap one row in place, for a mutation that answered with the new row. */
  const replaceRow = useCallback((row: TransferRow) => {
    rememberTransfer(row)
  }, [])

  return {
    rows,
    isLoading,
    error,
    isFetching,
    pagination,
    pageSize: size,
    setPageSize: pager.setPageSize,
    nextPage,
    prevPage,
    firstPage,
    refetch,
    replaceRow
  }
}

// --------------- One transfer ---------------

const WALK_PAGE = 100
const WALK_PAGES = 20

/**
 * One transfer by id or by code, with its links to the other leg.
 *
 * `transfer(transferId)` takes either identifier and answers within the
 * caller's scope. A schema without the root field, which no deployed brand
 * has had since 1.0.0, is walked instead: the scoped `transfers` connection a
 * hundred at a time, newest pickup first, for at most twenty pages, matching
 * the id or the code. Rows the list already showed are served from the cache
 * first either way, see useTransfer.
 */
const readTransfer = async (id: string): Promise<TransferRow | null> => {
  if (!id) return null
  const selection = await transferSelection({relations: true})
  const {query} = await schemaFields()

  if (query.has('transfer')) {
    const node = await gql('transfer', {transferId: id}, selection)
    return node ? mapTransfer(node) : null
  }

  let after: string | undefined
  for (let page = 0; page < WALK_PAGES; page++) {
    const listArgs: Record<string, unknown> = {first: WALK_PAGE}
    if (after) listArgs.after = after
    const result = await gql(
      'transfers',
      {args: listArgs},
      `{ pageInfo { endCursor hasNextPage } edges { node ${selection} } }`
    )
    const nodes: any[] = (Array.isArray(result?.edges) ? result.edges : [])
      .map((e: any) => e?.node)
      .filter(Boolean)
    const hit = nodes.find(n => String(n?.id) === id || String(n?.code) === id)
    if (hit) return mapTransfer(hit)
    if (!result?.pageInfo?.hasNextPage || !result?.pageInfo?.endCursor) break
    after = String(result.pageInfo.endCursor)
  }
  return null
}

/**
 * One transfer, read now and held by the client under `['transfer', id]`,
 * so the shell's prefetch of a shift lands every ride where the ride screen
 * reads it, and the persisted store keeps it for the outage. A read that
 * fails while the client holds the ride answers what it holds.
 */
export const fetchTransfer = (id: string): Promise<TransferRow | null> =>
  cachedRead(keys.transfer(id), () => readTransfer(id), 0)

/**
 * One transfer for a screen, by id or by code. The row a list already
 * showed is the placeholder until the fresh read lands, and the fresh read
 * is what carries the links to the other leg.
 */
export function useTransfer(id: string | undefined) {
  const key = id ?? ''
  const {
    query: q,
    isLoading,
    error,
    isFetching,
    refetch
  } = useAppQuery({
    queryKey: keys.transfer(key),
    queryFn: () => readTransfer(key),
    enabled: !!id,
    placeholderData: () => (id ? seenBy(id) : undefined)
  })

  const transfer = q.data ?? null
  const notFound = q.isSuccess && q.data === null

  const replace = useCallback((next: TransferRow) => {
    rememberTransfer(next)
  }, [])

  return {transfer, isLoading, error, isFetching, notFound, refetch, replace}
}

// --------------- Mutations ---------------

/**
 * One write, and what it changes on the screens: the answered row lands on
 * every page and detail that shows it at once, and the lists are read again
 * behind it, because a state or a driver can move a row into or out of a
 * filter the client cannot judge.
 */
const mutate = async (
  field: string,
  args: Record<string, unknown>
): Promise<TransferRow> => {
  const selection = await transferSelection()
  const node = await gql(field, args, selection, 'mutation')
  const row = mapTransfer(node)
  const before = seenBy(row.id)
  if (before) {
    row.reference = row.reference ?? before.reference
    row.returns = row.returns ?? before.returns
    row.attempts = row.attempts ?? before.attempts
    // A price or a state does not change who booked, and the mutation's
    // answer carries no customer node, so what the detail read brought stays.
    row.customer = row.customer ?? before.customer
  }
  rememberTransfer(row)
  void invalidateTransfers()
  return row
}

/**
 * A write that changes the ride's request history: the answered row lands
 * on the screens at once, then the ride is read again with its attempts,
 * because the mutation's answer carries none and the list the detail page
 * shows would be one answer behind.
 */
const mutateWithAttempts = async (
  field: string,
  args: Record<string, unknown>
): Promise<TransferRow> => {
  const row = await mutate(field, args)
  return (await fetchTransfer(row.id)) ?? row
}

export interface AssignDriverOptions {
  /**
   * "Push the driver" in the assign dialog, on by default. The backend sends
   * the push itself from assignDriver (pylon/src/push notifyAssigned), so the
   * flag is carried here for the integrator to wire as an argument or drop.
   * INTEGRATOR: pass `notify` to assignDriver when the resolver takes it.
   */
  notifyDriver?: boolean
}

export const assignDriver = (
  transferId: string,
  driverId: string,
  _options: AssignDriverOptions = {}
) => mutateWithAttempts('assignDriver', {transferId, driverId})

export const assignCar = (transferId: string, carId: string) =>
  mutate('assignCar', {transferId, carId})

/** The driver's yes: REQUESTED becomes ACCEPTED, the ride ASSIGNED. */
export const acceptAssignment = (transferId: string) =>
  mutateWithAttempts('acceptAssignment', {transferId})

/** The driver's no, with an optional reason: the driver comes off the ride, the ride is PENDING again. */
export const declineAssignment = (transferId: string, reason?: string) =>
  mutateWithAttempts('declineAssignment', {
    transferId,
    reason: reason?.trim() || undefined
  })

/** The dispatcher takes the ride back from the driver, asked or accepted, while the car has not left. */
export const unassignDriver = (transferId: string) =>
  mutateWithAttempts('unassignDriver', {transferId})

export const setPrice = (transferId: string, price: number) =>
  mutate('setPrice', {transferId, price})

/**
 * The dispatcher's one tap on a doubtful address (dispatch.md section 14.2).
 * With no address it confirms the guess the row already carries; with one it
 * corrects it, and the pylon looks the correction up so the pin follows.
 * Either way the side becomes RESOLVED by DISPATCHER and the warning goes.
 */
export const setTransferAddress = (
  transferId: string,
  which: 'PICKUP' | 'DROPOFF',
  address?: string
) =>
  mutate('setTransferAddress', {
    transferId,
    which,
    address: address?.trim() || undefined
  })

/**
 * Work the two addresses out again. The pylon does this by itself when a ride
 * is created, so this is the retry a dispatcher gets on a ride whose address
 * the geocoder and the model were both out for, and the migration path for
 * every ride written before the columns existed. The answer is the cost
 * report, not the row, so the row is read again afterwards.
 */
export const resolveTransferAddresses = async (
  transferId: string,
  force = false
): Promise<TransferRow | null> => {
  await gql(
    'resolveTransferAddresses',
    {transferId, force},
    '{ transferId code written geocoderCalls modelCalls modelTokens ms model ' +
      'pickup { which resolution source address lat lng note } ' +
      'dropoff { which resolution source address lat lng note } }',
    'mutation'
  )
  void invalidateTransfers()
  return fetchTransfer(transferId)
}

/**
 * "Bar erhalten", dispatch.md section 14.3: the driver of this ride was
 * handed `amount` by the passenger. The driver writes it on their own ride
 * from ON_THE_WAY on, an admin on any ride and again to correct it, and the
 * pylon refuses a ride whose paying party is not the passenger
 * (CASH_NOT_OFFERED) and one the car has not left (CASH_TOO_EARLY).
 */
export const markCashReceived = (transferId: string, amount: number) =>
  mutate('markCashReceived', {transferId, amount})

/** The admin's correction that takes the record back. Idempotent on a ride that carries none. */
export const clearCashReceived = (transferId: string) =>
  mutate('clearCashReceived', {transferId})

export const updateTransferState = (
  transferId: string,
  state: TransferState
) => {
  if (!TRANSFER_STATES.includes(state))
    // A programmer's slip rather than something a person can do, and it still
    // reads in the reader's language: the developer's words are the detail.
    throw appError('InvalidInput', `unknown state ${state}`)
  return mutate('updateTransferState', {
    transferId,
    state: new EnumValue(state)
  })
}

export const cancelTransfer = (transferId: string) =>
  mutate('cancelTransfer', {transferId})

/** addTransferExtra answers with the transfer before the write, so the row is re-read. */
export const addTransferExtra = async (
  transferId: string,
  type: ExtraType,
  amount: number
) => {
  // `type` is a String on the resolver, not the ExtraType enum, so it is quoted.
  await mutate('addTransferExtra', {transferId, type, amount})
  return (await fetchTransfer(transferId)) ?? seenBy(transferId) ?? null
}

export const removeTransferExtra = async (
  transferId: string,
  type: ExtraType
) => {
  await mutate('removeTransferExtra', {transferId, type})
  return (await fetchTransfer(transferId)) ?? seenBy(transferId) ?? null
}

export interface CreateTransferInput {
  customerId: string
  pickupLocation: string
  dropoffLocation: string
  /** ISO 8601. */
  pickupDateTime: string
  /**
   * The dispatcher's "Vergangene Fahrt nachtragen". Without it the pylon
   * refuses a pickup before now with PICKUP_IN_PAST
   * (okf/architecture/dispatch.md section 12), and with it the office enters
   * a ride that has already happened.
   */
  allowPast?: boolean
  subject?: string
  price?: number
  paymentMethode?: PaymentMethod
  payingParty?: PayingParty
  carId?: string
  /**
   * The origin's id for a return trip. The pylon gives the new ride the
   * origin's stem and the next leg number, and refuses an origin of another
   * customer. Set by the detail page's "Rückfahrt anlegen", never typed.
   */
  referenceId?: string
  passengers?: Array<{
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
    language?: string
  }>
  extras?: Array<{type: ExtraType; amount: number}>
  details?: {
    flightNumber?: string
    message?: string
    transferCategory?: TransferCategory
    transferType?: TransferType
    luggage?: string
    childSeats?: string
    extraTime?: string
    preferredCarClass?: CarClass
    preferredCarName?: string
  }
}

/**
 * The full createTransfer input. Only `details.transferCategory` and
 * `details.transferType` are enums in the schema and go in bare. Everything
 * else that looks like an enum (paymentMethode, payingParty, an extra's type,
 * preferredCarClass) is typed String on the resolver and normalised there,
 * so those stay quoted. Verified against pylon/.pylon/schema.graphql.
 */
export const createTransfer = (input: CreateTransferInput) => {
  const args: Record<string, unknown> = {
    customerId: input.customerId,
    pickupLocation: input.pickupLocation,
    dropoffLocation: input.dropoffLocation,
    pickupDateTime: input.pickupDateTime,
    // Sent only when it is on, so an ordinary create carries no backdate flag.
    allowPast: input.allowPast ? true : undefined,
    subject: input.subject,
    price: input.price,
    paymentMethode: input.paymentMethode,
    payingParty: input.payingParty,
    carId: input.carId,
    referenceId: input.referenceId,
    passengers: input.passengers,
    extras: input.extras,
    details: input.details
      ? {
          ...input.details,
          transferCategory: input.details.transferCategory
            ? new EnumValue(input.details.transferCategory)
            : undefined,
          transferType: input.details.transferType
            ? new EnumValue(input.details.transferType)
            : undefined
        }
      : undefined
  }
  return mutate('createTransfer', {args})
}

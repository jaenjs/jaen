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
 */
import {useCallback, useEffect, useRef, useState} from 'react'
import {fetchGraphQL} from '../../client/limosen'
import {asTransferState, TRANSFER_STATES, type TransferState} from '../locales/i18nStates'

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
 * The error a resolver answered with, kept as the backend spelled it, plus
 * the extension code so a screen can tell FORBIDDEN from AUTH_REQUIRED.
 */
export class GraphQLRequestError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message)
    this.name = 'GraphQLRequestError'
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
      typeof first?.extensions?.code === 'string' ? first.extensions.code : undefined
    )
  }

  return result?.data?.[field]
}

// --------------- The enums, as the schema spells them ---------------

export const PAYMENT_METHODS = ['CASH', 'CARD', 'VOUCHER', 'INVOICE'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYING_PARTIES = ['CUSTOMER', 'PASSENGER'] as const
export type PayingParty = (typeof PAYING_PARTIES)[number]

export const CAR_CLASSES = ['BUSINESS_CLASS', 'ELECTRIC_CLASS', 'FIRST_CLASS', 'BUSINESS_VAN'] as const
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

export const DRIVER_EXITS: Partial<Record<TransferState, TransferState>> = {
  ASSIGNED: 'REJECTED',
  AT_PICKUP: 'NO_SHOW'
}

/** The index of a state on the slider, or -1 when the driver cannot move it. */
export const driverStopIndex = (state: string | undefined): number =>
  DRIVER_STOPS.indexOf(asTransferState(state) as TransferState)

/** A ride the driver is still moving, or has just finished. */
export const isDriverStage = (state: string | undefined): boolean => driverStopIndex(state) >= 0

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
}

const pad2 = (n: number) => String(n).padStart(2, '0')

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

export const transferPath = (row: {id: string; code: string}): string => `/transfers/${transferSlug(row)}`

const ref = (node: any): TransferRef | undefined => {
  const id = str(node?.id)
  if (!id) return undefined
  return {id, code: str(node?.code) ?? transferCode(id, str(node?.referenceId))}
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
    passengers: (Array.isArray(node?.passengers?.edges) ? node.passengers.edges : [])
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

/** A map link for an address, opened by whatever map app the phone has. */
export const mapHref = (address: string | undefined): string | undefined =>
  address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : undefined

// --------------- Feature detection ---------------

let schemaFieldsPromise: Promise<{transfer: Set<string>; query: Set<string>}> | undefined

/**
 * Which fields the deployed schema carries. The two brands have not always run
 * the same build: booklimo went without `price` for a while and neither has a
 * `transfer(id)` root field today. Asked once per page load, and an endpoint
 * that will not introspect is taken to be the current schema.
 */
const schemaFields = (): Promise<{transfer: Set<string>; query: Set<string>}> => {
  if (!schemaFieldsPromise) {
    schemaFieldsPromise = (async () => {
      try {
        const result: any = await fetchGraphQL(
          {
            query:
              'query { transfer: __type(name: "Transfer") { fields { name } } ' +
              'root: __type(name: "Query") { fields { name } } }',
            variables: undefined,
            operationName: undefined
          },
          {}
        )
        const names = (v: any) =>
          new Set<string>(
            Array.isArray(v?.fields) ? v.fields.map((f: any) => String(f?.name)).filter(Boolean) : []
          )
        return {transfer: names(result?.data?.transfer), query: names(result?.data?.root)}
      } catch {
        return {transfer: new Set<string>(), query: new Set<string>()}
      }
    })()
  }
  return schemaFieldsPromise
}

/** Whether the deployed Transfer type carries a field. True for every field on an endpoint that will not introspect. */
export const hasTransferField = async (name: string): Promise<boolean> => {
  const {transfer} = await schemaFields()
  return transfer.size === 0 || transfer.has(name)
}

/**
 * The fields a screen reads. The two links to the other leg of a booking
 * are one query each on the backend, so they are asked for by the detail
 * read only, never by a page of the list.
 */
const transferSelection = async (options: {relations?: boolean} = {}): Promise<string> => {
  const {transfer} = await schemaFields()
  const has = (name: string) => transfer.size === 0 || transfer.has(name)

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
    'subject',
    'price',
    'paymentMethode',
    'payingParty',
    'transferCategory',
    'transferType'
  ].filter(has)

  // What a link to the other leg needs, and the fallback's input when the code is not there yet.
  const link = ['id', 'code', 'referenceId'].filter(has).join(' ')

  const nested = [
    has('details')
      ? 'details { flightNumber message luggage childSeats extraTime preferredCarClass preferredCarName }'
      : '',
    has('passengers') ? 'passengers { edges { node { id firstName lastName email phone language } } }' : '',
    has('extras') ? 'extras { edges { node { type amount } } }' : '',
    has('car') ? 'car { id carName licensePlate color carClass }' : '',
    options.relations && has('reference') ? `reference { ${link} }` : '',
    options.relations && has('referencedBy') ? `referencedBy { edges { node { ${link} } } }` : ''
  ].filter(Boolean)

  return `{ ${scalars.join(' ')} ${nested.join(' ')} }`
}

// --------------- The detail cache ---------------

/**
 * The rows the list has seen, by id. A detail opened from the list starts
 * from what the list already had and reads the fresh row behind it.
 */
const seen = new Map<string, TransferRow>()

export const rememberTransfers = (rows: TransferRow[]) => {
  rows.forEach(r => seen.set(r.id, r))
}

export const forgetTransfer = (id: string) => {
  seen.delete(id)
}

// --------------- The list ---------------

export interface TransferListArgs {
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

export function useTransferList(args: TransferListArgs = {}) {
  const pageSize = args.pageSize ?? DEFAULT_PAGE_SIZE
  const {fromISO, toISO, state} = args

  const [rows, setRows] = useState<TransferRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<TransferPagination>({
    hasNextPage: false,
    hasPreviousPage: false,
    totalCount: 0,
    currentPage: 1,
    totalPages: 1
  })

  const endCursorRef = useRef<string | null>(null)
  const cursorStackRef = useRef<string[]>([])
  const currentAfterRef = useRef<string | undefined>(undefined)
  const requestRef = useRef(0)

  const fetchPage = useCallback(
    async (after: string | undefined, page: number) => {
      const request = ++requestRef.current
      setIsLoading(true)
      setError(null)
      try {
        const listArgs: Record<string, unknown> = {first: pageSize}
        if (after) listArgs.after = after
        if (fromISO) listArgs.fromISO = fromISO
        if (toISO) listArgs.toISO = toISO
        if (state) listArgs.state = new EnumValue(state)

        const selection = await transferSelection()
        const result = await gql(
          'transfers',
          {args: listArgs},
          `{ totalCount pageInfo { endCursor hasNextPage } edges { node ${selection} } }`
        )

        // A slower earlier answer must not overwrite a newer one.
        if (request !== requestRef.current) return

        const items = (Array.isArray(result?.edges) ? result.edges : [])
          .map((e: any) => e?.node)
          .filter(Boolean)
          .map(mapTransfer)
        const totalCount = typeof result?.totalCount === 'number' ? result.totalCount : 0

        rememberTransfers(items)
        endCursorRef.current = result?.pageInfo?.endCursor ?? null
        setRows(items)
        setPagination({
          hasNextPage: !!result?.pageInfo?.hasNextPage,
          hasPreviousPage: page > 1,
          totalCount,
          currentPage: page,
          totalPages: Math.max(1, Math.ceil(totalCount / pageSize))
        })
      } catch (err) {
        if (request !== requestRef.current) return
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (request === requestRef.current) setIsLoading(false)
      }
    },
    [pageSize, fromISO, toISO, state]
  )

  useEffect(() => {
    cursorStackRef.current = []
    currentAfterRef.current = undefined
    void fetchPage(undefined, 1)
  }, [fetchPage])

  const nextPage = useCallback(() => {
    const cursor = endCursorRef.current
    if (!pagination.hasNextPage || !cursor) return
    cursorStackRef.current = [...cursorStackRef.current, currentAfterRef.current ?? '']
    currentAfterRef.current = cursor
    void fetchPage(cursor, pagination.currentPage + 1)
  }, [pagination, fetchPage])

  const prevPage = useCallback(() => {
    if (pagination.currentPage <= 1) return
    const stack = [...cursorStackRef.current]
    const prev = stack.pop()
    cursorStackRef.current = stack
    const cursor = prev || undefined
    currentAfterRef.current = cursor
    void fetchPage(cursor, pagination.currentPage - 1)
  }, [pagination, fetchPage])

  const firstPage = useCallback(() => {
    cursorStackRef.current = []
    currentAfterRef.current = undefined
    void fetchPage(undefined, 1)
  }, [fetchPage])

  const refetch = useCallback(() => {
    void fetchPage(currentAfterRef.current, pagination.currentPage)
  }, [fetchPage, pagination.currentPage])

  /** Swap one row in place, for a mutation that answered with the new row. */
  const replaceRow = useCallback((row: TransferRow) => {
    seen.set(row.id, row)
    setRows(current => current.map(r => (r.id === row.id ? row : r)))
  }, [])

  return {rows, isLoading, error, pagination, nextPage, prevPage, firstPage, refetch, replaceRow}
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
export const fetchTransfer = async (id: string): Promise<TransferRow | null> => {
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

/** The cached row an id or a code names. */
const seenBy = (key: string): TransferRow | undefined => {
  const byId = seen.get(key)
  if (byId) return byId
  for (const row of seen.values()) if (row.code === key) return row
  return undefined
}

/** One transfer for a screen, by id or by code, the list's cache first and a fresh read always. */
export function useTransfer(id: string | undefined) {
  const [row, setRow] = useState<TransferRow | null>(() => (id ? seenBy(id) ?? null : null))
  const [isLoading, setIsLoading] = useState(() => !(id && seenBy(id)))
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const requestRef = useRef(0)

  const load = useCallback(async () => {
    if (!id) return
    const request = ++requestRef.current
    const cached = seenBy(id)
    if (cached) setRow(cached)
    setIsLoading(!cached)
    setError(null)
    try {
      const fresh = await fetchTransfer(id)
      if (request !== requestRef.current) return
      if (fresh) {
        seen.set(fresh.id, fresh)
        setRow(fresh)
        setNotFound(false)
      } else {
        setNotFound(!cached)
      }
    } catch (err) {
      if (request !== requestRef.current) return
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (request === requestRef.current) setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const replace = useCallback((next: TransferRow) => {
    seen.set(next.id, next)
    setRow(next)
  }, [])

  return {transfer: row, isLoading, error, notFound, refetch: load, replace}
}

// --------------- Mutations ---------------

const mutate = async (field: string, args: Record<string, unknown>): Promise<TransferRow> => {
  const selection = await transferSelection()
  const node = await gql(field, args, selection, 'mutation')
  const row = mapTransfer(node)
  // A mutation answers without the links to the other leg. The detail keeps
  // the ones it read, the links do not change with a driver or a price.
  const before = seen.get(row.id)
  if (before) {
    row.reference = before.reference
    row.returns = before.returns
  }
  seen.set(row.id, row)
  return row
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

export const assignDriver = (transferId: string, driverId: string, _options: AssignDriverOptions = {}) =>
  mutate('assignDriver', {transferId, driverId})

export const assignCar = (transferId: string, carId: string) => mutate('assignCar', {transferId, carId})

export const setPrice = (transferId: string, price: number) => mutate('setPrice', {transferId, price})

export const updateTransferState = (transferId: string, state: TransferState) => {
  if (!TRANSFER_STATES.includes(state)) throw new Error(`unknown state ${state}`)
  return mutate('updateTransferState', {transferId, state: new EnumValue(state)})
}

export const cancelTransfer = (transferId: string) => mutate('cancelTransfer', {transferId})

/** addTransferExtra answers with the transfer before the write, so the row is re-read. */
export const addTransferExtra = async (transferId: string, type: ExtraType, amount: number) => {
  // `type` is a String on the resolver, not the ExtraType enum, so it is quoted.
  await mutate('addTransferExtra', {transferId, type, amount})
  return (await fetchTransfer(transferId)) ?? seen.get(transferId) ?? null
}

export const removeTransferExtra = async (transferId: string, type: ExtraType) => {
  await mutate('removeTransferExtra', {transferId, type})
  return (await fetchTransfer(transferId)) ?? seen.get(transferId) ?? null
}

export interface CreateTransferInput {
  customerId: string
  pickupLocation: string
  dropoffLocation: string
  /** ISO 8601. */
  pickupDateTime: string
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
          transferType: input.details.transferType ? new EnumValue(input.details.transferType) : undefined
        }
      : undefined
  }
  return mutate('createTransfer', {args})
}

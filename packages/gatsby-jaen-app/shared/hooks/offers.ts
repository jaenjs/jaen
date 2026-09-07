/**
 * The customer's status, the money side of a ride beside the state that says
 * where the car is, and the offers screen's read.
 *
 * `Transfer.customerStatus` is written only by the pylon (NEW at creation,
 * OFFERED by sendOffer, CONFIRMED and DECLINED by the two links or an admin
 * or the cron, INVOICED by sendInvoice, PAID by markPaid), see
 * okf/architecture/offers-and-documents.md. The screens read it, the
 * writes live in ./documents.ts beside the documents they move.
 *
 * The offers screen reads `offers(args:{first, after, status, month,
 * search, language})`, a Relay connection of OFFER documents newest first
 * with the ride each belongs to, admin only. The read is a query of the one
 * client in ./query.ts under `['offers', args]`, invalidated by every write
 * that moves a status or a document, and paged with the board's pager.
 *
 * The documents are written with their arguments as literals, never as
 * typed variables, for the reason ./transfers.ts gives: Pylon names the
 * input types after the resolver signature and a literal names nothing.
 *
 * INTEGRATOR: the five instants (`offeredAt` to `paidAt`) are asked for
 * only when the deployed Transfer type carries them. The offer backend
 * names them, see STATUS_INSTANTS and its report.
 */
import {useCallback, useMemo} from 'react'
import {keepPreviousData} from '@tanstack/react-query'
import {fetchGraphQL} from '../../client/limosen'
import {queryClient, useAppQuery, usePager} from './query'
import {GraphQLRequestError, hasTransferField, transferCode} from './transfers'

// --------------- The six states ---------------

export const CUSTOMER_STATUSES = [
  'NEW',
  'OFFERED',
  'CONFIRMED',
  'INVOICED',
  'PAID',
  'DECLINED'
] as const
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number]

/** The value as the backend spells it, or undefined for anything else, a row from before the column say. */
export const asCustomerStatus = (
  raw: string | null | undefined
): CustomerStatus | undefined => {
  const upper = String(raw ?? '').toUpperCase()
  return (CUSTOMER_STATUSES as readonly string[]).includes(upper)
    ? (upper as CustomerStatus)
    : undefined
}

/** The happy path in order, DECLINED is the branch off OFFERED. */
export const CUSTOMER_STEPS: readonly CustomerStatus[] = [
  'NEW',
  'OFFERED',
  'CONFIRMED',
  'INVOICED',
  'PAID'
]

/** A price on a ride in one of these offers "Angebot senden". */
export const canSendOffer = (status: string | null | undefined): boolean => {
  const s = asCustomerStatus(status) ?? 'NEW'
  return s === 'NEW' || s === 'OFFERED'
}

/**
 * A ride the customer has not confirmed gets no driver and no car
 * (okf/architecture/dispatch.md section 11): the pylon refuses assignDriver
 * and assignCar with CONFIRMATION_REQUIRED on NEW, OFFERED and DECLINED,
 * and the screens draw the picker disabled with "Zuerst bestätigen" rather
 * than letting the dispatcher run into the refusal. A row from a backend
 * that has no customerStatus at all is dispatched the way it always was.
 */
export const needsConfirmation = (
  status: string | null | undefined
): boolean => {
  const s = asCustomerStatus(status)
  return s === 'NEW' || s === 'OFFERED' || s === 'DECLINED'
}

/**
 * The office's own "Buchung bestätigen", `confirmBooking`: a booking with
 * no offer only. An OFFERED ride is confirmed through the offer, by the
 * customer's link or by the dispatcher on the money side, so the two paths
 * never race.
 */
export const canConfirmBooking = (status: string | null | undefined): boolean =>
  asCustomerStatus(status) === 'NEW'

/** The dropzone is enabled from CONFIRMED on: the invoice may be replaced until it is paid. */
export const canUploadInvoice = (
  status: string | null | undefined
): boolean => {
  const s = asCustomerStatus(status)
  return s === 'CONFIRMED' || s === 'INVOICED' || s === 'PAID'
}

/**
 * The instants the pylon writes beside each transition, one per state
 * reached. Asked for when the deployed schema carries them, so a site built
 * ahead of its pylon still lists the rides. The names are the contract with
 * the offer backend: `<state in lower case>At`.
 */
export const STATUS_INSTANTS = [
  'offeredAt',
  'offerValidUntil',
  'confirmedAt',
  'declinedAt',
  'invoicedAt',
  'paidAt'
] as const
export type StatusInstant = (typeof STATUS_INSTANTS)[number]

export const INSTANT_OF: Record<
  Exclude<CustomerStatus, 'NEW'>,
  Exclude<StatusInstant, 'offerValidUntil'>
> = {
  OFFERED: 'offeredAt',
  CONFIRMED: 'confirmedAt',
  DECLINED: 'declinedAt',
  INVOICED: 'invoicedAt',
  PAID: 'paidAt'
}

/** The instant fields the deployed Transfer type carries, as one selection fragment. */
export const statusInstantSelection = async (): Promise<string> => {
  const present = await Promise.all(
    STATUS_INSTANTS.map(async name =>
      (await hasTransferField(name)) ? name : ''
    )
  )
  return present.filter(Boolean).join(' ')
}

/** The row's instants, as a record, from whatever the node carried. */
export const readInstants = (
  node: any
): Partial<Record<StatusInstant, string>> => {
  const out: Partial<Record<StatusInstant, string>> = {}
  for (const name of STATUS_INSTANTS) {
    const v = node?.[name]
    if (typeof v === 'string' && v) out[name] = v
  }
  return out
}

// --------------- The document builder ---------------

const literal = (value: unknown): string => {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
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
 * One root field, its arguments as literals, the answer under the field. A
 * refusal is thrown as GraphQLRequestError with the backend's code, so a
 * screen can tell FORBIDDEN from AUTH_REQUIRED. GQty throws itself when an
 * answer carries errors and no data, with the errors under `graphQLErrors`,
 * and the first error's words are what the screen shows.
 */
export const call = async (
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
  const refusal = (errors: any[]): GraphQLRequestError => {
    const first = errors[0]
    return new GraphQLRequestError(
      String(first?.message || 'GraphQL error'),
      typeof first?.extensions?.code === 'string'
        ? first.extensions.code
        : undefined
    )
  }
  let result: any
  try {
    result = await fetchGraphQL(
      {
        query: `${kind} { ${field}${rendered} ${selection} }`,
        variables: undefined,
        operationName: undefined
      },
      {}
    )
  } catch (err) {
    const errors = (err as {graphQLErrors?: unknown})?.graphQLErrors
    if (Array.isArray(errors) && errors.length) throw refusal(errors)
    throw err
  }
  if (result?.errors?.length) throw refusal(result.errors)
  return result?.data?.[field]
}

/**
 * The schema does not know the field: the offer backend is not deployed,
 * not a failure of this ride. GraphQL's own validation answers with the
 * code GRAPHQL_VALIDATION_FAILED and one of a few phrasings; a resolver's
 * message that happens to mention a field ("Field X is not defined by
 * type", emailwerk's words carried through MAIL_FAILED) is not that.
 */
export const isUnknownField = (err: unknown): boolean => {
  if (!(err instanceof Error)) return false
  const code = (err as {code?: unknown}).code
  if (code === 'GRAPHQL_VALIDATION_FAILED') return true
  if (typeof code === 'string') return false
  return /^Cannot query field|^Unknown argument|^Unknown type/.test(err.message)
}

// --------------- The row ---------------

/**
 * One row of the offers screen, the pylon's `Offer`: the offer document
 * with what the screen shows beside it read off the ride in the same
 * query. The customer is the addressee the offer was written to, so no
 * directory call per row. `statusAt` is the instant of the current
 * customer status, `validUntil` the offer's "gültig bis".
 */
export interface OfferRow {
  /** The offer document's id, `document:<uuid>`, for documentUrl. */
  id: string
  /** AN-260001. */
  number: string
  transferId: string
  /** BQ7Q4W-1, the link to the ride. */
  code: string
  /** de | en | tr | ar, the booking's language. */
  language: string
  /** The offer date, when the document was first stored, ISO. */
  createdAt: string
  sentAt?: string
  sentTo?: string
  /** The addressee's first line, else the first passenger's name. */
  customer: string
  pickupDateTime: string
  /** The gross total the document prints, else the ride's price. */
  total: number | null
  customerStatus?: CustomerStatus
  /** The instant of the current customer status, ISO. */
  statusAt?: string
  /** The ride state, where the car is. */
  state: string
  validUntil?: string
  filename: string
}

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.length ? v : undefined

export const mapOffer = (node: any): OfferRow => {
  const transferId = String(node?.transferId ?? '')
  return {
    id: String(node?.id ?? ''),
    number: str(node?.number) ?? '',
    transferId,
    code: str(node?.code) ?? transferCode(transferId),
    language: str(node?.language) ?? 'de',
    createdAt: str(node?.createdAt) ?? '',
    sentAt: str(node?.sentAt),
    sentTo: str(node?.sentTo),
    customer: str(node?.customer) ?? '',
    pickupDateTime: str(node?.pickupDateTime) ?? '',
    total: typeof node?.total === 'number' ? node.total : null,
    customerStatus: asCustomerStatus(node?.customerStatus),
    statusAt: str(node?.statusAt),
    state: str(node?.state) ?? 'PENDING',
    validUntil: str(node?.validUntil),
    filename: str(node?.filename) ?? ''
  }
}

// --------------- The list ---------------

export interface OfferListArgs {
  pageSize?: number
  status?: CustomerStatus
  /** YYYY-MM, the offer date's month. */
  month?: string
  /** Matches number, code and customer, on the pylon. */
  search?: string
  language?: string
}

export interface OfferPage {
  rows: OfferRow[]
  endCursor: string | null
  hasNextPage: boolean
  totalCount: number
}

export interface OfferPagination {
  hasNextPage: boolean
  hasPreviousPage: boolean
  totalCount: number
  currentPage: number
  totalPages: number
}

const DEFAULT_PAGE_SIZE = 25
const EMPTY_ROWS: OfferRow[] = []

export const offersKey = (args: Record<string, unknown>) =>
  ['offers', args] as const

/** Every page of the offers screen is read again after a write that moves a status or a document. */
export const invalidateOffers = () =>
  queryClient.invalidateQueries({queryKey: ['offers']})

/** The pylon's Offer, every field the screen shows. */
const OFFER_FIELDS =
  '{ id number transferId code language createdAt sentAt sentTo customer pickupDateTime total customerStatus statusAt state validUntil filename }'

interface PageArgs {
  first: number
  after?: string
  status?: CustomerStatus
  month?: string
  search?: string
  language?: string
}

const readOfferPage = async (args: PageArgs): Promise<OfferPage> => {
  const listArgs: Record<string, unknown> = {first: args.first}
  if (args.after) listArgs.after = args.after
  if (args.status) listArgs.status = args.status
  if (args.month) listArgs.month = args.month
  if (args.search) listArgs.search = args.search
  if (args.language) listArgs.language = args.language
  const result = await call(
    'offers',
    {args: listArgs},
    `{ totalCount pageInfo { endCursor hasNextPage } edges { node ${OFFER_FIELDS} } }`
  )
  return {
    rows: (Array.isArray(result?.edges) ? result.edges : [])
      .map((e: any) => e?.node)
      .filter(Boolean)
      .map(mapOffer),
    endCursor: result?.pageInfo?.endCursor ?? null,
    hasNextPage: !!result?.pageInfo?.hasNextPage,
    totalCount: typeof result?.totalCount === 'number' ? result.totalCount : 0
  }
}

/**
 * The offers screen's rows, one page at a time, newest first as the pylon
 * sorts them. The filters are pushed down: the resolver matches the status,
 * the month of the offer date, the language, and the search against
 * number, code and customer. The page shown stays while the next is read.
 */
export function useOffers(args: OfferListArgs = {}) {
  const pageSize = args.pageSize ?? DEFAULT_PAGE_SIZE
  const {status, month, search, language} = args
  const trimmed = search?.trim() || undefined

  // The size is the pager's: the reader's choice for this table, remembered
  // beside its column layout, `pageSize` the default until somebody chooses.
  const pager = usePager(
    JSON.stringify({status, month, search: trimmed, language}),
    {tableId: 'offers', defaultSize: pageSize}
  )
  const size = pager.pageSize
  const pageArgs = useMemo<PageArgs>(
    () => ({
      first: size,
      after: pager.after,
      status,
      month,
      search: trimmed,
      language
    }),
    [size, pager.after, status, month, trimmed, language]
  )

  const {
    query: q,
    isLoading,
    error,
    isFetching,
    refetch
  } = useAppQuery({
    queryKey: offersKey({...pageArgs}),
    queryFn: () => readOfferPage(pageArgs),
    placeholderData: keepPreviousData
  })

  const page = q.data
  const rows = page?.rows ?? EMPTY_ROWS
  const pagination = useMemo<OfferPagination>(() => {
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

  return {
    rows,
    isLoading,
    error,
    isFetching,
    pagination,
    pageSize: size,
    setPageSize: pager.setPageSize,
    nextPage,
    prevPage: pager.prev,
    firstPage: pager.first,
    refetch
  }
}

// --------------- The customer's own half ---------------

/**
 * One row of the customer's Kunden half on the billing screen: a ride of
 * their own with the money side beside it, the customer status with its
 * instant, when the invoice went out and when it was marked paid
 * (okf/architecture/finance.md, "The billing screen, both sides"). Read
 * through `transfers`, which the backend scopes to the caller's rides, so
 * no argument here decides whose rides these are.
 */
export interface CustomerBillingRow {
  /** `transfer:<uuid>`, for the documents. Never shown. */
  id: string
  /** BQ7Q4W-1, the link to the booking. */
  code: string
  pickupDateTime: string
  pickup: string
  dropoff: string
  /** Null for a row without a price yet. */
  total: number | null
  state: string
  language: string
  customerStatus?: CustomerStatus
  /** The instant of the current customer status, ISO. */
  statusAt?: string
  invoicedAt?: string
  paidAt?: string
}

export interface CustomerBillingPage {
  rows: CustomerBillingRow[]
  endCursor: string | null
  hasNextPage: boolean
  totalCount: number
}

const EMPTY_BILLING_ROWS: CustomerBillingRow[] = []

export const customerBillingKey = (args: Record<string, unknown>) =>
  ['bookings', 'billing', args] as const

const mapCustomerBilling = (node: any): CustomerBillingRow => {
  const id = String(node?.id ?? '')
  const status = asCustomerStatus(node?.customerStatus)
  const instants = readInstants(node)
  return {
    id,
    code: str(node?.code) ?? transferCode(id),
    pickupDateTime: str(node?.pickupDateTime) ?? '',
    pickup: str(node?.pickupLocation) ?? '',
    dropoff: str(node?.dropoffLocation) ?? '',
    total: typeof node?.price === 'number' ? node.price : null,
    state: str(node?.state) ?? 'PENDING',
    language: str(node?.language) ?? 'de',
    customerStatus: status,
    statusAt:
      status && status !== 'NEW' ? instants[INSTANT_OF[status]] : undefined,
    invoicedAt: instants.invoicedAt,
    paidAt: instants.paidAt
  }
}

const readCustomerBillingPage = async (args: {
  first: number
  after?: string
}): Promise<CustomerBillingPage> => {
  const listArgs: Record<string, unknown> = {first: args.first}
  if (args.after) listArgs.after = args.after
  const code = (await hasTransferField('code')) ? 'code ' : ''
  const status = (await hasTransferField('customerStatus'))
    ? `customerStatus language ${await statusInstantSelection()} `
    : ''
  const result = await call(
    'transfers',
    {args: listArgs},
    `{ totalCount pageInfo { endCursor hasNextPage } edges { node { id ${code}pickupDateTime pickupLocation dropoffLocation price state ${status}} } }`
  )
  return {
    rows: (Array.isArray(result?.edges) ? result.edges : [])
      .map((e: any) => e?.node)
      .filter(Boolean)
      .map(mapCustomerBilling),
    endCursor: result?.pageInfo?.endCursor ?? null,
    hasNextPage: !!result?.pageInfo?.hasNextPage,
    totalCount: typeof result?.totalCount === 'number' ? result.totalCount : 0
  }
}

/**
 * The caller's own rides with their money status, one page at a time in
 * the backend's order (pickup descending), under the bookings domain so a
 * write that moves a status refreshes it with the booking list.
 */
export function useCustomerBilling(pageSize = DEFAULT_PAGE_SIZE) {
  // The size is the pager's, remembered beside this table's column layout.
  const pager = usePager('customer-billing', {
    tableId: 'customer-billing',
    defaultSize: pageSize
  })
  const size = pager.pageSize
  const pageArgs = useMemo(
    () => ({first: size, after: pager.after}),
    [size, pager.after]
  )
  const {
    query: q,
    isLoading,
    error,
    isFetching,
    refetch
  } = useAppQuery({
    queryKey: customerBillingKey({...pageArgs}),
    queryFn: () => readCustomerBillingPage(pageArgs),
    placeholderData: keepPreviousData
  })
  const page = q.data
  const rows = page?.rows ?? EMPTY_BILLING_ROWS
  const pagination = useMemo<OfferPagination>(() => {
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
  return {
    rows,
    isLoading,
    error,
    isFetching,
    pagination,
    pageSize: size,
    setPageSize: pager.setPageSize,
    nextPage,
    prevPage: pager.prev,
    firstPage: pager.first,
    refetch
  }
}

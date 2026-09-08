/**
 * Statements: the months that have one, the rides of one, and the file.
 *
 * The list is a GraphQL read, `statementMonths(args: {userId})`, answered
 * for an admin about anybody and for everyone else about themselves only,
 * the backend decides. The file is not GraphQL: it is streamed from Google's
 * export of the tab by a Hono route on the same Worker,
 * `GET /statements/:userId/:month.:format`. The app does not fetch it. It
 * asks `statementUrl(args)` for a signed link that lives fifteen minutes
 * and opens that link the way it opens a document, so the browser and the
 * installed app download the same way and nothing is handed over as a
 * blob, which a phone's installed app refused without a word. See
 * okf/architecture/customer-experience.md, section 4, and finance.md.
 *
 * The reads are queries of the one client in ./query.ts, `['statements',
 * userId]` for the months and `['statements', userId, month, kind]` for the
 * lines of one. See okf/architecture/data-layer.md.
 *
 * At the bottom, the documents of many rides at once: the lists render an
 * invoice or an offer button only where the document exists
 * (customer-experience.md, section 5), and a list of twenty five rides
 * asks once, one request with an alias per ride, rather than once per row.
 */
import {gql} from './bookings'
import {cachedRead, keys, queryClient, useAppQuery} from './query'
import {mapDocument, type TransferDocument} from './documents'
import {fetchGraphQL} from '../../client/limosen'
import {appError} from '../errors'

export type StatementKind = 'CUSTOMER' | 'DRIVER'
export type StatementFormat = 'pdf' | 'xlsx'

export interface StatementMonth {
  /** YYYY-MM */
  month: string
  kind: StatementKind
}

/** One ride of a statement, as `statementLines` answers it from the database. */
export interface StatementLine {
  nr: number
  /** The transfer code, BQ7Q4W-1, what the invoice line quotes. */
  code: string
  transferId: string
  /** YYYY-MM-DD and HH:mm, in the company's time. */
  date: string
  time: string
  pickup: string
  dropoff: string
  vehicle: string
  amount: number | null
  payment: string
  /** The driver's Anteil on a driver statement, null on an invoice. */
  share: number | null
  /**
   * The cash the driver was handed on this ride, on a driver statement
   * (dispatch.md section 14.3): what the driver recorded, else the fare of a
   * ride marked CASH, which is what the settlement's Bar-erhalten column has
   * always meant. Null on an invoice line and on a pylon without the columns.
   */
  cash: number | null
  /** When the cash was recorded, ISO, and the Zitadel id of whoever recorded it. */
  cashAt?: string
  cashBy?: string
}

/**
 * Which fields the deployed `StatementLine` carries. The cash of a line
 * arrived with dispatch.md section 14.3, so it is asked for only where the
 * pylon answers it: a site built ahead of its pylon reads the month's rides
 * without the column rather than failing the whole read. Asked once through
 * the query client, and an endpoint that will not introspect is taken to be
 * the current schema.
 */
const statementLineFields = async (): Promise<Set<string>> => {
  try {
    const names = await cachedRead(keys.schema('statementLine'), async () => {
      const result: any = await fetchGraphQL(
        {
          query:
            'query { line: __type(name: "StatementLine") { fields { name } } }',
          variables: undefined,
          operationName: undefined
        },
        {}
      )
      const fields = result?.data?.line?.fields
      return Array.isArray(fields)
        ? fields.map((f: any) => String(f?.name)).filter(Boolean)
        : []
    })
    return new Set(names)
  } catch {
    return new Set<string>()
  }
}

const MONTH = /^\d{4}-\d{2}$/

export async function fetchStatementMonths(
  userId: string
): Promise<StatementMonth[]> {
  const rows = await gql('statementMonths', {args: {userId}}, '{ month kind }')
  return (
    (Array.isArray(rows) ? rows : [])
      .map((r: any) => ({
        month: String(r?.month ?? ''),
        kind: (String(r?.kind ?? '').toUpperCase() === 'DRIVER'
          ? 'DRIVER'
          : 'CUSTOMER') as StatementKind
      }))
      .filter((r: StatementMonth) => MONTH.test(r.month))
      // Newest first, the month somebody is looking for is almost always the last one.
      .sort((a: StatementMonth, b: StatementMonth) =>
        b.month.localeCompare(a.month)
      )
  )
}

const EMPTY_MONTHS: StatementMonth[] = []

export function useStatementMonths(userId: string | undefined) {
  const {
    query: q,
    isLoading,
    error,
    isFetching,
    refetch
  } = useAppQuery({
    queryKey: keys.statements(userId ?? ''),
    queryFn: () => fetchStatementMonths(userId ?? ''),
    enabled: !!userId
  })
  return {months: q.data ?? EMPTY_MONTHS, isLoading, error, isFetching, refetch}
}

export async function fetchStatementLines(
  userId: string,
  month: string,
  kind: StatementKind
): Promise<StatementLine[]> {
  const known = await statementLineFields()
  const has = (name: string) => known.size === 0 || known.has(name)
  const cashFields = ['cash', 'cashAt', 'cashBy'].filter(has).join(' ')
  const rows = await gql(
    'statementLines',
    {args: {userId, month, kind}},
    `{ nr code transferId date time pickup dropoff vehicle amount payment share${cashFields ? ' ' + cashFields : ''} }`
  )
  return (Array.isArray(rows) ? rows : []).map((r: any) => ({
    nr: Number(r?.nr ?? 0),
    code: String(r?.code ?? ''),
    transferId: String(r?.transferId ?? ''),
    date: String(r?.date ?? ''),
    time: String(r?.time ?? ''),
    pickup: String(r?.pickup ?? ''),
    dropoff: String(r?.dropoff ?? ''),
    vehicle: String(r?.vehicle ?? ''),
    amount: typeof r?.amount === 'number' ? r.amount : null,
    payment: String(r?.payment ?? ''),
    share: typeof r?.share === 'number' ? r.share : null,
    cash: typeof r?.cash === 'number' ? r.cash : null,
    cashAt: typeof r?.cashAt === 'string' ? r.cashAt : undefined,
    cashBy: typeof r?.cashBy === 'string' ? r.cashBy : undefined
  }))
}

const EMPTY_LINES: StatementLine[] = []

/**
 * The rides of one statement, loaded when asked for (`enabled`), because a
 * month is opened far less often than the list is looked at.
 */
export function useStatementLines(
  userId: string | undefined,
  month: string,
  kind: StatementKind,
  enabled: boolean
) {
  const {
    query: q,
    isLoading,
    error,
    refetch
  } = useAppQuery({
    queryKey: keys.statementLines(userId ?? '', month, kind),
    queryFn: () => fetchStatementLines(userId ?? '', month, kind),
    enabled: !!userId && enabled
  })
  return {lines: q.data ?? EMPTY_LINES, isLoading, error, refetch}
}

// --------------- The file ---------------

/**
 * A signed link to the statement file, good for fifteen minutes from now,
 * `statementUrl(args: {userId, month, format, kind})`. `kind` picks the tab
 * when the same month has both an invoice and a settlement, which is the
 * case for a person who is a customer and a driver at once. Without it the
 * Worker prefers the customer tab.
 */
export const fetchStatementUrl = async (
  userId: string,
  month: string,
  format: StatementFormat,
  kind?: StatementKind
): Promise<string> => {
  if (!MONTH.test(month)) throw appError('InvalidMonth', 'invalid month')
  const url = await gql(
    'statementUrl',
    {args: {userId, month, format, kind}},
    ''
  )
  if (typeof url !== 'string' || !url)
    throw appError('NoLink', 'no link in the answer')
  return url
}

/**
 * Open the statement file. The tab is opened on the click, before the link
 * is fetched, so a popup blocker sees a user gesture, and it is pointed at
 * the signed link when that arrives. The Worker answers the file as an
 * attachment, so the tab becomes a download and a browser closes it again.
 * A refusal closes the tab and throws, so the screen can say why. The same
 * shape as openDocument in ./documents.ts, on purpose.
 */
export async function openStatement(
  userId: string,
  month: string,
  format: StatementFormat,
  kind?: StatementKind
): Promise<void> {
  const tab = typeof window !== 'undefined' ? window.open('', '_blank') : null
  try {
    const url = await fetchStatementUrl(userId, month, format, kind)
    if (tab) tab.location.href = url
    else if (typeof window !== 'undefined') window.location.href = url
  } catch (err) {
    tab?.close()
    throw err
  }
}

// --------------- The documents of many rides ---------------

/** The offer and the invoice of a ride, when they exist. Either is undefined otherwise. */
export interface RideDocuments {
  offer?: TransferDocument
  invoice?: TransferDocument
}

const DOCUMENT_FIELDS =
  '{ id transferId kind number filename contentType size language createdAt }'

/** A GraphQL alias for a transfer id: letters and digits only. */
const alias = (i: number) => `r${i}`

/**
 * `transferDocuments(args: {transferId})` for every id in one request, an
 * alias per ride. The pylon refuses a ride that is not the caller's with
 * FORBIDDEN on that alias alone, and answers a driver nothing, so a refused
 * alias is read as "no documents" here rather than as a failure of the
 * whole list: the lists still draw, without a button on that row. The ids
 * are sent sorted and distinct so the same set is one cache entry.
 */
export async function fetchRideDocuments(
  transferIds: readonly string[]
): Promise<Record<string, RideDocuments>> {
  const ids = Array.from(new Set(transferIds.filter(Boolean))).sort()
  const out: Record<string, RideDocuments> = {}
  if (!ids.length) return out
  const body = ids
    .map(
      (id, i) =>
        `${alias(i)}: transferDocuments(args: {transferId: ${JSON.stringify(id)}}) ${DOCUMENT_FIELDS}`
    )
    .join(' ')
  const result: any = await fetchGraphQL(
    {
      query: `query { ${body} }`,
      variables: undefined,
      operationName: undefined
    },
    {}
  )
  const data = result?.data ?? {}
  ids.forEach((id, i) => {
    const rows = data[alias(i)]
    if (!Array.isArray(rows)) return
    const docs = rows.map(mapDocument)
    out[id] = {
      offer: docs.find(d => d.kind === 'OFFER'),
      invoice: docs.find(d => d.kind === 'INVOICE')
    }
  })
  return out
}

const EMPTY_DOCUMENTS: Record<string, RideDocuments> = {}

/**
 * The documents of the rides on a screen, one query per set of ids under
 * `['documents', 'rides', ids]`, so an upload's `invalidateDocuments()`
 * without an id refreshes it too. `enabled` is false for a driver, who is
 * answered nothing and has no button to draw.
 */
export function useRideDocuments(
  transferIds: readonly string[],
  enabled = true
) {
  const ids = Array.from(new Set(transferIds.filter(Boolean))).sort()
  const {query: q, refetch} = useAppQuery({
    queryKey: ['documents', 'rides', ids] as const,
    queryFn: () => fetchRideDocuments(ids),
    enabled: enabled && ids.length > 0
  })
  return {documents: q.data ?? EMPTY_DOCUMENTS, refetch}
}

// --------------- The Fahrer half: the payouts ---------------

/**
 * A driver's month marked as paid out, `DriverPayout` as the pylon answers
 * it (finance.md, "The billing screen, both sides"). `revocable` is the
 * pylon's word on whether "Zurücknehmen" is still offered: the same Vienna
 * day as `paidAt`.
 */
export interface DriverPayout {
  id: string
  driverId: string
  month: string
  amount: number
  paidAt: string
  by: string
  note: string | null
  revocable: boolean
}

/** One row of the Fahrer table: a driver's month, its money and its payout status. */
export interface DriverBillingRow {
  driverId: string
  /** The display name, empty when the caller may not read the directory (a driver reading their own). */
  name: string
  /** Hex, or undefined when the driver never chose one. */
  color?: string
  /** YYYY-MM */
  month: string
  rides: number
  revenue: number
  cash: number
  share: number
  expenses: number
  /** share − cash − expenses, the Auszahlung. */
  payoutDue: number
  percent: number
  /** Whether the DRV_ tab exists, so the file buttons are drawn only where the file is. */
  statement: boolean
  payout: DriverPayout | null
}

const PAYOUT_FIELDS = '{ id driverId month amount paidAt by note revocable }'
const BILLING_FIELDS = `{ driverId name color month rides revenue cash share expenses payoutDue percent statement payout ${PAYOUT_FIELDS} }`

const num = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : 0

/** The backend's silver default means nobody chose a colour, undefined here like the dashboard reads it. */
const colourOf = (v: unknown): string | undefined =>
  typeof v === 'string' && v && v.toUpperCase() !== '#C0C0C0' ? v : undefined

const mapPayout = (raw: any): DriverPayout | null =>
  raw && typeof raw === 'object'
    ? {
        id: String(raw.id ?? ''),
        driverId: String(raw.driverId ?? ''),
        month: String(raw.month ?? ''),
        amount: num(raw.amount),
        paidAt: String(raw.paidAt ?? ''),
        by: String(raw.by ?? ''),
        note: typeof raw.note === 'string' && raw.note ? raw.note : null,
        revocable: raw.revocable === true
      }
    : null

const mapBillingRow = (raw: any): DriverBillingRow => ({
  driverId: String(raw?.driverId ?? ''),
  name: typeof raw?.name === 'string' ? raw.name : '',
  color: colourOf(raw?.color),
  month: String(raw?.month ?? ''),
  rides: num(raw?.rides),
  revenue: num(raw?.revenue),
  cash: num(raw?.cash),
  share: num(raw?.share),
  expenses: num(raw?.expenses),
  payoutDue: num(raw?.payoutDue),
  percent: num(raw?.percent),
  statement: raw?.statement === true,
  payout: mapPayout(raw?.payout)
})

export interface DriverPayoutsArgs {
  /** YYYY-MM for one month, absent for the last twelve. */
  month?: string
  /** An admin narrows to one driver; a driver's own id or nothing for a driver caller. */
  driverId?: string
}

/** `['driverPayouts', month, driverId]`, invalidated as a whole by the two writes. */
export const driverPayoutsKey = (args: DriverPayoutsArgs) =>
  ['driverPayouts', args.month ?? '', args.driverId ?? ''] as const

/**
 * `driverPayouts(args: {month?, driverId?})`: the rows of the Fahrer half,
 * every driver for an admin, their own for a driver, the backend decides.
 */
export async function fetchDriverPayouts(
  args: DriverPayoutsArgs
): Promise<DriverBillingRow[]> {
  const listArgs: Record<string, unknown> = {}
  if (args.month) listArgs.month = args.month
  if (args.driverId) listArgs.driverId = args.driverId
  const rows = await gql('driverPayouts', {args: listArgs}, BILLING_FIELDS)
  return (Array.isArray(rows) ? rows : [])
    .map(mapBillingRow)
    .filter((row: DriverBillingRow) => MONTH.test(row.month))
}

const EMPTY_BILLING: DriverBillingRow[] = []

export function useDriverPayouts(args: DriverPayoutsArgs, enabled = true) {
  const {
    query: q,
    isLoading,
    error,
    isFetching,
    refetch
  } = useAppQuery({
    queryKey: driverPayoutsKey(args),
    queryFn: () => fetchDriverPayouts(args),
    enabled
  })
  return {rows: q.data ?? EMPTY_BILLING, isLoading, error, isFetching, refetch}
}

/** Every payouts list and the dashboard, whose payout due reads the open months, after a mark or a revoke. */
export const invalidateDriverPayouts = () =>
  Promise.all([
    queryClient.invalidateQueries({queryKey: ['driverPayouts']}),
    queryClient.invalidateQueries({queryKey: ['dashboard']})
  ]).then(() => undefined)

/**
 * `markDriverPayout(args: {driverId, month, note})`: the month is paid
 * out, admin only, idempotent on the backend. Answers the payout row.
 */
export async function markDriverPayout(
  driverId: string,
  month: string,
  note?: string
): Promise<DriverPayout> {
  if (!MONTH.test(month)) throw appError('InvalidMonth', 'invalid month')
  const args: Record<string, unknown> = {driverId, month}
  const trimmed = note?.trim()
  if (trimmed) args.note = trimmed
  const raw = await gql('markDriverPayout', {args}, PAYOUT_FIELDS, 'mutation')
  const payout = mapPayout(raw)
  if (!payout) throw appError('NoLink', 'no payout in the answer')
  await invalidateDriverPayouts()
  return payout
}

/**
 * `revokeDriverPayout(args: {driverId, month})`: the mark is taken back,
 * on the day it was written only. The backend answers PAYOUT_LOCKED for an
 * earlier day and NOT_FOUND for a month that is not marked.
 */
export async function revokeDriverPayout(
  driverId: string,
  month: string
): Promise<DriverPayout> {
  if (!MONTH.test(month)) throw appError('InvalidMonth', 'invalid month')
  const raw = await gql(
    'revokeDriverPayout',
    {args: {driverId, month}},
    PAYOUT_FIELDS,
    'mutation'
  )
  const payout = mapPayout(raw)
  if (!payout) throw appError('NoLink', 'no payout in the answer')
  await invalidateDriverPayouts()
  return payout
}

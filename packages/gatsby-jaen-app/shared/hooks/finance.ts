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
import {keys, useAppQuery} from './query'
import {mapDocument, type TransferDocument} from './documents'
import {fetchGraphQL} from '../../client/limosen'

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
  const rows = await gql(
    'statementLines',
    {args: {userId, month, kind}},
    '{ nr code transferId date time pickup dropoff vehicle amount payment share }'
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
    share: typeof r?.share === 'number' ? r.share : null
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
  if (!MONTH.test(month)) throw new Error('Invalid month')
  const url = await gql(
    'statementUrl',
    {args: {userId, month, format, kind}},
    ''
  )
  if (typeof url !== 'string' || !url) throw new Error('no link in the answer')
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

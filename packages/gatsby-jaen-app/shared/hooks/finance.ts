/**
 * Statements: the months that have one, and the file itself.
 *
 * The list is a GraphQL read, `statementMonths(args: {userId})`, answered
 * for an admin about anybody and for everyone else about themselves only,
 * the backend decides. The file is not GraphQL: it is streamed from Google's
 * export of the tab by a Hono route on the same Worker,
 * `GET /statements/:userId/:month.:format`, with the same bearer token the
 * GraphQL client sends. The browser cannot be pointed at that URL directly,
 * a navigation carries no Authorization header, so the file is fetched here
 * and handed over as a blob. See okf/architecture/finance.md, the download.
 *
 * The reads are queries of the one client in ./query.ts, `['statements',
 * userId]` for the months and `['statements', userId, month, kind]` for the
 * lines of one. See okf/architecture/data-layer.md.
 */
import {User} from 'oidc-client-ts'
import {endpointUrl} from '../../client/limosen'
import {gql} from './bookings'
import {keys, useAppQuery} from './query'

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

declare const __JAEN_ZITADEL_GQL__:
  | {authority?: string; clientId?: string}
  | undefined

/**
 * The bearer token of the session in this tab, read the way the GraphQL
 * client reads it, so the download is made by the same person as the list.
 */
const accessToken = (): string | undefined => {
  try {
    const z =
      typeof __JAEN_ZITADEL_GQL__ !== 'undefined' ? __JAEN_ZITADEL_GQL__ : null
    if (!z?.authority || !z?.clientId) return undefined
    const raw = window.sessionStorage?.getItem(`oidc.user:${z.authority}:${z.clientId}`)
    if (!raw) return undefined
    return User.fromStorageString(raw)?.access_token || undefined
  } catch {
    return undefined
  }
}

const MONTH = /^\d{4}-\d{2}$/

/**
 * The route lives beside /graphql on the same Worker. `kind` picks the tab
 * when the same month has both an invoice and a settlement, which is the
 * case for a person who is a customer and a driver at once. Without it the
 * Worker prefers the customer tab.
 */
export const statementUrl = (
  userId: string,
  month: string,
  format: StatementFormat,
  kind?: StatementKind
): string => {
  const url = new URL(
    `/statements/${encodeURIComponent(userId)}/${encodeURIComponent(month)}.${format}`,
    endpointUrl
  )
  if (kind) url.searchParams.set('kind', kind)
  return url.toString()
}

export async function fetchStatementMonths(userId: string): Promise<StatementMonth[]> {
  const rows = await gql('statementMonths', {args: {userId}}, '{ month kind }')
  return (Array.isArray(rows) ? rows : [])
    .map((r: any) => ({
      month: String(r?.month ?? ''),
      kind: (String(r?.kind ?? '').toUpperCase() === 'DRIVER' ? 'DRIVER' : 'CUSTOMER') as StatementKind
    }))
    .filter((r: StatementMonth) => MONTH.test(r.month))
    // Newest first, the month somebody is looking for is almost always the last one.
    .sort((a: StatementMonth, b: StatementMonth) => b.month.localeCompare(a.month))
}

const EMPTY_MONTHS: StatementMonth[] = []

export function useStatementMonths(userId: string | undefined) {
  const {query: q, isLoading, error, refetch} = useAppQuery({
    queryKey: keys.statements(userId ?? ''),
    queryFn: () => fetchStatementMonths(userId ?? ''),
    enabled: !!userId
  })
  return {months: q.data ?? EMPTY_MONTHS, isLoading, error, refetch}
}

export async function fetchStatementLines(userId: string, month: string, kind: StatementKind): Promise<StatementLine[]> {
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
export function useStatementLines(userId: string | undefined, month: string, kind: StatementKind, enabled: boolean) {
  const {query: q, isLoading, error, refetch} = useAppQuery({
    queryKey: keys.statementLines(userId ?? '', month, kind),
    queryFn: () => fetchStatementLines(userId ?? '', month, kind),
    enabled: !!userId && enabled
  })
  return {lines: q.data ?? EMPTY_LINES, isLoading, error, refetch}
}

/** The file name the Worker chose, or one built from what was asked for. */
const fileNameFrom = (response: Response, fallback: string): string => {
  const header = response.headers.get('content-disposition') ?? ''
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1])
    } catch {
      /* fall through to the plain name */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header)
  return plain?.[1] || fallback
}

/**
 * Fetch the statement with the bearer token and hand the file to the browser
 * through a temporary object URL on an anchor with `download`. The anchor
 * is what makes it a save rather than a navigation, and the object URL is
 * revoked once the click has been dispatched.
 */
export async function downloadStatement(
  userId: string,
  month: string,
  format: StatementFormat,
  kind?: StatementKind
): Promise<void> {
  if (!MONTH.test(month)) throw new Error('Invalid month')

  const token = accessToken()
  const response = await fetch(statementUrl(userId, month, format, kind), {
    method: 'GET',
    mode: 'cors',
    headers: token ? {Authorization: `Bearer ${token}`} : {}
  })

  if (!response.ok) {
    // The Worker answers a refusal in the GraphQL shape, {errors: [{message,
    // extensions: {code}}]}, so the message stays distinguishable: 401 is
    // sign in, 403 is not yours, 404 is no tab for that month.
    let detail = ''
    try {
      const body = await response.json()
      const first = Array.isArray(body?.errors) ? body.errors[0] : undefined
      detail = String(first?.message ?? first?.extensions?.code ?? body?.message ?? '')
    } catch {
      /* the body was not JSON, the status is enough */
    }
    throw new Error(detail ? `${response.status} ${detail}` : `HTTP ${response.status}`)
  }

  const blob = await response.blob()
  const name = fileNameFrom(response, `${kind ? kind.toLowerCase() : 'statement'}_${month}.${format}`)
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.rel = 'noopener'
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    // Not before the click has been handled, some browsers read the URL late.
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
}

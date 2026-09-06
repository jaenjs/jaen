/**
 * The statements of one person: a row per month that has one, with PDF and
 * Excel, and on request the rides the month contains, each under its code,
 * the same lines the tab carries. A return booking is two lines, -1 and -2.
 *
 * Both lists are the shared DataTable (okf/architecture/data-layer.md,
 * acceptance 4, and finance.md, "The statements screen"): the months grouped
 * by year, the lines of the opened month grouped by day with the code first,
 * the driver's colour on the left edge and the day's tone on the right, the
 * money right aligned, the column popover, and cards below `md`. The lines
 * are drawn under the months, not inside them, because one row of the months
 * table is one statement and its rides are a list of their own.
 *
 * Reused in two places. The customer's own page passes the caller's id,
 * the dispatcher's user detail screen passes the user it is showing, and
 * the backend decides whether that pair is allowed: an admin about anybody,
 * everyone else about themselves. `kind` says whether the month is an
 * invoice or a driver settlement, a person who is both gets both rows.
 */
import {useMemo, useState} from 'react'
import {Box, Button, ButtonGroup, HStack, Stack, Text} from '@chakra-ui/react'
import {FaFileInvoice} from '@react-icons/all-files/fa/FaFileInvoice'
import {FaFilePdf} from '@react-icons/all-files/fa/FaFilePdf'
import {FaFileExcel} from '@react-icons/all-files/fa/FaFileExcel'
import {FaChevronUp} from '@react-icons/all-files/fa/FaChevronUp'
import {useI18nCode, type I18nCode} from '../i18n'
import {getI18nBookings} from '../locales/i18nBookings'
import {fill} from '../locales/i18nCommon'
import {useAppNavigate} from '../navigation'
import {fetchDriverColor} from '../hooks'
import {keys, useAppQuery} from '../hooks/query'
import {
  downloadStatement,
  useStatementLines,
  useStatementMonths,
  type StatementFormat,
  type StatementKind,
  type StatementLine,
  type StatementMonth
} from '../hooks/finance'
import {EmptyState, MoneyText, toaster, PageHeader} from '../components'
import {DataTable, type DataColumn, type DataGroup} from '../components/table'
import {dayPalette, formatDay, useTodayTomorrow} from './TransfersView'

type Strings = ReturnType<typeof getI18nBookings>['strings']

/** "September 2026" in the account's language, the month key otherwise. */
const useMonthLabel = (code: I18nCode) =>
  useMemo(() => {
    const format = new Intl.DateTimeFormat(code, {month: 'long', year: 'numeric'})
    return (month: string) => {
      const [y, m] = month.split('-').map(Number)
      if (!y || !m) return month
      return format.format(new Date(y, m - 1, 1))
    }
  }, [code])

const kindLabel = (kind: StatementKind, t: Strings) =>
  kind === 'DRIVER' ? t.StatementsKindDRIVER : t.StatementsKindCUSTOMER

/**
 * WHO on a statement line. A driver settlement is one driver's month, so
 * every line carries that driver's colour. An invoice lists the customer's
 * rides and `statementLines` does not say who drove each of them, so the
 * left edge stays neutral there.
 */
const useStatementStripe = (userId: string | undefined, kind: StatementKind): string | undefined => {
  const {query: q} = useAppQuery({
    queryKey: keys.driverColor(userId ?? ''),
    queryFn: () => fetchDriverColor(userId ?? ''),
    enabled: !!userId && kind === 'DRIVER'
  })
  // A driver without a colour answers undefined, which Query files as a
  // failed read, so the answer is read only from a successful one.
  return kind === 'DRIVER' && q.isSuccess ? q.data : undefined
}

/**
 * The rides of one month, code first, grouped by day. Loaded when the month
 * is opened. The code is the link to the ride, the uuid stays in the row id.
 */
function StatementLines({
  userId,
  month,
  kind,
  t
}: {
  userId: string | undefined
  month: string
  kind: StatementKind
  t: Strings
}) {
  const code = useI18nCode()
  const navigate = useAppNavigate()
  const {lines, isLoading, error, refetch} = useStatementLines(userId, month, kind, true)
  const stripe = useStatementStripe(userId, kind)
  const {today, tomorrow} = useTodayTomorrow()

  const columns = useMemo<DataColumn<StatementLine>[]>(() => {
    const own: DataColumn<StatementLine>[] = [
      {
        id: 'code',
        label: t.StatementsColCode,
        width: 120,
        cell: line => (
          <Text as="span" fontFamily="mono" fontWeight="medium" whiteSpace="nowrap">
            {line.code}
          </Text>
        )
      },
      {
        id: 'nr',
        label: t.StatementsColNr,
        width: 56,
        align: 'end',
        cell: line => (
          <Text as="span" color="fg.muted" fontVariantNumeric="tabular-nums">
            {line.nr}
          </Text>
        )
      },
      {
        id: 'time',
        label: t.StatementsColDate,
        width: 140,
        cell: line => (
          <Text as="span" whiteSpace="nowrap" fontVariantNumeric="tabular-nums">
            {line.date} {line.time}
          </Text>
        )
      },
      {
        id: 'route',
        label: t.StatementsColRoute,
        width: 320,
        cell: line => (
          <Text color="fg.muted" lineClamp={1}>
            {line.pickup} → {line.dropoff}
          </Text>
        )
      },
      {
        id: 'vehicle',
        label: t.StatementsColVehicle,
        width: 140,
        defaultVisible: false,
        cell: line => <Text color="fg.muted">{line.vehicle}</Text>
      },
      {
        id: 'payment',
        label: t.StatementsColPayment,
        width: 120,
        defaultVisible: false,
        cell: line => <Text color="fg.muted">{line.payment}</Text>
      },
      {
        id: 'amount',
        label: t.StatementsColAmount,
        width: 120,
        align: 'end',
        cell: line => <MoneyText value={line.amount} />
      }
    ]
    if (kind === 'DRIVER') {
      own.push({
        id: 'share',
        label: t.StatementsColShare,
        width: 120,
        align: 'end',
        cell: line => <MoneyText value={line.share} />
      })
    }
    return own
  }, [t, kind])

  const group = useMemo<DataGroup<StatementLine>>(
    () => ({
      key: line => line.date,
      label: day => formatDay(day, code),
      tone: day => dayPalette(day, today, tomorrow)
    }),
    [code, today, tomorrow]
  )

  return (
    <DataTable
      tableId={kind === 'DRIVER' ? 'statement-lines-driver' : 'statement-lines'}
      columns={columns}
      rows={lines}
      rowId={line => line.transferId}
      onOpen={line => navigate(`/transfers/${line.code || line.transferId}`)}
      group={group}
      stripe={() => stripe}
      summary={fill(t.StatementsLinesCount, {count: lines.length})}
      isLoading={isLoading}
      error={error ? t.StatementsLinesError : null}
      onRetry={refetch}
      empty={
        <Text textStyle="sm" color="fg.muted" px="3" py="2">
          {t.StatementsLinesEmpty}
        </Text>
      }
    />
  )
}

export interface StatementsViewProps {
  /** Whose statements. The backend refuses a user that is not the caller's own unless the caller is an admin. */
  userId: string | undefined
  /** Without the page heading, for embedding in another screen. */
  embedded?: boolean
}

export function StatementsView({userId, embedded = false}: StatementsViewProps) {
  const code = useI18nCode()
  const {strings: t} = getI18nBookings(code)
  const {months, isLoading, error, refetch} = useStatementMonths(userId)
  const [busy, setBusy] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const monthLabel = useMonthLabel(code)

  const rowKey = (row: StatementMonth) => `${row.kind}-${row.month}`
  const toggle = (row: StatementMonth) => setOpen(prev => (prev === rowKey(row) ? null : rowKey(row)))
  const opened = open ? months.find(row => rowKey(row) === open) : undefined

  const download = async (row: StatementMonth, format: StatementFormat) => {
    if (!userId) return
    const key = `${row.kind}:${row.month}:${format}`
    setBusy(key)
    try {
      await downloadStatement(userId, row.month, format, row.kind)
    } catch (err) {
      toaster.error({
        title: t.StatementsDownloadError,
        description: err instanceof Error ? err.message : String(err)
      })
    } finally {
      setBusy(null)
    }
  }

  // The two files of a month. On a desk they sit in the row, on a phone in
  // the card, where a button is a thumb's 44px (hard-rules.md).
  const files = (row: StatementMonth) => (
    <ButtonGroup size="sm" variant="outline" gap="2" onClick={e => e.stopPropagation()}>
      <Button
        minH={{base: '44px', md: '8'}}
        onClick={() => void download(row, 'pdf')}
        loading={busy === `${row.kind}:${row.month}:pdf`}
        disabled={busy !== null && busy !== `${row.kind}:${row.month}:pdf`}>
        <FaFilePdf /> {t.StatementsDownloadPdf}
      </Button>
      <Button
        minH={{base: '44px', md: '8'}}
        onClick={() => void download(row, 'xlsx')}
        loading={busy === `${row.kind}:${row.month}:xlsx`}
        disabled={busy !== null && busy !== `${row.kind}:${row.month}:xlsx`}>
        <FaFileExcel /> {t.StatementsDownloadXlsx}
      </Button>
    </ButtonGroup>
  )

  const columns = useMemo<DataColumn<StatementMonth>[]>(
    () => [
      {
        id: 'month',
        label: t.StatementsColMonth,
        width: 200,
        cell: row => (
          <Text as="span" fontWeight="medium" whiteSpace="nowrap">
            {monthLabel(row.month)}
          </Text>
        )
      },
      {
        id: 'kind',
        label: t.StatementsColKind,
        width: 180,
        cell: row => <Text color="fg.muted">{kindLabel(row.kind, t)}</Text>
      },
      {
        id: 'files',
        label: t.StatementsColFiles,
        width: 200,
        cell: files
      }
    ],
    // `files` closes over busy, which is why it is not in the list: a spinner
    // on one button is not a new set of columns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, monthLabel, busy]
  )

  const group = useMemo<DataGroup<StatementMonth>>(
    () => ({
      key: row => row.month.slice(0, 4),
      label: year => year
    }),
    []
  )

  const body = (
    <>
      <DataTable
        tableId="statements"
        columns={columns}
        rows={months}
        rowId={rowKey}
        onOpen={toggle}
        group={group}
        actionLabel={t.StatementsLinesShow}
        summary={fill(t.StatementsCount, {count: months.length})}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        empty={<EmptyState title={t.StatementsEmpty} description={t.StatementsEmptyHint} icon={<FaFileInvoice />} />}
      />
      {opened && (
        <Stack gap="3" pt="2">
          <HStack justify="space-between" flexWrap="wrap" gap="2">
            <Box>
              <Text fontWeight="semibold">{monthLabel(opened.month)}</Text>
              <Text textStyle="sm" color="fg.muted">
                {kindLabel(opened.kind, t)}
              </Text>
            </Box>
            <Button size="sm" variant="ghost" minH="44px" onClick={() => setOpen(null)}>
              <FaChevronUp /> {t.StatementsLinesHide}
            </Button>
          </HStack>
          <StatementLines userId={userId} month={opened.month} kind={opened.kind} t={t} />
        </Stack>
      )}
    </>
  )

  if (embedded) {
    return <Stack gap="3">{body}</Stack>
  }

  return (
    <Box p={{base: '4', md: '6'}} maxW="full">
      <Stack gap="5">
        <PageHeader title={t.StatementsHeading} subtitle={t.StatementsSubtitle} />
        {body}
      </Stack>
    </Box>
  )
}

/**
 * Abrechnungen, /app/statements/, the billing screen with both sides
 * (okf/architecture/finance.md, "The billing screen, both sides").
 *
 * An admin gets two halves as tabs. **Kunden** is the offers table, one row
 * per offer document with the customer status and its instant, the invoice
 * and the paid instants, its status chips, the month filter and the search
 * (offers-and-documents.md, "The offers screen", moved in from
 * /app/offers/, which redirects here). **Fahrer** is one row per driver and
 * month on the DataTable: rides, revenue, cash taken, the share, the
 * expenses, the Auszahlung due, the payout status "offen" or "ausbezahlt am
 * dd.mm." with its instant, the month's statement as PDF and Excel where
 * the tab exists, and the actions "Als ausbezahlt markieren", which writes
 * a DriverPayout row through `markDriverPayout`, and "Zurücknehmen", which
 * removes it on the same day through `revokeDriverPayout`. A driver sees
 * the Fahrer half filtered to themselves, read only, with the status of
 * each month. A customer sees the Kunden half filtered to their own rides:
 * their monthly statements with the PDF and Excel, and one row per ride
 * with the invoice and the paid status. The backend scopes every read, the
 * roles here decide only which half is offered.
 *
 * The tab is `?tab=kunden` or `?tab=fahrer` on the address, read once on
 * mount and written back on a change, so the redirect from /app/offers/
 * and a bookmark land on the half they mean.
 *
 * The statement months table of a person (`StatementMonths`) stays what the
 * user detail screen embeds: the months grouped by year with the two files
 * and the Details word opening the month's rides, the lines grouped by day
 * with the code first, the driver's colour on the left edge of a driver
 * settlement, the money right aligned, cards below `md` (data-layer.md,
 * acceptance 4). Every table here is the shared DataTable, every view
 * registers its query for the refresh button and the pull.
 */
import {useCallback, useEffect, useMemo, useState, type ReactNode} from 'react'
import {
  Badge,
  Box,
  Button,
  ButtonGroup,
  Field,
  Flex,
  HStack,
  Input,
  InputGroup,
  Stack,
  Tabs,
  Text
} from '@chakra-ui/react'
import {FaFileInvoice} from '@react-icons/all-files/fa/FaFileInvoice'
import {FaFileContract} from '@react-icons/all-files/fa/FaFileContract'
import {FaFilePdf} from '@react-icons/all-files/fa/FaFilePdf'
import {FaFileExcel} from '@react-icons/all-files/fa/FaFileExcel'
import {FaChevronUp} from '@react-icons/all-files/fa/FaChevronUp'
import {FaSearch} from '@react-icons/all-files/fa/FaSearch'
import {FaUserTie} from '@react-icons/all-files/fa/FaUserTie'
import {useCaller} from '../auth'
import {useI18nCode, type I18nCode} from '../i18n'
import {getI18nBookings} from '../locales/i18nBookings'
import {getI18nCommon} from '../locales/i18nCommon'
import {fill} from '../locales/i18nCommon'
import {getI18nFinance, type FinanceStrings} from '../locales/i18nFinance'
import {getI18nOffers, type OffersStrings} from '../locales/i18nOffers'
import {useAppNavigate} from '../navigation'
import {fetchDriverColor} from '../hooks'
import {keys, useAppQuery} from '../hooks/query'
import {
  markDriverPayout,
  openStatement,
  revokeDriverPayout,
  useDriverPayouts,
  useRideDocuments,
  useStatementLines,
  useStatementMonths,
  type DriverBillingRow,
  type StatementFormat,
  type StatementKind,
  type StatementLine,
  type StatementMonth
} from '../hooks/finance'
import {
  CUSTOMER_STATUSES,
  useCustomerBilling,
  useOffers,
  type CustomerBillingRow,
  type CustomerStatus,
  type OfferRow
} from '../hooks/offers'
import {bookingPath} from '../hooks/bookings'
import {transferPath} from '../hooks/transfers'
import {
  ConfirmDialog,
  DriverColorDot,
  EmptyState,
  MoneyText,
  PageHeader,
  StatusBadge,
  toaster
} from '../components'
import {RefreshButton} from '../components/RefreshButton'
import {
  CustomerStatusBadge,
  CUSTOMER_STATUS_PALETTE
} from '../components/CustomerStatusBadge'
import {SectionHeading} from '../components/SectionHeading'
import {TableSkeleton} from '../components/skeletons'
import {useViewRefresh} from '../hooks/view-refresh'
import {DataTable, type DataColumn, type DataGroup} from '../components/table'
import {RideDocumentButtons} from '../components/documents/RideDocumentButtons'
import {
  dayPalette,
  formatDateTime,
  formatDay,
  useTodayTomorrow
} from './TransfersView'

type Strings = ReturnType<typeof getI18nBookings>['strings']

const PAGE_SIZE = 25

/** "September 2026" in the account's language, the month key otherwise. */
const useMonthLabel = (code: I18nCode) =>
  useMemo(() => {
    const format = new Intl.DateTimeFormat(code, {
      month: 'long',
      year: 'numeric'
    })
    return (month: string) => {
      const [y, m] = month.split('-').map(Number)
      if (!y || !m) return month
      return format.format(new Date(y, m - 1, 1))
    }
  }, [code])

/** "06.09." in the account's language, for "ausbezahlt am". */
const useShortDate = (code: I18nCode) =>
  useMemo(() => {
    const format = new Intl.DateTimeFormat(code, {
      day: '2-digit',
      month: '2-digit'
    })
    return (iso: string) => {
      const d = new Date(iso)
      return Number.isNaN(d.getTime()) ? iso : format.format(d)
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
const useStatementStripe = (
  userId: string | undefined,
  kind: StatementKind
): string | undefined => {
  const {query: q} = useAppQuery({
    queryKey: keys.driverColor(userId ?? ''),
    queryFn: () => fetchDriverColor(userId ?? ''),
    enabled: !!userId && kind === 'DRIVER'
  })
  // A driver without a colour answers undefined, which Query files as a
  // failed read, so the answer is read only from a successful one.
  return kind === 'DRIVER' && q.isSuccess ? q.data : undefined
}

// --------------- The rides of one statement month ---------------

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
  const {lines, isLoading, error, refetch} = useStatementLines(
    userId,
    month,
    kind,
    true
  )
  const stripe = useStatementStripe(userId, kind)
  const {today, tomorrow} = useTodayTomorrow()
  // The offer and the invoice of the month's rides, one request, so a
  // button is drawn only where the document exists (customer-experience.md,
  // section 5). A driver settlement carries no money documents.
  const {documents} = useRideDocuments(
    lines.map(line => line.transferId),
    kind === 'CUSTOMER'
  )

  const columns = useMemo<DataColumn<StatementLine>[]>(() => {
    const own: DataColumn<StatementLine>[] = [
      {
        id: 'code',
        label: t.StatementsColCode,
        width: 120,
        cell: line => (
          <Text
            as="span"
            fontFamily="mono"
            fontWeight="medium"
            whiteSpace="nowrap">
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
        width: 150,
        text: line => `${line.date} ${line.time}`,
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
        text: line => `${line.pickup} → ${line.dropoff}`,
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
    if (kind === 'CUSTOMER') {
      own.push({
        id: 'documents',
        label: t.StatementsColDocuments,
        width: 220,
        controls: true,
        cell: line => <RideDocumentButtons docs={documents[line.transferId]} />
      })
    }
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
  }, [t, kind, documents])

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

// --------------- The statement months of one person ---------------

export interface StatementMonthsProps {
  /** Whose statements. The backend refuses a user that is not the caller's own unless the caller is an admin. */
  userId: string | undefined
  /** Inside another screen, whose own query is the one registered for the refresh. */
  embedded?: boolean
}

/**
 * The statements of one person: a row per month that has one, with the
 * Monatsabrechnung as PDF and Excel opened through a signed link, and on
 * request the rides the month contains. Reused by the dispatcher's user
 * detail screen and by the customer's half of the billing screen.
 */
export function StatementMonths({
  userId,
  embedded = false
}: StatementMonthsProps) {
  const code = useI18nCode()
  const {strings: t} = getI18nBookings(code)
  const {months, isLoading, error, isFetching, refetch} =
    useStatementMonths(userId)
  useViewRefresh(refetch, isFetching, embedded)
  const [busy, setBusy] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const monthLabel = useMonthLabel(code)

  const rowKey = (row: StatementMonth) => `${row.kind}-${row.month}`
  const toggle = (row: StatementMonth) =>
    setOpen(prev => (prev === rowKey(row) ? null : rowKey(row)))
  const opened = open ? months.find(row => rowKey(row) === open) : undefined

  const download = async (row: StatementMonth, format: StatementFormat) => {
    if (!userId) return
    const key = `${row.kind}:${row.month}:${format}`
    setBusy(key)
    try {
      await openStatement(userId, row.month, format, row.kind)
    } catch (err) {
      toaster.error({
        title: t.StatementsDownloadError,
        description: err instanceof Error ? err.message : String(err)
      })
    } finally {
      setBusy(null)
    }
  }

  // The two files of a month, worded Monatsabrechnung so nobody takes them
  // for an invoice. Each opens the signed link the Worker answers, the way
  // a document opens. On a desk they sit in the row, on a phone in the
  // card, where a button is a thumb's 44px (hard-rules.md).
  const files = (row: StatementMonth) => (
    <ButtonGroup
      size="sm"
      variant="outline"
      gap="2"
      onClick={e => e.stopPropagation()}>
      <Button
        minH={{base: '44px', md: '8'}}
        onClick={() => void download(row, 'pdf')}
        data-testid="statement-pdf"
        loading={busy === `${row.kind}:${row.month}:pdf`}
        disabled={busy !== null && busy !== `${row.kind}:${row.month}:pdf`}>
        <FaFilePdf /> {t.StatementsDownloadPdf}
      </Button>
      <Button
        minH={{base: '44px', md: '8'}}
        onClick={() => void download(row, 'xlsx')}
        data-testid="statement-xlsx"
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
        text: row => monthLabel(row.month),
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
        text: row => kindLabel(row.kind, t),
        cell: row => <Text color="fg.muted">{kindLabel(row.kind, t)}</Text>
      },
      {
        // "Monatsabrechnung (PDF)" and "Monatsabrechnung (Excel)" side by
        // side are 480px of buttons, measured on booklimo.at, and the cell
        // adds its padding.
        id: 'files',
        label: t.StatementsColFiles,
        width: 510,
        controls: true,
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

  return (
    <Stack gap="3" data-testid="statement-months">
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
        empty={
          <EmptyState
            title={t.StatementsEmpty}
            description={t.StatementsEmptyHint}
            icon={<FaFileInvoice />}
          />
        }
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
            <Button
              size="sm"
              variant="ghost"
              minH="44px"
              onClick={() => setOpen(null)}>
              <FaChevronUp /> {t.StatementsLinesHide}
            </Button>
          </HStack>
          <StatementLines
            userId={userId}
            month={opened.month}
            kind={opened.kind}
            t={t}
          />
        </Stack>
      )}
    </Stack>
  )
}

// --------------- Kunden, the admin's half: the offers table ---------------

/** The six chips and "Alle", one selected at a time, pushed down to the resolver. */
function StatusChips({
  value,
  onChange,
  s
}: {
  value: CustomerStatus | undefined
  onChange: (v: CustomerStatus | undefined) => void
  s: OffersStrings
}) {
  return (
    <HStack gap="2" flexWrap="wrap" data-testid="offer-status-chips">
      <Button
        size="sm"
        minH={{base: '44px', md: '8'}}
        variant={value === undefined ? 'solid' : 'outline'}
        colorPalette={value === undefined ? 'brand' : 'gray'}
        onClick={() => onChange(undefined)}
        data-status="ALL">
        {s.FilterAll}
      </Button>
      {CUSTOMER_STATUSES.map(st => (
        <Button
          key={st}
          size="sm"
          minH={{base: '44px', md: '8'}}
          variant={value === st ? 'solid' : 'outline'}
          colorPalette={value === st ? CUSTOMER_STATUS_PALETTE[st] : 'gray'}
          onClick={() => onChange(value === st ? undefined : st)}
          data-status={st}>
          {s[`Status_${st}`]}
        </Button>
      ))}
    </HStack>
  )
}

/**
 * One row per offer document, newest first, the columns of the brief:
 * number, date, code, customer, language, pickup, total, status (the
 * customer status with its instant), sent to, and the document as a link.
 * The status chips, the month filter and the search are pushed down to
 * `offers(args)`, the pylon pages with Relay cursors and the board's pager
 * walks them. A row opens the ride's detail page at the offer timeline.
 */
export function OffersTable() {
  const navigate = useAppNavigate()
  const code = useI18nCode()
  const {strings: s} = getI18nOffers(code)

  const [status, setStatus] = useState<CustomerStatus | undefined>(undefined)
  const [month, setMonth] = useState('')
  const [search, setSearch] = useState('')

  const {
    rows,
    isLoading,
    error,
    isFetching,
    pagination,
    nextPage,
    prevPage,
    firstPage,
    refetch
  } = useOffers({
    pageSize: PAGE_SIZE,
    status,
    month: month || undefined,
    search
  })
  useViewRefresh(refetch, isFetching)
  // The invoice of each offered ride, when one was uploaded, one request
  // for the page (customer-experience.md, section 5). The offer is the row.
  const {documents} = useRideDocuments(rows.map(r => r.transferId))

  const onOpen = useCallback(
    (row: OfferRow) =>
      navigate(
        `${transferPath({id: row.transferId, code: row.code})}#offer-timeline`
      ),
    [navigate]
  )

  const columns = useMemo<DataColumn<OfferRow>[]>(
    () => [
      {
        id: 'number',
        label: s.ColNumber,
        width: 110,
        text: row => row.number || '–',
        cell: row => (
          <Text
            as="span"
            fontFamily="mono"
            fontWeight="medium"
            whiteSpace="nowrap"
            data-offer-number={row.number}>
            {row.number || '–'}
          </Text>
        )
      },
      {
        // "06.09.2026, 23:58" is 143px at the table's 14px, and the 130px
        // of the first build ran it into the code beside it.
        id: 'date',
        label: s.ColDate,
        width: 160,
        text: row => formatDateTime(row.createdAt, code),
        cell: row => (
          <Text as="span" whiteSpace="nowrap" fontVariantNumeric="tabular-nums">
            {formatDateTime(row.createdAt, code)}
          </Text>
        )
      },
      {
        id: 'code',
        label: s.ColCode,
        width: 100,
        text: row => row.code,
        cell: row => (
          <Text as="span" fontFamily="mono" whiteSpace="nowrap">
            {row.code}
          </Text>
        )
      },
      {
        id: 'customer',
        label: s.ColCustomer,
        width: 170,
        text: row => row.customer || '–',
        cell: row => (
          <Text textStyle="sm" truncate>
            {row.customer || '–'}
          </Text>
        )
      },
      {
        id: 'language',
        label: s.ColLanguage,
        width: 80,
        cell: row => (
          <Text textStyle="sm">
            {(s[`Language_${row.language}` as keyof OffersStrings] as
              | string
              | undefined) ?? row.language}
          </Text>
        )
      },
      {
        id: 'pickup',
        label: s.ColPickup,
        width: 160,
        text: row => formatDateTime(row.pickupDateTime, code),
        cell: row => (
          <Text as="span" whiteSpace="nowrap" fontVariantNumeric="tabular-nums">
            {formatDateTime(row.pickupDateTime, code)}
          </Text>
        )
      },
      {
        id: 'total',
        label: s.ColTotal,
        width: 100,
        align: 'end',
        cell: row =>
          row.total != null ? (
            <MoneyText value={row.total} />
          ) : (
            <Text color="fg.muted">–</Text>
          )
      },
      {
        id: 'status',
        label: s.ColStatus,
        width: 180,
        cell: row => (
          <Box minW="0">
            <HStack gap="1" flexWrap="wrap">
              <CustomerStatusBadge status={row.customerStatus} size="sm" />
              <StatusBadge state={row.state} size="sm" />
            </HStack>
            <Text
              textStyle="xs"
              color="fg.muted"
              whiteSpace="nowrap"
              data-status-at={row.statusAt ?? ''}>
              {row.statusAt ? formatDateTime(row.statusAt, code) : ''}
            </Text>
          </Box>
        )
      },
      {
        id: 'sentTo',
        label: s.ColSentTo,
        width: 190,
        text: row => row.sentTo || s.NotSentYet,
        cell: row => (
          <Box minW="0">
            <Text textStyle="sm" truncate>
              {row.sentTo || s.NotSentYet}
            </Text>
            {row.sentAt && (
              <Text textStyle="xs" color="fg.muted" whiteSpace="nowrap">
                {formatDateTime(row.sentAt, code)}
              </Text>
            )}
          </Box>
        )
      },
      {
        id: 'document',
        label: s.ColDocument,
        width: 220,
        controls: true,
        cell: row => (
          <RideDocumentButtons
            docs={{
              offer: {id: row.id, kind: 'OFFER', number: row.number},
              invoice: documents[row.transferId]?.invoice
            }}
          />
        )
      }
    ],
    [s, code, documents]
  )

  const filtered = status !== undefined || month !== '' || search.trim() !== ''

  return (
    <Stack gap="4" data-testid="billing-customers">
      <Flex gap="2" flexWrap="wrap" align="center">
        <Box w={{base: 'full', md: '60'}}>
          <InputGroup startElement={<FaSearch />}>
            <Input
              size="sm"
              placeholder={s.SearchPlaceholder}
              value={search}
              onChange={e => setSearch(e.target.value)}
              data-testid="offer-search"
            />
          </InputGroup>
        </Box>
        <Input
          size="sm"
          type="month"
          w={{base: 'full', md: '44'}}
          aria-label={s.MonthLabel}
          value={month}
          onChange={e => setMonth(e.target.value)}
          data-testid="offer-month"
        />
        <StatusChips value={status} onChange={setStatus} s={s} />
      </Flex>

      <DataTable
        tableId="offers"
        columns={columns}
        rows={rows}
        rowId={row => row.id}
        onOpen={onOpen}
        summary={fill(s.CountLabel, {
          total: pagination.totalCount,
          count: rows.length
        })}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        empty={
          error ? null : (
            <EmptyState
              title={s.EmptyMessage}
              description={filtered ? s.EmptyHint : undefined}
              icon={<FaFileContract />}
            />
          )
        }
        pager={{
          page: pagination.currentPage,
          pages: pagination.totalPages,
          hasNext: pagination.hasNextPage,
          onFirst: firstPage,
          onPrev: prevPage,
          onNext: nextPage
        }}
      />
    </Stack>
  )
}

// --------------- Fahrer: one row per driver and month ---------------

type PendingAction = {row: DriverBillingRow; action: 'mark' | 'revoke'}

/**
 * The Fahrer half. `driverId` narrows the read, `readOnly` leaves the two
 * actions out: a driver reads their own months and marks nothing. A row
 * opens the month's rides underneath, the same lines the driver's
 * settlement tab carries.
 */
export function DriversHalf({
  driverId,
  readOnly
}: {
  driverId?: string
  readOnly: boolean
}) {
  const code = useI18nCode()
  const {strings: f} = getI18nFinance(code)
  const {strings: tb} = getI18nBookings(code)
  const monthLabel = useMonthLabel(code)
  const shortDate = useShortDate(code)
  const [month, setMonth] = useState('')
  const {rows, isLoading, error, isFetching, refetch} = useDriverPayouts({
    month: month || undefined,
    driverId
  })
  useViewRefresh(refetch, isFetching)

  const [busy, setBusy] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [note, setNote] = useState('')
  const [working, setWorking] = useState(false)

  const rowKey = (row: DriverBillingRow) => `${row.driverId}:${row.month}`
  const opened = open ? rows.find(row => rowKey(row) === open) : undefined
  const toggle = (row: DriverBillingRow) =>
    setOpen(prev => (prev === rowKey(row) ? null : rowKey(row)))

  const download = async (row: DriverBillingRow, format: StatementFormat) => {
    const key = `${rowKey(row)}:${format}`
    setBusy(key)
    try {
      await openStatement(row.driverId, row.month, format, 'DRIVER')
    } catch (err) {
      toaster.error({
        title: f.DownloadError,
        description: err instanceof Error ? err.message : String(err)
      })
    } finally {
      setBusy(null)
    }
  }

  const confirm = async () => {
    if (!pending) return
    const {row, action} = pending
    setWorking(true)
    try {
      if (action === 'mark') {
        await markDriverPayout(row.driverId, row.month, note)
        toaster.success({title: f.MarkedPaid})
      } else {
        await revokeDriverPayout(row.driverId, row.month)
        toaster.success({title: f.Revoked})
      }
      setPending(null)
      setNote('')
    } catch (err) {
      const errCode = (err as {code?: string})?.code
      toaster.error({
        title: action === 'mark' ? f.MarkPaidFailed : f.RevokeFailed,
        description:
          errCode === 'PAYOUT_LOCKED'
            ? f.RevokeLocked
            : errCode === 'FORBIDDEN'
              ? f.Forbidden
              : err instanceof Error
                ? err.message
                : String(err)
      })
    } finally {
      setWorking(false)
    }
  }

  // The month's PDF and Excel, drawn only where the DRV_ tab exists, the
  // way a document button is drawn only where the document is.
  const files = (row: DriverBillingRow) =>
    row.statement ? (
      <ButtonGroup
        size="sm"
        variant="outline"
        gap="2"
        onClick={e => e.stopPropagation()}>
        <Button
          minH={{base: '44px', md: '8'}}
          onClick={() => void download(row, 'pdf')}
          data-testid="payout-pdf"
          loading={busy === `${rowKey(row)}:pdf`}
          disabled={busy !== null && busy !== `${rowKey(row)}:pdf`}>
          <FaFilePdf /> {f.DownloadPdf}
        </Button>
        <Button
          minH={{base: '44px', md: '8'}}
          onClick={() => void download(row, 'xlsx')}
          data-testid="payout-xlsx"
          loading={busy === `${rowKey(row)}:xlsx`}
          disabled={busy !== null && busy !== `${rowKey(row)}:xlsx`}>
          <FaFileExcel /> {f.DownloadXlsx}
        </Button>
      </ButtonGroup>
    ) : (
      <Text textStyle="xs" color="fg.muted">
        –
      </Text>
    )

  const action = (row: DriverBillingRow) => {
    if (row.payout) {
      return row.payout.revocable ? (
        <Button
          size="sm"
          variant="outline"
          minH={{base: '44px', md: '8'}}
          onClick={e => {
            e.stopPropagation()
            setPending({row, action: 'revoke'})
          }}
          data-testid="payout-revoke">
          {f.Revoke}
        </Button>
      ) : null
    }
    return (
      <Button
        size="sm"
        colorPalette="brand"
        minH={{base: '44px', md: '8'}}
        onClick={e => {
          e.stopPropagation()
          setNote('')
          setPending({row, action: 'mark'})
        }}
        data-testid="payout-mark">
        {f.MarkPaid}
      </Button>
    )
  }

  const columns = useMemo<DataColumn<DriverBillingRow>[]>(() => {
    const own: DataColumn<DriverBillingRow>[] = []
    if (!readOnly) {
      own.push({
        id: 'driver',
        label: f.ColDriver,
        width: 160,
        text: row => row.name || '–',
        cell: row => (
          <HStack gap="2" minW="0">
            <DriverColorDot color={row.color} />
            <Text textStyle="sm" fontWeight="medium" truncate>
              {row.name || '–'}
            </Text>
          </HStack>
        )
      })
    }
    own.push(
      {
        id: 'month',
        label: f.ColMonth,
        width: 140,
        text: row => monthLabel(row.month),
        cell: row => (
          <Text as="span" fontWeight="medium" whiteSpace="nowrap">
            {monthLabel(row.month)}
          </Text>
        )
      },
      {
        id: 'rides',
        label: f.ColRides,
        width: 80,
        align: 'end',
        cell: row => (
          <Text as="span" fontVariantNumeric="tabular-nums">
            {row.rides}
          </Text>
        )
      },
      {
        id: 'revenue',
        label: f.ColRevenue,
        width: 100,
        align: 'end',
        cell: row => <MoneyText value={row.revenue} />
      },
      {
        id: 'cash',
        label: f.ColCash,
        width: 100,
        align: 'end',
        cell: row => <MoneyText value={row.cash} />
      },
      {
        id: 'share',
        label: f.ColShare,
        width: 110,
        align: 'end',
        defaultVisible: false,
        cell: row => <MoneyText value={row.share} />
      },
      {
        id: 'expenses',
        label: f.ColExpenses,
        width: 100,
        align: 'end',
        defaultVisible: false,
        cell: row => <MoneyText value={row.expenses} />
      },
      {
        id: 'payout',
        label: f.ColPayout,
        width: 110,
        align: 'end',
        cell: row => (
          <MoneyText
            value={row.payoutDue}
            fontWeight="semibold"
            data-payout-due={row.payoutDue}
          />
        )
      },
      {
        id: 'status',
        label: f.ColStatus,
        width: 180,
        cell: row => (
          <Box
            minW="0"
            data-testid="payout-status"
            data-paid={row.payout ? 'yes' : 'no'}>
            <Badge
              variant="subtle"
              colorPalette={row.payout ? 'green' : 'gray'}
              whiteSpace="nowrap">
              {row.payout
                ? fill(f.StatusPaid, {date: shortDate(row.payout.paidAt)})
                : f.StatusOpen}
            </Badge>
            {row.payout && (
              <Text
                textStyle="xs"
                color="fg.muted"
                whiteSpace="nowrap"
                data-paid-at={row.payout.paidAt}>
                {formatDateTime(row.payout.paidAt, code)}
              </Text>
            )}
            {row.payout?.note && (
              <Text textStyle="xs" color="fg.muted" lineClamp={1}>
                {fill(f.PaidNote, {note: row.payout.note})}
              </Text>
            )}
          </Box>
        )
      },
      {
        // "PDF" and "Excel" beside each other are 172px of buttons, and the
        // 170px of the first build pushed the Excel button under the action.
        id: 'files',
        label: f.ColFiles,
        width: 200,
        controls: true,
        cell: files
      }
    )
    if (!readOnly) {
      own.push({
        // "Als ausbezahlt markieren" is a 208px button. With the widths
        // above the admin's ten columns are 1380px, inside the 1392px frame
        // of a 1440 screen, so nothing scrolls there.
        id: 'action',
        label: f.ColAction,
        width: 230,
        controls: true,
        cell: action
      })
    }
    return own
    // `files` and `action` close over busy and pending, which is why they
    // are not in the list: a spinner on one button is not a new set of columns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, code, monthLabel, shortDate, readOnly, busy])

  const group = useMemo<DataGroup<DriverBillingRow>>(
    () => ({
      key: row => row.month,
      label: monthLabel
    }),
    [monthLabel]
  )

  const target = pending?.row

  return (
    <Stack gap="4" data-testid="billing-drivers">
      <Flex gap="2" flexWrap="wrap" align="center">
        <Input
          size="sm"
          type="month"
          w={{base: 'full', md: '44'}}
          aria-label={f.MonthLabel}
          value={month}
          onChange={e => setMonth(e.target.value)}
          data-testid="payout-month"
        />
        {!month && (
          <Text textStyle="sm" color="fg.muted">
            {f.MonthAll}
          </Text>
        )}
      </Flex>

      <DataTable
        tableId={readOnly ? 'driver-payouts-own' : 'driver-payouts'}
        columns={columns}
        rows={rows}
        rowId={rowKey}
        onOpen={toggle}
        group={group}
        stripe={row => row.color}
        actionLabel={f.RidesShow}
        summary={fill(f.DriversCount, {count: rows.length})}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        empty={
          <EmptyState
            title={f.DriversEmpty}
            description={f.DriversEmptyHint}
            icon={<FaUserTie />}
          />
        }
      />

      {opened && (
        <Stack gap="3" pt="2">
          <HStack justify="space-between" flexWrap="wrap" gap="2">
            <Box>
              <Text fontWeight="semibold">{monthLabel(opened.month)}</Text>
              <Text textStyle="sm" color="fg.muted">
                {opened.name || tb.StatementsKindDRIVER}
              </Text>
            </Box>
            <Button
              size="sm"
              variant="ghost"
              minH="44px"
              onClick={() => setOpen(null)}>
              <FaChevronUp /> {f.RidesHide}
            </Button>
          </HStack>
          <StatementLines
            userId={opened.driverId}
            month={opened.month}
            kind="DRIVER"
            t={tb}
          />
        </Stack>
      )}

      <ConfirmDialog
        open={pending !== null}
        onClose={() => {
          if (!working) setPending(null)
        }}
        onConfirm={confirm}
        loading={working}
        title={pending?.action === 'revoke' ? f.RevokeTitle : f.MarkPaidTitle}
        confirmLabel={pending?.action === 'revoke' ? f.Revoke : f.MarkPaid}
        body={
          pending?.action === 'revoke' ? (
            f.RevokeBody
          ) : (
            <Stack gap="3">
              <Text>
                {target
                  ? fill(f.MarkPaidBody, {
                      month: monthLabel(target.month),
                      name: target.name || '–',
                      amount: new Intl.NumberFormat(code, {
                        style: 'currency',
                        currency: 'EUR'
                      }).format(target.payoutDue)
                    })
                  : ''}
              </Text>
              <Field.Root>
                <Field.Label>{f.NoteLabel}</Field.Label>
                <Input
                  size="sm"
                  value={note}
                  placeholder={f.NotePlaceholder}
                  onChange={e => setNote(e.target.value)}
                  data-testid="payout-note"
                />
              </Field.Root>
            </Stack>
          )
        }
      />
    </Stack>
  )
}

// --------------- Kunden, the customer's own half ---------------

/**
 * The customer's own rides with the invoice and the paid status per ride,
 * under their monthly statements. A row opens the booking.
 */
function CustomerRides({f}: {f: FinanceStrings}) {
  const code = useI18nCode()
  const navigate = useAppNavigate()
  const {
    rows,
    isLoading,
    error,
    pagination,
    nextPage,
    prevPage,
    firstPage,
    refetch
  } = useCustomerBilling(PAGE_SIZE)
  const {documents} = useRideDocuments(rows.map(r => r.id))

  const columns = useMemo<DataColumn<CustomerBillingRow>[]>(
    () => [
      {
        id: 'code',
        label: f.RidesColCode,
        width: 110,
        text: row => row.code,
        cell: row => (
          <Text
            as="span"
            fontFamily="mono"
            fontWeight="medium"
            whiteSpace="nowrap">
            {row.code}
          </Text>
        )
      },
      {
        id: 'pickup',
        label: f.RidesColDate,
        width: 160,
        text: row => formatDateTime(row.pickupDateTime, code),
        cell: row => (
          <Text as="span" whiteSpace="nowrap" fontVariantNumeric="tabular-nums">
            {formatDateTime(row.pickupDateTime, code)}
          </Text>
        )
      },
      {
        // Clamped to one line by design, and 230px keeps the customer's
        // nine columns at 1390px, inside the frame of a 1440 screen.
        id: 'route',
        label: f.RidesColRoute,
        width: 230,
        text: row => `${row.pickup} → ${row.dropoff}`,
        cell: row => (
          <Text color="fg.muted" lineClamp={1}>
            {row.pickup} → {row.dropoff}
          </Text>
        )
      },
      {
        id: 'amount',
        label: f.RidesColAmount,
        width: 100,
        align: 'end',
        cell: row =>
          row.total != null ? (
            <MoneyText value={row.total} />
          ) : (
            <Text color="fg.muted">–</Text>
          )
      },
      {
        id: 'status',
        label: f.RidesColStatus,
        width: 170,
        cell: row => (
          <Box minW="0">
            <CustomerStatusBadge
              status={row.customerStatus}
              audience="customer"
              size="sm"
            />
            <Text textStyle="xs" color="fg.muted" whiteSpace="nowrap">
              {row.statusAt ? formatDateTime(row.statusAt, code) : ''}
            </Text>
          </Box>
        )
      },
      {
        // "noch keine Rechnung" is 130px at 14px and a date with its time
        // 143px, the 140px of the first build ran both into "offen" beside
        // them.
        id: 'invoice',
        label: f.RidesColInvoice,
        width: 170,
        text: row =>
          row.invoicedAt
            ? formatDateTime(row.invoicedAt, code)
            : f.InvoiceNotYet,
        cell: row => (
          <Text
            textStyle="sm"
            color={row.invoicedAt ? undefined : 'fg.muted'}
            whiteSpace="nowrap">
            {row.invoicedAt
              ? formatDateTime(row.invoicedAt, code)
              : f.InvoiceNotYet}
          </Text>
        )
      },
      {
        id: 'paid',
        label: f.RidesColPaid,
        width: 170,
        text: row =>
          row.paidAt ? formatDateTime(row.paidAt, code) : f.PaidNotYet,
        cell: row => (
          <Text
            textStyle="sm"
            color={row.paidAt ? undefined : 'fg.muted'}
            whiteSpace="nowrap">
            {row.paidAt ? formatDateTime(row.paidAt, code) : f.PaidNotYet}
          </Text>
        )
      },
      {
        id: 'documents',
        label: f.RidesColDocuments,
        width: 200,
        controls: true,
        cell: row => <RideDocumentButtons docs={documents[row.id]} />
      }
    ],
    [f, code, documents]
  )

  return (
    <DataTable
      tableId="customer-billing"
      columns={columns}
      rows={rows}
      rowId={row => row.id}
      onOpen={row => navigate(bookingPath(row))}
      summary={fill(f.RidesCount, {
        total: pagination.totalCount,
        count: rows.length
      })}
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      empty={
        <EmptyState
          title={f.RidesEmpty}
          description={f.RidesEmptyHint}
          icon={<FaFileInvoice />}
        />
      }
      pager={{
        page: pagination.currentPage,
        pages: pagination.totalPages,
        hasNext: pagination.hasNextPage,
        onFirst: firstPage,
        onPrev: prevPage,
        onNext: nextPage
      }}
    />
  )
}

/** The customer's half: their statement months, then their rides with the money status. */
function CustomerHalf({
  userId,
  f
}: {
  userId: string | undefined
  f: FinanceStrings
}) {
  return (
    <Stack gap="6" data-testid="billing-customer">
      <Stack gap="3">
        <SectionHeading>{f.MyStatements}</SectionHeading>
        <StatementMonths userId={userId} embedded />
      </Stack>
      <Stack gap="3">
        <SectionHeading>{f.MyRides}</SectionHeading>
        <CustomerRides f={f} />
      </Stack>
    </Stack>
  )
}

// --------------- The screen ---------------

type Tab = 'kunden' | 'fahrer'

const readTab = (): Tab | undefined => {
  try {
    const value = new URLSearchParams(window.location.search).get('tab')
    return value === 'fahrer' || value === 'kunden' ? value : undefined
  } catch {
    return undefined
  }
}

const writeTab = (tab: Tab) => {
  try {
    const url = new URL(window.location.href)
    if (url.searchParams.get('tab') === tab) return
    url.searchParams.set('tab', tab)
    window.history.replaceState(window.history.state, '', url.toString())
  } catch {
    /* no address to write, the tab still switches */
  }
}

function BillingScreen() {
  const caller = useCaller()
  const code = useI18nCode()
  const {strings: f} = getI18nFinance(code)
  const {strings: tc} = getI18nCommon(code)

  // Which halves the caller is offered. The backend scopes every read, so
  // this decides what is drawn and nothing else.
  const halves = useMemo<Tab[]>(() => {
    const out: Tab[] = []
    if (caller.isAdmin || caller.isCustomer) out.push('kunden')
    if (caller.isAdmin || caller.isDriver) out.push('fahrer')
    return out
  }, [caller.isAdmin, caller.isCustomer, caller.isDriver])

  const [asked] = useState<Tab | undefined>(() =>
    typeof window !== 'undefined' ? readTab() : undefined
  )
  const [chosen, setChosen] = useState<Tab | undefined>(asked)
  const tab: Tab | undefined =
    chosen && halves.includes(chosen) ? chosen : halves[0]

  useEffect(() => {
    if (tab && halves.length > 1) writeTab(tab)
  }, [tab, halves.length])

  const subtitle = caller.isAdmin
    ? f.Subtitle
    : caller.isDriver && !caller.isCustomer
      ? f.SubtitleDriver
      : f.SubtitleCustomer

  const kunden = caller.isAdmin ? (
    <OffersTable />
  ) : (
    <CustomerHalf userId={caller.userId} f={f} />
  )
  const fahrer = (
    <DriversHalf
      driverId={caller.isAdmin ? undefined : caller.userId}
      readOnly={!caller.isAdmin}
    />
  )

  let body: ReactNode
  if (caller.loading) {
    body = (
      <TableSkeleton
        columns={[
          {id: 'a', label: f.ColMonth, width: 200},
          {id: 'b', label: f.ColRides, width: 100, align: 'end'},
          {id: 'c', label: f.ColRevenue, width: 140, align: 'end'},
          {id: 'd', label: f.ColPayout, width: 140, align: 'end'},
          {id: 'e', label: f.ColStatus, width: 200}
        ]}
        rows={6}
      />
    )
  } else if (!halves.length) {
    body = (
      <EmptyState
        title={tc.NoAccessTitle}
        description={tc.NoAccessBody}
        icon={<FaFileInvoice />}
      />
    )
  } else if (halves.length === 1) {
    body = halves[0] === 'kunden' ? kunden : fahrer
  } else {
    body = (
      <Tabs.Root
        value={tab ?? 'kunden'}
        onValueChange={details => setChosen(details.value as Tab)}
        lazyMount
        unmountOnExit
        data-testid="billing-tabs">
        <Tabs.List>
          <Tabs.Trigger
            value="kunden"
            minH="44px"
            data-testid="billing-tab-kunden">
            {f.TabCustomers}
          </Tabs.Trigger>
          <Tabs.Trigger
            value="fahrer"
            minH="44px"
            data-testid="billing-tab-fahrer">
            {f.TabDrivers}
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="kunden" px="0" pt="4">
          {kunden}
        </Tabs.Content>
        <Tabs.Content value="fahrer" px="0" pt="4">
          {fahrer}
        </Tabs.Content>
      </Tabs.Root>
    )
  }

  return (
    <Box p={{base: '4', md: '6'}} maxW="full">
      <Stack gap="5">
        <PageHeader
          title={f.Heading}
          subtitle={subtitle}
          actions={<RefreshButton />}
        />
        {body}
      </Stack>
    </Box>
  )
}

export interface StatementsViewProps {
  /** Whose statements, for the embedded months table. The billing screen reads the caller itself. */
  userId: string | undefined
  /** Inside another screen: the months table of that person alone, without the page heading. */
  embedded?: boolean
}

/**
 * The route's view, and the months table the user detail screen embeds.
 * On its own route it is the billing screen of the caller's roles; embedded
 * it is the statement months of the person the screen shows.
 */
export function StatementsView({
  userId,
  embedded = false
}: StatementsViewProps) {
  if (embedded) return <StatementMonths userId={userId} embedded />
  return <BillingScreen />
}

/**
 * The offers screen, /app/offers/, admins only: one row per offer document,
 * newest first, on the board's DataTable (okf/architecture/offers-and-documents.md,
 * "The offers screen").
 *
 * The columns are the brief's: number (AN-260001), date, code, customer,
 * language, pickup, total, status (the customer status with its instant),
 * sent to, and the document as a link that fetches the signed URL through
 * documentUrl when it is clicked. The status chips are the six customer
 * states, the search matches number, code and customer, the month filter
 * the offer date. All three are pushed down to `offers(args)`, the pylon
 * pages with Relay cursors and the board's pager walks them. A row opens
 * the ride's detail page at the offer timeline. Cards below `md` are the
 * DataTable's own, built from the visible columns. Numbers wait as
 * skeletons like every other screen.
 */
import {useCallback, useMemo, useState} from 'react'
import {
  Box,
  Button,
  Flex,
  HStack,
  Input,
  InputGroup,
  Stack,
  Text
} from '@chakra-ui/react'
import {FaSearch} from '@react-icons/all-files/fa/FaSearch'
import {FaFileContract} from '@react-icons/all-files/fa/FaFileContract'
import {FaSyncAlt} from '@react-icons/all-files/fa/FaSyncAlt'
import {useCaller} from '../auth'
import {useI18nCode} from '../i18n'
import {useAppNavigate} from '../navigation'
import {fill, getI18nOffers, type OffersStrings} from '../locales/i18nOffers'
import {getI18nCommon} from '../locales/i18nCommon'
import {
  CUSTOMER_STATUSES,
  useOffers,
  type CustomerStatus,
  type OfferRow
} from '../hooks/offers'
import {useRideDocuments} from '../hooks/finance'
import {RideDocumentButtons} from '../components/documents/RideDocumentButtons'
import {transferPath} from '../hooks/transfers'
import {EmptyState, MoneyText, PageHeader, StatusBadge} from '../components'
import {
  CustomerStatusBadge,
  CUSTOMER_STATUS_PALETTE
} from '../components/CustomerStatusBadge'
import {DataTable, type DataColumn} from '../components/table'
import {formatDateTime} from './TransfersView'

const PAGE_SIZE = 25

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

export function OffersView() {
  const caller = useCaller()
  const navigate = useAppNavigate()
  const code = useI18nCode()
  const {strings: s} = getI18nOffers(code)
  const {strings: tc} = getI18nCommon(code)

  const [status, setStatus] = useState<CustomerStatus | undefined>(undefined)
  const [month, setMonth] = useState('')
  const [search, setSearch] = useState('')

  const {
    rows,
    isLoading,
    error,
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
        id: 'date',
        label: s.ColDate,
        width: 130,
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
        width: 130,
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

  // The widths sum to 1300 px plus the Details column, so the whole table sits
  // on a 1440 px desk without a scrollbar of its own.
  // A driver or a customer who types the address: the words, not a broken list.
  if (!caller.loading && !caller.isAdmin) {
    return (
      <Box p={{base: '4', md: '6'}} maxW="full">
        <EmptyState title={s.AdminsOnly} icon={<FaFileContract />} />
      </Box>
    )
  }

  const filtered = status !== undefined || month !== '' || search.trim() !== ''

  return (
    <Box p={{base: '4', md: '6'}} maxW="full">
      <Stack gap="5">
        <PageHeader
          title={s.Heading}
          subtitle={s.Subtitle}
          actions={
            <Button
              size="sm"
              variant="outline"
              onClick={refetch}
              disabled={isLoading}
              aria-label={tc.Refresh}>
              <FaSyncAlt />
            </Button>
          }
        />

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
    </Box>
  )
}

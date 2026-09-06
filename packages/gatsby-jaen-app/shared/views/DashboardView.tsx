/**
 * The dispatcher's dashboard.
 *
 * Every number comes from the `dashboard` resolver in one round trip, counted
 * in the database over the whole company. The two lists below the numbers
 * come from `transfers` filtered by date on the server, a date-only `toISO`
 * meaning the end of that day. Every row carries its code and links by it.
 * Nothing on this screen is derived from "the first twenty rows of
 * everything", which is what the previous version did and called a KPI. See okf/architecture/dashboard.md.
 *
 * Admin only. A driver or a customer who lands here is sent to their own
 * home. The backend would refuse them anyway, this just spares them the error.
 */
import React, {useCallback, useEffect, useMemo, useState} from 'react'
import {
  Alert,
  Card,
  Flex,
  Heading,
  HStack,
  IconButton,
  SimpleGrid,
  Stack,
  Stat,
  Table,
  Text,
  chakra
} from '@chakra-ui/react'
import {FaChevronLeft} from '@react-icons/all-files/fa/FaChevronLeft'
import {FaChevronRight} from '@react-icons/all-files/fa/FaChevronRight'
import {FaExclamationTriangle} from '@react-icons/all-files/fa/FaExclamationTriangle'
import {useCaller} from '../auth'
import {useAppNavigate} from '../navigation'
import {
  transferPath,
  useTransferList,
  type TransferRow
} from '../hooks/transfers'
import {
  useDashboard,
  localDateISO,
  monthOf,
  shiftMonth,
  tomorrowOf,
  type DashboardDriver
} from '../hooks/dashboard'
import {
  DriverColorBorder,
  DriverColorDot,
  EmptyState,
  ErrorBanner,
  MoneyText,
  StatusBadge,
  useMoneyFormat,
  PageHeader
} from '../components'
import {RefreshButton} from '../components/RefreshButton'
import {useViewRefresh} from '../hooks/view-refresh'
import {useI18nCode} from '../i18n'
import {getI18nDashboard} from '../locales/i18nDashboard'
import {
  fillWith,
  ListSkeleton,
  NumberSkeleton,
  TableSkeleton
} from '../components/skeletons'

const fill = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce(
    (s, [k, v]) => s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
    template
  )

/** One number with its label. `tone` colours the value when it needs a look. */
function Kpi({
  label,
  value,
  tone,
  loading
}: {
  label: string
  value: React.ReactNode
  tone?: 'orange' | 'red' | 'teal' | 'blue' | 'green'
  loading?: boolean
}) {
  return (
    <Stat.Root
      borderWidth="1px"
      borderColor="border.default"
      rounded="surface"
      bg="bg.surface"
      p="4"
      gap="1"
      colorPalette={tone}>
      <Stat.Label color="fg.muted" textStyle="sm">
        {label}
      </Stat.Label>
      <Stat.ValueText
        textStyle="2xl"
        fontWeight="bold"
        fontVariantNumeric="tabular-nums"
        color={tone ? 'colorPalette.fg' : 'fg.default'}>
        {/* The number's own place and size, grey until it is there, never 0. */}
        {loading ? <NumberSkeleton chars={4} /> : value}
      </Stat.ValueText>
    </Stat.Root>
  )
}

/** A transfer as one row of today's or tomorrow's list. */
function DayRow({
  transfer,
  driver,
  unassignedLabel,
  onOpen
}: {
  transfer: TransferRow
  driver?: DashboardDriver
  unassignedLabel: string
  onOpen: () => void
}) {
  return (
    <DriverColorBorder
      color={driver?.color}
      rounded="surface"
      overflow="hidden">
      <Card.Root
        size="sm"
        variant="outline"
        rounded="none"
        borderStartWidth="0"
        cursor="pointer"
        role="link"
        tabIndex={0}
        data-transfer-id={transfer.id}
        onClick={onOpen}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onOpen()
          }
        }}
        _hover={{bg: 'bg.subtle'}}
        _focusVisible={{
          outline: '2px solid',
          outlineColor: 'brand.focusRing',
          outlineOffset: '-2px'
        }}>
        <Card.Body gap="2">
          <Flex justify="space-between" align="center" gap="3" wrap="wrap">
            <HStack gap="3" minW="0">
              <Text fontWeight="semibold" fontVariantNumeric="tabular-nums">
                {transfer.rideTime || '–'}
              </Text>
              <StatusBadge state={transfer.state} />
              {/* The code, what a dispatcher reads aloud. The uuid stays in the data attribute of the card. */}
              <Text
                textStyle="xs"
                color="fg.muted"
                whiteSpace="nowrap"
                fontFamily="mono">
                {transfer.code}
              </Text>
            </HStack>
            <MoneyText
              value={transfer.price}
              fontWeight="semibold"
              textStyle="sm"
            />
          </Flex>
          <Flex
            justify="space-between"
            align="center"
            gap="3"
            wrap="wrap"
            textStyle="sm">
            <Text color="fg.muted" minW="0" lineClamp={1}>
              {transfer.pickup} → {transfer.dropoff}
            </Text>
            {driver ? (
              <HStack gap="2" flexShrink={0}>
                <DriverColorDot color={driver.color} size="2.5" />
                <Text textStyle="xs" color="fg.muted">
                  {driver.name}
                </Text>
              </HStack>
            ) : transfer.driverId ? (
              <Text textStyle="xs" color="fg.muted">
                {transfer.driverId.slice(0, 8)}
              </Text>
            ) : (
              <Text textStyle="xs" color="orange.fg" fontWeight="medium">
                {unassignedLabel}
              </Text>
            )}
          </Flex>
        </Card.Body>
      </Card.Root>
    </DriverColorBorder>
  )
}

function DayList({
  title,
  transfers,
  isLoading,
  error,
  emptyLabel,
  viewAllLabel,
  unassignedLabel,
  driversById,
  onRefetch,
  onOpen,
  onViewAll
}: {
  title: React.ReactNode
  transfers: TransferRow[]
  isLoading: boolean
  error: string | null
  emptyLabel: string
  viewAllLabel: string
  unassignedLabel: string
  driversById: Map<string, DashboardDriver>
  onRefetch: () => void
  onOpen: (path: string) => void
  onViewAll: () => void
}) {
  const sorted = useMemo(
    () => [...transfers].sort((a, b) => a.rideTime.localeCompare(b.rideTime)),
    [transfers]
  )

  return (
    <Stack gap="3">
      <Flex justify="space-between" align="center">
        <Heading size="md">{title}</Heading>
        <chakra.button
          type="button"
          onClick={onViewAll}
          textStyle="sm"
          color="brand.fg"
          cursor="pointer"
          _hover={{textDecoration: 'underline'}}>
          {viewAllLabel}
        </chakra.button>
      </Flex>
      {error && <ErrorBanner message={error} onRetry={onRefetch} />}
      {isLoading && !error ? (
        <ListSkeleton rows={2} />
      ) : !error && sorted.length === 0 ? (
        <EmptyState
          title={emptyLabel}
          size="sm"
          borderWidth="1px"
          borderColor="border.default"
          rounded="surface"
          bg="bg.surface"
        />
      ) : (
        <Stack gap="3">
          {sorted.map(transfer => (
            <DayRow
              key={transfer.id}
              transfer={transfer}
              driver={
                transfer.driverId
                  ? driversById.get(transfer.driverId)
                  : undefined
              }
              unassignedLabel={unassignedLabel}
              onOpen={() => onOpen(transferPath(transfer))}
            />
          ))}
        </Stack>
      )}
    </Stack>
  )
}

export function DashboardView() {
  const caller = useCaller()
  const navigate = useAppNavigate()
  const code = useI18nCode()
  const {strings: t} = getI18nDashboard(code)
  const money = useMoneyFormat()

  // Not their screen. The nav never offered it, but a bookmark or a push
  // notification's fallback URL can still land here.
  useEffect(() => {
    if (caller.loading || caller.isAdmin) return
    if (caller.isDriver) navigate('/transfers')
    else if (caller.isCustomer) navigate('/booking')
  }, [
    caller.loading,
    caller.isAdmin,
    caller.isDriver,
    caller.isCustomer,
    navigate
  ])

  const [now] = useState(() => new Date())
  const todayISO = useMemo(() => localDateISO(now), [now])
  const tomorrowISO = useMemo(() => localDateISO(tomorrowOf(now)), [now])
  const [month, setMonth] = useState(() => monthOf(now))
  const isCurrentMonth = month === monthOf(now)

  const dashboard = useDashboard(month)
  // A page of a hundred is every ride a day of this company has ever had,
  // and "view all" reaches the board for the day it is not.
  const today = useTransferList({
    pageSize: 100,
    fromISO: todayISO,
    toISO: todayISO
  })
  const tomorrow = useTransferList({
    pageSize: 100,
    fromISO: tomorrowISO,
    toISO: tomorrowISO
  })

  const driversById = useMemo(
    () => new Map((dashboard.data?.drivers ?? []).map(d => [d.id, d])),
    [dashboard.data]
  )

  const monthLabel = useMemo(() => {
    const [y, m] = month.split('-').map(Number)
    try {
      return new Intl.DateTimeFormat(code, {
        month: 'long',
        year: 'numeric'
      }).format(new Date(y ?? 1970, (m ?? 1) - 1, 1))
    } catch {
      return month
    }
  }, [month, code])

  const percent = (fraction: number) => {
    try {
      return new Intl.NumberFormat(code, {
        style: 'percent',
        maximumFractionDigits: 1
      }).format(fraction)
    } catch {
      return `${(fraction * 100).toFixed(1)} %`
    }
  }

  const refetchAll = useCallback(() => {
    dashboard.refetch()
    today.refetch()
    tomorrow.refetch()
  }, [dashboard.refetch, today.refetch, tomorrow.refetch])
  // The three reads are one refresh: the button turns and the pull holds
  // until the last of them has answered.
  useViewRefresh(
    refetchAll,
    dashboard.isFetching || today.isFetching || tomorrow.isFetching
  )

  const d = dashboard.data
  // Until the roles are known the page is its skeleton, the numbers grey.
  const loading = dashboard.isLoading || caller.loading

  if (!caller.loading && !caller.isAdmin) return null

  // The count in a list's heading waits like every other number.
  const listTitle = (
    template: string,
    list: {isLoading: boolean; pagination: {totalCount: number}}
  ) =>
    fillWith(template, {
      count: list.isLoading ? (
        <NumberSkeleton chars={2} />
      ) : (
        list.pagination.totalCount
      )
    })

  return (
    <Stack gap="8" p={{base: '4', md: '6'}} maxW="full">
      <PageHeader
        title={t.Heading}
        subtitle={t.Subtitle}
        actions={<RefreshButton />}
      />

      {dashboard.error && (
        <ErrorBanner
          title={t.NumbersUnavailable}
          message={dashboard.error}
          onRetry={dashboard.refetch}
        />
      )}

      {d && d.today.unassigned > 0 && (
        <Alert.Root
          status="warning"
          variant="subtle"
          cursor="pointer"
          onClick={() => navigate('/transfers')}
          _hover={{opacity: 0.9}}>
          <Alert.Indicator>
            <FaExclamationTriangle />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>
              {fill(t.AlertNotAssigned, {count: d.today.unassigned})}
            </Alert.Title>
            <Alert.Description>{t.AlertNotAssignedBody}</Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )}
      {d && d.today.rejected > 0 && (
        <Alert.Root
          status="error"
          variant="subtle"
          cursor="pointer"
          onClick={() => navigate('/transfers')}
          _hover={{opacity: 0.9}}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>
              {fill(t.AlertRejected, {count: d.today.rejected})}
            </Alert.Title>
            <Alert.Description>{t.AlertRejectedBody}</Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )}

      <Stack gap="3">
        <Heading size="md">{t.SectionToday}</Heading>
        <SimpleGrid columns={{base: 2, md: 3, lg: 5}} gap="3">
          <Kpi
            label={t.KpiRidesToday}
            value={d?.today.rides ?? 0}
            loading={loading}
          />
          <Kpi
            label={t.KpiUnassigned}
            value={d?.today.unassigned ?? 0}
            tone={d && d.today.unassigned > 0 ? 'orange' : undefined}
            loading={loading}
          />
          <Kpi
            label={t.KpiOnTheRoad}
            value={d?.today.onTheRoad ?? 0}
            tone="teal"
            loading={loading}
          />
          <Kpi
            label={t.KpiWaiting}
            value={d?.today.waiting ?? 0}
            tone="blue"
            loading={loading}
          />
          <Kpi
            label={t.KpiRejected}
            value={d?.today.rejected ?? 0}
            tone={d && d.today.rejected > 0 ? 'red' : undefined}
            loading={loading}
          />
        </SimpleGrid>
      </Stack>

      <Stack gap="3">
        <Heading size="md">{t.SectionTomorrow}</Heading>
        <SimpleGrid columns={{base: 2, lg: 5}} gap="3">
          <Kpi
            label={t.KpiRidesTomorrow}
            value={d?.tomorrow.rides ?? 0}
            loading={loading}
          />
          <Kpi
            label={t.KpiTomorrowUnassigned}
            value={d?.tomorrow.unassigned ?? 0}
            tone={d && d.tomorrow.unassigned > 0 ? 'orange' : undefined}
            loading={loading}
          />
        </SimpleGrid>
      </Stack>

      <Stack gap="3">
        <Flex justify="space-between" align="center" gap="3" wrap="wrap">
          <Heading size="md">
            {isCurrentMonth ? t.SectionMonth : monthLabel}
          </Heading>
          <HStack gap="2">
            <IconButton
              aria-label={t.PrevMonth}
              variant="ghost"
              size="sm"
              onClick={() => setMonth(m => shiftMonth(m, -1))}>
              <FaChevronLeft />
            </IconButton>
            <Text
              textStyle="sm"
              fontWeight="medium"
              minW="32"
              textAlign="center">
              {monthLabel}
            </Text>
            <IconButton
              aria-label={t.NextMonth}
              variant="ghost"
              size="sm"
              disabled={isCurrentMonth}
              onClick={() => setMonth(m => shiftMonth(m, 1))}>
              <FaChevronRight />
            </IconButton>
          </HStack>
        </Flex>
        <SimpleGrid columns={{base: 2, md: 4}} gap="3">
          <Kpi
            label={t.KpiRevenue}
            value={money(d?.month.revenue ?? 0)}
            tone="green"
            loading={loading}
          />
          <Kpi
            label={t.KpiCompleted}
            value={d?.month.completed ?? 0}
            loading={loading}
          />
          <Kpi
            label={t.KpiAverageFare}
            value={money(d?.month.averageFare ?? 0)}
            loading={loading}
          />
          <Kpi
            label={t.KpiCash}
            value={money(d?.month.cash ?? 0)}
            loading={loading}
          />
          <Kpi
            label={t.KpiPayoutDue}
            value={money(d?.month.payoutDue ?? 0)}
            loading={loading}
          />
          <Kpi
            label={t.KpiCancellationRate}
            value={percent(d?.month.cancellationRate ?? 0)}
            tone={d && d.month.cancellationRate > 0.1 ? 'red' : undefined}
            loading={loading}
          />
          <Kpi
            label={t.KpiSiteBookings}
            value={d?.month.siteBookings ?? 0}
            loading={loading}
          />
        </SimpleGrid>
      </Stack>

      <Stack gap="3">
        <Heading size="md">{t.SectionDrivers}</Heading>
        {loading ? (
          <TableSkeleton
            columns={[
              {id: 'driver', label: t.ColDriver, width: 240},
              {
                id: 'completed',
                label: t.ColCompleted,
                width: 120,
                align: 'end'
              },
              {id: 'revenue', label: t.ColRevenue, width: 140, align: 'end'},
              {id: 'cash', label: t.ColCash, width: 140, align: 'end'},
              {id: 'payout', label: t.ColPayout, width: 140, align: 'end'}
            ]}
            rows={4}
            avatar
            dayHeader={false}
            actionsWidth={0}
          />
        ) : !d || d.drivers.length === 0 ? (
          <EmptyState
            title={t.NoDrivers}
            size="sm"
            borderWidth="1px"
            borderColor="border.default"
            rounded="surface"
            bg="bg.surface"
          />
        ) : (
          <Table.ScrollArea
            borderWidth="1px"
            borderColor="border.default"
            rounded="surface"
            bg="bg.surface">
            <Table.Root size="sm" variant="line">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>{t.ColDriver}</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">
                    {t.ColCompleted}
                  </Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">
                    {t.ColRevenue}
                  </Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">
                    {t.ColCash}
                  </Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">
                    {t.ColPayout}
                  </Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {d.drivers.map(driver => (
                  <Table.Row
                    key={driver.id}
                    cursor="pointer"
                    _hover={{bg: 'bg.subtle'}}
                    onClick={() => navigate(`/users/${driver.id}`)}>
                    <Table.Cell>
                      <HStack gap="2">
                        <DriverColorDot color={driver.color} />
                        <Text fontWeight="medium">{driver.name}</Text>
                      </HStack>
                    </Table.Cell>
                    <Table.Cell
                      textAlign="end"
                      fontVariantNumeric="tabular-nums">
                      {driver.completed}
                    </Table.Cell>
                    <Table.Cell textAlign="end">
                      <MoneyText value={driver.revenue} />
                    </Table.Cell>
                    <Table.Cell textAlign="end">
                      <MoneyText value={driver.cash} />
                    </Table.Cell>
                    <Table.Cell textAlign="end">
                      <MoneyText
                        value={driver.payoutDue}
                        fontWeight="semibold"
                      />
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Table.ScrollArea>
        )}
      </Stack>

      <SimpleGrid columns={{base: 1, lg: 2}} gap="8" alignItems="start">
        <DayList
          title={listTitle(t.TodayList, today)}
          transfers={today.rows}
          isLoading={today.isLoading}
          error={today.error}
          emptyLabel={t.NoTransfersToday}
          viewAllLabel={t.ViewAll}
          unassignedLabel={t.Unassigned}
          driversById={driversById}
          onRefetch={today.refetch}
          onOpen={path => navigate(path)}
          onViewAll={() => navigate('/transfers')}
        />
        <DayList
          title={listTitle(t.TomorrowList, tomorrow)}
          transfers={tomorrow.rows}
          isLoading={tomorrow.isLoading}
          error={tomorrow.error}
          emptyLabel={t.NoTransfersTomorrow}
          viewAllLabel={t.ViewAll}
          unassignedLabel={t.Unassigned}
          driversById={driversById}
          onRefetch={tomorrow.refetch}
          onOpen={path => navigate(path)}
          onViewAll={() => navigate('/transfers')}
        />
      </SimpleGrid>
    </Stack>
  )
}

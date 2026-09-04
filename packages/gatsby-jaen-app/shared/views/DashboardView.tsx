import { useMemo } from 'react'
import { useAppNavigate } from '../navigation'
import { useTransfers } from '../hooks'
import {
  cx, formatPrice,
  StatusPill, LoadingOverlay, ErrorBanner,
  IconTriangleAlert, IconClock, IconChevronRight, IconRefresh,
} from '../components/ui'
import { useI18nCode } from '../i18n'
import { getI18nDashboard } from '../locales/i18nDashboard'
import { getI18nCommon } from '../locales/i18nCommon'

export function DashboardView() {
  const { transfers, isLoading, error, pagination, refetch } = useTransfers(20)
  const navigate = useAppNavigate()
  const i18nCode = useI18nCode()
  const { strings: t } = getI18nDashboard(i18nCode)
  const { strings: tc } = getI18nCommon(i18nCode)

  const today = useMemo(() => new Date().toISOString().split('T')[0], [])
  const tomorrow = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0] }, [])

  const mapStatus = (state: string) => {
    const s = state?.toLowerCase?.() ?? ''
    if (s === 'completed') return 'Completed'
    if (s === 'cancelled' || s === 'canceled' || s === 'terminated') return 'Cancelled'
    if (s === 'in_progress' || s === 'active') return 'In Progress'
    return 'Planned'
  }

  const todayTransfers = useMemo(() => transfers.filter(t => t.rideDateISO === today), [transfers, today])
  const tomorrowTransfers = useMemo(() => transfers.filter(t => t.rideDateISO === tomorrow), [transfers, tomorrow])

  const notAssignedToday = useMemo(() => todayTransfers.filter(t => {
    const status = mapStatus(t.state)
    return status !== 'Cancelled' && (!t.driverName || !t.carLicensePlate)
  }), [todayTransfers])

  const inProgressCount = useMemo(() => transfers.filter(t => mapStatus(t.state) === 'In Progress').length, [transfers])
  const completedCount = useMemo(() => transfers.filter(t => mapStatus(t.state) === 'Completed').length, [transfers])
  const plannedCount = useMemo(() => transfers.filter(t => mapStatus(t.state) === 'Planned').length, [transfers])

  const todaySorted = useMemo(() =>
    [...todayTransfers].sort((a, b) => `${a.rideTime}`.localeCompare(`${b.rideTime}`)),
    [todayTransfers]
  )

  return (
    <div className="p-4 md:p-6 max-w-full space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{t.Heading}</h1>
          <p className="text-muted-foreground mt-1">{t.Subtitle}</p>
        </div>
        <button className="inline-flex items-center gap-2 border border-input rounded-md px-3 h-9 text-sm hover:bg-muted transition-colors" onClick={refetch}>
          <IconRefresh className="h-4 w-4" /> {tc.Refresh}
        </button>
      </div>

      {/* Alert cards */}
      <div className="space-y-3">
        {notAssignedToday.length > 0 && (
          <div
            className="rounded-lg border text-card-foreground shadow-sm border-l-4 border-l-destructive bg-destructive/5 cursor-pointer hover:bg-destructive/10 transition-colors"
            onClick={() => navigate('/transfers')}
          >
            <div className="p-4">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
                  <IconTriangleAlert className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-destructive">{t.AlertNotAssigned.replace('{count}', String(notAssignedToday.length))}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t.AlertNotAssignedBody.replace('{count}', String(notAssignedToday.length)).replace('{total}', String(todayTransfers.length))}
                    <br /><strong>{t.AlertActionNeeded}</strong>
                  </p>
                </div>
                <IconChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
              </div>
            </div>
          </div>
        )}

        <div className="rounded-lg border text-card-foreground shadow-sm border-l-4 border-l-warning bg-warning/5 cursor-pointer hover:bg-warning/10 transition-colors">
          <div className="p-4">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-warning/10 text-warning border border-warning/20">
                <IconClock className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold">{t.UpcomingTransfers}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t.UpcomingTransfersBody.replace('{today}', String(todayTransfers.length)).replace('{tomorrow}', String(tomorrowTransfers.length))}
                </p>
              </div>
              <IconChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t.StatTotalTransfers} value={pagination.totalCount} />
        <StatCard label={t.StatInProgress} value={inProgressCount} accent="warning" />
        <StatCard label={t.StatCompleted} value={completedCount} accent="success" />
        <StatCard label={t.StatPlanned} value={plannedCount} />
      </div>

      {/* Today's Transfers */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">{t.TodayHeading.replace('{count}', String(todaySorted.length))}</h2>
          <button className="text-sm text-primary hover:underline" onClick={() => navigate('/transfers')}>{t.ViewAll}</button>
        </div>

        {isLoading && <div className="relative min-h-[120px]"><LoadingOverlay /></div>}
        {error && <ErrorBanner message={error} />}

        {!isLoading && todaySorted.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
            <p className="text-sm">{t.NoTransfersToday}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todaySorted.slice(0, 10).map(transfer => (
              <div
                key={transfer.id}
                className="rounded-lg border bg-card p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                style={{ borderLeft: transfer.driverColor ? `4px solid ${transfer.driverColor}` : undefined }}
                onClick={() => navigate(`/transfers/${transfer.id}`)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm">{transfer.referenceId || transfer.id.slice(0, 8)}</span>
                    <StatusPill status={transfer.state} />
                  </div>
                  <span className="text-sm font-semibold">{formatPrice(transfer.price)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="text-muted-foreground">
                    <span className="font-medium text-foreground">{transfer.rideTime}</span> · {transfer.pickup} → {transfer.dropoff}
                  </div>
                  {transfer.driverName ? (
                    <span className="text-xs text-muted-foreground">{transfer.driverName}</span>
                  ) : (
                    <span className="text-xs text-warning font-medium">{t.Unassigned}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: 'success' | 'warning' | 'destructive' }) {
  const valueColor = accent === 'success' ? 'text-success' : accent === 'warning' ? 'text-warning' : accent === 'destructive' ? 'text-destructive' : ''
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={cx('text-2xl font-bold mt-1', valueColor)}>{value}</div>
    </div>
  )
}

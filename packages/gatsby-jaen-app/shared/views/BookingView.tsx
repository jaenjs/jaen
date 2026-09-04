import React, { useMemo, useState } from 'react'
import { useAppNavigate } from '../navigation'
import { useTransfers, type ResourceTransfer, type TransferDateFilter } from '../hooks'
import { useI18nCode } from '../i18n'
import { getI18nBookings } from '../locales/i18nBookings'
import { getI18nCommon } from '../locales/i18nCommon'
import {
  cx, formatDateDisplay, formatPrice,
  StatusPill, ColumnPopover, SortDropdown, DateFilter, StatusFilter,
  CursorPagination, LoadingOverlay, EmptyState, ErrorBanner, DateGroupHeader,
  IconSearch, IconRefresh,
  type ColumnConfig, type SortOrder, type DateFilterValue,
} from '../components/ui'

const _DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'code', label: 'Code', visible: true },
  { id: 'status', label: 'Status', visible: true },
  { id: 'route', label: 'Route', visible: true },
  { id: 'pickup', label: 'Pickup', visible: true },
  { id: 'vehicle', label: 'Vehicle', visible: true },
  { id: 'fare', label: 'Price', visible: true },
  { id: 'payment', label: 'Payment', visible: true },
  { id: 'category', label: 'Category', visible: false },
]

const COLUMN_WIDTHS: Record<string, number> = {
  code: 90, status: 110, route: 240, pickup: 140, vehicle: 150, fare: 100, payment: 100, category: 120,
}

const ITEMS_PER_PAGE = 15

export function BookingView() {
  const navigate = useAppNavigate()
  const i18nCode = useI18nCode()
  const { strings: t } = getI18nBookings(i18nCode)
  const { strings: tc } = getI18nCommon(i18nCode)

  const i18nColumns = useMemo<ColumnConfig[]>(() => [
    { id: 'code', label: t.ColCode, visible: true },
    { id: 'status', label: t.ColStatus, visible: true },
    { id: 'route', label: t.ColRoute, visible: true },
    { id: 'pickup', label: t.ColPickup, visible: true },
    { id: 'vehicle', label: t.ColVehicle, visible: true },
    { id: 'fare', label: t.ColPrice, visible: true },
    { id: 'payment', label: t.ColPayment, visible: true },
    { id: 'category', label: t.ColCategory, visible: false },
  ], [t])
  const [columns, setColumns] = useState<ColumnConfig[]>(i18nColumns)
  const [colPopoverOpen, setColPopoverOpen] = useState(false)
  const [sortOrder, setSortOrder] = useState<SortOrder>('earliest')
  const [dateFilter, setDateFilter] = useState<DateFilterValue>('all')
  const [customRange, setCustomRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null })
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set(['Completed', 'Planned', 'In Progress', 'Cancelled']))
  const [searchQuery, setSearchQuery] = useState('')

  const today = useMemo(() => new Date().toISOString().split('T')[0] ?? '', [])
  const tomorrow = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0] ?? '' }, [])

  const serverDateFilter = useMemo<TransferDateFilter | undefined>(() => {
    if (dateFilter === 'today') return { fromISO: today, toISO: today }
    if (dateFilter === 'tomorrow') return { fromISO: tomorrow, toISO: tomorrow }
    if (dateFilter === 'custom' && customRange.start && customRange.end) {
      const s = customRange.start.toISOString().split('T')[0] ?? ''
      const e = customRange.end.toISOString().split('T')[0] ?? ''
      return { fromISO: s, toISO: e }
    }
    return undefined
  }, [dateFilter, today, tomorrow, customRange])

  const { transfers, isLoading, error, pagination, nextPage, prevPage, goToPage, refetch } = useTransfers(ITEMS_PER_PAGE, serverDateFilter)
  const bookings = transfers

  const mapStatus = (state: string): string => {
    const s = state?.toLowerCase?.() ?? ''
    if (s === 'completed') return 'Completed'
    if (s === 'planned' || s === 'pending') return 'Planned'
    if (s === 'cancelled' || s === 'canceled' || s === 'terminated') return 'Cancelled'
    if (s === 'in_progress' || s === 'active') return 'In Progress'
    return 'Planned'
  }

  const filteredRows = useMemo(() => {
    let result = bookings.filter(t => selectedStatuses.has(mapStatus(t.state)))

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(t =>
        (t.referenceId?.toLowerCase().includes(q)) ||
        (t.pickup?.toLowerCase().includes(q)) ||
        (t.dropoff?.toLowerCase().includes(q)) ||
        (t.customerName?.toLowerCase().includes(q))
      )
    }

    result = [...result].sort((a, b) => {
      const dtA = `${a.rideDateISO} ${a.rideTime}`
      const dtB = `${b.rideDateISO} ${b.rideTime}`
      return sortOrder === 'earliest' ? dtA.localeCompare(dtB) : dtB.localeCompare(dtA)
    })

    return result
  }, [bookings, selectedStatuses, sortOrder, searchQuery])

  const paginatedRows = filteredRows

  const rowsByDate = useMemo(() => {
    const map: Record<string, ResourceTransfer[]> = {}
    paginatedRows.forEach(r => { const k = r.rideDateISO || 'unknown'; if (!map[k]) map[k] = []; map[k].push(r) })
    return map
  }, [paginatedRows])

  const sortedDates = useMemo(() => Object.keys(rowsByDate).sort(), [rowsByDate])
  const visibleColumns = columns.filter(c => c.visible)
  const totalMinWidth = visibleColumns.reduce((sum, col) => sum + (COLUMN_WIDTHS[col.id] || 100), 60)

  const renderCell = (t: ResourceTransfer, colId: string) => {
    const w = COLUMN_WIDTHS[colId] || 100
    const tdClass = 'p-4 align-middle'
    switch (colId) {
      case 'code': return <td key={colId} className={tdClass} style={{ width: w }}><span className="font-medium whitespace-nowrap">{t.referenceId || t.id.slice(0, 8)}</span></td>
      case 'status': return <td key={colId} className={tdClass} style={{ width: w }}><StatusPill status={t.state} /></td>
      case 'route': return <td key={colId} className={tdClass} style={{ width: w }}><div className="space-y-1"><div className="text-sm font-medium">{t.pickup}</div><div className="text-sm text-muted-foreground/60">{t.dropoff}</div></div></td>
      case 'pickup': return <td key={colId} className={tdClass} style={{ width: w }}><div className="space-y-1 whitespace-nowrap"><div className="text-sm font-medium">{formatDateDisplay(t.rideDateISO)}</div><div className="text-sm text-muted-foreground/60">{t.rideTime}</div></div></td>
      case 'vehicle': return <td key={colId} className={tdClass} style={{ width: w }}><div className="text-sm">{t.vehicle || '-'}</div></td>
      case 'fare': return <td key={colId} className={tdClass} style={{ width: w }}><div className="font-semibold whitespace-nowrap">{formatPrice(t.price)}</div></td>
      case 'payment': return <td key={colId} className={tdClass} style={{ width: w }}><div className="text-sm">{t.paymentMethode || '-'}</div></td>
      case 'category': return <td key={colId} className={tdClass} style={{ width: w }}><div className="text-sm">{t.transferCategory || '-'}</div></td>
      default: return null
    }
  }

  const getDateBorderColor = (dateStr: string) => dateStr === today ? '#22c55e' : dateStr === tomorrow ? '#eab308' : 'transparent'
  const getDateHeaderBg = (dateStr: string) => dateStr === today ? 'bg-success/10 text-success' : dateStr === tomorrow ? 'bg-warning/10 text-warning' : 'bg-muted/30 text-muted-foreground'

  return (
    <div className="p-4 md:p-6 max-w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{t.Heading}</h1>
          <p className="text-muted-foreground mt-1">{t.Subtitle}</p>
        </div>
        <button className="inline-flex items-center gap-2 border border-input rounded-md px-3 h-9 text-sm hover:bg-muted transition-colors" onClick={refetch}>
          <IconRefresh className="h-4 w-4" /> {tc.Refresh}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <DateFilter value={dateFilter} onChange={setDateFilter} customRange={customRange} onCustomRangeChange={setCustomRange} />
        <div className="w-full md:w-[180px]">
          <div className="relative">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input className="flex w-full rounded-md border border-input px-3 py-2 text-sm pl-9 h-9 bg-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder={tc.Search} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
        </div>
        <StatusFilter selected={selectedStatuses} onChange={setSelectedStatuses} />
        <SortDropdown value={sortOrder} onChange={setSortOrder} />
      </div>

      {/* Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t.CountLabel.replace('{count}', String(filteredRows.length))}</span>
          <ColumnPopover columns={columns} onColumnsChange={setColumns} onReset={() => setColumns(i18nColumns)} open={colPopoverOpen} onOpenChange={setColPopoverOpen} />
        </div>

        {error && <ErrorBanner message={error} />}

        <div className="rounded-lg border bg-card shadow-sm relative overflow-visible">
          {isLoading && <LoadingOverlay />}
          {!isLoading && filteredRows.length === 0 ? (
            <EmptyState message={t.EmptyMessage} />
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full caption-bottom text-sm table-fixed" style={{ minWidth: totalMinWidth }}>
                  <thead className="[&_tr]:border-b">
                    <tr className="border-b hover:bg-muted/50">
                      {visibleColumns.map(col => (
                        <th key={col.id} className="h-12 px-4 text-left align-middle font-medium text-muted-foreground" style={{ width: COLUMN_WIDTHS[col.id] || 100 }}>{col.label}</th>
                      ))}
                      <th className="h-12 px-4" style={{ width: 60 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedDates.map(dateStr => (
                      <React.Fragment key={dateStr}>
                        <tr style={{ borderLeft: `4px solid ${getDateBorderColor(dateStr)}` }}>
                          <td colSpan={visibleColumns.length + 1} className="p-0">
                            <div className={cx('px-4 py-2 font-semibold text-sm', getDateHeaderBg(dateStr))}>
                              {new Date(dateStr + 'T00:00:00').toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                            </div>
                          </td>
                        </tr>
                        {(rowsByDate[dateStr] ?? []).map(t => (
                          <tr key={t.id} className={cx('border-b transition-colors hover:bg-muted/50', mapStatus(t.state) === 'Completed' ? 'bg-muted/30 text-muted-foreground/60' : '')}>
                            {visibleColumns.map(col => renderCell(t, col.id))}
                            <td className="p-4 align-middle" style={{ width: 60 }}>
                              <button className="text-sm text-primary hover:underline" onClick={() => navigate(`/booking/${t.id}`)}>{tc.Details}</button>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-3 p-4">
                {sortedDates.map(dateStr => (
                  <React.Fragment key={dateStr}>
                    <DateGroupHeader dateStr={dateStr} today={today} tomorrow={tomorrow} />
                    {(rowsByDate[dateStr] ?? []).map(t => (
                      <div key={t.id} className="rounded-lg border bg-card p-4 space-y-3 cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/booking/${t.id}`)}>
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{t.referenceId || t.id.slice(0, 8)}</span>
                          <StatusPill status={t.state} />
                        </div>
                        <div className="text-sm"><div className="font-medium">{t.pickup}</div><div className="text-muted-foreground">{t.dropoff}</div></div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{formatDateDisplay(t.rideDateISO)} {t.rideTime}</span>
                          <span className="font-semibold">{formatPrice(t.price)}</span>
                        </div>
                      </div>
                    ))}
                  </React.Fragment>
                ))}
              </div>
            </>
          )}
        </div>
        <CursorPagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalCount={pagination.totalCount}
          hasNextPage={pagination.hasNextPage}
          hasPreviousPage={pagination.hasPreviousPage}
          onNext={nextPage}
          onPrev={prevPage}
          onFirst={() => goToPage(1)}
        />
      </div>
    </div>
  )
}
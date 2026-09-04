import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import ReactDOM from 'react-dom'
import { getPortalRoot } from '../portal'
import {
  useTransfers, useUsers, useCars, useDrivers,
  assignDriverMutation, assignCarMutation, setPriceMutation, createTransferMutation,
  type ResourceTransfer, type ResourceUser, type ResourceCar, type CreateTransferArgs,
  type TransferDateFilter,
} from '../hooks'
import {
  cx, formatDateDisplay, formatPrice,
  StatusPill, ColumnPopover, SortDropdown, DateFilter, StatusFilter,
  CursorPagination, LoadingOverlay, EmptyState, ErrorBanner, DateGroupHeader,
  IconSearch, IconUsers, IconRefresh, IconX, IconPlus, IconCheck,
  IconMapPin, IconCalendar, IconClock, IconTriangleAlert, IconCar,
  type ColumnConfig, type SortOrder, type DateFilterValue,
} from '../components/ui'
import { useI18nCode } from '../i18n'

/**
 * A driver's name, as a dispatcher would say it. Falls back to the login name
 * only if the account has no profile at all, which should not happen for
 * someone holding the driver role.
 */
const driverDisplayName = (u: ResourceUser): string => {
  const full = `${u.details?.firstName ?? ''} ${u.details?.lastName ?? ''}`.trim()
  return full || u.username || u.primaryEmailAddress
}
import { getI18nTransfers } from '../locales/i18nTransfers'
import { getI18nCommon } from '../locales/i18nCommon'

// ============================================================
// Constants
// ============================================================

const COLUMN_WIDTHS: Record<string, number> = {
  code: 90, status: 110, route: 220, pickup: 130, capacity: 100,
  driver: 150, vehicle: 150, price: 120, customer: 150, category: 120, payment: 100,
}

const ITEMS_PER_PAGE = 15

// ============================================================
// Toast
// ============================================================

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t) }, [onClose])
  const bg = type === 'success' ? 'bg-green-600' : 'bg-red-600'
  return (
    <div className={`fixed bottom-4 right-4 z-[60] ${bg} text-white px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm`}>
      <div className="flex items-center justify-between gap-3">
        <span>{message}</span>
        <button className="text-white/80 hover:text-white" onClick={onClose}><IconX className="h-3 w-3" /></button>
      </div>
    </div>
  )
}

// ============================================================
// ModalShell (for Create Transfer)
// ============================================================

function ModalShell({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border rounded-lg shadow-lg w-full max-w-md mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="text-muted-foreground hover:text-foreground" onClick={onClose}><IconX className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

// ============================================================
// Driver Assignment Popover (portal, smart-positioned)
// ============================================================

const POPOVER_HEIGHT = 420
const POPOVER_WIDTH = 320

function DriverAssignmentPopover({ open, onOpenChange, onSelect, buttonRef, drivers, loading }: {
  open: boolean; onOpenChange: (o: boolean) => void; onSelect: (userId: string) => void
  buttonRef: React.RefObject<HTMLDivElement | null>; drivers: ResourceUser[]; loading: boolean
}) {
  const i18nCode = useI18nCode()
  const { strings: t } = getI18nTransfers(i18nCode)

  const popoverRef = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState('')
  const [sendSms, setSendSms] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, openUp: false, openLeft: false })

  useEffect(() => {
    const update = () => {
      if (buttonRef.current && open) {
        const r = buttonRef.current.getBoundingClientRect()
        const vh = window.innerHeight, vw = window.innerWidth
        const openUp = (vh - r.top) < POPOVER_HEIGHT + 20 && r.bottom > (vh - r.top)
        const openLeft = (vw - r.right) < POPOVER_WIDTH + 20
        setPos({
          top: openUp ? r.bottom - POPOVER_HEIGHT + 8 : r.top - 8,
          left: openLeft ? r.left - POPOVER_WIDTH - 8 : r.right + 8,
          openUp, openLeft,
        })
      }
    }
    const outside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node) && buttonRef.current && !buttonRef.current.contains(e.target as Node)) onOpenChange(false)
    }
    if (open) {
      update()
      const tid = setTimeout(() => document.addEventListener('mousedown', outside), 0)
      window.addEventListener('scroll', update, true)
      window.addEventListener('resize', update)
      return () => { clearTimeout(tid); document.removeEventListener('mousedown', outside); window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update) }
    }
    return () => document.removeEventListener('mousedown', outside)
  }, [open, onOpenChange, buttonRef])

  const filtered = useMemo(() => {
    if (!search.trim()) return drivers
    const q = search.toLowerCase()
    return drivers.filter(u => driverDisplayName(u).toLowerCase().includes(q))
  }, [drivers, search])

  if (!open) return null

  // The portal root does not exist during server rendering, and this view is
  // statically rendered like every other page. Skipping the portal is what the
  // old code meant to do before its guard returned document.body on a document
  // it had just established was undefined.
  const root = getPortalRoot()
  if (!root) return null

  return ReactDOM.createPortal(
    <div ref={popoverRef} className="fixed rounded-md border bg-background text-popover-foreground shadow-lg z-[9999] w-[320px] p-4 h-[420px] flex flex-col" style={{ top: pos.top, left: pos.left, pointerEvents: 'auto' }} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
      {/* Arrow */}
      <div className={`absolute w-4 h-4 rotate-45 bg-background ${pos.openLeft ? '-right-2 border-r border-t border-border' : '-left-2 border-l border-b border-border'}`} style={{ top: pos.openUp ? 'auto' : 16, bottom: pos.openUp ? 16 : 'auto' }} />
      <div className="relative bg-background rounded-md flex flex-col h-full">
        <div className="relative flex-shrink-0 mb-3">
          <IconSearch className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <input className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm pl-8 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder={t.SearchDrivers} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">{t.NoDriversFound}</div>
          ) : filtered.map(u => (
            <button key={u.id} className="w-full text-left p-3 rounded-lg border bg-background hover:bg-accent hover:text-white cursor-pointer transition-colors group mb-2 disabled:opacity-50" onClick={() => { onSelect(u.id); onOpenChange(false) }} disabled={loading}>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: u.driverColor || '#888' }} />
                {/* The name and nothing else. A login name here is a mail
                    address for anyone created from one, which is not what a
                    dispatcher is looking for. */}
                <div className="font-medium text-sm">{driverDisplayName(u)}</div>
              </div>
            </button>
          ))}
        </div>
        <div className="pt-3 border-t flex-shrink-0">
          <div className="flex items-center gap-2 p-2 rounded-md bg-green-500/10 border border-green-500/20">
            <button role="checkbox" aria-checked={sendSms} className={cx('h-4 w-4 shrink-0 rounded-sm border flex items-center justify-center', sendSms ? 'bg-green-500 border-green-500 text-white' : 'border-green-500/40')} onClick={() => setSendSms(!sendSms)}>
              {sendSms && <IconCheck className="h-3 w-3" />}
            </button>
            <span className="text-xs text-green-600 select-none cursor-pointer" onClick={() => setSendSms(!sendSms)}>{t.SendSmsNotification}</span>
          </div>
        </div>
      </div>
    </div>,
    root
  )
}

// ============================================================
// Vehicle Assignment Popover (portal, smart-positioned)
// ============================================================

function VehicleAssignmentPopover({ open, onOpenChange, onSelect, buttonRef, vehicles, loading }: {
  open: boolean; onOpenChange: (o: boolean) => void; onSelect: (carId: string) => void
  buttonRef: React.RefObject<HTMLDivElement | null>; vehicles: ResourceCar[]; loading: boolean
}) {
  const i18nCode = useI18nCode()
  const { strings: t } = getI18nTransfers(i18nCode)

  const popoverRef = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState('')
  const [pos, setPos] = useState({ top: 0, left: 0, openUp: false, openLeft: false })

  useEffect(() => {
    const update = () => {
      if (buttonRef.current && open) {
        const r = buttonRef.current.getBoundingClientRect()
        const vh = window.innerHeight, vw = window.innerWidth
        const openUp = (vh - r.top) < POPOVER_HEIGHT + 20 && r.bottom > (vh - r.top)
        const openLeft = (vw - r.right) < POPOVER_WIDTH + 20
        setPos({
          top: openUp ? r.bottom - POPOVER_HEIGHT + 8 : r.top - 8,
          left: openLeft ? r.left - POPOVER_WIDTH - 8 : r.right + 8,
          openUp, openLeft,
        })
      }
    }
    const outside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node) && buttonRef.current && !buttonRef.current.contains(e.target as Node)) onOpenChange(false)
    }
    if (open) {
      update()
      const tid = setTimeout(() => document.addEventListener('mousedown', outside), 0)
      window.addEventListener('scroll', update, true)
      window.addEventListener('resize', update)
      return () => { clearTimeout(tid); document.removeEventListener('mousedown', outside); window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update) }
    }
    return () => document.removeEventListener('mousedown', outside)
  }, [open, onOpenChange, buttonRef])

  const filtered = useMemo(() => {
    if (!search.trim()) return vehicles
    const q = search.toLowerCase()
    return vehicles.filter(c => c.licensePlate.toLowerCase().includes(q) || (c.carName?.toLowerCase().includes(q)) || (c.driverName?.toLowerCase().includes(q)))
  }, [vehicles, search])

  if (!open) return null

  // The portal root does not exist during server rendering, and this view is
  // statically rendered like every other page. Skipping the portal is what the
  // old code meant to do before its guard returned document.body on a document
  // it had just established was undefined.
  const root = getPortalRoot()
  if (!root) return null

  return ReactDOM.createPortal(
    <div ref={popoverRef} className="fixed rounded-md border bg-background text-popover-foreground shadow-lg z-[9999] w-[320px] p-4 h-[420px] flex flex-col" style={{ top: pos.top, left: pos.left, pointerEvents: 'auto' }} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
      <div className={`absolute w-4 h-4 rotate-45 bg-background ${pos.openLeft ? '-right-2 border-r border-t border-border' : '-left-2 border-l border-b border-border'}`} style={{ top: pos.openUp ? 'auto' : 16, bottom: pos.openUp ? 16 : 'auto' }} />
      <div className="relative bg-background rounded-md flex flex-col h-full">
        <div className="relative flex-shrink-0 mb-3">
          <IconSearch className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <input className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm pl-8 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder={t.SearchVehicles} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">{t.NoVehiclesFound}</div>
          ) : filtered.map(c => (
            <button key={c.id} className="w-full text-left px-3 py-2.5 rounded-md hover:bg-accent transition-colors flex items-center gap-3 disabled:opacity-50" onClick={() => { onSelect(c.id); onOpenChange(false) }} disabled={loading}>
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <IconCar className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{c.carName || c.licensePlate}</div>
                <div className="text-xs text-muted-foreground truncate">{c.licensePlate}{c.carClass ? ` \u00B7 ${c.carClass}` : ''}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>,
    root
  )
}

// ============================================================
// Not Assigned Badge (Driver) - opens inline popover
// ============================================================

function NotAssignedDriverBadge({ transfer, drivers, onAssign, loading }: {
  transfer: ResourceTransfer; drivers: ResourceUser[]; onAssign: (transferId: string, driverId: string) => void; loading: boolean
}) {
  const i18nCode = useI18nCode()
  const { strings: t } = getI18nTransfers(i18nCode)

  const [open, setOpen] = useState(false)
  const badgeRef = useRef<HTMLDivElement>(null)
  return (
    <div className="relative overflow-visible" ref={badgeRef}>
      <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-warning/10 text-warning border-warning/20 gap-1 cursor-pointer hover:bg-warning/20 transition-colors whitespace-nowrap" onClick={e => { e.stopPropagation(); setOpen(!open) }}>
        <IconTriangleAlert className="h-3 w-3" />
        {t.NotAssigned}
      </div>
      <DriverAssignmentPopover open={open} onOpenChange={setOpen} onSelect={id => onAssign(transfer.id, id)} buttonRef={badgeRef} drivers={drivers} loading={loading} />
    </div>
  )
}

// ============================================================
// Assign Driver First Badge (Vehicle column, non-clickable)
// ============================================================

function AssignDriverFirstBadge() {
  const i18nCode = useI18nCode()
  const { strings: t } = getI18nTransfers(i18nCode)

  return (
    <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-muted text-muted-foreground border-muted cursor-not-allowed gap-1 whitespace-nowrap">
      <IconTriangleAlert className="h-3 w-3" />
      {t.AssignDriverFirst}
    </div>
  )
}

// ============================================================
// Not Assigned Vehicle Badge (blue, opens inline popover)
// ============================================================

function NotAssignedVehicleBadge({ transfer, vehicles, onAssign, loading }: {
  transfer: ResourceTransfer; vehicles: ResourceCar[]; onAssign: (transferId: string, carId: string) => void; loading: boolean
}) {
  const i18nCode = useI18nCode()
  const { strings: t } = getI18nTransfers(i18nCode)

  const [open, setOpen] = useState(false)
  const badgeRef = useRef<HTMLDivElement>(null)
  return (
    <div className="relative overflow-visible" ref={badgeRef}>
      <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-blue-500/10 text-blue-500 border-blue-500/20 gap-1 cursor-pointer hover:bg-blue-500/20 transition-colors whitespace-nowrap" onClick={e => { e.stopPropagation(); setOpen(!open) }}>
        <IconCar className="h-3 w-3" />
        {t.AssignVehicle}
      </div>
      <VehicleAssignmentPopover open={open} onOpenChange={setOpen} onSelect={id => onAssign(transfer.id, id)} buttonRef={badgeRef} vehicles={vehicles} loading={loading} />
    </div>
  )
}

// ============================================================
// Price Assignment Popover (portal, smart-positioned)
// ============================================================

function PriceAssignmentPopover({ open, onOpenChange, onSubmit, buttonRef, loading }: {
  open: boolean; onOpenChange: (o: boolean) => void; onSubmit: (price: number) => void
  buttonRef: React.RefObject<HTMLDivElement | null>; loading: boolean
}) {
  const i18nCode = useI18nCode()
  const { strings: t } = getI18nTransfers(i18nCode)
  const { strings: tc } = getI18nCommon(i18nCode)

  const popoverRef = useRef<HTMLDivElement>(null)
  const [value, setValue] = useState('')
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => { if (open) setValue('') }, [open])

  useEffect(() => {
    const update = () => {
      if (buttonRef.current && open) {
        const r = buttonRef.current.getBoundingClientRect()
        const vh = window.innerHeight
        const openUp = (vh - r.bottom) < 180 && r.top > 180
        setPos({ top: openUp ? r.top - 170 : r.bottom + 8, left: Math.max(8, r.left - 80) })
      }
    }
    const outside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node) && buttonRef.current && !buttonRef.current.contains(e.target as Node)) onOpenChange(false)
    }
    if (open) {
      update()
      const tid = setTimeout(() => document.addEventListener('mousedown', outside), 0)
      window.addEventListener('scroll', update, true)
      window.addEventListener('resize', update)
      return () => { clearTimeout(tid); document.removeEventListener('mousedown', outside); window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update) }
    }
    return () => document.removeEventListener('mousedown', outside)
  }, [open, onOpenChange, buttonRef])

  if (!open) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const n = parseFloat(value)
    if (!isNaN(n) && n >= 0) { onSubmit(n); onOpenChange(false) }
  }

  // The portal root does not exist during server rendering, and this view is
  // statically rendered like every other page. Skipping the portal is what the
  // old code meant to do before its guard returned document.body on a document
  // it had just established was undefined.
  const root = getPortalRoot()
  if (!root) return null

  return ReactDOM.createPortal(
    <div ref={popoverRef} className="fixed rounded-md border bg-background text-popover-foreground shadow-lg z-[9999] w-[220px] p-3 flex flex-col gap-2" style={{ top: pos.top, left: pos.left, pointerEvents: 'auto' }} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t.SetPriceHeading}</div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">&euro;</span>
          <input type="number" min="0" step="0.01" autoFocus className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm pl-7 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="0.00" value={value} onChange={e => setValue(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="flex-1 inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-3 h-8 text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors" disabled={loading || !value || isNaN(parseFloat(value))}>{t.SetPriceSubmit}</button>
          <button type="button" className="inline-flex items-center justify-center rounded-md border border-input px-3 h-8 text-xs hover:bg-muted transition-colors" onClick={() => onOpenChange(false)}>{tc.Cancel}</button>
        </div>
      </form>
    </div>,
    root
  )
}

// ============================================================
// Not Assigned Price Badge (green, opens inline popover)
// ============================================================

function NotAssignedPriceBadge({ transfer, onSetPrice, loading }: {
  transfer: ResourceTransfer; onSetPrice: (transferId: string, price: number) => void; loading: boolean
}) {
  const i18nCode = useI18nCode()
  const { strings: t } = getI18nTransfers(i18nCode)

  const [open, setOpen] = useState(false)
  const badgeRef = useRef<HTMLDivElement>(null)
  return (
    <div className="relative overflow-visible" ref={badgeRef}>
      <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1 cursor-pointer hover:bg-emerald-500/20 transition-colors whitespace-nowrap" onClick={e => { e.stopPropagation(); setOpen(!open) }}>
        {t.SetPrice}
      </div>
      <PriceAssignmentPopover open={open} onOpenChange={setOpen} onSubmit={price => onSetPrice(transfer.id, price)} buttonRef={badgeRef} loading={loading} />
    </div>
  )
}

// ============================================================
// Main: TransfersView
// ============================================================

export function TransfersView() {
  const { users } = useUsers()
  // The picker offers drivers, not every account. See useDrivers: it asks for
  // the brand's driver role and drops deactivated people.
  const { drivers } = useDrivers()
  const { cars } = useCars()

  const i18nCode = useI18nCode()
  const { strings: t } = getI18nTransfers(i18nCode)
  const { strings: tc } = getI18nCommon(i18nCode)

  const i18nColumns = useMemo<ColumnConfig[]>(() => [
    { id: 'code', label: t.ColId, visible: true },
    { id: 'status', label: t.ColStatus, visible: true },
    { id: 'route', label: t.ColRoute, visible: true },
    { id: 'pickup', label: t.ColPickup, visible: true },
    { id: 'capacity', label: t.ColCapacity, visible: true },
    { id: 'driver', label: t.ColDriver, visible: true },
    { id: 'vehicle', label: t.ColVehicle, visible: true },
    { id: 'price', label: t.ColPrice, visible: true },
    { id: 'customer', label: t.ColCustomer, visible: false },
    { id: 'category', label: t.ColCategory, visible: false },
    { id: 'payment', label: t.ColPayment, visible: false },
  ], [t])

  const [columns, setColumns] = useState<ColumnConfig[]>(i18nColumns)
  const [colPopoverOpen, setColPopoverOpen] = useState(false)
  const [sortOrder, setSortOrder] = useState<SortOrder>('earliest')
  const [dateFilter, setDateFilter] = useState<DateFilterValue>('all')
  const [customRange, setCustomRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null })
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set(['Completed', 'Planned', 'In Progress', 'Cancelled']))
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTransfer, setSelectedTransfer] = useState<ResourceTransfer | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [mutating, setMutating] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

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

  const mapStatus = (state: string): string => {
    const s = state?.toLowerCase?.() ?? ''
    if (s === 'completed') return 'Completed'
    if (s === 'planned' || s === 'pending') return 'Planned'
    if (s === 'cancelled' || s === 'canceled' || s === 'terminated') return 'Cancelled'
    if (s === 'in_progress' || s === 'active') return 'In Progress'
    return 'Planned'
  }

  // ---------- Mutation handlers (optimistic) ----------
  const handleAssignDriver = useCallback(async (transferId: string, driverId: string) => {
    const driver = drivers.find(u => u.id === driverId)
    setMutating(true)
    setToast({ message: t.ToastAssigning.replace('{name}', driver?.username || 'driver'), type: 'success' })
    try {
      await assignDriverMutation(transferId, driverId)
      setToast({ message: t.ToastAssignedSuccess.replace('{name}', driver?.username || 'Driver'), type: 'success' })
      refetch()
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : t.ToastAssignDriverFailed, type: 'error' })
    } finally { setMutating(false) }
  }, [users, refetch, t])

  const handleAssignCar = useCallback(async (transferId: string, carId: string) => {
    const car = cars.find(c => c.id === carId)
    setMutating(true)
    setToast({ message: t.ToastAssigning.replace('{name}', car?.carName || car?.licensePlate || 'vehicle'), type: 'success' })
    try {
      await assignCarMutation(transferId, carId)
      setToast({ message: t.ToastAssignedSuccess.replace('{name}', car?.carName || car?.licensePlate || 'Vehicle'), type: 'success' })
      refetch()
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : t.ToastAssignVehicleFailed, type: 'error' })
    } finally { setMutating(false) }
  }, [cars, refetch, t])

  const handleSetPrice = useCallback(async (transferId: string, price: number) => {
    setMutating(true)
    try {
      await setPriceMutation(transferId, price)
      setToast({ message: t.ToastPriceUpdated, type: 'success' })
      refetch()
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : t.ToastPriceFailed, type: 'error' })
    } finally { setMutating(false) }
  }, [refetch, t])

  const handleCreateTransfer = useCallback(async (args: CreateTransferArgs) => {
    setMutating(true)
    try {
      await createTransferMutation(args)
      setToast({ message: t.TransferCreated, type: 'success' })
      setCreateModalOpen(false)
      refetch()
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : t.TransferCreateFailed, type: 'error' })
    } finally { setMutating(false) }
  }, [refetch, t])

  // ---------- Client-side filtering / sorting (within current server page) ----------
  const filteredRows = useMemo(() => {
    let result = transfers.filter(tr => selectedStatuses.has(mapStatus(tr.state)))
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(tr => (tr.referenceId?.toLowerCase().includes(q)) || (tr.pickup?.toLowerCase().includes(q)) || (tr.dropoff?.toLowerCase().includes(q)) || (tr.driverName?.toLowerCase().includes(q)) || (tr.customerName?.toLowerCase().includes(q)) || (tr.id?.toLowerCase().includes(q)))
    }
    return [...result].sort((a, b) => {
      const dtA = `${a.rideDateISO} ${a.rideTime}`, dtB = `${b.rideDateISO} ${b.rideTime}`
      return sortOrder === 'earliest' ? dtA.localeCompare(dtB) : dtB.localeCompare(dtA)
    })
  }, [transfers, selectedStatuses, sortOrder, searchQuery])

  const paginatedRows = filteredRows
  const visibleColumns = columns.filter(c => c.visible)
  const totalMinWidth = visibleColumns.reduce((s, c) => s + (COLUMN_WIDTHS[c.id] || 100), 60)

  const enrichedTransfers = useMemo(() => {
    // Drivers first, then the current page of accounts. `drivers` comes from
    // usersByRole and is the whole list, so a driver is found whatever page of
    // `users` happens to be loaded, and it is the only one of the two that
    // carries a colour.
    const userMap = new Map<string, (typeof users)[number]>()
    users.forEach(u => userMap.set(u.id, u))
    drivers.forEach(d => userMap.set(d.id, d))
    const carMap = new Map(cars.map(c => [c.id, c]))
    return paginatedRows.map(tr => {
      const enriched = { ...tr }
      const driver = tr.driverId ? userMap.get(tr.driverId) : undefined

      // The colour is set even when the transfer already carries a driver
      // name. It used to hang off the same `!tr.driverName` branch as the name
      // lookup, so any transfer that arrived named came out uncoloured.
      if (driver?.driverColor) {
        enriched.driverColor = driver.driverColor
      }

      if (tr.driverId && !tr.driverName) {
        if (driver) {
          enriched.driverName = driver.details?.firstName && driver.details?.lastName
            ? `${driver.details.firstName} ${driver.details.lastName}`
            : driver.username
          enriched.driverPhone = undefined
        } else {
          enriched.driverName = tr.driverId
        }
      }
      const carId = tr.vehicle
      if (carId && !tr.carLicensePlate) {
        const car = carMap.get(carId)
        if (car) {
          enriched.vehicle = car.carName || car.licensePlate
          enriched.carLicensePlate = car.licensePlate
          enriched.carColor = car.color
          enriched.carClass = car.carClass
        }
      }
      return enriched
    })
  }, [paginatedRows, users, drivers, cars])

  const enrichedRowsByDate = useMemo(() => {
    const m: Record<string, ResourceTransfer[]> = {}
    enrichedTransfers.forEach(r => { const k = r.rideDateISO || 'unknown'; if (!m[k]) m[k] = []; m[k].push(r) })
    return m
  }, [enrichedTransfers])
  const enrichedSortedDates = useMemo(() => Object.keys(enrichedRowsByDate).sort(), [enrichedRowsByDate])

  useEffect(() => {
    if (selectedTransfer) {
      const updated = enrichedTransfers.find(tr => tr.id === selectedTransfer.id)
      if (updated) setSelectedTransfer(updated)
    }
  }, [enrichedTransfers])

  const onSelectTransfer = useCallback((tr: ResourceTransfer) => setSelectedTransfer(prev => prev?.id === tr.id ? null : tr), [])

  // ---------- Cell renderer ----------
  const renderCell = (tr: ResourceTransfer, colId: string) => {
    const w = COLUMN_WIDTHS[colId] || 100
    const td = 'p-4 align-middle'
    switch (colId) {
      case 'code': {
        const code = tr.referenceId || tr.id.replace(/^transfer:/, '').replace(/^legacy:/, '#')
        return <td key={colId} className={td} style={{ width: w }}><span className="font-medium whitespace-nowrap">{code}</span></td>
      }
      case 'status': return <td key={colId} className={td} style={{ width: w }}><StatusPill status={tr.state} /></td>
      case 'route': return <td key={colId} className={td} style={{ width: w }}><div className="space-y-1"><div className="text-sm font-medium">{tr.pickup}</div><div className="text-sm text-muted-foreground/60">{tr.dropoff}</div></div></td>
      case 'pickup': return <td key={colId} className={td} style={{ width: w }}><div className="space-y-1 whitespace-nowrap"><div className="text-sm font-medium">{formatDateDisplay(tr.rideDateISO)}</div><div className="text-sm text-muted-foreground/60">{tr.rideTime}</div></div></td>
      case 'capacity': return <td key={colId} className={td} style={{ width: w }}><div className="flex items-center gap-1 text-sm whitespace-nowrap"><IconUsers className="h-3 w-3 text-muted-foreground/60" /><span>{tr.passengerCount ?? '-'} {t.Pax}</span></div></td>
      case 'driver': {
        const isCancelled = mapStatus(tr.state) === 'Cancelled'
        const hasDriver = !!tr.driverName
        return (
          <td key={colId} className={td} style={{ width: w }}>
            {hasDriver ? (
              <div className="text-sm"><div className="font-medium flex items-center gap-1.5">{tr.driverColor && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 inline-block" style={{ backgroundColor: tr.driverColor }} />}{tr.driverName}</div>{tr.driverPhone && <div className="text-xs text-muted-foreground/60">{tr.driverPhone}</div>}</div>
            ) : isCancelled ? (
              <span className="text-sm text-muted-foreground">-</span>
            ) : (
              <NotAssignedDriverBadge transfer={tr} drivers={drivers} onAssign={handleAssignDriver} loading={mutating} />
            )}
          </td>
        )
      }
      case 'vehicle': {
        const isCancelled = mapStatus(tr.state) === 'Cancelled'
        const hasVehicle = !!(tr.carLicensePlate || tr.vehicle)
        const hasDriver = !!(tr.driverName || tr.driverId)
        return (
          <td key={colId} className={td} style={{ width: w }}>
            {hasVehicle ? (
              <div className="text-sm"><div className="font-medium">{tr.vehicle || '-'}</div><div className="text-xs text-muted-foreground/60">{tr.carLicensePlate}</div></div>
            ) : isCancelled ? (
              <span className="text-sm text-muted-foreground">-</span>
            ) : !hasDriver ? (
              <AssignDriverFirstBadge />
            ) : (
              <NotAssignedVehicleBadge transfer={tr} vehicles={cars} onAssign={handleAssignCar} loading={mutating} />
            )}
          </td>
        )
      }
      case 'price': {
        const isCancelled2 = mapStatus(tr.state) === 'Cancelled'
        const hasPrice = tr.price != null && tr.price > 0
        return (
          <td key={colId} className={td} style={{ width: w }}>
            {hasPrice ? (
              <div className="font-semibold whitespace-nowrap">{formatPrice(tr.price)}</div>
            ) : isCancelled2 ? (
              <span className="text-sm text-muted-foreground">-</span>
            ) : (
              <NotAssignedPriceBadge transfer={tr} onSetPrice={handleSetPrice} loading={mutating} />
            )}
          </td>
        )
      }
      case 'customer': return <td key={colId} className={td} style={{ width: w }}><div className="text-sm"><div className="font-medium">{tr.customerName || '-'}</div>{tr.customerPhone && <div className="text-xs text-muted-foreground/60">{tr.customerPhone}</div>}</div></td>
      case 'category': return <td key={colId} className={td} style={{ width: w }}><div className="text-sm">{tr.transferCategory || '-'}</div></td>
      case 'payment': return <td key={colId} className={td} style={{ width: w }}><div className="text-sm">{tr.paymentMethode || '-'}</div></td>
      default: return null
    }
  }

  const getDateBorderColor = (d: string) => d === today ? '#22c55e' : d === tomorrow ? '#eab308' : 'transparent'
  const getDateHeaderBg = (d: string) => d === today ? 'bg-success/10 text-success' : d === tomorrow ? 'bg-warning/10 text-warning' : 'bg-muted/30 text-muted-foreground'

  // ---------- Render ----------
  return (
    <div className="flex h-full">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <CreateTransferModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} onCreate={handleCreateTransfer} loading={mutating} users={users} />

      <div className={cx('flex-1 p-4 md:p-6 max-w-full space-y-6 transition-all', selectedTransfer ? 'md:mr-[420px]' : '')}>
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div><h1 className="text-2xl md:text-3xl font-bold">{t.Heading}</h1><p className="text-muted-foreground mt-1">{t.Subtitle}</p></div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-3 h-9 text-sm font-medium hover:bg-primary/90 transition-colors" onClick={() => setCreateModalOpen(true)}><IconPlus className="h-4 w-4" /> {t.AddTransfer}</button>
            <button className="inline-flex items-center gap-2 border border-input rounded-md px-3 h-9 text-sm hover:bg-muted transition-colors" onClick={refetch}><IconRefresh className="h-4 w-4" /> {tc.Refresh}</button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-lg border bg-card p-4"><div className="text-sm text-muted-foreground">{t.StatTotal}</div><div className="text-2xl font-bold mt-1">{pagination.totalCount}</div></div>
          <div className="rounded-lg border bg-card p-4"><div className="text-sm text-muted-foreground">{t.StatPage}</div><div className="text-2xl font-bold mt-1">{pagination.currentPage} / {pagination.totalPages}</div></div>
          <div className="rounded-lg border bg-card p-4"><div className="text-sm text-muted-foreground">{t.StatPlannedPage}</div><div className="text-2xl font-bold mt-1">{transfers.filter(tr => mapStatus(tr.state) === 'Planned').length}</div></div>
          <div className="rounded-lg border bg-card p-4"><div className="text-sm text-muted-foreground">{t.StatInProgressPage}</div><div className="text-2xl font-bold mt-1">{transfers.filter(tr => mapStatus(tr.state) === 'In Progress').length}</div></div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap items-center">
          <DateFilter value={dateFilter} onChange={setDateFilter} customRange={customRange} onCustomRangeChange={setCustomRange} />
          <div className="w-full md:w-[180px]"><div className="relative"><IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><input className="flex w-full rounded-md border border-input px-3 py-2 text-sm pl-9 h-9 bg-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder={tc.Search} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div></div>
          <StatusFilter selected={selectedStatuses} onChange={setSelectedStatuses} />
          <SortDropdown value={sortOrder} onChange={setSortOrder} />
        </div>

        {/* Table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t.CountLabel.replace('{total}', String(pagination.totalCount)).replace('{count}', String(filteredRows.length))}</span>
            <ColumnPopover columns={columns} onColumnsChange={setColumns} onReset={() => setColumns(i18nColumns)} open={colPopoverOpen} onOpenChange={setColPopoverOpen} />
          </div>
          {error && <ErrorBanner message={error} />}
          <div className="rounded-lg border bg-card shadow-sm relative overflow-visible">
            {isLoading && <LoadingOverlay />}
            {!isLoading && filteredRows.length === 0 ? (<EmptyState message={t.EmptyMessage} />) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full caption-bottom text-sm table-fixed" style={{ minWidth: totalMinWidth }}>
                    <thead className="[&_tr]:border-b"><tr className="border-b hover:bg-muted/50">{visibleColumns.map(c => <th key={c.id} className="h-12 px-4 text-left align-middle font-medium text-muted-foreground" style={{ width: COLUMN_WIDTHS[c.id] || 100 }}>{c.label}</th>)}<th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground" style={{ width: 60 }} /></tr></thead>
                    <tbody className="[&_tr:last-child]:border-0">
                      {enrichedSortedDates.map(dateStr => (
                        <React.Fragment key={dateStr}>
                          <tr style={{ borderLeft: `4px solid ${getDateBorderColor(dateStr)}` }}><td colSpan={visibleColumns.length + 1} className="p-0"><div className={cx('px-4 py-2 font-semibold text-sm', getDateHeaderBg(dateStr))}>{new Date(dateStr + 'T00:00:00').toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</div></td></tr>
                          {(enrichedRowsByDate[dateStr] ?? []).map(tr => {
                            const muted = mapStatus(tr.state) === 'Completed' ? 'bg-muted/30 text-muted-foreground/60' : ''
                            const active = selectedTransfer?.id === tr.id
                            return (
                              <tr key={tr.id} className={cx('border-b transition-colors hover:bg-muted/50 cursor-pointer', muted, active && 'bg-primary/5 ring-1 ring-inset ring-primary/20')} style={{ borderLeft: tr.driverColor ? `4px solid ${tr.driverColor}` : undefined }} onClick={() => onSelectTransfer(tr)}>
                                {visibleColumns.map(c => renderCell(tr, c.id))}
                                <td className="p-4 align-middle" style={{ width: 60 }}><button className="text-sm text-primary hover:underline whitespace-nowrap" onClick={e => { e.stopPropagation(); onSelectTransfer(tr) }}>{tc.Details}</button></td>
                              </tr>
                            )
                          })}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Mobile cards */}
                <div className="md:hidden space-y-3 p-4">
                  {enrichedSortedDates.map(dateStr => (
                    <React.Fragment key={dateStr}>
                      <DateGroupHeader dateStr={dateStr} today={today} tomorrow={tomorrow} />
                      {(enrichedRowsByDate[dateStr] ?? []).map(tr => (
                        <div key={tr.id} className={cx('rounded-lg border bg-card p-4 space-y-3 cursor-pointer hover:bg-muted/50 transition-colors', selectedTransfer?.id === tr.id && 'ring-2 ring-primary/30')} style={{ borderLeft: tr.driverColor ? `4px solid ${tr.driverColor}` : undefined }} onClick={() => onSelectTransfer(tr)}>
                          <div className="flex items-center justify-between"><span className="font-medium text-sm">{tr.referenceId || tr.id.replace(/^transfer:/, '').replace(/^legacy:/, '#')}</span><StatusPill status={tr.state} /></div>
                          <div className="text-sm"><div className="font-medium">{tr.pickup}</div><div className="text-muted-foreground">{tr.dropoff}</div></div>
                          <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">{formatDateDisplay(tr.rideDateISO)} {tr.rideTime}</span>{tr.price != null && tr.price > 0 ? <span className="font-semibold">{formatPrice(tr.price)}</span> : mapStatus(tr.state) !== 'Cancelled' && <NotAssignedPriceBadge transfer={tr} onSetPrice={handleSetPrice} loading={mutating} />}</div>
                          {tr.driverName ? <div className="text-xs text-muted-foreground">Driver: {tr.driverName}</div> : mapStatus(tr.state) !== 'Cancelled' && <NotAssignedDriverBadge transfer={tr} drivers={drivers} onAssign={handleAssignDriver} loading={mutating} />}
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

      {/* Slide-in detail panel */}
      {selectedTransfer && <DetailPanel transfer={selectedTransfer} onClose={() => setSelectedTransfer(null)} onSetPrice={handleSetPrice} mutating={mutating} />}
    </div>
  )
}

// ============================================================
// Detail Panel (read-only for driver/vehicle, editable price)
// ============================================================

function DetailPanel({ transfer: tr, onClose, onSetPrice, mutating }: {
  transfer: ResourceTransfer; onClose: () => void; onSetPrice: (transferId: string, price: number) => void; mutating: boolean
}) {
  const i18nCode = useI18nCode()
  const { strings: tt } = getI18nTransfers(i18nCode)
  const { strings: tc } = getI18nCommon(i18nCode)

  const [priceEditing, setPriceEditing] = useState(false)
  const [priceValue, setPriceValue] = useState(String(tr.price ?? ''))
  useEffect(() => { setPriceValue(String(tr.price ?? '')) }, [tr.price])

  const isUnassignedDriver = !tr.driverName && !tr.driverId
  const isUnassignedVehicle = !tr.carLicensePlate && !tr.vehicle

  // The portal root does not exist during server rendering, and this view is
  // statically rendered like every other page. Skipping the portal is what the
  // old code meant to do before its guard returned document.body on a document
  // it had just established was undefined.
  const root = getPortalRoot()
  if (!root) return null

  return ReactDOM.createPortal(
    <>
      {/* Backdrop (mobile only) */}
      <div className="fixed inset-0 bg-black/50 z-[9998] md:hidden" onClick={onClose} />
      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-[9999] w-full sm:w-[480px] bg-background border-l border-border shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 flex-shrink-0"><IconMapPin className="h-4 w-4 text-primary" /></div>
            <div className="min-w-0"><h2 className="text-base font-semibold truncate">Transfer {tr.referenceId || tr.id.replace(/^transfer:/, '').replace(/^legacy:/, '#')}</h2><StatusPill status={tr.state} /></div>
          </div>
          <button className="text-muted-foreground hover:text-foreground p-1" onClick={onClose}><IconX className="h-5 w-5" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <PanelSection title={tt.PanelSectionRoute}>
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center mt-1"><div className="w-2.5 h-2.5 rounded-full bg-green-500" /><div className="w-0.5 h-8 bg-border" /><div className="w-2.5 h-2.5 rounded-full bg-red-500" /></div>
              <div className="space-y-3"><div><div className="text-xs text-muted-foreground">{tt.PanelLabelPickup}</div><div className="text-sm font-medium">{tr.pickup}</div></div><div><div className="text-xs text-muted-foreground">{tt.PanelLabelDropoff}</div><div className="text-sm font-medium">{tr.dropoff}</div></div></div>
            </div>
          </PanelSection>
          <PanelSection title={tt.PanelSectionSchedule}>
            <div className="grid grid-cols-2 gap-4">
              <div><div className="text-xs text-muted-foreground">{tt.PanelLabelDate}</div><div className="text-sm font-medium flex items-center gap-1.5"><IconCalendar className="h-3.5 w-3.5 text-muted-foreground" />{formatDateDisplay(tr.rideDateISO)}</div></div>
              <div><div className="text-xs text-muted-foreground">{tt.PanelLabelTime}</div><div className="text-sm font-medium flex items-center gap-1.5"><IconClock className="h-3.5 w-3.5 text-muted-foreground" />{tr.rideTime}</div></div>
            </div>
          </PanelSection>
          <PanelSection title={tt.PanelSectionCapacity}><div className="flex items-center gap-1 text-sm"><IconUsers className="h-3.5 w-3.5 text-muted-foreground" /><span>{tr.passengerCount ?? '-'} {tt.Passengers}</span></div></PanelSection>
          <PanelSection title={tt.PanelSectionCustomer}>{tr.customerName ? (<div className="space-y-1"><div className="text-sm font-medium">{tr.customerName}</div>{tr.customerPhone && <div className="text-sm text-muted-foreground">{tr.customerPhone}</div>}</div>) : (<div className="text-sm text-muted-foreground">{tt.PanelCustomerId.replace('{id}', tr.customerId || '-')}</div>)}</PanelSection>
          <PanelSection title={tt.PanelSectionDriver}>
            {isUnassignedDriver ? (
              <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-warning/10 text-warning border-warning/20 gap-1"><IconTriangleAlert className="h-3 w-3" /> {tt.NotAssigned}</div>
            ) : (
              <div className="space-y-1"><div className="text-sm font-medium flex items-center gap-1.5">{tr.driverColor && <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: tr.driverColor }} />}{tr.driverName || tr.driverId}</div>{tr.driverPhone && <div className="text-sm text-muted-foreground">{tr.driverPhone}</div>}</div>
            )}
          </PanelSection>
          <PanelSection title={tt.PanelSectionVehicle}>
            {isUnassignedVehicle ? (
              <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-muted text-muted-foreground border-muted gap-1"><IconTriangleAlert className="h-3 w-3" /> {isUnassignedDriver ? tt.AssignDriverFirst : tt.NotAssigned}</div>
            ) : (
              <div className="space-y-1"><div className="text-sm font-medium">{tr.vehicle || '-'}</div>{tr.carLicensePlate && <div className="text-sm text-muted-foreground">{tr.carLicensePlate}</div>}</div>
            )}
          </PanelSection>
          {(tr.transferCategory || tr.transferType) && (<PanelSection title={tt.PanelSectionDetails}><div className="grid grid-cols-2 gap-4">{tr.transferCategory && <div><div className="text-xs text-muted-foreground">{tt.PanelLabelCategory}</div><div className="text-sm font-medium">{tr.transferCategory}</div></div>}{tr.transferType && <div><div className="text-xs text-muted-foreground">{tt.PanelLabelType}</div><div className="text-sm font-medium">{tr.transferType}</div></div>}</div></PanelSection>)}
          {tr.extras && tr.extras.length > 0 && (<PanelSection title={tt.PanelSectionExtras}><div className="space-y-1.5">{tr.extras.map((ex, i) => <div key={i} className="flex justify-between gap-6 text-sm"><span className="text-muted-foreground">{ex.type.replace(/_/g, ' ')}</span><span className="font-medium">x {ex.amount}</span></div>)}</div></PanelSection>)}
          {tr.roomOrName && <PanelSection title={tt.PanelSectionNotes}><div className="text-sm text-muted-foreground">{tr.roomOrName}</div></PanelSection>}
        </div>

        {/* Footer: price */}
        <div className="border-t px-5 py-4 flex-shrink-0">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold">{tt.PanelTotalPrice}</span>
            {priceEditing ? (
              <form className="flex items-center gap-2" onSubmit={e => { e.preventDefault(); const n = parseFloat(priceValue); if (!isNaN(n) && n >= 0) { onSetPrice(tr.id, n); setPriceEditing(false) } }}>
                <input type="number" min="0" step="0.01" className="w-24 rounded-md border border-input px-2 py-1 text-sm h-7 bg-background" value={priceValue} onChange={e => setPriceValue(e.target.value)} autoFocus />
                <button type="submit" className="text-xs text-primary hover:underline" disabled={mutating}>{tc.Save}</button>
                <button type="button" className="text-xs text-muted-foreground hover:underline" onClick={() => setPriceEditing(false)}>{tc.Cancel}</button>
              </form>
            ) : (
              <div className="flex items-center gap-3"><span className="text-lg font-bold">{formatPrice(tr.price)}</span><button className="text-xs text-primary hover:underline" onClick={() => setPriceEditing(true)}>{tc.Edit}</button></div>
            )}
          </div>
          {tr.paymentMethode && <div className="text-sm text-muted-foreground mt-1">{tt.PanelPayment.replace('{method}', tr.paymentMethode)}</div>}
        </div>
      </div>
    </>,
    root
  )
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (<div className="space-y-2"><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>{children}</div>)
}

// ============================================================
// Create Transfer Modal
// ============================================================

function CreateTransferModal({ open, onClose, onCreate, loading, users }: { open: boolean; onClose: () => void; onCreate: (args: CreateTransferArgs) => void; loading: boolean; users: ResourceUser[] }) {
  const i18nCode = useI18nCode()
  const { strings: t } = getI18nTransfers(i18nCode)
  const { strings: tc } = getI18nCommon(i18nCode)

  const [form, setForm] = useState({ customerId: '', pickupLocation: '', dropoffLocation: '', pickupDateTime: '', payingParty: '', paymentMethode: '' })
  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  useEffect(() => { if (open) setForm({ customerId: '', pickupLocation: '', dropoffLocation: '', pickupDateTime: '', payingParty: '', paymentMethode: '' }) }, [open])
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (!form.customerId || !form.pickupLocation || !form.dropoffLocation || !form.pickupDateTime) return; onCreate({ customerId: form.customerId, pickupLocation: form.pickupLocation, dropoffLocation: form.dropoffLocation, pickupDateTime: form.pickupDateTime, payingParty: form.payingParty || undefined, paymentMethode: form.paymentMethode || undefined }) }
  const ic = "flex w-full rounded-md border border-input px-3 py-2 text-sm h-9 bg-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  return (
    <ModalShell open={open} onClose={onClose} title={t.CreateModalTitle}>
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <div><label className="block text-sm font-medium mb-1.5">{t.CreateLabelCustomer}</label><select className={ic} value={form.customerId} onChange={e => update('customerId', e.target.value)} required><option value="">{t.CreatePlaceholderCustomer}</option>{users.map(u => <option key={u.id} value={u.id}>{u.details?.firstName && u.details?.lastName ? `${u.details.firstName} ${u.details.lastName}` : u.username} ({u.primaryEmailAddress})</option>)}</select></div>
        <div><label className="block text-sm font-medium mb-1.5">{t.CreateLabelPickup}</label><input className={ic} placeholder={t.CreatePlaceholderPickup} value={form.pickupLocation} onChange={e => update('pickupLocation', e.target.value)} required /></div>
        <div><label className="block text-sm font-medium mb-1.5">{t.CreateLabelDropoff}</label><input className={ic} placeholder={t.CreatePlaceholderDropoff} value={form.dropoffLocation} onChange={e => update('dropoffLocation', e.target.value)} required /></div>
        <div><label className="block text-sm font-medium mb-1.5">{t.CreateLabelDateTime}</label><input type="datetime-local" className={ic} value={form.pickupDateTime} onChange={e => update('pickupDateTime', e.target.value)} required /></div>
        <div className="grid grid-cols-2 gap-3"><div><label className="block text-sm font-medium mb-1.5">{t.CreateLabelPayingParty}</label><input className={ic} placeholder={t.CreatePlaceholderOptional} value={form.payingParty} onChange={e => update('payingParty', e.target.value)} /></div><div><label className="block text-sm font-medium mb-1.5">{t.CreateLabelPaymentMethod}</label><input className={ic} placeholder={t.CreatePlaceholderOptional} value={form.paymentMethode} onChange={e => update('paymentMethode', e.target.value)} /></div></div>
        <div className="flex justify-end gap-2 pt-2"><button type="button" className="inline-flex items-center rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted" onClick={onClose}>{tc.Cancel}</button><button type="submit" className="inline-flex items-center rounded-md bg-primary text-primary-foreground px-4 py-1.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50" disabled={loading || !form.customerId || !form.pickupLocation || !form.dropoffLocation || !form.pickupDateTime}>{loading ? t.CreateSubmitting : t.CreateSubmit}</button></div>
      </form>
    </ModalShell>
  )
}

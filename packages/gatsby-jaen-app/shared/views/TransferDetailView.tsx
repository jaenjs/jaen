import React, { useMemo, useState, useCallback, useEffect } from 'react'
import { useAppNavigate, useAppParams } from '../navigation'
import {
  useTransfers, useUsers, useCars,
  assignDriverMutation, assignCarMutation, updateTransferStateMutation, setPriceMutation,
} from '../hooks'
import { useI18nCode } from '../i18n'
import { getI18nTransfers } from '../locales/i18nTransfers'
import { getI18nCommon } from '../locales/i18nCommon'
import {
  cx, formatDateDisplay, formatPrice,
  StatusPill, IconArrowLeft, IconCalendar, IconClock, IconUsers, IconBriefcase,
  IconPlane, IconMapPin, IconCar, IconTriangleAlert, LoadingOverlay, ErrorBanner,
  IconSearch,
} from '../components/ui'

// -------- Generic Modal Shell --------
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border rounded-lg shadow-lg w-full max-w-md mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="text-muted-foreground hover:text-foreground text-xl leading-none" onClick={onClose}>&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

// -------- Toast (lightweight in-page notification) --------
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])

  const bg = type === 'success' ? 'bg-green-600' : 'bg-red-600'
  return (
    <div className={`fixed bottom-4 right-4 z-[60] ${bg} text-white px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm`}>
      <div className="flex items-center justify-between gap-3">
        <span>{message}</span>
        <button className="text-white/80 hover:text-white" onClick={onClose}>&times;</button>
      </div>
    </div>
  )
}

export function TransferDetailView() {
  const { transferId } = useAppParams() as { transferId: string }
  const navigate = useAppNavigate()
  const { transfers, isLoading, error, refetch } = useTransfers(100)
  const i18nCode = useI18nCode()
  const { strings: tt } = getI18nTransfers(i18nCode)
  const { strings: tc } = getI18nCommon(i18nCode)

  // Assign driver modal
  const [driverModalOpen, setDriverModalOpen] = useState(false)
  // Assign car modal
  const [carModalOpen, setCarModalOpen] = useState(false)
  // Set price modal
  const [priceModalOpen, setPriceModalOpen] = useState(false)
  // Update state modal
  const [stateModalOpen, setStateModalOpen] = useState(false)
  // Mutation loading
  const [mutating, setMutating] = useState(false)
  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const transfer = useMemo(() => transfers.find(t => t.id === transferId), [transfers, transferId])

  const handleAssignDriver = useCallback(async (driverId: string) => {
    if (!transferId) return
    setMutating(true)
    try {
      await assignDriverMutation(transferId, driverId)
      setToast({ message: tt.ToastDriverAssigned, type: 'success' })
      setDriverModalOpen(false)
      refetch()
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : tt.ToastDriverFailed, type: 'error' })
    } finally {
      setMutating(false)
    }
  }, [transferId, refetch])

  const handleAssignCar = useCallback(async (carId: string) => {
    if (!transferId) return
    setMutating(true)
    try {
      await assignCarMutation(transferId, carId)
      setToast({ message: tt.ToastVehicleAssigned, type: 'success' })
      setCarModalOpen(false)
      refetch()
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : tt.ToastVehicleFailed, type: 'error' })
    } finally {
      setMutating(false)
    }
  }, [transferId, refetch])

  const handleSetPrice = useCallback(async (price: number) => {
    if (!transferId) return
    setMutating(true)
    try {
      await setPriceMutation(transferId, price)
      setToast({ message: tt.ToastPriceSet, type: 'success' })
      setPriceModalOpen(false)
      refetch()
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : tt.ToastPriceSetFailed, type: 'error' })
    } finally {
      setMutating(false)
    }
  }, [transferId, refetch])

  const handleUpdateState = useCallback(async (state: string) => {
    if (!transferId) return
    setMutating(true)
    try {
      await updateTransferStateMutation(transferId, state)
      setToast({ message: tt.ToastStateUpdated, type: 'success' })
      setStateModalOpen(false)
      refetch()
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : tt.ToastStateFailed, type: 'error' })
    } finally {
      setMutating(false)
    }
  }, [transferId, refetch])

  if (isLoading) {
    return <div className="p-6 relative min-h-[200px]"><LoadingOverlay /></div>
  }

  if (error) {
    return <div className="p-6"><ErrorBanner message={error} /></div>
  }

  if (!transfer) {
    return (
      <div className="p-6">
        <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4" onClick={() => navigate('/transfers')}>
          <IconArrowLeft className="h-4 w-4" /> {tt.DetailBackLink}
        </button>
        <ErrorBanner message={tt.DetailNotFound} />
      </div>
    )
  }

  const t = transfer

  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-6">
      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Modals */}
      <AssignDriverModal open={driverModalOpen} onClose={() => setDriverModalOpen(false)} onAssign={handleAssignDriver} loading={mutating} />
      <AssignCarModal open={carModalOpen} onClose={() => setCarModalOpen(false)} onAssign={handleAssignCar} loading={mutating} />
      <SetPriceModal open={priceModalOpen} onClose={() => setPriceModalOpen(false)} onSetPrice={handleSetPrice} loading={mutating} currentPrice={t.price} />
      <UpdateStateModal open={stateModalOpen} onClose={() => setStateModalOpen(false)} onUpdate={handleUpdateState} loading={mutating} currentState={t.state} />

      {/* Back button */}
      <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" onClick={() => navigate('/transfers')}>
        <IconArrowLeft className="h-4 w-4" /> {tt.DetailBackLink}
      </button>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 flex-shrink-0">
            <IconMapPin className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">{tt.DetailHeading.replace('{id}', t.referenceId || t.id.slice(0, 8))}</h1>
            <div className="mt-1"><StatusPill status={t.state} /></div>
          </div>
        </div>
        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <ActionButton label={tt.DetailAssignDriver} onClick={() => setDriverModalOpen(true)} variant="primary" />
          <ActionButton label={tt.DetailAssignVehicle} onClick={() => setCarModalOpen(true)} />
          <ActionButton label={tt.DetailSetPrice} onClick={() => setPriceModalOpen(true)} />
          <ActionButton label={tt.DetailUpdateStatus} onClick={() => setStateModalOpen(true)} />
        </div>
      </div>

      {/* Route */}
      <Section title={tt.DetailSectionRoute}>
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center mt-1">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <div className="w-0.5 h-8 bg-border" />
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
          </div>
          <div className="space-y-3">
            <div><div className="text-xs text-muted-foreground">{tt.DetailLabelPickup}</div><div className="text-sm font-medium">{t.pickup}</div></div>
            <div><div className="text-xs text-muted-foreground">{tt.DetailLabelDropoff}</div><div className="text-sm font-medium">{t.dropoff}</div></div>
          </div>
        </div>
      </Section>

      {/* Schedule */}
      <Section title={tt.DetailSectionSchedule}>
        <div className="grid grid-cols-2 gap-4">
          <InfoItem icon={<IconCalendar className="h-3.5 w-3.5 text-muted-foreground" />} label={tt.DetailLabelDate} value={formatDateDisplay(t.rideDateISO)} />
          <InfoItem icon={<IconClock className="h-3.5 w-3.5 text-muted-foreground" />} label={tt.DetailLabelTime} value={t.rideTime} />
        </div>
      </Section>

      {/* Capacity */}
      <Section title={tt.DetailSectionCapacity}>
        <div className="grid grid-cols-3 gap-4">
          <InfoItem icon={<IconUsers className="h-3.5 w-3.5 text-muted-foreground" />} label={tt.DetailLabelPassengers} value={String(t.passengerCount ?? '-')} />
          {t.details?.luggage && <InfoItem icon={<IconBriefcase className="h-3.5 w-3.5 text-muted-foreground" />} label={tt.DetailLabelLuggage} value={t.details.luggage} />}
          {t.details?.flightNumber && <InfoItem icon={<IconPlane className="h-3.5 w-3.5 text-muted-foreground" />} label={tt.DetailLabelFlight} value={t.details.flightNumber} />}
        </div>
      </Section>

      {/* Customer */}
      <Section title={tt.DetailSectionCustomer}>
        {t.customerName ? (
          <div className="space-y-1">
            <div className="text-sm font-medium">{t.customerName}</div>
            {t.customerPhone && <div className="text-sm text-muted-foreground">{t.customerPhone}</div>}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">{tt.DetailCustomerId.replace('{id}', t.customerId || '-')}</div>
        )}
      </Section>

      {/* Driver */}
      <Section title={tt.DetailSectionDriver}>
        {t.driverName ? (
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-sm font-medium">{t.driverName}</div>
              {t.driverPhone && <div className="text-sm text-muted-foreground">{t.driverPhone}</div>}
            </div>
            <button
              className="text-xs text-primary hover:underline"
              onClick={() => setDriverModalOpen(true)}
            >
              {tt.DetailReassign}
            </button>
          </div>
        ) : t.driverId ? (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Driver ID: {t.driverId}</div>
            <button
              className="text-xs text-primary hover:underline"
              onClick={() => setDriverModalOpen(true)}
            >
              {tt.DetailReassign}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-warning/10 text-warning border-warning/20 gap-1">
              <IconTriangleAlert className="h-3 w-3" /> {tt.NotAssigned}
            </div>
            <button
              className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90 transition-colors"
              onClick={() => setDriverModalOpen(true)}
            >
              {tt.DetailAssignDriver}
            </button>
          </div>
        )}
      </Section>

      {/* Vehicle */}
      <Section title={tt.DetailSectionVehicle}>
        {t.carLicensePlate || t.vehicle ? (
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-sm font-medium">{t.vehicle || '-'}</div>
              {t.carLicensePlate && <div className="text-sm text-muted-foreground">{t.carLicensePlate}</div>}
            </div>
            <button className="text-xs text-primary hover:underline" onClick={() => setCarModalOpen(true)}>{tt.DetailReassign}</button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">{tt.DetailNoVehicleAssigned}</div>
            <button
              className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
              onClick={() => setCarModalOpen(true)}
            >
              {tt.DetailAssignVehicle}
            </button>
          </div>
        )}
      </Section>

      {/* Category & Type */}
      {(t.transferCategory || t.transferType) && (
        <Section title={tt.DetailSectionDetails}>
          <div className="grid grid-cols-2 gap-4">
            {t.transferCategory && <div><div className="text-xs text-muted-foreground">{tt.DetailLabelCategory}</div><div className="text-sm font-medium">{t.transferCategory}</div></div>}
            {t.transferType && <div><div className="text-xs text-muted-foreground">{tt.DetailLabelType}</div><div className="text-sm font-medium">{t.transferType}</div></div>}
          </div>
        </Section>
      )}

      {/* Extras */}
      {t.extras && t.extras.length > 0 && (
        <Section title={tt.DetailSectionExtras}>
          <div className="space-y-1.5">
            {t.extras.map((extra, idx) => (
              <div key={idx} className="flex justify-between gap-6 text-sm">
                <span className="text-muted-foreground">{extra.type.replace(/_/g, ' ')}</span>
                <span className="font-medium">x {extra.amount}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Message */}
      {t.roomOrName && (
        <Section title={tt.DetailSectionNotes}>
          <div className="text-sm text-muted-foreground">{t.roomOrName}</div>
        </Section>
      )}

      {/* Footer: fare */}
      <div className="border-t border-border pt-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold">{tt.DetailTotalFare}</span>
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold">{formatPrice(t.price)}</span>
            <button className="text-xs text-primary hover:underline" onClick={() => setPriceModalOpen(true)}>{tc.Edit}</button>
          </div>
        </div>
        {t.paymentMethode && (
          <div className="text-sm text-muted-foreground mt-1">{tt.DetailPayment.replace('{method}', t.paymentMethode)}</div>
        )}
      </div>
    </div>
  )
}

// -------- Sub-components --------

function ActionButton({ label, onClick, variant }: { label: string; onClick: () => void; variant?: 'primary' | 'default' }) {
  const base = "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
  const cls = variant === 'primary'
    ? `${base} bg-primary text-primary-foreground hover:bg-primary/90`
    : `${base} border border-input hover:bg-muted`
  return <button className={cls} onClick={onClick}>{label}</button>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <div className="h-px bg-border" />
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider">{title}</h3>
        {children}
      </div>
    </>
  )
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium flex items-center gap-1.5">
        {icon}
        {value}
      </div>
    </div>
  )
}

// -------- Assign Driver Modal --------
function AssignDriverModal({ open, onClose, onAssign, loading }: { open: boolean; onClose: () => void; onAssign: (driverId: string) => void; loading: boolean }) {
  const { users, isLoading: usersLoading } = useUsers()
  const i18nCodeM = useI18nCode()
  const { strings: tt } = getI18nTransfers(i18nCodeM)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return users
    const q = search.toLowerCase()
    return users.filter(u =>
      u.username.toLowerCase().includes(q) ||
      u.primaryEmailAddress.toLowerCase().includes(q) ||
      (u.details?.firstName?.toLowerCase().includes(q)) ||
      (u.details?.lastName?.toLowerCase().includes(q))
    )
  }, [users, search])

  return (
    <Modal open={open} onClose={onClose} title={tt.ModalAssignDriver}>
      <div className="p-4 space-y-3">
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="flex w-full rounded-md border border-input px-3 py-2 text-sm pl-9 h-9 bg-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder={tt.ModalSearchUsers}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {usersLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">{tt.ModalLoadingUsers}</div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">{tt.ModalNoUsersFound}</div>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filtered.map(u => (
              <button
                key={u.id}
                className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-muted transition-colors text-left disabled:opacity-50"
                onClick={() => onAssign(u.id)}
                disabled={loading}
              >
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary text-xs font-bold flex-shrink-0">
                  {(u.details?.firstName?.[0] || u.username[0] || '?').toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {u.details?.firstName && u.details?.lastName
                      ? `${u.details.firstName} ${u.details.lastName}`
                      : u.username}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{u.primaryEmailAddress}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

// -------- Assign Car Modal --------
function AssignCarModal({ open, onClose, onAssign, loading }: { open: boolean; onClose: () => void; onAssign: (carId: string) => void; loading: boolean }) {
  const { cars, isLoading: carsLoading } = useCars()
  const i18nCodeC = useI18nCode()
  const { strings: tt } = getI18nTransfers(i18nCodeC)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return cars
    const q = search.toLowerCase()
    return cars.filter(c =>
      c.licensePlate.toLowerCase().includes(q) ||
      (c.carName?.toLowerCase().includes(q)) ||
      (c.driverName?.toLowerCase().includes(q))
    )
  }, [cars, search])

  return (
    <Modal open={open} onClose={onClose} title={tt.ModalAssignVehicle}>
      <div className="p-4 space-y-3">
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="flex w-full rounded-md border border-input px-3 py-2 text-sm pl-9 h-9 bg-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder={tt.ModalSearchVehicles}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {carsLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">{tt.ModalLoadingVehicles}</div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">{tt.ModalNoVehiclesFound}</div>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filtered.map(c => (
              <button
                key={c.id}
                className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-muted transition-colors text-left disabled:opacity-50"
                onClick={() => onAssign(c.id)}
                disabled={loading}
              >
                <div
                  className="flex items-center justify-center h-8 w-8 rounded-md text-white text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: c.color || '#666' }}
                >
                  <IconCar className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{c.carName || c.licensePlate}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.licensePlate} {c.carClass ? `· ${c.carClass}` : ''}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

// -------- Set Price Modal --------
function SetPriceModal({ open, onClose, onSetPrice, loading, currentPrice }: { open: boolean; onClose: () => void; onSetPrice: (price: number) => void; loading: boolean; currentPrice?: number }) {
  const i18nCodeP = useI18nCode()
  const { strings: tt } = getI18nTransfers(i18nCodeP)
  const { strings: tc } = getI18nCommon(i18nCodeP)
  const [value, setValue] = useState(String(currentPrice ?? ''))

  useEffect(() => {
    if (open) setValue(String(currentPrice ?? ''))
  }, [open, currentPrice])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const num = parseFloat(value)
    if (!isNaN(num) && num >= 0) onSetPrice(num)
  }

  return (
    <Modal open={open} onClose={onClose} title={tt.ModalSetPrice}>
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">{tt.ModalPriceLabel}</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="flex w-full rounded-md border border-input px-3 py-2 text-sm h-9 bg-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="0.00"
            value={value}
            onChange={e => setValue(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="inline-flex items-center rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted" onClick={onClose}>{tc.Cancel}</button>
          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm hover:bg-primary/90 disabled:opacity-50"
            disabled={loading || isNaN(parseFloat(value))}
          >
            {loading ? tt.ModalSaving : tc.Save}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// -------- Update State Modal --------
const TRANSFER_STATES = [
  { value: 'planned', label: 'Planned' },
  { value: 'active', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

function UpdateStateModal({ open, onClose, onUpdate, loading, currentState }: { open: boolean; onClose: () => void; onUpdate: (state: string) => void; loading: boolean; currentState: string }) {
  const i18nCodeU = useI18nCode()
  const { strings: tt } = getI18nTransfers(i18nCodeU)
  const stateLabels: Record<string, string> = { Planned: tt.ModalStatePlanned, "In Progress": tt.ModalStateInProgress, Completed: tt.ModalStateCompleted, Cancelled: tt.ModalStateCancelled }
  return (
    <Modal open={open} onClose={onClose} title={tt.ModalUpdateStatus}>
      <div className="p-4 space-y-2">
        {TRANSFER_STATES.map(s => {
          const isCurrent = currentState.toLowerCase() === s.value || currentState.toLowerCase() === s.label.toLowerCase()
          return (
            <button
              key={s.value}
              className={cx(
                'w-full flex items-center justify-between p-3 rounded-md transition-colors text-left text-sm disabled:opacity-50',
                isCurrent ? 'bg-primary/10 border border-primary/30 font-medium' : 'hover:bg-muted'
              )}
              onClick={() => onUpdate(s.value)}
              disabled={loading || isCurrent}
            >
              <span>{stateLabels[s.label] || s.label}</span>
              {isCurrent && <span className="text-xs text-primary">{tt.ModalStateCurrent}</span>}
            </button>
          )
        })}
      </div>
    </Modal>
  )
}

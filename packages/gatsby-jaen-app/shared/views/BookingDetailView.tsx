import { useMemo } from 'react'
import { useAppNavigate, useAppParams } from '../navigation'
import { useTransfers } from '../hooks'
import { useI18nCode } from '../i18n'
import { getI18nBookings } from '../locales/i18nBookings'
import {
  formatDateDisplay, formatPrice,
  StatusPill, IconArrowLeft, IconCalendar, IconClock, IconMapPin,
  LoadingOverlay, ErrorBanner,
} from '../components/ui'

export function BookingDetailView() {
  const { bookingId } = useAppParams() as { bookingId: string }
  const navigate = useAppNavigate()
  const { transfers, isLoading, error } = useTransfers(100)
  const i18nCode = useI18nCode()
  const { strings: bt } = getI18nBookings(i18nCode)

  const booking = useMemo(() => transfers.find(t => t.id === bookingId), [transfers, bookingId])

  if (isLoading) return <div className="p-6 relative min-h-[200px]"><LoadingOverlay /></div>
  if (error) return <div className="p-6"><ErrorBanner message={error} /></div>
  if (!booking) {
    return (
      <div className="p-6">
        <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4" onClick={() => navigate('/booking')}>
          <IconArrowLeft className="h-4 w-4" /> {bt.DetailBackLink}
        </button>
        <ErrorBanner message={bt.DetailNotFound} />
      </div>
    )
  }

  const t = booking

  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-6">
      <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" onClick={() => navigate('/booking')}>
        <IconArrowLeft className="h-4 w-4" /> {bt.DetailBackLink}
      </button>

      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 flex-shrink-0">
          <IconMapPin className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">{bt.DetailHeading.replace('{id}', t.referenceId || t.id.slice(0, 8))}</h1>
          <div className="mt-1"><StatusPill status={t.state} /></div>
        </div>
      </div>

      <div className="h-px bg-border" />
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider">{bt.DetailSectionRoute}</h3>
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center mt-1">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <div className="w-0.5 h-8 bg-border" />
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
          </div>
          <div className="space-y-3">
            <div><div className="text-xs text-muted-foreground">{bt.DetailLabelPickup}</div><div className="text-sm font-medium">{t.pickup}</div></div>
            <div><div className="text-xs text-muted-foreground">{bt.DetailLabelDropoff}</div><div className="text-sm font-medium">{t.dropoff}</div></div>
          </div>
        </div>
      </div>

      <div className="h-px bg-border" />
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider">{bt.DetailSectionSchedule}</h3>
        <div className="grid grid-cols-2 gap-4">
          <div><div className="text-xs text-muted-foreground">{bt.DetailLabelDate}</div><div className="text-sm font-medium flex items-center gap-1.5"><IconCalendar className="h-3.5 w-3.5 text-muted-foreground" />{formatDateDisplay(t.rideDateISO)}</div></div>
          <div><div className="text-xs text-muted-foreground">{bt.DetailLabelTime}</div><div className="text-sm font-medium flex items-center gap-1.5"><IconClock className="h-3.5 w-3.5 text-muted-foreground" />{t.rideTime}</div></div>
        </div>
      </div>

      {t.vehicle && (
        <>
          <div className="h-px bg-border" />
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider">{bt.DetailSectionVehicle}</h3>
            <div className="text-sm font-medium">{t.vehicle}</div>
            {t.carLicensePlate && <div className="text-sm text-muted-foreground">{t.carLicensePlate}</div>}
          </div>
        </>
      )}

      {t.extras && t.extras.length > 0 && (
        <>
          <div className="h-px bg-border" />
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider">{bt.DetailSectionExtras}</h3>
            <div className="space-y-1.5">
              {t.extras.map((extra, idx) => (
                <div key={idx} className="flex justify-between gap-6 text-sm">
                  <span className="text-muted-foreground">{extra.type.replace(/_/g, ' ')}</span>
                  <span className="font-medium">x {extra.amount}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {t.roomOrName && (
        <>
          <div className="h-px bg-border" />
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider">{bt.DetailSectionNotes}</h3>
            <div className="text-sm text-muted-foreground">{t.roomOrName}</div>
          </div>
        </>
      )}

      <div className="border-t border-border pt-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold">{bt.DetailTotalPrice}</span>
          <span className="text-lg font-bold">{formatPrice(t.price)}</span>
        </div>
        {t.paymentMethode && <div className="text-sm text-muted-foreground mt-1">{bt.DetailPayment.replace('{method}', t.paymentMethode)}</div>}
      </div>
    </div>
  )
}

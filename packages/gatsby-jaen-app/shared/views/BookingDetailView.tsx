/**
 * One booking in full, and the customer's one action on it: Cancel, while
 * the ride is still PENDING or ASSIGNED.
 *
 * The button is offered from the state alone. The backend decides for real:
 * a customer may move their own booking to CANCELED from those two states
 * and from nowhere else, a dispatcher may move anything, and both go through
 * updateTransferState. A refusal comes back as FORBIDDEN and is shown as it
 * is.
 *
 * Under the booking sits the driver card: who is coming, in which car, and
 * while the ride is live a small map with the pickup and the driver's dot,
 * see components/locations/DriverTrackingCard. Before a driver is assigned
 * it is one calm line, after the ride it is the driver and the car without
 * a map.
 */
import React, {useMemo, useState} from 'react'
import {
  Box,
  Button,
  DataList,
  Flex,
  Heading,
  Separator,
  Stack,
  Text,
} from '@chakra-ui/react'
import {FaArrowLeft} from '@react-icons/all-files/fa/FaArrowLeft'
import {FaTimesCircle} from '@react-icons/all-files/fa/FaTimesCircle'
import {useAppNavigate, useAppParams} from '../navigation'
import {useI18nCode} from '../i18n'
import {getI18nBookings} from '../locales/i18nBookings'
import {cancelBooking, isCancelable, useBooking, type Booking} from '../hooks/bookings'
import {
  ConfirmDialog,
  ErrorBanner,
  LoadingOverlay,
  MoneyText,
  StatusBadge,
  toaster,
  PageHeader
} from '../components'
import {DriverTrackingCard} from '../components/locations'

type Strings = ReturnType<typeof getI18nBookings>['strings']

const fill = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce(
    (s, [k, v]) => s.replace(`{${k}}`, String(v)),
    template
  )

const paymentLabel = (t: Strings, method: string | null | undefined): string => {
  if (!method) return ''
  const key = `Payment${method.toUpperCase()}` as keyof Strings
  return (t[key] as string | undefined) ?? method
}

/** A label and a value, only rendered when there is a value. */
function Item({label, value}: {label: string; value: React.ReactNode}) {
  if (value === undefined || value === null || value === '') return null
  return (
    <DataList.Item>
      <DataList.ItemLabel>{label}</DataList.ItemLabel>
      <DataList.ItemValue>{value}</DataList.ItemValue>
    </DataList.Item>
  )
}

function Section({title, children}: {title: string; children: React.ReactNode}) {
  return (
    <Box>
      <Heading as="h3" size="sm" textTransform="uppercase" letterSpacing="wider" color="fg.muted" mb="3">
        {title}
      </Heading>
      {children}
    </Box>
  )
}

export function BookingDetailView() {
  const {bookingId} = useAppParams() as {bookingId: string}
  const navigate = useAppNavigate()
  const code = useI18nCode()
  const {strings: t} = getI18nBookings(code)

  const {booking, isLoading, error, refetch, setBooking} = useBooking(bookingId)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const dates = useMemo(() => {
    const long = new Intl.DateTimeFormat(code, {weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'})
    const stamp = new Intl.DateTimeFormat(code, {day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'})
    return {
      day: (iso: string) => {
        if (!iso) return ''
        const d = new Date(`${iso}T00:00:00`)
        return Number.isNaN(d.getTime()) ? iso : long.format(d)
      },
      stamp: (iso: string | undefined) => {
        if (!iso) return ''
        const d = new Date(iso)
        return Number.isNaN(d.getTime()) ? iso : stamp.format(d)
      }
    }
  }, [code])

  const back = () => navigate('/booking')

  const confirmCancel = async () => {
    if (!booking) return
    setCancelling(true)
    try {
      const updated: Booking = await cancelBooking(booking.id)
      // The mutation answers with the row as it is now, no second read needed.
      setBooking({...booking, ...updated, driverName: updated.driverName ?? booking.driverName})
      toaster.success({title: t.CancelSuccess})
      setConfirmOpen(false)
    } catch (err) {
      toaster.error({title: t.CancelError, description: err instanceof Error ? err.message : String(err)})
    } finally {
      setCancelling(false)
    }
  }

  if (isLoading) return <LoadingOverlay />

  if (error) {
    return (
      <Box p={{base: '4', md: '6'}} maxW="full">
        <Button variant="ghost" size="sm" onClick={back} mb="4">
          <FaArrowLeft /> {t.DetailBackLink}
        </Button>
        <ErrorBanner message={error} onRetry={refetch} />
      </Box>
    )
  }

  if (!booking) {
    return (
      <Box p={{base: '4', md: '6'}} maxW="full">
        <Button variant="ghost" size="sm" onClick={back} mb="4">
          <FaArrowLeft /> {t.DetailBackLink}
        </Button>
        <ErrorBanner title={t.DetailNotFound} />
      </Box>
    )
  }

  const b = booking
  const cancelable = isCancelable(b.state)

  return (
    <Box p={{base: '4', md: '6'}} maxW="full">
      <Stack gap="6">
        <Button variant="ghost" size="sm" alignSelf="start" onClick={back}>
          <FaArrowLeft /> {t.DetailBackLink}
        </Button>

        <PageHeader
          title={fill(t.DetailHeading, {code: b.code})}
          mono
          meta={<StatusBadge state={b.state} size="lg" />}
          actions={
            cancelable ? (
              <Button colorPalette="red" variant="outline" onClick={() => setConfirmOpen(true)}>
                <FaTimesCircle /> {t.CancelButton}
              </Button>
            ) : undefined
          }
        />

        <Box bg="bg.surface" borderWidth="1px" borderColor="border.default" rounded="surface" p={{base: '4', md: '6'}}>
          <Stack gap="6">
            <Section title={t.DetailSectionRoute}>
              <Flex gap="3" align="stretch">
                <Flex direction="column" align="center" pt="1.5">
                  <Box boxSize="2.5" rounded="full" bg="green.solid" />
                  <Box w="0.5" flex="1" minH="6" bg="border.default" my="1" />
                  <Box boxSize="2.5" rounded="full" bg="red.solid" />
                </Flex>
                <Stack gap="3" flex="1" minW="0">
                  <Box>
                    <Text textStyle="xs" color="fg.muted">
                      {t.DetailLabelPickup}
                    </Text>
                    <Text fontWeight="medium">{b.pickup}</Text>
                  </Box>
                  <Box>
                    <Text textStyle="xs" color="fg.muted">
                      {t.DetailLabelDropoff}
                    </Text>
                    <Text fontWeight="medium">{b.dropoff}</Text>
                  </Box>
                </Stack>
              </Flex>
            </Section>

            <Separator />

            <Section title={t.DetailSectionSchedule}>
              <DataList.Root orientation="horizontal" size="md">
                <Item label={t.DetailLabelDate} value={dates.day(b.rideDateISO)} />
                <Item label={t.DetailLabelTime} value={b.rideTime} />
                <Item label={t.DetailLabelBookedAt} value={dates.stamp(b.requestedAtISO)} />
              </DataList.Root>
            </Section>

            <Separator />

            <Section title={t.DetailSectionRide}>
              <DataList.Root orientation="horizontal" size="md">
                <Item label={t.DetailLabelRoomOrName} value={b.subject} />
                <Item label={t.DetailLabelPassengers} value={b.passengerCount} />
                <Item label={t.DetailLabelLuggage} value={b.details?.luggage} />
                <Item label={t.DetailLabelChildSeats} value={b.details?.childSeats} />
                <Item label={t.DetailLabelFlight} value={b.details?.flightNumber} />
              </DataList.Root>
            </Section>

            {b.details?.message && (
              <>
                <Separator />
                <Section title={t.DetailSectionNotes}>
                  <Text whiteSpace="pre-wrap">{b.details.message}</Text>
                </Section>
              </>
            )}

            {b.extras.length > 0 && (
              <>
                <Separator />
                <Section title={t.DetailSectionExtras}>
                  <Stack gap="1.5">
                    {b.extras.map((extra, i) => (
                      <Flex key={`${extra.type}-${i}`} justify="space-between" gap="6">
                        <Text color="fg.muted">{extra.type.replace(/_/g, ' ')}</Text>
                        <Text fontWeight="medium">× {extra.amount}</Text>
                      </Flex>
                    ))}
                  </Stack>
                </Section>
              </>
            )}

            <Separator />

            <Flex justify="space-between" align="center" gap="4">
              <Text fontWeight="semibold">{t.DetailTotalPrice}</Text>
              {typeof b.price === 'number' ? (
                <MoneyText value={b.price} fontSize="lg" fontWeight="bold" />
              ) : (
                <Text color="fg.muted">{t.PriceOpen}</Text>
              )}
            </Flex>
            {b.paymentMethode && (
              <Text textStyle="sm" color="fg.muted" mt="-4">
                {fill(t.DetailPayment, {method: paymentLabel(t, b.paymentMethode)})}
              </Text>
            )}
          </Stack>
        </Box>

        {/* The driver and the car, and the map while the ride is live. */}
        <DriverTrackingCard
          transferId={b.id}
          state={b.state}
          pickupAddress={b.pickup}
          audience="customer"
          fallback={{
            driverId: b.driverId,
            driverName: b.driverName ?? (b.driverId ? t.DriverAssigned : undefined),
            car: b.car
              ? {carName: b.car.name ?? null, licensePlate: b.car.licensePlate ?? null, carClass: b.car.carClass ?? null}
              : null
          }}
        />

        {cancelable && (
          <Text textStyle="sm" color="fg.muted">
            {t.CancelHint}
          </Text>
        )}
      </Stack>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmCancel}
        title={t.CancelConfirmTitle}
        body={fill(t.CancelConfirmBody, {date: dates.day(b.rideDateISO), time: b.rideTime})}
        confirmLabel={t.CancelConfirm}
        cancelLabel={t.CancelKeep}
        destructive
        loading={cancelling}
      />
    </Box>
  )
}

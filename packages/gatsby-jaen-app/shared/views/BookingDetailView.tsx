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
  Link,
  Separator,
  Stack,
  Text
} from '@chakra-ui/react'
import {FaArrowLeft} from '@react-icons/all-files/fa/FaArrowLeft'
import {FaTimesCircle} from '@react-icons/all-files/fa/FaTimesCircle'
import {FaFilePdf} from '@react-icons/all-files/fa/FaFilePdf'
import {useAppNavigate, useAppParams} from '../navigation'
import {useI18nCode} from '../i18n'
import {getI18nBookings} from '../locales/i18nBookings'
import {getI18nPeople} from '../locales/i18nPeople'
import {BookedByLine, bookedBy} from '../components/BookedBy'
import {mailHref, telHref} from '../hooks/transfers'
import {formatPhone} from '../phone'
import {
  cancelBooking,
  isCancelable,
  useBooking,
  type Booking
} from '../hooks/bookings'
import {asCustomerStatus} from '../hooks/offers'
import {
  openDocument,
  useTransferDocuments,
  type TransferDocument
} from '../hooks/documents'
import {getI18nOffers} from '../locales/i18nOffers'
import {CustomerStatusBadge} from '../components/CustomerStatusBadge'
import {
  CarGallery,
  ConfirmDialog,
  DetailRow,
  DriverColorDot,
  ErrorBanner,
  MoneyText,
  Selectable,
  StatusBadge,
  toaster,
  PageHeader
} from '../components'
import {useViewRefresh} from '../hooks/view-refresh'
import {DetailSkeleton} from '../components/skeletons'
import {DriverTrackingCard} from '../components/locations'
import {failureText} from '../errors'

type Strings = ReturnType<typeof getI18nBookings>['strings']

const fill = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce(
    (s, [k, v]) => s.replace(`{${k}}`, String(v)),
    template
  )

const paymentLabel = (
  t: Strings,
  method: string | null | undefined
): string => {
  if (!method) return ''
  const key = `Payment${method.toUpperCase()}` as keyof Strings
  return (t[key] as string | undefined) ?? method
}

/**
 * A label and a value, only rendered when there is a value. The row itself is
 * the shared DetailRow: its column wrapping and its selectable value are rule
 * 9 and rule 11 in one place.
 */
function Item({label, value}: {label: string; value: React.ReactNode}) {
  return <DetailRow label={label} value={value} hideEmpty />
}

function Section({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <Box>
      <Heading
        as="h3"
        size="sm"
        textTransform="uppercase"
        letterSpacing="wider"
        color="fg.muted"
        mb="3">
        {title}
      </Heading>
      {children}
    </Box>
  )
}

/**
 * "Ihr Fahrzeug", the card the customer reads once the driver said yes: the
 * pictures, the name, the colour dot and the plate
 * (okf/architecture/media.md, "Where the car's pictures appear"). This is
 * one of the two places the customer looks at the car itself, so it draws
 * the whole gallery as the swipeable strip with the cover first rather than
 * the single picture a list shows. Before the yes there is no card at all,
 * because until then the car on the ride is the dispatcher's intention, and
 * the pylon answers a customer no picture for it either.
 */
function VehicleCard({
  car,
  title
}: {
  car: NonNullable<Booking['car']>
  title: string
}) {
  return (
    <Box
      borderWidth="1px"
      borderColor="border.default"
      rounded="surface"
      bg="bg.surface"
      p="4"
      data-testid="booking-vehicle">
      <Heading as="h3" size="sm" mb="3">
        {title}
      </Heading>
      <Stack gap="4">
        <CarGallery car={car} alt={car.licensePlate ?? ''} />
        <Box minW="0">
          {car.name && (
            <Selectable fontWeight="semibold" lineClamp={1}>
              {car.name}
            </Selectable>
          )}
          <Flex gap="2" align="center" minW="0" mt="1">
            {car.color && <DriverColorDot color={car.color} />}
            {car.licensePlate && (
              <Selectable
                fontFamily="mono"
                fontWeight="semibold"
                letterSpacing="wider">
                {car.licensePlate}
              </Selectable>
            )}
          </Flex>
        </Box>
      </Stack>
    </Box>
  )
}

/**
 * The offer or the invoice of the booking, a button that fetches the signed
 * link through documentUrl and opens it. The customer reads their own
 * ride's documents, the pylon refuses anybody else's.
 */
function DocumentLink({
  doc,
  code
}: {
  doc: TransferDocument
  code: ReturnType<typeof useI18nCode>
}) {
  const {strings: so} = getI18nOffers(code)
  const [opening, setOpening] = useState(false)
  const open = async () => {
    setOpening(true)
    try {
      await openDocument(doc.id)
    } catch (err) {
      toaster.error({
        title: so.OpenFailed,
        description: failureText(err)
      })
    } finally {
      setOpening(false)
    }
  }
  return (
    <Flex
      justify="space-between"
      align="center"
      gap="3"
      flexWrap="wrap"
      data-testid={`document-${doc.kind.toLowerCase()}`}>
      <Text fontWeight="medium">
        {so[`Doc_${doc.kind}`]}
        {doc.number ? ` ${doc.number}` : ''}
      </Text>
      <Button
        size="sm"
        variant="outline"
        minH={{base: '44px', md: '8'}}
        loading={opening}
        onClick={() => void open()}>
        <FaFilePdf /> {so.OpenPdf}
      </Button>
    </Flex>
  )
}

export function BookingDetailView() {
  const {bookingId} = useAppParams() as {bookingId: string}
  const navigate = useAppNavigate()
  const code = useI18nCode()
  const {strings: t} = getI18nBookings(code)
  const {strings: pw} = getI18nPeople(code)

  const {booking, isLoading, error, isFetching, refetch, setBooking} =
    useBooking(bookingId)
  const {documents} = useTransferDocuments(booking?.id)
  useViewRefresh(refetch, isFetching)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const dates = useMemo(() => {
    const long = new Intl.DateTimeFormat(code, {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
    const stamp = new Intl.DateTimeFormat(code, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
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
      setBooking({
        ...booking,
        ...updated,
        driverName: updated.driverName ?? booking.driverName
      })
      toaster.success({title: t.CancelSuccess})
      setConfirmOpen(false)
    } catch (err) {
      toaster.error({
        title: t.CancelError,
        description: failureText(err)
      })
    } finally {
      setCancelling(false)
    }
  }

  if (isLoading) return <DetailSkeleton cards={2} back />

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
  // Who rides: the passenger on the row or, when the row names none, the
  // "Zimmer / Name" the booking carried, which is how a hotel names its guest.
  const person = {
    name:
      [b.passenger?.firstName, b.passenger?.lastName]
        .filter(Boolean)
        .join(' ') || b.subject,
    email: b.passenger?.email,
    phone: b.passenger?.phone
  }
  const booked = bookedBy(person, b.customer)

  return (
    <Box p={{base: '4', md: '6'}} maxW="full">
      <Stack gap="6">
        <Button variant="ghost" size="sm" alignSelf="start" onClick={back}>
          <FaArrowLeft /> {t.DetailBackLink}
        </Button>

        <PageHeader
          title={fill(t.DetailHeading, {code: b.code})}
          mono
          meta={
            <>
              <StatusBadge state={b.state} size="lg" />
              <CustomerStatusBadge
                status={b.customerStatus}
                audience="customer"
                size="lg"
              />
            </>
          }
          actions={
            cancelable ? (
              <Button
                colorPalette="red"
                variant="outline"
                onClick={() => setConfirmOpen(true)}>
                <FaTimesCircle /> {t.CancelButton}
              </Button>
            ) : undefined
          }
        />

        <Box
          bg="bg.surface"
          borderWidth="1px"
          borderColor="border.default"
          rounded="surface"
          p={{base: '4', md: '6'}}>
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
                    <Selectable fontWeight="medium">{b.pickup}</Selectable>
                  </Box>
                  <Box>
                    <Text textStyle="xs" color="fg.muted">
                      {t.DetailLabelDropoff}
                    </Text>
                    <Selectable fontWeight="medium">{b.dropoff}</Selectable>
                  </Box>
                </Stack>
              </Flex>
            </Section>

            <Separator />

            <Section title={t.DetailSectionSchedule}>
              <DataList.Root orientation="horizontal" size="md">
                <Item
                  label={t.DetailLabelDate}
                  value={dates.day(b.rideDateISO)}
                />
                <Item label={t.DetailLabelTime} value={b.rideTime} />
                <Item
                  label={t.DetailLabelBookedAt}
                  value={dates.stamp(b.requestedAtISO)}
                />
              </DataList.Root>
            </Section>

            {/*
              The people card, dispatch.md section 13: who rides, with the
              mail and the call on the two values that carry one, and under it
              the account that booked as one quieter line. The customer reads
              their own booking here, so the booker is usually themselves or,
              for a hotel, the front desk that typed the guest into
              "Zimmer / Name".
            */}
            {(person.name ||
              person.email ||
              person.phone ||
              booked.kind !== 'none') && (
              <>
                <Separator />
                <Section title={t.DetailSectionPassenger}>
                  <DataList.Root orientation="horizontal" size="md">
                    <Item
                      label={t.DetailLabelPassengerName}
                      value={[b.passenger?.firstName, b.passenger?.lastName]
                        .filter(Boolean)
                        .join(' ')}
                    />
                    <Item
                      label={t.DetailLabelEmail}
                      value={
                        person.email && mailHref(person.email) ? (
                          <Link
                            href={mailHref(person.email)}
                            title={pw.ActionMail}
                            colorPalette="brand">
                            {person.email}
                          </Link>
                        ) : (
                          person.email
                        )
                      }
                    />
                    <Item
                      label={t.DetailLabelPhone}
                      value={
                        person.phone && telHref(person.phone) ? (
                          <Link
                            href={telHref(person.phone)}
                            title={pw.ActionCall}
                            colorPalette="brand">
                            {formatPhone(person.phone)}
                          </Link>
                        ) : (
                          person.phone && formatPhone(person.phone)
                        )
                      }
                    />
                  </DataList.Root>
                  <BookedByLine
                    result={booked}
                    label={pw.BookedBy}
                    sameLabel={pw.PassengerIsCustomer}
                    mailLabel={pw.ActionMail}
                    callLabel={pw.ActionCall}
                    checkCountryLabel={pw.CheckCountry}
                    mailHref={mailHref}
                    telHref={telHref}
                    formatPhone={formatPhone}
                  />
                </Section>
              </>
            )}

            <Separator />

            <Section title={t.DetailSectionRide}>
              <DataList.Root orientation="horizontal" size="md">
                <Item label={t.DetailLabelRoomOrName} value={b.subject} />
                <Item
                  label={t.DetailLabelPassengers}
                  value={b.passengerCount}
                />
                <Item label={t.DetailLabelLuggage} value={b.details?.luggage} />
                <Item
                  label={t.DetailLabelChildSeats}
                  value={b.details?.childSeats}
                />
                <Item
                  label={t.DetailLabelFlight}
                  value={b.details?.flightNumber}
                />
              </DataList.Root>
            </Section>

            {/* The money side in the customer's words, and the documents (offers-and-documents.md). */}
            {(asCustomerStatus(b.customerStatus) || documents.length > 0) && (
              <>
                <Separator />
                <Section title={t.DetailSectionStatus}>
                  <Stack gap="3">
                    {asCustomerStatus(b.customerStatus) && (
                      <Text data-testid="customer-status-words">
                        {
                          t[
                            `StatusExplain${asCustomerStatus(b.customerStatus)}` as keyof Strings
                          ] as string
                        }
                      </Text>
                    )}
                    {documents.map(doc => (
                      <DocumentLink key={doc.id} doc={doc} code={code} />
                    ))}
                  </Stack>
                </Section>
              </>
            )}

            {b.details?.message && (
              <>
                <Separator />
                <Section title={t.DetailSectionNotes}>
                  <Selectable whiteSpace="pre-wrap">
                    {b.details.message}
                  </Selectable>
                </Section>
              </>
            )}

            {b.extras.length > 0 && (
              <>
                <Separator />
                <Section title={t.DetailSectionExtras}>
                  <Stack gap="1.5">
                    {b.extras.map((extra, i) => (
                      <Flex
                        key={`${extra.type}-${i}`}
                        justify="space-between"
                        gap="6">
                        <Text color="fg.muted">
                          {extra.type.replace(/_/g, ' ')}
                        </Text>
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
                {fill(t.DetailPayment, {
                  method: paymentLabel(t, b.paymentMethode)
                })}
              </Text>
            )}
          </Stack>
        </Box>

        {/* The car, once the driver said yes and never before it. */}
        {b.driverStatus === 'ACCEPTED' && b.car && (
          <VehicleCard car={b.car} title={t.DetailYourVehicle} />
        )}

        {/* The driver and the car, and the map while the ride is live. */}
        <DriverTrackingCard
          transferId={b.id}
          state={b.state}
          pickupAddress={b.pickup}
          audience="customer"
          fallback={{
            driverId: b.driverId,
            driverName:
              b.driverName ?? (b.driverId ? t.DriverAssigned : undefined),
            car: b.car
              ? {
                  carName: b.car.name ?? null,
                  licensePlate: b.car.licensePlate ?? null,
                  carClass: b.car.carClass ?? null
                }
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
        body={fill(t.CancelConfirmBody, {
          date: dates.day(b.rideDateISO),
          time: b.rideTime
        })}
        confirmLabel={t.CancelConfirm}
        cancelLabel={t.CancelKeep}
        destructive
        loading={cancelling}
      />
    </Box>
  )
}

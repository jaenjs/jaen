/**
 * One transfer.
 *
 * Three people open this screen and it is a different screen for each:
 *
 * - The dispatcher, on any viewport, sees everything the backend holds and
 *   every write it offers: driver and car, the price, the real twelve states,
 *   extras added and removed, a cancel. (The route, the time and the passenger
 *   have no update mutation on the backend, so they are read-only here.)
 * - The assigned driver on a phone, below `md`, sees the ride the way
 *   dispatch.md section 8a describes it: the pickup with a map link, the
 *   passenger with a call link, the bags and seats and flight, the wishes,
 *   and one slider with five stops that moves the ride forward one stop per
 *   release. Reject at ASSIGNED and No show at AT_PICKUP are buttons behind a
 *   confirmation. After COMPLETED the slider is gone and the fare is shown.
 * - A driver on a desktop, or a customer, sees the read-only detail. A driver
 *   never sees a price before COMPLETED, because the backend sends none.
 *
 * There is no `transfer(id)` root field yet, so the row comes through
 * useTransfer, which serves it from the list's cache and otherwise walks the
 * scoped connection. See shared/hooks/transfers.ts.
 *
 * Two tracking pieces sit on this screen. The dispatcher gets the "where the
 * driver is" card with the small map under the detail grid, see
 * components/locations/DriverTrackingCard. The assigned driver's own phone
 * feeds that map: useDriverPositionSender is told the ride's state from here
 * so the send loop starts the moment the slider moves, see hooks/tracking.
 */
import React, {useEffect, useMemo, useRef, useState} from 'react'
import {
  Badge,
  Box,
  Button,
  DataList,
  Heading,
  HStack,
  IconButton,
  Link,
  NativeSelect,
  NumberInput,
  Separator,
  Slider,
  Stack,
  Text,
  Textarea,
  chakra
} from '@chakra-ui/react'
import {FaArrowLeft} from '@react-icons/all-files/fa/FaArrowLeft'
import {FaMapMarkerAlt} from '@react-icons/all-files/fa/FaMapMarkerAlt'
import {FaMapMarkedAlt} from '@react-icons/all-files/fa/FaMapMarkedAlt'
import {FaPhone} from '@react-icons/all-files/fa/FaPhone'
import {FaUsers} from '@react-icons/all-files/fa/FaUsers'
import {FaSuitcase} from '@react-icons/all-files/fa/FaSuitcase'
import {FaBaby} from '@react-icons/all-files/fa/FaBaby'
import {FaPlane} from '@react-icons/all-files/fa/FaPlane'
import {FaCommentDots} from '@react-icons/all-files/fa/FaCommentDots'
import {FaClock} from '@react-icons/all-files/fa/FaClock'
import {FaTimes} from '@react-icons/all-files/fa/FaTimes'
import {FaEuroSign} from '@react-icons/all-files/fa/FaEuroSign'
import {FaExchangeAlt} from '@react-icons/all-files/fa/FaExchangeAlt'
import {FaCheck} from '@react-icons/all-files/fa/FaCheck'
import {useCaller} from '../auth'
import {addressOf, printableAddress, storedPoint} from '../address'
import {useAppNavigate, useAppParams} from '../navigation'
import {useCars, useDrivers, useUsers} from '../hooks'
import {
  acceptAssignment,
  addTransferExtra,
  declineAssignment,
  removeTransferExtra,
  unassignDriver,
  setTransferAddress,
  updateTransferState,
  driverStopIndex,
  isClosed,
  mailHref,
  mapHref,
  passengerName,
  telHref,
  transferCode,
  transferPath,
  useTransfer,
  DRIVER_EXITS,
  DRIVER_STOPS,
  EXTRA_TYPES,
  type AssignmentAttempt,
  type ExtraType,
  type TransferRow
} from '../hooks/transfers'
import {formatPhone, needsCountryCode} from '../phone'
import {failureText} from '../errors'
import {
  AddressCheckBadge,
  CashReceived,
  ConfirmDialog,
  DetailRow,
  DriverColorDot,
  EmptyState,
  ErrorBanner,
  MoneyText,
  Selectable,
  StatusBadge,
  toaster,
  useStateLabel,
  PageHeader
} from '../components'
import {RefreshButton} from '../components/RefreshButton'
import {useViewRefresh} from '../hooks/view-refresh'
import {DetailSkeleton} from '../components/skeletons'
import {DriverTrackingCard} from '../components/locations'
import {useDriverPositionSender} from '../hooks/tracking'
import {OfflineBanner} from '../components/OfflineBanner'
import {CustomerStatusBadge} from '../components/CustomerStatusBadge'
import {MoneySection} from '../components/documents/MoneySection'
import {OfferDialog} from '../components/documents/OfferDialog'
import {
  canConfirmBooking,
  canSendOffer,
  needsConfirmation
} from '../hooks/offers'
import {BookedBy, BookedByLine, bookedBy} from '../components/BookedBy'
import {getI18nPeople} from '../locales/i18nPeople'
import {getI18nOffers} from '../locales/i18nOffers'
import {getI18nOffline} from '../locales/i18nOffline'
import {useOnline, useRefetchOnReconnect} from '../offline'
import {asTransferState, type TransferState} from '../locales/i18nStates'
import {fill, type TransfersStrings} from '../locales/i18nTransfers'
import {
  AssignDialog,
  ConfirmBookingDialog,
  CreateTransferDialog,
  DriverAnswerActions,
  DriverAnswerBadge,
  PriceDialog,
  StateDialog,
  carDisplayName,
  driverDisplayName,
  enumLabel,
  formatDateTime,
  formatDay,
  returnTripPrefill,
  useIsMobile,
  useTransferStrings
} from './TransfersView'

/**
 * A failure as a sentence in the reader's language (rule 14). The shared
 * catalogue words every machine answer, so a toast on this screen never shows
 * the backend's English; the fallback is this screen's own word for a failure
 * nothing knows.
 */
const errorMessage = (err: unknown, fallback: string): string =>
  failureText(err, fallback)

// ============================================================
// Pieces
// ============================================================

function Section({
  title,
  children,
  action
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <Box
      rounded="surface"
      borderWidth="1px"
      borderColor="border.default"
      bg="bg.surface"
      p="4">
      <HStack justify="space-between" mb="3">
        <Text
          textStyle="xs"
          fontWeight="semibold"
          color="fg.muted"
          textTransform="uppercase"
          letterSpacing="wider">
          {title}
        </Text>
        {action}
      </HStack>
      {children}
    </Box>
  )
}

/**
 * A row of this page's data lists. The layout, the wrapping of a long value
 * and the selectable mark all live in the shared DetailRow (rule 9 and rule
 * 11), never at a value of this screen.
 */
function Item({label, value}: {label: string; value: React.ReactNode}) {
  return <DetailRow label={label} value={value} />
}

/**
 * One address on the detail: the free text as the dispatcher typed it, and
 * beneath it what the pylon made of it where that is worth showing.
 * okf/architecture/dispatch.md section 14.2.
 *
 * A RESOLVED side draws its canonical address quietly, so a dispatcher can
 * see that "Flughafen" became Schwechat without being asked anything. A
 * GUESSED or UNRESOLVED side draws the warning, and one tap on it confirms
 * the guess or corrects it.
 */
function AddressValue({
  transfer,
  side,
  editable,
  onChanged
}: {
  transfer: TransferRow
  side: 'PICKUP' | 'DROPOFF'
  editable: boolean
  onChanged: (row: TransferRow) => void
}) {
  const resolved = addressOf(transfer, side)
  const typed = side === 'PICKUP' ? transfer.pickup : transfer.dropoff
  const canonical =
    resolved.address && resolved.address.trim() !== typed.trim()
      ? resolved.address.trim()
      : null

  return (
    <Stack gap="1" minW="0">
      <Selectable>{typed}</Selectable>
      {canonical && resolved.resolution === 'RESOLVED' && (
        <Text
          textStyle="xs"
          color="fg.muted"
          style={{overflowWrap: 'anywhere'}}>
          {canonical}
        </Text>
      )}
      <AddressCheckBadge
        transfer={{...transfer, ...oneSide(side)}}
        onCorrect={
          editable
            ? async (which, address) =>
                setTransferAddress(transfer.id, which, address)
            : undefined
        }
        onCorrected={row => onChanged(row as TransferRow)}
      />
    </Stack>
  )
}

/**
 * The row with the other side's doubt blanked out, so the badge under the
 * pickup is about the pickup and the badge under the destination about the
 * destination, and a ride with two doubts draws two warnings where they
 * belong rather than one that stands for both.
 */
function oneSide(side: 'PICKUP' | 'DROPOFF') {
  return side === 'PICKUP'
    ? {dropoffResolution: undefined}
    : {pickupResolution: undefined}
}

/** The extras of a transfer, and for the dispatcher a way to add and remove them. */
function ExtrasSection({
  transfer,
  editable,
  onChanged
}: {
  transfer: TransferRow
  editable: boolean
  onChanged: (row: TransferRow) => void
}) {
  const {t} = useTransferStrings()
  const [type, setType] = useState<ExtraType>('CHILD_SEAT')
  const [amount, setAmount] = useState(1)
  const [busy, setBusy] = useState<string | null>(null)

  const add = async () => {
    setBusy('add')
    try {
      const row = await addTransferExtra(transfer.id, type, amount)
      if (row) onChanged(row)
      toaster.success({title: t.ExtraAdded})
    } catch (err) {
      toaster.error({title: t.ExtraFailed, description: errorMessage(err, '')})
    } finally {
      setBusy(null)
    }
  }

  const remove = async (extraType: string) => {
    setBusy(extraType)
    try {
      const row = await removeTransferExtra(transfer.id, extraType as ExtraType)
      if (row) onChanged(row)
      toaster.success({title: t.ExtraRemoved})
    } catch (err) {
      toaster.error({title: t.ExtraFailed, description: errorMessage(err, '')})
    } finally {
      setBusy(null)
    }
  }

  return (
    <Section title={t.SectionExtras}>
      <Stack gap="3">
        {transfer.extras.length === 0 ? (
          <Text textStyle="sm" color="fg.muted">
            {t.NoExtras}
          </Text>
        ) : (
          <Stack gap="1">
            {transfer.extras.map(x => (
              <HStack key={x.type} justify="space-between" textStyle="sm">
                <span>{enumLabel(t, 'Extra_', x.type)}</span>
                <HStack gap="2">
                  <Text color="fg.muted">× {x.amount}</Text>
                  {editable && (
                    <IconButton
                      size="xs"
                      variant="ghost"
                      colorPalette="red"
                      aria-label={t.RemoveExtra}
                      loading={busy === x.type}
                      onClick={() => void remove(x.type)}>
                      <FaTimes />
                    </IconButton>
                  )}
                </HStack>
              </HStack>
            ))}
          </Stack>
        )}
        {editable && (
          <HStack gap="2" flexWrap="wrap">
            <NativeSelect.Root size="sm" flex="1" minW="40">
              <NativeSelect.Field
                value={type}
                onChange={e => setType(e.target.value as ExtraType)}>
                {EXTRA_TYPES.map(x => (
                  <option key={x} value={x}>
                    {enumLabel(t, 'Extra_', x)}
                  </option>
                ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
            <NumberInput.Root
              size="sm"
              w="24"
              min={1}
              max={20}
              value={String(amount)}
              aria-label={t.ExtrasQuantity}
              onValueChange={e => setAmount(Math.max(1, e.valueAsNumber || 1))}>
              <NumberInput.Control />
              <NumberInput.Input />
            </NumberInput.Root>
            <Button
              size="sm"
              variant="outline"
              colorPalette="brand"
              loading={busy === 'add'}
              onClick={() => void add()}>
              {t.AddExtra}
            </Button>
          </HStack>
        )}
      </Stack>
    </Section>
  )
}

// ============================================================
// The driver's slider
// ============================================================

interface RideSliderProps {
  transfer: TransferRow
  onMoved: (row: TransferRow) => void
  /** The request is still open: the slider is drawn at its first stop and does nothing until the yes. */
  locked?: boolean
}

/**
 * Five stops, forward only, one stop per release.
 *
 * The thumb follows the finger while dragging. On release the target is read
 * once: anything past the current stop commits exactly the next one, with one
 * updateTransferState, and the thumb sits on it while the call is out. A
 * refusal snaps the thumb back to where it was and the backend's message is
 * shown under the track, inline, where it stays until the next attempt.
 * Anything at or before the current stop snaps back without a call, going
 * backwards is a dispatcher's job.
 */
function RideSlider({transfer, onMoved, locked = false}: RideSliderProps) {
  const {t, code} = useTransferStrings()
  const stateLabel = useStateLabel()
  // A stop is a mutation and has to reach the pylon: without a connection the
  // slider is disabled and says so, see okf/architecture/offline.md.
  const {online} = useOnline()
  const offline = getI18nOffline(code).strings
  // A ride whose request is open is still PENDING, which is no stop: the
  // thumb rests on the first one, disabled, until the driver says yes.
  const current = locked ? 0 : driverStopIndex(transfer.state)
  const [thumb, setThumb] = useState(current)
  // Where the thumb was last dragged to. The release handler reads this and
  // not the event: in controlled mode zag reports the value in a microtask,
  // from the `value` prop, which React may not have re-rendered yet, so the
  // event can still carry the stop the thumb started from.
  const dragged = useRef(current)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  useEffect(() => {
    setThumb(current)
    dragged.current = current
  }, [current])

  const stopLabel = (s: TransferState): string =>
    (t[`Stop_${s}` as keyof TransfersStrings] as string | undefined) ??
    stateLabel(s)

  const marks = DRIVER_STOPS.map((s, i) => ({
    value: i,
    label: (
      <Text
        textStyle="2xs"
        fontWeight={i === current ? 'bold' : 'normal'}
        color={i <= current ? 'fg.default' : 'fg.muted'}
        whiteSpace="nowrap"
        // The first and last labels would run off the track otherwise.
        transform={
          i === 0
            ? 'translateX(40%)'
            : i === DRIVER_STOPS.length - 1
              ? 'translateX(-40%)'
              : undefined
        }>
        {stopLabel(s)}
      </Text>
    )
  }))

  const release = async () => {
    const target = dragged.current
    if (pending) return
    if (target <= current) {
      setThumb(current)
      dragged.current = current
      return
    }
    const next = current + 1
    const nextState = DRIVER_STOPS[next]
    if (!nextState) return
    setThumb(next)
    dragged.current = next
    setPending(true)
    setFailure(null)
    try {
      const row = await updateTransferState(transfer.id, nextState)
      onMoved(row)
    } catch (err) {
      setThumb(current)
      dragged.current = current
      setFailure(errorMessage(err, t.SlideFailed))
    } finally {
      setPending(false)
    }
  }

  return (
    <Stack gap="2" data-testid="ride-slider">
      <HStack justify="space-between">
        <Text textStyle="sm" fontWeight="medium">
          {t.DriverProgress}
        </Text>
        <StatusBadge state={transfer.state} />
      </HStack>
      <Box px="2" pb="6">
        <Slider.Root
          size="lg"
          colorPalette="brand"
          min={0}
          max={DRIVER_STOPS.length - 1}
          step={1}
          thumbAlignment="center"
          value={[thumb]}
          disabled={pending || !online || locked}
          onValueChange={e => {
            const v = e.value[0] ?? current
            dragged.current = v
            setThumb(v)
          }}
          onValueChangeEnd={() => void release()}
          aria-label={[t.DriverProgress]}>
          <Slider.Control>
            <Slider.Track h="3">
              <Slider.Range />
            </Slider.Track>
            <Slider.Thumb index={0} boxSize="8" borderWidth="3px" shadow="md">
              <Slider.HiddenInput />
            </Slider.Thumb>
            <Slider.Marks marks={marks} />
          </Slider.Control>
        </Slider.Root>
      </Box>
      {failure ? (
        <ErrorBanner message={failure} />
      ) : (
        <Text
          textStyle="xs"
          color="fg.muted"
          textAlign="center"
          data-testid="ride-slider-hint">
          {locked
            ? t.RequestHint
            : !online
              ? offline.NotPossibleOffline
              : pending
                ? '…'
                : t.DriverSlideHint}
        </Text>
      )}
    </Stack>
  )
}

// ============================================================
// The driver's phone screen
// ============================================================

function DriverRideScreen({
  transfer,
  onChanged
}: {
  transfer: TransferRow
  onChanged: (row: TransferRow) => void
}) {
  const {t, code} = useTransferStrings()
  const navigate = useAppNavigate()
  const state = asTransferState(transfer.state)
  const stage = driverStopIndex(transfer.state)
  const exit = state ? DRIVER_EXITS[state] : undefined
  const [confirmExit, setConfirmExit] = useState<TransferState | null>(null)
  const [exiting, setExiting] = useState(false)
  const [exitError, setExitError] = useState<string | null>(null)

  const name = passengerName(transfer)
  const phone = transfer.passengers[0]?.phone
  const tel = telHref(phone)
  // The map link reads what the pylon worked out where a person or a
  // geocoder stands behind it, and the typed text otherwise (dispatch.md
  // 14.2): "vor dem Haupteingang" opens nothing useful, its canonical
  // address does.
  const map = mapHref(printableAddress(transfer, 'PICKUP'))
  const done = state === 'COMPLETED'

  // The driver's answer (dispatch.md section 9). While the request is open
  // the screen shows Annehmen and Ablehnen with the reason field above a
  // locked slider; a driver who said yes may still decline while the car
  // has not left, that is at ASSIGNED, behind the same reason field.
  const requested = transfer.driverStatus === 'REQUESTED'
  const canDecline = requested || state === 'ASSIGNED'
  const [reason, setReason] = useState('')
  const [declineOpen, setDeclineOpen] = useState(requested)
  const [answering, setAnswering] = useState<'accept' | 'decline' | null>(null)
  const [answerError, setAnswerError] = useState<string | null>(null)

  useEffect(() => {
    setDeclineOpen(requested)
    setReason('')
    setAnswerError(null)
  }, [requested, transfer.id])

  const accept = async () => {
    setAnswering('accept')
    setAnswerError(null)
    try {
      const row = await acceptAssignment(transfer.id)
      onChanged(row)
      toaster.success({title: t.ToastAccepted})
    } catch (err) {
      setAnswerError(errorMessage(err, t.AnswerFailed))
    } finally {
      setAnswering(null)
    }
  }

  const decline = async () => {
    setAnswering('decline')
    setAnswerError(null)
    try {
      const row = await declineAssignment(transfer.id, reason)
      onChanged(row)
      toaster.success({title: t.ToastDeclined})
      navigate('/transfers')
    } catch (err) {
      setAnswerError(errorMessage(err, t.AnswerFailed))
    } finally {
      setAnswering(null)
    }
  }

  const takeExit = async () => {
    if (!confirmExit) return
    setExiting(true)
    setExitError(null)
    try {
      const row = await updateTransferState(transfer.id, confirmExit)
      onChanged(row)
      setConfirmExit(null)
    } catch (err) {
      setExitError(errorMessage(err, t.SlideFailed))
      setConfirmExit(null)
    } finally {
      setExiting(false)
    }
  }

  const facts: Array<{icon: React.ReactNode; label: string; value?: string}> = [
    {
      icon: <FaUsers />,
      label: t.LabelPassengers,
      value: transfer.passengers.length
        ? String(transfer.passengers.length)
        : undefined
    },
    {icon: <FaSuitcase />, label: t.Luggage, value: transfer.details?.luggage},
    {
      icon: <FaBaby />,
      label: t.ChildSeats,
      value: transfer.details?.childSeats
    },
    {icon: <FaPlane />, label: t.Flight, value: transfer.details?.flightNumber}
  ].filter(f => f.value)

  return (
    <Box p="4" pb="8">
      <Stack gap="4">
        <HStack justify="space-between">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate('/transfers')}>
            <FaArrowLeft />
            {t.DetailBackMine}
          </Button>
          <Selectable textStyle="xs" color="fg.muted" fontFamily="mono">
            {transfer.code}
          </Selectable>
        </HStack>

        {/* The pickup: the time large, the address, one tap to the map. */}
        <Box
          rounded="surface"
          borderWidth="1px"
          borderColor="border.default"
          bg="bg.surface"
          p="4">
          <HStack justify="space-between" align="flex-start" gap="3">
            <Box minW="0">
              <Text
                textStyle="xs"
                color="fg.muted"
                textTransform="uppercase"
                letterSpacing="wider">
                {t.Pickup} · {formatDay(transfer.rideDateISO, code)}
              </Text>
              <Heading size="3xl" lineHeight="1" mt="1">
                {transfer.rideTime}
              </Heading>
              <HStack align="flex-start" gap="2" mt="3">
                <Box color="fg.muted" mt="1">
                  <FaMapMarkerAlt />
                </Box>
                <Selectable fontWeight="medium">{transfer.pickup}</Selectable>
              </HStack>
              <Selectable textStyle="sm" color="fg.muted" ms="6">
                → {transfer.dropoff}
              </Selectable>
              {/*
                The doubt the pylon left on the address (dispatch.md 14.2).
                Read only here: a driver sees that the address is a guess
                before they drive to it, and the office corrects it.
              */}
              <Box mt="2" ms="6">
                <AddressCheckBadge transfer={transfer} />
              </Box>
            </Box>
            {map && (
              <IconButton
                asChild
                size="lg"
                variant="outline"
                colorPalette="brand"
                aria-label={t.OpenMap}
                minW="14"
                minH="14">
                <Link href={map} target="_blank" rel="noopener noreferrer">
                  <FaMapMarkedAlt />
                </Link>
              </IconButton>
            )}
          </HStack>
        </Box>

        {/* The passenger, one tap to call. */}
        <Box
          rounded="surface"
          borderWidth="1px"
          borderColor="border.default"
          bg="bg.surface"
          p="4">
          <HStack justify="space-between" gap="3">
            <Box minW="0">
              <Text
                textStyle="xs"
                color="fg.muted"
                textTransform="uppercase"
                letterSpacing="wider">
                {t.Passenger}
              </Text>
              <Selectable fontWeight="semibold" textStyle="lg" truncate>
                {name || t.NoPassenger}
              </Selectable>
              {phone && (
                <Selectable textStyle="sm" color="fg.muted">
                  {formatPhone(phone)}
                </Selectable>
              )}
              {needsCountryCode(phone) && (
                <Text textStyle="xs" color="fg.warning">
                  {t.PhoneCheckCountry}
                </Text>
              )}
            </Box>
            {tel && (
              <Button asChild size="lg" colorPalette="green" minH="14">
                <Link href={tel} textDecoration="none">
                  <FaPhone />
                  {t.Call}
                </Link>
              </Button>
            )}
          </HStack>
          {facts.length > 0 && (
            <HStack gap="4" mt="3" flexWrap="wrap">
              {facts.map(f => (
                <HStack key={f.label} gap="1.5" textStyle="sm">
                  <Box color="fg.muted">{f.icon}</Box>
                  <Text>{f.value}</Text>
                </HStack>
              ))}
            </HStack>
          )}
          <Separator my="3" />
          <HStack align="flex-start" gap="2">
            <Box color="fg.muted" mt="0.5">
              <FaCommentDots />
            </Box>
            <Box>
              <Text
                textStyle="xs"
                color="fg.muted"
                textTransform="uppercase"
                letterSpacing="wider">
                {t.Wishes}
              </Text>
              <Selectable
                textStyle="sm"
                color={transfer.details?.message ? 'fg.default' : 'fg.muted'}
                whiteSpace="pre-wrap">
                {transfer.details?.message || t.NoWishes}
              </Selectable>
            </Box>
          </HStack>
        </Box>

        {/* After COMPLETED: the fare, the one price a driver sees. */}
        {done && (
          <Box
            rounded="surface"
            borderWidth="1px"
            colorPalette="green"
            borderColor="colorPalette.solid"
            bg="colorPalette.subtle"
            p="4">
            <HStack gap="2" color="colorPalette.fg">
              <FaEuroSign />
              <Text fontWeight="semibold">{t.FareTitle}</Text>
            </HStack>
            {transfer.price != null ? (
              <>
                <MoneyText
                  value={transfer.price}
                  textStyle="4xl"
                  fontWeight="bold"
                  display="block"
                  mt="1"
                />
                <Text textStyle="sm" mt="1">
                  {transfer.paymentMethode
                    ? fill(t.FareBy, {
                        method: enumLabel(t, 'Pay_', transfer.paymentMethode)
                      })
                    : t.FareUnknown}
                </Text>
                {transfer.paymentMethode && (
                  <Badge
                    mt="2"
                    colorPalette={
                      transfer.paymentMethode === 'CASH' ? 'green' : 'gray'
                    }
                    variant="solid">
                    {transfer.paymentMethode === 'CASH'
                      ? t.FareCashHint
                      : t.FareNoCashHint}
                  </Badge>
                )}
              </>
            ) : (
              <Text textStyle="sm" mt="1">
                {t.FareUnknown}
              </Text>
            )}
          </Box>
        )}

        {/*
          The cash the passenger handed over, dispatch.md section 14.3. It
          sits under the fare and above the slider: the driver is holding the
          money at that moment, and the ride is not over. The component draws
          nothing before the car has left, nothing on a ride the passenger
          does not pay for, and the record with its instant once it stands.
        */}
        <CashReceived transfer={transfer} onChanged={onChanged} />

        {/* The request: Annehmen and Ablehnen with the reason, above the locked slider. */}
        {requested && !done && (
          <Box
            rounded="surface"
            borderWidth="1px"
            colorPalette="orange"
            borderColor="colorPalette.solid"
            bg="colorPalette.subtle"
            p="4"
            data-testid="driver-request">
            <HStack justify="space-between" gap="2">
              <Text fontWeight="semibold">{t.RequestTitle}</Text>
              <DriverAnswerBadge status="REQUESTED" />
            </HStack>
            <Text textStyle="sm" color="fg.muted" mt="1">
              {t.RequestHint}
            </Text>
            {answerError && (
              <Box mt="3">
                <ErrorBanner message={answerError} />
              </Box>
            )}
            <Stack gap="1" mt="3">
              <Text textStyle="xs" color="fg.muted">
                {t.DeclineReasonLabel}
              </Text>
              <Textarea
                size="sm"
                rows={2}
                bg="bg.surface"
                placeholder={t.DeclineReasonPlaceholder}
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
            </Stack>
            <Stack direction={{base: 'column', sm: 'row'}} gap="3" mt="3">
              <Button
                size="lg"
                colorPalette="green"
                flex="1"
                minH="12"
                loading={answering === 'accept'}
                disabled={answering === 'decline'}
                onClick={() => void accept()}>
                <FaCheck />
                {t.Accept}
              </Button>
              <Button
                size="lg"
                variant="outline"
                colorPalette="red"
                flex="1"
                minH="12"
                loading={answering === 'decline'}
                disabled={answering === 'accept'}
                onClick={() => void decline()}>
                <FaTimes />
                {t.Reject}
              </Button>
            </Stack>
          </Box>
        )}

        {/* The slider, while the ride is the driver's to move, locked while the request is open. */}
        {(stage >= 0 || requested) && !done && (
          <Box
            rounded="surface"
            borderWidth="1px"
            borderColor="border.default"
            bg="bg.surface"
            p="4">
            <RideSlider
              transfer={transfer}
              onMoved={onChanged}
              locked={requested}
            />
            {exitError && (
              <Box mt="3">
                <ErrorBanner message={exitError} />
              </Box>
            )}
            {/* A driver who said yes and cannot drive after all: the no, with its reason, while the car has not left. */}
            {canDecline && !requested && (
              <Stack gap="3" mt="4">
                {answerError && <ErrorBanner message={answerError} />}
                {declineOpen && (
                  <Stack gap="1">
                    <Text textStyle="xs" color="fg.muted">
                      {t.DeclineReasonLabel}
                    </Text>
                    <Textarea
                      size="sm"
                      rows={2}
                      placeholder={t.DeclineReasonPlaceholder}
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                    />
                  </Stack>
                )}
                <Button
                  w="full"
                  size="lg"
                  variant="outline"
                  colorPalette="red"
                  loading={answering === 'decline'}
                  onClick={() =>
                    declineOpen ? void decline() : setDeclineOpen(true)
                  }>
                  {declineOpen ? t.DeclineConfirm : t.Reject}
                </Button>
              </Stack>
            )}
            {exit && (
              <Button
                mt="4"
                w="full"
                size="lg"
                variant="outline"
                colorPalette="red"
                onClick={() => setConfirmExit(exit)}>
                {t.NoShow}
              </Button>
            )}
          </Box>
        )}

        {stage < 0 && !requested && !done && (
          <EmptyState
            title={isClosed(transfer.state) ? t.RideClosed : t.NotYourRide}
            icon={<FaClock />}
          />
        )}
      </Stack>

      <ConfirmDialog
        open={!!confirmExit}
        onClose={() => setConfirmExit(null)}
        onConfirm={takeExit}
        title={t.NoShowConfirmTitle}
        body={t.NoShowConfirmBody}
        confirmLabel={t.NoShow}
        destructive
        loading={exiting}
      />
    </Box>
  )
}

// ============================================================
// The dispatcher's detail, and the read-only one
// ============================================================

function DetailScreen({
  transfer,
  editable,
  onChanged,
  onRefresh
}: {
  transfer: TransferRow
  editable: boolean
  onChanged: (row: TransferRow) => void
  onRefresh: () => void
}) {
  const {t, code} = useTransferStrings()
  const navigate = useAppNavigate()
  const stateLabel = useStateLabel()
  const {drivers} = useDrivers()
  const {cars} = useCars()
  const {users} = useUsers(100)

  const [assignOpen, setAssignOpen] = useState(false)
  const [priceOpen, setPriceOpen] = useState(false)
  const [stateOpen, setStateOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [returnOpen, setReturnOpen] = useState(false)
  // The offer: compiled in the browser and sent, then the documents read again.
  const [offerOpen, setOfferOpen] = useState(false)
  const [documentsVersion, setDocumentsVersion] = useState(0)
  const {strings: so} = getI18nOffers(code)
  const {strings: pw} = getI18nPeople(code)
  const offerable =
    editable && transfer.price != null && canSendOffer(transfer.customerStatus)
  const [unassignOpen, setUnassignOpen] = useState(false)
  const [unassigning, setUnassigning] = useState(false)
  // No driver before the confirmation, dispatch.md section 11: the picker is
  // disabled with the hint while the customer's status is NEW, OFFERED or
  // DECLINED, and a NEW ride carries "Buchung bestätigen" beside the state.
  const blocked =
    editable &&
    !isClosed(transfer.state) &&
    needsConfirmation(transfer.customerStatus)
  const confirmable =
    editable &&
    !isClosed(transfer.state) &&
    canConfirmBooking(transfer.customerStatus)
  const [confirmOpen, setConfirmOpen] = useState(false)

  // Who was asked, newest first, for the dispatcher. The names come from the
  // driver list and the users page, the id stands in for a name not loaded.
  const nameOf = (id: string | undefined): string | undefined => {
    if (!id) return undefined
    const account =
      drivers.find(d => d.id === id) ?? users.find(u => u.id === id)
    return account ? driverDisplayName(account) : id
  }
  const colorOf = (id: string | undefined): string | undefined =>
    id ? drivers.find(d => d.id === id)?.driverColor : undefined
  const attemptWord = (
    a: AssignmentAttempt
  ): {text: string; tone: 'orange' | 'green' | 'red' | 'gray'} =>
    !a.answer
      ? {text: t.AttemptOpen, tone: 'orange'}
      : a.answer === 'ACCEPTED'
        ? {text: t.AttemptAccepted, tone: 'green'}
        : a.answer === 'DECLINED'
          ? {text: t.AttemptDeclined, tone: 'red'}
          : {text: t.AttemptWithdrawn, tone: 'gray'}
  // The declined driver stays on the page until the next request, like on the board.
  const declinedId =
    transfer.driverStatus === 'DECLINED'
      ? (transfer.attempts?.[0] ?? transfer.lastAttempt)?.driverId
      : undefined
  const canUnassign =
    editable &&
    !!transfer.driverId &&
    !isClosed(transfer.state) &&
    (transfer.driverStatus === 'REQUESTED' ||
      transfer.driverStatus === 'ACCEPTED')

  const unassign = async () => {
    setUnassigning(true)
    try {
      const row = await unassignDriver(transfer.id)
      onChanged(row)
      toaster.success({title: t.ToastUnassigned})
      setUnassignOpen(false)
    } catch (err) {
      toaster.error({title: t.ToastFailed, description: errorMessage(err, '')})
    } finally {
      setUnassigning(false)
    }
  }

  // "Rückfahrt anlegen" is offered on an origin without a return yet. A
  // return leg never gets one, a third leg is created from the origin, and
  // a row read without its links (an old schema) offers nothing.
  const canCreateReturn =
    editable &&
    !transfer.referenceId &&
    transfer.returns !== undefined &&
    transfer.returns.length === 0
  // The origin's code, from the linked row, or the stripped id while the API has no code.
  const originCode =
    transfer.reference?.code ??
    (transfer.referenceId ? transferCode(transfer.referenceId) : undefined)
  const originPath = transfer.reference
    ? transferPath(transfer.reference)
    : `/transfers/${transfer.referenceId}`

  const driver = useMemo(
    () =>
      transfer.driverId
        ? (drivers.find(d => d.id === transfer.driverId) ??
          users.find(u => u.id === transfer.driverId))
        : undefined,
    [drivers, users, transfer.driverId]
  )
  const customer = useMemo(
    () => users.find(u => u.id === transfer.customerId),
    [users, transfer.customerId]
  )
  const car = useMemo(
    () =>
      transfer.carId ? cars.find(c => c.id === transfer.carId) : undefined,
    [cars, transfer.carId]
  )
  const passenger = transfer.passengers[0]
  const closed = isClosed(transfer.state)
  /**
   * Who booked, for the quieter line of the people card. The passenger is the
   * one on the row or, when the row names none, the "Zimmer / Name" the
   * booking carried, which is how a hotel's guest is named.
   */
  const booked: BookedBy = useMemo(
    () =>
      bookedBy(
        {
          name: passengerName(transfer),
          email: passenger?.email,
          phone: passenger?.phone
        },
        transfer.customer
      ),
    [transfer, passenger]
  )

  const cancel = async () => {
    setCancelling(true)
    try {
      const row = await updateTransferState(transfer.id, 'CANCELED')
      onChanged(row)
      toaster.success({title: t.ToastCancelled})
      setCancelOpen(false)
    } catch (err) {
      toaster.error({title: t.ToastFailed, description: errorMessage(err, '')})
    } finally {
      setCancelling(false)
    }
  }

  return (
    <Box p={{base: '4', md: '6'}} maxW="full">
      <Stack gap="4">
        <HStack justify="space-between" flexWrap="wrap" gap="2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate('/transfers')}>
            <FaArrowLeft />
            {editable ? t.DetailBack : t.DetailBackMine}
          </Button>
          <RefreshButton onClick={onRefresh} />
        </HStack>

        <PageHeader
          title={fill(t.DetailHeading, {code: transfer.code})}
          mono
          meta={
            <>
              <StatusBadge state={transfer.state} size="lg" />
              <CustomerStatusBadge status={transfer.customerStatus} size="lg" />
            </>
          }
          actions={
            editable ? (
              <>
                <Button
                  size="sm"
                  colorPalette="brand"
                  disabled={blocked}
                  title={blocked ? t.ConfirmFirst : undefined}
                  data-testid="assign-driver"
                  onClick={() => setAssignOpen(true)}>
                  {transfer.driverId ? t.ActionReassign : t.ActionAssign}
                </Button>
                {blocked && (
                  <Badge
                    colorPalette="gray"
                    variant="outline"
                    data-testid="confirm-first">
                    {t.ConfirmFirst}
                  </Badge>
                )}
                {confirmable && (
                  <Button
                    size="sm"
                    colorPalette="brand"
                    variant="outline"
                    data-testid="confirm-booking"
                    onClick={() => setConfirmOpen(true)}>
                    {t.ActionConfirmBooking}
                  </Button>
                )}
                {offerable && (
                  <Button
                    size="sm"
                    variant="outline"
                    colorPalette="brand"
                    onClick={() => setOfferOpen(true)}
                    data-testid="send-offer">
                    {transfer.customerStatus === 'OFFERED'
                      ? so.SendOfferAgain
                      : so.SendOffer}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPriceOpen(true)}>
                  {t.ActionPrice}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStateOpen(true)}>
                  {t.ActionState}
                </Button>
                {canCreateReturn && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setReturnOpen(true)}>
                    <FaExchangeAlt />
                    {t.ActionReturnTrip}
                  </Button>
                )}
                {!closed && (
                  <Button
                    size="sm"
                    variant="outline"
                    colorPalette="red"
                    onClick={() => setCancelOpen(true)}>
                    {t.ActionCancel}
                  </Button>
                )}
              </>
            ) : undefined
          }
        />

        {/*
          The answer above everything else (dispatch.md section 9a). The ride
          page is the same page for everybody who is not the assigned driver
          on a phone, so this is where a driver who is also an admin answers a
          request meant for them, and where an admin says yes for a driver who
          answered on the phone. The component draws nothing on a ride with no
          open request.
        */}
        <DriverAnswerActions
          transfer={transfer}
          onAnswered={onChanged}
          withReason
          rounded="surface"
          borderWidth="1px"
          colorPalette="orange"
          borderColor="colorPalette.solid"
          bg="colorPalette.subtle"
          p="4"
        />

        {/*
          Two columns from lg, one below it (design-consistency.md rule 13).
          They used to split at md, so a window at half a desktop screen drew
          two 352 px columns whose detail rows had 176 px left for a value
          after the label's floor: a 60 character address broke into four
          lines and a date with its time into two. The money section on this
          same page has always split at lg, and this grid now reads like it.
        */}
        <Box
          display="grid"
          gridTemplateColumns={{base: '1fr', lg: '1fr 1fr'}}
          gap="4">
          <Section title={t.SectionRoute}>
            <DataList.Root orientation="horizontal" size="sm">
              {/*
                The address of the request, dispatch.md section 14.2: the row
                keeps what the dispatcher typed, and under it, where the pylon
                could not work it out with certainty, the canonical address it
                did find and the warning that opens the one tap correction.
              */}
              <Item
                label={t.Pickup}
                value={
                  <AddressValue
                    transfer={transfer}
                    side="PICKUP"
                    onChanged={onChanged}
                    editable={editable}
                  />
                }
              />
              <Item
                label={t.Dropoff}
                value={
                  <AddressValue
                    transfer={transfer}
                    side="DROPOFF"
                    onChanged={onChanged}
                    editable={editable}
                  />
                }
              />
              {transfer.subject && (
                <Item label={t.LabelSubject} value={transfer.subject} />
              )}
              {transfer.referenceId && (
                <Item
                  label={t.LabelReturnOf}
                  value={
                    <Link
                      colorPalette="brand"
                      fontFamily="mono"
                      onClick={() => navigate(originPath)}>
                      {originCode}
                    </Link>
                  }
                />
              )}
              {transfer.returns && transfer.returns.length > 0 && (
                <Item
                  label={t.LabelReturnTrips}
                  value={
                    <HStack gap="2" flexWrap="wrap">
                      {transfer.returns.map(r => (
                        <Link
                          key={r.id}
                          colorPalette="brand"
                          fontFamily="mono"
                          onClick={() => navigate(transferPath(r))}>
                          {r.code}
                        </Link>
                      ))}
                    </HStack>
                  }
                />
              )}
            </DataList.Root>
          </Section>

          <Section title={t.SectionSchedule}>
            <DataList.Root orientation="horizontal" size="sm">
              <Item
                label={t.LabelDate}
                value={formatDay(transfer.rideDateISO, code)}
              />
              <Item label={t.LabelTime} value={transfer.rideTime} />
              <Item
                label={t.LabelRequestedAt}
                value={formatDateTime(transfer.requestedAt, code)}
              />
              {transfer.startDateTime && (
                <Item
                  label={t.LabelStarted}
                  value={formatDateTime(transfer.startDateTime, code)}
                />
              )}
              {transfer.endDateTime && (
                <Item
                  label={t.LabelEnded}
                  value={formatDateTime(transfer.endDateTime, code)}
                />
              )}
            </DataList.Root>
          </Section>

          {/*
            The people card, dispatch.md section 13: the passenger with its
            actions, and under it the booker as one quieter line. Who the
            booker is, is decided in one place for this screen and for the
            customer's own booking detail, see components/BookedBy.
          */}
          <Section title={t.SectionPassenger}>
            {passenger || transfer.subject || booked.kind !== 'none' ? (
              <>
                <DataList.Root orientation="horizontal" size="sm">
                  <Item label={t.Passenger} value={passengerName(transfer)} />
                  {passenger?.phone && (
                    <Item
                      label={t.LabelPhone}
                      value={
                        // Read with its groups, dialled as the stored E.164,
                        // dispatch.md section 13. A row the normalisation
                        // could not decide keeps what it has and says so:
                        // guessing a country onto somebody else's number is
                        // worse than a dispatcher checking one.
                        <HStack gap="2" flexWrap="wrap">
                          {telHref(passenger.phone) ? (
                            <Link
                              href={telHref(passenger.phone)}
                              colorPalette="brand">
                              {formatPhone(passenger.phone)}
                            </Link>
                          ) : (
                            formatPhone(passenger.phone)
                          )}
                          {needsCountryCode(passenger.phone) && (
                            <Text textStyle="xs" color="fg.warning">
                              {t.PhoneCheckCountry}
                            </Text>
                          )}
                        </HStack>
                      }
                    />
                  )}
                  {passenger?.email && (
                    <Item
                      label={t.LabelEmail}
                      value={
                        // The address is data and stays selectable, and the
                        // action on it is the mail a dispatcher writes.
                        mailHref(passenger.email) ? (
                          <Link
                            href={mailHref(passenger.email)}
                            title={pw.ActionMail}
                            colorPalette="brand">
                            {passenger.email}
                          </Link>
                        ) : (
                          passenger.email
                        )
                      }
                    />
                  )}
                  {passenger?.language && (
                    <Item label={t.LabelLanguage} value={passenger.language} />
                  )}
                  <Item
                    label={t.LabelPassengers}
                    value={String(transfer.passengers.length)}
                  />
                  {transfer.passengers.length > 1 && (
                    <Item
                      label=""
                      value={transfer.passengers
                        .slice(1)
                        .map(p =>
                          `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim()
                        )
                        .filter(Boolean)
                        .join(', ')}
                    />
                  )}
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
              </>
            ) : (
              <Text textStyle="sm" color="fg.muted">
                {t.NoPassenger}
              </Text>
            )}
          </Section>

          <Section title={t.SectionRide}>
            <DataList.Root orientation="horizontal" size="sm">
              <Item
                label={t.LabelFlight}
                value={transfer.details?.flightNumber}
              />
              <Item label={t.LabelLuggage} value={transfer.details?.luggage} />
              <Item
                label={t.LabelChildSeats}
                value={transfer.details?.childSeats}
              />
              <Item
                label={t.LabelExtraTime}
                value={transfer.details?.extraTime}
              />
              <Item
                label={t.LabelCarClass}
                value={
                  enumLabel(t, 'Class_', transfer.details?.preferredCarClass) ||
                  undefined
                }
              />
              <Item
                label={t.LabelCarName}
                value={transfer.details?.preferredCarName}
              />
              <Item
                label={t.LabelCategory}
                value={
                  enumLabel(t, 'Cat_', transfer.transferCategory) || undefined
                }
              />
              <Item
                label={t.LabelType}
                value={
                  enumLabel(t, 'Type_', transfer.transferType) || undefined
                }
              />
            </DataList.Root>
          </Section>

          <Section
            title={t.SectionDriver}
            action={
              editable && (
                <HStack gap="2">
                  {canUnassign && (
                    <Button
                      size="xs"
                      variant="ghost"
                      colorPalette="red"
                      onClick={() => setUnassignOpen(true)}>
                      {t.ActionUnassign}
                    </Button>
                  )}
                  {blocked && (
                    <Badge colorPalette="gray" variant="outline" size="sm">
                      {t.ConfirmFirst}
                    </Badge>
                  )}
                  <Button
                    size="xs"
                    variant="ghost"
                    colorPalette="brand"
                    disabled={blocked}
                    title={blocked ? t.ConfirmFirst : undefined}
                    onClick={() => setAssignOpen(true)}>
                    {transfer.driverId ? t.ActionReassign : t.ActionAssign}
                  </Button>
                </HStack>
              )
            }>
            {transfer.driverId ? (
              <HStack gap="3">
                <DriverColorDot color={driver?.driverColor} size="4" />
                <Box>
                  <HStack gap="2">
                    <Text fontWeight="medium">
                      {driver ? driverDisplayName(driver) : transfer.driverId}
                    </Text>
                    <DriverAnswerBadge status={transfer.driverStatus} />
                  </HStack>
                  {driver && (
                    <Text textStyle="xs" color="fg.muted">
                      {driver.primaryEmailAddress}
                    </Text>
                  )}
                </Box>
              </HStack>
            ) : declinedId ? (
              <HStack gap="3">
                <DriverColorDot color={colorOf(declinedId)} size="4" />
                <Box>
                  <HStack gap="2">
                    <Text
                      fontWeight="medium"
                      color="fg.muted"
                      textDecoration="line-through">
                      {nameOf(declinedId)}
                    </Text>
                    <DriverAnswerBadge
                      status="DECLINED"
                      reason={
                        (transfer.attempts?.[0] ?? transfer.lastAttempt)?.reason
                      }
                    />
                  </HStack>
                  {(transfer.attempts?.[0] ?? transfer.lastAttempt)?.reason && (
                    <Text textStyle="xs" color="fg.muted">
                      {fill(t.DeclineReason, {
                        reason:
                          (transfer.attempts?.[0] ?? transfer.lastAttempt)
                            ?.reason ?? ''
                      })}
                    </Text>
                  )}
                </Box>
              </HStack>
            ) : (
              <Text textStyle="sm" color="fg.muted">
                {t.NoDriver}
              </Text>
            )}
          </Section>

          {/* Who was asked and what they said, newest first. Dispatch information, the backend answers it to admins only. */}
          {editable && transfer.attempts !== undefined && (
            <Section title={t.AttemptsTitle}>
              {transfer.attempts.length === 0 ? (
                <Text textStyle="sm" color="fg.muted">
                  {t.NoAttempts}
                </Text>
              ) : (
                <Stack gap="2" data-testid="attempts">
                  {transfer.attempts.map(a => {
                    const word = attemptWord(a)
                    return (
                      <HStack key={a.id} align="flex-start" gap="3">
                        <DriverColorDot color={colorOf(a.driverId)} size="3" />
                        <Box minW="0" flex="1">
                          <HStack gap="2" flexWrap="wrap">
                            <Text textStyle="sm" fontWeight="medium">
                              {nameOf(a.driverId)}
                            </Text>
                            <Badge
                              size="sm"
                              variant="subtle"
                              colorPalette={word.tone}>
                              {word.text}
                            </Badge>
                          </HStack>
                          <Text textStyle="xs" color="fg.muted">
                            {formatDateTime(a.requestedAt, code)}
                            {a.answeredAt && a.answer
                              ? ` → ${formatDateTime(a.answeredAt, code)}`
                              : ''}
                            {a.by
                              ? ` · ${fill(t.AttemptBy, {name: nameOf(a.by) ?? ''})}`
                              : ''}
                            {/* Who wrote the answer when the driver did not: the admin's yes on the phone. */}
                            {a.answeredBy
                              ? ` · ${fill(t.AttemptAnsweredBy, {name: nameOf(a.answeredBy) ?? ''})}`
                              : ''}
                          </Text>
                          {a.reason && (
                            <Text textStyle="xs" color="fg.muted">
                              {fill(t.DeclineReason, {reason: a.reason})}
                            </Text>
                          )}
                        </Box>
                      </HStack>
                    )
                  })}
                </Stack>
              )}
            </Section>
          )}

          <Section title={t.SectionVehicle}>
            {transfer.carId ? (
              <HStack gap="3">
                <DriverColorDot
                  color={transfer.car?.color ?? car?.color}
                  size="4"
                />
                <Box>
                  <Text fontWeight="medium">
                    {transfer.car?.carName ??
                      (car ? carDisplayName(car) : transfer.carId)}
                  </Text>
                  <Text textStyle="xs" color="fg.muted">
                    {transfer.car?.licensePlate ?? car?.licensePlate}
                    {(transfer.car?.carClass ?? car?.carClass)
                      ? ` · ${enumLabel(t, 'Class_', transfer.car?.carClass ?? car?.carClass)}`
                      : ''}
                  </Text>
                </Box>
              </HStack>
            ) : (
              <Text textStyle="sm" color="fg.muted">
                {t.NoVehicle}
              </Text>
            )}
          </Section>

          {/* Money: absent for a driver, the backend sends null and MoneyText draws nothing. */}
          <Section
            title={t.SectionMoney}
            action={
              editable && (
                <Button
                  size="xs"
                  variant="ghost"
                  colorPalette="brand"
                  onClick={() => setPriceOpen(true)}>
                  {t.ActionPrice}
                </Button>
              )
            }>
            <DataList.Root orientation="horizontal" size="sm">
              <Item
                label={t.TotalFare}
                value={
                  transfer.price != null ? (
                    <MoneyText
                      value={transfer.price}
                      fontWeight="semibold"
                      textStyle="lg"
                    />
                  ) : editable ? (
                    <Badge
                      as="button"
                      colorPalette="orange"
                      cursor="pointer"
                      onClick={() => setPriceOpen(true)}>
                      {t.SetPrice}
                    </Badge>
                  ) : undefined
                }
              />
              <Item
                label={t.PaymentLabel}
                value={
                  enumLabel(t, 'Pay_', transfer.paymentMethode) || undefined
                }
              />
              <Item
                label={t.PayingPartyLabel}
                value={
                  enumLabel(t, 'Party_', transfer.payingParty) || undefined
                }
              />
            </DataList.Root>
          </Section>

          <Section title={t.LabelCustomer}>
            <DataList.Root orientation="horizontal" size="sm">
              <Item
                label={t.LabelCustomer}
                value={customer ? driverDisplayName(customer) : undefined}
              />
              <Item
                label={t.LabelCustomerId}
                value={
                  <chakra.span fontFamily="mono">
                    {transfer.customerId}
                  </chakra.span>
                }
              />
            </DataList.Root>
          </Section>

          <ExtrasSection
            transfer={transfer}
            editable={editable}
            onChanged={onChanged}
          />

          <Section title={t.SectionNotes}>
            <Selectable
              textStyle="sm"
              whiteSpace="pre-wrap"
              color={transfer.details?.message ? 'fg.default' : 'fg.muted'}>
              {transfer.details?.message || t.NoNotes}
            </Selectable>
          </Section>
        </Box>

        {/* The money side: the customer's status as a timeline, the documents, the invoice upload. */}
        {editable && (
          <MoneySection
            transfer={transfer}
            editable={editable}
            onChanged={onChanged}
            documentsVersion={documentsVersion}
            nameOf={nameOf}
          />
        )}

        {/* Where the driver is: the dispatcher's card with the small map. */}
        {editable && (
          <DriverTrackingCard
            transferId={transfer.id}
            state={transfer.state}
            pickupAddress={transfer.pickup}
            pickupPoint={storedPoint(transfer, 'PICKUP')}
            audience="admin"
            fallback={{
              driverId: transfer.driverId,
              driverName: driver ? driverDisplayName(driver) : undefined,
              driverColor: driver?.driverColor ?? null,
              car: transfer.car
                ? {
                    carName: transfer.car.carName ?? null,
                    licensePlate: transfer.car.licensePlate ?? null,
                    carClass: transfer.car.carClass ?? null,
                    color: transfer.car.color ?? null
                  }
                : car
                  ? {
                      carName: carDisplayName(car),
                      licensePlate: car.licensePlate ?? null,
                      carClass: car.carClass ?? null,
                      color: car.color ?? null
                    }
                  : null
            }}
          />
        )}

        {editable && (
          <Text textStyle="xs" color="fg.muted">
            {t.StateCurrent}: {stateLabel(transfer.state)}
          </Text>
        )}
      </Stack>

      {editable && (
        <>
          <AssignDialog
            open={assignOpen}
            onClose={() => setAssignOpen(false)}
            transfer={transfer}
            drivers={drivers}
            cars={cars}
            onAssigned={onChanged}
          />
          <PriceDialog
            open={priceOpen}
            onClose={() => setPriceOpen(false)}
            transfer={transfer}
            onSaved={onChanged}
          />
          <OfferDialog
            open={offerOpen}
            onClose={() => setOfferOpen(false)}
            transfer={transfer}
            onSent={() => {
              // sendOffer moved the status on the pylon: the ride is read again, and the documents with it.
              setDocumentsVersion(v => v + 1)
              onRefresh()
            }}
          />
          <ConfirmBookingDialog
            open={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            transfer={transfer}
            onSaved={onChanged}
          />
          <StateDialog
            open={stateOpen}
            onClose={() => setStateOpen(false)}
            transfer={transfer}
            onSaved={onChanged}
          />
          <CreateTransferDialog
            open={returnOpen}
            onClose={() => setReturnOpen(false)}
            customers={users}
            cars={cars}
            prefill={returnTripPrefill(transfer)}
            onCreated={row => {
              // The origin now has its return, then the new leg is opened.
              onChanged({
                ...transfer,
                returns: [
                  ...(transfer.returns ?? []),
                  {id: row.id, code: row.code}
                ]
              })
              navigate(transferPath(row))
            }}
          />
          <ConfirmDialog
            open={cancelOpen}
            onClose={() => setCancelOpen(false)}
            onConfirm={cancel}
            title={t.CancelConfirmTitle}
            body={t.CancelConfirmBody}
            confirmLabel={t.ActionCancel}
            destructive
            loading={cancelling}
          />
          <ConfirmDialog
            open={unassignOpen}
            onClose={() => setUnassignOpen(false)}
            onConfirm={unassign}
            title={t.UnassignConfirmTitle}
            body={t.UnassignConfirmBody}
            confirmLabel={t.ActionUnassign}
            destructive
            loading={unassigning}
          />
        </>
      )}
    </Box>
  )
}

// ============================================================
// The screen
// ============================================================

export function TransferDetailView() {
  const {transferId} = useAppParams() as {transferId?: string}
  const caller = useCaller()
  const mobile = useIsMobile()
  const {t} = useTransferStrings()
  const navigate = useAppNavigate()
  const {transfer, isLoading, error, isFetching, notFound, refetch, replace} =
    useTransfer(transferId)
  useViewRefresh(refetch, isFetching)
  // Offline the ride is the stored answer, read again when the connection returns.
  useRefetchOnReconnect(() => void refetch())

  // The driver's phone sends its position while this ride is live. The hint
  // is the row's state, so the loop follows the slider without a round trip.
  const ownRide =
    !!transfer &&
    caller.isDriver &&
    !caller.isAdmin &&
    transfer.driverId === caller.userId
  useDriverPositionSender({
    ride:
      ownRide && transfer
        ? {transferId: transfer.id, state: transfer.state}
        : undefined
  })

  // The page's shape in grey until the ride is there, never a spinner.
  if (caller.loading || (isLoading && !transfer))
    return <DetailSkeleton cards={3} />

  if (error && !transfer) {
    return (
      <Box p="4">
        <ErrorBanner message={error} onRetry={() => void refetch()} />
      </Box>
    )
  }

  if (!transfer || notFound) {
    return (
      <EmptyState title={t.DetailNotFound} description={t.DetailNotFoundBody}>
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate('/transfers')}>
          <FaArrowLeft />
          {caller.isAdmin ? t.DetailBack : t.DetailBackMine}
        </Button>
      </EmptyState>
    )
  }

  // The phone screen with the slider: the assigned driver, below md. A
  // dispatcher who also drives sees the dispatcher's screen, the modal is
  // theirs. Somebody else's transfer never reaches a driver, the backend
  // scopes the read, but the ownership check stays as the second lock.
  // The driver's screens carry the offline banner, the dispatcher's does not,
  // no promise is made about it there.
  const banner =
    caller.isDriver && !caller.isAdmin ? <OfflineBanner m="4" mb="0" /> : null

  if (ownRide && mobile) {
    return (
      <>
        {banner}
        <DriverRideScreen transfer={transfer} onChanged={replace} />
      </>
    )
  }

  return (
    <>
      {banner}
      <DetailScreen
        transfer={transfer}
        editable={caller.isAdmin}
        onChanged={replace}
        onRefresh={() => void refetch()}
      />
    </>
  )
}

/**
 * The map of where everybody is, for the dispatcher, and the map of the
 * customer's own drivers.
 *
 * The map itself, its filter chips and the detail sheet are the components
 * under ../components/locations. This view is the frame around them: it
 * gives the map the full height of the screen below the sticky bars, says
 * out loud when the read failed, and decorates every driver row with the
 * driver's colour and name before the map draws it. The backend answers a
 * driver with their own position only, so that map is theirs alone.
 *
 * A customer gets a different screen on the same route: one map with the
 * driver of every own ride that is under way (ON_THE_WAY, AT_PICKUP or
 * ONGOING), read through transferTracking per booking, the marker in the
 * driver's colour with the plate and the code beside it, the pickup pin,
 * refreshed every ten seconds while the tab is open, and under the map the
 * accepted rides that wait for their driver to leave, "unterwegs ab hh:mm".
 * Nothing of other customers can appear, the reads are scoped by the token
 * (customer-experience.md, section 2).
 *
 * The colours come from getDriverColor, one call per driver, cached for the
 * tab. The names come from the driver directory, which only an admin may
 * read, so a driver looking at their own dot sees their id and no name.
 */
import {useMemo} from 'react'
import {Box, Flex, HStack, Skeleton, Stack, Text} from '@chakra-ui/react'
import {FaMapMarkerAlt} from '@react-icons/all-files/fa/FaMapMarkerAlt'
import {useCaller} from '../auth'
import {useDrivers, useLocations, type ResourceUser} from '../hooks'
import {
  useCustomerActiveTracking,
  useDriverColors,
  useGeocodes,
  type CustomerLiveRide,
  type CustomerRide
} from '../hooks/tracking'
import {
  LocationsTab,
  TrackingMap,
  mapboxToken,
  type LocationRow,
  type TrackingMapMarker,
  type TrackingMapPin
} from '../components/locations'
import {
  CarImage,
  DriverColorDot,
  EmptyState,
  ErrorBanner,
  PageHeader,
  RefreshButton,
  useStateLabel
} from '../components'
import {useViewRefresh} from '../hooks/view-refresh'
import {useI18nCode, type I18nCode} from '../i18n'
import {getI18nCommon} from '../locales/i18nCommon'
import {fillTracking, getI18nTracking} from '../locales/i18nTracking'

/**
 * The directory is an admin read, so the hook that asks for it is only
 * mounted for an admin: a driver looking at their own dot would otherwise
 * send a request the backend refuses on every visit.
 */
const NOBODY: ResourceUser[] = []

/**
 * The screen between the frame's bar and the tab bar. The shell declares the
 * variable on the element that carries the tab bar's clearance
 * (src/components/AppShell.tsx), the fallback is a screen without the bar.
 */
const APP_VIEW_H = 'var(--app-view-h, calc(100dvh - 4rem))'

export function LocationsView() {
  const caller = useCaller()
  if (caller.loading) return <LocationsSkeleton />
  if (caller.isAdmin) return <AdminLocations />
  // A driver who also books rides is a driver here: their own dot, as
  // before. A customer gets the drivers of their own rides.
  if (!caller.isDriver && caller.isCustomer) return <CustomerLocations />
  return <Locations drivers={NOBODY} />
}

/** The frame with its heading and the map's place in grey until the roles are known. */
function LocationsSkeleton() {
  const code = useI18nCode()
  const tc = getI18nCommon(code).strings
  return (
    <Flex
      direction="column"
      h={APP_VIEW_H}
      maxW="full"
      overflow="hidden"
      data-view="locations"
      data-skeleton="map"
      aria-busy="true">
      <Box px={{base: '4', md: '6'}} pt={{base: '4', md: '6'}} pb="4">
        <PageHeader title={tc.NavLocations} />
      </Box>
      <Skeleton flex="1" minH="0" rounded="0" />
    </Flex>
  )
}

function AdminLocations() {
  const {drivers} = useDrivers()
  return <Locations drivers={drivers} />
}

function Locations({drivers}: {drivers: ResourceUser[]}) {
  const code = useI18nCode()
  const tc = getI18nCommon(code).strings
  const {locations, isLoading, error, isFetching, refetch} = useLocations()
  // Registered for the map's refresh button; the pull is off on this screen.
  useViewRefresh(refetch, isFetching)

  const driverIds = useMemo(
    () =>
      Array.from(
        new Set(locations.filter(l => l.kind === 'driver').map(l => l.userId))
      ),
    [locations]
  )
  const colors = useDriverColors(driverIds)

  const rows = useMemo<LocationRow[]>(
    () =>
      locations.map(l => {
        if (l.kind !== 'driver') return l
        const person = drivers.find(d => d.id === l.userId)
        const name = person
          ? `${person.details?.firstName ?? ''} ${person.details?.lastName ?? ''}`.trim() ||
            person.username
          : undefined
        return {...l, color: colors[l.userId] ?? person?.driverColor, name}
      }),
    [locations, colors, drivers]
  )

  return (
    // The view is the screen between the frame's bar and the tab bar, the
    // header row on top and the map filling the rest, and the page itself
    // never scrolls (design-consistency.md, rule 12). No minimum height: one
    // that is taller than the screen would be exactly the scroll the rule
    // forbids, so the map shrinks with a short screen instead.
    <Flex
      direction="column"
      h={APP_VIEW_H}
      maxW="full"
      overflow="hidden"
      data-view="locations">
      <Box
        px={{base: '4', md: '6'}}
        pt={{base: '4', md: '6'}}
        pb="4"
        flexShrink="0"
        data-locations-header="">
        <PageHeader title={tc.NavLocations} />
      </Box>
      <Box
        position="relative"
        flex="1"
        minH="0"
        overflow="hidden"
        bg="bg.canvas">
        {error && (
          <Box position="absolute" top="3" insetX="3" zIndex="docked">
            <ErrorBanner message={error} onRetry={refetch} />
          </Box>
        )}
        <LocationsTab
          locations={rows}
          isLoading={isLoading}
          error={error}
          onRefresh={refetch}
        />
      </Box>
    </Flex>
  )
}

// --------------- The customer's map ---------------

/** The map's height on the customer's screen: most of the viewport, never more than the page needs. */
const CUSTOMER_MAP_HEIGHT = 'min(60dvh, 36rem)'

/**
 * hh:mm in the account's language for a pickup today, the day in front of
 * it otherwise, so "unterwegs ab 09:00" is never tomorrow's nine o'clock
 * read as today's.
 */
const formatPickupClock = (iso: string | null, code: I18nCode): string => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const sameDay = d.toDateString() === new Date().toDateString()
  try {
    return new Intl.DateTimeFormat(
      code,
      sameDay
        ? {hour: '2-digit', minute: '2-digit'}
        : {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}
    ).format(d)
  } catch {
    return d.toTimeString().slice(0, 5)
  }
}

/** The words beside a marker: the plate and the code, whichever are known. */
const markerLabel = (r: CustomerLiveRide): string =>
  [r.tracking?.car?.licensePlate ?? r.ride.licensePlate, r.ride.code]
    .filter(Boolean)
    .join(' · ')

function CustomerLocations() {
  const code = useI18nCode()
  const tc = getI18nCommon(code).strings
  const {strings: t} = getI18nTracking(code)
  const token = mapboxToken()
  const stateLabel = useStateLabel()

  const {live, accepted, isLoading, error, isFetching, refetch} =
    useCustomerActiveTracking()
  // The refresh button in the header refetches the rides and every position at once.
  useViewRefresh(refetch, isFetching)

  // One pin per ride under way, at the pickup the tracking answer names, or
  // the one the ride carries until the answer lands.
  const addresses = useMemo(
    () => live.map(r => r.tracking?.pickupLocation ?? r.ride.pickupLocation),
    [live]
  )
  const points = useGeocodes(addresses, token)

  const pins = useMemo<TrackingMapPin[]>(
    () =>
      live.flatMap((r, i) => {
        const p = points[i]
        return p ? [{id: r.ride.id, lng: p.lng, lat: p.lat}] : []
      }),
    [live, points]
  )
  const markers = useMemo<TrackingMapMarker[]>(
    () =>
      live.flatMap(r => {
        const loc = r.tracking?.location
        if (!loc) return []
        return [
          {
            id: r.ride.id,
            lng: loc.lng,
            lat: loc.lat,
            color: r.tracking?.driver?.color ?? null,
            accuracy: loc.accuracy ?? null,
            label: markerLabel(r)
          }
        ]
      }),
    [live]
  )

  const nothingYet = isLoading && live.length === 0 && accepted.length === 0
  const caption =
    live.length === 1
      ? t.LiveRidesOne
      : fillTracking(t.LiveRidesMany, {count: live.length})

  return (
    // The customer's half of the screen is the same frame: the header row on
    // top, the rest of the screen below it, and the page never scrolls. What
    // scrolls is the box the map and the ride cards sit in, so a customer
    // with several rides reaches them all without the document growing past
    // the viewport (design-consistency.md, rule 12).
    <Flex
      direction="column"
      h={APP_VIEW_H}
      maxW="full"
      overflow="hidden"
      data-view="customer-locations">
      <Box
        px={{base: '4', md: '6'}}
        pt={{base: '4', md: '6'}}
        flexShrink="0"
        data-locations-header="">
        <PageHeader
          title={tc.NavLocations}
          subtitle={t.CustomerSubtitle}
          actions={<RefreshButton />}
        />
      </Box>
      <Stack
        gap="4"
        flex="1"
        minH="0"
        overflowY="auto"
        px={{base: '4', md: '6'}}
        pt="4"
        pb={{base: '4', md: '6'}}>
        {error && <ErrorBanner message={error} onRetry={refetch} />}

        {nothingYet ? (
          <Skeleton
            h={CUSTOMER_MAP_HEIGHT}
            rounded="surface"
            data-skeleton="map"
          />
        ) : live.length > 0 ? (
          <TrackingMap
            pickups={pins}
            drivers={markers}
            height={CUSTOMER_MAP_HEIGHT}
            caption={caption}
          />
        ) : (
          <EmptyState
            title={t.NoRideUnderway}
            description={t.NoRideUnderwayHint}
            icon={<FaMapMarkerAlt />}
            data-empty="locations"
          />
        )}

        {live.length > 0 && (
          <Stack gap="2" role="list" data-rides="underway">
            {live.map(r => (
              <UnderwayRow key={r.ride.id} entry={r} stateLabel={stateLabel} />
            ))}
          </Stack>
        )}

        {accepted.length > 0 && (
          <Box>
            <Text textStyle="sm" fontWeight="medium" color="fg.muted" mb="2">
              {t.AcceptedRides}
            </Text>
            <Stack gap="2" role="list" data-rides="accepted">
              {accepted.map(r => (
                <AcceptedRow
                  key={r.id}
                  ride={r}
                  clock={formatPickupClock(r.pickupAtISO, code)}
                />
              ))}
            </Stack>
          </Box>
        )}
      </Stack>
    </Flex>
  )
}

/** A ride the driver is on the road for: the code, the driver, the plate and the state. */
function UnderwayRow({
  entry,
  stateLabel
}: {
  entry: CustomerLiveRide
  stateLabel: (s: string) => string
}) {
  const code = useI18nCode()
  const {strings: t} = getI18nTracking(code)
  const plate = entry.tracking?.car?.licensePlate ?? entry.ride.licensePlate
  const driverName = entry.tracking?.driver?.name
  const state = entry.tracking?.state ?? entry.ride.state
  // The car's picture on the ride's card, media.md. The tracking answer
  // carries no picture, so it comes from the ride's own car, which the
  // pylon answers to a customer only once the driver said yes.
  const car = {
    licensePlate: plate,
    carClass: entry.tracking?.car?.carClass ?? entry.ride.carClass,
    imageThumbUrl: entry.ride.carImageThumbUrl
  }
  return (
    <HStack
      role="listitem"
      data-ride-row={entry.ride.code}
      gap="3"
      p="3"
      borderWidth="1px"
      borderColor="border.default"
      rounded="surface"
      bg="bg.surface"
      align="flex-start">
      <DriverColorDot
        color={entry.tracking?.driver?.color}
        size="3.5"
        mt="1.5"
      />
      <CarImage car={car} size={48} alt={plate ?? ''} />
      <Box minW="0" flex="1">
        <HStack gap="2" flexWrap="wrap">
          <Text fontFamily="mono" fontWeight="semibold" letterSpacing="wider">
            {entry.ride.code}
          </Text>
          {plate && (
            <Text fontFamily="mono" fontWeight="semibold" letterSpacing="wider">
              {plate}
            </Text>
          )}
          <Text color="fg.muted">{stateLabel(state)}</Text>
        </HStack>
        <Text textStyle="sm" color="fg.muted" truncate>
          {[driverName, entry.ride.pickupLocation].filter(Boolean).join(' · ')}
        </Text>
        {entry.error && (
          <Text textStyle="xs" color="fg.error">
            {t.TrackingUnavailable}
          </Text>
        )}
      </Box>
    </HStack>
  )
}

/** An accepted ride that waits for its driver to leave: "unterwegs ab hh:mm". */
function AcceptedRow({ride, clock}: {ride: CustomerRide; clock: string}) {
  const code = useI18nCode()
  const {strings: t} = getI18nTracking(code)
  return (
    <HStack
      role="listitem"
      data-ride-row={ride.code}
      gap="3"
      p="3"
      borderWidth="1px"
      borderColor="border.default"
      rounded="surface"
      bg="bg.surface"
      align="flex-start">
      <Box minW="0" flex="1">
        <HStack gap="2" flexWrap="wrap">
          <Text fontFamily="mono" fontWeight="semibold" letterSpacing="wider">
            {ride.code}
          </Text>
          <Text>{fillTracking(t.UnderwayFrom, {time: clock})}</Text>
        </HStack>
        {ride.pickupLocation && (
          <Text textStyle="sm" color="fg.muted" truncate>
            {ride.pickupLocation}
          </Text>
        )}
      </Box>
    </HStack>
  )
}

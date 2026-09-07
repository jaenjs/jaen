/**
 * "Wo die Limousine ist", the map of the public ride page.
 *
 * Section 7 of okf/architecture/customer-experience.md, the owner's second
 * sentence: the link exists "um checken zu koennen wo sich die limousine
 * befindet". The page behind /fahrt/<token> shows the ride's details, and
 * under them this map: the pickup pin, the destination pin, and from
 * ON_THE_WAY to ONGOING the driver's own marker in their colour, with the
 * card under it carrying the car's cover picture, its name and its plate, so
 * the person waiting at the door recognises the car that is coming.
 *
 * It is the map of section 2, `TrackingMap`, with a second pin: one map
 * component draws every position this app shows, in the app and on the
 * public page alike, so a fix to the camera or the marker is one edit.
 *
 * Three things are deliberately not the app's way here, because the page is
 * public and has no session:
 *
 *   - The read is `rideTrackingByToken(args:{token})`, which takes the
 *     link's own token and no bearer, and it answers null unless the ride is
 *     ON_THE_WAY, AT_PICKUP or ONGOING.
 *   - It polls itself rather than through a TanStack query. The app's hooks
 *     need the QueryClientProvider that `AppWrapper` mounts under /app, and
 *     the ride page is a site page outside it. The behaviour is the hooks':
 *     every ten seconds from the ride's assignment until it is over, paused
 *     while the tab is hidden and read at once when it comes back, so a page
 *     that was already open when the driver set off draws the car without a
 *     reload.
 *   - Its words come from the booking's language, which the summary carries,
 *     not from the visitor's: the same catalogue the app's tracking uses
 *     (shared/locales/i18nTracking.ts), picked by the `language` prop.
 *
 * The height is fixed, so the map never pushes the details of the ride off
 * the screen while it loads, and the frame is the same on the phone and on
 * the desktop.
 */
import {useEffect, useMemo, useRef, useState} from 'react'
import {Box, Flex, Image, Stack, Text} from '@chakra-ui/react'

import type {I18nCode} from '../../i18n'
import {geocodeAddress, type LngLat} from '../../hooks/tracking'
import {
  formatAge,
  fillTracking,
  getI18nTracking
} from '../../locales/i18nTracking'
import {TrackingMap} from '../locations/TrackingMap'
import {mapboxToken} from '../locations/mapbox-token'

declare const __JAEN_APP_PYLON_URL__: string | undefined

/** The three states in which the pylon answers a position at all. */
export const RIDE_UNDERWAY_STATES = ['ON_THE_WAY', 'AT_PICKUP', 'ONGOING']

/**
 * The states a ride passes through before the driver sets off. A page opened
 * in one of them must poll all the same: the promise of section 7 is that the
 * customer sees the limousine set off on the page they already have open, and
 * the ride's state is read from `rideByToken` once, at load, so a gate on that
 * state alone leaves such a page following nobody until it is reloaded. That
 * was the one measured gap of the live reading on 2026-09-07.
 */
export const RIDE_PENDING_STATES = ['PENDING', 'ASSIGNED']

const upper = (state: string | null | undefined): string =>
  String(state ?? '').toUpperCase()

export const isRideUnderway = (state: string | null | undefined): boolean =>
  RIDE_UNDERWAY_STATES.includes(upper(state))

/**
 * Whether the position is still worth asking for. True while the ride is under
 * way and while it may yet become so; false for the seven states a ride never
 * leaves again (REJECTED, ABORTED, NO_SHOW, FAILED, CANCELED, TERMINATED,
 * COMPLETED), so a page left open on a finished ride stops asking.
 */
export const isRideFollowable = (state: string | null | undefined): boolean =>
  isRideUnderway(state) || RIDE_PENDING_STATES.includes(upper(state))

/** The booking's language as the app's catalogues name it. */
const CODES: Record<string, I18nCode> = {
  de: 'de-AT',
  en: 'en-US',
  tr: 'tr-TR',
  ar: 'ar-EG'
}

/** The car as the marker's card shows it: the cover picture, the name, the plate. */
export interface RideMapCar {
  carName?: string | null
  licensePlate?: string | null
  imageUrl?: string | null
  imageThumbUrl?: string | null
}

export interface RideMapPosition {
  lat: number
  lng: number
  accuracy: number | null
  recordedAt: string | null
}

export interface RideMapProps {
  /** The link's own token, the only credential the page holds. */
  token: string
  /** The ride's state as the summary answered it, so the map renders right before the first read. */
  state: string
  /** The addresses as booked, geocoded for the two pins. */
  pickupAddress?: string | null
  dropoffAddress?: string | null
  /** de | en | tr | ar, the booking's language. */
  language?: string
  /** The card under the map, once the driver said yes. */
  car?: RideMapCar | null
  /** The marker's colour, until the pylon answers the driver's own. */
  driverColor?: string | null
  /** The site's own pylon address. The plugin's define is the fallback. */
  pylonUrl?: string
  pollMs?: number
  height?: string
}

export const RIDE_TRACKING_POLL_MS = 10_000

const TRACKING_SELECTION =
  '{ state driverColor location { lat lng accuracy recordedAt } }'

const number = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

const text = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v : null

interface RideTracking {
  state: string
  driverColor: string | null
  location: RideMapPosition | null
}

const mapTracking = (node: any): RideTracking | null => {
  if (!node) return null
  const lat = number(node.location?.lat)
  const lng = number(node.location?.lng)
  return {
    state: String(node.state ?? ''),
    driverColor: text(node.driverColor),
    location:
      lat !== null && lng !== null
        ? {
            lat,
            lng,
            accuracy: number(node.location?.accuracy),
            recordedAt: text(node.location?.recordedAt)
          }
        : null
  }
}

const endpoint = (given?: string): string => {
  if (given) return given
  // A define is read as a bare identifier, never off globalThis: see
  // okf/decisions/hard-rules.md.
  const defined =
    typeof __JAEN_APP_PYLON_URL__ !== 'undefined' ? __JAEN_APP_PYLON_URL__ : ''
  return defined || 'https://api.limosen.at/graphql'
}

/**
 * One read of the position behind the link. A refusal and a transport
 * failure are both answered as null: the map then draws the route without a
 * car, which is what it shows before the ride anyway, and the page says
 * nothing alarming about a poll that missed.
 */
const readTracking = async (
  token: string,
  url: string
): Promise<RideTracking | null> => {
  const document = `query { rideTrackingByToken(args: {token: ${JSON.stringify(
    token
  )}}) ${TRACKING_SELECTION} }`
  const response = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({query: document})
  })
  const payload: any = await response.json()
  if (payload?.errors?.length) {
    // Swallowed on purpose (hard-rules.md): a deployment whose schema has no
    // rideTrackingByToken yet, and a token the pylon refuses, both leave the
    // map without a car rather than putting an error on a customer's page.
    console.warn(
      'ride map: no position,',
      payload.errors[0]?.message ?? 'the pylon refused'
    )
    return null
  }
  return mapTracking(payload?.data?.rideTrackingByToken)
}

/** A one second clock, only while a position is on the screen and ageing. */
const useNow = (running: boolean): number => {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(id)
  }, [running])
  return now
}

/** One address as a point, asked once per address while there is a map to put it on. */
const useGeocoded = (address: string | null | undefined, token: string) => {
  const [point, setPoint] = useState<LngLat | null>(null)
  const key = (address ?? '').trim()
  useEffect(() => {
    if (!key || !token) {
      setPoint(null)
      return
    }
    let alive = true
    void geocodeAddress(key, token)
      .then(found => {
        if (alive) setPoint(found)
      })
      .catch(error => {
        // The pin is a decoration on a map that still shows the car: an
        // address the geocoder does not know leaves the map without it, the
        // same gap section 2 records.
        console.warn('ride map: the address was not found', key, error)
      })
    return () => {
      alive = false
    }
  }, [key, token])
  return point
}

export function RideMap({
  token,
  state,
  pickupAddress,
  dropoffAddress,
  language,
  car,
  driverColor,
  pylonUrl,
  pollMs = RIDE_TRACKING_POLL_MS,
  height = '18rem'
}: RideMapProps) {
  const code =
    CODES[
      String(language ?? 'de')
        .slice(0, 2)
        .toLowerCase()
    ] ?? 'de-AT'
  const {strings: t} = getI18nTracking(code)
  const mapToken = mapboxToken()
  const url = endpoint(pylonUrl)

  const [tracking, setTracking] = useState<RideTracking | null>(null)
  const held = useRef<RideTracking | null>(null)

  const pickup = useGeocoded(pickupAddress, mapToken)
  const dropoff = useGeocoded(dropoffAddress, mapToken)

  const underway = isRideUnderway(tracking?.state ?? state)

  /**
   * Set once the ride has been seen under way and then answered null again:
   * the pylon answers the whole tracking null outside ON_THE_WAY, AT_PICKUP
   * and ONGOING, so a non-null answer followed by a null one is the ride
   * ending under the open page, and there is nothing left to ask for.
   */
  const [over, setOver] = useState(false)

  // The poll: every `pollMs` while the ride may still be followed and the tab
  // is visible, one read at once when the tab comes back. It runs from the
  // ride's assignment on rather than from its departure, so a page that was
  // already open when the driver set off draws the car without a reload, and
  // it stops once the ride is over or was over when the page loaded.
  useEffect(() => {
    if (!token || over || !isRideFollowable(state)) {
      setTracking(null)
      held.current = null
      return
    }
    let alive = true

    const read = () => {
      void readTracking(token, url)
        .then(answer => {
          if (!alive) return
          // The ride ended while this page was open: the last answer carried a
          // state, this one carries nothing at all.
          if (!answer && held.current) setOver(true)
          held.current = answer
          setTracking(answer)
        })
        .catch(error => {
          // A poll that missed keeps the last position rather than clearing
          // the map: the customer is watching a car, not a network.
          console.warn('ride map: the position could not be read', error)
        })
    }

    read()
    const id = window.setInterval(
      () => {
        if (
          typeof document === 'undefined' ||
          document.visibilityState === 'visible'
        )
          read()
      },
      Math.max(2_000, pollMs)
    )
    const onVisible = () => {
      if (document.visibilityState === 'visible') read()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      alive = false
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [token, state, url, pollMs, over])

  const position = underway ? (tracking?.location ?? null) : null
  const recordedAtMs = useMemo(() => {
    if (!position?.recordedAt) return null
    const ms = new Date(position.recordedAt).getTime()
    return Number.isNaN(ms) ? null : ms
  }, [position?.recordedAt])
  const now = useNow(!!recordedAtMs)
  const age =
    recordedAtMs === null
      ? null
      : fillTracking(t.PositionAge, {
          age: formatAge(t, Math.max(0, now - recordedAtMs))
        })

  const cover = car?.imageThumbUrl || car?.imageUrl || null
  const hint = !underway
    ? t.RideNotUnderway
    : position
      ? null
      : t.RideWaitingForPosition

  return (
    <Stack
      gap="3"
      data-testid="ride-map"
      data-ride-state={tracking?.state ?? state}>
      <Text fontWeight="semibold">{t.RideWhereTitle}</Text>

      <TrackingMap
        code={code}
        height={height}
        pickup={pickup}
        destination={dropoff}
        driver={
          position
            ? {
                lng: position.lng,
                lat: position.lat,
                color: tracking?.driverColor ?? driverColor ?? null,
                accuracy: position.accuracy
              }
            : null
        }
        caption={age}
      />

      {/*
        The marker's card: what is driving towards the dot on the map. It
        carries the car's cover picture (okf/architecture/media.md), the name
        and the plate, and it appears with the position, so nothing on this
        page promises a car before the driver said yes.
      */}
      {position && (car?.licensePlate || cover) && (
        <Flex
          gap="3"
          align="center"
          minW="0"
          borderWidth="1px"
          borderColor="border.default"
          rounded="surface"
          p="2"
          data-testid="ride-map-card">
          {cover && (
            <Image
              src={cover}
              alt={car?.licensePlate ?? ''}
              w="20"
              h="14"
              rounded="sm"
              objectFit="cover"
              flexShrink="0"
              data-testid="ride-map-cover"
            />
          )}
          <Box minW="0" flex="1">
            {car?.carName && (
              <Text fontWeight="semibold" lineClamp={1}>
                {car.carName}
              </Text>
            )}
            {car?.licensePlate && (
              <Text
                fontFamily="mono"
                fontWeight="semibold"
                letterSpacing="wider"
                dir="ltr">
                {car.licensePlate}
              </Text>
            )}
          </Box>
          <Flex
            gap="1.5"
            align="center"
            flexShrink="0"
            color="fg.muted"
            textStyle="xs">
            <Box
              w="2"
              h="2"
              rounded="full"
              bg="green.500"
              data-testid="ride-map-live"
            />
            <Text>{t.RideLive}</Text>
          </Flex>
        </Flex>
      )}

      {hint && (
        <Text textStyle="sm" color="fg.muted" data-testid="ride-map-hint">
          {hint}
        </Text>
      )}
    </Stack>
  )
}

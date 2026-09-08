/**
 * "Where the driver is": the card on a booking and on a transfer.
 *
 * Once a driver is assigned it shows the driver's name with their colour
 * dot and the car's plate, model, class and colour, and under it the small
 * map with the pickup pin and the driver's dot, polled every ten seconds
 * while the ride is live, with the position's age ("vor 20 s") under the
 * map. Before assignment it is one calm line. After the ride it is the
 * driver and the car and no map, the position is gone from the backend's
 * answer then anyway.
 *
 * The customer and the dispatcher see the same card under a different
 * title. What either may read is the resolver's decision, not this
 * component's: a refusal is shown as the backend spelled it.
 */
import {useEffect, useMemo, useState} from 'react'
import {
  Box,
  Card,
  DataList,
  HStack,
  Spinner,
  Stack,
  Text
} from '@chakra-ui/react'
import {useI18nCode} from '../../i18n'
import {
  getI18nTracking,
  fillTracking,
  formatAge
} from '../../locales/i18nTracking'
import {getI18nTransfers} from '../../locales/i18nTransfers'
import {
  isTracked,
  useGeocode,
  useTransferTracking,
  DEFAULT_TRACKING_POLL_MS
} from '../../hooks/tracking'
import {isClosed} from '../../hooks/transfers'
import {DriverColorDot} from '../DriverColor'
import {ErrorBanner} from '../ErrorBanner'
import {TrackingMap} from './TrackingMap'
import {mapboxToken} from './mapbox-token'

export interface DriverTrackingCardProps {
  transferId: string
  /** The state the screen already knows, so the card renders right before the first poll. */
  state: string
  /** The pickup as typed, geocoded for the pin. The tracking answer's own wins when present. */
  pickupAddress?: string | null
  /**
   * The coordinates the pylon worked out for the pickup
   * (okf/architecture/dispatch.md section 14.2). Given, the pin is drawn from
   * them and no geocoder is asked; the address stays the fallback for a ride
   * resolved before the columns existed.
   */
  pickupPoint?: {lng: number; lat: number} | null
  /** Whose screen this is. Changes the title and nothing else. */
  audience: 'customer' | 'admin'
  /** What the screen already holds, shown while the tracking read is out or missing. */
  fallback?: {
    driverId?: string
    driverName?: string
    driverColor?: string | null
    car?: {
      licensePlate?: string | null
      carName?: string | null
      carClass?: string | null
      color?: string | null
    } | null
  }
  pollMs?: number
}

/** A one second clock, only while something on the screen is ageing. */
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

export function DriverTrackingCard({
  transferId,
  state,
  pickupAddress,
  pickupPoint,
  audience,
  fallback,
  pollMs = DEFAULT_TRACKING_POLL_MS
}: DriverTrackingCardProps) {
  const code = useI18nCode()
  const {strings: t} = getI18nTracking(code)
  const {strings: tt} = getI18nTransfers(code)
  const token = mapboxToken()

  const {tracking, isLoading, error, unavailable, live} = useTransferTracking(
    transferId,
    pollMs
  )

  const effectiveState = tracking?.state ?? state
  const tracked = isTracked(effectiveState)
  const driverName = tracking?.driver?.name || fallback?.driverName || ''
  const driverColor = tracking?.driver?.color ?? fallback?.driverColor ?? null
  const hasDriver = !!(
    tracking?.driver ||
    fallback?.driverId ||
    fallback?.driverName
  )
  const car = tracking?.car ?? fallback?.car ?? null

  const address = tracking?.pickupLocation ?? pickupAddress ?? null
  // The pin is only worth a geocoder call while there is a map to put it on,
  // and it is worth none at all once the pylon has worked the address out.
  const geocode = useGeocode(
    tracked && hasDriver && !pickupPoint ? address : null,
    token
  )
  const pickupPin = pickupPoint ?? geocode.point

  const location = tracked ? (tracking?.location ?? null) : null
  const recordedAtMs = useMemo(() => {
    const iso = location?.recordedAt
    if (!iso) return null
    const ms = new Date(iso).getTime()
    return Number.isNaN(ms) ? null : ms
  }, [location?.recordedAt])
  const now = useNow(!!recordedAtMs && live)

  const classLabel = (cls: string | null | undefined): string | undefined => {
    if (!cls) return undefined
    const key = `Class_${cls}` as keyof typeof tt
    return (tt[key] as string | undefined) ?? cls.replace(/_/g, ' ')
  }

  const title = audience === 'admin' ? t.CardTitleAdmin : t.CardTitleCustomer

  // A ride that ended without ever getting a driver has nothing to say here.
  if (!hasDriver && isClosed(effectiveState)) return null

  const caption = (() => {
    if (!tracked) return null
    if (recordedAtMs)
      return fillTracking(t.PositionAge, {
        age: formatAge(t, now - recordedAtMs)
      })
    if (isLoading) return t.Updating
    return t.NoPositionYet
  })()

  return (
    <Card.Root variant="outline" bg="bg.surface">
      <Card.Header>
        <HStack justify="space-between">
          <Card.Title>{title}</Card.Title>
          {isLoading && tracked && <Spinner size="xs" color="fg.muted" />}
        </HStack>
      </Card.Header>
      <Card.Body gap="4">
        {error && !unavailable && (
          <ErrorBanner title={t.TrackingUnavailable} message={error} />
        )}

        {!hasDriver ? (
          <Box>
            <Text fontWeight="medium">{t.NotAssignedYet}</Text>
            <Text textStyle="sm" color="fg.muted">
              {t.NotAssignedYetHint}
            </Text>
          </Box>
        ) : (
          <Stack gap="4">
            <DataList.Root orientation="horizontal" size="md">
              <DataList.Item>
                <DataList.ItemLabel>{t.DriverLabel}</DataList.ItemLabel>
                <DataList.ItemValue>
                  <HStack gap="2">
                    <DriverColorDot color={driverColor} size="3.5" />
                    <Text fontWeight="medium">{driverName || tt.NoDriver}</Text>
                  </HStack>
                </DataList.ItemValue>
              </DataList.Item>
              {car ? (
                <>
                  <DataList.Item>
                    <DataList.ItemLabel>{t.CarLabel}</DataList.ItemLabel>
                    <DataList.ItemValue>
                      <HStack gap="2">
                        <DriverColorDot color={car.color} size="3.5" />
                        <Text fontWeight="medium">
                          {[car.carName, classLabel(car.carClass)]
                            .filter(Boolean)
                            .join(' · ') || t.NoCarYet}
                        </Text>
                      </HStack>
                    </DataList.ItemValue>
                  </DataList.Item>
                  {car.licensePlate && (
                    <DataList.Item>
                      <DataList.ItemLabel>{t.PlateLabel}</DataList.ItemLabel>
                      <DataList.ItemValue>
                        <Text
                          fontFamily="mono"
                          fontWeight="semibold"
                          letterSpacing="wider">
                          {car.licensePlate}
                        </Text>
                      </DataList.ItemValue>
                    </DataList.Item>
                  )}
                </>
              ) : (
                <DataList.Item>
                  <DataList.ItemLabel>{t.CarLabel}</DataList.ItemLabel>
                  <DataList.ItemValue>
                    <Text color="fg.muted">{t.NoCarYet}</Text>
                  </DataList.ItemValue>
                </DataList.Item>
              )}
            </DataList.Root>

            {tracked && (
              <Box>
                <TrackingMap
                  pickup={pickupPin}
                  driver={
                    location
                      ? {
                          lng: location.lng,
                          lat: location.lat,
                          color: driverColor,
                          accuracy: location.accuracy
                        }
                      : null
                  }
                  caption={caption}
                />
                {!location && !isLoading && !unavailable && (
                  <Text textStyle="xs" color="fg.muted" mt="1">
                    {t.NoPositionHint}
                  </Text>
                )}
                {geocode.error && (
                  <Text textStyle="xs" color="fg.muted" mt="1">
                    {t.GeocodeFailed}
                  </Text>
                )}
                {unavailable && (
                  <Text textStyle="xs" color="fg.muted" mt="1">
                    {t.TrackingUnavailable}
                  </Text>
                )}
              </Box>
            )}
          </Stack>
        )}
      </Card.Body>
    </Card.Root>
  )
}

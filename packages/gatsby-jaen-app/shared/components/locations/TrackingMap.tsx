/**
 * One pickup pin and one driver marker, on a small map.
 *
 * Drawn under the "where is the driver" card on a booking and on a
 * transfer. The pickup is a pin, the driver is a dot in the driver's colour
 * with a soft ring, and the camera fits both once and then only follows
 * the driver when they leave the frame, so the person reading it is not
 * yanked about every ten seconds.
 *
 * The three ways a map fails are each said inline in the map's own frame:
 * no token configured, mapbox-gl not loadable, the token rejected. None of
 * them is a spinner.
 */
import {useEffect, useRef, useState} from 'react'
import {Box, Center, HStack, Spinner, Text} from '@chakra-ui/react'
import {useColorMode} from 'jaen'
import {useI18nCode} from '../../i18n'
import {getI18nTracking} from '../../locales/i18nTracking'
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  loadMapbox,
  mapStyleFor,
  mapboxToken,
  markerColorFor
} from './mapbox-token'
import {attachMapControls} from './map-controls'

export interface TrackingMapPoint {
  lng: number
  lat: number
}

export interface TrackingMapDriver extends TrackingMapPoint {
  /** The driver's hex, silver or empty draws grey. */
  color?: string | null
  /** Metres, drawn as a faint circle when known. */
  accuracy?: number | null
}

export interface TrackingMapProps {
  pickup?: TrackingMapPoint | null
  driver?: TrackingMapDriver | null
  /** The frame's height, a token or a length. Default 18rem. */
  height?: string
  /** Under the map, right aligned: the position's age, say. */
  caption?: React.ReactNode
}

/** The driver's dot, as an element mapbox can carry. */
const buildDriverElement = (color: string): HTMLDivElement => {
  const el = document.createElement('div')
  el.style.cssText = 'position:relative;width:22px;height:22px;pointer-events:none'
  const ring = document.createElement('div')
  ring.style.cssText =
    'position:absolute;inset:-9px;border-radius:50%;opacity:.35;' +
    `background:${color};animation:limosen-pulse 2s ease-out infinite`
  const dot = document.createElement('div')
  dot.style.cssText =
    'position:absolute;inset:0;border-radius:50%;border:3px solid #fff;' +
    `background:${color};box-shadow:0 1px 6px rgba(0,0,0,.35)`
  el.append(ring, dot)
  return el
}

const PULSE_KEYFRAMES = '@keyframes limosen-pulse{0%{transform:scale(.6);opacity:.5}100%{transform:scale(1.6);opacity:0}}'

const inBounds = (map: any, p: TrackingMapPoint): boolean => {
  try {
    return map.getBounds().contains([p.lng, p.lat])
  } catch {
    return true
  }
}

export function TrackingMap({pickup, driver, height = '18rem', caption}: TrackingMapProps) {
  const code = useI18nCode()
  const {strings: t} = getI18nTracking(code)
  const {colorMode} = useColorMode()
  const token = mapboxToken()

  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const mapboxRef = useRef<any>(null)
  const pickupMarker = useRef<any>(null)
  const driverMarker = useRef<any>(null)
  const driverColor = useRef<string>('')
  const fitted = useRef(false)

  const [ready, setReady] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  // The map, once.
  useEffect(() => {
    if (!token || !container.current || mapRef.current) return
    let cancelled = false
    let detachControls: (() => void) | null = null

    void (async () => {
      try {
        const mapboxgl = await loadMapbox()
        if (cancelled || !container.current) return
        mapboxRef.current = mapboxgl
        mapboxgl.accessToken = token

        const m = new mapboxgl.Map({
          container: container.current,
          style: mapStyleFor(colorMode),
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          attributionControl: false,
          pitchWithRotate: false,
          dragRotate: false,
          cooperativeGestures: true
        })
        // The zoom control, placed by map-controls.ts: top right from md
        // up, none on the phone, where pinching zooms.
        detachControls = attachMapControls(m, mapboxgl)
        m.on('load', () => {
          if (!cancelled) setReady(true)
        })
        m.on('error', (e: any) => {
          // A rejected token comes here as a 401 on the style request and
          // nowhere else, which is why it was an endless spinner before.
          const status = e?.error?.status
          if (status === 401 || status === 403) setFailure(t.MapRejected)
          else if (!m.isStyleLoaded()) setFailure(e?.error?.message || t.MapLoadFailed)
        })
        mapRef.current = m
      } catch (err) {
        if (!cancelled) setFailure(err instanceof Error && err.message ? err.message : t.MapLoadFailed)
      }
    })()

    return () => {
      cancelled = true
      detachControls?.()
      pickupMarker.current?.remove()
      driverMarker.current?.remove()
      pickupMarker.current = null
      driverMarker.current = null
      mapRef.current?.remove()
      mapRef.current = null
      setReady(false)
    }
    // The style follows the colour mode in its own effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // The colour mode changes the style. Markers are DOM and survive it.
  useEffect(() => {
    const m = mapRef.current
    if (!m || !ready) return
    m.setStyle(mapStyleFor(colorMode))
  }, [colorMode, ready])

  // The pickup pin.
  useEffect(() => {
    const m = mapRef.current
    const mapboxgl = mapboxRef.current
    if (!m || !mapboxgl || !ready) return
    if (!pickup) {
      pickupMarker.current?.remove()
      pickupMarker.current = null
      return
    }
    if (!pickupMarker.current) {
      pickupMarker.current = new mapboxgl.Marker({color: '#111827'}).setLngLat([pickup.lng, pickup.lat]).addTo(m)
    } else {
      pickupMarker.current.setLngLat([pickup.lng, pickup.lat])
    }
  }, [pickup?.lng, pickup?.lat, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  // The driver's dot, recoloured when the driver changes.
  useEffect(() => {
    const m = mapRef.current
    const mapboxgl = mapboxRef.current
    if (!m || !mapboxgl || !ready) return
    if (!driver) {
      driverMarker.current?.remove()
      driverMarker.current = null
      return
    }
    const color = markerColorFor(driver.color)
    if (driverMarker.current && driverColor.current !== color) {
      driverMarker.current.remove()
      driverMarker.current = null
    }
    if (!driverMarker.current) {
      driverColor.current = color
      driverMarker.current = new mapboxgl.Marker({element: buildDriverElement(color), anchor: 'center'})
        .setLngLat([driver.lng, driver.lat])
        .addTo(m)
    } else {
      driverMarker.current.setLngLat([driver.lng, driver.lat])
    }
  }, [driver?.lng, driver?.lat, driver?.color, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  // The camera: both points once, then the driver when they leave the frame.
  useEffect(() => {
    const m = mapRef.current
    const mapboxgl = mapboxRef.current
    if (!m || !mapboxgl || !ready) return
    const points = [pickup, driver].filter((p): p is TrackingMapPoint => !!p)
    if (points.length === 0) return

    if (!fitted.current) {
      fitted.current = true
      if (points.length === 1) {
        const only = points[0]!
        m.jumpTo({center: [only.lng, only.lat], zoom: 14})
      } else {
        const b = new mapboxgl.LngLatBounds()
        points.forEach(p => b.extend([p.lng, p.lat]))
        m.fitBounds(b, {padding: 48, maxZoom: 15, duration: 0})
      }
      return
    }
    if (driver && !inBounds(m, driver)) {
      const b = new mapboxgl.LngLatBounds()
      points.forEach(p => b.extend([p.lng, p.lat]))
      m.fitBounds(b, {padding: 48, maxZoom: 15, duration: 800})
    }
  }, [pickup?.lng, pickup?.lat, driver?.lng, driver?.lat, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  // The container may have been laid out after the map measured it.
  useEffect(() => {
    if (!ready) return
    const id = window.setTimeout(() => mapRef.current?.resize(), 50)
    return () => window.clearTimeout(id)
  }, [ready, height])

  const message = !token ? t.MapNoToken : failure

  return (
    <Box>
      <Box
        position="relative"
        h={height}
        rounded="surface"
        overflow="hidden"
        borderWidth="1px"
        borderColor="border.default"
        bg="bg.subtle">
        <style>{PULSE_KEYFRAMES}</style>
        {token && !failure && <Box ref={container} position="absolute" inset="0" />}
        {message ? (
          <Center position="absolute" inset="0" p="4" textAlign="center">
            <Text textStyle="sm" color="fg.muted">
              {message}
            </Text>
          </Center>
        ) : (
          !ready && (
            <Center position="absolute" inset="0" pointerEvents="none">
              <HStack color="fg.muted" textStyle="sm">
                <Spinner size="sm" />
                <Text>{t.MapLoading}</Text>
              </HStack>
            </Center>
          )
        )}
      </Box>
      {caption && (
        <Box mt="2" textStyle="xs" color="fg.muted" textAlign="end">
          {caption}
        </Box>
      )}
    </Box>
  )
}

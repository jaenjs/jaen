/**
 * Pickup pins and driver markers, on a small map.
 *
 * Drawn under the "where is the driver" card on a booking and on a
 * transfer with one pickup and one driver, and on the customer's locations
 * screen with the driver of every own ride under way. A pickup is a pin,
 * a driver is a dot in the driver's colour with a soft ring and, when the
 * map has several, the plate and the code beside it. The camera fits every
 * point once and then only follows a driver when they leave the frame, so
 * the person reading it is not yanked about every ten seconds.
 *
 * The three ways a map fails are each said inline in the map's own frame:
 * no token configured, mapbox-gl not loadable, the token rejected. None of
 * them is a spinner.
 */
import {useEffect, useMemo, useRef, useState} from 'react'
import {Box, Center, HStack, Spinner, Text} from '@chakra-ui/react'
import {useColorMode} from 'jaen'
import type {I18nCode} from '../../i18n'
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

/** A driver on a map of several: keyed, with the words beside the dot. */
export interface TrackingMapMarker extends TrackingMapDriver {
  id: string
  /** The plate and the code, say. Nothing beside the dot when empty. */
  label?: string | null
}

/** A pin on a map of several, keyed by its ride. */
export interface TrackingMapPin extends TrackingMapPoint {
  id: string
  /**
   * What the pin marks. A pickup is the dark ink of the letterhead, a
   * destination the brand's gold, and the kind is also the data attribute a
   * test reads off the DOM: data-pickup-pin or data-destination-pin.
   */
  kind?: 'pickup' | 'destination'
}

export interface TrackingMapProps {
  pickup?: TrackingMapPoint | null
  driver?: TrackingMapDriver | null
  /** Several pickups, for the customer's map. Wins over `pickup` when given. */
  pickups?: TrackingMapPin[]
  /** Several drivers, for the customer's map. Wins over `driver` when given. */
  drivers?: TrackingMapMarker[]
  /**
   * Where the ride ends, drawn as a second pin in the brand's gold. The
   * public ride page shows it beside the pickup so a person sees the whole
   * route and not only the door they are waiting at (section 7 of
   * okf/architecture/customer-experience.md).
   */
  destination?: TrackingMapPoint | null
  /**
   * The language of the map's own words. The app leaves it out and the
   * account's language decides; the public ride page passes the booking's,
   * which is not the visitor's.
   */
  code?: I18nCode
  /** The frame's height, a token or a length. Default 18rem. */
  height?: string
  /** Under the map, right aligned: the position's age, say. */
  caption?: React.ReactNode
}

/**
 * The driver's dot, as an element mapbox can carry, with the label beside
 * it when there is one. The data attributes are for whoever measures the
 * map from outside, a test or the devtools: mapbox keeps the position in
 * its own object and the DOM would otherwise say nothing.
 */
const buildDriverElement = (
  id: string,
  color: string,
  label?: string | null
): HTMLDivElement => {
  const el = document.createElement('div')
  el.style.cssText =
    'position:relative;width:22px;height:22px;pointer-events:none'
  el.dataset.driverMarker = id
  el.dataset.color = color
  const ring = document.createElement('div')
  ring.style.cssText =
    'position:absolute;inset:-9px;border-radius:50%;opacity:.35;' +
    `background:${color};animation:limosen-pulse 2s ease-out infinite`
  const dot = document.createElement('div')
  dot.style.cssText =
    'position:absolute;inset:0;border-radius:50%;border:3px solid #fff;' +
    `background:${color};box-shadow:0 1px 6px rgba(0,0,0,.35)`
  el.append(ring, dot)
  if (label) {
    // White on every style, bordered in the driver's colour, so the plate
    // reads on the dark map as well as on the streets.
    const tag = document.createElement('div')
    tag.dataset.markerLabel = ''
    tag.textContent = label
    tag.style.cssText =
      'position:absolute;left:28px;top:50%;transform:translateY(-50%);white-space:nowrap;' +
      'font:600 12px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.04em;' +
      'padding:2px 6px;border-radius:6px;background:#fff;color:#111827;' +
      `border:2px solid ${color};box-shadow:0 1px 4px rgba(0,0,0,.25)`
    el.append(tag)
  }
  return el
}

const stampPosition = (marker: any, p: TrackingMapPoint) => {
  const el: HTMLElement | undefined = marker?.getElement?.()
  if (!el) return
  el.dataset.lng = String(p.lng)
  el.dataset.lat = String(p.lat)
}

/** The pins: the letterhead's ink for a pickup, the brand's gold for a destination. */
const PIN_COLORS: Record<'pickup' | 'destination', string> = {
  pickup: '#111827',
  destination: '#D4AF37'
}

const PULSE_KEYFRAMES =
  '@keyframes limosen-pulse{0%{transform:scale(.6);opacity:.5}100%{transform:scale(1.6);opacity:0}}'

const inBounds = (map: any, p: TrackingMapPoint): boolean => {
  try {
    return map.getBounds().contains([p.lng, p.lat])
  } catch {
    return true
  }
}

const fitAll = (
  map: any,
  mapboxgl: any,
  points: TrackingMapPoint[],
  duration: number
) => {
  if (points.length === 1) {
    const only = points[0]!
    if (duration === 0) map.jumpTo({center: [only.lng, only.lat], zoom: 14})
    else map.easeTo({center: [only.lng, only.lat], duration})
    return
  }
  const b = new mapboxgl.LngLatBounds()
  points.forEach(p => b.extend([p.lng, p.lat]))
  map.fitBounds(b, {padding: 48, maxZoom: 15, duration})
}

export function TrackingMap({
  pickup,
  driver,
  pickups,
  drivers,
  destination,
  code: given,
  height = '18rem',
  caption
}: TrackingMapProps) {
  const context = useI18nCode()
  const code = given ?? context
  const {strings: t} = getI18nTracking(code)
  const {colorMode} = useColorMode()
  const token = mapboxToken()

  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const mapboxRef = useRef<any>(null)
  const pinMarkers = useRef(new Map<string, any>())
  const driverMarkers = useRef(
    new Map<string, {marker: any; color: string; label: string}>()
  )
  const fitted = useRef(false)

  const [ready, setReady] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  // The single props are the lists of one, so the effects below know one shape.
  const pinList = useMemo<TrackingMapPin[]>(
    () => [
      ...(pickups ??
        (pickup
          ? [
              {
                id: 'pickup',
                kind: 'pickup' as const,
                lng: pickup.lng,
                lat: pickup.lat
              }
            ]
          : [])),
      ...(destination
        ? [
            {
              id: 'destination',
              kind: 'destination' as const,
              lng: destination.lng,
              lat: destination.lat
            }
          ]
        : [])
    ],
    [pickups, pickup?.lng, pickup?.lat, destination?.lng, destination?.lat] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const markerList = useMemo<TrackingMapMarker[]>(
    () => drivers ?? (driver ? [{id: 'driver', ...driver}] : []),
    [drivers, driver?.lng, driver?.lat, driver?.color, driver?.accuracy] // eslint-disable-line react-hooks/exhaustive-deps
  )
  // What the effects depend on, as one string each: a list rebuilt with the
  // same values must not redraw anything.
  const pinsKey = pinList
    .map(p => `${p.id}:${p.kind ?? 'pickup'}:${p.lng}:${p.lat}`)
    .join('|')
  const markersKey = markerList
    .map(
      m =>
        `${m.id}:${m.lng}:${m.lat}:${markerColorFor(m.color)}:${m.label ?? ''}`
    )
    .join('|')

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
          else if (!m.isStyleLoaded())
            setFailure(e?.error?.message || t.MapLoadFailed)
        })
        mapRef.current = m
      } catch (err) {
        if (!cancelled)
          setFailure(
            err instanceof Error && err.message ? err.message : t.MapLoadFailed
          )
      }
    })()

    return () => {
      cancelled = true
      detachControls?.()
      pinMarkers.current.forEach(marker => marker.remove())
      pinMarkers.current.clear()
      driverMarkers.current.forEach(({marker}) => marker.remove())
      driverMarkers.current.clear()
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

  // The pickup pins: one per id, moved when the point moves, gone with the ride.
  useEffect(() => {
    const m = mapRef.current
    const mapboxgl = mapboxRef.current
    if (!m || !mapboxgl || !ready) return
    const wanted = new Set(pinList.map(p => p.id))
    pinMarkers.current.forEach((marker, id) => {
      if (!wanted.has(id)) {
        marker.remove()
        pinMarkers.current.delete(id)
      }
    })
    for (const p of pinList) {
      const held = pinMarkers.current.get(p.id)
      if (held) {
        held.setLngLat([p.lng, p.lat])
      } else {
        const kind = p.kind ?? 'pickup'
        const marker = new mapboxgl.Marker({color: PIN_COLORS[kind]})
          .setLngLat([p.lng, p.lat])
          .addTo(m)
        const el: HTMLElement | undefined = marker.getElement?.()
        if (el) {
          if (kind === 'destination') el.dataset.destinationPin = p.id
          else el.dataset.pickupPin = p.id
        }
        pinMarkers.current.set(p.id, marker)
      }
      stampPosition(pinMarkers.current.get(p.id), p)
    }
  }, [pinsKey, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  // The drivers' dots: recoloured or relabelled by replacing the element.
  useEffect(() => {
    const m = mapRef.current
    const mapboxgl = mapboxRef.current
    if (!m || !mapboxgl || !ready) return
    const wanted = new Set(markerList.map(d => d.id))
    driverMarkers.current.forEach((held, id) => {
      if (!wanted.has(id)) {
        held.marker.remove()
        driverMarkers.current.delete(id)
      }
    })
    for (const d of markerList) {
      const color = markerColorFor(d.color)
      const label = d.label ?? ''
      const held = driverMarkers.current.get(d.id)
      if (held && (held.color !== color || held.label !== label)) {
        held.marker.remove()
        driverMarkers.current.delete(d.id)
      }
      const kept = driverMarkers.current.get(d.id)
      if (kept) {
        kept.marker.setLngLat([d.lng, d.lat])
      } else {
        const marker = new mapboxgl.Marker({
          element: buildDriverElement(d.id, color, label),
          anchor: 'center'
        })
          .setLngLat([d.lng, d.lat])
          .addTo(m)
        driverMarkers.current.set(d.id, {marker, color, label})
      }
      stampPosition(driverMarkers.current.get(d.id)?.marker, d)
    }
  }, [markersKey, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  // The camera: every point once, then again when a driver leaves the frame.
  useEffect(() => {
    const m = mapRef.current
    const mapboxgl = mapboxRef.current
    if (!m || !mapboxgl || !ready) return
    const points: TrackingMapPoint[] = [...pinList, ...markerList]
    if (points.length === 0) return

    if (!fitted.current) {
      fitted.current = true
      fitAll(m, mapboxgl, points, 0)
      return
    }
    if (markerList.some(d => !inBounds(m, d))) fitAll(m, mapboxgl, points, 800)
  }, [pinsKey, markersKey, ready]) // eslint-disable-line react-hooks/exhaustive-deps

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
        {token && !failure && (
          <Box ref={container} position="absolute" inset="0" />
        )}
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

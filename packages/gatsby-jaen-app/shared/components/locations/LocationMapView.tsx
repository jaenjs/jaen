/**
 * The dispatcher's map: every driver and customer position as a dot.
 *
 * A direct mapbox-gl integration, no React wrapper. Rows become one
 * clustered GeoJSON source and four layers: the cluster circles, their
 * counts, an invisible touch target, and the dots themselves, each in the
 * row's own colour (the driver's, grey for a driver who never chose, blue
 * for a customer). The layers are added again after every style change,
 * because a colour mode switch replaces the style and takes them with it.
 *
 * The overlays around the map are Chakra, so they follow the tokens and
 * the colour mode. The three ways the map fails are said inline in its own
 * frame: no token, mapbox-gl not loadable, the token rejected.
 */
import {useEffect, useRef, useState, useMemo} from 'react'
import {Box, Button, Center, HStack, IconButton, Spinner, Text} from '@chakra-ui/react'
import {FaSyncAlt} from '@react-icons/all-files/fa/FaSyncAlt'
import {useColorMode} from 'jaen'
import {useI18nCode} from '../../i18n'
import {getI18nTracking, fillTracking} from '../../locales/i18nTracking'
import type {LocationRow, KindFilter} from './LocationsTab'
import {
  CUSTOMER_MARKER_COLOR,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  NEUTRAL_MARKER_COLOR,
  loadMapbox,
  mapStyleFor,
  mapboxToken,
  rowColorFor
} from './mapbox-token'

export interface LocationMapViewProps {
  locations: LocationRow[]
  isLoading: boolean
  kindFilter: KindFilter
  onKindFilterChange: (f: KindFilter) => void
  onSelect: (loc: LocationRow) => void
  selectedLocation?: LocationRow | null
  onRefresh?: () => void
}

const SOURCE = 'locations'

function fitMapToLocations(map: any, locs: {latitude: number; longitude: number}[]) {
  const only = locs[0]
  if (!only) return
  if (locs.length === 1) {
    map.flyTo({center: [only.longitude, only.latitude], zoom: 15, duration: 1000})
    return
  }
  let minLng = Infinity,
    maxLng = -Infinity,
    minLat = Infinity,
    maxLat = -Infinity
  for (const l of locs) {
    if (l.longitude < minLng) minLng = l.longitude
    if (l.longitude > maxLng) maxLng = l.longitude
    if (l.latitude < minLat) minLat = l.latitude
    if (l.latitude > maxLat) maxLat = l.latitude
  }
  map.fitBounds(
    [
      [minLng, minLat],
      [maxLng, maxLat]
    ],
    {padding: 60, maxZoom: 15, duration: 1000}
  )
}

/** The layers, on whatever style is current. Called after every style load. */
function addLayers(m: any, dark: boolean) {
  if (m.getSource(SOURCE)) return
  m.addSource(SOURCE, {
    type: 'geojson',
    data: {type: 'FeatureCollection', features: []},
    cluster: true,
    clusterMaxZoom: 13,
    clusterRadius: 50
  })

  m.addLayer({
    id: 'clusters',
    type: 'circle',
    source: SOURCE,
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': dark ? '#F5F5F5' : '#1A1A1A',
      'circle-radius': ['step', ['get', 'point_count'], 18, 10, 22, 50, 28],
      'circle-stroke-width': 2.5,
      'circle-stroke-color': dark ? '#1A1A1A' : '#FFFFFF',
      'circle-opacity': 0.9
    }
  })

  m.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: SOURCE,
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
      'text-size': 13
    },
    paint: {'text-color': dark ? '#1A1A1A' : '#FFFFFF'}
  })

  // A finger is wider than a dot.
  m.addLayer({
    id: 'location-hit-area',
    type: 'circle',
    source: SOURCE,
    filter: ['!', ['has', 'point_count']],
    paint: {'circle-color': 'transparent', 'circle-radius': 24}
  })

  m.addLayer({
    id: 'location-dots',
    type: 'circle',
    source: SOURCE,
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': ['get', 'color'],
      'circle-radius': 9,
      'circle-stroke-width': 3,
      'circle-stroke-color': dark ? '#1A1A1A' : '#FFFFFF'
    }
  })

  m.addLayer({
    id: 'location-labels',
    type: 'symbol',
    source: SOURCE,
    filter: ['!', ['has', 'point_count']],
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
      'text-size': 11,
      'text-anchor': 'top',
      'text-offset': [0, 1],
      'text-allow-overlap': false,
      'text-optional': true
    },
    paint: {
      'text-color': dark ? '#E5E5E5' : '#374151',
      'text-halo-color': dark ? '#1A1A1A' : '#FFFFFF',
      'text-halo-width': 1.5
    }
  })
}

export function LocationMapView({
  locations,
  isLoading,
  kindFilter,
  onKindFilterChange,
  onSelect,
  selectedLocation,
  onRefresh
}: LocationMapViewProps) {
  const code = useI18nCode()
  const {strings: t} = getI18nTracking(code)
  const {colorMode} = useColorMode()
  const dark = colorMode === 'dark'
  const token = mapboxToken()

  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const [mapReady, setMapReady] = useState(false)
  /** Bumped on every style load, so the layers and data are put back. */
  const [styleVersion, setStyleVersion] = useState(0)
  const [mapError, setMapError] = useState<string | null>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const darkRef = useRef(dark)
  darkRef.current = dark

  const idMap = useMemo(() => {
    const m = new Map<string, LocationRow>()
    for (const l of locations) m.set(`${l.kind}:${l.id}`, l)
    return m
  }, [locations])
  const idMapRef = useRef(idMap)
  idMapRef.current = idMap

  const filterOptions: {value: KindFilter; label: string}[] = [
    {value: 'all', label: t.FilterAll},
    {value: 'driver', label: t.FilterDrivers},
    {value: 'customer', label: t.FilterCustomers}
  ]

  // The map, once per token.
  useEffect(() => {
    if (!token || !mapContainer.current || mapRef.current) return
    let cancelled = false

    void (async () => {
      try {
        const mapboxgl = await loadMapbox()
        if (cancelled || !mapContainer.current) return
        mapboxgl.accessToken = token

        const m = new mapboxgl.Map({
          container: mapContainer.current,
          style: mapStyleFor(darkRef.current ? 'dark' : 'light'),
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          attributionControl: false,
          pitchWithRotate: false
        })

        m.addControl(new mapboxgl.NavigationControl({showCompass: false}), 'bottom-right')
        // The dispatcher's own position on their own map, never sent anywhere.
        m.addControl(
          new mapboxgl.GeolocateControl({
            positionOptions: {enableHighAccuracy: true},
            trackUserLocation: true,
            showUserHeading: true
          }),
          'bottom-right'
        )

        m.on('load', () => {
          if (cancelled) return
          addLayers(m, darkRef.current)
          setMapReady(true)
          setStyleVersion(v => v + 1)
        })
        // setStyle replaces everything: the layers come back here.
        m.on('style.load', () => {
          if (cancelled) return
          addLayers(m, darkRef.current)
          setStyleVersion(v => v + 1)
        })
        m.on('error', (e: any) => {
          // A rejected token is a 401 on the style request, and nothing
          // else ever said so: the map used to spin forever on it.
          const status = e?.error?.status
          if (status === 401 || status === 403) setMapError(t.MapRejected)
          else if (!m.isStyleLoaded()) setMapError(e?.error?.message || t.MapLoadFailed)
        })

        // Click on a cluster: zoom into it.
        m.on('click', 'clusters', (e: any) => {
          const features = m.queryRenderedFeatures(e.point, {layers: ['clusters']})
          if (!features.length) return
          const clusterId = features[0].properties?.cluster_id
          ;(m.getSource(SOURCE) as any).getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
            if (err) return
            const geo = features[0].geometry
            if (geo.type === 'Point') m.easeTo({center: geo.coordinates as [number, number], zoom: zoom ?? 13})
          })
        })

        // Click on a dot: the sheet.
        m.on('click', 'location-hit-area', (e: any) => {
          const features = m.queryRenderedFeatures(e.point, {layers: ['location-hit-area']})
          if (!features.length) return
          const loc = idMapRef.current.get(features[0].properties?.id)
          if (loc) onSelectRef.current(loc)
        })

        for (const layer of ['clusters', 'location-hit-area']) {
          m.on('mouseenter', layer, () => {
            m.getCanvas().style.cursor = 'pointer'
          })
          m.on('mouseleave', layer, () => {
            m.getCanvas().style.cursor = ''
          })
        }

        mapRef.current = m
      } catch (err) {
        if (!cancelled) setMapError(err instanceof Error && err.message ? err.message : t.MapLoadFailed)
      }
    })()

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        setMapReady(false)
      }
    }
    // The strings only change with the language, and the map is not rebuilt for that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // The colour mode changes the style. The layers come back on style.load.
  useEffect(() => {
    const m = mapRef.current
    if (!m || !mapReady) return
    m.setStyle(mapStyleFor(dark ? 'dark' : 'light'))
  }, [dark, mapReady])

  const hasAutoFitted = useRef(false)

  // The data, on every change and after every style load.
  useEffect(() => {
    const m = mapRef.current
    if (!m || !mapReady || !m.getSource(SOURCE)) return

    const valid = locations.filter(
      l =>
        Number.isFinite(l.latitude) &&
        Number.isFinite(l.longitude) &&
        (l.latitude !== 0 || l.longitude !== 0)
    )

    ;(m.getSource(SOURCE) as any).setData({
      type: 'FeatureCollection',
      features: valid.map(l => ({
        type: 'Feature' as const,
        geometry: {type: 'Point' as const, coordinates: [l.longitude, l.latitude]},
        properties: {
          id: `${l.kind}:${l.id}`,
          kind: l.kind,
          color: rowColorFor(l.kind, l.color),
          label: l.name || (l.kind === 'driver' ? t.KindDriver : t.KindCustomer)
        }
      }))
    })

    // Fit once, then leave the dispatcher's viewport alone.
    if (!hasAutoFitted.current && valid.length > 0) {
      fitMapToLocations(m, valid)
      hasAutoFitted.current = true
    }
  }, [locations, mapReady, styleVersion, t.KindDriver, t.KindCustomer])

  // Fly to the selected row.
  useEffect(() => {
    if (!mapRef.current || !selectedLocation || !mapReady) return
    mapRef.current.flyTo({center: [selectedLocation.longitude, selectedLocation.latitude], zoom: 15, duration: 600})
  }, [selectedLocation, mapReady])

  // The container may have been laid out after the map measured it.
  useEffect(() => {
    if (!mapRef.current || !mapReady) return
    const id = window.setTimeout(() => mapRef.current?.resize(), 100)
    return () => window.clearTimeout(id)
  }, [mapReady])

  const message = !token ? t.MapNoToken : mapError

  if (message) {
    return (
      <Center h="full" bg="bg.subtle" p="6" textAlign="center">
        <Text textStyle="sm" color="fg.muted" maxW="md">
          {message}
        </Text>
      </Center>
    )
  }

  const count = locations.length

  return (
    <Box position="relative" h="full" style={{touchAction: 'manipulation'}}>
      <Box ref={mapContainer} position="absolute" inset="0" />

      {(isLoading || !mapReady) && (
        <Center position="absolute" inset="0" zIndex="1" pointerEvents="none" bg="bg.canvas/60">
          <HStack color="fg.muted" textStyle="sm">
            <Spinner size="sm" />
            <Text>{t.MapLoading}</Text>
          </HStack>
        </Center>
      )}

      {/* The filter chips, the refresh, and the legend. */}
      <Box position="absolute" top="0" insetX="0" zIndex="2" p="3" pointerEvents="none">
        <HStack
          pointerEvents="auto"
          bg="bg.surface/90"
          backdropFilter="blur(8px)"
          rounded="lg"
          px="2.5"
          py="2"
          shadow="sm"
          gap="1.5"
          flexWrap="wrap">
          {filterOptions.map(opt => (
            <Button
              key={opt.value}
              size="xs"
              variant={kindFilter === opt.value ? 'solid' : 'ghost'}
              colorPalette={kindFilter === opt.value ? 'brand' : 'gray'}
              onClick={() => onKindFilterChange(opt.value)}>
              {opt.label}
            </Button>
          ))}
          {onRefresh && (
            <IconButton size="xs" variant="ghost" aria-label={t.Refresh} title={t.Refresh} onClick={onRefresh}>
              <FaSyncAlt />
            </IconButton>
          )}
          <HStack ms="auto" gap="3" textStyle="xs" color="fg.muted">
            <HStack gap="1">
              <Box boxSize="2" rounded="full" bg={NEUTRAL_MARKER_COLOR} />
              <Text>{t.FilterDrivers}</Text>
            </HStack>
            <HStack gap="1">
              <Box boxSize="2" rounded="full" bg={CUSTOMER_MARKER_COLOR} />
              <Text>{t.FilterCustomers}</Text>
            </HStack>
          </HStack>
        </HStack>
      </Box>

      {mapReady && count > 0 && (
        <Box
          position="absolute"
          bottom="3"
          left="3"
          zIndex="2"
          bg="bg.surface/90"
          backdropFilter="blur(8px)"
          rounded="md"
          px="3"
          py="1.5"
          shadow="sm"
          textStyle="xs"
          color="fg.muted"
          fontWeight="medium">
          {count === 1 ? t.CountOne : fillTracking(t.CountMany, {count})}
        </Box>
      )}
    </Box>
  )
}

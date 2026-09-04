import {useEffect, useRef, useState, useMemo} from 'react'
import type {LocationRow, KindFilter} from './LocationsTab'

export interface LocationMapViewProps {
  locations: LocationRow[]
  isLoading: boolean
  kindFilter: KindFilter
  onKindFilterChange: (f: KindFilter) => void
  mapboxToken: string
  onSelect: (loc: LocationRow) => void
  selectedLocation?: LocationRow | null
  onRefresh?: () => void
}

const DEFAULT_CENTER: [number, number] = [16.3738, 48.2082]
const DEFAULT_ZOOM = 13

const DRIVER_COLOR = '#E1B505'
const CUSTOMER_COLOR = '#3b82f6'
const CLUSTER_COLOR = '#1a1a1a'

const filterOptions: {value: KindFilter; label: string}[] = [
  {value: 'all', label: 'Alle'},
  {value: 'driver', label: 'Fahrer'},
  {value: 'customer', label: 'Kunden'}
]

function fitMapToLocations(
  map: any,
  locs: {latitude: number; longitude: number}[]
) {
  if (locs.length === 0) return
  if (locs.length === 1) {
    map.flyTo({
      center: [locs[0].longitude, locs[0].latitude],
      zoom: 15,
      duration: 1000
    })
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

function buildPinSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">
    <defs>
      <filter id="ds" x="-20%" y="-10%" width="140%" height="130%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="2" flood-opacity="0.3"/>
      </filter>
    </defs>
    <path d="M18 46C18 46 33 28.5 33 18A15 15 0 0 0 3 18C3 28.5 18 46 18 46Z"
          fill="${color}" stroke="white" stroke-width="2.5" filter="url(#ds)"/>
    <circle cx="18" cy="18" r="6" fill="white" opacity="0.9"/>
  </svg>`
}

function loadSvgImage(
  svg: string,
  width: number,
  height: number
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image(width, height)
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src =
      'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  })
}

function buildPopupHtml(loc: LocationRow): string {
  const isDriver = loc.kind === 'driver'
  const accent = isDriver ? DRIVER_COLOR : CUSTOMER_COLOR
  const label = isDriver ? 'Fahrer' : 'Kunde'
  const userId =
    loc.userId.length > 22 ? loc.userId.slice(0, 22) + '…' : loc.userId

  const formatDt = (iso?: string) => {
    if (!iso) return null
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('de-AT', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  const formatCoord = (n: number) =>
    Number.isFinite(n) ? n.toFixed(6) : '—'

  const updated = formatDt(loc.updatedAtISO)
  const recorded = formatDt(loc.recordedAtISO)
  const acc =
    typeof loc.accuracy === 'number' ? `${Math.round(loc.accuracy)} m` : null

  let rows = ''
  rows += `<div style="display:flex;justify-content:space-between;gap:12px;font-size:12px;color:#6b7280"><span>Lat</span><span style="font-family:monospace;font-weight:500;color:#111">${formatCoord(loc.latitude)}</span></div>`
  rows += `<div style="display:flex;justify-content:space-between;gap:12px;font-size:12px;color:#6b7280"><span>Lng</span><span style="font-family:monospace;font-weight:500;color:#111">${formatCoord(loc.longitude)}</span></div>`
  if (acc)
    rows += `<div style="display:flex;justify-content:space-between;gap:12px;font-size:12px;color:#6b7280"><span>Genauigkeit</span><span style="font-weight:500;color:#111">${acc}</span></div>`
  if (updated)
    rows += `<div style="display:flex;justify-content:space-between;gap:12px;font-size:12px;color:#6b7280"><span>Aktualisiert</span><span style="font-weight:500;color:#111">${updated}</span></div>`
  if (recorded)
    rows += `<div style="display:flex;justify-content:space-between;gap:12px;font-size:12px;color:#6b7280"><span>Aufgezeichnet</span><span style="font-weight:500;color:#111">${recorded}</span></div>`

  return `<div style="min-width:220px;max-width:280px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <div style="width:10px;height:10px;border-radius:50%;background:${accent};flex-shrink:0"></div>
      <span style="font-size:14px;font-weight:600">${label}</span>
    </div>
    <div style="font-size:11px;color:#9ca3af;margin-bottom:8px;font-family:monospace;word-break:break-all">${userId}</div>
    <div style="display:flex;flex-direction:column;gap:6px">${rows}</div>
    <a href="https://www.google.com/maps/dir/?api=1&destination=${loc.latitude},${loc.longitude}"
       target="_blank" rel="noopener noreferrer"
       style="display:block;margin-top:12px;text-align:center;padding:6px 0;border-radius:6px;background:${accent};color:${isDriver ? '#000' : '#fff'};font-size:12px;font-weight:600;text-decoration:none">
      Route planen
    </a>
  </div>`
}

export function LocationMapView({
  locations,
  isLoading,
  kindFilter,
  onKindFilterChange,
  mapboxToken,
  onSelect,
  selectedLocation,
  onRefresh
}: LocationMapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const mapboxglRef = useRef<any>(null)
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const popupRef = useRef<any>(null)

  const idMap = useMemo(() => {
    const m = new Map<string, LocationRow>()
    for (const l of locations) m.set(`${l.kind}:${l.id}`, l)
    return m
  }, [locations])
  const idMapRef = useRef(idMap)
  idMapRef.current = idMap

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    let cancelled = false

    const initMap = async () => {
      try {
        // @ts-ignore
        const mapboxgl = await import('mapbox-gl')
        try {
          // @ts-ignore
          await import('mapbox-gl/dist/mapbox-gl.css')
        } catch {}

        if (cancelled || !mapContainer.current) return

        mapboxglRef.current = mapboxgl.default
        mapboxgl.default.accessToken = mapboxToken

        const [driverPinImg, customerPinImg] = await Promise.all([
          loadSvgImage(buildPinSvg(DRIVER_COLOR), 36, 48),
          loadSvgImage(buildPinSvg(CUSTOMER_COLOR), 36, 48)
        ])

        if (cancelled || !mapContainer.current) return

        const m = new mapboxgl.default.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          attributionControl: false,
          pitchWithRotate: false
        })

        m.addControl(
          new mapboxgl.default.NavigationControl({showCompass: false}),
          'bottom-right'
        )

        m.addControl(
          new mapboxgl.default.GeolocateControl({
            positionOptions: {enableHighAccuracy: true},
            trackUserLocation: true,
            showUserHeading: true
          }),
          'bottom-right'
        )

        m.on('load', () => {
          if (cancelled) return
          m.addImage('driver-pin', driverPinImg, {sdf: false})
          m.addImage('customer-pin', customerPinImg, {sdf: false})
          setMapReady(true)
        })

        mapRef.current = m
      } catch {
        if (!cancelled) setMapError('mapbox-gl konnte nicht geladen werden')
      }
    }

    initMap()

    return () => {
      cancelled = true
      if (popupRef.current) {
        popupRef.current.remove()
        popupRef.current = null
      }
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        setMapReady(false)
      }
    }
  }, [mapboxToken])

  const hasAutoFitted = useRef(false)

  useEffect(() => {
    const m = mapRef.current
    if (!m || !mapReady) return

    const validLocations = locations.filter(
      l =>
        Number.isFinite(l.latitude) &&
        Number.isFinite(l.longitude) &&
        (l.latitude !== 0 || l.longitude !== 0)
    )

    const geojsonData: any = {
      type: 'FeatureCollection',
      features: validLocations.map(l => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [l.longitude, l.latitude]
        },
        properties: {
          id: `${l.kind}:${l.id}`,
          kind: l.kind,
          userId: l.userId,
          isDriver: l.kind === 'driver',
          label: l.kind === 'driver' ? 'Fahrer' : 'Kunde'
        }
      }))
    }

    if (m.getSource('locations')) {
      ;(m.getSource('locations') as any).setData(geojsonData)
      if (!hasAutoFitted.current && validLocations.length > 0) {
        fitMapToLocations(m, validLocations)
        hasAutoFitted.current = true
      }
      return
    }

    m.addSource('locations', {
      type: 'geojson',
      data: geojsonData,
      cluster: true,
      clusterMaxZoom: 13,
      clusterRadius: 50
    })

    // Cluster circles
    m.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'locations',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': CLUSTER_COLOR,
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          18,
          10,
          22,
          50,
          28
        ],
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.9
      }
    })

    // Cluster count text
    m.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'locations',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 13
      },
      paint: {'text-color': '#ffffff'}
    })

    // Invisible hit area for individual points
    m.addLayer({
      id: 'location-hit-area',
      type: 'circle',
      source: 'locations',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': 'transparent',
        'circle-radius': 24
      }
    })

    // POI pin markers for individual points
    m.addLayer({
      id: 'location-pins',
      type: 'symbol',
      source: 'locations',
      filter: ['!', ['has', 'point_count']],
      layout: {
        'icon-image': [
          'case',
          ['get', 'isDriver'],
          'driver-pin',
          'customer-pin'
        ],
        'icon-size': 1,
        'icon-anchor': 'bottom',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'text-field': ['get', 'label'],
        'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 11,
        'text-anchor': 'top',
        'text-offset': [0, 0.3],
        'text-allow-overlap': false,
        'text-optional': true
      },
      paint: {
        'text-color': '#374151',
        'text-halo-color': 'white',
        'text-halo-width': 1.5
      }
    })

    // Click on cluster -> zoom in
    m.on('click', 'clusters', (e: any) => {
      const features = m.queryRenderedFeatures(e.point, {
        layers: ['clusters']
      })
      if (!features.length) return
      const clusterId = features[0].properties?.cluster_id
      ;(m.getSource('locations') as any).getClusterExpansionZoom(
        clusterId,
        (err: any, zoom: number) => {
          if (err) return
          const geo = features[0].geometry
          if (geo.type === 'Point') {
            m.easeTo({
              center: geo.coordinates as [number, number],
              zoom: zoom ?? 13
            })
          }
        }
      )
    })

    // Click on individual point -> show popup + select
    m.on('click', 'location-hit-area', (e: any) => {
      const features = m.queryRenderedFeatures(e.point, {
        layers: ['location-hit-area']
      })
      if (!features.length) return
      const clickedId = features[0].properties?.id
      const loc = idMapRef.current.get(clickedId)
      if (!loc) return

      onSelectRef.current(loc)

      if (popupRef.current) popupRef.current.remove()

      if (mapboxglRef.current) {
        const popup = new mapboxglRef.current.Popup({
          offset: [0, -48],
          closeButton: true,
          closeOnClick: true,
          maxWidth: '300px'
        })
          .setLngLat([loc.longitude, loc.latitude])
          .setHTML(buildPopupHtml(loc))
          .addTo(m)

        popupRef.current = popup
        popup.on('close', () => {
          popupRef.current = null
        })
      }
    })

    // Cursor changes
    m.on('mouseenter', 'clusters', () => {
      m.getCanvas().style.cursor = 'pointer'
    })
    m.on('mouseleave', 'clusters', () => {
      m.getCanvas().style.cursor = ''
    })
    m.on('mouseenter', 'location-hit-area', () => {
      m.getCanvas().style.cursor = 'pointer'
    })
    m.on('mouseleave', 'location-hit-area', () => {
      m.getCanvas().style.cursor = ''
    })

    // Fit map to locations on first load
    if (validLocations.length > 0) {
      fitMapToLocations(m, validLocations)
      hasAutoFitted.current = true
    }
  }, [locations, mapReady])

  // Fly to selected location
  useEffect(() => {
    if (!mapRef.current || !selectedLocation || !mapReady) return
    mapRef.current.flyTo({
      center: [selectedLocation.longitude, selectedLocation.latitude],
      zoom: 15,
      duration: 600
    })
  }, [selectedLocation, mapReady])

  // Resize map when ready
  useEffect(() => {
    if (!mapRef.current || !mapReady) return
    setTimeout(() => mapRef.current?.resize(), 100)
  }, [mapReady])

  if (mapError) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f9fafb',
          flexDirection: 'column',
          gap: 8
        }}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#9ca3af"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round">
          <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <p style={{fontSize: 14, color: '#6b7280', fontWeight: 500}}>
          {mapError}
        </p>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        touchAction: 'manipulation'
      }}>
      {/* Map container */}
      <div ref={mapContainer} style={{position: 'absolute', inset: 0}} />

      {/* Loading overlay */}
      {(isLoading || !mapReady) && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(249,250,251,0.7)',
            zIndex: 5,
            pointerEvents: 'none'
          }}>
          <div style={{textAlign: 'center'}}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                border: '2px solid #e5e7eb',
                borderTopColor: DRIVER_COLOR,
                animation: 'spin 1s linear infinite',
                margin: '0 auto'
              }}
            />
            <p style={{fontSize: 14, color: '#9ca3af', marginTop: 12}}>
              Karte wird geladen…
            </p>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        </div>
      )}

      {/* Filter chips + legend overlay */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          padding: 12,
          pointerEvents: 'none'
        }}>
        <div
          style={{
            pointerEvents: 'auto',
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            borderRadius: 10,
            padding: '8px 10px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
          {filterOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => onKindFilterChange(opt.value)}
              style={{
                flexShrink: 0,
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
                background:
                  kindFilter === opt.value
                    ? CLUSTER_COLOR
                    : 'rgba(0,0,0,0.04)',
                color: kindFilter === opt.value ? 'white' : '#6b7280'
              }}>
              {opt.label}
            </button>
          ))}

          {onRefresh && (
            <button
              onClick={onRefresh}
              title="Aktualisieren"
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: 'none',
                background: 'rgba(0,0,0,0.04)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6b7280',
                flexShrink: 0
              }}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M8 16H3v5" />
              </svg>
            </button>
          )}

          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              gap: 12,
              alignItems: 'center'
            }}>
            <div style={{display: 'flex', alignItems: 'center', gap: 4}}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: DRIVER_COLOR
                }}
              />
              <span style={{fontSize: 11, color: '#6b7280'}}>Fahrer</span>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: 4}}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: CUSTOMER_COLOR
                }}
              />
              <span style={{fontSize: 11, color: '#6b7280'}}>Kunden</span>
            </div>
          </div>
        </div>
      </div>

      {/* Location count badge */}
      {mapReady && locations.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            zIndex: 10,
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            borderRadius: 8,
            padding: '6px 12px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            fontSize: 12,
            color: '#6b7280',
            fontWeight: 500
          }}>
          {locations.length} Standort{locations.length !== 1 ? 'e' : ''}
        </div>
      )}
    </div>
  )
}

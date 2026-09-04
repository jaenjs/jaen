import {useState, useMemo, useCallback} from 'react'
import {LocationMapView} from './LocationMapView'

export type LocationKind = 'driver' | 'customer'

export interface LocationRow {
  kind: LocationKind
  id: string
  userId: string
  latitude: number
  longitude: number
  accuracy?: number
  recordedAtISO?: string
  updatedAtISO?: string
  createdAtISO?: string
}

export type KindFilter = 'all' | 'driver' | 'customer'

const MAPBOX_TOKEN =
  (typeof window !== 'undefined' && (window as any).__MAPBOX_TOKEN__) ||
  process.env.GATSBY_MAPBOX_TOKEN ||
  process.env.GATSBY_MAPBOX_ACCESS_TOKEN ||
  ''

export interface LocationsTabProps {
  locations: LocationRow[]
  isLoading: boolean
  error?: string | null
  onRefresh: () => void
}

export function LocationsTab({
  locations,
  isLoading,
  error: _error,
  onRefresh
}: LocationsTabProps) {
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [selectedLocation, setSelectedLocation] = useState<LocationRow | null>(
    null
  )

  const filtered = useMemo(() => {
    if (kindFilter === 'all') return locations
    return locations.filter(l => l.kind === kindFilter)
  }, [locations, kindFilter])

  const handleSelect = useCallback((loc: LocationRow) => {
    setSelectedLocation(loc)
  }, [])

  const handleCloseDetail = useCallback(() => {
    setSelectedLocation(null)
  }, [])

  return (
    <div style={{position: 'relative', height: '100%', overflow: 'hidden'}}>
      <LocationMapView
        locations={filtered}
        isLoading={isLoading}
        kindFilter={kindFilter}
        onKindFilterChange={setKindFilter}
        mapboxToken={MAPBOX_TOKEN}
        onSelect={handleSelect}
        selectedLocation={selectedLocation}
        onRefresh={onRefresh}
      />

      {selectedLocation && (
        <LocationDetailDrawer
          location={selectedLocation}
          onClose={handleCloseDetail}
        />
      )}
    </div>
  )
}

const GOLD = '#E1B505'
const BLUE = '#3b82f6'

function LocationDetailDrawer({
  location,
  onClose
}: {
  location: LocationRow
  onClose: () => void
}) {
  const navigateUrl = `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`
  const isDriver = location.kind === 'driver'
  const accent = isDriver ? GOLD : BLUE
  const accentBg = isDriver ? 'rgba(225,181,5,0.1)' : 'rgba(59,130,246,0.1)'

  const formatDt = (iso?: string) => {
    if (!iso) return '—'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('de-AT')
  }

  const formatCoord = (n: number) =>
    Number.isFinite(n)
      ? new Intl.NumberFormat('en-US', {maximumFractionDigits: 6}).format(n)
      : '—'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end'
      }}>
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.4)'
        }}
      />
      <div
        style={{
          position: 'relative',
          background: 'white',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          maxHeight: '70vh',
          overflow: 'auto',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.15)'
        }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            paddingTop: 8,
            paddingBottom: 4
          }}>
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: '#d1d5db'
            }}
          />
        </div>

        <div style={{padding: '12px 20px 24px'}}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 16
            }}>
            <div style={{display: 'flex', alignItems: 'flex-start', gap: 12}}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: accentBg,
                  color: accent,
                  flexShrink: 0
                }}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round">
                  <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <div>
                <div style={{fontSize: 16, fontWeight: 600, lineHeight: '1.3'}}>
                  {isDriver ? 'Fahrer' : 'Kunde'}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: '#6b7280',
                    marginTop: 2,
                    fontFamily: 'monospace'
                  }}>
                  {location.userId.length > 20
                    ? location.userId.slice(0, 20) + '…'
                    : location.userId}
                </div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 11,
                    fontWeight: 500,
                    padding: '2px 8px',
                    borderRadius: 6,
                    marginTop: 6,
                    background: accentBg,
                    color: accent
                  }}>
                  {isDriver ? 'Fahrer' : 'Kunde'}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: 'none',
                background: '#f3f4f6',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
              ✕
            </button>
          </div>

          <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
            <DetailRow
              label="Breitengrad"
              value={formatCoord(location.latitude)}
            />
            <DetailRow
              label="Längengrad"
              value={formatCoord(location.longitude)}
            />
            <DetailRow
              label="Genauigkeit"
              value={
                typeof location.accuracy === 'number'
                  ? `${Math.round(location.accuracy)} m`
                  : '—'
              }
            />
            <DetailRow
              label="Aktualisiert"
              value={formatDt(location.updatedAtISO)}
            />
            <DetailRow
              label="Aufgezeichnet"
              value={formatDt(location.recordedAtISO)}
            />
          </div>

          <div style={{display: 'flex', gap: 8, marginTop: 20}}>
            <a
              href={navigateUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                height: 40,
                borderRadius: 8,
                background: GOLD,
                color: '#000',
                fontSize: 14,
                fontWeight: 600,
                textDecoration: 'none',
                cursor: 'pointer'
              }}>
              Route planen
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailRow({label, value}: {label: string; value: string}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderRadius: 8,
        background: '#f9fafb'
      }}>
      <span style={{fontSize: 13, color: '#6b7280'}}>{label}</span>
      <span style={{fontSize: 13, fontWeight: 500, fontFamily: 'monospace'}}>
        {value}
      </span>
    </div>
  )
}

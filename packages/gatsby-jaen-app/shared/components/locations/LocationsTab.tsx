/**
 * The dispatcher's map of everybody: the map, its filter, and the sheet
 * with one row's details when a marker is tapped.
 *
 * The rows come in from the view, already decorated with the drivers'
 * colours. This component keeps the kind filter and the selection and
 * nothing else. The sheet is a Chakra drawer, so it follows the site's
 * colour mode like every other surface in the app.
 */
import {useState, useMemo, useCallback} from 'react'
import {CloseButton, DataList, Drawer, HStack, Portal, Text} from '@chakra-ui/react'
import {FaMapMarkerAlt} from '@react-icons/all-files/fa/FaMapMarkerAlt'
import {useI18nCode} from '../../i18n'
import {getI18nTracking} from '../../locales/i18nTracking'
import {DriverColorDot} from '../DriverColor'
import {DialogActions} from '../DialogActions'
import {LocationMapView} from './LocationMapView'
import {rowColorFor} from './mapbox-token'

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
  /** The driver's hex, undefined for a customer and for a driver who never chose. */
  color?: string
  /** The person's name when the view could resolve it. */
  name?: string
}

export type KindFilter = 'all' | 'driver' | 'customer'

export interface LocationsTabProps {
  locations: LocationRow[]
  isLoading: boolean
  error?: string | null
  onRefresh: () => void
}

export function LocationsTab({locations, isLoading, error: _error, onRefresh}: LocationsTabProps) {
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [selected, setSelected] = useState<LocationRow | null>(null)

  const filtered = useMemo(() => {
    if (kindFilter === 'all') return locations
    return locations.filter(l => l.kind === kindFilter)
  }, [locations, kindFilter])

  const handleSelect = useCallback((loc: LocationRow) => setSelected(loc), [])
  const handleClose = useCallback(() => setSelected(null), [])

  return (
    <div style={{position: 'relative', height: '100%', overflow: 'hidden'}}>
      <LocationMapView
        locations={filtered}
        isLoading={isLoading}
        kindFilter={kindFilter}
        onKindFilterChange={setKindFilter}
        onSelect={handleSelect}
        selectedLocation={selected}
        onRefresh={onRefresh}
      />
      <LocationDetailDrawer location={selected} onClose={handleClose} />
    </div>
  )
}

/** The colour a row is drawn in: the driver's own, blue for a customer. */
export const rowColor = (row: LocationRow): string => rowColorFor(row.kind, row.color)

function LocationDetailDrawer({location, onClose}: {location: LocationRow | null; onClose: () => void}) {
  const code = useI18nCode()
  const {strings: t} = getI18nTracking(code)

  const formatDt = (iso?: string) => {
    if (!iso) return '–'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString(code)
  }
  const formatCoord = (n: number) =>
    Number.isFinite(n) ? new Intl.NumberFormat('en-US', {maximumFractionDigits: 6}).format(n) : '–'

  const navigateUrl = location
    ? `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`
    : undefined

  return (
    <Drawer.Root open={!!location} placement="bottom" onOpenChange={e => !e.open && onClose()}>
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content roundedTop="surface" maxH="70vh">
            <Drawer.Header>
              <HStack gap="3">
                <DriverColorDot color={location ? rowColor(location) : undefined} size="4" />
                <Drawer.Title>
                  {location?.name || (location?.kind === 'driver' ? t.KindDriver : t.KindCustomer)}
                </Drawer.Title>
              </HStack>
              {location && (
                <Text textStyle="xs" color="fg.muted" fontFamily="mono" truncate>
                  {location.userId}
                </Text>
              )}
              <Drawer.CloseTrigger asChild>
                <CloseButton size="sm" aria-label={t.Close} />
              </Drawer.CloseTrigger>
            </Drawer.Header>
            <Drawer.Body>
              {location && (
                <DataList.Root orientation="horizontal" size="sm">
                  <DataList.Item>
                    <DataList.ItemLabel>{t.Latitude}</DataList.ItemLabel>
                    <DataList.ItemValue fontFamily="mono">{formatCoord(location.latitude)}</DataList.ItemValue>
                  </DataList.Item>
                  <DataList.Item>
                    <DataList.ItemLabel>{t.Longitude}</DataList.ItemLabel>
                    <DataList.ItemValue fontFamily="mono">{formatCoord(location.longitude)}</DataList.ItemValue>
                  </DataList.Item>
                  <DataList.Item>
                    <DataList.ItemLabel>{t.Accuracy}</DataList.ItemLabel>
                    <DataList.ItemValue>
                      {typeof location.accuracy === 'number' ? `${Math.round(location.accuracy)} m` : '–'}
                    </DataList.ItemValue>
                  </DataList.Item>
                  <DataList.Item>
                    <DataList.ItemLabel>{t.UpdatedAt}</DataList.ItemLabel>
                    <DataList.ItemValue>{formatDt(location.updatedAtISO)}</DataList.ItemValue>
                  </DataList.Item>
                  <DataList.Item>
                    <DataList.ItemLabel>{t.RecordedAt}</DataList.ItemLabel>
                    <DataList.ItemValue>{formatDt(location.recordedAtISO)}</DataList.ItemValue>
                  </DataList.Item>
                </DataList.Root>
              )}
            </Drawer.Body>
            {navigateUrl && (
              <Drawer.Footer>
                <DialogActions
                  href={navigateUrl}
                  confirmLabel={
                    <>
                      <FaMapMarkerAlt /> {t.PlanRoute}
                    </>
                  }
                />
              </Drawer.Footer>
            )}
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  )
}

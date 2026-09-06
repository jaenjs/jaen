/**
 * The map of where everybody is, for the dispatcher.
 *
 * The map itself, its filter chips and the detail sheet are the components
 * under ../components/locations. This view is the frame around them: it
 * gives the map the full height of the screen below the sticky bars, says
 * out loud when the read failed, and decorates every driver row with the
 * driver's colour and name before the map draws it. The backend answers a
 * driver with their own position only and a customer with FORBIDDEN, so
 * that error is worth showing.
 *
 * The colours come from getDriverColor, one call per driver, cached for the
 * tab. The names come from the driver directory, which only an admin may
 * read, so a driver looking at their own dot sees their id and no name.
 */
import {useMemo} from 'react'
import {Box, Flex, Skeleton} from '@chakra-ui/react'
import {useCaller} from '../auth'
import {useDrivers, useLocations, type ResourceUser} from '../hooks'
import {useDriverColors} from '../hooks/tracking'
import {LocationsTab, type LocationRow} from '../components/locations'
import {ErrorBanner, PageHeader} from '../components'
import {useI18nCode} from '../i18n'
import {getI18nCommon} from '../locales/i18nCommon'

/**
 * The directory is an admin read, so the hook that asks for it is only
 * mounted for an admin: a driver looking at their own dot would otherwise
 * send a request the backend refuses on every visit.
 */
const NOBODY: ResourceUser[] = []

export function LocationsView() {
  const caller = useCaller()
  if (caller.loading) return <LocationsSkeleton />
  return caller.isAdmin ? <AdminLocations /> : <Locations drivers={NOBODY} />
}

/** The frame with its heading and the map's place in grey until the roles are known. */
function LocationsSkeleton() {
  const code = useI18nCode()
  const tc = getI18nCommon(code).strings
  return (
    <Flex direction="column" h="calc(100dvh - 4rem)" minH="24rem" maxW="full" data-skeleton="map" aria-busy="true">
      <Box px={{base: '4', md: '6'}} pt={{base: '4', md: '6'}} pb="4">
        <PageHeader title={tc.NavLocations} />
      </Box>
      <Skeleton flex="1" minH="20rem" rounded="0" />
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
  const {locations, isLoading, error, refetch} = useLocations()

  const driverIds = useMemo(
    () => Array.from(new Set(locations.filter(l => l.kind === 'driver').map(l => l.userId))),
    [locations]
  )
  const colors = useDriverColors(driverIds)

  const rows = useMemo<LocationRow[]>(
    () =>
      locations.map(l => {
        if (l.kind !== 'driver') return l
        const person = drivers.find(d => d.id === l.userId)
        const name = person
          ? `${person.details?.firstName ?? ''} ${person.details?.lastName ?? ''}`.trim() || person.username
          : undefined
        return {...l, color: colors[l.userId] ?? person?.driverColor, name}
      }),
    [locations, colors, drivers]
  )

  return (
    // The CMS frame is 4rem and sticky, the heading takes its own height, and
    // the map fills what is left. Nothing sits at the bottom of the viewport.
    <Flex direction="column" h="calc(100dvh - 4rem)" minH="24rem" maxW="full">
      <Box px={{base: '4', md: '6'}} pt={{base: '4', md: '6'}} pb="4">
        <PageHeader title={tc.NavLocations} />
      </Box>
      <Box position="relative" flex="1" minH="20rem" overflow="hidden" bg="bg.canvas">
        {error && (
          <Box position="absolute" top="3" insetX="3" zIndex="docked">
            <ErrorBanner message={error} onRetry={refetch} />
          </Box>
        )}
        <LocationsTab locations={rows} isLoading={isLoading} error={error} onRefresh={refetch} />
      </Box>
    </Flex>
  )
}

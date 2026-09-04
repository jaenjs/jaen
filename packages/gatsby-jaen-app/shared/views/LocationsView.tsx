import {useLocations} from '../hooks'
import {LocationsTab} from '../components/locations'

export function LocationsView() {
  const {locations, isLoading, error, refetch} = useLocations()

  return (
    <div style={{height: '100%', overflow: 'hidden'}}>
      <LocationsTab
        locations={locations}
        isLoading={isLoading}
        error={error}
        onRefresh={refetch}
      />
    </div>
  )
}

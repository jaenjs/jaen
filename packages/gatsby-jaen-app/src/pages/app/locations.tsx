import {PageConfig} from 'jaen'
import {PageProps, navigate as gatsbyNavigate} from 'gatsby'
import React from 'react'
import {AppWrapper} from '../../AppWrapper'
import {LocationsView} from '../../../shared/views/LocationsView'

const LocationsPage: React.FC<PageProps> = () => {
  const nav = React.useMemo(() => ({
    navigate: (path: string) => gatsbyNavigate(`/app${path}`),
    params: {}
  }), [])

  return (
    <AppWrapper nav={nav}>
      <LocationsView />
    </AppWrapper>
  )
}

export default LocationsPage

export const pageConfig: PageConfig = {
  label: 'Locations',
  icon: 'FaMapMarkerAlt',
  menu: {
    order: 25,
    type: 'app'
  },
  auth: {
    isRequired: false
  },
  layout: {
    name: 'jaen',
    type: 'full'
  }
}

export {Head} from 'jaen'

import {PageConfig} from 'jaen'
import {PageProps, navigate as gatsbyNavigate} from 'gatsby'
import React from 'react'
import {AppWrapper} from '../../AppWrapper'
import {DashboardView} from '../../../shared/views/DashboardView'

const DashboardPage: React.FC<PageProps> = () => {
  const nav = React.useMemo(() => ({
    navigate: (path: string) => gatsbyNavigate(`/app${path}`),
    params: {}
  }), [])

  return (
    <AppWrapper nav={nav}>
      <DashboardView />
    </AppWrapper>
  )
}

export default DashboardPage

export const pageConfig: PageConfig = {
  label: 'Dashboard',
  icon: 'FaTachometerAlt',
  menu: {
    order: 5,
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

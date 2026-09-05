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
  // No `menu` here: the frame would list this page for every signed-in
  // person, in English, in an unlabelled group beside the brand's. The app
  // registers its entries itself, per role and per language, see
  // src/components/useFrameMenu.ts.
  // Every /app route is for a signed-in person. jaen sends anybody else to
  // /login and brings them back here afterwards. Which role they need is the
  // backend's decision, made per field, and the shell's, made per nav item.
  auth: {
    isRequired: true
  },
  layout: {
    name: 'jaen',
    type: 'full'
  }
}

export {Head} from 'jaen'

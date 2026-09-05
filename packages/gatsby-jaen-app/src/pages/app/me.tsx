import {PageConfig} from 'jaen'
import {PageProps, navigate as gatsbyNavigate} from 'gatsby'
import React from 'react'
import {AppWrapper} from '../../AppWrapper'
import {MeView} from '../../../shared/views/MeView'

/**
 * The driver's own page. The shell offers it to the driver role only, and the
 * view says so to anybody else. Nothing on it is admin business: the colour is
 * the driver's own account, the two switches are this phone's.
 */
const MePage: React.FC<PageProps> = () => {
  const nav = React.useMemo(() => ({
    navigate: (path: string) => gatsbyNavigate(`/app${path}`),
    params: {}
  }), [])

  return (
    <AppWrapper nav={nav}>
      <MeView />
    </AppWrapper>
  )
}

export default MePage

export const pageConfig: PageConfig = {
  label: 'Me',
  icon: 'FaUserCircle',
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

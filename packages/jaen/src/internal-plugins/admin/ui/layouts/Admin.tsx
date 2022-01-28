// Chakra imports
import {ChakraProvider} from '@chakra-ui/react'
import {RouteComponentProps} from '@reach/router'
import React, {useState} from 'react'
import {pluginStore} from '../../../../plugins'
// Custom Chakra theme
import theme from '../../../../theme/theme'
import {AdminFunctions, IRoute} from '../../AdminPlugin'
import Footer from '../components/Footer/Footer'
// Custom components
import MainPanel from '../components/Layout/MainPanel'
import PanelContainer from '../components/Layout/PanelContainer'
import PanelContent from '../components/Layout/PanelContent'
import Sidebar from '../components/Sidebar/Sidebar'

export default function Dashboard(props: RouteComponentProps) {
  const {...rest} = props

  //const pluginStore = usePluginStore()

  const dashRoutes = pluginStore.executeFunction(
    AdminFunctions.getRoutes
  ) as IRoute[]

  // states and functions
  const [sidebarVariant, setSidebarVariant] = useState('transparent')
  const [fixed, setFixed] = useState(false)
  // ref for main panel div
  const mainPanel = React.createRef()

  const getActiveRoute = (routes: IRoute[]): string => {
    let activeRoute = 'Default Brand Text'
    for (let i = 0; i < routes.length; i++) {
      if (routes[i].collapse && routes[i].views) {
        let collapseActiveRoute = getActiveRoute(routes[i].views as IRoute[])
        if (collapseActiveRoute !== activeRoute) {
          return collapseActiveRoute
        }
      } else if (routes[i].category && routes[i].views) {
        let categoryActiveRoute = getActiveRoute(routes[i].views as IRoute[])
        if (categoryActiveRoute !== activeRoute) {
          return categoryActiveRoute
        }
      } else {
        if (
          window.location.href.indexOf(routes[i].layout + routes[i].path) !== -1
        ) {
          return routes[i].name
        }
      }
    }
    return activeRoute
  }
  // This changes navbar state(fixed or not)
  const getActiveNavbar = (routes: IRoute[]): boolean => {
    let activeNavbar = false
    for (let i = 0; i < routes.length; i++) {
      if (routes[i].category && routes[i].views) {
        let categoryActiveNavbar = getActiveNavbar(routes[i].views as IRoute[])
        if (categoryActiveNavbar !== activeNavbar) {
          return categoryActiveNavbar
        }
      } else {
        if (
          window.location.href.indexOf(routes[i].layout + routes[i].path) !== -1
        ) {
          if (routes[i].secondaryNavbar) {
            return !!routes[i].secondaryNavbar
          }
        }
      }
    }
    return activeNavbar
  }

  document.documentElement.dir = 'ltr'

  const View = dashRoutes.find(
    route => route.name === getActiveRoute(dashRoutes)
  )?.component

  // Chakra Color Mode
  return (
    <ChakraProvider theme={theme} resetCSS={false} portalZIndex={10000}>
      <Sidebar routes={dashRoutes} logoText={'JAEN ADMIN'} {...rest} />

      <MainPanel
        ref={mainPanel}
        w={{
          base: '100%',
          xl: 'calc(100% - 275px)'
        }}>
        <PanelContent>
          <PanelContainer>{View && <View />}</PanelContainer>
        </PanelContent>

        <Footer />
      </MainPanel>
    </ChakraProvider>
  )
}

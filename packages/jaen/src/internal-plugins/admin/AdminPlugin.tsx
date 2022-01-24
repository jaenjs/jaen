import {IPlugin, PluginStore} from 'react-pluggable'

export interface IRoute {
  name: string
  path: string
  layout: string
  icon?: string
  component?: React.ComponentType
  category?: string
  views?: IRoute[]
  collapse?: boolean
  secondaryNavbar?: boolean
}

export enum RendererPlacements {
  TOOLBAR = 'toolbar',
  TOOLBAR_MENU = 'toolbar-menu'
}

export enum AdminFunctions {
  getRoutes = 'Admin.getRoutes',
  addRoute = 'Admin.addRoute',
  addToolbarItem = 'Admin.addToolbarItem',
  addToolbarMenuItem = 'Admin.addToolbarMenuItem'
}

class AdminPlugin implements IPlugin {
  pluginStore!: PluginStore
  routes: IRoute[] = []

  getPluginName(): string {
    return 'JaenAdmin@0.0.1'
  }

  getDependencies(): string[] {
    return ['Renderer@1.0.0']
  }

  init(pluginStore: PluginStore): void {
    this.pluginStore = pluginStore
  }

  addRendererFunction(afn: AdminFunctions, placement: RendererPlacements) {
    this.pluginStore.addFunction(afn, (item: JSX.Element) => {
      this.pluginStore.executeFunction('Renderer.add', placement, () => item)
    })
  }

  activate(): void {
    this.pluginStore.addFunction(AdminFunctions.addRoute, (route: IRoute) => {
      this.routes.push(route)
    })

    this.pluginStore.addFunction(AdminFunctions.getRoutes, () => {
      return this.routes
    })

    this.addRendererFunction(
      AdminFunctions.addToolbarItem,
      RendererPlacements.TOOLBAR
    )
    this.addRendererFunction(
      AdminFunctions.addToolbarMenuItem,
      RendererPlacements.TOOLBAR_MENU
    )
  }

  deactivate(): void {
    this.pluginStore.removeFunction('sendAlert')
  }
}

export default AdminPlugin

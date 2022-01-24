import {IPlugin, PluginStore} from 'react-pluggable'
import {IRoute} from './routes'

export enum AdminFunctions {
  getRoutes = 'Admin.getRoutes',
  addRoute = 'Admin.addRoute'
}

class AdminPlugin implements IPlugin {
  pluginStore!: PluginStore
  routes: IRoute[] = []

  getPluginName(): string {
    return 'JaenAdmin'
  }

  getDependencies(): string[] {
    return []
  }

  init(pluginStore: PluginStore): void {
    this.pluginStore = pluginStore
  }

  activate(): void {
    this.pluginStore.addFunction(AdminFunctions.addRoute, (route: IRoute) => {
      this.routes.push(route)
    })

    this.pluginStore.addFunction(AdminFunctions.getRoutes, () => {
      return this.routes
    })
  }

  deactivate(): void {
    this.pluginStore.removeFunction('sendAlert')
  }
}

export default AdminPlugin

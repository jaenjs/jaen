import {PluginStore} from 'react-pluggable'
import {IJaenPlugin} from '../../plugins'
import {updateEntity} from '../../services/migration'
import {AdminFunctions} from '../admin/AdminPlugin'
import {runPublish} from './services/publish'

class NotifyPlugin implements IJaenPlugin {
  pluginStore!: PluginStore

  getPluginName(): string {
    // Do not change this because it is used in the migrations
    // When changing this, the migrations based on this plugin will not be
    // executed anymore.
    return 'JaenNotify@0.0.1'
  }

  getDependencies(): string[] {
    return []
  }

  init(pluginStore: PluginStore): void {
    this.pluginStore = pluginStore
  }

  activate(): void {
    this.pluginStore.executeFunction(AdminFunctions.addRoute, {
      path: '/notifications',
      name: 'Notifications',
      rtlName: 'لوحة القيادة',
      icon: null,
      component: null,
      layout: ''
    })
  }

  deactivate(): void {
    //
  }

  async migrate(base: any, migration: any) {
    for (const id of Object.keys(migration)) {
      base[id] = await updateEntity(base[id], migration[id])
    }

    return base
  }

  async publishData(): Promise<any> {
    return await runPublish()
  }
}

export default NotifyPlugin

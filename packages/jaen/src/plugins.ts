import {createPluginStore, IPlugin, RendererPlugin} from 'react-pluggable'
import AdminPlugin from './internal-plugins/admin/AdminPlugin'
import NotifyPlugin from './internal-plugins/notify/NotifyPlugin'
import PagesPlugin from './internal-plugins/pages/PagesPlugin'

export const pluginStore = createPluginStore()

export interface IJaenPlugin extends IPlugin {
  /**
   * Defines how the plugin handles a migration.
   *
   * @param base - old data
   * @param migration - new migration
   */
  migrate(base: any | undefined, migration: any): any
}

export const migrationPlugins = [new PagesPlugin(), new NotifyPlugin()]

const installPlugins = () => {
  pluginStore.install(new RendererPlugin())

  if (typeof window !== 'undefined') {
    pluginStore.install(new AdminPlugin())

    for (const plugin of migrationPlugins) {
      pluginStore.install(plugin)
    }
  }
}

installPlugins()

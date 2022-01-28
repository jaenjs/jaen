import {createPluginStore, IPlugin, RendererPlugin} from 'react-pluggable'
import AdminPlugin from './internal-plugins/admin/AdminPlugin'
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

const installPlugins = () => {
  pluginStore.install(new RendererPlugin())

  if (typeof window !== 'undefined') {
    pluginStore.install(new AdminPlugin())
    pluginStore.install(new PagesPlugin())
  }
}

installPlugins()

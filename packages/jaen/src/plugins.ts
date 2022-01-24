import {createPluginStore, IPlugin, RendererPlugin} from 'react-pluggable'
import AdminPlugin from './internal-plugins/admin/AdminPlugin'
import PagesPlugin from './internal-plugins/pages/PagesPlugin'

export enum Placements {
  HOTBAR = 'HOTBAR',
  CONTENT = 'CONTENT'
}

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

export const migrationPlugins: IJaenPlugin[] = [new PagesPlugin()]
export const plugins: IPlugin[] = [
  new RendererPlugin(),
  new AdminPlugin(),
  ...migrationPlugins
]

for (const plugin of plugins) {
  pluginStore.install(plugin)
}

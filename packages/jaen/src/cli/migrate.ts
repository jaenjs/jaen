// jaen-data/
//  jaen-pages.json
//  jaen-settings.json
//  jaen-core.json
//
// files are dependent on the registered plugins

import {plugins} from '../plugins'

const a = plugins
interface IJaenMigrate {
  incomingMigrationUrl: string
  incomingMigrationData: {
    [pluginName: string]: any
  }
}

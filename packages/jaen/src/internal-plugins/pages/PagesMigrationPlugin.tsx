import {updateEntity} from '@jaen/services/migration'
import {IJaenPlugin} from '../../plugins'
import {runPublish} from './internal/services/publish'
import {IPagesMigrationBase} from './types'

export default class PagesMigrationPlugin implements IJaenPlugin {
  getPluginName(): string {
    return 'JaenPages@0.0.1'
  }
  async migrate(base: IPagesMigrationBase, migration: IPagesMigrationBase) {
    for (const id of Object.keys(migration)) {
      base[id] = await updateEntity(base[id], {
        context: migration[id]
      } as any)
    }

    return base
  }

  async publishData() {
    return await runPublish()
  }
}

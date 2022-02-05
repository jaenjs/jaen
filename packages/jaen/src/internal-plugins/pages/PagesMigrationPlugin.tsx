import {updateEntity} from '@jaen/services/migration'
import {IJaenPlugin} from '../../plugins'
import {runPublish} from './internal/services/publish'
import {IPagesMigration, IPagesMigrationBase} from './types'

export default class PagesMigrationPlugin implements IJaenPlugin {
  getPluginName(): string {
    return 'JaenPages@0.0.1'
  }
  async migrate(base: IPagesMigrationBase, migration: IPagesMigration) {
    console.log('Migrating Pages base migration', base, migration)
    for (const id of Object.keys(migration.pages)) {
      console.log('Migrating Page', id)
      base[id] = await updateEntity(base[id], migration.pages[id])
    }

    return base
  }

  async publishData() {
    return await runPublish()
  }
}

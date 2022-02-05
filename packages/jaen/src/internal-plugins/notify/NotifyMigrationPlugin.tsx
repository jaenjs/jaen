import {updateEntity} from '@jaen/services/migration'
import {IJaenPlugin} from '../../plugins'
import {runPublish} from './services/publish'
import {INotificationsMigration, INotificationsMigrationBase} from './types'

export default class NotifyMigrationPlugin implements IJaenPlugin {
  getPluginName(): string {
    return 'JaenNotify@0.0.1'
  }
  async migrate(
    base: INotificationsMigrationBase,
    migration: INotificationsMigration
  ) {
    console.log('Migrating Notify', base)
    console.log('Migrating Notify', migration)
    for (const id of Object.keys(migration.notifications)) {
      base[id] = await updateEntity(base[id], migration.notifications[id])
    }

    return base
  }

  async publishData() {
    return await runPublish()
  }
}

import {updateEntity} from '@jaen/services/migration'
import {IJaenPlugin} from '../../plugins'
import {runPublish} from './services/publish'
import {INotificationsMigrationBase} from './types'

export default class NotifyMigrationPlugin implements IJaenPlugin {
  getPluginName(): string {
    return 'JaenNotify@0.0.1'
  }
  async migrate(
    base: INotificationsMigrationBase,
    migration: INotificationsMigrationBase
  ) {
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

import {IBaseEntity, IMigrationEntity} from '../../'

export interface INotification {
  id: string // relative path to the notification file
  jaenFields: {
    [type: string]: {
      [name: string]: any
    }
  } | null
}

export interface INotificationsMigrationBase {
  [uuid: string]: IBaseEntity
}

export type INotificationsMigration = {
  [uuid: string]: IMigrationEntity
}

import NotifyMigrationPlugin from '@jaen/internal-plugins/notify/NotifyMigrationPlugin'
import PagesMigrationPlugin from '@jaen/internal-plugins/pages/PagesMigrationPlugin'
import fs from 'fs'
import update from 'immutability-helper'
import fetch from 'node-fetch'
import {nodejsSafeJsonUpload} from '../openStorageGateway'
import {
  IBaseEntity,
  IMigrationEntity,
  IMigrationURLData,
  IRemoteFileMigration
} from './types'
const JAEN_STATIC_DATA_DIR = './jaen-data'

export const migrationPlugins = [
  new PagesMigrationPlugin(),
  new NotifyMigrationPlugin()
]

export const downloadMigrationURL = async (
  url: string
): Promise<IMigrationURLData> => await (await fetch(url)).json()

export const downloadMigrationContext = async (
  entity: IMigrationEntity
): Promise<object> => await (await fetch(entity.context.fileUrl)).json()

export const downloadBaseContext = async (
  entity: IBaseEntity
): Promise<object> => await (await fetch(entity.context.fileUrl)).json()

const uploadMigration = async (data: object): Promise<IRemoteFileMigration> => {
  const fileUrl = await nodejsSafeJsonUpload(JSON.stringify(data))

  const newMigration = {
    createdAt: new Date().toISOString(),
    fileUrl
  }

  return newMigration
}

export const updateEntity = async (
  baseEntity: IBaseEntity | undefined,
  migrationData: object
) => {
  // check if baseEntity is not a empty object

  if (!baseEntity?.context) {
    console.log('baseEntity is undefined', baseEntity, migrationData)
    const newMigration = await uploadMigration(migrationData)
    return {
      context: newMigration,
      migrations: [newMigration]
    }
  } else {
    const baseData = await downloadBaseContext(baseEntity)
    // !TODO: Implement merging logic
    const mergedData = {...baseData, ...migrationData} as any //merge(baseData, migrationData) as object

    console.log('a', mergedData)
    const newMigration = await uploadMigration(mergedData)

    return update(baseEntity, {
      context: {$set: newMigration},
      migrations: {$push: [newMigration]}
    })
  }
}

export const runMigration = async (migrationUrl: string) => {
  if (!fs.existsSync(JAEN_STATIC_DATA_DIR)) {
    throw new Error('JAEN_STATIC_DATA_DIR does not exist')
  }

  if (migrationUrl) {
    const migrationData = await downloadMigrationURL(migrationUrl)

    await Promise.all(
      Object.entries(migrationData).map(async ([pluginName, entity]) => {
        const plugin = migrationPlugins.find(
          p => p.getPluginName() === pluginName
        )

        if (plugin) {
          const filePath = `${JAEN_STATIC_DATA_DIR}/${pluginName}.json`

          let baseEntity

          try {
            if (!fs.existsSync(filePath)) {
              fs.writeFileSync(filePath, '{}')
            }

            baseEntity = JSON.parse(fs.readFileSync(filePath, 'utf8'))
          } catch (e) {
            console.warn('Base entity not found for plugin', pluginName)
            console.warn('Creating new base entity')

            fs.writeFileSync(filePath, JSON.stringify({}))
          }

          const newBaseEntityContext = await plugin.migrate(baseEntity, entity)

          fs.writeFileSync(
            filePath,
            JSON.stringify(newBaseEntityContext, null, 2)
          )
        }
      })
    )
  }
}

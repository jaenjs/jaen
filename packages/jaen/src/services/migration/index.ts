import fs from 'fs'
import update from 'immutability-helper'
import {migrationPlugins} from '../../plugins'
import {nodejsSafeJsonUpload} from '../openStorageGateway'
import {IBaseEntity, IMigrationEntity, IMigrationURLData} from './types'
const JAEN_STATIC_DATA_DIR = './jaen-data'

export const downloadMigrationURL = async (
  url: string
): Promise<IMigrationURLData> => await (await fetch(url)).json()

export const downloadMigrationContext = async (
  entity: IMigrationEntity
): Promise<object> => await (await fetch(entity.context.fileUrl)).json()

export const downloadBaseContext = async (
  entity: IBaseEntity
): Promise<object> => await (await fetch(entity.context.fileUrl)).json()

export const updateEntity = async (
  baseEntity: IBaseEntity | undefined,
  migrationEntity: IMigrationEntity
) => {
  const migrationContext = migrationEntity.context

  // check if baseEntity is not a empty object

  if (!baseEntity?.context) {
    return {context: migrationContext, migrations: [migrationContext]}
  } else {
    const baseData = await downloadBaseContext(baseEntity)
    const migrationData = await downloadMigrationContext(migrationEntity)

    //   console.log('fetch done', typeof baseData, typeof migrationData)

    // !TODO: Implement merging logic
    const mergedData = {...baseData, ...migrationData} as any //merge(baseData, migrationData) as object
    const fileUrl = await nodejsSafeJsonUpload(JSON.stringify(mergedData))

    const context = {
      createdAt: migrationContext.createdAt,
      fileUrl
    }

    return update(baseEntity, {
      context: {$set: context},
      migrations: {$push: [migrationContext]}
    })
  }
}

export const runMigration = async (migrationUrl: string) => {
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

import NotifyMigrationPlugin from '@jaen/internal-plugins/notify/NotifyMigrationPlugin'
import PagesMigrationPlugin from '@jaen/internal-plugins/pages/PagesMigrationPlugin'
import fs from 'fs'
import update from 'immutability-helper'
import fetch from 'node-fetch'
import {nodejsSafeJsonUpload} from '../openStorageGateway'
import {IBaseEntity, IMigrationEntity, IMigrationURLData} from './types'
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

export const updateEntity = async (
  baseEntity: IBaseEntity | undefined,
  migrationEntity: IMigrationEntity
) => {
  console.log(`Updating ${JSON.stringify(migrationEntity)}`)
  const migrationContext = migrationEntity.context

  // check if baseEntity is not a empty object

  console.log('migrationContext', migrationContext)

  if (!baseEntity?.context) {
    return {context: migrationContext, migrations: [migrationContext]}
  } else {
    const baseData = await downloadBaseContext(baseEntity)
    const migrationData = await downloadMigrationContext(migrationEntity)

    console.log('baseData', baseData)
    console.log('migrationData', migrationData)

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
  console.log('runMigration', migrationUrl)

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

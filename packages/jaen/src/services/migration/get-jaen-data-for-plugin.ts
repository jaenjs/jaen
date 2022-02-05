import fs from 'fs'
import {downloadBaseContext, JAEN_STATIC_DATA_DIR} from '.'
import {IBaseEntity} from '../../'

export async function getJaenDataForPlugin<T>(pluginName: string): Promise<T> {
  const filePath = `${JAEN_STATIC_DATA_DIR}/${pluginName}.json`

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '{}')
  }

  const baseEntity: IBaseEntity = JSON.parse(fs.readFileSync(filePath, 'utf8'))

  return await downloadBaseContext(baseEntity)
}

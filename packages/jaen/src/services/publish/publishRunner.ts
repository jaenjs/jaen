import {migrationPlugins} from '../migration/run-migration'
import {upload} from '../openStorageGateway'
import * as snekApi from '../api'

const runPluginsToGetMergedData = async () => {
  const data: any = {}
  for (const plugin of migrationPlugins) {
    const pluginData = await plugin.publishData()
    alert(`${plugin.getPluginName()} data: ${JSON.stringify(pluginData)}`)
    data[plugin.getPluginName()] = pluginData
  }
  return data
}

export const publishRunner = async () => {
  const data = await runPluginsToGetMergedData()
  const fileUrl = await upload(data)
  //@ts-ignore
  const jaenProjectId: number = ___JAEN_PROJECT_ID___

  try {
    await snekApi.publishProject(jaenProjectId, fileUrl)
    return true
  } catch (e) {
    return false
  }
}

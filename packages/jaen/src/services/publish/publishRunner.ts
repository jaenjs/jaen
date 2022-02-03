import {migrationPlugins} from '../migration'
import {upload} from '../openStorageGateway'

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
  alert('publishRunner')
  const data = await runPluginsToGetMergedData()
  const fileUrl = await upload(data)

  alert(fileUrl)

  return true
}

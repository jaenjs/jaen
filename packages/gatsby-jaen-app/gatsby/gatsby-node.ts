import {GatsbyNode, PluginOptions} from 'gatsby'
import path from 'path'

export interface JaenAppPluginOptions extends PluginOptions {
  pylonUrl?: string
}

export const pluginOptionsSchema: GatsbyNode['pluginOptionsSchema'] = ({
  Joi
}) => {
  return Joi.object({
    pylonUrl: Joi.string()
  })
}

export const onCreateWebpackConfig: GatsbyNode['onCreateWebpackConfig'] =
  async ({actions, plugins, getConfig}, pluginOptions: JaenAppPluginOptions) => {
    const config = getConfig()
    const previewDir = path.resolve(__dirname, '../../preview')

    if (config.module?.rules) {
      for (const rule of config.module.rules) {
        if (rule && typeof rule === 'object' && rule.test) {
          if (!rule.exclude) {
            rule.exclude = [previewDir]
          } else if (Array.isArray(rule.exclude)) {
            rule.exclude.push(previewDir)
          } else {
            rule.exclude = [rule.exclude, previewDir]
          }
        }
      }
    }

    actions.replaceWebpackConfig(config)

    actions.setWebpackConfig({
      plugins: [
        plugins.define({
          __JAEN_APP_PYLON_URL__: JSON.stringify(pluginOptions.pylonUrl)
        })
      ]
    })
  }

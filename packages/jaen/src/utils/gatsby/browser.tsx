import {GatsbyBrowser} from 'gatsby'
import {JaenPluginOptions} from 'utils/types'

import {JaenProvider} from '../providers/JaenProvider'

export const wrapRootElement: GatsbyBrowser['wrapRootElement'] = (
  {element},
  pluginOptions: JaenPluginOptions
) => {
  const {templates} = pluginOptions

  return <JaenProvider templatesPaths={templates.paths}>{element}</JaenProvider>
}

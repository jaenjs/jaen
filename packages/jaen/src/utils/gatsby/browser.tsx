import {GatsbyBrowser} from 'gatsby'

import {JaenProvider} from '@src/utils/providers/JaenProvider'

import {Dashboard} from '../../containers/dashboard/index'
import {JaenPluginOptions} from '../types'

export const wrapRootElement: GatsbyBrowser['wrapRootElement'] = (
  {element},
  pluginOptions: JaenPluginOptions
) => {
  const {templates} = pluginOptions

  return (
    <>
      <Dashboard />
      <JaenProvider templatesPaths={templates.paths}>{element}</JaenProvider>
    </>
  )
}

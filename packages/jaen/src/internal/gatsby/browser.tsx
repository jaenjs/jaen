import {GatsbyBrowser} from 'gatsby'

import {Dashboard} from '@src/Dashboard'
import {JaenProvider} from '@src/internal/root'

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

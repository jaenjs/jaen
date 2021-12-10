import {ChakraProvider} from '@chakra-ui/react'
import type {GatsbyBrowser, PluginOptions} from 'gatsby'

import jaenTheme from './@chakra-ui/theme'
import {JaenProvider} from './contexts'
import {JaenConfig, JaenTemplate} from './types'

interface JaenPluginOptions extends PluginOptions {
  remote: string
  initialHideUI: boolean
  templates: JaenTemplate[]
}

export const wrapRootElement: GatsbyBrowser['wrapRootElement'] = (
  {element},
  pluginOptions: JaenPluginOptions
) => {
  // @ts-ignore
  const config = require(___JAEN_CONFIG___) as JaenConfig

  const {remote, initialHideUI, templates} = config

  return (
    <ChakraProvider theme={jaenTheme}>
      <JaenProvider templates={templates}>{element}</JaenProvider>
    </ChakraProvider>
  )
}

import {ChakraProvider} from '@chakra-ui/react'
import {Dashboard} from '@src/Dashboard'
import {JaenProvider} from '@src/internal/root'
import {GatsbyBrowser} from 'gatsby'
import * as React from 'react'
import {JaenPluginOptions} from '../types'

export const wrapRootElement: GatsbyBrowser['wrapRootElement'] = (
  {element},
  pluginOptions: JaenPluginOptions
) => {
  const {templates} = pluginOptions

  return (
    <ChakraProvider>
      <Dashboard />
      <JaenProvider templatesPaths={templates.paths}>{element}</JaenProvider>
    </ChakraProvider>
  )
}

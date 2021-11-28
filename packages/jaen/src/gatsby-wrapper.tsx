import {ChakraProvider} from '@chakra-ui/react'
import type {GatsbyBrowser, PluginOptions} from 'gatsby'

import jaenTheme from './@chakra-ui/theme'
import {JaenCoreProvider} from './contexts'
import {CMSProvider} from './contexts/cms'
import TemplateProvider from './contexts/template'
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

  console.log('Config', config)

  return (
    <ChakraProvider theme={jaenTheme}>
      <CMSProvider templates={templates}>
        <JaenCoreProvider remote={remote} initialHideUI={initialHideUI}>
          {element}
        </JaenCoreProvider>
      </CMSProvider>
    </ChakraProvider>
  )
}

export const wrapPageElement: GatsbyBrowser['wrapPageElement'] = (
  {element, props},
  _
) => {
  const {pageContext} = props

  return (
    <TemplateProvider jaenPageContext={pageContext.jaenPageContext as any}>
      {element}
    </TemplateProvider>
  )
}

import {GatsbyBrowser} from 'gatsby'

import {JaenProvider} from '../providers/JaenProvider'

export const wrapRootElement: GatsbyBrowser['wrapRootElement'] = (
  {element},
  _
) => {
  // @ts-ignore
  const config = require(___JAEN_CONFIG___) as JaenConfig

  const {remote, initialHideUI, templates} = config

  return <JaenProvider templates={templates}>{element}</JaenProvider>
}

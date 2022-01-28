import {SnekFinder} from '@jaen/withSnekFinder'
import type {GatsbyBrowser} from 'gatsby'
import {PluginProvider} from 'react-pluggable'
import {pluginStore} from './src'

export const wrapRootElement: GatsbyBrowser['wrapRootElement'] = ({
  element
}) => {
  return (
    <PluginProvider pluginStore={pluginStore}>
      <SnekFinder>{element}</SnekFinder>
    </PluginProvider>
  )
}

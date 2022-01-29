import type {GatsbyBrowser} from 'gatsby'
import {PluginProvider} from 'react-pluggable'
import {pluginStore} from './src'
import {SnekFinder} from './src/withSnekFinder'

export const wrapRootElement: GatsbyBrowser['wrapRootElement'] = ({
  element
}) => {
  return (
    <PluginProvider pluginStore={pluginStore}>
      <SnekFinder>{element}</SnekFinder>
    </PluginProvider>
  )
}

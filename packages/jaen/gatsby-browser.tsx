import {OSGBackend, SnekFinderProvider} from '@jaenjs/snek-finder'
import type {GatsbyBrowser} from 'gatsby'
import {PluginProvider} from 'react-pluggable'
import {pluginStore} from './src'

const Backend = new OSGBackend('snek-finder-osg-backend-root')

const initData = {
  'ae4b3bf8-6ed2-4ac6-bf18-722321af298c': {
    name: 'SF',
    createdAt: '',
    modifiedAt: '',
    isFolder: true,
    childUUIDs: []
  }
}

Backend.onBackendLinkChange = link => {
  console.log('link', link)
}

export const wrapRootElement: GatsbyBrowser['wrapRootElement'] = ({
  element
}) => {
  return (
    <PluginProvider pluginStore={pluginStore}>
      <SnekFinderProvider
        initData={initData as any}
        backend={Backend}
        rootFileId="ae4b3bf8-6ed2-4ac6-bf18-722321af298c">
        {element}
      </SnekFinderProvider>
    </PluginProvider>
  )
}

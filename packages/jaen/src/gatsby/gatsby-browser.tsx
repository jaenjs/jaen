import {OSGBackend, SnekFinderProvider} from '@jaenjs/snek-finder'
import type {GatsbyBrowser as GatsbyBrowserType} from 'gatsby'
import {PluginProvider} from 'react-pluggable'
import {pluginStore} from '../plugins'

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

const GatsbyBrowser: GatsbyBrowserType = {}

GatsbyBrowser.wrapRootElement = element => {
  return (
    <SnekFinderProvider
      initData={initData as any}
      backend={Backend}
      rootFileId="ae4b3bf8-6ed2-4ac6-bf18-722321af298c">
      <PluginProvider pluginStore={pluginStore}>
        <>{element}</>
      </PluginProvider>
    </SnekFinderProvider>
  )
}

export default GatsbyBrowser

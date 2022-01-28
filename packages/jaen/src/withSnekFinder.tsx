import {OSGBackend} from '@jaenjs/snek-finder/src/backends/OSGBackend'
import loadable from '@loadable/component'

const SnekFinderProvider = loadable(() => import('@jaenjs/snek-finder'), {
  resolveComponent: components => components.SnekFinderProvider
})

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

export const SnekFinder: React.FC = ({children}) => {
  return (
    <SnekFinderProvider
      initData={initData as any}
      backend={Backend}
      rootFileId="ae4b3bf8-6ed2-4ac6-bf18-722321af298c">
      {children}
    </SnekFinderProvider>
  )
}

export const withSnekFinder =
  <P extends object>(Component: React.ComponentType<P>): React.FC<P> =>
  props => {
    return (
      <SnekFinder>
        <Component {...props} />
      </SnekFinder>
    )
  }

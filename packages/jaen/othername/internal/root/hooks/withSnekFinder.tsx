import {OSGBackend, SnekFinderProvider} from '@jaenjs/snek-finder'

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

export const withSnekFinder =
  <P extends object>(Component: React.ComponentType<P>): React.FC<P> =>
  props => {
    return (
      <SnekFinderProvider
        backend={Backend}
        initData={initData as any}
        rootFileId="ae4b3bf8-6ed2-4ac6-bf18-722321af298c">
        <Component {...props} />
      </SnekFinderProvider>
    )
  }

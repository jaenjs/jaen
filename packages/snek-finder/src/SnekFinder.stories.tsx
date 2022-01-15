import {Button} from '@chakra-ui/react'
import {Meta} from '@storybook/react'

import OSGBackend from './backends/OSGBackend'
import {FinderData} from './components/organisms/Finder/types'
import SnekFinderProvider, {useSnekFinder} from './contexts/SnekFinderProvider'

//> Story without component

const initData: FinderData = {
  'ae4b3bf8-6ed2-4ac6-bf18-722321af298c': {
    name: 'SF',
    createdAt: '',
    modifiedAt: '',
    isFolder: true,
    childUUIDs: []
  }
}

OSGBackend.onBackendLinkChange = link => {
  console.log('link', link)
}

export default {
  title: 'SnekFinder',
  component: Button,
  decorators: [
    Story => (
      <SnekFinderProvider
        backend={OSGBackend}
        initData={initData}
        rootFileId="ae4b3bf8-6ed2-4ac6-bf18-722321af298c">
        <Story />
      </SnekFinderProvider>
    )
  ]
} as Meta

export const Trigger = () => {
  const {toggle} = useSnekFinder()

  return (
    <Button onClick={() => toggle.open({finderMode: 'selector'})}>Open</Button>
  )
}

export const Element = () => {
  const finder = useSnekFinder()

  return finder.element
}

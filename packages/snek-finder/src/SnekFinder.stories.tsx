import {Button} from '@chakra-ui/react'
import {Meta} from '@storybook/react'
import OSGBackend from './backends/OSGBackend'
import {FinderData} from './components/organisms/Finder/types'
import {SnekFinderProvider} from './SnekFinderProvider'
import {useSnekFinder} from './useSnekFinder'

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

export const ToggleSelector = () => {
  const {finderElement, toggleSelector} = useSnekFinder({
    onAction: action => {
      console.log('action', action)
      if (action.type === 'SELECTOR_SELECT') {
        toggleSelector()
      }
    },
    mode: 'selector'
  })

  return (
    <>
      {finderElement}
      <Button onClick={() => toggleSelector()}>Open</Button>
    </>
  )
}

export const Element = () => {
  const {finderElement} = useSnekFinder({
    onAction: action => console.log('action', action),
    mode: 'browser'
  })

  return finderElement
}

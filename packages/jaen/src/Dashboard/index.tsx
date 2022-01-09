import {Button, ChakraProvider, useDisclosure} from '@chakra-ui/react'
import * as React from 'react'

import * as publish from '@src/internal/publish'
import {withRedux} from '@src/internal/store'

import {default as Component} from './components'
import PublishAlert from './components/PublishAlert'
import {PagesContainer} from './tabs/Pages'

export const Dashboard = withRedux(() => {
  const {isOpen, onClose, onOpen} = useDisclosure()

  const publishAlert = useDisclosure()

  // useCallback for performance
  const handleEditingMode = React.useCallback(() => {}, [])

  const handleDiscardChanges = React.useCallback(() => {}, [])

  const handlePublish = React.useCallback(() => {
    publishAlert.onOpen()
  }, [])

  return (
    <ChakraProvider>
      <Button
        variant="solid"
        colorScheme="blue"
        size="lg"
        onClick={() => onOpen()}>
        Dashboard
      </Button>
      <PublishAlert onConfirm={publish.run} {...publishAlert} />
      <Component
        isOpen={isOpen}
        onClose={onClose}
        onEditingMode={handleEditingMode}
        onDiscardChanges={handleDiscardChanges}
        onPublish={handlePublish}
        tabs={{
          pages: {
            name: 'Pages',
            icon: '',
            element: <PagesContainer />
          }
        }}
      />
    </ChakraProvider>
  )
})

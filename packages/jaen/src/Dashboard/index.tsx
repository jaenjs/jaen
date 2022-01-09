import {Button, ChakraProvider, useDisclosure} from '@chakra-ui/react'
import * as React from 'react'

import {withRedux} from '@src/internal/store/'

import {default as Component} from './components'
import {PagesContainer} from './tabs/Pages'

export const Dashboard = withRedux(() => {
  const {isOpen, onClose, onOpen} = useDisclosure()

  const publishModal = useDisclosure()

  // useCallback for performance
  const handleEditingMode = React.useCallback(() => {}, [])

  const handleDiscardChanges = React.useCallback(() => {}, [])

  const handlePublish = React.useCallback(() => {}, [])

  return (
    <ChakraProvider>
      <Button
        variant="solid"
        colorScheme="blue"
        size="lg"
        onClick={() => onOpen()}>
        Dashboard
      </Button>
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

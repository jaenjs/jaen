import {Button, ChakraProvider, useDisclosure, useToast} from '@chakra-ui/react'
import * as React from 'react'

import * as publish from '@src/internal/publish'
import {useAppDispatch, useAppSelector, withRedux} from '@src/internal/store'
import {
  discardDynamicPaths,
  setEditing
} from '@src/internal/store/slices/generalSlice'
import {discardAllChanges} from '@src/internal/store/slices/pagesSlice'

import {default as Component} from './components'
import DiscardAlert from './components/DiscardAlert'
import PublishAlert from './components/PublishAlert'
import {PagesContainer} from './tabs/Pages'

export const Dashboard = withRedux(() => {
  const dispatch = useAppDispatch()
  const {isOpen, onClose, onOpen} = useDisclosure()

  const toast = useToast()
  const publishAlert = useDisclosure()
  const discardAlert = useDisclosure()
  const isEditing = useAppSelector(state => state.general.isEditing)

  // useCallback for performance
  const handleEditingMode = React.useCallback(() => {
    dispatch(setEditing(!isEditing))

    toast({
      title: isEditing ? 'Editing mode enabled' : 'Editing mode disabled',
      description: isEditing
        ? 'You are now in editing mode. You can now edit the page.'
        : 'You are now in view mode. You can no longer edit the page.',
      status: isEditing ? 'warning' : 'info',
      duration: 5000,
      isClosable: true
    })
  }, [dispatch, isEditing, toast])

  const handleDiscardChanges = React.useCallback(() => {
    discardAlert.onOpen()
  }, [])

  const handlePublish = React.useCallback(() => {
    publishAlert.onOpen()
  }, [])

  const handlePublishConfirm = React.useCallback(async () => {
    dispatch(setEditing(false))
    return publish.run()
  }, [])

  const handleDiscardConfirm = async (): Promise<boolean> => {
    // Simulate a long running operation
    await new Promise(resolve => setTimeout(resolve, 500))

    dispatch(setEditing(false))
    dispatch(discardDynamicPaths())
    dispatch(discardAllChanges())

    return true
  }

  return (
    <ChakraProvider>
      <Button
        variant="solid"
        colorScheme="blue"
        size="lg"
        onClick={() => onOpen()}>
        Dashboard
      </Button>
      <PublishAlert onConfirm={handlePublishConfirm} {...publishAlert} />
      <DiscardAlert onConfirm={handleDiscardConfirm} {...discardAlert} />
      <Component
        isOpen={isOpen}
        onClose={onClose}
        onEditingMode={handleEditingMode}
        onDiscardChanges={handleDiscardChanges}
        onPublish={handlePublish}
        isEditing={isEditing}
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

import {ChakraProvider, Button, useDisclosure} from '@chakra-ui/react'
import PagesTab from 'components/Dashboard/tabs/Pages'
import {ContentValues} from 'components/Dashboard/tabs/Pages/PageContent'
import * as React from 'react'

import {default as Component} from '../../components/Dashboard'
import {CreateValues} from '../../components/Dashboard/tabs/Pages/PageCreator'
import {useAppDispatch} from '../../store'
import {
  page_markForDeletion,
  page_updateOrCreate
} from '../../store/slices/pagesSlice'
import {withRedux} from '../../store/withRedux'
import {useJaenPageTree} from '../../utils/hooks/jaen'
import {PagesContainer} from './tabs/Pages'

export const Dashboard = withRedux(() => {
  const dispatch = useAppDispatch()
  const {isOpen, onClose, onOpen} = useDisclosure()

  // useCallback for performance
  const handleEditingMode = React.useCallback(() => {}, [])

  const handleDiscardChanges = React.useCallback(() => {}, [])

  const handlePublish = React.useCallback(() => {}, [])

  useJaenPageTree()

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

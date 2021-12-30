import {Button, useDisclosure} from '@chakra-ui/react'
import * as React from 'react'

import {default as Component} from '../../components/Dashboard'
import {CreateValues} from '../../components/Dashboard/PageCreator'
import {useAppDispatch} from '../../store'
import {
  page_markForDeletion,
  page_updateOrCreate
} from '../../store/slices/pagesSlice'
import {withRedux} from '../../store/withRedux'
import {useJaenPageTree} from '../../utils/hooks/jaen'

export const Dashboard = withRedux(() => {
  const dispatch = useAppDispatch()
  const {isOpen, onClose, onOpen} = useDisclosure()

  // useCallback for performance
  const handleEditingMode = React.useCallback(() => {}, [])

  const handleDiscardChanges = React.useCallback(() => {}, [])

  const handlePublish = React.useCallback(() => {}, [])

  const handlePageCreate = React.useCallback(
    (parentId: string | null, values: CreateValues) => {
      dispatch(
        page_updateOrCreate({
          parent: parentId ? {id: parentId} : null,
          slug: values.slug,
          jaenPageMetadata: {
            title: values.title
          },
          templateName: values.templateName
        })
      )
    },
    []
  )

  const handlePageDelete = React.useCallback((id: string) => {
    dispatch(page_markForDeletion(id))
  }, [])

  const handlePageMove = React.useCallback(
    (id: string, oldParentId: string | null, newParentId: string | null) => {
      dispatch(
        page_updateOrCreate({
          id,
          parent: newParentId ? {id: newParentId} : null,
          fromId: oldParentId || undefined
        })
      )
    },
    []
  )

  const handlePageUpdate = React.useCallback(
    (id: string, values: CreateValues) => {},
    []
  )

  useJaenPageTree()

  return (
    <>
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
        onPageCreate={handlePageCreate}
        onPageDelete={handlePageDelete}
        onPageMove={handlePageMove}
        onPageUpdate={handlePageUpdate}
      />
    </>
  )
})

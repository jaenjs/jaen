import * as React from 'react'

import PagesTab from '../../../components/Dashboard/tabs/Pages'
import {ContentValues} from '../../../components/Dashboard/tabs/Pages/PageContent'
import {CreateValues} from '../../../components/Dashboard/tabs/Pages/PageCreator'
import {useAppDispatch} from '../../../store'
import {
  page_markForDeletion,
  page_updateOrCreate
} from '../../../store/slices/pagesSlice'
import {withRedux} from '../../../store/withRedux'
import {useJaenPageTree, useJaenTemplates} from '../../../utils/hooks/jaen'
import {JaenTemplate} from '../../../utils/types'

export const PagesContainer = withRedux(() => {
  const dispatch = useAppDispatch()
  const pageTree = useJaenPageTree()
  const jaenTemplates = useJaenTemplates()

  const handlePageGet = React.useCallback(
    id => {
      const jaenPage = pageTree.find(p => p.id === id)

      if (!jaenPage) {
        throw Error(`PagesContainer:getPage cannot get jaenPage with id ${id}`)
      }

      return jaenPage
    },
    [pageTree]
  )

  const handlePageCreate = React.useCallback(
    (parentId: string | null, values: CreateValues) =>
      dispatch(
        page_updateOrCreate({
          parent: parentId ? {id: parentId} : null,
          slug: values.slug,
          jaenPageMetadata: {
            title: values.title
          },
          template: values.template
        })
      ),
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
    (id: string, values: ContentValues) =>
      dispatch(
        page_updateOrCreate({
          id,
          slug: values.slug,
          jaenPageMetadata: {
            title: values.title,
            description: values.description
          }
        })
      ),
    []
  )

  const treeItems = React.useMemo(
    () =>
      pageTree.reduce(
        (a, v) => ({
          ...a,
          [v.id]: {
            id: v.id,
            children: v.children.map(child => child.id),
            data: {
              title: v.jaenPageMetadata.title,
              slug: v.slug,
              template: v.template,
              hasChanges: false,
              deleted: v.deleted
            },
            parent: v.parent?.id || null
          }
        }),
        {}
      ),
    [pageTree]
  )
  console.log(
    '🚀 ~ file: Pages.tsx ~ line 91 ~ PagesContainer ~ treeItems',
    treeItems
  )

  return (
    <PagesTab
      items={treeItems}
      templates={jaenTemplates}
      creatorFallbackTemplates={[
        {
          name: 'fb-page',
          displayName: 'Fallback Page'
        }
      ]}
      getPage={handlePageGet}
      onItemCreate={handlePageCreate}
      onItemDelete={handlePageDelete}
      onItemMove={handlePageMove}
      onPageUpdate={handlePageUpdate}
      onItemSelect={id => null}
    />
  )
})

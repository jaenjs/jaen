import deepmerge from 'deepmerge'
import {graphql, useStaticQuery} from 'gatsby'

import {useAppSelector} from '../../../store'
import {JaenPage} from '../../types'

export type TreeNode = Pick<
  JaenPage,
  'id' | 'parent' | 'children' | 'slug' | 'jaenPageMetadata' | 'template'
> & {deleted?: true}

/**
 * Access the PageTree of the JaenContext and Static.
 */
export const useJaenPageTree = (): TreeNode[] => {
  type QueryData = {
    allJaenPage: {
      nodes: TreeNode[]
    }
  }

  let data: QueryData

  try {
    data = useStaticQuery<QueryData>(graphql`
      query {
        allJaenPage {
          nodes {
            id
            slug
            parent {
              id
            }
            children {
              id
            }
            jaenPageMetadata {
              title
              isBlogPost
              image
              description
              datePublished
              canonical
            }
            template {
              name
              displayName
            }
          }
        }
      }
    `)
  } catch {
    data = {
      allJaenPage: {
        nodes: []
      }
    }
  }

  const pages = useAppSelector(state =>
    Object.keys(state.pages).map(id => {
      const {slug, parent, children, jaenPageMetadata, template, deleted} =
        state.pages[id]

      return {
        id,
        ...(slug && {slug}),
        ...(parent !== undefined && {parent}),
        ...(children && {children}),
        ...(jaenPageMetadata && {jaenPageMetadata}),
        ...(template && {template}),
        ...(deleted && {deleted})
      }
    })
  ) as TreeNode[]

  const merged = data.allJaenPage.nodes
    .concat(
      pages.filter(
        item => data.allJaenPage.nodes.findIndex(n => n.id === item.id) === -1
      )
    )
    .map(({id}) => {
      const p1 = data.allJaenPage.nodes.find(e => e.id === id)
      console.log('🚀 ~ file: useJaenPageTree.tsx ~ line 85 ~ .map ~ p1', p1)
      const p2 = pages.find(e => e.id === id)
      console.log('🚀 ~ file: useJaenPageTree.tsx ~ line 87 ~ .map ~ p2', p2)

      return deepmerge(p1 || {}, p2 || {})
    })
  console.log(
    '🚀 ~ file: useJaenPageTree.tsx ~ line 83 ~ merged ~ merged',
    merged
  )

  return merged
}

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
    state.pages.map(e => ({
      id: e.id,
      slug: e.slug,
      parent: e.parent,
      children: e.children,
      jaenPageMetadata: e.jaenPageMetadata,
      template: e.template,
      deleted: e.deleted
    }))
  ) as TreeNode[]

  const merged = deepmerge(data.allJaenPage.nodes, pages)

  console.log('🚀 ~ file: jaen.ts ~ line 74 ~ merged', merged)

  return merged
}

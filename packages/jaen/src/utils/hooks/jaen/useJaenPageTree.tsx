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
      const page = state.pages[id]

      return {
        id,
        slug: page.slug,
        parent: page.parent,
        children: page.children,
        jaenPageMetadata: page.jaenPageMetadata,
        template: page.template,
        deleted: page.deleted
      }
    })
  ) as TreeNode[]

  const merged = data.allJaenPage.nodes.concat(pages).map(({id}) => {
    const p1 = data.allJaenPage.nodes.find(e => e.id === id)
    const p2 = pages.find(e => e.id === id)

    return deepmerge(p1 || {}, p2 || {})
  })

  return merged
}

import {graphql, useStaticQuery} from 'gatsby'
import React from 'react'

import {store, RootState, useAppSelector} from '../../store'
import {JaenPage} from '../types'

/**
 * Access the PageTree of the JaenContext and Static.
 */
export const useJaenPageTree = () => {
  //const {jaen} = useJaenContext()

  type QueryData = {
    allJaenPage: {
      nodes: Pick<JaenPage, 'id' | 'parent' | 'children'>[]
    }
  }

  let data: QueryData

  try {
    data = useStaticQuery<QueryData>(graphql`
      query {
        allJaenPage {
          nodes {
            id
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

  const pages = useAppSelector(
    state => state.pages,
    (r, l) => {
      if (!l || !r) {
        return false
      }

      const shouldUpdate = l.length !== r.length

      if (shouldUpdate) {
        return false
      }

      for (let i = 0; i < l.length; i++) {
        if (l[i].deleted !== r[i].deleted) {
          return false
        }

        if (l[i].parent !== r[i].parent) {
          return false
        }
      }

      return true
    }
  )

  console.log(data.allJaenPage.nodes, pages)

  return data.allJaenPage.nodes
}

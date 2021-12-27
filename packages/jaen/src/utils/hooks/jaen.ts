import {graphql, useStaticQuery} from 'gatsby'
import React from 'react'

import {store, RootState} from '../../store'
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

  const data = useStaticQuery<QueryData>(graphql`
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

  const pages = store.getState()?.pages

  console.log(data.allJaenPage.nodes, pages)

  return data.allJaenPage.nodes
}

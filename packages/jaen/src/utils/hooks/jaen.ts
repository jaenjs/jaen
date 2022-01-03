import deepmerge from 'deepmerge'
import {graphql, useStaticQuery} from 'gatsby'
import React from 'react'
import {useJaenContext} from 'utils/providers/JaenProvider'

import {store, RootState, useAppSelector} from '../../store'
import {JaenPage, JaenTemplate} from '../types'

export type TreeNode = Pick<
  JaenPage,
  'id' | 'parent' | 'children' | 'slug' | 'jaenPageMetadata' | 'template'
>

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
      parent: e.parent,
      children: e.children,
      jaenPageMetadata: e.jaenPageMetadata,
      template: e.template
    }))
  ) as TreeNode[]

  const merged = deepmerge(data.allJaenPage.nodes, pages)
  console.log('🚀 ~ file: jaen.ts ~ line 74 ~ merged', merged)

  return merged
}

/**
 * Access the JaenTemplates
 */
export const useJaenTemplates = (): JaenTemplate[] => {
  type QueryData = {
    allJaenTemplate: {
      nodes: JaenTemplate[]
    }
  }

  let data: QueryData

  try {
    data = useStaticQuery<QueryData>(graphql`
      query {
        allJaenTemplate {
          nodes {
            name
            displayName
            children: childrenJaenTemplate {
              name
              displayName
            }
          }
        }
      }
    `)
  } catch {
    data = {
      allJaenTemplate: {
        nodes: []
      }
    }
  }

  return data.allJaenTemplate.nodes
}

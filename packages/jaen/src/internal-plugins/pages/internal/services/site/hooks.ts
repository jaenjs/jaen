import {RootState, useAppDeepEqualSelector} from '@internal/redux'
import deepmerge from 'deepmerge'
import {graphql, useStaticQuery} from 'gatsby'
import * as React from 'react'
import {IJaenPage, ITreeJaenPage} from 'types'
import {IJaenTemplate} from '../../../types'
type QueryData = {
  allFile: {
    nodes: Array<{
      name: string
      relativePath: string
    }>
  }
  allJaenPage: {
    nodes: ITreeJaenPage[]
  }
  allJaenTemplate: {
    nodes: IJaenTemplate[]
  }
}

export const useStaticData = () => {
  let staticData: QueryData

  try {
    staticData = useStaticQuery<QueryData>(graphql`
      query {
        allFile(filter: {sourceInstanceName: {eq: "templates"}}) {
          nodes {
            name
            relativePath
          }
        }
        allJaenPage(filter: {id: {ne: "JaenPage /"}}) {
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
  } catch (e) {
    staticData = {
      allFile: {
        nodes: []
      },
      allJaenPage: {
        nodes: []
      },
      allJaenTemplate: {
        nodes: []
      }
    }
  }

  return staticData
}

/**
 * Access the JaenTemplates
 */
export const useJaenTemplates = (): IJaenTemplate[] => {
  const data = useStaticData()

  return data.allJaenTemplate.nodes
}

const getStatePages = (state: RootState) =>
  Object.keys(state.internal.pages.nodes).map(id => {
    const {
      slug,
      parent,
      children,
      jaenPageMetadata,
      template,
      deleted
    } = state.internal.pages.nodes[id]

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

const mergeStaticWithStatePages = (
  staticPages: ITreeJaenPage[],
  statePages: IJaenPage[]
): ITreeJaenPage[] =>
  staticPages
    .concat(
      statePages.filter(
        item =>
          staticPages.findIndex(
            n => n.id === item.id && !['JaenPage /'].includes(n.id)
          ) === -1
      )
    )
    .map(({id}) => {
      const p1 = staticPages.find(e => e.id === id)
      const p2 = statePages.find(e => e.id === id)
      const m = deepmerge(p1 || {}, p2 || {})
      return m
    })
    .filter(p => ['JaenPage /'].indexOf(p.id) === -1)

/**
 * Access the PageTree of the JaenContext and Static.
 */
export const useJaenPageTree = (): ITreeJaenPage[] => {
  const staticData = useStaticData()
  const pages = useAppDeepEqualSelector(state =>
    getStatePages(state)
  ) as ITreeJaenPage[]

  const mergeData = React.useMemo(
    () => mergeStaticWithStatePages(staticData.allJaenPage.nodes, pages as any),
    [staticData, pages]
  )

  console.log(
    '🚀 ~ file: useJaenPageTree.tsx ~ line 125 ~ mergeData',
    mergeData
  )

  return mergeData
}

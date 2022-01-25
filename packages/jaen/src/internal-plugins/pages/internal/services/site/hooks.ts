import {RootState, useAppDeepEqualSelector} from '@internal/redux'
import deepmerge from 'deepmerge'
import {graphql, useStaticQuery} from 'gatsby'
import * as React from 'react'
import {useSiteContext} from '.'
import {IJaenPage, IJaenTemplate, ITreeJaenPage} from '../../../types'

type QueryData = {
  allJaenPage: {
    nodes: ITreeJaenPage[]
  }
  jaenTemplates: {
    nodes: Array<{
      name: string
      relativePath: string
    }>
  }
}

export const useStaticData = () => {
  let staticData: QueryData

  try {
    staticData = useStaticQuery<QueryData>(graphql`
      query {
        jaenTemplates: allFile(
          filter: {sourceInstanceName: {eq: "templates"}}
        ) {
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
            template
          }
        }
      }
    `)
  } catch (e) {
    staticData = {
      allJaenPage: {
        nodes: []
      },
      jaenTemplates: {
        nodes: []
      }
    }
  }

  return staticData
}

/**
 * Access the JaenTemplates
 */
export const useJaenTemplates = () => {
  const site = useSiteContext()
  const data = useStaticData()

  const [templates, setTemplates] = React.useState<{
    [name: string]: IJaenTemplate
  }>({})

  React.useEffect(() => {
    const templateNodes = data.jaenTemplates.nodes

    for (const templateNode of templateNodes) {
      const {name: loadTemplate} = templateNode

      const load = async () => {
        if (loadTemplate && !(loadTemplate in templates)) {
          const Component = await site.templateLoader(loadTemplate)

          const children = []

          for (const child of Component.options.children) {
            if (typeof child === 'string') {
              const ad = await site.templateLoader(child)
              children.push({
                name: child,
                displayName: ad.options.displayName
              })
            } else {
              children.push({
                name: child.name,
                displayName: child.options.displayName
              })
            }
          }

          setTemplates({
            ...templates,
            [loadTemplate]: {
              name: loadTemplate,
              displayName: Component.options.displayName,
              children
            }
          })
        }
      }

      load()
    }
  }, [])

  const templatesArray = React.useMemo(() => Object.values(templates), [
    templates
  ])

  alert(JSON.stringify(templatesArray))

  return templatesArray
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
        item => staticPages.findIndex(n => n.id === item.id) === -1
      )
    )
    .map(({id}) => {
      const p1 = staticPages.find(e => e.id === id)
      const p2 = statePages.find(e => e.id === id)

      return deepmerge(p1 || {}, p2 || {})
    })

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

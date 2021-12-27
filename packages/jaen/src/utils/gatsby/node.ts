import {GatsbyNode} from 'gatsby'
import path from 'path'

import {JaenPage, JaenPluginOptions} from '../types'

export const onCreateWebpackConfig: GatsbyNode['onCreateWebpackConfig'] = (
  {plugins, actions, loaders, stage},
  pluginOptions: JaenPluginOptions
) => {
  const {templates} = pluginOptions

  console.log('options', templates)

  actions.setWebpackConfig({
    plugins: [
      plugins.define({
        ___JAEN_TEMPLATES___: JSON.stringify(templates.rootDir)
      })
    ]
  })

  if (stage === 'build-html' || stage === 'develop-html') {
    actions.setWebpackConfig({
      module: {
        rules: [
          {
            test: /canvas/,
            use: loaders.null()
          }
        ]
      }
    })
  }
}

export const createSchemaCustomization: GatsbyNode['createSchemaCustomization'] = ({
  actions,
  schema
}) => {
  actions.createTypes(`
      type JaenPage implements Node {
        id: ID!
        jaenPageMetadata: JaenPageMetadata!
        jaenFields: JSON
        chapters: JSON
      }

      type JaenPageMetadata {
        title: String!
        description: String
        image: String
        canonical: String
        datePublished: String
        isBlogPost: Boolean
      }
      `)
}

export const sourceNodes: GatsbyNode['sourceNodes'] = async ({
  actions,
  createNodeId,
  createContentDigest
}) => {
  const {createNode} = actions

  const dummyJaenPages: JaenPage[] = [
    {
      id: `JaenPage ${createNodeId('jaen-page-1')}`,
      slug: 'jaen-page-1',
      parent: null,
      children: [],
      jaenPageMetadata: {
        title: 'Jaen Page 1',
        description: 'Jaen Page 1 description',
        image: 'https://via.placeholder.com/300x200',
        canonical: 'https://jaen.com/jaen-page-1',
        datePublished: '2020-01-01',
        isBlogPost: false
      },
      jaenFields: {
        jaenField1: 'jaenField1',
        jaenField2: 'jaenField2'
      },
      chapters: {},
      templateName: 'BlogPage'
    },
    {
      id: `JaenPage ${createNodeId('jaen-page-2')}`,
      slug: 'jaen-page-2',
      parent: null,
      children: [{id: `JaenPage ${createNodeId('jaen-page-2-1')}}`}],
      jaenPageMetadata: {
        title: 'Jaen Page 2',
        description: 'Jaen Page 2 description',
        image: 'https://via.placeholder.com/300x200',
        canonical: 'https://jaen.com/jaen-page-2',
        datePublished: '2020-01-01',
        isBlogPost: false
      },
      jaenFields: {
        jaenField1: 'jaenField1',
        jaenField2: 'jaenField2'
      },
      chapters: {},
      templateName: 'BlogPage'
    },
    {
      id: `JaenPage ${createNodeId('jaen-page-2-1')}`,
      slug: 'jaen-page-2-1',
      parent: {
        id: `JaenPage ${createNodeId('jaen-page-2')}`
      },
      children: [],
      jaenPageMetadata: {
        title: 'Jaen Page 21',
        description: 'Jaen Page 21 description',
        image: 'https://via.placeholder.com/300x200',
        canonical: 'https://jaen.com/jaen-page-2',
        datePublished: '2020-01-01',
        isBlogPost: false
      },
      jaenFields: {
        jaenField1: 'jaenField1',
        jaenField2: 'jaenField2'
      },
      chapters: {},
      templateName: 'BlogPage'
    }
  ]

  dummyJaenPages.forEach(jaenPage => {
    const node = {
      ...jaenPage,
      parent: jaenPage.parent ? jaenPage.parent.id : null,
      children: jaenPage.children.map(child => child.id),
      internal: {
        type: 'JaenPage',
        content: JSON.stringify(jaenPage),
        contentDigest: createContentDigest(jaenPage)
      }
    }

    createNode(node)
  })
}

export const createPages: GatsbyNode['createPages'] = async (
  {actions, graphql, reporter},
  pluginOptions: JaenPluginOptions
) => {
  const {createPage} = actions

  interface QueryData {
    allJaenPage: {
      edges: {
        node: JaenPage
      }[]
    }
  }

  const result = await graphql<QueryData>(`
    query {
      allJaenPage {
        edges {
          node {
            id
            slug
            jaenPageMetadata {
              title
              description
              image
              canonical
              datePublished
              isBlogPost
            }
            jaenFields
            chapters
            templateName
          }
        }
      }
    }
  `)

  if (result.errors || !result.data) {
    reporter.panicOnBuild(`Error while running GraphQL query.`)
    return
  }

  const jaenPages = result.data.allJaenPage.edges

  console.log(jaenPages)

  jaenPages.forEach(({node}) => {
    const {slug} = node
    const {templateName} = node
    const {rootDir, paths} = pluginOptions.templates

    if (templateName) {
      const pageTemplatePath = paths[templateName]

      createPage({
        path: node.slug,
        component: path.join(rootDir, pageTemplatePath),
        context: {
          jaenPageId: node.id
        }
      })
    }
  })
}

export const onCreatePage: GatsbyNode['onCreatePage'] = ({
  actions,
  page,
  createNodeId,
  createContentDigest,
  getNode
}) => {
  const {createPage, deletePage, createNode} = actions
  const {path, context} = page

  // Check if the page has a `jaenPageId` in its context.
  // If not it means it's not a JaenPage and we must create one.
  if (!context.jaenPageId) {
    const jaenPageId = `JaenPage ${path}`

    if (!getNode(jaenPageId)) {
      const jaenPage: JaenPage = {
        id: jaenPageId,
        slug: path,
        parent: null,
        children: [],
        jaenPageMetadata: {
          title: path,
          description: '',
          image: '',
          canonical: '',
          datePublished: '',
          isBlogPost: false
        },
        jaenFields: null,
        chapters: {},
        templateName: null
      }

      createNode({
        ...jaenPage,
        parent: null,
        children: [],
        internal: {
          type: 'JaenPage',
          content: JSON.stringify(jaenPage),
          contentDigest: createContentDigest(jaenPage)
        }
      })
    }

    deletePage(page)
    createPage({...page, context: {...context, jaenPageId}})
  }
}

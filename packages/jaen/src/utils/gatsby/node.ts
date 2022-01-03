import {GatsbyNode} from 'gatsby'
import path from 'path'

import {JaenPage, JaenPluginOptions, JaenTemplate} from '../types'

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

export const createSchemaCustomization: GatsbyNode['createSchemaCustomization'] =
  ({actions, schema}) => {
    actions.createTypes(`

      type JaenTemplate implements Node {
        id: String!
        name: String!
        displayName: String!
      }

      type JaenPage implements Node {
        id: ID!
        jaenPageMetadata: JaenPageMetadata!
        jaenFields: JSON
        chapters: JSON
        template: JaenTemplate @link
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

  const dummyTemplates = [
    {
      name: 'BlogPage',
      displayName: 'Blog',
      children: [
        {
          id: 'BlogPage'
        }
      ]
    }
  ]

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
        text: {
          jaenField1: 'jaenField1',
          jaenField2: 'jaenField2'
        }
      },
      chapters: {},
      template: 'BlogPage' as any
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
        text: {
          jaenField1: 'jaenField1',
          jaenField2: 'jaenField2'
        }
      },
      chapters: {
        chapter1: {
          ptrHead: 'JaenSection foo-bar-baz-1',
          ptrTail: 'JaenSection foo-bar-baz-2',
          sections: {
            'JaenSection foo-bar-baz-1': {
              jaenFields: null,
              name: 'BoxSection',
              ptrNext: 'JaenSection foo-bar-baz-2',
              ptrPrev: null // this is the first section of the chapter
            },
            'JaenSection foo-bar-baz-2': {
              jaenFields: null,
              name: 'BoxSection',
              ptrNext: null, // this is the last section of the chapter
              ptrPrev: 'JaenSection foo-bar-baz-1'
            }
          }
        },
        chapter2: {
          ptrHead: 'JaenSection foo-bar-baz-3',
          ptrTail: 'JaenSection foo-bar-baz-5',
          sections: {
            'JaenSection foo-bar-baz-3': {
              jaenFields: null,
              name: 'BoxSection',
              ptrNext: 'JaenSection foo-bar-baz-4',
              ptrPrev: null // this is the first section of the chapter
            },
            'JaenSection foo-bar-baz-4': {
              jaenFields: null,
              name: 'BoxSection',
              ptrNext: 'JaenSection foo-bar-baz-5',
              ptrPrev: 'JaenSection foo-bar-baz-3'
            },
            'JaenSection foo-bar-baz-5': {
              jaenFields: null,
              name: 'BoxSection',
              ptrNext: null, // this is the last section of the chapter
              ptrPrev: 'JaenSection foo-bar-baz-4'
            }
          }
        }
      },
      template: 'BlogPage' as any
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
        text: {
          jaenField1: 'jaenField1',
          jaenField2: 'jaenField2'
        }
      },
      chapters: {},
      template: 'BlogPage' as any
    }
  ]

  dummyTemplates.forEach(jaenTemplate => {
    const node = {
      id: jaenTemplate.name,
      ...jaenTemplate,
      children: jaenTemplate.children.map(child => child.id),
      internal: {
        type: 'JaenTemplate',
        content: JSON.stringify(jaenTemplate),
        contentDigest: createContentDigest(jaenTemplate)
      }
    }

    createNode(node)
  })

  dummyJaenPages.forEach(jaenPage => {
    const node = {
      ...jaenPage,
      template: jaenPage.template || null,
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
            template {
              name
              displayName
            }
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
    const {template} = node
    const {rootDir, paths} = pluginOptions.templates

    if (template?.name) {
      const pageTemplatePath = paths[template?.name]

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
        template: null
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

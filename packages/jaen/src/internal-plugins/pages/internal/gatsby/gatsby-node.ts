import {GatsbyNode as GatsbyNodeType} from 'gatsby'
import path from 'path'
import {IJaenPage} from '../../types'
import {processPage} from '../services/imaProcess'
import {sourceTemplates} from './gatsby-config'

const GatsbyNode: GatsbyNodeType = {}

GatsbyNode.onCreateWebpackConfig = ({
  plugins,
  actions,
  loaders,
  stage,
  getNodesByType
}) => {
  actions.setWebpackConfig({
    plugins: [
      plugins.define({
        ___JAEN_TEMPLATES___: JSON.stringify(sourceTemplates)
      })
    ],
    resolve: {
      alias: {
        '@jaen-pages': path.resolve(__dirname, '../../'),
        '@jaen': path.resolve(__dirname, '../../../../')
      },
      fallback: {
        fs: false
      }
    }
  })

  if (stage === 'build-html' || stage === 'develop-html') {
    actions.setWebpackConfig({
      module: {
        rules: [
          {
            test: /canvas/,
            use: loaders.null()
          },
          {
            test: /filerobot-image-editor/,
            use: loaders.null()
          }
        ]
      }
    })
  }
}

GatsbyNode.createSchemaCustomization = ({actions}) => {
  actions.createTypes(`
    type JaenPage implements Node {
      id: ID!
      jaenPageMetadata: JaenPageMetadata!
      jaenFields: JSON
      chapters: JSON
      template: String
      jaenFiles: [JaenFile!]!
      excludedFromIndex: Boolean
    }

    type JaenFile {
      file: File! @link(from: "file___NODE")
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

GatsbyNode.sourceNodes = async ({
  actions,
  createNodeId,
  createContentDigest,
  getNodesByType,
  cache,
  store,
  reporter
}) => {
  const {createNode} = actions

  const dummyJaenPages: IJaenPage[] = [
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
        'IMA:TextField': {
          jaenField1: 'jaenField1',
          jaenField2: 'jaenField2'
        }
      },
      jaenFiles: undefined as any,
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
        'IMA:TextField': {
          jaenField1: 'jaenField1',
          jaenField2: 'jaenField2'
        }
      },
      jaenFiles: undefined as any,

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
        'IMA:TextField': {
          jaenField1: 'jaenField1',
          jaenField2: 'jaenField2'
        },
        'IMA:ImageField': {
          jaenField3: {
            internalImageUrl: 'https://via.placeholder.com/300x200'
          }
        }
      },
      jaenFiles: undefined as any,
      chapters: {},
      template: 'BlogPage' as any
    }
  ]

  dummyJaenPages.forEach(async jaenPage => {
    //> Process IMA fields in page and its chapters

    await processPage({
      page: jaenPage,
      createNodeId,
      createNode,
      cache,
      store,
      reporter
    })

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

  //> Fetch template files and proccess them
}

GatsbyNode.createPages = async ({actions, graphql, reporter}) => {
  const {createPage} = actions

  interface QueryData {
    allJaenPage: {
      edges: {
        node: IJaenPage
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
            template
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

  jaenPages.forEach(({node}) => {
    const {slug} = node
    const {template} = node

    return
  })

  // Dynamic routing pages

  // stepPage.matchPath is a special key that's used for matching pages
  // only on the client.
  createPage({
    path: '/_',
    matchPath: '/_/*',
    component: require.resolve('../services/routing/pages/_.tsx'),
    context: {}
  })
}

GatsbyNode.onCreatePage = ({
  actions,
  page,
  createNodeId,
  createContentDigest,
  getNode
}) => {
  const {createPage, deletePage, createNode} = actions
  const {path, context} = page

  let stepPage = page

  // Check if the page has a `jaenPageId` in its context.
  // If not it means it's not a JaenPage and we must create one.
  if (!context.jaenPageId) {
    const jaenPageId = `JaenPage ${path}`

    if (!getNode(jaenPageId)) {
      const jaenPage: IJaenPage = {
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
        jaenFiles: [],
        chapters: {},
        template: null
      }

      createNode({
        ...jaenPage,
        parent: null,
        children: [],
        jaenFiles: [],
        internal: {
          type: 'JaenPage',
          content: JSON.stringify(jaenPage),
          contentDigest: createContentDigest(jaenPage)
        }
      })
    }

    stepPage = {...stepPage, context: {...context, jaenPageId}}
  }

  deletePage(page)
  createPage(stepPage)
}

export default GatsbyNode

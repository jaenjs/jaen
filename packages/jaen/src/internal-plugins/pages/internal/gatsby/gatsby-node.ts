import {GatsbyNode as GatsbyNodeType} from 'gatsby'
import fetch from 'node-fetch'
import path from 'path'
import {getJaenDataForPlugin} from '../../../../services/migration/get-jaen-data-for-plugin'
import {IJaenPage, IPagesMigrationBase} from '../../types'
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
      slug: String!
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

  let pages = await getJaenDataForPlugin<IPagesMigrationBase>('JaenPages@0.0.1')

  for (const [id, page] of Object.entries(pages)) {
    console.log('page', page)
    const jaenPage = ((await (
      await fetch(page.context.fileUrl)
    ).json()) as unknown) as IJaenPage

    console.log('jaen page')

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
      id,
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
  }

  //> Fetch template files and proccess them
}

GatsbyNode.createPages = async ({actions, graphql, reporter}) => {
  const {createPage} = actions

  interface QueryData {
    allTemplate: {
      nodes: Array<{
        id: string
        absolutePath: string
      }>
    }
    allJaenPage: {
      edges: {
        node: IJaenPage
      }[]
    }
  }

  const result = await graphql<QueryData>(`
    query {
      allTemplate: allFile(filter: {sourceInstanceName: {eq: "templates"}}) {
        nodes {
          absolutePath
          id: relativePath
        }
      }
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

  const {allTemplate, allJaenPage} = result.data

  allJaenPage.edges.forEach(({node}) => {
    const {slug} = node
    const {template} = node

    if (template) {
      const component = allTemplate.nodes.find(e => e.id === template)
        ?.absolutePath

      if (!component) {
        reporter.panicOnBuild(
          `Could not find template for page ${node.id} (${template})`
        )
        return
      }

      createPage({
        path: slug,
        component,
        context: {
          jaenPageId: node.id
        }
      })
    }
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

require('isomorphic-fetch')

const path = require('path')
const fs = require('fs')
const {createImages} = require('./dist/create-images')

const configFile = path.resolve('./jaen-config.js')
const jaenPagesPath = path.resolve('./jaen-pages.json')
const jaenPagesFileObj = JSON.parse(fs.readFileSync(jaenPagesPath, 'utf8'))

exports.onCreateWebpackConfig = (
  {plugins, actions, loaders, stage},
  pluginOptions
) => {
  actions.setWebpackConfig({
    plugins: [plugins.define({___JAEN_CONFIG___: JSON.stringify(configFile)})]
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

exports.createSchemaCustomization = ({actions}) => {
  const {createTypes} = actions
  createTypes(`
    type JaenPageMetadata {
      title: String!
      description: String
      image: String
      canonical: String
      datePublished: String
      isBlogPost: Boolean
    }

    type JaenPagesInitials implements Node {
      snekFinder: JaenPagesSnekFinder!
    }

    type JaenPagesSnekFinder {
      initBackendLink: String
    }

    interface JaenAbstractField {
      name: String!
    }

    type JaenTextField implements JaenAbstractField { 
      name: String!
      value: String!
    }

    type JaenFileField implements JaenAbstractField { 
      name: String!
      value: File @link(from: "file___NODE")
    }

    type JaenFields {
      jaenTextFields: [JaenTextField]
      jaenFileFields: [JaenFileField]
    }

    type JaenPage implements Node {
      id: String!
      sitePageId: String!
      jaenFields: JaenFields!
      jaenPageMetadata: JaenPageMetadata!
    }
  `)
}

exports.onCreatePage = async ({page, actions}) => {
  const {createPage, deletePage} = actions

  // Delete and recreate the page with the new context
  deletePage(page)

  // Create the page with the new context
  createPage({
    ...page,
    context: {
      ...page.context,
      sitePageId: 'SitePage ' + page.path
    }
  })

  console.log({
    ...page,
    context: {
      ...page.context,
      sitePageId: 'SitePage ' + page.path
    }
  })
}

exports.sourceNodes = ({actions, createNodeId, createContentDigest}) => {
  const {createNode} = actions

  // Data can come from anywhere, but for now create it manually
  const myData = {
    snekFinder: {
      initBackendLink: jaenPagesFileObj?.snekFinder?.context?.fileUrl
    }
  }

  const nodeContent = JSON.stringify(myData)

  const nodeMeta = {
    id: createNodeId('jaen-pages-snek-finder'),
    parent: null,
    children: [],
    internal: {
      type: `JaenPagesInitials`,
      content: nodeContent,
      contentDigest: createContentDigest(myData)
    }
  }

  const node = Object.assign({}, myData, nodeMeta)
  createNode(node)

  // Create dummy content for jaenPages
  const jaenPages = [
    {
      sitePageId: 'SitePage /',
      fields: {jaenTextFields: [], jaenfileFields: []},
      jaenPageMetadata: {
        title: 'String!',
        description: 'String',
        image: 'String',
        canonical: 'String',
        datePublished: 'String',
        isBlogPost: true
      }
    },
    {
      sitePageId: 'SitePage /404/',
      fields: {jaenTextFields: [], jaenfileFields: []},
      jaenPageMetadata: {
        title: 'String!',
        description: 'String',
        image: 'String',
        canonical: 'String',
        datePublished: 'String',
        isBlogPost: true
      }
    },
    {
      sitePageId: 'SitePage /404.html',
      fields: {jaenTextFields: [], jaenfileFields: []},
      jaenPageMetadata: {
        title: 'String!',
        description: 'String',
        image: 'String',
        canonical: 'String',
        datePublished: 'String',
        isBlogPost: true
      }
    }
  ]

  jaenPages.forEach(jaenPage => {
    const data = {
      sitePageId: jaenPage.sitePageId,
      jaenFields: jaenPage.fields,
      jaenPageMetadata: jaenPage.jaenPageMetadata
    }

    const meta = {
      id: createNodeId(`jaen-page-${jaenPage.sitePageId}`),
      parent: null,
      children: [],
      internal: {
        type: `JaenPage`,
        content: JSON.stringify(jaenPage),
        contentDigest: createContentDigest(jaenPage)
      }
    }

    const node = Object.assign({}, data, meta)
    createNode(node)
  })
}

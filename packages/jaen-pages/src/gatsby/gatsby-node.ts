// require = require('esm')(module)
import type {GatsbyNode} from 'gatsby'
import * as path from 'path'

export const onCreatePage: GatsbyNode['onCreatePage'] = ({page, actions}) => {
  const {createPage, deletePage} = actions

  const jaenPageId = page.context.jaenPageId

  if (!jaenPageId) {
    deletePage(page)
    // You can access the variable "house" in your page queries now
    createPage({
      ...page,
      context: {
        ...page.context,
        jaenPageId: `SitePage ${page.path}`
      }
    })
  }
}

export const sourceNodes: GatsbyNode['sourceNodes'] = (
  {actions, createNodeId, createContentDigest},
  p
) => {
  const pages = []
  // loop 500 times
  for (let i = 0; i < 2; i++) {
    pages.push({
      slug: 'hello-world' + i,
      path: '/hello-world' + i,
      id: 'hello-world' + i,
      parentId: null,
      childIds: [],
      template: 'SamplePage',
      pageMetadata: {
        title: 'Hello from your world ' + i,
        description: '',
        image: '',
        canonical: 'https://snek.at/hello-world' + i,
        datePublished: '',
        social: {twitter: '', fbAppId: ''},
        isBlogPost: false
      }
    })
  }

  pages.map(page => {
    actions.createNode({
      path: page.path,
      id: page.id,
      slug: page.slug,
      parent: page.parentId,
      children: page.childIds,
      template: page.template,
      pageMetadata: page.pageMetadata,
      internal: {
        type: 'JaenPage',
        contentDigest: createContentDigest(page),
        content: JSON.stringify(page)
      }
    })
  })
}

exports.createPages = async ({graphql, actions}: any, pluginOptions: any) => {
  const {createPage} = actions

  const templates = pluginOptions.templates as any

  const queryResults = await graphql(`
    query AllJaenPages {
      allJaenPage {
        nodes {
          id
          path
          template
        }
      }
    }
  `)

  queryResults.data.allJaenPage.nodes.forEach(
    (node: {path: string; template: string; id: any}) => {
      createPage({
        path: node.path,
        component: path.resolve(templates[node.template]),
        context: {
          jaenPageId: node.id
        }
      })
    }
  )
}
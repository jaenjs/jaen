require('isomorphic-fetch')

const path = require('path')
const fs = require('fs')

const jaenPagesPath = path.resolve('./jaen-pages.json')

exports.createPages = async ({actions, graphql, cache}, pluginOptions) => {
  const templates = pluginOptions.templates
  const fileContent = JSON.parse(fs.readFileSync(jaenPagesPath, 'utf8'))

  for (const [id, pageEntity] of Object.entries(fileContent.pages)) {
    const {createdAt, fileUrl} = pageEntity.context
    const page = await (await fetch(fileUrl)).json()

    if (page.template) {
      actions.createPage({
        path: page.path || `${id}/`,
        parent: page.parent,
        children: page.children,
        component: path.resolve(templates[page.template]),
        context: {
          jaenPageContext: {
            id,
            slug: page.slug,
            template: page.template,
            pageMetadata: {
              datePublished: createdAt,
              ...page.pageMetadata
            },
            fields: page.fields
          }
        }
      })
    } else {
      await cache.set(`jaen-static-page-context-${id}`, {
        id,
        slug: page.slug,
        template: page.template,
        pageMetadata: {
          datePublished: createdAt,
          ...page.pageMetadata
        }
      })
    }
  }
}

exports.onCreatePage = async ({cache, page, actions}) => {
  const {createPage, deletePage} = actions

  const {jaenPageContext} = page.context

  const id = `SitePage ${page.path}`
  const cachedjaenPageContext = await cache.get(
    `jaen-static-page-context-${id}`
  )

  if (!jaenPageContext?.template) {
    deletePage(page)
    // You can access the variable "house" in your page queries now
    createPage({
      ...page,
      context: {
        ...page.context,
        jaenPageContext: {
          id,
          ...cachedjaenPageContext,
          pageMetadata: {
            title: page.internalComponentName,
            ...cachedjaenPageContext?.pageMetadata
          }
        }
      }
    })
  }
}
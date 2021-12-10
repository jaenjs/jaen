import {GatsbyNode} from 'gatsby'
import path from 'path'

const configFile = path.resolve('./jaen-config.js')

export const onCreateWebpackConfig: GatsbyNode['onCreateWebpackConfig'] = (
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

export const createSchemaCustomization: GatsbyNode['createSchemaCustomization'] =
  ({actions, schema}) => {
    actions.createTypes(`
      interface JaenSection {
        jaenFields: JaenFields
        sections: [JaenSection]
      }

      type JaenPage implements Node {
        id: ID!
        sitePageId: String!
        jaenPageMetadata: JaenPageMetadata!
        jaenFields: JaenFields
        sections: [JaenSection]
      }

      type JaenPageMetadata {
        title: String!
        description: String
        image: String
        canonical: String
        datePublished: String
        isBlogPost: Boolean
      }

      type JaenFields {
        jaenTextFields: [JaenTextField]
      }

      type JaenTextField {
        name: String!
        value: String!
      }
      `)
  }

export const onCreatePage: GatsbyNode['onCreatePage'] = ({actions, page}) => {
  const {createPage, deletePage} = actions
  const {path, context} = page

  deletePage(page)
  createPage({
    ...page,
    context: {
      ...context,
      sitePageId: `JaenPage ${page.path}`
    }
  })
}

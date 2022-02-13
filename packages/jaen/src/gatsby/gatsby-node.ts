import {IJaenConfig} from '@jaen/types'
import {GatsbyNode as GatsbyNodeType} from 'gatsby'

const GatsbyNode: GatsbyNodeType = {}

GatsbyNode.onCreateWebpackConfig = (
  {plugins, actions, loaders, stage, getNodesByType},
  pluginOptions
) => {
  const options = pluginOptions as unknown as IJaenConfig

  console.log('JOPTIONS', options)

  actions.setWebpackConfig({
    plugins: [
      plugins.define({
        ___JAEN_PROJECT_ID___: JSON.stringify(options.jaenProjectId)
      })
    ]
  })
}

GatsbyNode.createSchemaCustomization = ({actions, schema}) => {
  actions.createTypes(`
    type Site implements Node {
      siteMetadata: JSON
    }
  `)
}

GatsbyNode.createPages = async ({actions, graphql, reporter}) => {
  const {createPage} = actions

  createPage({
    path: '/jaen/admin',
    // matchPath to ignore trailing slash
    matchPath: '/jaen/admin/*',
    component: require.resolve('../ui/AdminPage.tsx'),
    context: {}
  })
}

export default GatsbyNode

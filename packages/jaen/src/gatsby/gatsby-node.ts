import {GatsbyNode as GatsbyNodeType} from 'gatsby'

const GatsbyNode: GatsbyNodeType = {}

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

import {GatsbyNode as GatsbyNodeType} from 'gatsby'
import {sourceNotifications} from './gatsby-config'

const GatsbyNode: GatsbyNodeType = {}

GatsbyNode.onCreateWebpackConfig = ({plugins, actions}) => {
  actions.setWebpackConfig({
    plugins: [
      plugins.define({
        ___JAEN_NOTIFICATIONS___: JSON.stringify(sourceNotifications)
      })
    ]
  })
}

GatsbyNode.createSchemaCustomization = ({actions}) => {
  actions.createTypes(`
    type JaenNotification implements Node {
      id: ID!
      jaenFields: JSON
    }
    `)
}

export default GatsbyNode

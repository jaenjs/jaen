import {GatsbyNode as GatsbyNodeType} from 'gatsby'
import {getJaenDataForPlugin} from '../../../services/migration/get-jaen-data-for-plugin'
import {INotificationsMigration} from '../types'
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

GatsbyNode.sourceNodes = async ({actions, createContentDigest}) => {
  const {createNode} = actions

  const notifications = await getJaenDataForPlugin<
    INotificationsMigration['notifications']
  >('JaenNotify@0.0.1')

  for (const entity of Object.values(notifications)) {
    const node = {
      ...entity,
      parent: null,
      children: [],
      internal: {
        type: 'JaenNotification',
        content: JSON.stringify(entity),
        contentDigest: createContentDigest(entity)
      }
    }

    createNode(node)
  }
}

export default GatsbyNode

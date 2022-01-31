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

export default GatsbyNode

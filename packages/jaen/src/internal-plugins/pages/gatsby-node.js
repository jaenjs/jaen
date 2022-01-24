const {useGatsbyNode} = require('gatsby-plugin-ts-config')

// All of the same usage patterns for `useGatsbyConfig` are valid for `useGatsbyNode`
// as well
module.exports = useGatsbyNode(() => require('./internal/gatsby/gatsby-node'))

const path = require('path')

const siteMetadata = require('./site-metadata')

module.exports = {
  siteMetadata,
  plugins: [
    {
      resolve: '@jaenjs/jaen',
      options: {
        jaenProjectId: 1
      }
    },
    '@chakra-ui/gatsby-plugin',
    {
      resolve: 'gatsby-plugin-webpack-bundle-analyser-v2'
    }
  ]
}

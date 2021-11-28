const path = require('path')

const siteMetadata = require('./site-metadata')

module.exports = {
  siteMetadata,
  plugins: [
    '@jaenjs/jaen',
    {
      resolve: 'gatsby-plugin-webpack-bundle-analyser-v2'
    }
  ]
}

const path = require('path')

const siteMetadata = require('./site-metadata')

module.exports = {
  siteMetadata,
  plugins: [
    {
      resolve: '@jaenjs/jaen',
      options: {
        //
        templates: {
          rootDir: path.resolve('./src/templates'),
          paths: {
            BlogPage: 'BlogPage.tsx'
          }
          //
        }
      }
    },
    {
      resolve: 'gatsby-plugin-webpack-bundle-analyser-v2'
    }
  ]
}

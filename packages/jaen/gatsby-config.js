const path = require('path')

module.exports = {
  jsxRuntime: 'automatic',
  jsxImportSource: '@emotion/react',
  plugins: [
    //`@chakra-ui/gatsby-plugin`,
    `gatsby-plugin-sharp`,
    `gatsby-transformer-sharp`,
    `gatsby-plugin-image`,
    `gatsby-plugin-react-helmet`,
    `gatsby-plugin-emotion`,
    {
      resolve: 'gatsby-plugin-react-svg',
      options: {
        rule: {
          include: /assets/
        }
      }
    },
    {
      resolve: 'gatsby-plugin-compile-es6-packages',
      options: {
        modules: [
          '@jaenjs/jaen',
          '@chakra-ui/gatsby-plugin',
          'gatsby-plugin-image'
        ]
      }
    },
    {
      resolve: `gatsby-alias-imports`,
      options: {
        aliases: {
          '@actions': path.resolve(__dirname, 'src/store/actions'),
          '@store': path.resolve(__dirname, 'src/store'),
          '@src': path.resolve(__dirname, 'src'),
          '@components': path.resolve(__dirname, 'src/components'),
          '@containers': path.resolve(__dirname, 'src/containers'),
          '@reducers': path.resolve(__dirname, 'src/store/reducers'),
          '@contexts': path.resolve(__dirname, 'src/contexts'),
          '@common': path.resolve(__dirname, 'src/common'),
          '@assets': path.resolve(__dirname, 'src/assets')
        }
      }
    }
    // {
    //   resolve: '@snek-at/gatsby-plugin-chakra-ui',
    //   options: {disableProvider: true}
    // }
  ]
}

module.exports = {
  jsxRuntime: 'automatic',
  jsxImportSource: '@emotion/react',
  plugins: [
    '@chakra-ui/gatsby-plugin',
    {
      resolve: `gatsby-plugin-compile-es6-packages`,
      options: {
        modules: [
          `@jaenjs/jaen`,
          `@chakra-ui/gatsby-plugin`,
          'gatsby-plugin-image'
        ]
      }
    },
    {
      resolve: `gatsby-plugin-sharp`,
      options: {
        defaults: {
          formats: [`auto`, `webp`],
          placeholder: `dominantColor`,
          quality: 50,
          breakpoints: [750, 1080, 1366, 1920],
          backgroundColor: `transparent`,
          tracedSVGOptions: {},
          blurredOptions: {},
          jpgOptions: {},
          pngOptions: {},
          webpOptions: {},
          avifOptions: {}
        }
      }
    },
    `gatsby-transformer-sharp`,
    `gatsby-plugin-image`
  ]
}

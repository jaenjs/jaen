require('ts-node').register({
  compilerOptions: {
    module: 'commonjs',
    target: 'es2017'
  }
})

module.exports = {
  jsxRuntime: 'automatic',
  jsxImportSource: '@emotion/react',
  plugins: [
    '@chakra-ui/gatsby-plugin',
    {
      resolve: `gatsby-plugin-compile-es6-packages`,
      options: {
        modules: [`@jaenjs/jaen`, `@chakra-ui/gatsby-plugin`]
      }
    }
  ]
}

import {GatsbyConfig} from 'gatsby'
import path from 'path'

const Config: GatsbyConfig = {
  jsxRuntime: 'automatic',
  jsxImportSource: '@emotion/react',
  plugins: [
    {
      resolve: `gatsby-plugin-postcss`,
      options: {
        postCssPlugins: [
          require('tailwindcss')({
            config: path.resolve(__dirname, '../../tailwind.config.ts')
          }),
          require('autoprefixer')
        ]
      }
    },
    // No gatsby-plugin-manifest here. Every instance of that plugin writes the
    // same public/manifest.webmanifest, and the last one to run wins, so this
    // copy-pasted 'Jaen App' block would have replaced the consuming site's own
    // manifest. limosen.at ships 'KRCLimo App' with start_url /login and keeps it.
    {
      resolve: `gatsby-plugin-offline`,
      options: {
        // you can keep your existing options here
        appendScript: require.resolve('../../src/sw-push.js')
      }
    }
  ]
}

export default Config

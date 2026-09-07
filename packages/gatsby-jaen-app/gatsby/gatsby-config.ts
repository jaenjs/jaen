import {GatsbyConfig} from 'gatsby'

/**
 * The app's own service worker, and what a deploy must not do to it.
 *
 * See okf/architecture/offline.md, "The installed app never goes white after
 * a deploy". Three of the four decisions live here, the fourth in
 * src/sw-push.js, which is appended to the generated worker.
 *
 *   skipWaiting, clientsClaim   Already the plugin's defaults, written out
 *                               because they are decisions now: the new
 *                               worker takes over the moment it is installed
 *                               rather than waiting for an installed app to
 *                               be swiped out of the app switcher, which on
 *                               iOS can be never.
 *
 *   precachePages               Not set, deliberately. The shell is the only
 *                               page in the precache and it is the offline
 *                               fallback only. Precaching the app's routes
 *                               would put more of yesterday's build on the
 *                               phone, which is the failure this is fixing.
 *
 *   runtimeCaching              Two of the plugin's four entries are
 *                               neutralised so src/sw-push.js can own scripts
 *                               and stylesheets. It has to own them because a
 *                               route registered from an appended file can
 *                               only run after the ones generateSW writes,
 *                               and the plugin's CacheFirst would answer
 *                               first and hand a deploy's 404 straight to the
 *                               page. The array is merged INDEX BY INDEX with
 *                               the plugin's own (lodash merge), so the four
 *                               entries below are the plugin's four in its
 *                               order, two of them rewritten. Adding one here
 *                               adds a fifth route, it does not shift the
 *                               others.
 */
const NEVER = /taxi-app-no-route/

const Config: GatsbyConfig = {
  jsxRuntime: 'automatic',
  jsxImportSource: '@emotion/react',
  plugins: [
    // No PostCSS and no Tailwind: every screen is Chakra, and the one
    // stylesheet left, src/styles/app.css, is plain CSS Gatsby loads itself.
    // No gatsby-plugin-manifest here. Every instance of that plugin writes the
    // same public/manifest.webmanifest, and the last one to run wins, so this
    // copy-pasted 'Jaen App' block would have replaced the consuming site's own
    // manifest. limosen.at ships 'KRCLimo App' with start_url /login and keeps it.
    {
      resolve: `gatsby-plugin-offline`,
      options: {
        appendScript: require.resolve('../../src/sw-push.js'),
        workboxConfig: {
          skipWaiting: true,
          clientsClaim: true,
          runtimeCaching: [
            // 0 was CacheFirst on /(\.js$|\.css$|static\/)/. src/sw-push.js
            // registers the same pattern with a handler that falls back to
            // the previous build's copy of a file the deploy removed.
            {urlPattern: NEVER, handler: `NetworkOnly`},
            // 1 page-data.json, static query results and app-data.json,
            // unchanged: they are not content hashed and must revalidate.
            {
              urlPattern: /^https?:.*\/page-data\/.*\.json/,
              handler: `StaleWhileRevalidate`
            },
            // 2 was the same StaleWhileRevalidate for pictures, fonts and
            // json, and it also matched js and css, so it would have answered
            // a script before our own route ever saw it. The two build asset
            // types are taken out of it and nothing else changes.
            {
              urlPattern:
                /^https?:.*\.(png|jpg|jpeg|webp|avif|svg|gif|tiff|woff|woff2|json)$/,
              handler: `StaleWhileRevalidate`
            },
            // 3 Google Fonts CSS, unchanged.
            {
              urlPattern: /^https?:\/\/fonts\.googleapis\.com\/css/,
              handler: `StaleWhileRevalidate`
            }
          ]
        }
      }
    }
  ]
}

export default Config

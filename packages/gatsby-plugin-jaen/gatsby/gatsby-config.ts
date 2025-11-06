import {GatsbyConfig} from 'gatsby'

import {messagesByLocale} from '../src/locales/messages'

const defaultLocale = 'en-US'

// const systemPageBlacklist = ['/cms/', '/login/', '/mailpress/', '/settings/', '/logout/'];

const locales = Object.entries(messagesByLocale).map(([locale, messages]) => {
  const prefix = locale.split('-')[0]

  // const pageBlacklist =
  //   locale === defaultLocale ? undefined : systemPageBlacklist

  return {
    locale,
    prefix,
    slugs: {},
    messages,
    //...(pageBlacklist ? {pageBlacklist} : {})
  }
})

const siteUrl =
  process.env.GATSBY_SITE_URL || process.env.SITE_URL || 'https://page.jaen.io'

const Config: GatsbyConfig = {
  jsxRuntime: 'automatic',
  jsxImportSource: '@emotion/react',
  plugins: [
    {
      resolve: `gatsby-plugin-i18n-l10n`,
      options: {
        defaultLocale,
        siteUrl,
        locales
      }
    },
    `gatsby-plugin-image`,
    `gatsby-plugin-sharp`,
    `gatsby-transformer-sharp`,
    `gatsby-source-jaen`,
    {
      resolve: `gatsby-plugin-sitemap`,
      options: {
        excludes: [
          '/cms',
          '/cms/*',
          '/login',
          '/logout',
          '/password_reset',
          '/settings',
          '/signup'
        ],
        query: `
        {
          jaenSite {
            id
            siteMetadata {
              siteUrl
            }
          }
          allSitePage {
            nodes {
              path
            }
          }
        }`,
        resolveSiteUrl: data => {
          console.log('RESOLVE SITE URL', data)
          return data.jaenSite?.siteMetadata?.siteUrl || 'https://page.jaen.io'
        },
        resolvePages: data => {
          return data.allSitePage.nodes.map(page => {
            return {...page}
          })
        },
        serialize: ({path, modifiedGmt}: any) => {
          return {
            url: path,
            lastmod: modifiedGmt
          }
        }
      }
    },
    {
      resolve: `gatsby-plugin-manifest`,
      options: {
        name: `Jaen App`,
        short_name: `Jaen`,
        start_url: `/`,
        background_color: `#f7f0eb`,
        theme_color: `#a2466c`,
        display: `standalone`,
        icon: `src/favicon.ico`
      }
    },
    {
      resolve: 'gatsby-plugin-google-gtag',
      options: {
        trackingIds: [],
        gtagConfig: {
          anonymize_ip: true
        },
        pluginConfig: {
          head: true
        }
      }
    },
    {
      resolve: '@sentry/gatsby',
      options: {
        sampleRate: 1,
        enableTracing: true,
        debug: true,
        // Performance Monitoring
        tracesSampleRate: 1.0, //  Capture 100% of the transactions
        // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
        // Session Replay
        replaysSessionSampleRate: 1.0, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
        replaysOnErrorSampleRate: 1.0 // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
      }
    },
    {
      resolve: 'gatsby-plugin-remove-console',
      options: {
        exclude: ['error', 'warn'] // <- Errors should not be removed
      }
    }
  ]
}

export default Config

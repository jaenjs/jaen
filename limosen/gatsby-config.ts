import type { GatsbyConfig } from 'gatsby';
import { messagesByLocale } from './src/locales/messages';

require('dotenv').config({
  path: `.env.public`
});

const config: GatsbyConfig = {
  siteMetadata: {
    siteUrl: `https://limosen.at/`
  },
  // More easily incorporate content into your pages through automatic TypeScript type generation and better GraphQL IntelliSense.
  // If you use VSCode you can also use the GraphQL plugin
  // Learn more at: https://gatsby.dev/graphql-typegen
  graphqlTypegen: true,
  flags: {
    DEV_SSR: false
  },
  plugins: [
    `gatsby-plugin-remove-console`,
    `gatsby-plugin-cloudflare-pages`,
    {
      resolve: `gatsby-plugin-jaen`,
      options: {
        pylonUrl: 'https://services.netsnek.com/jaen/graphql',
        remote: {
          repository: 'netsnek/limosen.at'
        },
        zitadel: {
          organizationId: '339284789469124181',
          clientId: '268283382465631862@cms',
          authority: 'https://accounts.netsnek.com',
          redirectUri:
            process.env.NODE_ENV === 'production'
              ? 'https://limosen.at'
              : 'https://psychic-dollop-6vwv6x9vq9jf464g-8000.app.github.dev',
          projectIds: ['2268283277977065078']
        },
        // sentry: {
        //   org: 'photonq',
        //   project: 'website',
        //   dsn: 'https://37ffbc7589f79cfab5936ce5fca4f310@sentry.cronit.io/10'
        // },
        googleAnalytics: {
          trackingIds: ['G-G6Z65QP3Y3']
        }
      }
    },
    {
      resolve: `gatsby-jaen-mailpress`,
      options: {
        pylonUrl: 'https://mailpress.netsnek.com/graphql'
      }
    },
    //`gatsby-jaen-lens`
    {
      resolve: 'gatsby-plugin-i18n-l10n',
      options: {
        siteUrl: 'https://limosen.at/',
        defaultLocale: 'en-US',
        locales: [
          {
            locale: 'en-US',
            prefix: 'en',
            messages: messagesByLocale['en-US'], // <-- plain object from TS
            slugs: {}
          },
          {
            locale: 'de-AT',
            prefix: 'de',
            messages: messagesByLocale['de-AT'],
            slugs: {}
          },
          {
            locale: 'tr-TR',
            prefix: 'tr',
            messages: messagesByLocale['tr-TR'],
            slugs: {}
          },
          {
            locale: 'ar-EG',
            prefix: 'ar',
            messages: messagesByLocale['ar-EG'],
            slugs: {}
          }
        ],
        trailingSlash: 'always'
      }
    }
  ]
};

export default config;

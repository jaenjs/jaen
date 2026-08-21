import {GatsbyNode, PluginOptions} from 'gatsby'
import path from 'path'

export interface JaenPluginOptions extends PluginOptions {
  remote: {
    repository: string
    cwd?: string
  }
  pylonUrl?: string
  /**
   * Origin of the storage gateway holding CMS media, without a trailing path
   * -- `/graphql` and `/storage/<id>` are derived from it.
   *
   * Unset, jaen uses the public osg.snek.at, which is what every site did
   * before this option existed. Anything with a data-governance obligation
   * should point this at its own gateway.
   */
  storageUrl?: string
  zitadelGql: {
    organizationId: string
    clientId: string
    authority: string
    redirectUri: string
    projectIds?: string[]
    /** GraphQL endpoint of the zitadel-gql server. Defaults to `${authority}/graphql`. */
    graphqlUrl?: string
  }
  googleAnalytics?: {
    trackingIds?: string[]
  }
  sentry?: {
    org: string
    project: string
    dsn: string
  }
  /** Absolute site origin; forwarded to gatsby-source-jaen for the sitemap. */
  siteUrl?: string
  /**
   * Localized page generation, forwarded to gatsby-source-jaen. The default
   * locale keeps unprefixed paths; every other locale is served under its
   * prefix. System routes (cms, login, ...) are never localized.
   */
  i18n?: {
    defaultLocale: string
    locales: Array<{
      locale: string
      prefix?: string
      slugs?: Record<string, string>
      pageBlacklist?: string[]
    }>
    trailingSlash?: 'always' | 'never' | 'ignore'
  }
}

export const pluginOptionsSchema: GatsbyNode['pluginOptionsSchema'] = ({
  Joi
}) => {
  return Joi.object({
    remote: Joi.object({
      repository: Joi.string().required(),
      cwd: Joi.string()
    }).required(),
    pylonUrl: Joi.string(),
    storageUrl: Joi.string().uri(),
    zitadelGql: Joi.object({
      organizationId: Joi.string().required(),
      clientId: Joi.string().required(),
      authority: Joi.string().required(),
      redirectUri: Joi.string().required(),
      projectIds: Joi.array().items(Joi.string()),
      graphqlUrl: Joi.string().uri()
    }).required(),

    googleAnalytics: Joi.object({
      trackingIds: Joi.array().items(Joi.string())
    }),
    sentry: Joi.object({
      org: Joi.string().required(),
      project: Joi.string().required(),
      dsn: Joi.string().required(),
      feedbackIntegration: Joi.object()
    }),
    siteUrl: Joi.string().uri(),
    i18n: Joi.object({
      defaultLocale: Joi.string().required(),
      locales: Joi.array()
        .items(
          Joi.object({
            locale: Joi.string().required(),
            prefix: Joi.string(),
            slugs: Joi.object().pattern(Joi.string(), Joi.string()),
            pageBlacklist: Joi.array().items(Joi.string())
          })
        )
        .min(1)
        .required(),
      trailingSlash: Joi.string().valid('always', 'never', 'ignore')
    }).custom((i18n: any, helpers: any) => {
      // A defaultLocale that matches no locale entry would strip the
      // unprefixed pages and silently drop x-default — fail the build.
      if (
        !i18n.locales.some((entry: any) => entry.locale === i18n.defaultLocale)
      ) {
        return helpers.message({
          custom: `i18n.defaultLocale "${i18n.defaultLocale}" is not in i18n.locales`
        })
      }

      return i18n
    })
  })
}

export const onCreateWebpackConfig: GatsbyNode['onCreateWebpackConfig'] =
  async (
    {actions, loaders, stage, plugins, getConfig},
    pluginOptions: JaenPluginOptions
  ) => {
    const {version} = await import('jaen/package.json')

    const config = getConfig()

    const babelLoaderRule = config.module.rules.find(
      (rule: any) => String(rule.test) === String(/\.(js|mjs|jsx|ts|tsx)$/)
    )

    // Fix HMR by removing the pageConfig API from the babel-loader
    const babelLoaderWithPlugin = {
      ...babelLoaderRule,
      use: ({resourceQuery, issuer}: any) => {
        const babelLoaderOptions = {
          loader: 'babel-loader',
          options: {
            plugins: [
              require.resolve('../../babel-plugin-remove-page-config.js')
            ]
          }
        }

        const existingLoaders = babelLoaderRule.use({resourceQuery, issuer})
        return [babelLoaderOptions, ...existingLoaders]
      }
    }

    config.module.rules = [
      ...config.module.rules.filter(
        (rule: any) => String(rule.test) !== String(/\.(js|mjs|jsx|ts|tsx)$/)
      ),

      babelLoaderWithPlugin
    ]

    actions.replaceWebpackConfig(config)

    if (stage === 'build-html' || stage === 'develop-html') {
      actions.setWebpackConfig({
        module: {
          rules: [
            {
              test: /filerobot-image-editor/,
              use: loaders.null()
            },
            {
              test: /reagraph/,
              use: loaders.null()
            }
          ]
        }
      })
    }

    actions.setWebpackConfig({
      plugins: [
        plugins.define({
          __VERSION__: JSON.stringify(version),

          __JAEN_REMOTE__: JSON.stringify(pluginOptions.remote),
          __JAEN_PYLON_URL__: JSON.stringify(pluginOptions.pylonUrl),
          __JAEN_STORAGE_URL__: JSON.stringify(pluginOptions.storageUrl),
          __JAEN_ZITADEL_GQL__: JSON.stringify(pluginOptions.zitadelGql)
        })
      ]
    })
  }

export const onPreInit: GatsbyNode['onPreInit'] = async (
  {store},
  pluginOptions: JaenPluginOptions
) => {
  // find and remove gatsby-plugin-manifest from store
  const state = store.getState()

  const manifestPlugin = state.flattenedPlugins.find(
    (plugin: any) => plugin.name === 'gatsby-plugin-manifest'
  )

  if (manifestPlugin) {
    // const manifestOptions = await resolveManifestOptions({
    //   snekResourceId: pluginOptions.snekResourceId,
    //   reporter
    // })
    // manifestPlugin.pluginOptions = {
    //   ...manifestPlugin.pluginOptions,
    //   ...manifestOptions
    // }
  }

  // Override the gatsby-plugin-google-gtag trackingIds
  const gtagPlugin = state.flattenedPlugins.find(
    (plugin: any) => plugin.name === 'gatsby-plugin-google-gtag'
  )

  if (gtagPlugin) {
    // When no trackingIds are set, use [] as default
    // This should disable gtag
    const trackingIds = pluginOptions.googleAnalytics?.trackingIds || []

    if (trackingIds) {
      gtagPlugin.pluginOptions.trackingIds.push(...trackingIds)
    }
  }

  const sentryPlugin = state.flattenedPlugins.find(
    (plugin: any) => plugin.name === '@sentry/gatsby'
  )

  if (sentryPlugin) {
    // Override sentry plugin options

    if (pluginOptions.sentry) {
      sentryPlugin.pluginOptions.dsn = pluginOptions.sentry.dsn

      // Write sentry.org and sentry.project to process.env
      process.env.SENTRY_ORG = pluginOptions.sentry.org
      process.env.SENTRY_PROJECT = pluginOptions.sentry.project
      process.env.SENTRY_URL = new URL(pluginOptions.sentry.dsn).origin
    } else {
      sentryPlugin.pluginOptions.enabled = false
    }
  }

  // state.flattenedPlugins[state.flattenedPlugins.indexOf(manifestPlugin)] =
  //   manifestPlugin
  // state.flattenedPlugins[state.flattenedPlugins.indexOf(gtagPlugin)] =
  //   gtagPlugin

  // // push back to store
  // store.dispatch({
  //   type: `SET_SITE_FLATTENED_PLUGINS`,
  //   payload: state.flattenedPlugins
  // })
}

export const createPages: GatsbyNode['createPages'] = async ({actions}) => {
  // const snekResourceId = pluginOptions.snekResourceId as string | undefined

  // Create JaenFrame slice

  actions.createSlice({
    id: `jaen-frame`,
    component: path.resolve(__dirname, '../../src/slices/jaen-frame.tsx')
  })
}

// const resolveManifestOptions = async ({
//   snekResourceId,
//   reporter
// }: {
//   snekResourceId?: string
//   reporter: Reporter
// }) => {
//   // Fetch from services.snek.at

//   let resource: {
//     id: string
//     name: string
//   }

//   try {
//     const query = `
//   query Manifest($resourceId: String!) {
//     resource(id: $resourceId) {
//       id
//       name
//     }
//   }
//   `

//     const variables = {
//       resourceId: snekResourceId
//     }

//     const response = await fetch('https://services.snek.at/graphql', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json'
//       },
//       body: JSON.stringify({query, variables})
//     })

//     const json = await response.json()

//     if (json.errors) {
//       throw new Error(json.errors[0].message)
//     }

//     resource = json.data.resource
//   } catch (err) {
//     reporter.warn(
//       `gatsby-plugin-manifest - failed to fetch resource ${snekResourceId} from services.snek.at`
//     )

//     resource = {
//       id: 'dev',
//       name: 'Development Resource'
//     }
//   }

//   return {
//     name: resource.name,
//     short_name: resource.name,
//     start_url: '/',
//     background_color: `#f7f0eb`,
//     theme_color: `#a2466c`,
//     display: `standalone`,
//     icon: `src/favicon.ico`
//   }
// }

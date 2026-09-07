import {GatsbyNode} from 'gatsby'

import {sourceNodes as sourceNodesJaenData} from './source-nodes/jaen-data'
import {sourceNodes as sourceNodesJaenPages} from './source-nodes/jaen-pages'
import {createPages as createPagesJaenPages} from './create-pages/jaen-pages'
import {sourceNodes as sourceNodesJaenSite} from './source-nodes/jaen-site'
import {sourceNodes as sourceNodesJaenWidget} from './source-nodes/jaen-widget'

import {onCreatePage as onCreatePageJaenPage} from './on-create-page/jaen-page'
import {onCreateNode as onCreateNodeJaenPage} from './on-create-node/jaen-page'
import {onCreateNode as onCreateNodeJaenTemplate} from './on-create-node/jaen-template'

import {shouldOnCreateNode as shouldOnCreateNodeJaenPage} from './should-on-create-node/jaen-page'
import {shouldOnCreateNode as shouldOnCreateNodeJaenTemplate} from './should-on-create-node/jaen-template'

import {createSchemaCustomization as createSchemaCustomizationJaenPage} from './create-schema-customization/jaen-page'
import {createSchemaCustomization as createSchemaCustomizationJaenTemplate} from './create-schema-customization/jaen-template'
import {createSchemaCustomization as createSchemaCustomizationJaenData} from './create-schema-customization/jaen-data'
import {createSchemaCustomization as createSchemaCustomizationJaenSite} from './create-schema-customization/jaen-site'
import {createSchemaCustomization as createSchemaCustomizationJaenWidget} from './create-schema-customization/jaen-widget'
import {createSchemaCustomization as createSchemaCustomizationSitePageContext} from './create-schema-customization/site-page-context'

import {onCreateWebpackConfig as onCreateWebpackConfigJaenTemplate} from './on-create-webpack-config/jaen-template'
import {onCreateWebpackConfig as onCreateWebpackConfigJaenData} from './on-create-webpack-config/jaen-data'

import {onPostBuild as onPostBuildSitemap} from './on-post-build/sitemap'
import {onPostBuild as onPostBuildOsgMedia} from './on-post-build/osg-media'

import {
  i18nFromPluginOptions,
  siteUrlFromPluginOptions
} from './utils/plugin-options'

export const pluginOptionsSchema: GatsbyNode['pluginOptionsSchema'] = ({
  Joi
}) => {
  return Joi.object({
    siteUrl: Joi.string().uri(),
    storageUrl: Joi.string().uri(),
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

export const sourceNodes: GatsbyNode['sourceNodes'] = async (
  args,
  pluginOptions
) => {
  await sourceNodesJaenData(args, pluginOptions)

  // Must be called after sourceJaenNodes
  await sourceNodesJaenPages(args)
  await sourceNodesJaenSite(args)
  await sourceNodesJaenWidget(args)
}

export const createPages: GatsbyNode['createPages'] = async (
  args,
  pluginOptions
) => {
  await createPagesJaenPages(args, i18nFromPluginOptions(pluginOptions))
}

export const onCreatePage: GatsbyNode['onCreatePage'] = async (
  args,
  pluginOptions
) => {
  await onCreatePageJaenPage(args, i18nFromPluginOptions(pluginOptions))
}

export const onCreateNode: GatsbyNode['onCreateNode'] = async args => {
  await onCreateNodeJaenPage(args)
  await onCreateNodeJaenTemplate(args)
}

export const shouldOnCreateNode: GatsbyNode['shouldOnCreateNode'] = args => {
  // Return true if any of the plugins should create a node
  return [
    shouldOnCreateNodeJaenPage(args),
    shouldOnCreateNodeJaenTemplate(args)
  ].some(Boolean)
}

export const createSchemaCustomization: GatsbyNode['createSchemaCustomization'] =
  async args => {
    await Promise.all([
      createSchemaCustomizationJaenPage(args),
      createSchemaCustomizationJaenTemplate(args),
      createSchemaCustomizationJaenData(args),
      createSchemaCustomizationJaenSite(args),
      createSchemaCustomizationJaenWidget(args),
      createSchemaCustomizationSitePageContext(args)
    ])
  }

export const onCreateWebpackConfig: GatsbyNode['onCreateWebpackConfig'] =
  async args => {
    await onCreateWebpackConfigJaenTemplate(args)
    await onCreateWebpackConfigJaenData(args)
  }

export const onPostBuild: GatsbyNode['onPostBuild'] = async (
  args,
  pluginOptions
) => {
  await onPostBuildSitemap(args, {
    siteUrl: siteUrlFromPluginOptions(pluginOptions),
    i18n: i18nFromPluginOptions(pluginOptions)
  })

  await onPostBuildOsgMedia(args)
}

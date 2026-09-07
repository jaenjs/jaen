import {PluginOptions} from 'gatsby'

import type {JaenI18nOptions} from './i18n'

/**
 * Options of gatsby-source-jaen. Both are usually forwarded by
 * gatsby-plugin-jaen's gatsby-config rather than set by the site directly.
 */
export interface JaenSourceOptions extends PluginOptions {
  /** Localized page generation. Absent = single-locale site, no fan-out. */
  i18n?: JaenI18nOptions
  /** Absolute site origin, used by the sitemap and hreflang emission. */
  siteUrl?: string
  /**
   * Origin of the storage gateway holding this site's media, no trailing path.
   *
   * The build fetches every media file the jaen data names from here with
   * OSG_TOKEN and serves the files from the site's own output, so the
   * published site never asks the gateway for anything. Forwarded by
   * gatsby-plugin-jaen from its own `storageUrl` option; the two are the same
   * value and the client half of it is the `__JAEN_STORAGE_URL__` define.
   */
  storageUrl?: string
}

/** Narrow raw plugin options to the i18n config, if one was provided. */
export const i18nFromPluginOptions = (
  pluginOptions: unknown
): JaenI18nOptions | undefined => {
  const options = pluginOptions as Partial<JaenSourceOptions> | undefined
  const i18n = options?.i18n

  if (!i18n || !i18n.defaultLocale || !Array.isArray(i18n.locales)) {
    return undefined
  }

  return i18n
}

/** The gateway origin from plugin options, normalized. */
export const storageUrlFromPluginOptions = (
  pluginOptions: unknown
): string | undefined => {
  const options = pluginOptions as Partial<JaenSourceOptions> | undefined

  return options?.storageUrl?.replace(/\/+$/, '')
}

/** The site origin from plugin options or environment, normalized. */
export const siteUrlFromPluginOptions = (
  pluginOptions: unknown
): string | undefined => {
  const options = pluginOptions as Partial<JaenSourceOptions> | undefined
  const raw =
    options?.siteUrl ||
    process.env.GATSBY_SITE_URL ||
    process.env.SITE_URL ||
    undefined

  return raw?.replace(/\/+$/, '')
}

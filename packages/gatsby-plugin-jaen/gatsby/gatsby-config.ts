import {GatsbyConfig} from 'gatsby'

interface JaenThemeI18nOptions {
  defaultLocale: string
  locales: Array<{
    locale: string
    prefix?: string
    slugs?: Record<string, string>
    pageBlacklist?: string[]
  }>
  trailingSlash?: 'always' | 'never' | 'ignore'
}

interface JaenThemeOptions {
  i18n?: JaenThemeI18nOptions
  siteUrl?: string
  /** Origin of the storage gateway holding this site's media. */
  storageUrl?: string
}

/**
 * Theme config. i18n, siteUrl and storageUrl are forwarded to
 * gatsby-source-jaen, which owns localized page generation, the hreflang-aware
 * sitemap.xml / robots.txt emission (the former gatsby-plugin-sitemap had
 * neither i18n awareness nor system-route knowledge and is gone) and, since
 * the storage gateway went private, fetching this site's media at build time
 * and serving it from the site's own origin.
 */
const Config = (themeOptions: JaenThemeOptions): GatsbyConfig => ({
  jsxRuntime: 'automatic',
  jsxImportSource: '@emotion/react',
  plugins: [
    `gatsby-plugin-image`,
    `gatsby-plugin-sharp`,
    `gatsby-transformer-sharp`,
    {
      resolve: `gatsby-source-jaen`,
      options: {
        ...(themeOptions.i18n ? {i18n: themeOptions.i18n} : {}),
        ...(themeOptions.siteUrl ? {siteUrl: themeOptions.siteUrl} : {}),
        // The gateway the build fetches this site's media from, with
        // OSG_TOKEN. One option for both halves: the client reads the same
        // value as the __JAEN_STORAGE_URL__ define.
        ...(themeOptions.storageUrl
          ? {storageUrl: themeOptions.storageUrl}
          : {})
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
    /**
     * `gatsby-plugin-google-gtag` is deliberately not registered here either,
     * and for a harder reason than Sentry below.
     *
     * Its `onRenderBody` writes four elements into every built page with no
     * condition on any of them but NODE_ENV — read node_modules/
     * gatsby-plugin-google-gtag/gatsby-ssr.js:
     *
     *     setHeadComponents([<link rel="preconnect" href={origin}/>,
     *                        <link rel="dns-prefetch" href={origin}/>])
     *     ...
     *     setComponents([<script async src={origin + "/gtag/js?id=" + id}/>,
     *                    <script>{renderHtml()}</script>])
     *
     * `pluginOptionsSchema` in its gatsby-node.js offers `trackingIds`,
     * `gtagConfig` and a `pluginConfig` of head / respectDNT / exclude /
     * origin / delayOnRouteUpdate. Not one of them suppresses the two links,
     * and `respectDNT` only wraps the inline config script in an `if`, leaving
     * the `<script src>` in place. An empty `trackingIds` does not help
     * either: the preconnect is emitted regardless and the script is still
     * requested, with an empty id.
     *
     * A preconnect is not a hint that costs nothing. The browser resolves DNS
     * and completes the TCP and TLS handshake immediately, so Google learns
     * the visitor's IP address, and through the SNI extension the host, before
     * the cookie banner has been answered — before it has even painted. The
     * `window['ga-disable-<id>']` flag this theme used to set in
     * on-client-entry stopped the tag from tracking, but it could not stop any
     * of that, because all of it happens while the flag is being set.
     *
     * So gtag.js is loaded by hand in src/gatsby/on-client-entry.ts, after the
     * visitor has allowed the consent category, with the tracking ids and the
     * gtag config coming from the `googleAnalytics` plugin option. Nothing
     * reaches www.googletagmanager.com before that, which also means a
     * Lighthouse or PageSpeed run — neither of which ever answers a banner —
     * no longer pays for a third party the visitor was not asked about.
     */
    /**
     * `@sentry/gatsby` is deliberately not registered here.
     *
     * Its gatsby-browser calls `Sentry.init` for every visitor the moment the
     * runtime starts, which is before anyone has answered the cookie banner,
     * and there is no option that turns that off: gatsby-node writes the dsn
     * into this plugin's options, and the plugin treats any option at all as
     * "configured, go". Registering it and hoping is not a gate.
     *
     * The SDK is loaded by hand in src/gatsby/on-client-entry.ts once the
     * visitor has allowed the consent category, with the sampling rates and
     * the integration list coming from the `sentry` plugin option.
     */
    {
      resolve: 'gatsby-plugin-remove-console',
      options: {
        exclude: ['error', 'warn'] // <- Errors should not be removed
      }
    }
  ]
})

export default Config

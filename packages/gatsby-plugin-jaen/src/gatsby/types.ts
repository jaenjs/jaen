import {PluginOptions} from 'gatsby'
import type {feedbackIntegration} from '@sentry/gatsby'

export interface JaenPluginOptions extends PluginOptions {
  /**
   * The OIDC provider jaen signs in against, and the Zitadel API it manages
   * users through. The two are separate concerns that happen to share a host
   * in the deployment this was written for.
   *
   * The sign-in half is plain OIDC and works against any provider. The two
   * places that were Zitadel-shaped are now options:
   *
   *   `scope`      Zitadel needs its own URN scopes to put the roles claim in
   *                the token and to set the audience. Another provider needs
   *                none of that. Left unset, the Zitadel scopes are derived
   *                from organizationId and projectIds, which is what every
   *                existing site expects.
   *
   *   `rolesClaim` where the roles live in the token. Zitadel writes an array
   *                of objects keyed by role name; most providers write a plain
   *                array of strings. Both shapes are read.
   *
   * `organizationId` and `projectIds` are only consulted while deriving the
   * default scope, so a non-Zitadel site can leave them out.
   */
  zitadelGql: {
    organizationId?: string
    clientId: string
    authority: string
    redirectUri: string
    projectIds?: string[]
    /** Overrides the derived scope entirely. */
    scope?: string
    /** Default: `urn:zitadel:iam:org:project:roles`. */
    rolesClaim?: string
  }

  googleAnalytics?: JaenGoogleAnalyticsOptions

  /**
   * Localized page generation. Only the parts the browser side reads are
   * declared; gatsby-node's copy of this interface carries the rest.
   */
  i18n?: {
    defaultLocale: string
    locales: Array<{
      locale: string
      prefix?: string
    }>
  }

  sentry?: JaenSentryOptions

  /**
   * The colour mode a visitor lands on, read by wrap-root-element as the
   * next-themes `defaultTheme`. `light` or `dark` is written onto <html> at
   * the first paint, `system` follows the OS. Default `light`. Validated in
   * gatsby-node's schema, so an unknown value fails the build.
   */
  colorMode?: {
    default?: 'light' | 'dark' | 'system'
  }
}

/**
 * Google Analytics is not registered as a gatsby plugin any more and does not
 * load itself. `on-client-entry` injects gtag.js by hand once the visitor has
 * allowed `consentCategory`, so everything the tag needs has to be reachable
 * from here.
 *
 * `gatsby-plugin-google-gtag` wrote three things into every page from its
 * `onRenderBody`, unconditionally: `<link rel="preconnect">`,
 * `<link rel="dns-prefetch">` and `<script async src=".../gtag/js?id=…">`. The
 * script was the visible half; the preconnect was the worse one, because it
 * resolves DNS and completes a TLS handshake against Google before a byte is
 * requested, so the visitor's address and — through SNI — the host they are
 * reaching for had been handed over before the banner had finished painting.
 * None of the three had an option to turn it off. See gatsby-config.
 */
export interface JaenGoogleAnalyticsOptions {
  /**
   * Measurement ids. The first one is the id gtag.js is loaded with, every one
   * of them gets a `config` command, which is what the plugin did. No id means
   * nothing is loaded and nothing is resolved.
   */
  trackingIds?: string[]

  /**
   * Consent category the visitor has to allow before anything is fetched from
   * Google. Default `analytics`, the category the banner's own cookie table
   * lists `_ga` and `_gid` under, and the same default Sentry uses.
   */
  consentCategory?: string

  /**
   * Passed to every `gtag('config', …)`, the plugin's `gtagConfig` option.
   * Defaults to `{anonymize_ip: true}`, which is what the theme registered the
   * plugin with; a site that overrides this has to repeat it.
   *
   * `send_page_view` is not yours to set: page views are sent by hand on every
   * route change, see on-client-entry.
   */
  gtagConfig?: Record<string, unknown>

  /**
   * Where gtag.js is fetched from, the plugin's `pluginConfig.origin`. Only a
   * self-hosted proxy has a reason to change it.
   */
  origin?: string
}

/**
 * Integrations the site can ask for by name.
 *
 * They are opt-in one by one because each of them is a separate bundle that
 * only reaches the browser once it is named here, and because `replay` records
 * what the visitor does on the page, which is a different promise to the
 * visitor than reporting a stack trace.
 */
export type JaenSentryIntegration =
  | 'browserTracing'
  | 'browserProfiling'
  | 'replay'

/**
 * Sentry is not registered as a gatsby plugin any more and does not start
 * itself. `on-client-entry` imports the SDK dynamically and calls `init` only
 * after the visitor has allowed `consentCategory`, so everything the SDK needs
 * has to be reachable from here.
 *
 * Every sampling rate defaults to off. The previous setup hardcoded 1.0 for
 * traces and for both replay rates, which meant every visitor of every site
 * had their session recorded in full. A site that wants that now has to write
 * it down.
 */
export interface JaenSentryOptions {
  org: string
  project: string
  dsn: string

  /**
   * Consent category the visitor has to allow before the SDK is loaded and
   * initialised. Default `analytics`, the same category Google Analytics uses,
   * because tracing and session replay measure visitor behaviour in the way
   * that category describes and replay is the more invasive of the two.
   *
   * `necessary` is always granted and would be the same as no gate at all.
   */
  consentCategory?: string

  /** Integrations to add. Default none, so plain error reporting. */
  integrations?: JaenSentryIntegration[]

  /**
   * Share of errors that are sent. Default 1, errors are cheap and there is
   * no point in reporting a fraction of them.
   */
  sampleRate?: number

  /**
   * Default 0. Needs `browserTracing` in `integrations` to be useful, and any
   * value above 0 makes the Sentry gatsby SDK add that integration on its own
   * whether it is listed or not.
   */
  tracesSampleRate?: number

  /**
   * Default 0. Needs `browserProfiling` in `integrations`, a non-zero
   * `tracesSampleRate`, and the server has to send a
   * `Document-Policy: js-profiling` header. Without all three the profiler
   * collects nothing.
   */
  profilesSampleRate?: number

  /** Share of sessions recorded from the start. Default 0. */
  replaysSessionSampleRate?: number

  /** Share of sessions recorded once an error happens. Default 0. */
  replaysOnErrorSampleRate?: number

  /** Sentry's own console logging. Default false. */
  debug?: boolean

  /**
   * Hold errors that happen before consent in memory and send them once
   * consent is given. Default true. Nothing is stored on the device and
   * nothing leaves the browser until the visitor has allowed the category.
   */
  bufferPreConsentErrors?: boolean

  /** Presence enables the feedback widget, which also waits for consent. */
  feedbackIntegration?: Parameters<typeof feedbackIntegration>[0]
}

import {ChakraProvider} from '@chakra-ui/react'
import {ThemeProvider as NextThemeProvider} from 'next-themes'
import {
  AuthenticationProvider,
  MediaModalProvider,
  NotificationsProvider,
  JaenUpdateModalProvider,
  CookieConsentProvider,
  useAuth,
  useAuthUser
} from 'jaen'
import {GatsbyBrowser} from 'gatsby'
import {
  lazy,
  useEffect,
  useMemo,
  useState,
  type FC,
  type ReactNode
} from 'react'
import {IntlProvider} from 'react-intl'

import {useUiLocale} from '../locales/ui-locale'

import {JaenWidgetProvider} from '../contexts/jaen-widget'
import {JaenPluginOptions} from './types'
import {SiteMetadataProvider} from '../connectors/site-metadata'
import {system} from '../theme/system'
import {JaenFrameMenuProvider} from '../contexts/jaen-frame-menu'
import {Toaster} from '../components/ui/toaster'
import {Popup} from '../components/Popup'
import {messagesByLocale} from '../locales/messages'

type LocaleKey = keyof typeof messagesByLocale

const DEFAULT_LOCALE: LocaleKey = 'en-US'

const AVAILABLE_LOCALES = Object.keys(messagesByLocale) as LocaleKey[]

/**
 * Match a language tag against the available CMS locales: exact match first,
 * then the first locale sharing the base language (de -> de-AT). Derived
 * from the catalog, so adding a locale needs no code change here.
 */
const matchLocale = (candidate?: string | null): LocaleKey | undefined => {
  if (!candidate) return undefined

  const normalized = candidate.replace(/_/g, '-').toLowerCase()

  const exact = AVAILABLE_LOCALES.find(
    locale => locale.toLowerCase() === normalized
  )

  if (exact) return exact

  const base = normalized.split('-')[0]

  return AVAILABLE_LOCALES.find(
    locale => locale.split('-')[0]?.toLowerCase() === base
  )
}

/**
 * The CMS follows the language set on the account: the Zitadel profile's
 * preferredLanguage wins, then the OIDC locale claim (available right after
 * sign-in, before the profile query resolves), then the browser languages,
 * then en-US.
 */
export const JaenIntlProvider: FC<{children: ReactNode}> = ({children}) => {
  const authUser = useAuthUser()
  const auth = useAuth()
  const {previewLocale} = useUiLocale()

  const preferredLanguage = authUser?.user?.human?.profile?.preferredLanguage
  const claimLocale = auth.user?.profile?.locale

  const [browserLocale, setBrowserLocale] = useState<string | undefined>()

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      const languages = Array.isArray(navigator.languages)
        ? navigator.languages
        : [navigator.language]

      setBrowserLocale(languages.find(Boolean))
    }
  }, [])

  const locale = useMemo<LocaleKey>(() => {
    return (
      // An unsaved pick on the settings page wins for as long as the page
      // lives; the account's language takes over again on the next visit.
      matchLocale(previewLocale) ??
      matchLocale(preferredLanguage) ??
      matchLocale(claimLocale) ??
      matchLocale(browserLocale) ??
      DEFAULT_LOCALE
    )
  }, [previewLocale, preferredLanguage, claimLocale, browserLocale])

  // No key={locale}: react-intl propagates locale/messages changes through
  // context, so strings update in place instead of remounting (and thereby
  // resetting) the entire app subtree on sign-in.
  return (
    <IntlProvider
      messages={messagesByLocale[locale]}
      locale={locale}
      defaultLocale={DEFAULT_LOCALE}>
      {children}
    </IntlProvider>
  )
}

const MediaModalComponent = lazy(
  async () => await import('../containers/media-modal')
)

/**
 * The locale of the page being rendered, taken from its path.
 *
 * The consent banner is rendered here, above the router, so there is no
 * pageContext to read it from — and it has to be right at build time, because
 * the banner is baked into every one of the generated HTML files and each of
 * them has to carry its own language. During build-html gatsby passes the page
 * path in; in the browser this function runs once at bootstrap, where the
 * current location says the same thing.
 *
 * The prefix rules are gatsby-source-jaen's: the default locale keeps
 * unprefixed paths, every other locale is served under its prefix, and a
 * prefix defaults to the language part of the locale.
 */
const localeForPathname = (
  pathname: string | undefined,
  i18n: JaenPluginOptions['i18n']
): string | undefined => {
  if (!i18n) return undefined

  const path =
    pathname ??
    (typeof window !== 'undefined' ? window.location.pathname : undefined)

  if (!path) return i18n.defaultLocale

  const segment = path.replace(/^\/+/, '').split('/')[0]?.toLowerCase()

  const match = i18n.locales.find(entry => {
    const prefix = entry.prefix ?? entry.locale.split('-')[0]

    return prefix?.toLowerCase() === segment
  })

  return match?.locale ?? i18n.defaultLocale
}

export const wrapRootElement: GatsbyBrowser['wrapRootElement'] = (
  args,
  pluginOptions
) => {
  const {element} = args

  // build-html hands wrapRootElement the page path; the browser signature has
  // no such field, which is what localeForPathname's fallback is for.
  const {pathname} = args as {pathname?: string}
  const options = (pluginOptions ?? {}) as JaenPluginOptions

  // Only the component case carries a name; a host element's tag string never
  // matched this branch either way.
  const elementName =
    typeof element?.type === 'string' ? undefined : element?.type?.name

  if (elementName === '' || elementName === 'Head') {
    return (
      <IntlProvider
        messages={messagesByLocale[DEFAULT_LOCALE]}
        locale={DEFAULT_LOCALE}
        defaultLocale={DEFAULT_LOCALE}>
        <SiteMetadataProvider>{element}</SiteMetadataProvider>
      </IntlProvider>
    )
  }

  return (
    /**
     * What changed here is the provider, not the default it hands out.
     *
     * next-themes sits OUTSIDE Chakra because it writes the class onto <html>
     * that v3's dark condition selects on, so the provider reading tokens has
     * to be inside the one setting the class.
     *
     * defaultTheme="light" is what v2 actually shipped, and it stays. jaen's
     * theme carried no `config`, so extendTheme filled in @chakra-ui/theme's
     * own `initialColorMode: "light"` (measured: theme.config in the v2 tree is
     * {useSystemColorMode:false, initialColorMode:"light", cssVarPrefix:
     * "chakra"}), and that literal is what ColorModeScript wrote and what
     * ColorModeProvider defaulted to. The site theme's initialColorMode:
     * 'system' never reached a provider — the site's Layout mounted emotion's
     * ThemeProvider, not ChakraProvider — so no visitor has ever been given an
     * OS-following default here. Following the OS would flip every dark-OS
     * visitor to a dark first paint, which is a redesign, not a migration.
     *
     * enableSystem stays on regardless: it only adds 'system' to the set of
     * values setColorMode accepts, it does not make it the default. Choosing it
     * still works, and next-themes then tracks the OS live.
     *
     * cssVarsRoot="#momo" is gone, and its absence is what lets that work. In
     * v3 only the base bucket honours cssVarsRoot; the dark bucket always lands
     * on `.dark, .dark .chakra-theme:not(.light)`. With `.dark` on <html> and
     * #momo a descendant, the scoped block would win every time and dark mode
     * would be dead inside the CMS. The two systems are kept apart by their
     * variable prefix instead, which no selector can defeat. #momo stays on the
     * elements, as the portal container id it also always was.
     */
    <NextThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange>
      <ChakraProvider value={system}>
        <NotificationsProvider>
          {/* The path decides whether the OIDC runtime is loaded at all, so it
              has to be re-read on navigation rather than once at mount. */}
          <AuthenticationProvider pathname={pathname}>
            <JaenIntlProvider>
              <Toaster />

              {/* The banner is markup now, so both of these have to be known
                  while the HTML is generated: the locale decides which of the
                  five translations is written into this page, and the
                  analytics flag decides the settings modal's cookie table for
                  whenever the plugin is loaded. */}
              <CookieConsentProvider
                locale={localeForPathname(pathname, options.i18n)}
                useGoogleAnalytics={Boolean(
                  options.googleAnalytics?.trackingIds?.[0]
                )}>
                <JaenUpdateModalProvider>
                  <SiteMetadataProvider>
                    <JaenFrameMenuProvider>
                      <MediaModalProvider
                        MediaModalComponent={MediaModalComponent}>
                        <JaenWidgetProvider>
                          <Popup />
                          {element}
                        </JaenWidgetProvider>
                      </MediaModalProvider>
                    </JaenFrameMenuProvider>
                  </SiteMetadataProvider>
                </JaenUpdateModalProvider>
              </CookieConsentProvider>
            </JaenIntlProvider>
          </AuthenticationProvider>
        </NotificationsProvider>
      </ChakraProvider>
    </NextThemeProvider>
  )
}

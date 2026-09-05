/**
 * Where the colour mode applies, and the provider that enforces it.
 *
 * The public website has no colour mode. Only jaen's own pages (the CMS tree,
 * login, logout, settings, signup) and the app plugin's pages under /app get
 * one, with the site's `colorMode.default` as the mode a visitor lands on and
 * the toggle on top. Everywhere else next-themes is told `forcedTheme="light"`,
 * which writes the light class onto <html> whatever is stored, persists
 * nothing, and lifts again the moment the route changes into an area that has
 * a mode. The stored choice a visitor made inside the app therefore survives a
 * detour over the public pages.
 *
 * One provider, not two: next-themes owns the class on <html>, and two
 * providers would fight over it. The route decides the `forcedTheme` prop and
 * nothing else.
 *
 * The prefixes are the routes, not the page components: jaen's system routes
 * are never localized (gatsby-source-jaen leaves them unprefixed), and the app
 * plugin registers its pages under /app the same way, so a plain prefix match
 * against the pathname is exact. The no-flash script in gatsby-ssr.tsx runs
 * the same match before the first paint, from the same list.
 */
import {globalHistory} from '@reach/router'
import {ThemeProvider as NextThemeProvider} from 'next-themes'
import {useSyncExternalStore, type FC, type ReactNode} from 'react'

export type ColorModeDefault = 'light' | 'dark' | 'system'

/** Route prefixes that have a colour mode. Everything else is forced light. */
export const COLOR_MODE_ROUTE_PREFIXES = [
  '/cms',
  '/login',
  '/logout',
  '/settings',
  '/signup',
  /*
    The OIDC callback is not a jaen page but every site ships one at this
    path, and it sits between the login and the app. Forcing it light would
    flash a white screen into a dark app on the way to the dashboard.
  */
  '/loading',
  '/app'
] as const

export const hasColorMode = (pathname: string): boolean => {
  const path = pathname.replace(/\/+$/, '') || '/'

  return COLOR_MODE_ROUTE_PREFIXES.some(
    prefix => path === prefix || path.startsWith(`${prefix}/`)
  )
}

const subscribe = (onChange: () => void) => globalHistory.listen(onChange)

const getSnapshot = () => globalHistory.location.pathname

interface ColorModeScopeProps {
  /**
   * The page path build-html hands wrapRootElement. The browser bootstrap
   * gets none, and there window.location says the same thing the server
   * knew, so the hydration render agrees with the markup.
   */
  ssrPathname?: string
  defaultMode: ColorModeDefault
  children: ReactNode
}

/**
 * The current pathname, live across client-side navigation, and on the
 * server the one build-html handed in. The one place the route is read for
 * the decisions that follow the route list above, so ColorModeScope and the
 * consent banner's scope in wrap-root-element.tsx agree on every page.
 */
export const useScopedPathname = (ssrPathname?: string): string =>
  useSyncExternalStore(
    subscribe,
    getSnapshot,
    () =>
      ssrPathname ??
      (typeof window !== 'undefined' ? window.location.pathname : '/')
  )

export const ColorModeScope: FC<ColorModeScopeProps> = ({
  ssrPathname,
  defaultMode,
  children
}) => {
  const pathname = useScopedPathname(ssrPathname)

  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme={defaultMode}
      forcedTheme={hasColorMode(pathname) ? undefined : 'light'}
      enableSystem
      disableTransitionOnChange>
      {children}
    </NextThemeProvider>
  )
}

import {createContext} from 'react'
import type {AuthContextProps} from 'react-oidc-context'

/**
 * jaen's own handle on the OIDC state, so that reading it costs no bytes.
 *
 * `react-oidc-context` publishes its own context, but importing `useAuth` from
 * it is a value import, and that package imports `UserManager` from
 * `oidc-client-ts` at module scope. Measured on netsnek.com, the edge is worth
 * 99.5 KB of source in the eagerly loaded app chunk, on every page, for every
 * anonymous visitor, in exchange for a sign-in only an admin performs.
 *
 * So the OIDC state travels through a context jaen owns. The provider that
 * fills it lives in `auth-oidc.tsx`, which is loaded on demand and is the only
 * module in the package that imports `react-oidc-context` for its value. The
 * type import here is erased at compile time and pulls in nothing.
 */
/**
 * react-oidc-context's shape plus one flag of jaen's own.
 *
 * `isRuntimeLoaded` tells a consumer whether it is looking at the real
 * provider or at the signed-out placeholder below. The two are deliberately
 * indistinguishable in every other field, and that is exactly what made the
 * login gate misfire: on a hard load of a gated page the first render carries
 * the placeholder (isLoading false, isAuthenticated false) for the instant
 * before the runtime chunk mounts, and a gate that acted on that instant sent
 * a signed-in visitor to /login, which sent them straight back, and so on.
 */
export type JaenAuthContextProps = AuthContextProps & {
  isRuntimeLoaded: boolean
}

export const OidcAuthContext = createContext<JaenAuthContextProps>(
  undefined as unknown as JaenAuthContextProps
)

/**
 * What `useAuth()` reports while the real provider is not mounted.
 *
 * The shape is `react-oidc-context`'s, because that is what 32 call sites
 * across the monorepo already read, and the whole point of this split is that
 * none of them have to know which provider answered.
 *
 * Every action rejects rather than doing nothing. A silent no-op would turn a
 * sign-in button into a button that looks broken; a rejection surfaces as the
 * error it is. In practice none of them are reachable: the only callers of
 * `signinRedirect` and `signoutRedirect` in the monorepo are the `/login`,
 * `/signup` and `/logout` pages, and those are exactly the routes that mount
 * the real provider. See `needsOidcRuntime`.
 */
const notLoaded = async (): Promise<never> => {
  throw new Error(
    'jaen: the OIDC runtime is not loaded on this route. This is a bug in ' +
      'needsOidcRuntime, which decides where it is needed.'
  )
}

export const ANONYMOUS_AUTH = {
  isRuntimeLoaded: false,
  isAuthenticated: false,
  isLoading: false,
  user: null,
  error: undefined,
  activeNavigator: undefined,
  /**
   * Not undefined, because AuthUserProvider reads `auth.settings.authority`
   * during its own render and would throw on the signed-out path. The value is
   * the same one the real provider is configured with, so the two agree.
   */
  settings: {authority: __JAEN_ZITADEL_GQL__.authority},
  events: undefined,
  signinRedirect: notLoaded,
  signinPopup: notLoaded,
  signinSilent: notLoaded,
  signinResourceOwnerCredentials: notLoaded,
  signoutRedirect: notLoaded,
  signoutPopup: notLoaded,
  signoutSilent: notLoaded,
  removeUser: notLoaded,
  clearStaleState: notLoaded,
  querySessionStatus: notLoaded,
  revokeTokens: notLoaded,
  startSilentRenew: () => {},
  stopSilentRenew: () => {}
} as unknown as JaenAuthContextProps

/**
 * The prefix oidc-client-ts stores a session under.
 *
 * Its `WebStorageStateStore` writes `oidc.user:{authority}:{client_id}`, and
 * the default store is sessionStorage. A site that configures a different
 * store is not covered by the sessionStorage half of the check, which is why
 * localStorage is read too.
 */
const OIDC_STORAGE_PREFIX = 'oidc.user:'

const hasStoredSession = (storage: Storage | undefined): boolean => {
  if (!storage) return false

  try {
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index)

      if (key?.startsWith(OIDC_STORAGE_PREFIX)) return true
    }
  } catch {
    // Storage access throws when cookies are blocked entirely. A visitor in
    // that state cannot have a session either.
    return false
  }

  return false
}

/**
 * Routes that must have the real runtime whether or not anyone is signed in.
 *
 * `/login`, `/signup` and `/logout` are the only callers of the sign-in and
 * sign-out actions in the whole monorepo. Everything under `/cms` is the CMS
 * itself, which cannot function without it. The list is matched against the
 * pathname with the locale prefix already removed by the caller.
 */
const AUTH_ROUTES = ['/login', '/signup', '/logout', '/cms', '/oidc']

/**
 * The sign-in and sign-out flows themselves. Parking one of these as the
 * return-to would bounce the visitor straight back into the flow they just
 * finished, so they are never remembered. /cms is deliberately NOT here: it
 * is a destination, the one most worth coming back to, and it sat in this
 * list only because AUTH_ROUTES (which decides where the runtime loads) was
 * reused as the skip list, so a bookmarked /cms/accounts always landed on
 * the site root after signing in.
 */
const AUTH_FLOW_ROUTES = ['/login', '/signup', '/logout', '/oidc']

/** Whether a (locale-stripped) path is one of the sign-in/sign-out flows. */
export const isAuthFlowRoute = (pathname: string): boolean => {
  const withoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '')

  return AUTH_FLOW_ROUTES.some(
    route => withoutLocale === route || withoutLocale.startsWith(`${route}/`)
  )
}

/**
 * Whether this page has to load the OIDC runtime.
 *
 * Deliberately conservative in the direction of loading it: a false negative
 * shows a signed-in admin as signed out, which is a visible regression, while
 * a false positive only costs the bytes we used to always pay. The three
 * reasons to load it are a session that already exists, a route that is about
 * to use it, and a provider redirect coming back with its code.
 *
 * SSR answers false, which is correct and not a compromise: the build has no
 * session and no way to know about one, so the generated HTML is the
 * signed-out state exactly as it is today. The browser re-evaluates on mount.
 */
export const needsOidcRuntime = (pathname?: string): boolean => {
  if (typeof window === 'undefined') return false

  const path = pathname ?? window.location.pathname

  if (
    hasStoredSession(window.sessionStorage) ||
    hasStoredSession(window.localStorage)
  ) {
    return true
  }

  const params = new URLSearchParams(window.location.search)

  // An authorization code response, or the error branch of one. Both have to
  // reach the provider, which is what clears them out of the URL.
  if (
    (params.has('code') && params.has('state')) ||
    (params.has('error') && params.has('state'))
  ) {
    return true
  }

  // The locale prefix is two letters and a slash, and it is optional.
  const withoutLocale = path.replace(/^\/[a-z]{2}(?=\/|$)/, '')

  return AUTH_ROUTES.some(
    route => withoutLocale === route || withoutLocale.startsWith(`${route}/`)
  )
}

/**
 * Where a signed-out visitor was headed before being sent to the login page.
 *
 * The OIDC round trip always lands back on the configured `redirect_uri`, one
 * fixed URL, because `/login` calls `signinRedirect()` with no arguments.
 * Without somewhere to park the intended path, every gated page dropped the
 * visitor on the site root after signing in. sessionStorage survives the trip
 * through the identity provider and is scoped to the tab.
 */
const RETURN_TO_KEY = 'jaen:return-to'

/** Records where to come back to. Ignores the auth routes themselves. */
export const rememberReturnTo = (path: string): void => {
  try {
    // Parking an auth route would bounce the visitor straight back into the
    // flow they just finished.
    if (isAuthFlowRoute(path)) {
      return
    }

    sessionStorage.setItem(RETURN_TO_KEY, path)
  } catch {
    // Private mode, or storage disabled. Losing the path is not worth failing
    // the sign-in over.
  }
}

/** Reads and clears the parked path. Returns null when there is none. */
export const takeReturnTo = (): string | null => {
  try {
    const value = sessionStorage.getItem(RETURN_TO_KEY)
    sessionStorage.removeItem(RETURN_TO_KEY)
    return value
  } catch {
    return null
  }
}

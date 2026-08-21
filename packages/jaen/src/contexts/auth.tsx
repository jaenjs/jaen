import {Alert, Box, Center} from '@chakra-ui/react'
import React, {useContext, useEffect, useMemo} from 'react'
import {PageProps} from '../types'

import {fetchCurrentUserRoles} from '../clients/zitadel-gql'
import {
  ANONYMOUS_AUTH,
  needsOidcRuntime,
  OidcAuthContext,
  rememberReturnTo
} from './auth-context'
import {AuthUserProvider} from './auth-user'
import {useNotificationsContext} from './notifications'

/**
 * The OIDC runtime, fetched only where it is needed.
 *
 * `react-oidc-context` imports `UserManager` from `oidc-client-ts` at module
 * scope, so importing it here statically, as this file used to, put 99.5 KB of
 * source into the app chunk of every consuming site. That chunk is downloaded,
 * parsed and evaluated by every anonymous visitor on every page, in exchange
 * for a sign-in that only an admin ever performs.
 */
const OidcRuntime = React.lazy(async () => await import('./auth-oidc'))

/**
 * Where the roles sit in the token. Zitadel's own claim by default, so every
 * existing site keeps working without touching its config.
 */
const ROLES_CLAIM =
  __JAEN_ZITADEL_GQL__.rolesClaim ?? 'urn:zitadel:iam:org:project:roles'

/**
 * Role keys carried in the token itself.
 *
 * Two shapes are read, because providers disagree. Zitadel emits one object
 * per project, keyed by role name, either alone or in an array when the
 * audience covers several projects. Most other providers emit a plain array of
 * strings. Reading both means jaen's sign-in works against any OIDC provider,
 * while the Zitadel deployments it was written for see no change.
 */
const rolesFromTokenClaim = (claim: unknown): string[] => {
  const items = Array.isArray(claim) ? claim : claim ? [claim] : []

  return items.flatMap(item => {
    if (typeof item === 'string') return [item]

    return item && typeof item === 'object' ? Object.keys(item) : []
  })
}

export const useAuth = () => {
  // jaen's own context, filled either by the lazily loaded OIDC runtime or by
  // the signed-out constant. Reading react-oidc-context's hook directly here
  // is what used to pin oidc-client-ts into every page.
  const oidcAuth = useContext(OidcAuthContext) ?? ANONYMOUS_AUTH

  const [isRolesLoading, setIsRolesLoading] = React.useState<boolean>(false)
  const [roles, setRoles] = React.useState<string[]>([])

  useEffect(() => {
    let cancelled = false

    const getRoles = async () => {
      const claimRoles = rolesFromTokenClaim(
        oidcAuth.user?.profile[ROLES_CLAIM]
      )

      // Token-claim roles are available synchronously; merge them into the
      // current set (a token refresh must not blank previously fetched
      // roles) while the authoritative zitadel-gql query resolves.
      setRoles(prev => Array.from(new Set([...prev, ...claimRoles])))
      setIsRolesLoading(true)

      try {
        const {plainRoles, projectScopedRoles} = await fetchCurrentUserRoles(
          oidcAuth.user!.access_token
        )

        if (cancelled) return

        setRoles(
          Array.from(
            new Set([...projectScopedRoles, ...plainRoles, ...claimRoles])
          )
        )
      } catch (error) {
        // The claim-derived roles stay in place; a failing roles query must
        // not sign the user out.
        console.error('jaen: zitadel-gql roles query failed', error)
      } finally {
        if (!cancelled) {
          setIsRolesLoading(false)
        }
      }
    }

    if (oidcAuth.user) {
      void getRoles()
    }

    return () => {
      cancelled = true
    }
  }, [oidcAuth.user])

  const auth = useMemo(() => {
    return {
      ...oidcAuth,
      user: {
        ...oidcAuth.user,
        roles
      },
      isLoading: isRolesLoading || oidcAuth.isLoading
    }
  }, [oidcAuth, roles, isRolesLoading])

  return auth
}

export const checkUserRoles = (
  user: ReturnType<typeof useAuth>['user'],
  roles: string[]
) => {
  if (!user) return false

  return roles.some(role => user.roles.includes(role))
}

export const AuthenticationProvider: React.FC<{
  children: React.ReactNode
  /**
   * The current path, so that the decision below re-runs on navigation.
   * gatsby-plugin-jaen's wrap-root-element already has it. Left undefined it
   * falls back to the browser's own, which is correct for the first render and
   * stale afterwards, so passing it is the supported way.
   */
  pathname?: string
}> = ({children, pathname}) => {
  /**
   * The scope, which is the one genuinely provider-specific part of signing in.
   *
   * Zitadel needs its URN scopes: one to bind the session to an organization,
   * one per project to put that project into the audience, and without them it
   * issues no roles claim at all. Any other provider needs none of them and
   * will reject scopes it does not know.
   *
   * So a site can set `scope` outright. Left unset and given an
   * organizationId, the Zitadel scopes are derived exactly as before. Left
   * unset with no organizationId, what remains is plain OIDC.
   */
  const scope = useMemo(() => {
    if (__JAEN_ZITADEL_GQL__.scope) return __JAEN_ZITADEL_GQL__.scope

    const parts = new Set<string>()

    parts.add('openid')
    parts.add('profile')
    parts.add('email')

    if (__JAEN_ZITADEL_GQL__.organizationId) {
      // Copy before extending: mutating the DefinePlugin-injected array would
      // append 'zitadel' again on every provider mount.
      const projectIds: string[] = [
        ...(__JAEN_ZITADEL_GQL__.projectIds || []),
        'zitadel'
      ]

      parts.add(`urn:zitadel:iam:org:id:${__JAEN_ZITADEL_GQL__.organizationId}`)
      projectIds.forEach(projectId => {
        parts.add(`urn:zitadel:iam:org:project:id:${projectId}:aud`)
      })
    }

    parts.add('offline_access')

    return Array.from(parts).join(' ')
  }, [])

  /**
   * Whether this visit has to load the OIDC runtime at all.
   *
   * Latched on rather than recomputed, so a visitor who reaches /login and
   * then navigates away does not tear the provider down under a session that
   * is being established. Once true it stays true for the life of the page.
   *
   * The server renders `false`, which is the signed-out HTML that is generated
   * today anyway, and the browser re-evaluates on mount. That first evaluation
   * is deliberately in an effect rather than in the initial state: reading
   * sessionStorage during render would make the client's first render differ
   * from the server's and produce a hydration mismatch.
   */
  const [needsOidc, setNeedsOidc] = React.useState(false)

  useEffect(() => {
    if (needsOidc) return
    if (!needsOidcRuntime(pathname)) return

    let cancelled = false

    /**
     * Fetched to completion before the switch is flipped, not after.
     *
     * Flipping first and letting Suspense wait would blank the whole app for
     * the length of one chunk request, because this provider sits above the
     * page. Resolving the same module promise React.lazy will read means that
     * by the time `needsOidc` turns true the component is already in memory
     * and the boundary never actually suspends.
     */
    void import('./auth-oidc')
      .then(() => {
        if (!cancelled) setNeedsOidc(true)
      })
      .catch(error => {
        // A failed chunk leaves the signed-out state in place, which is the
        // honest outcome: nothing can be signed in without it.
        console.error('jaen: could not load the OIDC runtime', error)
      })

    return () => {
      cancelled = true
    }
  }, [pathname, needsOidc])

  if (needsOidc) {
    return (
      // No fallback markup. The tree below renders the signed-out state while
      // the chunk is in flight, which is what it showed a moment ago anyway,
      // and a spinner here would flash on every CMS navigation.
      <React.Suspense fallback={null}>
        <OidcRuntime
          clientId={__JAEN_ZITADEL_GQL__.clientId}
          redirectUri={__JAEN_ZITADEL_GQL__.redirectUri}
          authority={__JAEN_ZITADEL_GQL__.authority}
          scope={scope}>
          <AuthUserProvider>{children}</AuthUserProvider>
        </OidcRuntime>
      </React.Suspense>
    )
  }

  return (
    <OidcAuthContext.Provider value={ANONYMOUS_AUTH}>
      <AuthUserProvider>{children}</AuthUserProvider>
    </OidcAuthContext.Provider>
  )
}

export const withAuthSecurity = <
  P extends Omit<PageProps, 'children'> & {
    children: React.ReactElement<any, string | React.JSXElementConstructor<any>>
  }
>(
  Component: React.ComponentType<P>
) => {
  const Wrapper: React.FC<P> = props => {
    const pageConfigAuth = props.pageContext.pageConfig?.auth
    const auth = useAuth()
    const notify = useNotificationsContext()

    const loadingText = useMemo(() => {
      switch (auth.activeNavigator) {
        case 'signinRedirect':
        case 'signinSilent':
          return 'Signing you in...'
        case 'signoutSilent':
        case 'signoutRedirect':
          return 'Signing you out...'
        case undefined:
          return undefined
        default:
          return 'Loading...'
      }
    }, [auth.activeNavigator])

    useEffect(() => {
      if (auth.error) {
        notify.toast({
          title: 'Error',
          description: auth.error.message,
          status: 'error'
        })
      }
    }, [auth.error, notify])

    useEffect(() => {
      if (loadingText) {
        notify.toast({
          title: loadingText,
          status: 'info'
        })
      }
    }, [loadingText])

    /**
     * A signed-out visitor of a gated page is sent to the login page instead
     * of being shown a message they cannot act on. The page they wanted is
     * parked first, so the sign-in callback can bring them back to it rather
     * than dropping them on the site root.
     *
     * Guarded on `isLoading` and `activeNavigator`: while the OIDC runtime is
     * still resolving a stored session, `isAuthenticated` is false without
     * meaning it, and redirecting on that would throw an already-signed-in
     * visitor back through the whole flow.
     */
    useEffect(() => {
      if (!pageConfigAuth?.isRequired) return
      if (auth.isLoading || auth.isAuthenticated) return
      if (auth.activeNavigator) return

      rememberReturnTo(window.location.pathname + window.location.search)
      window.location.assign('/login')
    }, [
      pageConfigAuth?.isRequired,
      auth.isLoading,
      auth.isAuthenticated,
      auth.activeNavigator
    ])

    if (pageConfigAuth?.isRequired) {
      let roles = pageConfigAuth?.roles

      if (pageConfigAuth.isAdminRequired) {
        if (!roles) {
          roles = ['jaen:admin']
        } else {
          roles.push('jaen:admin')
        }
      }

      if (roles) {
        const hasRoles = checkUserRoles(auth.user, roles)

        if (!hasRoles) {
          return (
            <Center height="100vh">
              <Box textAlign="center">
                <Alert.Root status="error" mb={4}>
                  <Alert.Indicator />
                  You don't have the required roles to view this page
                </Alert.Root>
              </Box>
            </Center>
          )
        }
      }

      if (auth.isAuthenticated) {
        return <Component {...props} />
      }

      // The effect above is already on its way to /login. Rendering the old
      // "You need to be logged in" alert here would only flash an error at
      // someone who did nothing wrong.
      return null
    }

    return <Component {...props} />
  }

  return Wrapper
}

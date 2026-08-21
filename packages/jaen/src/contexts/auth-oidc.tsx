import React from 'react'
import {AuthProvider, useAuth as useOIDCAuth} from 'react-oidc-context'

import {OidcAuthContext, takeReturnTo} from './auth-context'

/**
 * The OIDC runtime, in a module of its own.
 *
 * This is the ONLY file in the package that imports `react-oidc-context` for
 * its value, and keeping it that way is the entire point. That package pulls
 * `UserManager` out of `oidc-client-ts` at module scope, so a single static
 * import anywhere in the eager graph puts 99.5 KB of source into the app chunk
 * of every consuming site.
 *
 * `auth.tsx` reaches this through `React.lazy`, so the chunk is fetched on the
 * routes that need it and nowhere else. See `needsOidcRuntime`.
 */

/**
 * Republishes what react-oidc-context provides under jaen's own context.
 *
 * The indirection is what lets `useAuth()` read the same shape whether the
 * runtime is loaded or not, so none of the 32 call sites has to care.
 */
const Bridge: React.FC<React.PropsWithChildren> = ({children}) => {
  const auth = useOIDCAuth()

  return (
    <OidcAuthContext.Provider value={auth}>{children}</OidcAuthContext.Provider>
  )
}

export interface OidcRuntimeProps {
  clientId: string
  redirectUri: string
  authority: string
  scope: string
  children: React.ReactNode
}

const OidcRuntime: React.FC<OidcRuntimeProps> = ({
  clientId,
  redirectUri,
  authority,
  scope,
  children
}) => {
  return (
    <AuthProvider
      client_id={clientId}
      redirect_uri={redirectUri}
      scope={scope}
      loadUserInfo
      authority={authority}
      onSigninCallback={() => {
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        )

        // The provider always returns to the one configured redirect_uri, so
        // a visitor who was sent here from a gated page lands on the wrong
        // one. Carry them the rest of the way.
        const returnTo = takeReturnTo()

        if (returnTo && returnTo !== window.location.pathname) {
          window.location.assign(returnTo)
        }
      }}>
      <Bridge>{children}</Bridge>
    </AuthProvider>
  )
}

export default OidcRuntime

import {PageConfig, takeReturnTo, useAuth} from 'jaen'
import {PageProps} from 'gatsby'
import React, {useEffect, useRef} from 'react'

import {intlText} from '../lib/intl'

const LoginPage: React.FC<PageProps> = () => {
  const auth = useAuth()

  /**
   * signinRedirect() navigates away, but React may run this effect again
   * before the browser gets there (a re-render, StrictMode in development).
   * A second call starts a second flow whose state the first one then races.
   */
  const started = useRef(false)

  useEffect(() => {
    /**
     * This page used to call signinRedirect() unconditionally on mount, which
     * turned it into a redirect loop. A visitor arriving here with a live
     * session was sent to the provider, the provider recognised the session
     * and sent them straight back, the gate that had sent them here saw the
     * same state again, and round it went.
     *
     * So: wait for the runtime to settle, and only start a flow for someone
     * who actually needs one.
     */
    if (auth.isLoading || auth.activeNavigator) return

    if (auth.isAuthenticated) {
      const returnTo = takeReturnTo()

      // replace, not assign: /login has no business in the history of someone
      // who never needed to sign in.
      window.location.replace(returnTo ?? '/')

      return
    }

    if (started.current) return
    started.current = true

    void auth.signinRedirect()
  }, [auth.isLoading, auth.isAuthenticated, auth.activeNavigator])

  return null
}

export default LoginPage

export const pageConfig: PageConfig = {
  label: intlText('AuthLogin', 'Login'),
  withoutJaenFrame: true,
  layout: {
    name: 'jaen',
    type: 'form'
  }
}

export {Head} from 'jaen'

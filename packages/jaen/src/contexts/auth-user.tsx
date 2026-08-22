import React, {createContext, useContext, useMemo} from 'react'

import {ANONYMOUS_AUTH, OidcAuthContext} from './auth-context'

import {
  fetchCurrentUser,
  primaryProfile,
  setUserPassword,
  setUserPhone,
  resendUserEmailVerification,
  updateUser,
  ZgUser,
  ZgUserChanges
} from '../clients/zitadel-gql'
import {useNotificationsContext} from './notifications'

export interface AuthUser {
  id: string
  state: string
  userName: string
  loginNames: string[]
  preferredLoginName: string
  human: {
    profile: {
      firstName: string
      lastName: string
      nickName: string
      displayName: string
      preferredLanguage: string
      gender: string
      avatarUrl: string
    }
    email: {
      email: string
      isEmailVerified: boolean
    }
    phone: {
      phone: string
      isPhoneVerified: boolean
    }
  }
}

export interface AuthPasswordPolicy {
  minLength: number
  hasUppercase: boolean
  hasLowercase: boolean
  hasNumber: boolean
  hasSymbol: boolean
  isDefault: boolean
}

/**
 * Applied when no policy endpoint is reachable (zitadel-gql has no policy
 * query). Matches Zitadel's default complexity policy.
 */
const FALLBACK_PASSWORD_POLICY: AuthPasswordPolicy = {
  minLength: 8,
  hasUppercase: true,
  hasLowercase: true,
  hasNumber: true,
  hasSymbol: false,
  isDefault: true
}

/**
 * Adapt a zitadel-gql user node into the AuthUser shape the CMS components
 * consume. zitadel-gql's profile node carries no verification flags, so
 * verification is assumed for values the identity server hands out.
 */
const toAuthUser = (user: ZgUser): AuthUser => {
  const profile = primaryProfile(user)

  const preferredLanguage =
    user.preferences?.preferredLanguage ?? profile?.preferredLanguage ?? ''

  return {
    id: user.id,
    state: user.state,
    userName: user.userName,
    loginNames: user.loginNames,
    preferredLoginName: user.preferredLoginName,
    human: {
      profile: {
        firstName: profile?.firstName ?? '',
        lastName: profile?.lastName ?? '',
        nickName: profile?.nickName ?? '',
        displayName: profile?.displayName ?? user.userName,
        preferredLanguage,
        gender: profile?.gender ?? '',
        avatarUrl: profile?.avatarUrl ?? ''
      },
      email: {
        email: profile?.email ?? '',
        isEmailVerified: Boolean(profile?.email)
      },
      phone: {
        phone: profile?.phone ?? '',
        isPhoneVerified: Boolean(profile?.phone)
      }
    }
  }
}

const AuthUserContext = createContext<{
  user: AuthUser
  passwordPolicy: AuthPasswordPolicy
  usernameUpdate: (userName: string) => Promise<void>
  profileUpdate: (profile: AuthUser['human']['profile']) => Promise<void>
  profileAvatarUpdate: (avatarFile: File) => Promise<void>

  emailUpdate: (email: string) => Promise<void>
  emailResendCode: () => Promise<void>
  phoneUpdate: (phone: string) => Promise<void>
  phoneVerify: (code: string) => Promise<void>
  phoneResendCode: () => Promise<void>
  phoneDelete: () => Promise<void>
  passwordUpdate: (oldPassword: string, newPassword: string) => Promise<void>
  refresh: () => Promise<void>
} | null>(null)

export const AuthUserProvider: React.FC<{
  children: React.ReactNode
}> = ({children}) => {
  // jaen's own context rather than react-oidc-context's hook, so that this
  // module does not pin oidc-client-ts into the eager bundle. See
  // auth-context.ts.
  const auth = useContext(OidcAuthContext) ?? ANONYMOUS_AUTH

  const baseUrl = auth.settings.authority

  const notify = useNotificationsContext()

  const [data, setData] = React.useState<
    | {
        user: AuthUser
        passwordPolicy: AuthPasswordPolicy
      }
    | undefined
  >()

  const accessToken = auth.user?.access_token

  /**
   * REST helper for the endpoints zitadel-gql does not cover (avatar
   * upload via the assets API, phone verification codes, the password
   * complexity policy, old-password-checked password change). On a
   * zitadel-gql deployment without these REST routes the callers degrade
   * gracefully.
   */
  const sendRestRequest = async (
    path: string,
    method: string,
    body: any,
    headers: any = {},
    options: {
      stringifyBody?: boolean
      silent?: boolean
    } = {stringifyBody: true}
  ): Promise<{ok: boolean; status?: number}> => {
    try {
      const reqHeaders = Object.fromEntries(
        Object.entries({
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          ...headers
        }).filter(([_, value]) => value !== undefined)
      ) as any

      const reqBody = options.stringifyBody ? JSON.stringify(body) : body

      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: reqHeaders,
        body: reqBody
      })

      if (!response.ok) {
        let message = response.statusText

        if (response.headers.get('content-type') === 'application/json') {
          const errorData = await response.json().catch(() => undefined)
          message = errorData?.message || message
        }

        if (!options.silent) {
          notify.toast({
            position: 'top-right',
            title: 'Error',
            description: message,
            status: 'error'
          })
        }

        return {ok: false, status: response.status}
      }

      if (!options.silent) {
        notify.toast({
          position: 'top-right',
          title: 'Success',
          description: 'Action completed successfully',
          status: 'success'
        })
      }

      await refetchProfile()

      return {ok: true, status: response.status}
    } catch (error) {
      if (!options.silent) {
        notify.toast({
          position: 'top-right',
          title: 'Error',
          description: `Internal error: ${(error as Error).message}`,
          status: 'error'
        })
      }

      // No status: the route never answered (network error / no such host).
      return {ok: false}
    }
  }

  /** Run a zitadel-gql mutation with the usual toast + refetch handling. */
  const runGqlAction = async (
    action: () => Promise<{ok: boolean; message: string | null}>
  ): Promise<boolean> => {
    try {
      const result = await action()

      if (!result.ok) {
        notify.toast({
          position: 'top-right',
          title: 'Error',
          description: result.message || 'Action failed',
          status: 'error'
        })

        return false
      }

      notify.toast({
        position: 'top-right',
        title: 'Success',
        description: 'Action completed successfully',
        status: 'success'
      })

      await refetchProfile()

      return true
    } catch (error) {
      notify.toast({
        position: 'top-right',
        title: 'Error',
        description: (error as Error).message,
        status: 'error'
      })

      return false
    }
  }

  const getPasswordPolicy = async (): Promise<AuthPasswordPolicy> => {
    // zitadel-gql exposes no policy query; on a stock Zitadel the REST
    // endpoint still answers. Either way there is always a usable policy.
    try {
      const response = await fetch(
        `${baseUrl}/auth/v1/policies/passwords/complexity`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`
          }
        }
      )

      if (!response.ok) return FALLBACK_PASSWORD_POLICY

      const policyData = await response.json()

      return policyData.policy ?? FALLBACK_PASSWORD_POLICY
    } catch {
      return FALLBACK_PASSWORD_POLICY
    }
  }

  const refetchProfile = async () => {
    if (!accessToken) return

    const [user, passwordPolicy] = await Promise.all([
      fetchCurrentUser(accessToken).then(toAuthUser),
      getPasswordPolicy()
    ])

    setData({user, passwordPolicy})
  }

  React.useEffect(() => {
    const fetchProfile = async () => {
      if (!auth.isAuthenticated) return

      try {
        await refetchProfile()
      } catch (error) {
        console.error('jaen: loading the current user failed', error)
      }
    }

    void fetchProfile()
  }, [auth.isAuthenticated])

  const requireUserId = (): string => {
    const userId = data?.user?.id

    if (!userId) {
      throw new Error('The current user is not loaded yet')
    }

    return userId
  }

  const applyChanges = async (changes: ZgUserChanges) => {
    await runGqlAction(() =>
      updateUser({
        accessToken: accessToken!,
        userId: requireUserId(),
        changes
      })
    )
  }

  const usernameUpdate = async (userName: string) => {
    await applyChanges({username: userName})
  }

  const profileUpdate = async (profile: AuthUser['human']['profile']) => {
    await applyChanges({
      profile: {
        givenName: profile.firstName,
        familyName: profile.lastName,
        displayName: profile.displayName,
        preferredLanguage: profile.preferredLanguage,
        nickName: profile.nickName,
        // Empty means "not set" in the form, and Zitadel spells that
        // GENDER_UNSPECIFIED. Sending the empty string instead would be
        // rejected as an unknown enum value.
        gender: profile.gender || 'GENDER_UNSPECIFIED'
      }
    })
  }

  const profileAvatarUpdate = async (avatarFile: File) => {
    // The avatar endpoint belongs to Zitadel's assets API, which is not part
    // of the GraphQL surface.
    const formData = new FormData()
    formData.append('file', avatarFile)

    await sendRestRequest(
      '/assets/v1/users/me/avatar',
      'POST',
      formData,
      {
        Accept: undefined
      },
      {
        stringifyBody: false
      }
    )
  }

  const emailUpdate = async (email: string) => {
    await applyChanges({email: {email}})
  }

  const emailResendCode = async () => {
    await runGqlAction(() =>
      resendUserEmailVerification({
        accessToken: accessToken!,
        userId: requireUserId()
      })
    )
  }

  const phoneUpdate = async (phone: string) => {
    await runGqlAction(() =>
      setUserPhone({
        accessToken: accessToken!,
        userId: requireUserId(),
        phone
      })
    )
  }

  const phoneVerify = async (code: string) => {
    // Phone verification has no zitadel-gql mutation (only email verify).
    await sendRestRequest('/auth/v1/users/me/phone/_verify', 'POST', {code})
  }

  const phoneResendCode = async () => {
    await sendRestRequest(
      '/auth/v1/users/me/phone/_resend_verification',
      'POST',
      {}
    )
  }

  const phoneDelete = async () => {
    await sendRestRequest('/auth/v1/users/me/phone', 'DELETE', {})
  }

  const passwordUpdate = async (oldPassword: string, newPassword: string) => {
    // Prefer the REST route: it verifies the old password. Fall back to the
    // GraphQL mutation ONLY when the route does not exist (zitadel-gql
    // removed the REST gateway) — never when it rejected the request, or a
    // wrong old password would silently turn into a force-set.
    const rest = await sendRestRequest(
      '/auth/v1/users/me/password',
      'PUT',
      {
        oldPassword,
        newPassword
      },
      {},
      {stringifyBody: true, silent: true}
    )

    if (rest.ok) {
      notify.toast({
        position: 'top-right',
        title: 'Success',
        description: 'Action completed successfully',
        status: 'success'
      })

      return
    }

    const routeMissing =
      rest.status === undefined || [404, 405, 501].includes(rest.status)

    if (!routeMissing) {
      notify.toast({
        position: 'top-right',
        title: 'Error',
        description:
          rest.status === 400 || rest.status === 403
            ? 'The current password is not correct.'
            : 'The password could not be changed.',
        status: 'error'
      })

      return
    }

    await runGqlAction(() =>
      setUserPassword({
        accessToken: accessToken!,
        userId: requireUserId(),
        newPassword,
        changeRequired: false
      })
    )
  }

  const refresh = async () => {
    await refetchProfile()
  }

  const value = useMemo(() => {
    return {
      user: data?.user as AuthUser,
      passwordPolicy: data?.passwordPolicy as AuthPasswordPolicy,
      usernameUpdate,
      profileUpdate,
      profileAvatarUpdate,
      emailUpdate,
      emailResendCode,
      phoneUpdate,
      phoneVerify,
      phoneResendCode,
      phoneDelete,
      passwordUpdate,
      refresh
    }
  }, [data])

  return (
    <AuthUserContext.Provider value={value}>
      {children}
    </AuthUserContext.Provider>
  )
}

export const useAuthUser = () => {
  const context = React.useContext(AuthUserContext)

  if (!context) {
    throw new Error('useAuthUser must be used within a AuthUserProvider')
  }

  return context
}

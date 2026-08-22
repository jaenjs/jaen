/**
 * Typed client for the zitadel-gql GraphQL API.
 *
 * zitadel-gql (the kleberbaum/zitadel-gql line) is one identity server
 * speaking OIDC and GraphQL; the typed GraphQL facade is bundled into the
 * server itself, so the endpoint defaults to `${authority}/graphql`.
 *
 * Plain fetch on purpose: the facade's user queries return the IUserNode
 * interface (HumanUser | MachineUser | UserNode), and the earlier GQty-based
 * client stumbled exactly there ($on interface selection had to be bypassed
 * with raw queries). Hand-written queries with inline fragments are the
 * proven shape.
 */

/** The wire shape of a GraphQL error (no dependency on the graphql package). */
export interface ZitadelGqlErrorShape {
  message: string
  path?: ReadonlyArray<string | number>
  extensions?: Record<string, unknown>
}

export interface ZitadelGqlConfig {
  organizationId: string
  clientId: string
  authority: string
  redirectUri: string
  projectIds?: string[]
  /** GraphQL endpoint. Defaults to `${authority}/graphql`. */
  graphqlUrl?: string
}

/**
 * Signing in is plain OIDC and needs no organization, so the injected config
 * types `organizationId` as optional. Talking to the Zitadel API is a
 * different matter: every query is scoped to an organization and there is no
 * sensible default. A site that manages users through this client and forgets
 * it should be told, rather than sending `undefined` to the server and reading
 * the answer as an empty result.
 */
export const getZitadelGqlConfig = (): ZitadelGqlConfig => {
  const config = __JAEN_ZITADEL_GQL__

  if (!config.organizationId) {
    throw new Error(
      'jaen: zitadelGql.organizationId is required to use the Zitadel API. ' +
        'It is optional only for signing in, which is plain OIDC.'
    )
  }

  return config as ZitadelGqlConfig
}

export const getZitadelGqlUrl = (): string => {
  const config = getZitadelGqlConfig()

  return config.graphqlUrl || `${config.authority.replace(/\/+$/, '')}/graphql`
}

export class ZitadelGqlError extends Error {
  constructor(
    message: string,
    public readonly errors: readonly ZitadelGqlErrorShape[] = []
  ) {
    super(message)
    this.name = 'ZitadelGqlError'
  }
}

/**
 * POST one GraphQL operation. Throws ZitadelGqlError on transport failure or
 * GraphQL errors; resolves with `data` otherwise.
 */
export const zitadelGqlFetch = async <TData>(options: {
  query: string
  variables?: Record<string, unknown>
  accessToken?: string
}): Promise<TData> => {
  const response = await fetch(getZitadelGqlUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options.accessToken
        ? {Authorization: `Bearer ${options.accessToken}`}
        : {})
    },
    body: JSON.stringify({
      query: options.query,
      variables: options.variables ?? {}
    })
  })

  if (!response.ok) {
    throw new ZitadelGqlError(
      `zitadel-gql request failed: HTTP ${response.status}`
    )
  }

  const payload = (await response.json()) as {
    data?: TData
    errors?: ZitadelGqlErrorShape[]
  }

  if (payload.errors && payload.errors.length > 0) {
    throw new ZitadelGqlError(
      payload.errors[0]?.message ?? 'zitadel-gql returned errors',
      payload.errors
    )
  }

  if (payload.data === undefined || payload.data === null) {
    throw new ZitadelGqlError('zitadel-gql returned no data')
  }

  return payload.data
}

// ---------------------------------------------------------------------------
// shared result shapes
// ---------------------------------------------------------------------------

export interface ZgEdge<TNode> {
  node: TNode
}

export interface ZgConnection<TNode> {
  totalCount?: number
  edges: Array<ZgEdge<TNode>>
}

export const connectionNodes = <TNode>(
  connection: ZgConnection<TNode> | null | undefined
): TNode[] => connection?.edges?.map(edge => edge.node) ?? []

export interface ZgProfile {
  id: string
  email: string | null
  phone: string | null
  firstName: string | null
  lastName: string | null
  nickName: string | null
  /** One of the GENDER_* names zitadel-gql exposes, or null when unset. */
  gender: string | null
  displayName: string | null
  avatarUrl: string | null
  preferredLanguage: string | null
}

export interface ZgRole {
  key: string
  displayName: string | null
}

export interface ZgAuthorization {
  id: string
  projectId: string
  projectName: string | null
  roleKeys: string[]
  state: string
}

export interface ZgUser {
  id: string
  state: string
  userName: string
  loginNames: string[]
  preferredLoginName: string
  resourceOwner?: string
  creationDate?: string
  changeDate?: string
  preferences?: {preferredLanguage: string | null} | null
  profiles?: ZgConnection<ZgProfile>
  roles?: ZgConnection<ZgRole>
  authorizations?: ZgConnection<ZgAuthorization>
}

export interface ZgMutationResult {
  ok: boolean
  message: string | null
}

export interface ZgUserMutationResult extends ZgMutationResult {
  userId: string | null
}

export interface ZgAuthorizationMutationResult extends ZgMutationResult {
  authorizationId: string | null
}

/** The single synthetic profile node zitadel-gql attaches to a human user. */
export const primaryProfile = (user: ZgUser): ZgProfile | undefined =>
  connectionNodes(user.profiles)[0]

// ---------------------------------------------------------------------------
// fragments
// ---------------------------------------------------------------------------

const USER_CORE_FIELDS = `
  id
  state
  userName
  loginNames
  preferredLoginName
`

const HUMAN_DETAIL_FRAGMENT = `
  ... on HumanUser {
    preferences {
      preferredLanguage
    }
    profiles {
      edges {
        node {
          id
          email
          phone
          firstName
          lastName
          nickName
          gender
          displayName
          avatarUrl
          preferredLanguage
        }
      }
    }
    roles {
      edges {
        node {
          key
          displayName
        }
      }
    }
    authorizations {
      edges {
        node {
          id
          projectId
          projectName
          roleKeys
          state
        }
      }
    }
  }
  ... on MachineUser {
    roles {
      edges {
        node {
          key
          displayName
        }
      }
    }
    authorizations {
      edges {
        node {
          id
          projectId
          projectName
          roleKeys
          state
        }
      }
    }
  }
`

// ---------------------------------------------------------------------------
// queries
// ---------------------------------------------------------------------------

export const fetchCurrentUserRoles = async (
  accessToken: string
): Promise<{
  plainRoles: string[]
  projectScopedRoles: string[]
}> => {
  const data = await zitadelGqlFetch<{currentUser: ZgUser}>({
    query: `
      query JaenCurrentUserRoles {
        currentUser {
          id
          ... on HumanUser {
            roles { edges { node { key } } }
            authorizations { edges { node { id projectId projectName roleKeys state } } }
          }
          ... on MachineUser {
            roles { edges { node { key } } }
            authorizations { edges { node { id projectId projectName roleKeys state } } }
          }
        }
      }
    `,
    accessToken
  })

  const user = data.currentUser

  const plainRoles = connectionNodes(user.roles).map(role => role.key)

  const projectScopedRoles = connectionNodes(user.authorizations).flatMap(
    authorization =>
      authorization.roleKeys.map(
        roleKey => `${authorization.projectId}:${roleKey}`
      )
  )

  return {plainRoles, projectScopedRoles}
}

export const fetchCurrentUser = async (
  accessToken: string
): Promise<ZgUser> => {
  const data = await zitadelGqlFetch<{currentUser: ZgUser}>({
    query: `
      query JaenCurrentUser {
        currentUser {
          ${USER_CORE_FIELDS}
          resourceOwner
          creationDate
          changeDate
          ${HUMAN_DETAIL_FRAGMENT}
        }
      }
    `,
    accessToken
  })

  return data.currentUser
}

export const fetchUsers = async (options: {
  accessToken: string
  limit?: number
}): Promise<{totalCount: number; users: ZgUser[]}> => {
  const data = await zitadelGqlFetch<{users: ZgConnection<ZgUser>}>({
    query: `
      query JaenUsers($limit: Number) {
        users(args: {limit: $limit}) {
          totalCount
          edges {
            node {
              ${USER_CORE_FIELDS}
              ... on HumanUser {
                profiles {
                  edges {
                    node {
                      id
                      email
                      phone
                      firstName
                      lastName
                      displayName
                      avatarUrl
                      preferredLanguage
                    }
                  }
                }
              }
            }
          }
        }
      }
    `,
    variables: {limit: options.limit ?? 500},
    accessToken: options.accessToken
  })

  return {
    totalCount: data.users.totalCount ?? data.users.edges.length,
    users: connectionNodes(data.users)
  }
}

export const fetchUser = async (options: {
  accessToken: string
  userId: string
}): Promise<ZgUser> => {
  const data = await zitadelGqlFetch<{user: ZgUser}>({
    query: `
      query JaenUser($id: String!) {
        user(args: {id: $id}) {
          ${USER_CORE_FIELDS}
          resourceOwner
          creationDate
          changeDate
          ${HUMAN_DETAIL_FRAGMENT}
        }
      }
    `,
    variables: {id: options.userId},
    accessToken: options.accessToken
  })

  return data.user
}

export const fetchProjectRoles = async (options: {
  accessToken: string
  projectId: string
}): Promise<ZgRole[]> => {
  const data = await zitadelGqlFetch<{projectRoles: ZgConnection<ZgRole>}>({
    query: `
      query JaenProjectRoles($projectId: String!) {
        projectRoles(args: {projectId: $projectId}) {
          edges {
            node {
              key
              displayName
            }
          }
        }
      }
    `,
    variables: {projectId: options.projectId},
    accessToken: options.accessToken
  })

  return connectionNodes(data.projectRoles)
}

// ---------------------------------------------------------------------------
// mutations
// ---------------------------------------------------------------------------

export interface ZgProfileChanges {
  givenName?: string
  familyName?: string
  displayName?: string
  preferredLanguage?: string
  nickName?: string
  /** A GENDER_* name; GENDER_UNSPECIFIED clears a previously set value. */
  gender?: string
}

export interface ZgUserChanges {
  username?: string
  profile?: ZgProfileChanges
  email?: {email: string}
  phone?: {phone: string}
  password?: {password: string; changeRequired?: boolean}
}

const USER_MUTATION_RESULT = `
  ok
  message
  userId
`

export const createUser = async (options: {
  accessToken: string
  emailAddress: string
  username: string
  password?: string
  firstName?: string
  lastName?: string
}): Promise<ZgUserMutationResult> => {
  const data = await zitadelGqlFetch<{createUser: ZgUserMutationResult}>({
    query: `
      mutation JaenCreateUser($values: ZitadelUserCreateInput!) {
        createUser(args: {values: $values, createProfile: true}) {
          ${USER_MUTATION_RESULT}
        }
      }
    `,
    variables: {
      values: {
        emailAddress: options.emailAddress,
        username: options.username,
        ...(options.password ? {password: options.password} : {}),
        ...(options.firstName || options.lastName
          ? {
              details: {
                ...(options.firstName ? {firstName: options.firstName} : {}),
                ...(options.lastName ? {lastName: options.lastName} : {})
              }
            }
          : {})
      }
    },
    accessToken: options.accessToken
  })

  return data.createUser
}

export const updateUser = async (options: {
  accessToken: string
  userId: string
  changes: ZgUserChanges
}): Promise<ZgUserMutationResult> => {
  const data = await zitadelGqlFetch<{updateUser: ZgUserMutationResult}>({
    query: `
      mutation JaenUpdateUser($userId: String!, $changes: ZitadelUserUpdateInput!) {
        updateUser(args: {userId: $userId, changes: $changes}) {
          ${USER_MUTATION_RESULT}
        }
      }
    `,
    variables: {userId: options.userId, changes: options.changes},
    accessToken: options.accessToken
  })

  return data.updateUser
}

const simpleUserMutation =
  (field: string) =>
  async (options: {
    accessToken: string
    userId: string
  }): Promise<ZgUserMutationResult> => {
    const data = await zitadelGqlFetch<Record<string, ZgUserMutationResult>>({
      query: `
        mutation JaenUserMutation($userId: String!) {
          ${field}(args: {userId: $userId}) {
            ${USER_MUTATION_RESULT}
          }
        }
      `,
      variables: {userId: options.userId},
      accessToken: options.accessToken
    })

    return data[field]!
  }

export const deleteUser = simpleUserMutation('deleteUser')
export const deactivateUser = simpleUserMutation('deactivateUser')
export const reactivateUser = simpleUserMutation('reactivateUser')
export const lockUser = simpleUserMutation('lockUser')
export const unlockUser = simpleUserMutation('unlockUser')

export const setUserPassword = async (options: {
  accessToken: string
  userId: string
  newPassword: string
  changeRequired?: boolean
}): Promise<ZgMutationResult> => {
  const data = await zitadelGqlFetch<{setUserPassword: ZgMutationResult}>({
    query: `
      mutation JaenSetUserPassword($userId: String!, $newPassword: String!, $changeRequired: Boolean) {
        setUserPassword(args: {userId: $userId, newPassword: $newPassword, changeRequired: $changeRequired}) {
          ok
          message
        }
      }
    `,
    variables: {
      userId: options.userId,
      newPassword: options.newPassword,
      changeRequired: options.changeRequired ?? false
    },
    accessToken: options.accessToken
  })

  return data.setUserPassword
}

const simpleResultMutation =
  (field: string) =>
  async (options: {
    accessToken: string
    userId: string
  }): Promise<ZgMutationResult> => {
    const data = await zitadelGqlFetch<Record<string, ZgMutationResult>>({
      query: `
        mutation JaenUserResultMutation($userId: String!) {
          ${field}(args: {userId: $userId}) {
            ok
            message
          }
        }
      `,
      variables: {userId: options.userId},
      accessToken: options.accessToken
    })

    return data[field]!
  }

export const requestUserPasswordReset = simpleResultMutation(
  'requestUserPasswordReset'
)
export const sendUserEmailVerification = simpleResultMutation(
  'sendUserEmailVerification'
)
export const resendUserEmailVerification = simpleResultMutation(
  'resendUserEmailVerification'
)

export const verifyUserEmail = async (options: {
  accessToken: string
  userId: string
  code: string
}): Promise<ZgMutationResult> => {
  const data = await zitadelGqlFetch<{verifyUserEmail: ZgMutationResult}>({
    query: `
      mutation JaenVerifyUserEmail($userId: String!, $code: String!) {
        verifyUserEmail(args: {userId: $userId, code: $code}) {
          ok
          message
        }
      }
    `,
    variables: {userId: options.userId, code: options.code},
    accessToken: options.accessToken
  })

  return data.verifyUserEmail
}

export const setUserPhone = async (options: {
  accessToken: string
  userId: string
  phone: string
}): Promise<ZgUserMutationResult> => {
  const data = await zitadelGqlFetch<{setUserPhone: ZgUserMutationResult}>({
    query: `
      mutation JaenSetUserPhone($userId: String!, $phone: String!) {
        setUserPhone(args: {userId: $userId, phone: $phone}) {
          ${USER_MUTATION_RESULT}
        }
      }
    `,
    variables: {userId: options.userId, phone: options.phone},
    accessToken: options.accessToken
  })

  return data.setUserPhone
}

export const createAuthorization = async (options: {
  accessToken: string
  userId: string
  projectId: string
  roleKeys: string[]
}): Promise<ZgAuthorizationMutationResult> => {
  const data = await zitadelGqlFetch<{
    createAuthorization: ZgAuthorizationMutationResult
  }>({
    query: `
      mutation JaenCreateAuthorization($input: ZitadelAuthorizationCreateInput!) {
        createAuthorization(args: {input: $input}) {
          ok
          message
          authorizationId
        }
      }
    `,
    variables: {
      input: {
        userId: options.userId,
        projectId: options.projectId,
        roleKeys: options.roleKeys
      }
    },
    accessToken: options.accessToken
  })

  return data.createAuthorization
}

export const updateAuthorization = async (options: {
  accessToken: string
  authorizationId: string
  roleKeys: string[]
}): Promise<ZgAuthorizationMutationResult> => {
  const data = await zitadelGqlFetch<{
    updateAuthorization: ZgAuthorizationMutationResult
  }>({
    query: `
      mutation JaenUpdateAuthorization($input: ZitadelAuthorizationUpdateInput!) {
        updateAuthorization(args: {input: $input}) {
          ok
          message
          authorizationId
        }
      }
    `,
    variables: {
      input: {
        authorizationId: options.authorizationId,
        roleKeys: options.roleKeys
      }
    },
    accessToken: options.accessToken
  })

  return data.updateAuthorization
}

export const deleteAuthorization = async (options: {
  accessToken: string
  authorizationId: string
}): Promise<ZgAuthorizationMutationResult> => {
  const data = await zitadelGqlFetch<{
    deleteAuthorization: ZgAuthorizationMutationResult
  }>({
    query: `
      mutation JaenDeleteAuthorization($authorizationId: String!) {
        deleteAuthorization(args: {authorizationId: $authorizationId}) {
          ok
          message
          authorizationId
        }
      }
    `,
    variables: {authorizationId: options.authorizationId},
    accessToken: options.accessToken
  })

  return data.deleteAuthorization
}

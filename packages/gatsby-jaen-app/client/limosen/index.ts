/**
 * GQty: You can safely modify this file based on your needs.
 */

import {User} from 'oidc-client-ts'

import {createReactClient} from '@gqty/react'
import {
  Cache,
  createClient,
  defaultResponseHandler,
  type QueryFetcher
} from 'gqty'
import {
  generatedSchema,
  scalarsEnumsHash,
  type GeneratedSchema
} from './schema.generated'
import {
  setOnlineProbe,
  throughCache,
  type GraphQLResponse
} from '../../shared/offline'
import {
  appError,
  graphqlError,
  httpKey,
  statusInText
} from '../../shared/errors'

/**
 * The backend comes from the plugin's `pylonUrl` option, not from a constant.
 *
 * Both endpoints were hardcoded to limosen's pylon, which is invisible as long as
 * only limosen mounts the plugin and wrong the moment a second brand does: the
 * booklimo build carried api.booklimo.at in its config and still read limosen's
 * transfers, users and locations. `__JAEN_APP_PYLON_URL__` is the define
 * gatsby-node injects from that option; the literal stays as the fallback so a
 * consumer that sets no option behaves exactly as before.
 */
declare const __JAEN_APP_PYLON_URL__: string | undefined

const PYLON_URL =
  typeof __JAEN_APP_PYLON_URL__ !== 'undefined' && __JAEN_APP_PYLON_URL__
    ? __JAEN_APP_PYLON_URL__
    : 'https://api.limosen.at/graphql'

const apiURL = PYLON_URL

/**
 * The session this tab holds, read from the same storage the GraphQL client
 * takes its bearer token from. The token goes into the header, the subject
 * into the offline cache key, so two accounts on one phone never read each
 * other's stored answers.
 */
const readSession = (): {token?: string; subject?: string} => {
  try {
    // The define gatsby-plugin-jaen injects was renamed with the package it
    // configures, zitadel became zitadel-gql, and the option behind it is now
    // `zitadelGql`. The shape is unchanged, so only the name moves.
    const z =
      typeof __JAEN_ZITADEL_GQL__ !== 'undefined' ? __JAEN_ZITADEL_GQL__ : null
    if (z?.authority && z?.clientId) {
      const oidcStorage = sessionStorage.getItem(
        `oidc.user:${z.authority}:${z.clientId}`
      )
      if (oidcStorage) {
        const user = User.fromStorageString(oidcStorage)
        return {
          token: user?.access_token || undefined,
          subject:
            typeof user?.profile?.sub === 'string'
              ? user.profile.sub
              : undefined
        }
      }
    }
  } catch {
    /* auth not available */
  }
  return {}
}

/** One POST to the pylon, with the session's bearer when there is one. */
const send = async (
  body: {query: string; variables?: unknown; operationName?: string | null},
  fetchOptions: RequestInit = {}
): Promise<Response> => {
  const {token} = readSession()
  const headers: Record<string, string> = {'Content-Type': 'application/json'}
  if (token) headers['Authorization'] = `Bearer ${token}`
  return fetch(apiURL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    mode: 'cors',
    ...fetchOptions
  })
}

/**
 * The fetcher, with the offline layer around it.
 *
 * Every request of the app goes through here, the hooks' inline documents
 * and GQty's own. The layer (shared/offline.ts) stores the answer of a
 * successful query per caller and serves it back when the network is gone,
 * tagged `offline: true` with its `storedAt`, and refuses a mutation on the
 * device while offline so that it reaches the pylon zero times. When
 * storage is missing or throws it is a pass-through and this is the plain
 * fetch it was. See okf/architecture/offline.md.
 */
/**
 * GQty's response handler, with the reader's language put back on
 * (design-consistency.md rule 14).
 *
 * This is where every English word a person ever read in this app came from,
 * and it is one function. `defaultResponseHandler` throws before any caller
 * sees the answer: `GQtyError.fromGraphQLErrors` takes the first error's
 * message and nothing else, so `Forbidden` travelled through the query layer,
 * onto the board's banner and into every toast in all four languages, and
 * `extensions.code` was dropped on the floor with it. The half dozen clients
 * of shared/hooks that inspect `result.errors` themselves almost never ran:
 * the throw had already happened. Its siblings in the same file are English
 * too, for an HTTP status, an empty body and malformed JSON.
 *
 * So the answer is read here. A refusal becomes the app's own error with the
 * reader's sentence as its message, the pylon's code as `code` (which is what
 * finally makes AUTH_REQUIRED and FORBIDDEN two different answers on a
 * screen, hard-rules.md) and the machine's words as `detail`. Everything else
 * gqty throws is the platform failing rather than refusing, and says so.
 */
const readAnswer = async (response: Response): Promise<GraphQLResponse> => {
  try {
    return (await defaultResponseHandler(response)) as GraphQLResponse
  } catch (err) {
    const errors = (err as {graphQLErrors?: unknown})?.graphQLErrors
    if (Array.isArray(errors) && errors.length) throw graphqlError(errors)
    const detail = err instanceof Error ? err.message : String(err)
    const status = statusInText(detail)
    throw appError(status === undefined ? 'Server' : httpKey(status), detail)
  }
}

const queryFetcher: QueryFetcher = async function (
  {query, variables, operationName},
  fetchOptions
) {
  const {subject} = readSession()
  // The layer types the answer loosely, the client types it as GQty's
  // ExecutionResult. It is the same JSON either way, and the layer never
  // changes a field of it, it only adds `offline` and `storedAt`.
  return (await throughCache(
    {operationName, query, variables, subject},
    async () =>
      await readAnswer(
        await send({query, variables, operationName}, fetchOptions)
      )
  )) as Awaited<ReturnType<QueryFetcher>>
}

/**
 * The layer's way back: while the state is offline and the browser does not
 * say so, this is asked every ten seconds, and one answer flips the state and
 * refetches the screens. The document is the smallest one there is, sent
 * with the session's bearer, so a pylon that refuses anonymous callers still
 * counts as reached.
 */
setOnlineProbe(async () => {
  const response = await send({query: '{ __typename }'})
  return response.ok
})

const cache = new Cache(
  undefined,
  /**
   * Default option is immediate cache expiry but keep it for 5 minutes,
   * allowing soft refetches in background.
   */
  {
    maxAge: 0,
    staleWhileRevalidate: 5 * 60 * 1000,
    normalization: true
  }
)

/**
 * The endpoint and the fetcher, for the one thing GQty cannot express.
 *
 * GQty builds its selections from the schema it was generated against, and the
 * two deployments have drifted: the older one calls the same column amountEUR
 * where the newer calls it price. A selection has to know which of the two it
 * is talking to, and that is an introspection query, which has no place in a
 * generated schema. Exporting the fetcher keeps that one exception on the same
 * URL, with the same auth header, rather than growing a second client beside
 * this one.
 */
export const endpointUrl = apiURL
export const fetchGraphQL = queryFetcher

export const client = createClient<GeneratedSchema>({
  schema: generatedSchema,
  scalars: scalarsEnumsHash,
  cache,
  fetchOptions: {
    fetcher: queryFetcher
  }
})

// Core functions
export const {resolve, subscribe, schema} = client

// Legacy functions
export const {query, mutation, mutate, subscription, resolved, refetch, track} =
  client

export const {
  graphql,
  useQuery,
  usePaginatedQuery,
  useTransactionQuery,
  useLazyQuery,
  useRefetch,
  useMutation,
  useMetaState,
  prepareReactRender,
  useHydrateCache,
  prepareQuery
} = createReactClient<GeneratedSchema>(client, {
  defaults: {
    // Enable Suspense, you can override this option for each hook.
    suspense: true,
    initialLoadingState: true
  }
})

export * from './schema.generated'

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

const queryFetcher: QueryFetcher = async function (
  {query, variables, operationName},
  fetchOptions
) {
  const headers: any = {}

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
        if (user?.access_token) {
          headers['Authorization'] = `Bearer ${user.access_token}`
        }
      }
    }
  } catch { /* auth not available */ }

  const response = await fetch(apiURL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify({
      query,
      variables,
      operationName
    }),
    mode: 'cors',
    ...fetchOptions
  })

  return await defaultResponseHandler(response)
}

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
);

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
});

// Core functions
export const { resolve, subscribe, schema } = client;

// Legacy functions
export const {
  query,
  mutation,
  mutate,
  subscription,
  resolved,
  refetch,
  track
} = client;

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

export * from './schema.generated';

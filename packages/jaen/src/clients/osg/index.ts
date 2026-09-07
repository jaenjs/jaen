import {Cache, createClient, defaultResponseHandler} from 'gqty'
import type {QueryFetcher} from 'gqty'

import {accessTokenFromOidcStorage} from '../../utils/oidc-session'
import {
  generatedSchema,
  scalarsEnumsHash,
  type GeneratedSchema
} from './schema.generated'

/**
 * Client for the storage gateway.
 *
 * `schema.generated.ts` next to this file is emitted by `pylon build` in the
 * gateway repo (jaenjs/open-storage-gateway) and copied in verbatim -- it is
 * generated output, not something to edit here. Regenerate by building the
 * gateway and copying `.pylon/client/schema.generated.ts` over it.
 *
 * The fetcher differs from the one Pylon scaffolds in exactly one way: Pylon
 * assumes the client and the API share an origin and posts to a relative
 * `/graphql`. Here they never do -- a jaen site and its gateway are separate
 * hosts -- so the endpoint is absolute and configurable.
 *
 * File uploads need no special handling: the multipart request spec is built
 * below, the same way the generated client does it, so `upload({file})` takes
 * a File directly.
 */

/** Gateway origin. `/graphql` and `/storage/<id>` hang off it. */
export const storageOrigin = (): string =>
  // typeof, not a bare read: a site built against a plugin dist that predates
  // the storageUrl option never gets this define replaced, and a bare
  // identifier then throws ReferenceError at the first upload.
  (
    (typeof __JAEN_STORAGE_URL__ !== 'undefined' && __JAEN_STORAGE_URL__) ||
    'https://osg.snek.at'
  ).replace(/\/+$/, '')

/** URL of a stored file, without a round trip. Not public any more: see below. */
export const storageFileUrl = (fileId: string): string =>
  `${storageOrigin()}/storage/${encodeURIComponent(fileId)}`

/**
 * Hosts that have ever served this estate's media, so a stored URL can be
 * recognised as a gateway URL wherever it was written.
 *
 * `osg.snek.at` is the Go service this gateway replaced. It is still an A
 * record and still answers every historical id, and every published patch of
 * every jaen site names it, so an id written years ago arrives here spelled
 * that way. Recognition is by "is this one of ours", never by "is this the
 * origin we would mint today".
 */
const KNOWN_STORAGE_HOSTS = ['osg.snek.at', 'osg.netsnek.com', 'osg.jaen.io']

/**
 * The file id inside a stored value, or null when the value is not a gateway
 * file.
 *
 * Callers hold three spellings of the same thing: a bare id (what `upload`
 * answers), an absolute gateway URL (what a patch payload carries) and, since
 * the build rewrites media onto the site's own origin, a site-relative path
 * that is not a gateway file at all and must be left alone.
 */
export const storageFileId = (idOrUrl: string): string | null => {
  const value = idOrUrl.trim()

  if (value === '') return null

  if (!/^https?:\/\//i.test(value)) {
    // A site-relative path is the build's own copy, not a gateway id.
    return value.startsWith('/') ? null : value
  }

  let url: URL

  try {
    url = new URL(value)
  } catch {
    return null
  }

  const origin = storageOrigin()
  const isOurs =
    KNOWN_STORAGE_HOSTS.includes(url.hostname) ||
    (origin !== '' && value.startsWith(`${origin}/`))

  if (!isOurs) return null

  const match = /^\/storage\/(.+)$/.exec(url.pathname)

  return match ? decodeURIComponent(match[1]!) : null
}

/**
 * The bearer the gateway wants, or undefined when there is nobody signed in.
 *
 * In a browser it is the CMS's own Zitadel access token out of the stored
 * OIDC session, read exactly the way `clients/jaen` reads it for the CMS API,
 * so the gateway sees the same person the pylons see. In a Node process
 * (`uploadFileFromNode`, the publish flow) there is no session and the
 * machine token stands in its place.
 *
 * Undefined rather than an empty header: a request without `Authorization`
 * is still the right request while a file is unclaimed, and the gateway
 * answers 401 once it is not.
 */
export const storageBearer = (): string | undefined => {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const token = accessTokenFromOidcStorage(
        sessionStorage.getItem(
          `oidc.user:${__JAEN_ZITADEL_GQL__.authority}:${__JAEN_ZITADEL_GQL__.clientId}`
        )
      )

      if (token) return token
    }
  } catch {
    // A storage access that throws (a browser blocking site data, a server
    // render) is no session, which is the same answer as no session.
  }

  try {
    // Read indirectly, off globalThis. `process.env.OSG_TOKEN` written out is
    // a member expression webpack's DefinePlugin substitutes, and a build
    // machine that has the token in its environment would then have inlined a
    // machine credential into every visitor's bundle.
    const env = (globalThis as {process?: {env?: Record<string, string>}})
      .process?.env

    if (env?.['OSG_TOKEN']) return env['OSG_TOKEN']
  } catch {
    // No process, so no machine token.
  }

  return undefined
}

/** Walks the variables, lifting every File out into its own form part. */
const buildMultipartForm = (
  query: string,
  variables: Record<string, unknown> | undefined
): FormData => {
  const form = new FormData()
  const operations = {query, variables: structuredClone(variables ?? {})}
  const map: Record<string, string[]> = {}
  const files: Array<{index: number; file: File | Blob}> = []

  let index = 0

  const setAt = (obj: any, path: Array<string | number>, value: unknown) => {
    let cursor = obj

    for (let i = 0; i < path.length - 1; i++) cursor = cursor[path[i]!]

    cursor[path[path.length - 1]!] = value
  }

  const walk = (value: unknown, path: Array<string | number> = []): void => {
    if (value instanceof File || value instanceof Blob) {
      map[index] = [`variables.${path.join('.')}`]
      setAt(operations.variables, path, null)
      files.push({index, file: value})
      index++
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, [...path, i]))
    } else if (value && typeof value === 'object') {
      Object.entries(value).forEach(([key, val]) => walk(val, [...path, key]))
    }
  }

  walk(operations.variables)

  form.append('operations', JSON.stringify(operations))
  form.append('map', JSON.stringify(map))
  files.forEach(({index: i, file}) => form.append(String(i), file))

  return form
}

const queryFetcher: QueryFetcher = async ({query, variables}, fetchOptions) => {
  const token = storageBearer()

  const response = await fetch(`${storageOrigin()}/graphql`, {
    method: 'POST',
    body: buildMultipartForm(query, variables as Record<string, unknown>),
    mode: 'cors',
    ...fetchOptions,
    // After fetchOptions, because the caller's headers must not drop the
    // credential: an upload without it is refused once the write gate is on.
    headers: {
      ...((fetchOptions as {headers?: HeadersInit} | undefined)?.headers as
        | Record<string, string>
        | undefined),
      ...(token ? {Authorization: `Bearer ${token}`} : {})
    }
  })

  return await defaultResponseHandler(response)
}

export const osgCache = new Cache(undefined, {
  maxAge: Infinity,
  staleWhileRevalidate: 5 * 60 * 1000,
  normalization: true
})

export const osg = createClient<GeneratedSchema>({
  schema: generatedSchema,
  scalars: scalarsEnumsHash,
  cache: osgCache,
  fetchOptions: {fetcher: queryFetcher}
})

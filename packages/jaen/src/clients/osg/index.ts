import {Cache, createClient, defaultResponseHandler} from 'gqty'
import type {QueryFetcher} from 'gqty'

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
  (__JAEN_STORAGE_URL__ || 'https://osg.snek.at').replace(/\/+$/, '')

/** Public URL of a stored file, without a round trip. */
export const storageFileUrl = (fileId: string): string =>
  `${storageOrigin()}/storage/${encodeURIComponent(fileId)}`

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
  const response = await fetch(`${storageOrigin()}/graphql`, {
    method: 'POST',
    body: buildMultipartForm(query, variables as Record<string, unknown>),
    mode: 'cors',
    ...fetchOptions
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

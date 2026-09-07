import {GatsbyCache} from 'gatsby'

export const fetchWithCache = async <T>(
  url: string,
  options?: {
    cache: GatsbyCache
    /**
     * Sent on the request but deliberately not part of the cache key: the
     * patches live on the storage gateway, which is private now, and the
     * credential that reads them is a property of the build rather than of
     * the file.
     */
    headers?: Record<string, string>
  }
): Promise<T> => {
  const {cache, headers} = options ?? {}

  if (cache) {
    const cachedResponse = await cache.get(url)
    if (cachedResponse) {
      return cachedResponse
    }
  }

  const response = await fetch(url, headers ? {headers} : undefined)

  if (!response.ok) {
    throw new Error(`${url} answered ${response.status}`)
  }

  const data = await response.json()

  if (cache) {
    await cache.set(url, data)
  }

  return data
}

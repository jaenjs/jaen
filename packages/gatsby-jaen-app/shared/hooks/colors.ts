/**
 * The driver colours, read as one batch per page of drivers.
 *
 * The board used to ask `getDriverColor` once per driver, about 24 requests
 * in one burst after the driver list arrived, and the pylon answered some of
 * them with Cloudflare's 1101: the Worker's runtime cancelled the request as
 * hung, because under the burst it waited on a promise of another request's
 * context. A 1101 carries no CORS header, the browser reports a blocked
 * fetch, the reader filed it as no colour, and the dots and stripes of the
 * board came out grey on many visits. See okf/architecture/dispatch.md, "The
 * driver colours".
 *
 * Now every reader asks `driverColors(args: {userIds})`, one request for the
 * whole list, cached under `['driverColors', ids]` for five minutes and
 * persisted with the rest. A read whose ids are all held by a fresh batch
 * already in the cache, the detail page after the board, the map after the
 * driver list, is answered from it and asks nothing.
 */
import {useMemo} from 'react'
import {fetchGraphQL} from '../../client/limosen'
import {graphqlError} from '../errors'
import {cachedRead, keys, queryClient, useAppQuery} from './query'

/** The schema's default: nobody chose a colour, drawn as no colour everywhere. */
export const NO_COLOR = '#C0C0C0'

/** Five minutes, the same as the people and the fleet, see query.ts. */
const COLOR_STALE = 5 * 60_000

/** By user id, undefined where nobody chose a colour. */
export type DriverColors = Record<string, string | undefined>

/**
 * What the cache holds: null where nobody chose a colour, so every id asked
 * for is a key of the record and a subset can be told to be covered.
 */
type StoredColors = Record<string, string | null>

const NO_COLORS: DriverColors = {}

/** Distinct, non-empty, sorted, so one set of ids spells one key. */
const normalise = (userIds: readonly string[]): string[] =>
  Array.from(
    new Set(userIds.filter(id => typeof id === 'string' && id.length > 0))
  ).sort()

const pick = (data: StoredColors, ids: readonly string[]): DriverColors => {
  const out: DriverColors = {}
  for (const id of ids) out[id] = data[id] ?? undefined
  return out
}

/** The one request: every id answered, the silver default mapped to null. */
const fetchBatch = async (ids: string[]): Promise<StoredColors> => {
  const result: any = await fetchGraphQL(
    {
      // The list as a literal, the way every read of the app spells its
      // arguments, so the document names no input type of the deployment.
      query: `query { driverColors(args: {userIds: ${JSON.stringify(ids)}}) { userId color } }`,
      variables: undefined,
      operationName: undefined
    },
    {}
  )
  if (result?.errors?.length) {
    throw graphqlError(result.errors)
  }
  const out: StoredColors = {}
  for (const id of ids) out[id] = null
  const rows: any[] = Array.isArray(result?.data?.driverColors)
    ? result.data.driverColors
    : []
  for (const row of rows) {
    const id = typeof row?.userId === 'string' ? row.userId : ''
    if (!id || !(id in out)) continue
    const color = typeof row?.color === 'string' ? row.color : ''
    out[id] = color && color.toUpperCase() !== NO_COLOR ? color : null
  }
  return out
}

/**
 * A fresh batch in the cache that holds every id asked for, if there is one:
 * the board's batch covers the detail page's one driver and the map's.
 */
const held = (
  ids: readonly string[]
): {data: StoredColors; at: number} | undefined => {
  const now = Date.now()
  for (const query of queryClient
    .getQueryCache()
    .findAll({queryKey: ['driverColors']})) {
    const data = query.state.data as StoredColors | undefined
    if (!data || now - query.state.dataUpdatedAt > COLOR_STALE) continue
    if (ids.every(id => id in data))
      return {data, at: query.state.dataUpdatedAt}
  }
  return undefined
}

/**
 * The colours of these drivers, one request at most. Outside React, for the
 * readers that join the colour onto a page of people.
 *
 * A failed read answers no colour for everybody: the colour is decoration
 * and must not take the list with it. That is also what hides a pylon
 * without `driverColors` or a refused call, so when every dot is grey, look
 * here first (the hard rule on swallowed errors, okf/decisions/hard-rules.md).
 */
export async function readDriverColors(
  userIds: readonly string[]
): Promise<DriverColors> {
  const ids = normalise(userIds)
  if (!ids.length) return NO_COLORS
  const have = held(ids)
  if (have) return pick(have.data, ids)
  try {
    return pick(
      await cachedRead(
        keys.driverColors(ids),
        () => fetchBatch(ids),
        COLOR_STALE
      ),
      ids
    )
  } catch {
    return NO_COLORS
  }
}

/**
 * The same for a component: the colours of the drivers on the map, by user
 * id, one query for the list. A batch already held for a superset of the ids
 * is the initial answer, so the map after the board asks nothing. The record
 * is rebuilt only when the answer or the ids change.
 */
export function useDriverColors(userIds: string[]): DriverColors {
  const key = normalise(userIds).join('|')
  const ids = useMemo(() => (key ? key.split('|') : []), [key])

  const {query: q} = useAppQuery<StoredColors>({
    queryKey: keys.driverColors(ids),
    queryFn: () => fetchBatch(ids),
    staleTime: COLOR_STALE,
    enabled: ids.length > 0,
    initialData: () => held(ids)?.data,
    initialDataUpdatedAt: () => held(ids)?.at
  })

  const data = q.data
  return useMemo(() => (data ? pick(data, ids) : NO_COLORS), [data, ids])
}

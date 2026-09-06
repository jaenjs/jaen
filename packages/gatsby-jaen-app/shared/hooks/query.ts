/**
 * The read layer: one TanStack Query client, its keys, and the wrapper every
 * domain hook renders through.
 *
 * Every screen used to fetch through hand-rolled hooks with no cache between
 * them: the board, a detail and the board again were three round trips, each
 * waiting on the pylon before anything was drawn. Now one QueryClient holds
 * every answer, keyed per domain, and a screen that mounts renders what the
 * client already has and refetches behind it. See
 * okf/architecture/data-layer.md, this file is that decision.
 *
 * The client lives here and not in AppWrapper, which mounts the provider,
 * because the hooks and the mutations need it outside React (a mutation
 * invalidates its domain from a plain async function) and because useCaller
 * renders in the frame's menu on every page, above any provider the app
 * could mount. Every hook passes the client to useQuery explicitly for that
 * reason, and the provider in AppWrapper is for whatever else wants
 * useQueryClient.
 *
 * Offline is the client's own behaviour: networkMode offlineFirst fires the
 * first fetch whatever the browser says, the failure is the layer's
 * OfflineError, and the data the query holds stays on the screen. The
 * persisted cache (shared/offline.ts, the IndexedDB store) is what makes the
 * data there after a reload. Nothing here retries: the screens showed the
 * error at once before this layer and they still do.
 */
import {useCallback, useEffect, useState, useSyncExternalStore} from 'react'
import {
  QueryClient,
  useQuery,
  type QueryKey,
  type UseQueryOptions,
  type UseQueryResult
} from '@tanstack/react-query'
import {persistQueryClient} from '@tanstack/react-query-persist-client'
import {
  isOfflineError,
  markOffline,
  offlinePersister,
  onOfflineStoreCleared,
  PERSIST_MAX_AGE,
  sessionSubject,
  useOnline
} from '../offline'

// --------------- The client ---------------

const MINUTE = 60_000

/**
 * 30 s for the lists, 5 min for the people and the fleet, which change by
 * the hour, not by the minute. The tracking read is never fresh, it is
 * polled. A geocode is a fact. The schema is asked once in a while, so a
 * deploy that renames a field is picked up without a reload.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'offlineFirst',
      retry: false,
      staleTime: 30_000,
      gcTime: PERSIST_MAX_AGE,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true
    },
    mutations: {networkMode: 'offlineFirst', retry: false}
  }
})

for (const domain of [
  'users',
  'user',
  'drivers',
  'fleet',
  'driverColor',
  'driverColors',
  'bookingDriver',
  'caller',
  'schema'
]) {
  queryClient.setQueryDefaults([domain], {staleTime: 5 * MINUTE})
}
queryClient.setQueryDefaults(['tracking'], {staleTime: 0})
queryClient.setQueryDefaults(['geocode'], {staleTime: Infinity})

// --------------- The keys ---------------

/**
 * One function per domain, so an invalidation and a read spell the key the
 * same way. The first segment is the domain, and a mutation invalidates by
 * it: `['transfers']` matches every page of every list.
 */
export const keys = {
  caller: (subject: string | undefined) => ['caller', subject ?? ''] as const,
  schema: (name: string) => ['schema', name] as const,
  transfers: (args: Record<string, unknown>) => ['transfers', args] as const,
  transfer: (idOrCode: string) => ['transfer', idOrCode] as const,
  users: (args: Record<string, unknown>) => ['users', args] as const,
  user: (userId: string) => ['user', userId] as const,
  drivers: () => ['drivers'] as const,
  driverColor: (userId: string) => ['driverColor', userId] as const,
  /** One batch per set of ids, sorted and distinct, see ./colors.ts. */
  driverColors: (userIds: readonly string[]) =>
    ['driverColors', userIds] as const,
  fleet: () => ['fleet'] as const,
  fleetPicker: () => ['fleet', 'picker'] as const,
  locations: (args: Record<string, unknown>) => ['locations', args] as const,
  dashboard: (month: string) => ['dashboard', month] as const,
  expenses: (userId: string, month: string | undefined) =>
    ['expenses', userId, month ?? ''] as const,
  statements: (userId: string) => ['statements', userId] as const,
  statementLines: (userId: string, month: string, kind: string) =>
    ['statements', userId, month, kind] as const,
  bookings: (args: Record<string, unknown>) => ['bookings', args] as const,
  booking: (idOrCode: string) => ['booking', idOrCode] as const,
  bookingDriver: (driverId: string) => ['bookingDriver', driverId] as const,
  tracking: (transferId: string) => ['tracking', transferId] as const,
  geocode: (address: string) => ['geocode', address] as const
}

/** Every domain a change to a transfer can be seen on. */
export const invalidateTransfers = () =>
  Promise.all(
    [['transfers'], ['bookings'], ['dashboard'], ['tracking']].map(queryKey =>
      queryClient.invalidateQueries({queryKey})
    )
  ).then(() => undefined)

// --------------- The persisted cache ---------------

/**
 * The client is persisted once per page load and per subject, and the
 * restore has to land before the first fetch goes: a fetch that fails
 * offline before the store is read would flash the error over the answer
 * the store was about to give. So the hooks hold their first fetch until
 * `restored`, which the restore flips, and it flips whether the store held
 * anything or not.
 */
let restored = false
const restoredListeners = new Set<() => void>()

const markRestored = () => {
  if (restored) return
  restored = true
  restoredListeners.forEach(l => l())
}

const subscribeRestored = (listener: () => void) => {
  restoredListeners.add(listener)
  return () => {
    restoredListeners.delete(listener)
  }
}

const restoredNow = () => restored
const restoredOnServer = () => false

let persistence: {subject: string | undefined; stop: () => void} | undefined

/**
 * Restore the store into the client and keep the client written to it. Called
 * by every hook and by the shell, cheap after the first time. A subject that
 * changed since the last call, which is the sign-in landing on /loading and
 * then walking into /app, restarts the persistence for the new account.
 */
export const ensurePersisted = () => {
  if (typeof window === 'undefined') return
  const subject = sessionSubject()
  if (persistence && persistence.subject === subject) return
  persistence?.stop()
  // Mounted once for the page, so the client hears the focus and online
  // signals wherever a hook renders, above the provider as well as under it.
  if (!persistence) queryClient.mount()
  const [stop, done] = persistQueryClient({
    queryClient,
    persister: offlinePersister,
    maxAge: PERSIST_MAX_AGE,
    buster: subject ?? '',
    dehydrateOptions: {
      // The last good answer is what a reload offline wants, whatever state
      // the query is in now: a query that failed offline still holds it.
      shouldDehydrateQuery: query => query.state.data !== undefined,
      shouldDehydrateMutation: () => false
    }
  })
  persistence = {subject, stop}
  done.catch(() => undefined).finally(markRestored)
}

onOfflineStoreCleared(() => {
  queryClient.clear()
})

/** True once the persisted cache has been read on this page, false on the server. */
export function useRestored(): boolean {
  const value = useSyncExternalStore(
    subscribeRestored,
    restoredNow,
    restoredOnServer
  )
  useEffect(() => {
    ensurePersisted()
  }, [])
  return value
}

// --------------- The wrapper ---------------

export const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err)

export interface AppQuery<TData> {
  query: UseQueryResult<TData, Error>
  /**
   * True while nothing is on the screen yet and a read is on its way, and
   * while a page other than the one shown is being read. A background
   * refetch of what is shown is not loading, the rows are there.
   */
  isLoading: boolean
  /**
   * The message a screen shows, or null. A read that failed for want of a
   * network while the query still holds an answer is not an error to a
   * person: the answer is on the screen and the banner says how old it is.
   */
  error: string | null
  /**
   * True while the query is on the wire, first read or background refetch
   * alike. The refresh button and the pull turn on this, never on isLoading,
   * which is false while cached rows are shown (design-consistency.md, 5a).
   */
  isFetching: boolean
  refetch: () => void
}

/**
 * useQuery with the app's rules: the first fetch waits for the restore, the
 * client is the one above whatever provider is in scope, the age of the
 * answer feeds the offline banner, and the result is folded into the shape
 * the screens have always read.
 */
export function useAppQuery<TQueryFnData, TData = TQueryFnData>(
  options: UseQueryOptions<TQueryFnData, Error, TData, QueryKey>
): AppQuery<TData> {
  const restored = useRestored()
  const enabled =
    options.enabled === undefined ? true : options.enabled === true
  const query = useQuery(
    {...options, enabled: enabled && restored},
    queryClient
  )
  const {online} = useOnline()

  const hasData = query.data !== undefined
  const at = query.dataUpdatedAt
  useEffect(() => {
    // The banner reads "Offline, Stand hh:mm" from the newest answer shown.
    if (!online && hasData && at) markOffline(new Date(at).toISOString())
  }, [online, hasData, at])

  const error = query.error
    ? isOfflineError(query.error) && hasData
      ? null
      : errorMessage(query.error)
    : null
  const isLoading =
    (query.isPending && enabled && (query.isFetching || !restored)) ||
    (query.isPlaceholderData && query.isFetching)
  const refetch = useCallback(() => {
    void query.refetch()
  }, [query.refetch])

  return {query, isLoading, error, isFetching: query.isFetching, refetch}
}

/**
 * A read outside React through the client, so the answer is cached and
 * persisted like a hook's. Fresh data is answered from the cache, stale data
 * is read again, and a read that fails while the cache holds an answer,
 * which is the offline case, answers that.
 */
export async function cachedRead<T>(
  queryKey: QueryKey,
  queryFn: () => Promise<T>,
  staleTime?: number
): Promise<T> {
  try {
    return await queryClient.fetchQuery({queryKey, queryFn, staleTime})
  } catch (err) {
    const held = queryClient.getQueryData<T>(queryKey)
    if (held !== undefined) return held
    throw err
  }
}

// --------------- The pager ---------------

export interface Pager {
  page: number
  /** The cursor the current page starts after, undefined on the first. */
  after: string | undefined
  next: (endCursor: string) => void
  prev: () => void
  first: () => void
}

interface PagerState {
  key: string
  page: number
  after: string | undefined
  trail: Array<string | undefined>
}

const firstPage = (key: string): PagerState => ({
  key,
  page: 1,
  after: undefined,
  trail: []
})

/**
 * Cursor pagination as the screens drive it: next, previous, first. The
 * cursors that led to the current page are the trail back. `argsKey` names
 * the list, and a list whose arguments changed starts on its first page
 * without an effect: the state is simply not this list's any more.
 */
export function usePager(argsKey: string): Pager {
  const [state, setState] = useState<PagerState>(() => firstPage(argsKey))
  const live = state.key === argsKey ? state : firstPage(argsKey)

  const next = useCallback(
    (endCursor: string) => {
      setState(current => {
        const from = current.key === argsKey ? current : firstPage(argsKey)
        return {
          key: argsKey,
          page: from.page + 1,
          after: endCursor,
          trail: [...from.trail, from.after]
        }
      })
    },
    [argsKey]
  )

  const prev = useCallback(() => {
    setState(current => {
      const from = current.key === argsKey ? current : firstPage(argsKey)
      if (from.page <= 1) return from
      const trail = [...from.trail]
      const after = trail.pop()
      return {key: argsKey, page: from.page - 1, after, trail}
    })
  }, [argsKey])

  const first = useCallback(() => {
    setState(firstPage(argsKey))
  }, [argsKey])

  return {page: live.page, after: live.after, next, prev, first}
}

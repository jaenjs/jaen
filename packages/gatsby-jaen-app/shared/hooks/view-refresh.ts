/**
 * The one place a screen says how it is refreshed.
 *
 * Two controls refresh a view, the small outline button in its header and a
 * pull on the page below md, and they must never disagree about what they
 * refetch or whether it is running. So the view registers its query once,
 * `useViewRefresh(refetch, isFetching)`, and both controls read that
 * registration from this context: the button through `useRegisteredRefresh`,
 * the shell's PullToRefresh the same. A view with no registration has no
 * pull and its button, if it has one, takes its handler as a prop.
 *
 * `isFetching` is TanStack's, true on the wire whether or not rows are on
 * the screen, which is what a turning icon means. `isLoading` would be false
 * for every refetch of cached rows (design-consistency.md, rules 5 and 5a).
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react'

export interface ViewRefresh {
  refetch: () => void
  isFetching: boolean
}

interface ViewRefreshStore {
  current: ViewRefresh | null
  set: (next: ViewRefresh | null) => void
}

const ViewRefreshContext = createContext<ViewRefreshStore | null>(null)

/** Mounted once by the shell, around the page content. */
export function ViewRefreshProvider({children}: {children: React.ReactNode}) {
  const [current, setCurrent] = useState<ViewRefresh | null>(null)
  const set = useCallback((next: ViewRefresh | null) => {
    setCurrent(prev =>
      prev === next ||
      (prev &&
        next &&
        prev.refetch === next.refetch &&
        prev.isFetching === next.isFetching)
        ? prev
        : next
    )
  }, [])
  const store = useMemo<ViewRefreshStore>(
    () => ({current, set}),
    [current, set]
  )
  return React.createElement(
    ViewRefreshContext.Provider,
    {value: store},
    children
  )
}

/**
 * Register the view's query. Called once per view, after the hook that
 * owns the query, and the registration follows `isFetching` as it changes.
 * The view unregisters when it unmounts, so a navigation never leaves the
 * previous view's refetch behind for the pull to call. `skip` is for a view
 * embedded in another screen, whose own query is the one registered.
 */
export function useViewRefresh(
  refetch: () => void,
  isFetching: boolean,
  skip = false
): void {
  const store = useContext(ViewRefreshContext)
  const set = store?.set
  useEffect(() => {
    if (!set || skip) return
    set({refetch, isFetching})
  }, [set, skip, refetch, isFetching])
  useEffect(() => {
    if (!set || skip) return
    return () => set(null)
  }, [set, skip])
}

/** What the current view registered, or null outside a view that did. */
export function useRegisteredRefresh(): ViewRefresh | null {
  return useContext(ViewRefreshContext)?.current ?? null
}

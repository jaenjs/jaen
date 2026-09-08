import {Store} from 'redux'
import {onErrorResetAndRery} from './middleware'

/**
 * The deadline the deferred write is given. `requestIdleCallback` runs the
 * write in the first idle moment and this is the point past which it stops
 * waiting for one, so a browser that never goes idle still writes four times a
 * second at worst. It is also the whole of the window in which a change lives
 * in memory alone, which is why the two events below exist.
 *
 * See docs/architecture/editing-performance.md, change 1.
 */
export const PERSIST_IDLE_TIMEOUT_MS = 250

/**
 * The one jaen field type that holds a catalogue rather than a value.
 *
 * The media library is `useField('media_nodes', 'IMA:MEDIA_NODES')` on the
 * media page, so every picture of the site is one key of one field, and on
 * booklimo.at that field is 99% of everything the store serialises. The agent
 * keeps it in a file of its own for the same reason `dropCatalogue` leaves it
 * out of localStorage.
 */
export const CATALOGUE_FIELD_TYPE = 'IMA:MEDIA_NODES'

export interface PersistStateOptions {
  /**
   * Leave the media catalogue out of what is written to `localStorage`.
   *
   * **Only ever true where something else can hand the catalogue back**, which
   * today means the jaen agent is configured and its poller hydrates the draft
   * within `activePollMs` of the store coming up. Without the agent
   * `localStorage` is the only store there is, and dropping the catalogue
   * would drop every picture added since the last publish, which is the
   * invariant of this file: an edit a person made is never lost.
   */
  dropCatalogue?: boolean
}

type IdleDeadline = {didTimeout: boolean; timeRemaining: () => number}
type RequestIdleCallback = (
  callback: (deadline: IdleDeadline) => void,
  options?: {timeout: number}
) => number

export default <RootState extends {}>(
  persistKey: string,
  options: PersistStateOptions = {}
) => {
  const dropCatalogue = options.dropCatalogue === true

  /**
   * What used to be a deep clone, a recursive walk over the clone and a second
   * `JSON.stringify`, in one pass.
   *
   * `isLoading` and `error` are dropped wherever they appear, which is exactly
   * what the walk did, and the catalogue is dropped by its field type, which
   * is a key of `jaenFields` and never a value: an unsent media change in the
   * outbox carries `IMA:MEDIA_NODES` as the *value* of `fieldType` and is
   * therefore untouched by this. That matters more than the bytes it saves,
   * because the outbox is the offline queue.
   */
  const replacer = (key: string, value: unknown): unknown => {
    if (key === 'isLoading' || key === 'error') {
      return undefined
    }

    if (dropCatalogue && key === CATALOGUE_FIELD_TYPE) {
      return undefined
    }

    return value
  }

  /**
   * Reads what is in the browser today, whatever wrote it.
   *
   * Every editor's browser carries a payload written by the synchronous
   * writer, catalogue and all, and that payload is the same shape as the one
   * written here: this only ever wrote a subset. So there is no migration and
   * no version stamp, and a payload with a catalogue in it is loaded with the
   * catalogue, which is strictly better than starting without one.
   */
  const loadState = (): RootState | undefined => {
    try {
      const serialState = localStorage.getItem(persistKey)

      if (serialState === null) {
        return undefined
      }
      return JSON.parse(serialState) as RootState
    } catch (err) {
      return undefined
    }
  }

  /**
   * One stringify and one storage write, synchronous by construction: this is
   * what the scheduler below defers, and what the tab going away calls at
   * once.
   */
  const saveState = (state: RootState) => {
    // skip if localStorage is not available
    if (typeof window === 'undefined') {
      return
    }

    try {
      localStorage.setItem(persistKey, JSON.stringify(state, replacer))
    } catch (err) {
      // A quota error is the one that matters here, and swallowing it means
      // the browser silently keeps an older payload than the store: the store
      // is still right, the reload is the thing that would be wrong.
      console.error(err)
    }
  }

  const persistState = (store: Store) => {
    // The write is deferred, so what says a write is owed is a flag rather
    // than the call itself. Every dispatch in between coalesces into one
    // write of the state as it stands when the write finally runs, which is
    // why nothing is queued and no state is captured here.
    let dirty = false
    let idleHandle: number | undefined
    let timerHandle: ReturnType<typeof setTimeout> | undefined

    const idleWindow = (
      typeof window === 'undefined' ? undefined : (window as any)
    ) as
      | {
          requestIdleCallback?: RequestIdleCallback
          cancelIdleCallback?: (handle: number) => void
        }
      | undefined

    const requestIdle =
      typeof idleWindow?.requestIdleCallback === 'function'
        ? idleWindow.requestIdleCallback.bind(idleWindow)
        : undefined

    const cancelIdle =
      typeof idleWindow?.cancelIdleCallback === 'function'
        ? idleWindow.cancelIdleCallback.bind(idleWindow)
        : undefined

    const cancelScheduled = () => {
      if (idleHandle !== undefined) {
        cancelIdle?.(idleHandle)
        idleHandle = undefined
      }

      if (timerHandle !== undefined) {
        clearTimeout(timerHandle)
        timerHandle = undefined
      }
    }

    /**
     * Write now, on this thread. Called by the idle callback, by the tab
     * going away and by anybody holding the returned `flush`.
     */
    const flush = () => {
      cancelScheduled()

      if (!dirty) {
        return
      }

      dirty = false
      saveState(store.getState() as RootState)
    }

    const schedule = () => {
      dirty = true

      if (idleHandle !== undefined || timerHandle !== undefined) {
        return
      }

      if (requestIdle) {
        idleHandle = requestIdle(
          () => {
            idleHandle = undefined
            flush()
          },
          {timeout: PERSIST_IDLE_TIMEOUT_MS}
        )

        return
      }

      // No idle callback: Safari before 16.4 and every non-browser host that
      // runs this module. The same deadline, without the chance of running
      // sooner.
      timerHandle = setTimeout(() => {
        timerHandle = undefined
        flush()
      }, PERSIST_IDLE_TIMEOUT_MS)
    }

    // The first write stays synchronous and immediate. It happens once, while
    // the store is coming up, and it is what puts a preloaded state back on
    // disk in the shape this writer writes.
    saveState(store.getState() as RootState)

    store.subscribe(schedule)

    /**
     * The tab going away, which is the whole safety of a deferred write.
     *
     * `visibilitychange` to hidden and `pagehide` are the pair a browser
     * actually delivers when a tab is closed, backgrounded or replaced, iOS
     * Safari included, where `beforeunload` and `unload` are not. Both write
     * synchronously and at once, so the deferred window ends the moment the
     * page stops being looked at.
     */
    const onVisibilityChange = () => {
      if (
        typeof document === 'undefined' ||
        document.visibilityState === 'hidden'
      ) {
        flush()
      }
    }

    const onPageHide = () => {
      flush()
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange)
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', onPageHide)
    }

    const resetState = (payload?: {}) => {
      // A write owed from before the discard must not land after the key was
      // removed. The dispatch below marks the store dirty again and the reset
      // state is written by the next idle callback, which is the state that
      // should be there.
      cancelScheduled()
      dirty = false

      localStorage.removeItem(persistKey)

      store.dispatch({
        type: 'RESET_STATE',
        payload
      })
    }

    return {resetState, flush}
  }

  const persistMiddleware = [onErrorResetAndRery<RootState>(persistKey)]

  return {
    loadState,
    saveState,
    persistState,
    persistMiddleware
  }
}

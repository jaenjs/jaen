/**
 * The way out of a page, and the one order that holds the invariant.
 *
 * **An edit a person made is never lost.** That promise used to be kept by
 * `redux/persist-state.ts` alone, which writes the whole store synchronously
 * on `visibilitychange` to hidden and on `pagehide`, the pair a browser
 * actually delivers when a tab is closed, backgrounded or replaced. It was
 * measured on the deployed booklimo.at on 2026-09-08 that the promise did not
 * reach the half second before a field's change is a store change at all: a
 * text field turns typing into a `pages/field_write` through a 500 ms
 * debounce, so a tab that goes away inside that window makes the persister
 * write a store that has never heard of the edit. A close 0 ms or 300 ms after
 * the blur left the previous value in `localStorage` with an empty outbox, and
 * a reload 200 ms after it brought the field back at its old value. See
 * `docs/architecture/draft-state.md`, "The one that failed", and
 * `docs/architecture/editing-performance.md`, "The half second before this
 * file begins".
 *
 * The repair is not another listener. Listeners run in the order they were
 * registered, and the persister's are registered when the redux module is
 * loaded, which is before any field has mounted, so a field's own listener
 * would always run after the store had already been written. The way out is
 * therefore one pass with a fixed order:
 *
 *   1. every holder of an edit that is not yet a dispatch flushes it,
 *   2. the store is written synchronously,
 *   3. the outbox is sent, best effort.
 *
 * Step 2 is what holds the invariant: a change that is in the store is in
 * `localStorage` before the page goes, and the outbox drains on the next
 * start. Step 3 is an optimisation, and a browser is free to drop it: the
 * call carries an `Authorization` header so it cannot be a beacon.
 *
 * The pass is idempotent and cheap when nothing is pending, which matters
 * because `visibilitychange` and `pagehide` both fire on the same exit.
 */

type Flush = () => void

/** The holders of step 1, in registration order. */
const holders = new Set<Flush>()

let writeStore: Flush | undefined
let sendOutbox: Flush | undefined
let listening = false

/**
 * A flusher that throws must not keep the next one from running: the whole
 * point of the pass is that the store is written afterwards.
 */
const attempt = (fn: Flush | undefined) => {
  if (!fn) return

  try {
    fn()
  } catch (error) {
    console.error('jaen: a flush on the way out of the page failed', error)
  }
}

/**
 * Run the pass now. Exported because a test drives it directly, and because
 * anything that navigates the CMS away by itself should be able to ask for it.
 */
export const flushOnLeave = () => {
  for (const holder of Array.from(holders)) attempt(holder)

  attempt(writeStore)
  attempt(sendOutbox)
}

const onVisibilityChange = () => {
  // `document.visibilityState` is read defensively: a harness that dispatches
  // the event without defining the property is asking for the pass, and the
  // cost of running it when the tab is still visible is one storage write.
  if (
    typeof document === 'undefined' ||
    document.visibilityState === 'hidden'
  ) {
    flushOnLeave()
  }
}

const listen = () => {
  if (listening) return
  listening = true

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange)
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flushOnLeave)
  }
}

/**
 * Register a holder of an edit that is not yet in the store: a debounce that
 * has not fired, an editor whose value lives in the DOM. Returns the
 * unregister, which every caller runs on unmount.
 */
export const registerLeaveFlush = (flush: Flush): (() => void) => {
  listen()
  holders.add(flush)

  return () => {
    holders.delete(flush)
  }
}

/** Step 2. Set once, by the redux store, beside `persistState`. */
export const setLeaveStoreFlush = (flush: Flush | undefined) => {
  listen()
  writeStore = flush
}

/** Step 3. Set once, by the agent's flusher, when a site carries an agent. */
export const setLeaveOutboxFlush = (flush: Flush | undefined) => {
  sendOutbox = flush
}

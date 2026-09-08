/**
 * The shared draft's persistence layer, beside `persist-state.ts` and shaped
 * like it.
 *
 * `persist-state` writes the whole store to `localStorage` after every action,
 * where it stays until the browser that wrote it publishes. That is the flaw:
 * a change exists in exactly one browser. This file adds the second writer.
 * Every change is recorded, batched and sent to the jaen agent, which commits
 * it to the site's repository; every other open CMS polls the agent and takes
 * the new head. `localStorage` is demoted to what it is good at, an offline
 * queue and a cache, and it keeps that job for free because the outbox is a
 * slice of the same store `persist-state` already writes.
 *
 * `RemoteState(config)` returns `{recordMiddleware, connect}`. `index.tsx`
 * adds the middleware and calls `connect` only when the site was built with the
 * `agent` plugin option, so a site without it behaves exactly as before.
 */
import {Store} from 'redux'

import {
  AgentConfig,
  AgentOfflineError,
  fetchDraft,
  saveChanges
} from '../clients/agent'
import {
  applyChanges,
  draftDataToState,
  draftStateToData,
  JaenChange,
  JaenDraftState,
  MEDIA_FIELD_TYPE,
  recordDifference
} from './apply-change'
import {actions as pageActions} from './slices/page'
import {actions as remoteActions} from './slices/remote'
import {actions as siteActions} from './slices/site'
import * as widgetActions from './slices/widget'

/** The backoff of a failed flush, in seconds, then every 30. */
const RETRY_SECONDS = [2, 5, 15, 30]

/** A batch is sent at this many queued changes without waiting for quiet. */
const MAX_BATCH = 20

/** The agent refuses more than this in one call. */
const CALL_LIMIT = 200

/**
 * The field types that write on every keystroke rather than on a settled
 * value. The MDX editor is the one family jaen has: its CodeMirror state
 * change runs `onUpdateValue` on every character.
 */
const STREAMING_FIELD = /mdx|rich|editor/i

/**
 * Whether a recorded change is one keystroke of a stream.
 *
 * The quiet time exists for exactly that case and no other: it turns a typed
 * paragraph into one commit instead of one commit per letter and one contents
 * API round trip with it.
 *
 * Nothing else in jaen writes that way. `Field.Text` writes on blur and has
 * already waited out its own 500 ms debounce by the time the change is
 * recorded, an image is picked once, a media node is uploaded once, a section
 * is added, moved or removed by a click. For all of those the 800 ms is not a
 * batching window, it is 800 ms of a ten second budget spent waiting for a
 * second change that cannot arrive, so they go at once.
 */
const isKeystroke = (change: JaenChange): boolean =>
  change.kind === 'fieldWrite' && STREAMING_FIELD.test(change.fieldType || '')

/**
 * The recorder: the eight draft-bearing actions of the `page`, `site` and
 * `widget` slices, translated into the agent's change shape.
 *
 * It runs after the reducer, not before, because two of the eight mint an id:
 * `page_updateOrCreate` writes it to `lastAddedNodeId` and `writeData` puts it
 * on the widget it pushed. Reading the id back off the new state is what keeps
 * the agent from inventing a second id for the same page.
 */
const recordAction = (
  action: {type: string; payload: any},
  stateAfter: any,
  stateBefore: any
): JaenChange | null => {
  const at = new Date().toISOString()
  const payload = action.payload

  switch (action.type) {
    case 'pages/field_write': {
      const whole: JaenChange = {
        kind: 'fieldWrite',
        pageId: payload.pageId,
        section: payload.section,
        fieldType: payload.fieldType,
        fieldName: payload.fieldName,
        value: payload.value,
        props: payload.props,
        at
      }

      // The catalogue field is written whole by the gallery and sent as the
      // difference it is. Everything else is a value and goes as it is.
      if (payload.fieldType !== MEDIA_FIELD_TYPE || payload.section) {
        return whole
      }

      const before =
        stateBefore?.page?.pages?.nodes?.[payload.pageId]?.jaenFields?.[
          payload.fieldType
        ]?.[payload.fieldName]?.value

      const difference = recordDifference(before, payload.value)

      if (!difference) return whole

      return {
        kind: 'fieldMerge',
        pageId: payload.pageId,
        fieldType: payload.fieldType,
        fieldName: payload.fieldName,
        value: difference.changed,
        props: {...(payload.props || {}), removed: difference.removed},
        at
      }
    }

    case 'pages/section_add':
      return {
        kind: 'sectionAdd',
        pageId: payload.pageId,
        section: {path: payload.path},
        props: {
          sectionItemType: payload.sectionItemType,
          between: payload.between
        },
        at
      }

    case 'pages/section_remove':
      return {
        kind: 'sectionRemove',
        pageId: payload.pageId,
        section: {path: payload.path, id: payload.sectionId},
        props: {between: payload.between},
        at
      }

    case 'pages/section_move':
      return {
        kind: 'sectionMove',
        pageId: payload.pageId,
        section: {path: payload.path, id: payload.sectionId},
        props: {between: payload.between, move: payload.move},
        at
      }

    case 'pages/page_updateOrCreate': {
      const pageId = payload.id || stateAfter?.page?.pages?.lastAddedNodeId

      if (!pageId) return null

      return {
        kind: 'pageUpdate',
        pageId,
        value: {...payload, id: pageId},
        at
      }
    }

    case 'pages/page_markForDeletion':
      return {kind: 'pageDelete', pageId: payload, at}

    case 'site/updateSiteMetadata':
      return {kind: 'siteMetadata', value: payload, at}

    case 'widget/writeData': {
      // The reducer minted an id when the payload had none, and the node it
      // pushed is the last one. Sending that node rather than the payload is
      // what makes the agent write the widget under the id this browser is
      // already showing.
      const nodes = stateAfter?.widget?.nodes || []
      const written = payload.id
        ? nodes.find((node: any) => node.id === payload.id)
        : nodes[nodes.length - 1]

      return {
        kind: 'widgetWrite',
        value: written
          ? {...written, isCreate: payload.isCreate}
          : {...payload},
        at
      }
    }

    default:
      return null
  }
}

/**
 * The actions the recorder must not see. `hydrateFromRemote` is the poller's
 * own writing and recording it would send the remote draft straight back to
 * the agent as a change; `discardAllChanges` is handled by `RESET_STATE`,
 * which clears the outbox with everything else.
 */
const isRemoteWrite = (type: string) =>
  type.endsWith('/hydrateFromRemote') || type.endsWith('/discardAllChanges')

export default (config: AgentConfig) => {
  /**
   * The middleware only appends to the store. It never sends, so a save can
   * never make a dispatch throw, which is why the flusher lives outside it.
   */
  const recordMiddleware = (store: any) => (next: any) => (action: any) => {
    // The state before the reducer, because a write of the media catalogue is
    // recorded as the difference from the value it replaced. Reading it after
    // would diff the new value against itself.
    const stateBefore =
      action?.type === 'pages/field_write' ? store.getState() : undefined

    const result = next(action)

    if (!action || typeof action.type !== 'string') return result
    if (isRemoteWrite(action.type)) return result

    try {
      const change = recordAction(action, store.getState(), stateBefore)

      if (change) {
        store.dispatch(remoteActions.record(change))
      }
    } catch (error) {
      // A change that cannot be recorded is a change that will not be
      // shared, which is bad, but it is not a reason to lose the edit the
      // user just made in their own browser.
      console.error('jaen agent: could not record an action', error)
    }

    return result
  }

  const connect = (store: Store) => {
    let flushTimer: ReturnType<typeof setTimeout> | undefined
    let flushIsImmediate = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let pollTimer: ReturnType<typeof setInterval> | undefined
    let pollingEvery: number | undefined
    let inFlight = false
    let failures = 0
    let stopped = false

    const state = () => store.getState() as any

    const clearFlush = () => {
      if (flushTimer) clearTimeout(flushTimer)
      flushTimer = undefined
      flushIsImmediate = false
    }

    const scheduleRetry = () => {
      if (retryTimer) clearTimeout(retryTimer)

      const seconds =
        RETRY_SECONDS[Math.min(failures, RETRY_SECONDS.length - 1)] || 30

      retryTimer = setTimeout(() => {
        retryTimer = undefined
        void flush()
      }, seconds * 1000)
    }

    const flush = async (): Promise<void> => {
      if (stopped || inFlight) return

      const remote = state().remote
      const batch = remote.outbox.slice(0, CALL_LIMIT)

      if (batch.length === 0) return

      clearFlush()
      inFlight = true
      store.dispatch(remoteActions.saveStarted())

      const ids = batch.map((entry: any) => entry.id)
      const changes = batch.map((entry: any) => entry.change)

      try {
        const answer = await saveChanges(config, changes, remote.headSha)

        failures = 0

        store.dispatch(
          remoteActions.saveSucceeded({
            ids,
            headSha: answer.headSha,
            blobSha: answer.blobSha,
            savedAt: answer.savedAt || new Date().toISOString(),
            commitUrl: answer.commitUrl,
            overwrote: answer.overwrote
          })
        )
      } catch (error) {
        failures += 1

        store.dispatch(
          remoteActions.saveFailed({
            offline: error instanceof AgentOfflineError,
            message: (error as Error).message
          })
        )

        scheduleRetry()
      } finally {
        inFlight = false
      }

      // The recorder kept appending while the call was in flight, and a batch
      // larger than the call limit is sent in pieces.
      if (
        !stopped &&
        (state().remote.outbox.length || 0) > 0 &&
        failures === 0
      ) {
        scheduleFlush(0)
      }
    }

    const scheduleFlush = (delay: number) => {
      // A keystroke moves its own deadline to the last keystroke, which is
      // what a debounce is, but it must never move a flush that was asked for
      // at once: a picture recorded and then a letter typed would otherwise
      // put the picture 800 ms behind the letter.
      if (delay > 0 && flushTimer && flushIsImmediate) return

      if (flushTimer) clearTimeout(flushTimer)

      flushIsImmediate = delay === 0
      flushTimer = setTimeout(() => {
        flushTimer = undefined
        flushIsImmediate = false
        void flush()
      }, delay)
    }

    /**
     * A poll that found a new head. The remote document is the base and this
     * browser's unsent changes are folded back on top of it, so a local edit
     * that has not reached the agent yet is never overwritten by the answer
     * that does not contain it.
     */
    const hydrate = (
      remoteState: JaenDraftState,
      headSha: string,
      blobSha?: string,
      authors?: any
    ) => {
      const outbox = state().remote.outbox as Array<{change: JaenChange}>

      const merged = applyChanges(
        remoteState,
        outbox.map(entry => entry.change)
      )

      store.dispatch(pageActions.hydrateFromRemote({nodes: merged.pages}))
      store.dispatch(siteActions.hydrateFromRemote(merged.site.siteMetadata))
      store.dispatch(widgetActions.hydrateFromRemote(merged.widgets))
      store.dispatch(
        remoteActions.remoteHydrated({
          headSha,
          blobSha,
          authors: authors || undefined
        })
      )
    }

    const poll = async (): Promise<void> => {
      if (stopped || inFlight) return

      const remote = state().remote

      try {
        const answer = await fetchDraft(config, remote.headSha)

        if (!answer.changed) {
          if (answer.headSha && answer.headSha !== remote.headSha) {
            store.dispatch(remoteActions.headSeen(answer.headSha))
          }

          return
        }

        hydrate(
          draftDataToState(answer.data),
          answer.headSha,
          answer.blobSha,
          answer.authors
        )
      } catch (error) {
        // A poll that fails changes nothing. The save state belongs to the
        // flusher, and saying "offline" because a read timed out while every
        // write went through would be a lie.
        console.debug('jaen agent: poll failed', error)
      }
    }

    const shouldPoll = () => {
      const s = state()
      return Boolean(s.remote?.active || s.status?.isEditing)
    }

    const isVisible = () =>
      typeof document === 'undefined' || document.visibilityState !== 'hidden'

    /**
     * The interval, adaptive. A poll whose `sinceSha` is still the head costs
     * the agent one KV read and answers `changed: false` with no body, so the
     * interval is not a load question, it is the tail of the ten second
     * acceptance: it decides how long the other editor's CMS waits before it
     * asks about a change that is already committed.
     *
     * Fast while somebody is looking at this tab, and while this browser's
     * own save is still out or waiting in the outbox, because that is exactly
     * when a second head is about to appear. Slow when the tab is hidden,
     * where nobody can read the answer anyway and the poll only exists so
     * that coming back is not a blank wait.
     */
    const wantedPollMs = () =>
      isVisible() || inFlight || (state().remote?.outbox?.length || 0) > 0
        ? config.activePollMs
        : config.pollMs

    const syncPolling = () => {
      if (!shouldPoll()) {
        if (pollTimer) clearInterval(pollTimer)
        pollTimer = undefined
        pollingEvery = undefined
        return
      }

      const every = wantedPollMs()

      if (pollTimer && pollingEvery === every) return

      const isFirst = !pollTimer

      if (pollTimer) clearInterval(pollTimer)

      pollingEvery = every
      pollTimer = setInterval(() => void poll(), every)

      if (isFirst) void poll()
    }

    /**
     * Coming back to the tab asks at once rather than waiting out the idle
     * interval that was running while it was hidden.
     */
    const onVisibilityChange = () => {
      syncPolling()

      if (isVisible()) void poll()
    }

    store.dispatch(remoteActions.resume())

    let lastOutboxLength = (state().remote?.outbox || []).length

    const unsubscribe = store.subscribe(() => {
      const remote = state().remote

      if (!remote) return

      const length = remote.outbox.length

      if (length > lastOutboxLength) {
        // A typed field waits for the quiet, twenty queued changes or not, so
        // that a sentence is one commit rather than one contents API round
        // trip per character and a history nobody can read. Anything else is
        // one gesture and goes at once: an uploaded picture reaches the other
        // editor a debounce sooner for it.
        const latest = remote.outbox[length - 1]?.change

        scheduleFlush(
          length >= MAX_BATCH || !latest || !isKeystroke(latest)
            ? 0
            : config.debounceMs
        )
      }

      lastOutboxLength = length

      syncPolling()
    })

    // Anything left in the outbox from the last visit is sent as soon as the
    // store is up: that is the offline queue draining, and it has already
    // waited long enough without waiting out a debounce as well.
    if (lastOutboxLength > 0) {
      scheduleFlush(0)
    }

    const onOnline = () => {
      failures = 0
      scheduleFlush(0)
      void poll()
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('online', onOnline)
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange)
    }

    syncPolling()

    return () => {
      stopped = true
      unsubscribe()
      clearFlush()
      if (retryTimer) clearTimeout(retryTimer)
      if (pollTimer) clearInterval(pollTimer)
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', onOnline)
      }

      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange)
      }
    }
  }

  return {recordMiddleware, connect, draftStateToData}
}

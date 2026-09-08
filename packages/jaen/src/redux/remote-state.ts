/**
 * The shared draft's client, beside `persist-state.ts` and shaped like it.
 *
 * `persist-state` writes the whole store to `localStorage` after every action,
 * where it stays until the browser that wrote it publishes. That is the flaw:
 * a change exists in exactly one browser. This file adds the second writer.
 * Every change is recorded, batched and sent to the jaen agent, which writes
 * it into the site's Durable Object and bumps that object's revision; every
 * other open CMS is pushed the new revision over a WebSocket and asks for the
 * delta. `localStorage` keeps its two jobs, the per browser copy and the
 * offline queue, and it keeps them for free because the outbox is a slice of
 * the same store `persist-state` already writes.
 *
 * **A save is not a commit.** Until 2026-09-08 it was, and this file spoke of
 * a `headSha` and a `blobSha` because the shared draft was the site's
 * repository. `docs/architecture/draft-state.md` separates the two lifecycles:
 * a draft is mutable, shared and worth hours, and it lives in the object; a
 * migration is immutable and permanent, and it is written by a publish alone.
 * So the whole of this client's model of "where the draft is" is one number,
 * `revision`, and nothing here writes a repository.
 *
 * **The socket, and the poll under it.** The object pushes revisions and never
 * content, which is `subscribe(site)` of that design's four operation
 * interface. A frame is a number this browser did not have, and what it makes
 * this client do is ask the same `draft` query the poll asks, so there is one
 * read path, one authorisation path and one place where the unsent outbox is
 * folded back on top of the answer. The poll is never switched off, only
 * slowed to a safety interval, because an open socket that has quietly stopped
 * delivering frames looks exactly like a site nobody is editing.
 *
 * `RemoteState(config)` returns `{recordMiddleware, connect}`. `index.tsx`
 * adds the middleware and calls `connect` only when the site was built with the
 * `agent` plugin option, so a site without it behaves exactly as before.
 */
import {Store} from 'redux'

import {
  AgentConfig,
  AgentOfflineError,
  DraftAnswer,
  DraftDelta,
  fetchDraft,
  openDraftSocket,
  saveChanges
} from '../clients/agent'
import {
  applyChanges,
  draftStateToData,
  emptyDraftState,
  JaenChange,
  JaenDraftState,
  MEDIA_FIELD_TYPE,
  recordDifference
} from './apply-change'
import {setLeaveOutboxFlush} from '../utils/on-leave'
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
 * The longest the oldest change in the outbox is allowed to wait, whatever the
 * quiet window would do with it.
 *
 * The window below moves its deadline to the last change, which is what a
 * debounce is, and a person who writes a field every second would otherwise
 * push it in front of them until `MAX_BATCH` cut it off twenty changes later.
 * `draft-state.md` measured the warm path of a text change reaching the second
 * editor at 6.25 s against a ten second acceptance, so this is the room that
 * was left: 2500 ms of waiting puts the worst case at about 8.75 s and still
 * inside it. See docs/architecture/editing-performance.md, "The window".
 */
const MAX_WAIT_MS = 2500

/**
 * How often the poll still runs while the object's socket is up.
 *
 * The socket is what makes a change arrive in under two seconds, and this is
 * the floor under it: a socket that is open and silent, which is what a proxy
 * that keeps the connection and drops the frames looks like, is caught within
 * half a minute instead of never. See `wantedPollMs`.
 */
const SOCKET_SAFETY_POLL_MS = 30000

/**
 * Whether a recorded change is sent without waiting for the quiet window.
 *
 * Everything a person does with one gesture goes at once, because waiting is
 * only ever waiting for a second change that arrives from the same hand, and
 * a gesture has no second change to wait for: a picture is picked once, a
 * media node is uploaded once, a section is added, moved or removed by a
 * click, a page is created, deleted or moved by a click, a widget and the site
 * metadata are written by a form that has its own button.
 *
 * What waits is a field a person types into, and that is every `fieldWrite`
 * and `fieldMerge` that is not the media catalogue. Until 2026-09-08 only a
 * field whose type looked like an MDX editor waited, on the reading that
 * `Field.Text` writes once on blur and therefore has nothing to batch. It does
 * write once on blur, and a person still walks through four fields of a card
 * in a few seconds, so that reading bought four commits, four round trips and
 * four whole-store writes where one would do.
 */
const goesAtOnce = (change: JaenChange): boolean => {
  if (change.kind !== 'fieldWrite' && change.kind !== 'fieldMerge') {
    return true
  }

  // The gallery's own write. It is a picture that was uploaded, not a
  // sentence, and the other editor's library is the one thing the budget in
  // draft-state.md measures a picture against.
  return change.fieldType === MEDIA_FIELD_TYPE
}

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

/**
 * The object's delta, folded onto a draft.
 *
 * Four kinds of key, and each one is merged the way the object splits it.
 *
 * A page is carried whole and replaces the page of that id, because the object
 * stores a page as one key and a field level delta of a page would be a second
 * merge algorithm beside the build's.
 *
 * The catalogue is not, because it is 118 KB on booklimo and one key per node
 * is the entire reason a picture is cheap to save. Its nodes are merged into
 * the field `mediaField` names, one id at a time, and `removedMedia` deletes.
 * That field is written whole by the gallery, so a delta that carried it whole
 * would make every picture added anywhere a full catalogue on the wire.
 *
 * The site metadata is present only when it changed, so `null` means "leave
 * it" and not "empty it": emptying a site's metadata because a text field was
 * written is exactly the kind of loss this file is answerable for.
 *
 * Widgets are merged by id rather than replaced, for the same reason as a
 * page. Whether the object sends all of them or only the changed ones is not
 * settled in its interface, and merging by id is the reading that is right
 * either way.
 */
const applyDelta = (
  state: JaenDraftState,
  delta: DraftDelta | null | undefined
): JaenDraftState => {
  if (!delta) return state

  for (const [pageId, node] of Object.entries(delta.pages || {})) {
    if (!pageId || !node) continue
    state.pages[pageId] = node
  }

  const field = delta.mediaField
  const media = delta.media || {}
  const removed = delta.removedMedia || []

  if (field && (Object.keys(media).length > 0 || removed.length > 0)) {
    const page: any = (state.pages[field.pageId] = {
      ...(state.pages[field.pageId] || {id: field.pageId})
    } as any)

    page.jaenFields = {...(page.jaenFields || {})}
    page.jaenFields[field.fieldType] = {
      ...(page.jaenFields[field.fieldType] || {})
    }

    const existing =
      page.jaenFields[field.fieldType][field.fieldName]?.value || {}

    const value: Record<string, unknown> = {...existing}

    for (const [id, node] of Object.entries(media)) {
      if (!id) continue
      value[id] = node
    }

    for (const id of removed) {
      delete value[id]
    }

    page.jaenFields[field.fieldType][field.fieldName] = {
      ...(page.jaenFields[field.fieldType][field.fieldName] || {}),
      value
    }
  }

  if (delta.site) {
    state.site = {siteMetadata: delta.site.siteMetadata || {}}
  }

  for (const widget of delta.widgets || []) {
    if (!widget) continue

    const at = state.widgets.findIndex(
      (entry: any) => entry && entry.id && entry.id === (widget as any).id
    )

    if (at >= 0) {
      state.widgets[at] = widget
    } else {
      state.widgets.push(widget)
    }
  }

  return state
}

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
    /** True while the object's socket is open. Drives `wantedPollMs`. */
    let socketLive = false
    let closeSocket: (() => void) | undefined
    /** When the outbox last went from empty to holding something. */
    let queuedSince: number | undefined

    const state = () => store.getState() as any

    const clearFlush = () => {
      if (flushTimer) clearTimeout(flushTimer)
      flushTimer = undefined
      flushIsImmediate = false
    }

    const scheduleRetry = () => {
      if (retryTimer) clearTimeout(retryTimer)

      // `failures` has already been incremented by the catch that called
      // this, so the first retry has to read index 0 and not index 1. It read
      // index 1 until 2026-09-08, which made the first retry five seconds
      // where this file, editing-performance.md and draft-state.md all say
      // two. Nothing was lost by it and the queue simply waited longer than
      // every document claimed.
      const seconds =
        RETRY_SECONDS[
          Math.min(Math.max(failures - 1, 0), RETRY_SECONDS.length - 1)
        ] || 30

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
        const answer = await saveChanges(config, changes, remote.revision)

        failures = 0

        store.dispatch(
          remoteActions.saveSucceeded({
            ids,
            revision: answer.revision,
            savedAt: answer.savedAt || new Date().toISOString(),
            overwrote: answer.overwrote
          })
        )

        // The object had moved past the base this call carried, so it folded
        // the write onto the newer draft and this browser's copy is behind by
        // definition: it does not hold whatever the other editor wrote in
        // between. Asking at once rather than waiting for the next interval is
        // the difference between seeing the other editor's field and looking
        // at a value that is no longer the draft's.
        if (answer.rebased) {
          void poll()
        }
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
      // A field write moves its own deadline to the last field write, which is
      // what a debounce is, but it must never move a flush that was asked for
      // at once: a picture recorded and then a letter typed would otherwise
      // put the picture a quiet window behind the letter.
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
     * The quiet window a field write waits out, cut short so that the oldest
     * change in the outbox never waits longer than `MAX_WAIT_MS`. Without the
     * clamp a person who writes a field just often enough resets the deadline
     * for ever and the first thing they typed sits in the browser.
     */
    const quietDelay = (): number => {
      const window = config.debounceMs

      if (queuedSince === undefined) return window

      const left = queuedSince + MAX_WAIT_MS - Date.now()

      return Math.max(0, Math.min(window, left))
    }

    /**
     * A read that came back with something. It is the one place the remote
     * answer meets this browser's unsent changes, whether the read was asked
     * for by the poll, by a socket frame or by a rebased save.
     *
     * The order is the safety, and it is the same order it has always been:
     * the remote answer is the base, this browser's outbox is applied on top,
     * and only then is the store hydrated. A change that has not reached the
     * object yet is therefore never overwritten by an answer that does not
     * contain it, which is the invariant this whole file exists for.
     *
     * What changed with the object is that the base is not always the whole
     * draft. `full` says the answer replaces this browser's copy, which is
     * what a reader with no revision, a revision older than the object's
     * pruned window, or a revision the object has never reached gets, and the
     * last of those is what a lost object looks like from the outside. A
     * `delta` merges onto what is already here.
     */
    const hydrate = (answer: DraftAnswer) => {
      const current = state()

      const base: JaenDraftState = answer.full
        ? emptyDraftState()
        : {
            pages: {...(current.page?.pages?.nodes || {})},
            site: {
              siteMetadata: {...(current.site?.siteMetadata || {})}
            },
            widgets: [...(current.widget?.nodes || [])]
          }

      applyDelta(base, answer.delta)

      const outbox = current.remote.outbox as Array<{change: JaenChange}>

      const merged = applyChanges(
        base,
        outbox.map(entry => entry.change)
      )

      store.dispatch(pageActions.hydrateFromRemote({nodes: merged.pages}))
      store.dispatch(siteActions.hydrateFromRemote(merged.site.siteMetadata))
      store.dispatch(widgetActions.hydrateFromRemote(merged.widgets))
      store.dispatch(
        remoteActions.remoteHydrated({
          revision: answer.revision,
          publishedRevision: answer.publishedRevision,
          authors: answer.delta?.authors || undefined,
          // A delta carries only the fields it touched, so its authors are
          // merged onto what is known; a full answer is the whole map and
          // replaces it, which is also how a field whose author was pruned
          // stops being attributed to somebody who no longer wrote it.
          replaceAuthors: Boolean(answer.full)
        })
      )
    }

    const poll = async (): Promise<void> => {
      if (stopped || inFlight) return

      const remote = state().remote

      try {
        const answer = await fetchDraft(config, remote.revision)

        if (!answer.changed) {
          if (
            typeof answer.revision === 'number' &&
            answer.revision !== remote.revision
          ) {
            store.dispatch(
              remoteActions.revisionSeen({
                revision: answer.revision,
                publishedRevision: answer.publishedRevision
              })
            )
          }

          return
        }

        // The object went backwards, which a monotonic revision cannot do
        // while the object lives. What it means is that the object this
        // browser was talking to is gone and a new one answered in its place,
        // at a revision it has not reached yet. Its answer is older than what
        // is on this screen, so applying it would take an edit away from the
        // person who made it, and that is the one thing this file is not
        // allowed to do.
        //
        // So the answer is skipped and the object's revision is adopted, which
        // keeps the next save's base valid and lets everything after the
        // restart arrive normally. What is not recovered here is what the
        // other editors had written into the object that died: nothing in a
        // browser holds that, and the design's answer to it is the snapshot
        // the object writes outside itself. See docs/architecture/draft-state.md.
        if (
          typeof remote.revision === 'number' &&
          typeof answer.revision === 'number' &&
          answer.revision < remote.revision
        ) {
          console.warn(
            `jaen agent: the draft went from revision ${remote.revision} back to ${answer.revision}, keeping what is in this browser`
          )

          store.dispatch(
            remoteActions.objectRestarted({
              revision: answer.revision,
              publishedRevision: answer.publishedRevision
            })
          )

          return
        }

        hydrate(answer)
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
     * The interval, adaptive. A poll whose `sinceRevision` is still the
     * object's revision costs one read of one key and answers
     * `changed: false` with no body, so the interval is not a load question,
     * it is the tail of the two second acceptance: it decides how long the
     * other editor's CMS waits before it asks about a change the object
     * already holds.
     *
     * Three speeds now, where there were two.
     *
     * `SOCKET_SAFETY_POLL_MS` is the one the socket added, and it is the one
     * worth arguing about. With a socket up the poll is not how a change
     * arrives, so it could be switched off entirely and the CMS would be
     * faster and cheaper. It is not switched off, because an open socket that
     * has stopped delivering frames is indistinguishable from a site nobody is
     * editing, and the failure it produces is the one this CMS is sold on not
     * having: an editor looking at a stale field for as long as they keep the
     * tab open. Thirty seconds of a `changed: false` answer is what that costs,
     * and where the plan and safety disagree, safety wins.
     *
     * Without a socket it is the old pair: fast while somebody is looking at
     * this tab, and while this browser's own save is still out or waiting in
     * the outbox, because that is exactly when a second revision is about to
     * appear; slow when the tab is hidden, where nobody can read the answer
     * anyway and the poll only exists so that coming back is not a blank wait.
     */
    const wantedPollMs = () => {
      if (socketLive) {
        return SOCKET_SAFETY_POLL_MS
      }

      return isVisible() ||
        inFlight ||
        (state().remote?.outbox?.length || 0) > 0
        ? config.activePollMs
        : config.pollMs
    }

    /**
     * The socket lives exactly as long as the poll does, and for the same
     * reason: a visitor who never opens the CMS opens no connection, so a
     * public page costs the object nothing.
     */
    const syncSocket = () => {
      if (stopped || !shouldPoll()) {
        if (closeSocket) {
          closeSocket()
          closeSocket = undefined
        }

        if (socketLive) {
          socketLive = false
          store.dispatch(remoteActions.connectionChanged('poll'))
        }

        return
      }

      if (closeSocket) return

      closeSocket = openDraftSocket(config, {
        onRevision: (revision, publishedRevision) => {
          const remote = state().remote

          // A frame about a revision this browser already has is the object
          // telling it about its own save, which is every save it makes. The
          // read is skipped and the mark is moved, which is what keeps a busy
          // editor from asking for a delta after each of their own writes.
          if (
            typeof remote?.revision === 'number' &&
            revision <= remote.revision
          ) {
            if (typeof publishedRevision === 'number') {
              store.dispatch(
                remoteActions.revisionSeen({revision, publishedRevision})
              )
            }

            return
          }

          void poll()
        },
        onLive: live => {
          socketLive = live
          store.dispatch(
            remoteActions.connectionChanged(live ? 'socket' : 'poll')
          )
          syncPolling()

          // Coming up, and coming back after a drop, both ask once: whatever
          // happened while there was no socket is not in a frame anywhere.
          if (live) void poll()
        }
      })
    }

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
      syncSocket()

      if (isVisible()) {
        void poll()
        return
      }

      // The tab went away. Whatever is waiting out its quiet window is sent
      // now rather than when the person comes back, because they may not.
      // This is best effort and it is not what holds the invariant: the call
      // is a `fetch` with an `Authorization` header, so it cannot be a beacon,
      // and a browser is free to drop it. What holds the invariant is the
      // outbox being part of the persisted store, which `persist-state` writes
      // synchronously on exactly this event. See
      // docs/architecture/editing-performance.md, "The window".
      clearFlush()
      void flush()
    }

    /**
     * The page is being unloaded, or put into the back/forward cache. Same
     * best effort send, and the pair `visibilitychange` plus `pagehide` is
     * what iOS Safari actually delivers.
     */
    const onPageHide = () => {
      clearFlush()
      void flush()
    }

    store.dispatch(remoteActions.resume())

    let lastOutboxLength = (state().remote?.outbox || []).length

    const unsubscribe = store.subscribe(() => {
      const remote = state().remote

      if (!remote) return

      const length = remote.outbox.length

      if (length === 0) {
        queuedSince = undefined
      } else if (queuedSince === undefined) {
        queuedSince = Date.now()
      }

      if (length > lastOutboxLength) {
        // A field a person typed into waits out the quiet window, so that
        // walking through the fields of a card is one commit rather than one
        // commit, one round trip and one whole-store write per field. The
        // batch size still wins over the window: twenty queued changes are
        // sent whatever they are, which is the bound on how far behind the
        // repository a fast hand can put itself.
        const latest = remote.outbox[length - 1]?.change

        scheduleFlush(
          length >= MAX_BATCH || !latest || goesAtOnce(latest)
            ? 0
            : quietDelay()
        )
      }

      lastOutboxLength = length

      syncPolling()
      syncSocket()
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
      // The socket died with the network. Its own backoff would get there in
      // the end; this is the browser saying the wait is over.
      syncSocket()
    }

    // Step 3 of the pass out of the page, `utils/on-leave.ts`. The two
    // listeners below stay: they are what this file has always done and they
    // cover an exit nothing else is registered for. What the pass adds is the
    // order, so that a field's debounce has become a store change and the
    // store has been written before this best effort send is attempted, and
    // so that the send carries the change the person just typed rather than
    // the one before it.
    setLeaveOutboxFlush(() => {
      clearFlush()
      void flush()
    })

    if (typeof window !== 'undefined') {
      window.addEventListener('online', onOnline)
      window.addEventListener('pagehide', onPageHide)
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange)
    }

    syncPolling()
    syncSocket()

    return () => {
      stopped = true
      setLeaveOutboxFlush(undefined)
      unsubscribe()
      clearFlush()
      if (retryTimer) clearTimeout(retryTimer)
      if (pollTimer) clearInterval(pollTimer)
      if (closeSocket) {
        closeSocket()
        closeSocket = undefined
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', onOnline)
        window.removeEventListener('pagehide', onPageHide)
      }

      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange)
      }
    }
  }

  return {recordMiddleware, connect, draftStateToData}
}

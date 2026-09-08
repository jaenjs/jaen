/**
 * The persistence path of a jaen field, driven in node.
 *
 * Written by `tests/09-editing-latency.ipynb` and `tests/10-draft-persistence.ipynb`,
 * which is why it is not tracked: the notebook that runs it is its source.
 *
 * It imports `packages/jaen/src/redux` itself, the real store with the real
 * `persist-state`, the real recorder and the real flusher, so what is measured
 * here is the code the browser runs rather than a model of it. The only things
 * replaced are the browser globals that module needs, and they are installed by
 * `editing-shim`, which is imported first on purpose.
 *
 * One scenario per process, because the store is a module singleton and a
 * second scenario in the same process would inherit the first one's state.
 * `JAEN_HARNESS_STORE` names a file standing in for the browser's storage area,
 * so a scenario can be continued by a second process, which is what a reload is.
 */
import {
  agentObject,
  calls,
  fakeDocument,
  fire,
  flushToDisk,
  pushRevision,
  setNetwork,
  sockets,
  storage,
  writes
} from './editing-shim'

import * as fs from 'fs'

// ---------------------------------------------------------------------------
// the real store
// ---------------------------------------------------------------------------

import {store, resetState} from '../../packages/jaen/src/redux'
import {draftDataToState} from '../../packages/jaen/src/redux/apply-change'
import {actions as pageActions} from '../../packages/jaen/src/redux/slices/page'
import {actions as siteActions} from '../../packages/jaen/src/redux/slices/site'
import {actions as remoteActions} from '../../packages/jaen/src/redux/slices/remote'
import * as widgetActions from '../../packages/jaen/src/redux/slices/widget'

const PERSIST_KEY = 'jaenjs-state'

const HOME_PAGE = 'JaenPage /'
const MEDIA_PAGE = 'JaenPage /cms/media/'
const MEDIA_FIELD_TYPE = 'IMA:MEDIA_NODES'

/**
 * The fixture: one draft, out of one file.
 *
 * It used to be two, `booklimo.at/jaen-data/live.json` and `live-media.json`,
 * the agent's head as the first build of the shared draft kept it. The
 * transition of `docs/architecture/draft-state.md` deleted both, because a head
 * in `patches.txt` made every unfinished edit part of the published site. So
 * the fixture is now one file holding the draft the way the object's own
 * `snapshot(site)` answers it, `{pages, site, widgets}`, and `JAEN_HARNESS_DRAFT`
 * names it.
 *
 * The notebooks pass the sourced jaen data the transition kept beside the site,
 * which is the whole replayed chain and therefore a bigger and more honest
 * fixture than the head ever was: booklimo's ten pages and its 140 media nodes.
 * A `{message, createdAt, data}` migration is accepted as well and unwrapped,
 * so the file the transition uploaded works without being edited first.
 */
const readDraft = (): any => {
  const file = process.env.JAEN_HARNESS_DRAFT

  if (!file) {
    throw new Error('JAEN_HARNESS_DRAFT is required: the draft fixture')
  }

  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
  const data = parsed && parsed.data ? parsed.data : parsed

  return {
    pages: data.pages || [],
    site: data.site || {siteMetadata: {}},
    widgets: data.widgets || []
  }
}

/** The draft as the poller would hydrate it, straight off booklimo's own files. */
const hydrateBooklimo = () => {
  const state = draftDataToState(readDraft())

  store.dispatch(pageActions.hydrateFromRemote({nodes: state.pages as any}))
  store.dispatch(siteActions.hydrateFromRemote(state.site.siteMetadata))
  store.dispatch(widgetActions.hydrateFromRemote(state.widgets))
  // The object's revision this browser starts from. The stand in in
  // `editing-shim` starts at 0 as well, so a scenario that never writes gets
  // `changed: false` from its first read, which is the ordinary case.
  store.dispatch(remoteActions.revisionSeen({revision: 0}))
}

const fieldWrite = (value: string, fieldName = 'FleetTitle') =>
  store.dispatch(
    pageActions.field_write({
      pageId: HOME_PAGE,
      section: undefined,
      fieldType: 'IMA:TextField',
      fieldName,
      value,
      props: {id: fieldName}
    } as any)
  )

const persisted = (): any => {
  const raw = storage.getItem(PERSIST_KEY)
  return raw ? JSON.parse(raw) : null
}

const fieldValue = (state: any, fieldName = 'FleetTitle') =>
  state?.page?.pages?.nodes?.[HOME_PAGE]?.jaenFields?.['IMA:TextField']?.[
    fieldName
  ]?.value

const mediaNodes = (state: any) =>
  state?.page?.pages?.nodes?.[MEDIA_PAGE]?.jaenFields?.[MEDIA_FIELD_TYPE]
    ?.media_nodes?.value

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * The idle deadline of the asynchronous writer, plus room.
 *
 * `persist-state` defers the write into a `requestIdleCallback` with a 250 ms
 * timeout and falls back to a `setTimeout` of the same 250 ms where there is no
 * idle callback, which is every node run. So a scenario that reads the value
 * back out of storage has to wait that deadline out first: before change 1 the
 * write happened inside the dispatch and 20 ms was enough, after it a shorter
 * wait would be measuring the deadline rather than the payload. The two
 * scenarios that are about the deadline itself, `hiddenTab` and the immediate
 * read in it, do not use this.
 */
const PERSIST_DEADLINE_MS = 400

const emit = (payload: any) => {
  flushToDisk()
  process.stdout.write(JSON.stringify(payload, null, 1))
}

const quantile = (values: number[], q: number): number => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))
  return sorted[index]
}

// ---------------------------------------------------------------------------
// the scenarios
// ---------------------------------------------------------------------------

const scenarios: Record<string, () => Promise<any>> = {
  /**
   * What one dispatch costs the main thread, and what one blur costs.
   *
   * The clock is around `store.dispatch` itself, so it covers the reducers,
   * every subscriber and the storage write, which together are the block a
   * person feels. The writes the persister made inside the dispatch are
   * counted and their bytes read off the string that was handed to storage.
   */
  async bench() {
    const samples = Number(process.env.JAEN_HARNESS_SAMPLES || 40)

    hydrateBooklimo()

    const state0 = store.getState() as any
    const stateBytes = Buffer.byteLength(JSON.stringify(state0), 'utf8')

    // What the catalogue is of that, which is the whole of change 2 of the
    // plan: it is measured rather than assumed.
    const withoutCatalogue = JSON.parse(JSON.stringify(state0))
    delete withoutCatalogue.page.pages.nodes[MEDIA_PAGE]
    const bytesWithoutCatalogue = Buffer.byteLength(
      JSON.stringify(withoutCatalogue),
      'utf8'
    )

    // Every dispatch, timed. The wrapper sits on the store object itself, so
    // it sees the flusher's `saveStarted` and `saveSucceeded` as well as the
    // field write: they all go through `store.dispatch`. Only a dispatch at
    // depth zero is timed as a block, because the recorder's `remote/record`
    // runs inside the field write and its cost is already in that number.
    const log: Array<{
      type: string
      ms: number
      depth: number
      writes: number
    }> = []
    let depth = 0
    const realDispatch = store.dispatch.bind(store)

    ;(store as any).dispatch = (action: any) => {
      const writesBefore = writes.length
      depth += 1
      const started = performance.now()

      try {
        return realDispatch(action)
      } finally {
        const ms = performance.now() - started
        depth -= 1
        log.push({
          type: action?.type || 'unknown',
          ms,
          depth,
          writes: writes.length - writesBefore
        })
      }
    }

    const blurs: Array<{
      ms: number
      writes: number
      bytes: number
      dispatches: number
    }> = []
    const byType: Record<string, number[]> = {}

    for (let i = 0; i < samples; i += 1) {
      log.length = 0
      writes.length = 0

      fieldWrite(`harness ${i}`)

      // Wait for the flusher's round trip to be over, which is the rest of the
      // blur: `saveStarted`, the stubbed call, `saveSucceeded`.
      for (let waited = 0; waited < 200; waited += 5) {
        if (
          (store.getState() as any).remote.outbox.length === 0 &&
          log.length >= 4
        ) {
          break
        }
        await sleep(5)
      }

      // The write is deferred now, so the blur is not over when its last
      // dispatch returns: the coalesced write lands up to 250 ms later. Waiting
      // it out here is what keeps `writes` and `bytes` the cost of this blur
      // rather than of the one before it. Nothing dispatches in the wait (the
      // poller is idle and the outbox is empty), so `ms` is unaffected.
      await sleep(PERSIST_DEADLINE_MS)

      const top = log.filter(entry => entry.depth === 0)

      for (const entry of log) {
        ;(byType[entry.type] = byType[entry.type] || []).push(entry.ms)
      }

      blurs.push({
        // The main-thread block of one blur: the sum of the dispatches it
        // caused. The waiting between them is the network and is not felt.
        ms: top.reduce((sum, entry) => sum + entry.ms, 0),
        writes: writes.length,
        bytes: writes.reduce((sum, write) => sum + write.bytes, 0),
        dispatches: log.length
      })
    }

    ;(store as any).dispatch = realDispatch

    // The four legs of one save, decomposed. This is a second copy of what
    // `persist-state.saveState` does, not the function itself, because the
    // function has no seam between its steps. The sum is compared with the
    // measured whole above and the notebook reports both.
    const state = store.getState()
    const legs = {
      clone: [] as number[],
      walk: [] as number[],
      stringify: [] as number[],
      write: [] as number[],
      // What one write costs after change 1: one stringify with the replacer,
      // then the storage write of what it produced.
      single: [] as number[],
      singleWrite: [] as number[]
    }

    const removeLoadingAndError = (obj: Record<string, any>) => {
      const keysToRemove = ['isLoading', 'error']

      if (obj && typeof obj === 'object') {
        keysToRemove.forEach(key => {
          if (key in obj) delete obj[key]
        })

        Object.keys(obj).forEach(key => removeLoadingAndError(obj[key]))
      }
    }

    // The replacer of `persist-state` after change 1, copied for the same
    // reason the walk above is: the function itself has no seam between its
    // steps. `JAEN_HARNESS_DROP_CATALOGUE=0` measures it without change 2.
    const dropCatalogue = process.env.JAEN_HARNESS_DROP_CATALOGUE !== '0'
    const replacer = (key: string, value: unknown) => {
      if (key === 'isLoading' || key === 'error') return undefined
      if (dropCatalogue && key === MEDIA_FIELD_TYPE) return undefined
      return value
    }

    let singleBytes = 0

    for (let i = 0; i < samples; i += 1) {
      let started = performance.now()
      const serialSingle = JSON.stringify(state, replacer)
      legs.single.push(performance.now() - started)
      singleBytes = Buffer.byteLength(serialSingle, 'utf8')

      started = performance.now()
      storage.setItem('jaen-harness-leg', serialSingle)
      legs.singleWrite.push(performance.now() - started)

      started = performance.now()
      const clone = JSON.parse(JSON.stringify(state))
      legs.clone.push(performance.now() - started)

      started = performance.now()
      removeLoadingAndError(clone)
      legs.walk.push(performance.now() - started)

      started = performance.now()
      const serial = JSON.stringify(clone)
      legs.stringify.push(performance.now() - started)

      started = performance.now()
      storage.setItem('jaen-harness-leg', serial)
      legs.write.push(performance.now() - started)
    }

    const stat = (values: number[]) => ({
      median: quantile(values, 0.5),
      p95: quantile(values, 0.95),
      min: Math.min(...values),
      max: Math.max(...values),
      samples: values.length
    })

    return {
      scenario: 'bench',
      samples,
      node: process.version,
      stateBytes,
      bytesWithoutCatalogue,
      mediaNodeCount: Object.keys(mediaNodes(store.getState()) || {}).length,
      blur: {
        ms: stat(blurs.map(entry => entry.ms)),
        writes: stat(blurs.map(entry => entry.writes)),
        bytes: stat(blurs.map(entry => entry.bytes)),
        dispatches: stat(blurs.map(entry => entry.dispatches))
      },
      perAction: Object.fromEntries(
        Object.entries(byType).map(([type, values]) => [type, stat(values)])
      ),
      singleBytes,
      legs: {
        clone: stat(legs.clone),
        walk: stat(legs.walk),
        stringify: stat(legs.stringify),
        write: stat(legs.write),
        single: stat(legs.single),
        singleWrite: stat(legs.singleWrite)
      }
    }
  },

  /** What the persisted payload carries. */
  async payload() {
    hydrateBooklimo()

    // Offline on purpose: the outbox is the thing being looked for and a
    // successful save empties it within milliseconds.
    setNetwork('offline')
    fieldWrite('the payload check')

    await sleep(PERSIST_DEADLINE_MS)

    const raw = storage.getItem(PERSIST_KEY) || ''
    const state = persisted()

    return {
      scenario: 'payload',
      bytes: Buffer.byteLength(raw, 'utf8'),
      hasLocalEdit: fieldValue(state) === 'the payload check',
      localEdit: fieldValue(state),
      outboxLength: (state?.remote?.outbox || []).length,
      outboxKinds: (state?.remote?.outbox || []).map(
        (entry: any) => entry.change.kind
      ),
      mediaNodeCount: Object.keys(mediaNodes(state) || {}).length,
      catalogueBytes: Buffer.byteLength(
        JSON.stringify(mediaNodes(state) || {}),
        'utf8'
      ),
      keys: Object.keys(state || {})
    }
  },

  /** An edit, then the process ends. The next one reads it back. */
  async editThenExit() {
    hydrateBooklimo()
    fieldWrite(process.env.JAEN_HARNESS_VALUE || 'survives a reload')

    // The reload check is about the ordinary path: the edit is written by the
    // idle callback, nobody hides the tab and nobody closes it politely. The
    // synchronous path is `hiddenTab`.
    await sleep(PERSIST_DEADLINE_MS)

    return {
      scenario: 'editThenExit',
      wrote: fieldValue(store.getState()),
      writes: writes.length
    }
  },

  /** The second process: what the store came back with. */
  async readBack() {
    const state = store.getState()

    return {
      scenario: 'readBack',
      value: fieldValue(state),
      outboxLength: (state as any).remote?.outbox?.length ?? 0,
      mediaNodeCount: Object.keys(mediaNodes(state) || {}).length,
      saveState: (state as any).remote?.saveState
    }
  },

  /** Offline while editing, then the agent comes back. */
  async offlineDrain() {
    hydrateBooklimo()
    setNetwork('offline')

    fieldWrite('written while offline')

    await sleep(PERSIST_DEADLINE_MS)

    // Since change 3 a field write waits out the quiet window before it is
    // even attempted, so the store does not know it is offline until the
    // first flush has failed. The snapshot below is what the toolbar says
    // once it does know, and the backoff measured after it starts from the
    // failure rather than from the keystroke.
    for (let waited = 0; waited < 5000; waited += 50) {
      if ((store.getState() as any).remote.saveState === 'offline') break
      await sleep(50)
    }

    const whileOffline = {
      value: fieldValue(store.getState()),
      persistedValue: fieldValue(persisted()),
      outboxLength: (store.getState() as any).remote.outbox.length,
      saveState: (store.getState() as any).remote.saveState,
      saveCalls: calls.filter(call => call.query === 'save').length
    }

    const returnedAt = performance.now()
    setNetwork('ok')

    // No `online` event is fired here: this measures the client draining on
    // its own backoff, which is the case of a network that came back without
    // the browser noticing. `onlineEvent` is the other one.
    let drainedAfterMs = -1

    for (let waited = 0; waited < 12000; waited += 100) {
      if ((store.getState() as any).remote.outbox.length === 0) {
        drainedAfterMs = performance.now() - returnedAt
        break
      }
      await sleep(100)
    }

    return {
      scenario: 'offlineDrain',
      drainedAfterMs,
      whileOffline,
      afterReturn: {
        value: fieldValue(store.getState()),
        persistedValue: fieldValue(persisted()),
        outboxLength: (store.getState() as any).remote.outbox.length,
        saveState: (store.getState() as any).remote.saveState,
        saveCalls: calls.filter(call => call.query === 'save').length,
        changesSent: calls
          .filter(call => call.query === 'save')
          .map(call => call.changes.length)
      }
    }
  },

  /** Three field writes inside one quiet window: how many commits? */
  async quietWindow() {
    hydrateBooklimo()

    fieldWrite('one', 'FleetTitle')
    await sleep(120)
    fieldWrite('two', 'ServicesTitle')
    await sleep(120)
    fieldWrite('three', 'AboutTitle')

    await sleep(2500)

    const saves = calls.filter(call => call.query === 'save')

    return {
      scenario: 'quietWindow',
      saveCalls: saves.length,
      changesPerCall: saves.map(call => call.changes.length),
      values: {
        FleetTitle: fieldValue(store.getState(), 'FleetTitle'),
        ServicesTitle: fieldValue(store.getState(), 'ServicesTitle'),
        AboutTitle: fieldValue(store.getState(), 'AboutTitle')
      },
      outboxLength: (store.getState() as any).remote.outbox.length
    }
  },

  /**
   * A poll arriving while a change is still unsent. The agent is offline so
   * the outbox cannot drain, and the remote answer carries the field's old
   * value: the local edit must still be the one that is read back.
   */
  async pollMidEdit() {
    hydrateBooklimo()
    setNetwork('offline')

    fieldWrite('typed and not yet sent')
    await sleep(PERSIST_DEADLINE_MS)

    // What the poller does on a new head, taken from `remote-state.hydrate`:
    // the remote document is the base and the outbox is folded on top of it.
    const {applyChanges} = await import(
      '../../packages/jaen/src/redux/apply-change'
    )

    const remote = draftDataToState(readDraft())
    const outbox = (store.getState() as any).remote.outbox

    const merged = applyChanges(
      remote,
      outbox.map((entry: any) => entry.change)
    )

    store.dispatch(pageActions.hydrateFromRemote({nodes: merged.pages as any}))
    store.dispatch(siteActions.hydrateFromRemote(merged.site.siteMetadata))
    store.dispatch(widgetActions.hydrateFromRemote(merged.widgets))
    store.dispatch(remoteActions.remoteHydrated({revision: 1}))

    await sleep(PERSIST_DEADLINE_MS)

    return {
      scenario: 'pollMidEdit',
      value: fieldValue(store.getState()),
      persistedValue: fieldValue(persisted()),
      remoteValueBeforeMerge: fieldValue({
        page: {pages: {nodes: draftDataToState(readDraft()).pages}}
      }),
      outboxLength: (store.getState() as any).remote.outbox.length
    }
  },

  /** Discard: the outbox goes, the head and the authors stay. */
  async discard() {
    hydrateBooklimo()

    // A poll gave this browser the head and who wrote what, which is what
    // discard must not take away.
    store.dispatch(
      remoteActions.remoteHydrated({
        revision: 7,
        authors: {
          'JaenPage //IMA:TextField/FleetTitle': {
            sub: 'someone-else',
            name: 'The other editor',
            at: new Date().toISOString()
          }
        }
      })
    )

    // Offline, so the change is still in the outbox when discard is pressed.
    setNetwork('offline')
    fieldWrite('about to be discarded')

    await sleep(PERSIST_DEADLINE_MS)

    const before = store.getState() as any

    // Past the deadline on purpose: this asks what is in storage once the
    // discarded state has been written back, not merely that the key was
    // removed.
    resetState()

    await sleep(PERSIST_DEADLINE_MS)

    const after = store.getState() as any

    return {
      scenario: 'discard',
      before: {
        outboxLength: before.remote.outbox.length,
        revision: before.remote.revision,
        value: fieldValue(before)
      },
      after: {
        outboxLength: after.remote.outbox.length,
        revision: after.remote.revision,
        active: after.remote.active,
        authors: Object.keys(after.remote.authors || {}).length,
        // `?? null` on purpose: an undefined is dropped by JSON.stringify and
        // a missing key would read as a broken harness rather than as a
        // discarded value.
        value: fieldValue(after) ?? null,
        persistedValue: fieldValue(persisted()) ?? null
      }
    }
  },

  /** The network came back and the browser said so. */
  async onlineEvent() {
    hydrateBooklimo()
    setNetwork('offline')

    fieldWrite('written while offline')
    await sleep(PERSIST_DEADLINE_MS)

    const queued = (store.getState() as any).remote.outbox.length

    setNetwork('ok')
    const heard = fire('window', 'online')
    const firedAt = performance.now()

    let drainedAfterMs = -1

    for (let waited = 0; waited < 3000; waited += 25) {
      if ((store.getState() as any).remote.outbox.length === 0) {
        drainedAfterMs = performance.now() - firedAt
        break
      }
      await sleep(25)
    }

    // The drain empties the outbox in milliseconds and its `saveSucceeded`
    // owes a write, so storage is read after the deadline rather than in the
    // frame the loop broke out of.
    await sleep(PERSIST_DEADLINE_MS)

    return {
      scenario: 'onlineEvent',
      listeners: heard,
      queued,
      drainedAfterMs,
      value: fieldValue(store.getState()),
      persistedValue: fieldValue(persisted()),
      outboxLength: (store.getState() as any).remote.outbox.length,
      changesSent: calls
        .filter(call => call.query === 'save')
        .map(call => call.changes.map((change: any) => change.value))
    }
  },

  /**
   * The tab goes away. Two things are asked, and both by reading the value
   * back out of storage rather than by reading a flag: whether the edit is in
   * storage with no waiting at all once the tab is hidden, and whether it is
   * there within the idle deadline the plan gives the asynchronous writer.
   */
  async hiddenTab() {
    hydrateBooklimo()
    setNetwork('offline')

    fieldWrite('typed and then the tab went away')

    // No await at all: this is the frame the dispatch returned in. `?? null`
    // because an undefined is dropped by JSON.stringify and the notebook asks
    // this key by name: after change 1 there is nothing in storage yet, which
    // is the answer rather than a broken harness.
    const immediately = fieldValue(persisted()) ?? null

    ;(fakeDocument as any).visibilityState = 'hidden'
    const heard = fire('document', 'visibilitychange')

    const afterHidden = fieldValue(persisted())

    // The plan's asynchronous writer has a 250 ms idle timeout. Anything not
    // in storage by then is a change this browser could lose.
    await sleep(300)

    const afterIdleDeadline = fieldValue(persisted())

    return {
      scenario: 'hiddenTab',
      listeners: heard,
      immediately,
      afterHidden: afterHidden ?? null,
      afterIdleDeadline: afterIdleDeadline ?? null,
      writes: writes.length
    }
  },

  /**
   * The object was lost between two saves.
   *
   * The design's own worst case for the draft store, and the one the snapshot
   * backstop exists for. This asks the narrower question, which is the client's
   * to answer: when the object comes back at a revision below the one this
   * browser already had, is the edit the person made still on the screen and
   * still in storage, and does the next save go through.
   *
   * A revision is monotonic while its object lives, so a lower one is not a
   * race, it is a different object. The client skips that answer rather than
   * applying it, because the answer is older than the screen.
   */
  async objectRestart() {
    hydrateBooklimo()

    // The poller and the socket only run for a mounted CMS. Everything below
    // is about them, so the CMS is mounted.
    store.dispatch(remoteActions.setActive(true))

    fieldWrite('before the object went away', 'FleetTitle')

    // The first save, waited out and acknowledged.
    for (let waited = 0; waited < 5000; waited += 50) {
      if ((store.getState() as any).remote.outbox.length === 0) break
      await sleep(50)
    }

    const afterFirstSave = {
      revision: (store.getState() as any).remote.revision,
      value: fieldValue(store.getState(), 'FleetTitle'),
      objectRevision: agentObject.revision
    }

    // The object is lost and a new one answers in its place, at revision 0,
    // which is a fresh object that has never heard of this browser.
    agentObject.restartAt(0)

    // The next read is the one that matters.
    for (let waited = 0; waited < 4000; waited += 50) {
      if ((store.getState() as any).remote.objectRestartedAt) break
      await sleep(50)
    }

    const afterRestart = {
      objectRestartedAt: (store.getState() as any).remote.objectRestartedAt ?? null,
      revision: (store.getState() as any).remote.revision,
      value: fieldValue(store.getState(), 'FleetTitle'),
      persistedValue: fieldValue(persisted(), 'FleetTitle') ?? null
    }

    // And the second save, which has to be accepted by the new object.
    const savesBefore = agentObject.saves
    fieldWrite('after the object came back', 'FleetTitle')

    for (let waited = 0; waited < 6000; waited += 50) {
      if (
        (store.getState() as any).remote.outbox.length === 0 &&
        agentObject.saves > savesBefore
      ) {
        break
      }
      await sleep(50)
    }

    await sleep(PERSIST_DEADLINE_MS)

    return {
      scenario: 'objectRestart',
      afterFirstSave,
      afterRestart,
      afterSecondSave: {
        revision: (store.getState() as any).remote.revision,
        value: fieldValue(store.getState(), 'FleetTitle'),
        persistedValue: fieldValue(persisted(), 'FleetTitle') ?? null,
        outboxLength: (store.getState() as any).remote.outbox.length,
        saveState: (store.getState() as any).remote.saveState,
        objectSaves: agentObject.saves,
        objectRevision: agentObject.revision
      }
    }
  },

  /**
   * The socket is refused and the poll carries everything.
   *
   * `draft-state.md` keeps the poll as the fallback for a browser whose socket
   * is refused, and this is that browser: the agent answers `subscribe` with a
   * validation error, which is what an agent that does not have the verb yet
   * answers, and every open CMS in that state is a poll and nothing else.
   *
   * What is asserted is not that a flag says `poll`. It is that the other
   * editor's field arrives anyway, read back off this browser's own store.
   */
  async socketRefused() {
    agentObject.socket = 'refused'

    hydrateBooklimo()
    store.dispatch(remoteActions.setActive(true))

    // Let the client try, fail and settle into the poll.
    await sleep(400)

    const settled = {
      connection: (store.getState() as any).remote.connection,
      subscribeCalls: calls.filter(call => call.query === 'subscribe').length,
      socketsOpened: sockets.length
    }

    // The second editor writes a field into the object. Nothing pushes it.
    agentObject.write(
      {
        'JaenPage /': {
          id: 'JaenPage /',
          jaenFields: {
            'IMA:TextField': {
              FleetTitle: {value: 'written by the other editor'}
            }
          }
        }
      },
      {
        'JaenPage //IMA:TextField/FleetTitle': {
          sub: 'someone-else',
          name: 'The other editor',
          at: new Date().toISOString()
        }
      }
    )

    const wroteAt = performance.now()
    let arrivedAfterMs = -1

    for (let waited = 0; waited < 8000; waited += 25) {
      if (
        fieldValue(store.getState(), 'FleetTitle') ===
        'written by the other editor'
      ) {
        arrivedAfterMs = performance.now() - wroteAt
        break
      }
      await sleep(25)
    }

    await sleep(PERSIST_DEADLINE_MS)

    return {
      scenario: 'socketRefused',
      settled,
      arrivedAfterMs,
      value: fieldValue(store.getState(), 'FleetTitle'),
      persistedValue: fieldValue(persisted(), 'FleetTitle') ?? null,
      connection: (store.getState() as any).remote.connection,
      revision: (store.getState() as any).remote.revision,
      authors: Object.keys((store.getState() as any).remote.authors || {}),
      draftCalls: calls.filter(call => call.query === 'draft').length
    }
  },

  /**
   * The socket carries it, which is the path the poll is the fallback for.
   *
   * The frame is a revision and never content, so what is measured is the
   * whole round: the object pushes a number, the client asks for the delta and
   * the other editor's field is on this screen.
   */
  async socketCarries() {
    hydrateBooklimo()
    store.dispatch(remoteActions.setActive(true))

    for (let waited = 0; waited < 2000; waited += 25) {
      if ((store.getState() as any).remote.connection === 'socket') break
      await sleep(25)
    }

    const up = {
      connection: (store.getState() as any).remote.connection,
      socketsOpened: sockets.length,
      protocols: sockets[0]?.protocols || [],
      url: sockets[0]?.url || null,
      tickets: agentObject.tickets.length
    }

    const draftCallsBefore = calls.filter(call => call.query === 'draft').length

    const revision = agentObject.write({
      'JaenPage /': {
        id: 'JaenPage /',
        jaenFields: {
          'IMA:TextField': {ServicesTitle: {value: 'pushed over the socket'}}
        }
      }
    })

    const pushedTo = pushRevision(revision)
    const pushedAt = performance.now()

    let arrivedAfterMs = -1

    for (let waited = 0; waited < 4000; waited += 10) {
      if (
        fieldValue(store.getState(), 'ServicesTitle') ===
        'pushed over the socket'
      ) {
        arrivedAfterMs = performance.now() - pushedAt
        break
      }
      await sleep(10)
    }

    return {
      scenario: 'socketCarries',
      up,
      pushedTo,
      arrivedAfterMs,
      value: fieldValue(store.getState(), 'ServicesTitle'),
      revision: (store.getState() as any).remote.revision,
      draftCallsAfterFrame:
        calls.filter(call => call.query === 'draft').length - draftCallsBefore
    }
  },

  /**
   * Two editors racing on one field.
   *
   * The other editor writes the field into the object first, so this browser's
   * save carries a base the object has already moved past. The object folds it
   * on rather than refusing it, which is what makes last write win here, and
   * answers `overwrote` so the CMS can say what the race cost.
   *
   * Three things are asked, and none of them is a flag: this browser's own
   * value is the one that stands, because it wrote last; the field it took is
   * named; and a read follows the rebase at once rather than at the next
   * interval, because a rebased browser holds a copy that is behind by
   * definition.
   */
  async twoEditorsRace() {
    hydrateBooklimo()
    store.dispatch(remoteActions.setActive(true))

    // The race is inside the quiet window, which is where a race actually
    // happens: this browser types, and before its batch is sent the other
    // editor's write reaches the object. The socket is refused and the poll
    // is set slow by the notebook (`JAEN_HARNESS_POLL_MS`), because a poll
    // faster than the window would read the other editor's value first and
    // there would be nothing to race.
    agentObject.socket = 'refused'
    await sleep(200)

    const base = (store.getState() as any).remote.revision

    fieldWrite('and this browser was second', 'FleetTitle')

    await sleep(300)

    agentObject.write({
      'JaenPage /': {
        id: 'JaenPage /',
        jaenFields: {
          'IMA:TextField': {FleetTitle: {value: 'the other editor was first'}}
        }
      }
    })

    for (let waited = 0; waited < 8000; waited += 25) {
      if (
        (store.getState() as any).remote.outbox.length === 0 &&
        (store.getState() as any).remote.saveState === 'saved'
      ) {
        break
      }
      await sleep(25)
    }

    const rightAfterSave = {
      value: fieldValue(store.getState(), 'FleetTitle'),
      overwrote: ((store.getState() as any).remote.lastOverwrote || []).map(
        (entry: any) => entry.field
      ),
      revision: (store.getState() as any).remote.revision
    }

    const draftCallsAfterSave = calls.filter(
      call => call.query === 'draft'
    ).length

    // The read the rebase asks for lands within a moment, and it must not put
    // the other editor's value back on this screen: this browser wrote last
    // and the object holds its value.
    await sleep(500)
    await sleep(PERSIST_DEADLINE_MS)

    return {
      scenario: 'twoEditorsRace',
      baseSent: calls.find(call => call.query === 'save')?.baseRevision ?? null,
      baseHeld: base,
      rightAfterSave,
      draftCallsAfterSave,
      settled: {
        value: fieldValue(store.getState(), 'FleetTitle'),
        persistedValue: fieldValue(persisted(), 'FleetTitle') ?? null,
        revision: (store.getState() as any).remote.revision,
        outboxLength: (store.getState() as any).remote.outbox.length,
        saveState: (store.getState() as any).remote.saveState
      },
      objectRevision: agentObject.revision,
      objectSaves: agentObject.saves
    }
  },

  /** The escape: no agent option at all, localStorage as the only store. */
  async noAgent() {
    // The catalogue is put into the store first, because the escape is where
    // change 2 must not apply: without the agent nothing hands the catalogue
    // back, so dropping it from the payload would drop every picture the
    // browser holds and has not published. The count below is the proof.
    hydrateBooklimo()

    fieldWrite('saved without the agent')

    await sleep(PERSIST_DEADLINE_MS)

    const state = persisted()

    return {
      scenario: 'noAgent',
      agentConfigured: Boolean((globalThis as any).__JAEN_AGENT__),
      persistedValue: fieldValue(state),
      outboxLength: (state?.remote?.outbox || []).length,
      saveCalls: calls.filter(call => call.query === 'save').length,
      writes: writes.length,
      mediaNodeCount: Object.keys(mediaNodes(state) || {}).length,
      bytes: Buffer.byteLength(storage.getItem(PERSIST_KEY) || '', 'utf8')
    }
  }
}

const main = async () => {
  const name = process.argv[2]
  const scenario = scenarios[name]

  if (!scenario) {
    process.stderr.write(`unknown scenario ${name}\n`)
    process.exit(2)
    return
  }

  const answer = await scenario()

  emit(answer)
  // The flusher's timers and the poller's interval would keep the process up.
  process.exit(0)
}

void main()

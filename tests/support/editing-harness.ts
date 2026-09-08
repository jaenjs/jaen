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
  calls,
  fakeDocument,
  fire,
  flushToDisk,
  setNetwork,
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

const readDraft = (): any => {
  const live = JSON.parse(
    fs.readFileSync(process.env.JAEN_HARNESS_LIVE!, 'utf8')
  )
  const media = JSON.parse(
    fs.readFileSync(process.env.JAEN_HARNESS_MEDIA!, 'utf8')
  )

  const pages = [...(live.data.pages || [])]

  // The agent keeps the catalogue in a file of its own and the client sees one
  // draft, so the two are merged the way `draft` answers them.
  for (const page of media.data.pages || []) {
    const existing = pages.find((entry: any) => entry.id === page.id)

    if (existing) {
      existing.jaenFields = {
        ...(existing.jaenFields || {}),
        ...(page.jaenFields || {})
      }
    } else {
      pages.push(page)
    }
  }

  return {pages, site: live.data.site, widgets: live.data.widgets || []}
}

/** The draft as the poller would hydrate it, straight off booklimo's own files. */
const hydrateBooklimo = () => {
  const state = draftDataToState(readDraft())

  store.dispatch(pageActions.hydrateFromRemote({nodes: state.pages as any}))
  store.dispatch(siteActions.hydrateFromRemote(state.site.siteMetadata))
  store.dispatch(widgetActions.hydrateFromRemote(state.widgets))
  store.dispatch(remoteActions.headSeen('harness-head-0'))
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
      write: [] as number[]
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

    for (let i = 0; i < samples; i += 1) {
      let started = performance.now()
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
      legs: {
        clone: stat(legs.clone),
        walk: stat(legs.walk),
        stringify: stat(legs.stringify),
        write: stat(legs.write)
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

    await sleep(30)

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

    await sleep(20)

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

    await sleep(50)

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
    await sleep(30)

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
    store.dispatch(remoteActions.remoteHydrated({headSha: 'harness-head-new'}))

    await sleep(20)

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
        headSha: 'harness-head-poll',
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

    await sleep(30)

    const before = store.getState() as any

    resetState()

    await sleep(20)

    const after = store.getState() as any

    return {
      scenario: 'discard',
      before: {
        outboxLength: before.remote.outbox.length,
        headSha: before.remote.headSha,
        value: fieldValue(before)
      },
      after: {
        outboxLength: after.remote.outbox.length,
        headSha: after.remote.headSha,
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
    await sleep(50)

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

    // No await at all: this is the frame the dispatch returned in.
    const immediately = fieldValue(persisted())

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
      afterHidden,
      afterIdleDeadline,
      writes: writes.length
    }
  },

  /** The escape: no agent option at all, localStorage as the only store. */
  async noAgent() {
    fieldWrite('saved without the agent')

    await sleep(20)

    const state = persisted()

    return {
      scenario: 'noAgent',
      agentConfigured: Boolean((globalThis as any).__JAEN_AGENT__),
      persistedValue: fieldValue(state),
      outboxLength: (state?.remote?.outbox || []).length,
      saveCalls: calls.filter(call => call.query === 'save').length,
      writes: writes.length
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

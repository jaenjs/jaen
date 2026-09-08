/**
 * The browser globals the jaen store needs, installed before it is imported.
 *
 * It has to be a module of its own: an ES module evaluates its imports before
 * its own body, so globals assigned in the harness body would arrive after the
 * store module had already read them. `import './editing-shim'` first is what
 * makes the order right, and imports are evaluated in the order they are
 * written.
 *
 * Written by tests/09-editing-latency.ipynb and tests/10-draft-persistence.ipynb.
 */
import * as fs from 'fs'

export interface Write {
  key: string
  bytes: number
  ms: number
  at: number
}

/** Every `localStorage.setItem` the store made, in order. */
export const writes: Write[] = []

/** Every call the agent client made. */
export const calls: Array<{query: string; changes: any[]; baseSha?: string}> =
  []

export class MemoryStorage {
  private data: Record<string, string> = {}

  constructor(initial?: Record<string, string>) {
    if (initial) this.data = {...initial}
  }

  getItem(key: string): string | null {
    return key in this.data ? this.data[key] : null
  }

  setItem(key: string, value: string): void {
    // Timed around the assignment alone. A node property write is not a browser
    // localStorage write, so this number is a floor and never the browser's
    // cost: the browser half of notebook 09 measures that one in situ.
    const text = String(value)
    const started = performance.now()
    this.data[key] = text
    const ms = performance.now() - started

    writes.push({
      key,
      bytes: Buffer.byteLength(text, 'utf8'),
      ms,
      at: performance.now()
    })
  }

  removeItem(key: string): void {
    delete this.data[key]
  }

  clear(): void {
    this.data = {}
  }

  snapshot(): Record<string, string> {
    return {...this.data}
  }
}

const STORE_FILE = process.env.JAEN_HARNESS_STORE || ''

const initial: Record<string, string> =
  STORE_FILE && fs.existsSync(STORE_FILE)
    ? JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'))
    : {}

/** The storage area. A file behind it is what makes a reload possible. */
export const storage = new MemoryStorage(initial)

export const flushToDisk = () => {
  if (STORE_FILE) {
    fs.writeFileSync(STORE_FILE, JSON.stringify(storage.snapshot()))
  }
}

let networkMode: 'ok' | 'offline' = 'ok'
let head = 0

export const setNetwork = (mode: 'ok' | 'offline') => {
  networkMode = mode
}
;(globalThis as any).localStorage = storage
;(globalThis as any).sessionStorage = new MemoryStorage()

/**
 * A window and a document, because the store's own code hangs off both:
 * `persist-state.saveState` returns early where there is no window, so a node
 * run without one writes nothing at all and would measure zero, and the
 * flusher registers an `online` listener while the poller registers a
 * `visibilitychange` one. Keeping the listeners lets a scenario fire the two
 * events the plan's safety checks are about.
 */
type Listeners = Record<string, Array<(event?: any) => void>>

const makeTarget = (extra: Record<string, any> = {}) => {
  const listeners: Listeners = {}

  return {
    ...extra,
    listeners,
    addEventListener(type: string, handler: (event?: any) => void) {
      ;(listeners[type] = listeners[type] || []).push(handler)
    },
    removeEventListener(type: string, handler: (event?: any) => void) {
      listeners[type] = (listeners[type] || []).filter(
        entry => entry !== handler
      )
    }
  }
}

export const fakeWindow = makeTarget()
export const fakeDocument = makeTarget({visibilityState: 'visible'})

/** Fire one of the events the browser would, and say how many heard it. */
export const fire = (target: 'window' | 'document', type: string): number => {
  const listeners =
    (target === 'window' ? fakeWindow : fakeDocument).listeners[type] || []

  for (const handler of listeners) handler({type})

  return listeners.length
}
;(globalThis as any).window = fakeWindow
;(globalThis as any).document = fakeDocument
;(globalThis as any).fetch = async (_url: string, init: any) => {
  const body = JSON.parse(init.body)
  const isSave = body.query.includes('JaenAgentSave')

  calls.push({
    query: isSave ? 'save' : 'other',
    changes: isSave ? body.variables.changes : [],
    baseSha: body.variables.baseSha
  })

  if (networkMode === 'offline') {
    // What a dead socket looks like to the client: `fetch` itself rejects,
    // which is the AgentOfflineError branch, the one that keeps the outbox.
    throw new Error('harness: the network is down')
  }

  head += 1

  if (isSave) {
    return {
      status: 200,
      json: async () => ({
        data: {
          save: {
            headSha: `harness-head-${head}`,
            blobSha: `harness-blob-${head}`,
            commitSha: `harness-commit-${head}`,
            commitUrl: `https://example.invalid/commit/${head}`,
            savedAt: new Date().toISOString(),
            rebased: false,
            wrote: ['jaen-data/live.json'],
            overwrote: []
          }
        }
      })
    }
  }

  return {
    status: 200,
    json: async () => ({
      data: {
        draft: {
          site: 'booklimo.at',
          headSha: `harness-head-${head}`,
          changed: false,
          readAt: new Date().toISOString()
        }
      }
    })
  }
}

// The two build-time defines, as `gatsby-plugin-jaen` writes them for the
// browser. `JAEN_HARNESS_AGENT=0` is the escape of the plan: the site built
// without the option, where `localStorage` is the only store.
;(globalThis as any).__JAEN_ZITADEL_GQL__ = {
  authority: 'https://accounts.example.invalid',
  clientId: 'harness'
}
;(globalThis as any).__JAEN_AGENT__ =
  process.env.JAEN_HARNESS_AGENT === '0'
    ? undefined
    : {
        url: 'https://agent.example.invalid/graphql',
        site: 'booklimo.at',
        pollMs: 5000,
        activePollMs: 1500,
        debounceMs: 800
      }

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

/**
 * Everything the code under test says goes to stderr.
 *
 * `console.debug` and `console.log` are stdout in node, and stdout is where
 * the harness emits its one JSON answer. The client is deliberately talkative
 * about a socket it could not open and a revision that went backwards, and
 * that talk is worth reading, so it is moved rather than silenced.
 */
for (const level of ['log', 'debug', 'info', 'warn'] as const) {
  const original = console[level].bind(console)

  console[level] = (...args: unknown[]) => {
    if (process.env.JAEN_HARNESS_QUIET === '0') {
      original(...args)
      return
    }

    process.stderr.write(
      args.map(arg => (typeof arg === 'string' ? arg : String(arg))).join(' ') +
        '\n'
    )
  }
}

export interface Write {
  key: string
  bytes: number
  ms: number
  at: number
}

/** Every `localStorage.setItem` the store made, in order. */
export const writes: Write[] = []

/** Every call the agent client made. */
export const calls: Array<{
  query: string
  changes: any[]
  baseRevision?: number | null
  sinceRevision?: number | null
}> = []

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

export const setNetwork = (mode: 'ok' | 'offline') => {
  networkMode = mode
}

// ---------------------------------------------------------------------------
// The object, in this process
// ---------------------------------------------------------------------------

/**
 * A stand in for the site's Durable Object, small enough to read in one screen
 * and faithful in the three things the client's behaviour hangs off: a
 * monotonic revision, an answer that is either a delta or a full replacement,
 * and a write against a stale base being folded rather than refused.
 *
 * It is not the agent. It never claims to be the agent, and no check written
 * against it proves anything about the agent's own code. What it does prove is
 * what the client does when the object behaves in each of the ways the design
 * says it can, including the two it is not supposed to: going away between two
 * saves, and refusing a socket.
 */
export interface ObjectDelta {
  pages: Record<string, any>
  media: Record<string, unknown>
  removedMedia: string[]
  site: any | null
  widgets: any[]
  authors: Record<string, any>
  mediaField: {pageId: string; fieldType: string; fieldName: string} | null
}

const emptyDelta = (): ObjectDelta => ({
  pages: {},
  media: {},
  removedMedia: [],
  site: null,
  widgets: [],
  authors: {},
  mediaField: null
})

export const agentObject = {
  revision: 0,
  publishedRevision: 0,
  /** One entry per accepted write, so a reader above a revision gets a delta. */
  log: [] as Array<{revision: number; delta: ObjectDelta}>,
  /** Whether `subscribe` mints a ticket at all. */
  socket: 'ok' as 'ok' | 'refused',
  /** Every ticket minted, so a scenario can count the reconnects. */
  tickets: [] as string[],
  saves: 0,

  /**
   * Somebody else wrote a page into the object. The page is carried whole,
   * which is what the object's own delta does.
   */
  write(pages: Record<string, any>, authors: Record<string, any> = {}) {
    this.revision += 1
    this.log.push({
      revision: this.revision,
      delta: {...emptyDelta(), pages, authors}
    })
    return this.revision
  },

  /**
   * The object was lost and a new one answered in its place, at the revision a
   * snapshot left it at. Everything written after that snapshot is gone, which
   * is the whole point of the scenario.
   */
  restartAt(revision: number) {
    this.revision = revision
    this.log = this.log.filter(entry => entry.revision <= revision)
    // The sockets go with the object that held them, which is the first thing
    // an editor's browser notices: a Durable Object's WebSockets do not
    // outlive it. Dropping them here is what makes this a lost object rather
    // than an object that quietly answers older numbers.
    dropSockets()
  },

  read(since: number | null) {
    if (typeof since === 'number' && since === this.revision) {
      return {
        site: 'booklimo.at',
        revision: this.revision,
        publishedRevision: this.publishedRevision,
        changed: false,
        full: false,
        delta: null,
        readAt: new Date().toISOString()
      }
    }

    // A reader with no revision, or one this object has never reached, is
    // answered with everything it has rather than with a delta onto a copy
    // neither side can name.
    const full = typeof since !== 'number' || since > this.revision
    const entries = full
      ? this.log
      : this.log.filter(entry => entry.revision > since)

    const delta = emptyDelta()

    for (const entry of entries) {
      Object.assign(delta.pages, entry.delta.pages)
      Object.assign(delta.media, entry.delta.media)
      Object.assign(delta.authors, entry.delta.authors)
      delta.removedMedia.push(...entry.delta.removedMedia)
      if (entry.delta.site) delta.site = entry.delta.site
      if (entry.delta.mediaField) delta.mediaField = entry.delta.mediaField
      delta.widgets.push(...entry.delta.widgets)
    }

    return {
      site: 'booklimo.at',
      revision: this.revision,
      publishedRevision: this.publishedRevision,
      changed: true,
      full,
      delta,
      readAt: new Date().toISOString()
    }
  },

  /**
   * A write. A base the object has already moved past is folded onto the
   * newer draft rather than refused, and the fields it took from somebody else
   * come back as `overwrote`, which is how the CMS says what a race cost.
   */
  save(changes: any[], baseRevision: number | null) {
    this.saves += 1

    const rebased =
      typeof baseRevision === 'number' && baseRevision !== this.revision

    const overwrote = rebased
      ? changes
          .filter(change => change.fieldName)
          .map(change => ({
            field: `${change.pageId}/${change.fieldType}/${change.fieldName}`
          }))
      : []

    const pages: Record<string, any> = {}

    for (const change of changes) {
      if (change.kind !== 'fieldWrite' || !change.pageId) continue

      pages[change.pageId] = {
        id: change.pageId,
        jaenFields: {
          [change.fieldType]: {
            [change.fieldName]: {value: change.value}
          }
        }
      }
    }

    this.revision += 1
    this.log.push({revision: this.revision, delta: {...emptyDelta(), pages}})

    return {
      revision: this.revision,
      savedAt: new Date().toISOString(),
      rebased,
      overwrote
    }
  }
}

// ---------------------------------------------------------------------------
// The socket
// ---------------------------------------------------------------------------

/**
 * A WebSocket that goes nowhere and can be told to refuse.
 *
 * The client's fallback is the whole of what these scenarios are about, and
 * the two ways a socket fails are both here: `subscribe` refusing to mint a
 * ticket, which is an agent that does not have the verb, and the connection
 * itself closing, which is a proxy that will not upgrade.
 */
export const sockets: Array<{url: string; protocols: string[]}> = []

class FakeWebSocket {
  onopen: ((event?: any) => void) | null = null
  onclose: ((event?: any) => void) | null = null
  onerror: ((event?: any) => void) | null = null
  onmessage: ((event?: any) => void) | null = null
  readyState = 0

  constructor(
    public url: string,
    public protocols?: string | string[]
  ) {
    sockets.push({
      url,
      protocols: Array.isArray(protocols)
        ? protocols
        : protocols
          ? [protocols]
          : []
    })

    setTimeout(() => {
      if (agentObject.socket === 'refused') {
        this.readyState = 3
        this.onclose?.({code: 1006})
        return
      }

      this.readyState = 1
      live.push(this)
      this.onopen?.({})
    }, 0)
  }

  close() {
    this.readyState = 3
  }
}

const live: FakeWebSocket[] = []

/** The object went away and took its sockets with it. */
export const dropSockets = () => {
  const closing = live.splice(0, live.length)

  for (const socket of closing) {
    socket.readyState = 3
    socket.onclose?.({code: 1006})
  }

  return closing.length
}

/** Push a frame to every open socket, the way the object would. */
export const pushRevision = (revision: number, publishedRevision?: number) => {
  for (const socket of live) {
    socket.onmessage?.({
      data: JSON.stringify({type: 'revision', revision, publishedRevision})
    })
  }

  return live.length
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
;(globalThis as any).WebSocket = FakeWebSocket
;(globalThis as any).fetch = async (_url: string, init: any) => {
  const body = JSON.parse(init.body)
  const isSave = body.query.includes('JaenAgentSave')
  const isDraft = body.query.includes('JaenAgentDraft')
  const isSubscribe = body.query.includes('JaenAgentSubscribe')

  calls.push({
    query: isSave
      ? 'save'
      : isDraft
        ? 'draft'
        : isSubscribe
          ? 'subscribe'
          : 'other',
    changes: isSave ? body.variables.changes : [],
    baseRevision: isSave ? body.variables.baseRevision : undefined,
    sinceRevision: isDraft ? body.variables.sinceRevision : undefined
  })

  if (networkMode === 'offline') {
    // What a dead socket looks like to the client: `fetch` itself rejects,
    // which is the AgentOfflineError branch, the one that keeps the outbox.
    throw new Error('harness: the network is down')
  }

  if (isSave) {
    return {
      status: 200,
      json: async () => ({
        data: {
          save: agentObject.save(
            body.variables.changes,
            body.variables.baseRevision
          )
        }
      })
    }
  }

  if (isSubscribe) {
    if (agentObject.socket === 'refused') {
      // An agent that does not know the verb answers an error, which is what
      // this client must survive by falling back to the poll.
      return {
        status: 200,
        json: async () => ({
          errors: [
            {message: 'Cannot query field "subscribe" on type "Mutation"'}
          ]
        })
      }
    }

    const ticket = `ticket-${agentObject.tickets.length + 1}`
    agentObject.tickets.push(ticket)

    return {
      status: 200,
      json: async () => ({
        data: {
          subscribe: {
            site: 'booklimo.at',
            ticket,
            url: 'wss://agent.example.invalid/draft/booklimo.at',
            expiresAt: new Date(Date.now() + 60000).toISOString(),
            revision: agentObject.revision
          }
        }
      })
    }
  }

  if (isDraft) {
    return {
      status: 200,
      json: async () => ({
        data: {draft: agentObject.read(body.variables.sinceRevision)}
      })
    }
  }

  return {
    status: 200,
    json: async () => ({
      data: {
        viewer: {
          site: 'booklimo.at',
          sub: 'harness',
          name: 'The harness',
          at: new Date().toISOString()
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
        // The poll runs fast here on purpose. It is the fallback and the
        // scenario that matters most is the one where it is the only path
        // there is, so a check on it should not be a check on a scenario's
        // patience: `JAEN_HARNESS_POLL_MS` sets it, default 300 ms.
        pollMs: Number(process.env.JAEN_HARNESS_POLL_MS || 300),
        activePollMs: Number(process.env.JAEN_HARNESS_POLL_MS || 300)
        // No `debounceMs`, exactly as booklimo's own gatsby-config passes
        // none, so the harness waits out the window the code ships with.
      }

// `document.visibilityState` is 'visible' above, so the client polls at
// `activePollMs`. Nothing here sets the socket up or down: `agentObject.socket`
// does, and every scenario that cares says which it wants.

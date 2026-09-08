/**
 * One Durable Object per site: the shared draft.
 *
 * The object is addressed by the site's name, so there is exactly one instance
 * of it, it is single threaded, and two editors cannot save onto stale bases.
 * That single threading is the whole reason for the choice: the first build
 * serialised saves with a KV lock that had no compare-and-set and a blob sha
 * on a GitHub PUT, and it still wrote every save into a git commit. Nothing
 * here touches git and nothing here touches the storage gateway.
 *
 * The keys, which is also why a field save is cheap:
 *
 *   meta                revision, publishedRevision, updatedAt, the snapshot
 *   page:<pageId>       one page node, without the media catalogue field
 *   media:<nodeId>      one media node, or a tombstone
 *   widget:<id>         one widget
 *   site                the site metadata
 *   author:<fieldKey>   who wrote that field last, and when
 *   ticket:<id>         a single use handle for a WebSocket, for its minute
 *
 * A save writes only the keys it touched and bumps `revision`. A reader asks
 * for everything above a revision. The catalogue is one key per node because
 * it is 118,617 bytes of booklimo's 120 KB draft and it is the one field that
 * is written by adding and removing keys rather than by replacing a value.
 *
 * The limits this shape is measured against are in
 * docs/architecture/draft-state.md, "What a Durable Object actually allows",
 * confirmed against Cloudflare's documentation rather than remembered.
 *
 * Identity is decided before anything reaches this class. A Durable Object
 * namespace is not addressable from outside the Worker, so the object trusts
 * the Worker, and the Worker refuses anybody who is not the site's admin the
 * one way (../auth, and "Identity, the one way" in private-storage.md). The
 * one exception is the WebSocket ticket, which the object mints and checks
 * itself, because a browser cannot put a bearer on an upgrade request.
 */
import {
  applyChanges,
  fieldKey,
  type FieldOverwrite,
  type JaenChangeInput
} from '../apply-change'
import {MEDIA_FIELD_TYPE} from '../document'
import type {
  FieldAuthor,
  FieldAuthors,
  JaenDraft,
  JaenPageNode,
  JaenSiteState,
  JaenWidget
} from '../types'
import {kvSnapshotSink, type SnapshotSink} from './snapshot'
import {
  emptyMeta,
  KEY,
  type DraftDelta,
  type DraftMeta,
  type DraftRead,
  type DraftSnapshot,
  type DraftTicket,
  type DraftWriteInput,
  type DraftWriteResult
} from './store'

/** The env a draft object is constructed with. */
export interface DraftObjectEnv {
  CACHE?: KVNamespace
  /** How long the alarm waits before it snapshots. Five minutes by default. */
  DRAFT_SNAPSHOT_INTERVAL_MS?: string | number
  [key: string]: unknown
}

const SNAPSHOT_INTERVAL_MS = 300_000
/**
 * When the last editor leaves, the snapshot is taken promptly rather than at
 * the next interval, and not instantly: a reload closes the socket and opens
 * another one a second later, and a snapshot per reload is a write per reload.
 */
const LAST_EDITOR_MS = 10_000
/** A ticket is exchanged for a socket at once or not at all. */
const TICKET_TTL_MS = 60_000
/** The subprotocol the client offers, and the prefix its ticket rides under. */
const SOCKET_PROTOCOL = 'jaen-draft.v1'
const TICKET_PROTOCOL = 'ticket.'
/** `storage.put` takes at most 128 pairs at a time. */
const PUT_BATCH = 100
/** One list page. The object pages until a prefix is exhausted. */
const LIST_PAGE = 500

interface Stored<T> {
  /** The revision this key last changed at. */
  r: number
  v?: T
  /** A media node that was removed. Kept so a delta can say so. */
  deleted?: boolean
}

const isCatalogueChange = (change: JaenChangeInput): boolean =>
  change.fieldType === MEDIA_FIELD_TYPE &&
  (change.kind === 'fieldMerge' || change.kind === 'fieldWrite')

/**
 * The one thing every operation of this class agrees on.
 *
 * A Durable Object's storage writes made while handling one event are
 * committed together, and its outgoing messages are held until they are
 * confirmed, so a revision this object has announced is a revision it has
 * stored. That is what makes the counter trustworthy and it is why no
 * operation here takes a lock of its own.
 */
export class JaenDraftObject {
  private readonly state: DurableObjectState
  private readonly storage: DurableObjectStorage
  private readonly env: DraftObjectEnv
  private readonly sink: SnapshotSink

  constructor(state: DurableObjectState, env: DraftObjectEnv) {
    this.state = state
    this.storage = state.storage
    this.env = env
    this.sink = kvSnapshotSink(env.CACHE ?? null)

    // A keepalive that never wakes the object. Without it every ping of every
    // open CMS un-hibernates the instance.
    try {
      if (typeof WebSocketRequestResponsePair !== 'undefined') {
        state.setWebSocketAutoResponse(
          new WebSocketRequestResponsePair('ping', 'pong')
        )
      }
    } catch {
      // An older runtime without the auto response. The client's ping then
      // costs a wake up, which is slower and not wrong.
    }
  }

  // ------------------------------------------------------------------
  // The transport
  // ------------------------------------------------------------------

  /**
   * The object speaks one internal protocol and it is not public: the
   * namespace is reachable from this Worker's own bindings and from nowhere
   * else. The site key travels in the body because an object cannot read the
   * name it was addressed by.
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const op = url.pathname.replace(/^\/+/, '')

    if (op === 'connect') return this.connect(request, url)

    let body: any = {}

    try {
      body = await request.json()
    } catch {
      body = {}
    }

    const site = String(body.site ?? '')

    if (!site) return json({error: 'a draft call without a site'}, 400)

    try {
      switch (op) {
        case 'read':
          return json(
            await this.read(
              site,
              typeof body.sinceRevision === 'number'
                ? body.sinceRevision
                : null
            )
          )
        case 'write':
          return json(await this.write(site, body.input as DraftWriteInput))
        case 'subscribe':
          return json(await this.subscribe(site, body.viewer))
        case 'snapshot':
          return json(await this.snapshot(site))
        case 'published':
          return json(await this.markPublished(site, Number(body.revision)))
        default:
          return json({error: `unknown draft operation ${op}`}, 404)
      }
    } catch (error) {
      console.error('jaen-agent draft object', op, error)

      return json({error: (error as Error).message ?? String(error)}, 500)
    }
  }

  // ------------------------------------------------------------------
  // meta
  // ------------------------------------------------------------------

  private async meta(site: string): Promise<DraftMeta> {
    const stored = await this.storage.get<DraftMeta>(KEY.meta)

    if (stored) return {...emptyMeta(site), ...stored, site: stored.site || site}

    return emptyMeta(site)
  }

  // ------------------------------------------------------------------
  // read
  // ------------------------------------------------------------------

  /**
   * Everything at or above `sinceRevision`, or the whole draft.
   *
   * The poll that answers `changed: false` reads one key and lists nothing,
   * which is what almost every poll of every open CMS is. It stays as the
   * fallback for a browser whose WebSocket is refused, and it is no longer a
   * GitHub round trip: before this it read a branch head over the network.
   */
  async read(site: string, sinceRevision: number | null): Promise<DraftRead> {
    const meta = await this.meta(site)
    const base = {
      site,
      revision: meta.revision,
      publishedRevision: meta.publishedRevision,
      updatedAt: meta.updatedAt,
      updatedBy: meta.updatedBy,
      snapshotRevision: meta.snapshotRevision,
      snapshotAt: meta.snapshotAt,
      snapshotBytes: meta.snapshotBytes,
      readAt: new Date().toISOString()
    }

    if (sinceRevision !== null && sinceRevision === meta.revision) {
      return {...base, changed: false, full: false, delta: null}
    }

    // A reader from before the pruning window cannot be told what went, and a
    // reader from above this object's revision is looking at a draft this
    // object does not have, which is what a lost or rebuilt object looks like
    // from the outside. Both get the whole draft rather than a delta that
    // would quietly keep something that is gone.
    const full =
      sinceRevision === null ||
      sinceRevision < meta.prunedBefore ||
      sinceRevision > meta.revision

    const since = full ? -1 : sinceRevision

    const pages: Record<string, JaenPageNode> = {}
    const media: Record<string, unknown> = {}
    const removedMedia: string[] = []
    const widgets: JaenWidget[] = []
    const authors: FieldAuthors = {}
    let siteState: JaenSiteState | null = null

    for (const [key, value] of await this.listAll<JaenPageNode>(KEY.page)) {
      if (value.r > since && value.v) pages[key.slice(KEY.page.length)] = value.v
    }

    for (const [key, value] of await this.listAll<unknown>(KEY.media)) {
      if (value.r <= since) continue

      const id = key.slice(KEY.media.length)

      if (value.deleted) {
        // A full answer is the catalogue as it is, so a tombstone is simply
        // absent from it. A delta has to name it or the reader keeps a
        // picture somebody deleted.
        if (!full) removedMedia.push(id)
        continue
      }

      media[id] = value.v
    }

    for (const [, value] of await this.listAll<JaenWidget>(KEY.widget)) {
      if (value.r > since && value.v) widgets.push(value.v)
    }

    for (const [key, value] of await this.listAll<FieldAuthor>(KEY.author)) {
      if (value.r > since && value.v) authors[key.slice(KEY.author.length)] = value.v
    }

    const stored = await this.storage.get<Stored<JaenSiteState>>(KEY.site)

    if (stored && stored.r > since && stored.v) siteState = stored.v

    const delta: DraftDelta = {
      pages,
      media,
      removedMedia,
      site: siteState,
      widgets,
      authors,
      mediaField: meta.mediaField
    }

    return {...base, changed: true, full, delta}
  }

  // ------------------------------------------------------------------
  // write
  // ------------------------------------------------------------------

  /**
   * The batch, applied onto whatever the object holds now.
   *
   * A write whose `baseRevision` is not the current revision is stale. It is
   * **rebased and never rejected**: the changes are applied onto the current
   * state, the answer says `rebased: true` and names every field whose value
   * it replaced together with who had written it. That rule is older than this
   * store and it is the invariant the CMS is sold on, that an edit a person
   * made is never lost.
   *
   * The catalogue is handled apart from everything else. A picture is a
   * `fieldMerge` of the entries that changed, so it writes one key per picture
   * and never reads the other 139, and two editors uploading at the same time
   * keep both pictures because neither ever holds the whole catalogue.
   */
  async write(site: string, input: DraftWriteInput): Promise<DraftWriteResult> {
    if (!input || !Array.isArray(input.changes) || input.changes.length === 0) {
      throw new Error('a draft write without changes')
    }

    const meta = await this.meta(site)
    const revision = meta.revision + 1
    const rebased =
      typeof input.baseRevision === 'number' &&
      input.baseRevision !== meta.revision

    const author = input.author
    const stampedAt = new Date().toISOString()

    const catalogue = input.changes.filter(isCatalogueChange)
    const rest = input.changes.filter(change => !isCatalogueChange(change))

    const writes = new Map<string, unknown>()
    const overwrote: FieldOverwrite[] = []
    const touched: string[] = []

    if (rest.length) {
      const draft = await this.loadDraft()
      const beforePages = new Map(
        Object.entries(draft.pages).map(([id, page]) => [id, stable(page)])
      )
      const beforeWidgets = new Map(
        draft.widgets.map(widget => [widget.id, stable(widget)])
      )
      const beforeSite = stable(draft.site)

      const authors = await this.loadAuthors(rest.map(fieldKey))

      const result = applyChanges(
        draft,
        rest,
        authors,
        {sub: author.sub, name: author.name},
        {rebased}
      )

      overwrote.push(...result.overwrote)
      touched.push(...result.touched)

      for (const [id, page] of Object.entries(draft.pages)) {
        if (beforePages.get(id) === stable(page)) continue

        writes.set(KEY.page + id, {r: revision, v: page} as Stored<JaenPageNode>)
      }

      for (const widget of draft.widgets) {
        if (beforeWidgets.get(widget.id) === stable(widget)) continue

        writes.set(KEY.widget + widget.id, {
          r: revision,
          v: widget
        } as Stored<JaenWidget>)
      }

      if (stable(draft.site) !== beforeSite) {
        writes.set(KEY.site, {r: revision, v: draft.site} as Stored<JaenSiteState>)
      }

      for (const key of result.touched) {
        writes.set(KEY.author + key, {
          r: revision,
          v: authors[key]
        } as Stored<FieldAuthor>)
      }
    }

    for (const change of catalogue) {
      const field = {
        pageId: change.pageId ?? '',
        fieldType: change.fieldType ?? MEDIA_FIELD_TYPE,
        fieldName: change.fieldName ?? 'media_nodes'
      }

      if (!field.pageId) throw new Error('a catalogue change without a pageId')

      meta.mediaField = field

      const key = fieldKey(change)
      const previous = await this.storage.get<Stored<FieldAuthor>>(
        KEY.author + key
      )

      const entries =
        change.value && typeof change.value === 'object' && !Array.isArray(change.value)
          ? (change.value as Record<string, unknown>)
          : {}

      if (change.kind === 'fieldWrite') {
        // The whole catalogue at once, which is what a client that cannot
        // send a merge does. Everything it does not name is gone.
        const given = new Set(Object.keys(entries))

        for (const [storedKey, value] of await this.listAll<unknown>(KEY.media)) {
          const id = storedKey.slice(KEY.media.length)

          if (given.has(id) || value.deleted) continue

          writes.set(storedKey, {r: revision, deleted: true} as Stored<unknown>)
        }

        // A merge can never overwrite somebody else's value, because it only
        // carries the keys that changed. A whole-catalogue write can.
        if (rebased && previous?.v && previous.v.sub !== author.sub) {
          overwrote.push({
            field: key,
            previousAuthor: previous.v.name,
            previousAt: previous.v.at
          })
        }
      } else {
        const removed = Array.isArray(change.props?.removed)
          ? (change.props!.removed as unknown[])
          : []

        for (const id of removed) {
          if (typeof id !== 'string') continue

          writes.set(KEY.media + id, {r: revision, deleted: true} as Stored<unknown>)
        }
      }

      for (const [id, node] of Object.entries(entries)) {
        writes.set(KEY.media + id, {r: revision, v: node} as Stored<unknown>)
      }

      writes.set(KEY.author + key, {
        r: revision,
        v: {sub: author.sub, name: author.name, at: stampedAt}
      } as Stored<FieldAuthor>)

      touched.push(key)
    }

    meta.revision = revision
    meta.updatedAt = stampedAt
    meta.updatedBy = author.sub
    writes.set(KEY.meta, meta)

    await this.putAll(writes)

    this.broadcast({
      type: 'revision',
      site,
      revision,
      by: author.sub,
      name: author.name,
      at: stampedAt
    })

    await this.armSnapshot()

    return {
      revision,
      rebased,
      overwrote,
      touched,
      keys: writes.size,
      savedAt: stampedAt
    }
  }

  // ------------------------------------------------------------------
  // subscribe, and the socket it hands out
  // ------------------------------------------------------------------

  /**
   * A single use ticket, exchanged for a WebSocket within the minute.
   *
   * The socket cannot carry a bearer, because a browser's WebSocket
   * constructor takes no headers, and putting the editor's access token in a
   * query string would write it into every proxy log between here and them.
   * So the identity is decided the one way in the resolver that mints this,
   * and the ticket is a handle onto that decision and nothing else: it is
   * random, it lives for a minute, it is deleted the moment it is used, and it
   * grants exactly the stream of revisions.
   */
  async subscribe(
    site: string,
    viewer: {sub: string; name: string; email?: string}
  ): Promise<DraftTicket> {
    const meta = await this.meta(site)
    const ticket = crypto.randomUUID()
    const expiresAt = Date.now() + TICKET_TTL_MS

    await this.storage.put(KEY.ticket + ticket, {
      sub: viewer.sub,
      name: viewer.name,
      expiresAt
    })

    return {
      site,
      ticket,
      url: '',
      expiresAt: new Date(expiresAt).toISOString(),
      revision: meta.revision
    }
  }

  private async connect(request: Request, url: URL): Promise<Response> {
    const site = url.searchParams.get('site') ?? ''

    // The ticket rides in `Sec-WebSocket-Protocol` and not in the query
    // string. A browser's WebSocket constructor can set no header, so the two
    // ways to carry it are a query parameter and a subprotocol, and the first
    // ends up in every proxy log, in a Referer and in a shared link. A ticket
    // is legal as a subprotocol token, so the second costs nothing. The query
    // is still read, for a caller that is not a browser.
    const offered = (request.headers.get('sec-websocket-protocol') ?? '')
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)

    const ticket =
      offered
        .find(part => part.startsWith(TICKET_PROTOCOL))
        ?.slice(TICKET_PROTOCOL.length) ??
      url.searchParams.get('ticket') ??
      ''

    const held = ticket
      ? await this.storage.get<{
          sub: string
          name: string
          expiresAt: number
        }>(KEY.ticket + ticket)
      : null

    // Single use, whether it was good or not: a ticket that has been offered
    // once is spent.
    if (ticket) await this.storage.delete(KEY.ticket + ticket)

    if (!held || held.expiresAt < Date.now()) {
      return json({error: 'AUTH_REQUIRED', reason: 'no valid ticket'}, 401)
    }

    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]

    // The hibernation API and not `server.accept()`: an editor with the CMS
    // open and nobody typing costs nothing, because the object sleeps between
    // messages and wakes on one.
    this.state.acceptWebSocket(server)
    server.serializeAttachment({sub: held.sub, name: held.name, site})

    const meta = await this.meta(site)

    try {
      server.send(
        JSON.stringify({
          type: 'hello',
          site,
          revision: meta.revision,
          publishedRevision: meta.publishedRevision,
          at: new Date().toISOString()
        })
      )
    } catch (error) {
      console.error('jaen-agent: the hello could not be sent', error)
    }

    // The subprotocol is echoed back, or a browser that offered one and was
    // answered with none reads the connection as refused.
    const selected = offered.includes(SOCKET_PROTOCOL) ? SOCKET_PROTOCOL : null

    return new Response(null, {
      status: 101,
      webSocket: client,
      ...(selected ? {headers: {'Sec-WebSocket-Protocol': selected}} : {})
    })
  }

  /**
   * The client says nothing that changes anything. It saves over GraphQL and
   * listens here, so the only message this handles is a keepalive the auto
   * response does not cover.
   */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message === 'string' && message === 'ping') {
      try {
        ws.send('pong')
      } catch {
        // A socket that cannot be written to is closing anyway.
      }
    }
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
    wasClean: boolean
  ) {
    try {
      ws.close(code, reason)
    } catch {
      // Already gone.
    }

    await this.onLastEditorLeft()
  }

  async webSocketError(_ws: WebSocket, error: unknown) {
    console.error('jaen-agent: draft socket error', error)

    await this.onLastEditorLeft()
  }

  private broadcast(message: Record<string, unknown>) {
    const body = JSON.stringify(message)

    for (const socket of this.state.getWebSockets()) {
      try {
        socket.send(body)
      } catch (error) {
        console.error('jaen-agent: a draft socket refused a push', error)
      }
    }
  }

  // ------------------------------------------------------------------
  // snapshot, and the alarm that takes it
  // ------------------------------------------------------------------

  /**
   * The whole draft, with the catalogue folded back into its field.
   *
   * This is what the alarm writes to the backstop and what publish reads to
   * make a migration out of. It is the one place the object materialises
   * everything, which is why it is not on the editing path.
   */
  async snapshot(site: string): Promise<DraftSnapshot> {
    const meta = await this.meta(site)
    const draft = await this.loadDraft()
    const media: Record<string, unknown> = {}

    for (const [key, value] of await this.listAll<unknown>(KEY.media)) {
      if (value.deleted) continue

      media[key.slice(KEY.media.length)] = value.v
    }

    const field = meta.mediaField

    if (field && Object.keys(media).length) {
      const page: JaenPageNode = draft.pages[field.pageId] ?? {
        id: field.pageId,
        childPages: []
      }

      page.jaenFields = {
        ...(page.jaenFields ?? {}),
        [field.fieldType]: {
          ...(page.jaenFields?.[field.fieldType] ?? {}),
          [field.fieldName]: {
            ...(page.jaenFields?.[field.fieldType]?.[field.fieldName] ?? {}),
            value: media
          }
        }
      }

      draft.pages[field.pageId] = page
    }

    const authors: FieldAuthors = {}

    for (const [key, value] of await this.listAll<FieldAuthor>(KEY.author)) {
      if (value.v) authors[key.slice(KEY.author.length)] = value.v
    }

    return {
      site,
      revision: meta.revision,
      takenAt: new Date().toISOString(),
      data: {
        pages: Object.entries(draft.pages).map(([id, page]) => ({...page, id})),
        site: draft.site,
        widgets: draft.widgets
      },
      authors
    }
  }

  async markPublished(site: string, revision: number): Promise<DraftMeta> {
    const meta = await this.meta(site)

    meta.publishedRevision = Number.isFinite(revision)
      ? revision
      : meta.revision

    await this.storage.put(KEY.meta, meta)

    return meta
  }

  /**
   * The alarm, which is the backstop.
   *
   * It snapshots when the draft has moved since the last one, prunes the
   * tombstones and the spent tickets, and sets itself again while somebody is
   * still connected. It costs a handful of writes a day rather than the
   * thousands the first build's commit per save cost.
   */
  async alarm(): Promise<void> {
    // The object cannot read the name it was addressed by, so the site key is
    // the one the first call stored. An alarm before any write is impossible,
    // because only a write arms one.
    const meta = await this.meta('')

    if (!meta.site) return

    if (meta.revision !== meta.snapshotRevision) {
      const snapshot = await this.snapshot(meta.site)
      const bytes = await this.sink.put(snapshot)

      meta.snapshotRevision = snapshot.revision
      meta.snapshotAt = snapshot.takenAt
      meta.snapshotBytes = bytes

      // A tombstone older than the snapshot has no reader left that could
      // need it: anybody that far behind is answered with the whole draft.
      // The pruning window is the snapshot, so it is the same act.
      const pruned = await this.pruneTombstones(meta.snapshotRevision)

      if (pruned) meta.prunedBefore = meta.snapshotRevision

      await this.storage.put(KEY.meta, meta)
    }

    await this.pruneTickets()

    if (this.state.getWebSockets().length > 0) {
      await this.storage.setAlarm(Date.now() + this.interval())
    }
  }

  private interval(): number {
    const raw = this.env.DRAFT_SNAPSHOT_INTERVAL_MS
    const n = Number(raw)

    return Number.isFinite(n) && n >= 1000 ? n : SNAPSHOT_INTERVAL_MS
  }

  /** Set only when none is pending, so a burst of saves does not push it out. */
  private async armSnapshot(at?: number): Promise<void> {
    const pending = await this.storage.getAlarm()
    const when = at ?? Date.now() + this.interval()

    if (pending === null || pending > when) await this.storage.setAlarm(when)
  }

  private async onLastEditorLeft(): Promise<void> {
    if (this.state.getWebSockets().length > 0) return

    await this.armSnapshot(Date.now() + LAST_EDITOR_MS)
  }

  private async pruneTombstones(upTo: number): Promise<number> {
    const gone: string[] = []

    for (const [key, value] of await this.listAll<unknown>(KEY.media)) {
      if (value.deleted && value.r <= upTo) gone.push(key)
    }

    for (let i = 0; i < gone.length; i += PUT_BATCH) {
      await this.storage.delete(gone.slice(i, i + PUT_BATCH))
    }

    return gone.length
  }

  private async pruneTickets(): Promise<void> {
    const now = Date.now()
    const gone: string[] = []

    for (const [key, value] of await this.listAll<never>(KEY.ticket)) {
      const held = value as unknown as {expiresAt?: number}

      if (!held?.expiresAt || held.expiresAt < now) gone.push(key)
    }

    for (let i = 0; i < gone.length; i += PUT_BATCH) {
      await this.storage.delete(gone.slice(i, i + PUT_BATCH))
    }
  }

  // ------------------------------------------------------------------
  // the storage, in the small
  // ------------------------------------------------------------------

  /**
   * The pages, the site metadata and the widgets, and never the catalogue.
   *
   * This is the document `applyChanges` is given, and leaving the catalogue
   * out of it is what makes a field save cheap: booklimo's ten pages are 1,899
   * bytes together and its catalogue is 118,617.
   */
  private async loadDraft(): Promise<JaenDraft> {
    const pages: Record<string, JaenPageNode> = {}
    const widgets: JaenWidget[] = []

    for (const [key, value] of await this.listAll<JaenPageNode>(KEY.page)) {
      if (value.v) pages[key.slice(KEY.page.length)] = value.v
    }

    for (const [, value] of await this.listAll<JaenWidget>(KEY.widget)) {
      if (value.v) widgets.push(value.v)
    }

    const site = await this.storage.get<Stored<JaenSiteState>>(KEY.site)

    return {pages, site: site?.v ?? {siteMetadata: {}}, widgets}
  }

  /** Only the keys the batch names, which is at most one per change. */
  private async loadAuthors(keys: string[]): Promise<FieldAuthors> {
    const authors: FieldAuthors = {}
    const wanted = Array.from(new Set(keys)).map(key => KEY.author + key)

    for (let i = 0; i < wanted.length; i += PUT_BATCH) {
      const chunk = await this.storage.get<Stored<FieldAuthor>>(
        wanted.slice(i, i + PUT_BATCH)
      )

      for (const [key, value] of chunk) {
        if (value?.v) authors[key.slice(KEY.author.length)] = value.v
      }
    }

    return authors
  }

  /**
   * A prefix, paged to the end.
   *
   * `list` answers one page, so a catalogue of more nodes than the page size
   * would silently be read short. booklimo's is 140 today and the page is 500,
   * and a store that reads only part of a catalogue is exactly the kind of
   * quiet loss this design exists to prevent.
   */
  private async listAll<T>(
    prefix: string
  ): Promise<Array<[string, Stored<T>]>> {
    const out: Array<[string, Stored<T>]> = []
    let startAfter: string | undefined

    for (;;) {
      const page: Map<string, Stored<T>> = await this.storage.list<Stored<T>>({
        prefix,
        limit: LIST_PAGE,
        ...(startAfter ? {startAfter} : {})
      })

      if (page.size === 0) break

      for (const entry of page) out.push(entry)

      if (page.size < LIST_PAGE) break

      startAfter = out[out.length - 1]![0]
    }

    return out
  }

  private async putAll(writes: Map<string, unknown>): Promise<void> {
    const entries = Array.from(writes.entries())

    for (let i = 0; i < entries.length; i += PUT_BATCH) {
      await this.storage.put(Object.fromEntries(entries.slice(i, i + PUT_BATCH)))
    }
  }
}

/** Stable enough to say "this page did not change", and cheap. */
const stable = (value: unknown): string => JSON.stringify(value ?? null)

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {'content-type': 'application/json'}
  })

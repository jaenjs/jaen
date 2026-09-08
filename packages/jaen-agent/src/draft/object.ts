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
  type DraftDiscardInput,
  type DraftDiscardPreview,
  type DraftDiscardResult,
  type DraftEditor,
  type DraftMeta,
  type DraftRead,
  type DraftSnapshot,
  type DraftTicket,
  type DraftWriteInput,
  type DraftWriteResult,
  type MediaField
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
/**
 * How long a tombstone is kept, which is how far behind a reader may be and
 * still be told what went rather than handed the whole draft.
 *
 * By the tombstone's own age and not by the snapshot, which is what the first
 * cut did: pruning at every snapshot meant an editor whose CMS had been open
 * for five minutes was pushed into a full read by a picture somebody else
 * deleted, and the test that read a delta across a snapshot was flaky for the
 * same reason. An hour costs a few hundred bytes per deleted picture.
 */
const TOMBSTONE_TTL_MS = 3_600_000
/**
 * One chunk of the published state.
 *
 * A SQLite backed object allows 2 MB for a key and its value together
 * (draft-state.md, "What a Durable Object actually allows"), so half of that
 * leaves room for the serialisation the runtime puts around a string and for a
 * catalogue that grows. booklimo's whole published state is about 120 KB, so
 * it is one chunk today and the chunking exists for the site that is not
 * booklimo.
 */
const CHUNK_BYTES = 1_000_000
/** How many times a discard re-takes its backstop before it gives up. */
const DISCARD_ATTEMPTS = 3

/**
 * A write that would fold a browser's unsent changes back on top of a discard.
 *
 * It is the one refusal this store makes, and it is deliberate. Every other
 * stale write is rebased, because rebasing is how an edit is not lost; a write
 * whose base is below the last discard is different in kind, because those
 * changes are exactly the ones an admin asked to be gone, and applying them
 * would resurrect part of what was just undone in every other editor's browser
 * as well. The client is told which revision invalidated it, drops its outbox
 * and reads the draft whole. See draft-state.md, "Three operations that
 * rewrite the shared draft".
 */
export class DraftDiscardedWriteError extends Error {
  readonly code = 'DRAFT_DISCARDED'
  readonly status = 409
  readonly discardedRevision: number
  readonly discardedAt: string | null
  readonly discardedByName: string | null

  constructor(meta: DraftMeta) {
    super(
      `The unpublished changes of ${meta.site} were discarded at revision ` +
        `${meta.discardedRevision}` +
        (meta.discardedByName ? ` by ${meta.discardedByName}` : '') +
        `. This save was made against revision ` +
        `${meta.discardedRevision - 1} or older, so it would put back part of ` +
        `what was discarded and is refused.`
    )
    this.name = 'DraftDiscardedWriteError'
    this.discardedRevision = meta.discardedRevision
    this.discardedAt = meta.discardedAt
    this.discardedByName = meta.discardedByName
  }
}

interface Stored<T> {
  /** The revision this key last changed at. */
  r: number
  v?: T
  /** A media node that was removed. Kept so a delta can say so. */
  deleted?: boolean
  /** When a tombstone was made, which is what its pruning goes by. */
  t?: number
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
              typeof body.sinceRevision === 'number' ? body.sinceRevision : null
            )
          )
        case 'write':
          return json(await this.write(site, body.input as DraftWriteInput))
        case 'subscribe':
          return json(await this.subscribe(site, body.viewer))
        case 'snapshot':
          return json(await this.snapshot(site))
        case 'published':
          return json(
            await this.markPublished(
              site,
              Number(body.revision),
              (body.published as DraftSnapshot | null) ?? null
            )
          )
        case 'discardPreview':
          return json(await this.discardPreview(site))
        case 'discard':
          return json(await this.discard(site, body.input as DraftDiscardInput))
        case 'discarded':
          return json({snapshot: await this.discardedSnapshot(site)})
        default:
          return json({error: `unknown draft operation ${op}`}, 404)
      }
    } catch (error) {
      console.error('jaen-agent draft object', op, error)

      // A refusal this object means is answered with its own code and its own
      // status, so the Worker can turn it back into the refusal the client
      // knows rather than into "the draft store is unreachable", which is what
      // every 500 out of here becomes and which would make a client wait and
      // retry for ever.
      const known = error as {code?: string; status?: number; message?: string}

      return json(
        {
          error: known?.message ?? String(error),
          code: known?.code ?? null,
          ...(known?.code === 'DRAFT_DISCARDED'
            ? {
                discardedRevision: (error as DraftDiscardedWriteError)
                  .discardedRevision,
                discardedAt: (error as DraftDiscardedWriteError).discardedAt,
                discardedByName: (error as DraftDiscardedWriteError)
                  .discardedByName
              }
            : {})
        },
        known?.status ?? 500
      )
    }
  }

  // ------------------------------------------------------------------
  // meta
  // ------------------------------------------------------------------

  private async meta(site: string): Promise<DraftMeta> {
    const stored = await this.storage.get<DraftMeta>(KEY.meta)

    if (stored)
      return {...emptyMeta(site), ...stored, site: stored.site || site}

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
      // Every read carries the invalidation, and not only the socket frame:
      // a browser that was offline through a discard was not there for the
      // frame, and the first answer it gets has to tell it that what it holds
      // was thrown away.
      discardedRevision: meta.discardedRevision,
      discardedAt: meta.discardedAt,
      discardedBy: meta.discardedBy,
      discardedByName: meta.discardedByName,
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
      if (value.r > since && value.v)
        pages[key.slice(KEY.page.length)] = value.v
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
      if (value.r > since && value.v)
        authors[key.slice(KEY.author.length)] = value.v
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

    /**
     * The one write this store refuses, see DraftDiscardedWriteError.
     *
     * A base below the last discard's revision is a browser holding the draft
     * that was discarded, so its unsent changes are the ones an admin asked to
     * be gone. `baseRevision === discardedRevision` is the browser that has
     * already read the discard, and it is accepted: whatever it sends now was
     * typed against the restored draft.
     *
     * A write that volunteers no base at all is **not** refused, because the
     * object cannot tell a stale client from a caller that never sends one,
     * and refusing every such write would break a client this interface still
     * allows. The shipped CMS always sends a base.
     */
    if (
      meta.discardedRevision > 0 &&
      typeof input.baseRevision === 'number' &&
      input.baseRevision < meta.discardedRevision
    ) {
      throw new DraftDiscardedWriteError(meta)
    }

    const beforeMediaField = stable(meta.mediaField)
    const revision = meta.revision + 1

    /**
     * A write that volunteers no base is treated as maximally stale.
     *
     * `rebased` used to be false whenever `baseRevision` was absent, so a
     * caller that simply did not send one replaced another editor's field,
     * was told `rebased: false` and `overwrote: []`, and the other editor was
     * never named. Nothing was lost by it, because a write is applied either
     * way and this store never rejects one, and the answer said the opposite
     * of what had happened. The shipped client always sends a base, so this
     * is a property of the interface rather than a live defect, and an
     * interface whose safest field is optional is one a second client will
     * get wrong. An object that holds nothing yet cannot be written onto
     * stale, which is why revision 0 is not treated as a rebase.
     */
    const rebased =
      typeof input.baseRevision === 'number'
        ? input.baseRevision !== meta.revision
        : meta.revision > 0

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
      // Every field write stamps the page's `modifiedAt`, whether or not it
      // changed anything, so the page node always serialises differently and
      // a write that changed nothing cannot be told apart by comparison
      // alone. The stamp is put back where it was in exactly that case, below.
      const beforeModified = new Map(
        Object.entries(draft.pages).map(([id, page]) => [id, page.modifiedAt])
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

        // A page whose only difference is the stamp the write itself put on
        // it. Nothing about the content moved, so the stamp goes back and the
        // key is not written: "modified" is a claim about content and a save
        // of the value that is already there did not modify anything.
        const wasModified = beforeModified.get(id)

        if (wasModified !== undefined && page.modifiedAt !== wasModified) {
          const stamped = page.modifiedAt

          page.modifiedAt = wasModified

          if (beforePages.get(id) === stable(page)) continue

          page.modifiedAt = stamped
        }

        writes.set(KEY.page + id, {
          r: revision,
          v: page
        } as Stored<JaenPageNode>)
      }

      for (const widget of draft.widgets) {
        if (beforeWidgets.get(widget.id) === stable(widget)) continue

        writes.set(KEY.widget + widget.id, {
          r: revision,
          v: widget
        } as Stored<JaenWidget>)
      }

      if (stable(draft.site) !== beforeSite) {
        writes.set(KEY.site, {
          r: revision,
          v: draft.site
        } as Stored<JaenSiteState>)
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
        change.value &&
        typeof change.value === 'object' &&
        !Array.isArray(change.value)
          ? (change.value as Record<string, unknown>)
          : {}

      if (change.kind === 'fieldWrite') {
        // The whole catalogue at once, which is what a client that cannot
        // send a merge does. Everything it does not name is gone.
        const given = new Set(Object.keys(entries))

        for (const [storedKey, value] of await this.listAll<unknown>(
          KEY.media
        )) {
          const id = storedKey.slice(KEY.media.length)

          if (given.has(id) || value.deleted) continue

          writes.set(storedKey, {
            r: revision,
            deleted: true,
            t: Date.now()
          } as Stored<unknown>)
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

          writes.set(KEY.media + id, {
            r: revision,
            deleted: true,
            t: Date.now()
          } as Stored<unknown>)
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

    /**
     * A save that changes nothing does not move the revision.
     *
     * The CMS reads `revision > publishedRevision` as "there is something
     * unpublished", and a write of a value identical to the one already in
     * the draft used to bump the revision all the same, so a person who
     * clicked into a field and left it again was told the site had unpublished
     * changes it did not have. Author keys do not count as a change for the
     * same reason: nobody wrote a value that is already there, so nobody
     * should be named as its last writer.
     *
     * `overwrote` and `touched` are still answered, because they describe what
     * the batch asked for, and `keys: 0` is what says nothing was written.
     */
    const wroteContent =
      Array.from(writes.keys()).some(key => !key.startsWith(KEY.author)) ||
      stable(meta.mediaField) !== beforeMediaField

    if (!wroteContent) {
      return {
        revision: meta.revision,
        rebased,
        overwrote,
        touched,
        keys: 0,
        savedAt: stampedAt
      }
    }

    meta.revision = revision
    meta.updatedAt = stampedAt
    meta.updatedBy = author.sub
    // The name beside the subject, because a confirmation and a push have to
    // print who wrote something and a Zitadel subject is not a person's name.
    meta.updatedByName = author.name
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

  /**
   * What publish took, and the state it wrote, which is what a discard
   * restores.
   *
   * The number alone was enough while nothing could put the draft back. It is
   * not enough now: `draft-state.md` says a discard restores "from the
   * snapshot publish keeps rather than by replaying the chain, so the result
   * is exactly what the last migration produced", and only the payload that
   * publish uploaded is exactly that. Taking a fresh snapshot here would keep
   * whatever the draft holds at this instant, which is the published state
   * plus any save that landed while the commit was being made.
   *
   * The state is stored beside the meta rather than in place of it, and the
   * two are written in one handler, so an object that has a `publishedRevision`
   * always has the state that goes with it.
   */
  async markPublished(
    site: string,
    revision: number,
    published?: DraftSnapshot | null
  ): Promise<DraftMeta> {
    const meta = await this.meta(site)

    meta.publishedRevision = Number.isFinite(revision)
      ? revision
      : meta.revision

    if (published?.data) {
      const bytes = await this.writePublished({
        ...published,
        revision: meta.publishedRevision
      })

      meta.publishedAt = published.takenAt ?? new Date().toISOString()
      meta.publishedBytes = bytes
    }

    await this.storage.put(KEY.meta, meta)

    return meta
  }

  // ------------------------------------------------------------------
  // the published state, which is what a discard restores
  // ------------------------------------------------------------------

  /** Chunked, and the old chunks go first so a shorter state cannot leave a tail. */
  private async writePublished(snapshot: DraftSnapshot): Promise<number> {
    const body = JSON.stringify(snapshot)
    const stale = (await this.listAll<unknown>(KEY.published)).map(
      ([key]) => key
    )

    for (let i = 0; i < stale.length; i += PUT_BATCH) {
      await this.storage.delete(stale.slice(i, i + PUT_BATCH))
    }

    const writes = new Map<string, unknown>()

    for (let i = 0, n = 0; i < body.length; i += CHUNK_BYTES, n += 1) {
      writes.set(
        KEY.published + String(n).padStart(4, '0'),
        body.slice(i, i + CHUNK_BYTES)
      )
    }

    await this.putAll(writes)

    return body.length
  }

  private async readPublished(): Promise<DraftSnapshot | null> {
    const chunks = await this.listAll<unknown>(KEY.published)

    if (chunks.length === 0) return null

    // `listAll` answers in key order and the keys are zero padded, so the
    // chunks come back in the order they were written.
    const body = chunks.map(([, value]) => String(value as unknown)).join('')

    try {
      return JSON.parse(body) as DraftSnapshot
    } catch (error) {
      // A published state that cannot be parsed is a discard that must not be
      // made: restoring half of it would be worse than refusing.
      console.error('jaen-agent: the published state is not readable', error)

      return null
    }
  }

  // ------------------------------------------------------------------
  // discard: the draft put back to what the last publish wrote
  // ------------------------------------------------------------------

  /**
   * The published state, split the way this object stores a draft.
   *
   * `snapshot()` folds the catalogue back into the field it came out of, so a
   * published state carries it inside a page node. Storing it again means
   * taking it out: the pages go to `page:` without it and the catalogue's
   * entries go to `media:` one key each, which is the layout the rest of this
   * file reads and writes.
   */
  private unfold(
    published: DraftSnapshot,
    field: MediaField | null
  ): {
    pages: Record<string, JaenPageNode>
    media: Record<string, unknown>
    site: JaenSiteState
    widgets: JaenWidget[]
  } {
    const pages: Record<string, JaenPageNode> = {}

    for (const page of published.data?.pages ?? []) {
      const id = String(page?.id ?? '')

      if (!id) continue

      pages[id] = {...page}
    }

    const media: Record<string, unknown> = {}

    if (field) {
      const page = pages[field.pageId]
      const value = page?.jaenFields?.[field.fieldType]?.[field.fieldName]
        ?.value as Record<string, unknown> | undefined

      if (value && typeof value === 'object') {
        for (const [id, node] of Object.entries(value)) media[id] = node
      }

      if (page?.jaenFields?.[field.fieldType]?.[field.fieldName]) {
        const byType = {...page.jaenFields[field.fieldType]!}

        delete byType[field.fieldName]

        const fields = {...page.jaenFields}

        if (Object.keys(byType).length) fields[field.fieldType] = byType
        else delete fields[field.fieldType]

        pages[field.pageId] = {...page, jaenFields: fields}
      }
    }

    return {
      pages,
      media,
      site: published.data?.site ?? {siteMetadata: {}},
      widgets: published.data?.widgets ?? []
    }
  }

  /** Every field of a page as `pageId/fieldType/fieldName`, plus its sections. */
  private fieldKeysOf(
    id: string,
    page: JaenPageNode | undefined
  ): Map<string, string> {
    const out = new Map<string, string>()

    if (!page) return out

    for (const [type, byName] of Object.entries(page.jaenFields ?? {})) {
      for (const [name, value] of Object.entries(byName ?? {})) {
        out.set(`${id}/${type}/${name}`, stable(value))
      }
    }

    if (page.sections?.length) out.set(`${id}/sections`, stable(page.sections))

    // Everything about the page that is not a field and not its own stamp.
    // `modifiedAt` is left out on purpose: a discard is about content, and a
    // page whose only difference is when it was touched has nothing to undo.
    // `id` goes because it is the key this is already indexed by, and a
    // snapshot writes it into the node where the store's own page key may not
    // have it.
    const {jaenFields, sections, modifiedAt, id: _id, ...rest} = page

    out.set(`${id}/page`, stable(rest))

    return out
  }

  /**
   * What the draft holds that the last publish did not, in the shape a
   * confirmation reads out.
   *
   * The diff is taken against the published state and never against the chain:
   * the chain is what a build replays, and replaying it here would restore
   * something the last migration did not produce whenever a build and a
   * publish disagree.
   */
  private diffSnapshots(
    meta: DraftMeta,
    current: DraftSnapshot,
    published: DraftSnapshot
  ): {
    pages: number
    fields: number
    fieldKeys: string[]
    pagesAdded: string[]
    pagesRemoved: string[]
    mediaAdded: number
    mediaRemoved: number
    /** A picture whose node differs. It is neither added nor removed, and it
     * is still a difference, so it counts in `fields` through the catalogue's
     * own key and not in either of the two numbers a person reads. */
    mediaChanged: number
    siteChanged: boolean
    widgetsChanged: number
  } {
    // Both sides go through the same fold, which is the whole reason this
    // takes two snapshots rather than the draft's own keys on one side. A
    // snapshot carries a page's `id` inside the node and makes a page for the
    // catalogue's own field even where the draft store holds none, so the two
    // shapes differ in ways that have nothing to do with anybody's edit: the
    // first cut compared the store against a snapshot and reported the site
    // as changed the instant after it was published.
    const target = this.unfold(published, meta.mediaField)
    const draft = this.unfold(current, meta.mediaField)

    const ids = new Set([
      ...Object.keys(draft.pages),
      ...Object.keys(target.pages)
    ])

    const fieldKeys: string[] = []
    const pagesAdded: string[] = []
    const pagesRemoved: string[] = []
    let pages = 0

    for (const id of ids) {
      const here = draft.pages[id]
      const there = target.pages[id]

      if (here && !there) pagesAdded.push(id)
      if (!here && there) pagesRemoved.push(id)

      const a = this.fieldKeysOf(id, here)
      const b = this.fieldKeysOf(id, there)
      let differs = false

      for (const key of new Set([...a.keys(), ...b.keys()])) {
        if (a.get(key) === b.get(key)) continue

        fieldKeys.push(key)
        differs = true
      }

      if (differs) pages += 1
    }

    let mediaAdded = 0
    let mediaRemoved = 0
    let mediaChanged = 0

    // The catalogue as both sides hold it. A tombstone never appears here,
    // because a snapshot is the catalogue as it is, so a deleted picture is
    // simply one the draft no longer names.
    for (const [id, node] of Object.entries(draft.media)) {
      if (!Object.prototype.hasOwnProperty.call(target.media, id)) {
        mediaAdded += 1
      } else if (stable(node) !== stable(target.media[id])) {
        mediaChanged += 1
      }
    }

    for (const id of Object.keys(target.media)) {
      if (!Object.prototype.hasOwnProperty.call(draft.media, id)) {
        mediaRemoved += 1
      }
    }

    if ((mediaAdded || mediaRemoved || mediaChanged) && meta.mediaField) {
      fieldKeys.push(
        `${meta.mediaField.pageId}/${meta.mediaField.fieldType}/${meta.mediaField.fieldName}`
      )
    }

    const siteChanged = stable(draft.site) !== stable(target.site)

    if (siteChanged) fieldKeys.push('site/siteMetadata')

    const byId = new Map(target.widgets.map(w => [w.id, stable(w)]))
    let widgetsChanged = 0

    for (const widget of draft.widgets) {
      if (byId.get(widget.id) === stable(widget)) continue

      widgetsChanged += 1
      fieldKeys.push(`widget/${widget.id}`)
    }

    const here = new Set(draft.widgets.map(w => w.id))

    for (const widget of target.widgets) {
      if (here.has(widget.id)) continue

      widgetsChanged += 1
      fieldKeys.push(`widget/${widget.id}`)
    }

    return {
      pages,
      fields: fieldKeys.length,
      fieldKeys,
      pagesAdded,
      pagesRemoved,
      mediaAdded,
      mediaRemoved,
      mediaChanged,
      siteChanged,
      widgetsChanged
    }
  }

  /** Who wrote the fields that differ, latest instant per person. */
  private async editorsOf(fieldKeys: string[]): Promise<DraftEditor[]> {
    const authors = await this.loadAuthors(fieldKeys)
    const bySub = new Map<string, DraftEditor>()

    for (const author of Object.values(authors)) {
      if (!author?.sub) continue

      const known = bySub.get(author.sub)

      if (!known || (author.at ?? '') > (known.at ?? '')) {
        bySub.set(author.sub, {
          sub: author.sub,
          name: author.name,
          at: author.at ?? null
        })
      }
    }

    return Array.from(bySub.values()).sort((a, b) =>
      (a.at ?? '') < (b.at ?? '') ? -1 : 1
    )
  }

  async discardPreview(site: string): Promise<DraftDiscardPreview> {
    const meta = await this.meta(site)
    const takenAt = new Date().toISOString()
    const base = {
      site,
      revision: meta.revision,
      publishedRevision: meta.publishedRevision,
      pages: 0,
      fields: 0,
      pagesAdded: [] as string[],
      pagesRemoved: [] as string[],
      mediaAdded: 0,
      mediaRemoved: 0,
      siteChanged: false,
      widgetsChanged: 0,
      editors: [] as DraftEditor[],
      since: null as string | null,
      publishedAt: meta.publishedAt,
      takenAt
    }

    const published = await this.readPublished()

    if (!published) {
      return {
        ...base,
        canDiscard: false,
        reason:
          'This site has not been published since the draft store began ' +
          'keeping what a publish wrote, so there is no published state to ' +
          'restore. Publish once and the next discard can undo everything ' +
          'after it.'
      }
    }

    const diff = this.diffSnapshots(meta, await this.snapshot(site), published)
    const editors = await this.editorsOf(diff.fieldKeys)

    // `fields` carries the catalogue's own key whenever a picture moved, so
    // it is the whole test and the media counts are what the person reads.
    const nothing = diff.fields === 0

    return {
      ...base,
      pages: diff.pages,
      fields: diff.fields,
      pagesAdded: diff.pagesAdded,
      pagesRemoved: diff.pagesRemoved,
      mediaAdded: diff.mediaAdded,
      mediaRemoved: diff.mediaRemoved,
      siteChanged: diff.siteChanged,
      widgetsChanged: diff.widgetsChanged,
      editors,
      since: editors[0]?.at ?? null,
      canDiscard: !nothing,
      reason: nothing
        ? 'Nothing in the draft differs from the published state.'
        : null
    }
  }

  /**
   * Every unpublished change of this site, undone at once.
   *
   * The order is the safety and it is the whole of this operation:
   *
   *   1. the draft as it stands is written to the backstop, under its own key,
   *      so the discard is undoable and nothing a person wrote is destroyed by
   *      a machine;
   *   2. the object is read again, because step 1 is a KV write and a save can
   *      land while it is in flight. A draft that moved is snapshotted again
   *      rather than discarded around, which is the only way the backstop can
   *      be a true "one instant before";
   *   3. the keys are rewritten to the published state and everything the
   *      published state does not name is deleted;
   *   4. `prunedBefore` is raised to this revision, so every reader is
   *      answered with the whole draft rather than a delta. The delta
   *      vocabulary has no page tombstone, so a discard that removed a page
   *      could not be described as one, and a reader would keep a page that
   *      is gone;
   *   5. every editor is pushed the new revision together with who discarded
   *      and when, and a client below the invalidation drops its outbox.
   */
  async discard(
    site: string,
    input: DraftDiscardInput
  ): Promise<DraftDiscardResult> {
    const actor = input?.actor ?? {sub: '', name: '', email: ''}
    let meta = await this.meta(site)
    const at = new Date().toISOString()

    const refuse = (reason: string): DraftDiscardResult => ({
      site,
      discarded: false,
      revision: meta.revision,
      previousRevision: meta.revision,
      publishedRevision: meta.publishedRevision,
      pages: 0,
      fields: 0,
      editors: [],
      snapshotRevision: 0,
      snapshotAt: null,
      snapshotBytes: 0,
      by: {sub: actor.sub, name: actor.name, at},
      at,
      reason
    })

    if (
      typeof input?.atRevision === 'number' &&
      input.atRevision !== meta.revision
    ) {
      return refuse(
        `The draft moved from revision ${input.atRevision} to ` +
          `${meta.revision} while the confirmation was open, so it no longer ` +
          `says what would go. Nothing was discarded; ask again.`
      )
    }

    const published = await this.readPublished()

    if (!published) {
      return refuse(
        'This site has not been published since the draft store began ' +
          'keeping what a publish wrote, so there is no published state to ' +
          'restore and nothing was discarded.'
      )
    }

    // Taken before anything is written, because the backstop rotates the
    // previous discard's copy into `:previous` and a discard that turns out to
    // have nothing to do must not cost the undo of the one before it.
    let diff = this.diffSnapshots(meta, await this.snapshot(site), published)

    if (diff.fields === 0) {
      // Nothing to undo. The revision may still be past the published one,
      // which happens when an edit and its own undo were both saved, and the
      // CMS reads that as "there is something unpublished" for ever. The
      // stamp is corrected without a revision, without a snapshot and without
      // a push, because no content moves.
      if (meta.revision > meta.publishedRevision) {
        meta.publishedRevision = meta.revision

        await this.storage.put(KEY.meta, meta)
      }

      return refuse('Nothing in the draft differs from the published state.')
    }

    let before: DraftSnapshot | null = null
    let snapshotBytes = 0

    for (let attempt = 1; attempt <= DISCARD_ATTEMPTS; attempt += 1) {
      before = await this.snapshot(site)
      // The first attempt rotates the previous discard's backstop into place
      // beside it, a retry replaces its own first attempt: rotating on every
      // attempt would push the older discard's copy out of the store because
      // somebody happened to type during this one.
      snapshotBytes = await this.sink.put(before, 'discard', attempt === 1)

      const now = await this.meta(site)

      if (now.revision === before.revision) {
        meta = now
        break
      }

      // Somebody saved while the backstop was being written. The backstop
      // would then be missing their work and the discard would take it, which
      // is the one loss this whole design exists to prevent.
      meta = now
      before = null

      if (attempt === DISCARD_ATTEMPTS) {
        return refuse(
          `The draft was written to ${DISCARD_ATTEMPTS} times while the ` +
            `backstop was being taken, so nothing was discarded. Try again ` +
            `when the other editors have stopped typing.`
        )
      }
    }

    if (!before) return refuse('The backstop could not be taken.')

    // Against the very snapshot that went into the backstop, so what the
    // answer says went is what the backstop holds.
    diff = this.diffSnapshots(meta, before, published)

    const editors = await this.editorsOf(diff.fieldKeys)
    const revision = meta.revision + 1
    const target = this.unfold(published, meta.mediaField)

    const writes = new Map<string, unknown>()
    const gone: string[] = []

    for (const [id, page] of Object.entries(target.pages)) {
      writes.set(KEY.page + id, {r: revision, v: page} as Stored<JaenPageNode>)
    }

    for (const [key] of await this.listAll<JaenPageNode>(KEY.page)) {
      const id = key.slice(KEY.page.length)

      if (!Object.prototype.hasOwnProperty.call(target.pages, id))
        gone.push(key)
    }

    for (const [id, node] of Object.entries(target.media)) {
      writes.set(KEY.media + id, {r: revision, v: node} as Stored<unknown>)
    }

    // A tombstone is not written for a picture a discard removes, and a
    // tombstone the draft carried is deleted outright, because step 4 forces
    // every reader into a full answer and a full answer is the catalogue as it
    // is. Keeping them would only cost storage and confuse the next prune.
    for (const [key] of await this.listAll<unknown>(KEY.media)) {
      const id = key.slice(KEY.media.length)

      if (!Object.prototype.hasOwnProperty.call(target.media, id))
        gone.push(key)
    }

    for (const widget of target.widgets) {
      writes.set(KEY.widget + widget.id, {
        r: revision,
        v: widget
      } as Stored<JaenWidget>)
    }

    const keep = new Set(target.widgets.map(widget => widget.id))

    for (const [key] of await this.listAll<JaenWidget>(KEY.widget)) {
      if (!keep.has(key.slice(KEY.widget.length))) gone.push(key)
    }

    writes.set(KEY.site, {r: revision, v: target.site} as Stored<JaenSiteState>)

    // The authorship of the published state, which publish recorded with it.
    // Everything else is authorship of an edit that no longer exists, so it
    // goes: leaving it would attribute a published field to whoever last
    // changed it in a draft that has been thrown away.
    const authors = published.authors ?? {}

    for (const [key, author] of Object.entries(authors)) {
      writes.set(KEY.author + key, {
        r: revision,
        v: author
      } as Stored<FieldAuthor>)
    }

    for (const [key] of await this.listAll<FieldAuthor>(KEY.author)) {
      if (
        !Object.prototype.hasOwnProperty.call(
          authors,
          key.slice(KEY.author.length)
        )
      )
        gone.push(key)
    }

    for (let i = 0; i < gone.length; i += PUT_BATCH) {
      await this.storage.delete(gone.slice(i, i + PUT_BATCH))
    }

    meta.revision = revision
    meta.updatedAt = at
    meta.updatedBy = actor.sub
    meta.updatedByName = actor.name
    meta.discardedRevision = revision
    meta.discardedAt = at
    meta.discardedBy = actor.sub
    meta.discardedByName = actor.name
    // Every reader is answered whole, see step 4 above.
    meta.prunedBefore = revision
    /**
     * The published stamp moves with it, and that is a claim worth defending.
     * What the object holds after this call is exactly what the last migration
     * produced, so there is nothing unpublished in it, and leaving
     * `publishedRevision` behind would make every CMS say "not published"
     * about content the site already serves and would invite a publish that
     * writes a migration saying what the chain already says.
     */
    meta.publishedRevision = revision

    writes.set(KEY.meta, meta)

    await this.putAll(writes)

    this.broadcast({
      type: 'discard',
      site,
      revision,
      // Named twice on purpose: a client reads `revision` to know there is
      // something new, and `invalidatedRevision` to know that what it holds
      // below that number is to be dropped rather than folded back on top.
      invalidatedRevision: revision,
      publishedRevision: revision,
      by: actor.sub,
      name: actor.name,
      at
    })

    await this.armSnapshot()

    return {
      site,
      discarded: true,
      revision,
      previousRevision: before.revision,
      publishedRevision: revision,
      pages: diff.pages,
      fields: diff.fields,
      editors,
      snapshotRevision: before.revision,
      snapshotAt: before.takenAt,
      snapshotBytes,
      by: {sub: actor.sub, name: actor.name, at},
      at,
      reason: null
    }
  }

  /**
   * The draft as it stood one instant before the last discard.
   *
   * It is the read half of the backstop and it is not restore: it answers what
   * was taken and writes nothing. Restore is the third of the three acts and
   * is not built (draft-state.md, "Three operations that rewrite the shared
   * draft"); until it is, this is how a person establishes that a discard is
   * undoable rather than being asked to believe it.
   */
  async discardedSnapshot(site: string): Promise<DraftSnapshot | null> {
    return await this.sink.get(site, 'discard')
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
      const pruned = await this.pruneTombstones()

      // Read again rather than writing back the meta this handler started
      // with. The object is single threaded and its input gate closes around
      // a storage operation, but the snapshot above is a KV write and not
      // storage, so a save can land while it is in flight. Writing the old
      // object back would roll the revision counter backwards, and a revision
      // that is handed out twice is two editors' work under one number.
      const now = await this.meta(meta.site)

      now.snapshotRevision = snapshot.revision
      now.snapshotAt = snapshot.takenAt
      now.snapshotBytes = bytes

      // Only a tombstone that is actually gone narrows the window a delta can
      // be answered in, and it narrows it to the highest revision that was
      // pruned and no further.
      if (pruned > now.prunedBefore) now.prunedBefore = pruned

      await this.storage.put(KEY.meta, now)
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

  /**
   * Set only when none is pending, so a burst of saves does not push it out.
   *
   * A pending alarm whose time has passed is set again rather than trusted: an
   * alarm that was scheduled and did not run is not going to run because it is
   * still in the store, and without this line a draft can sit unsnapshotted
   * behind a stale alarm for as long as the object lives.
   */
  private async armSnapshot(at?: number): Promise<void> {
    const pending = await this.storage.getAlarm()
    const when = at ?? Date.now() + this.interval()

    if (pending === null || pending > when || pending <= Date.now()) {
      await this.storage.setAlarm(when)
    }
  }

  private async onLastEditorLeft(): Promise<void> {
    if (this.state.getWebSockets().length > 0) return

    await this.armSnapshot(Date.now() + LAST_EDITOR_MS)
  }

  /** Answers the highest revision it removed, which is the new window. */
  private async pruneTombstones(): Promise<number> {
    const older = Date.now() - TOMBSTONE_TTL_MS
    const gone: string[] = []
    let highest = 0

    for (const [key, value] of await this.listAll<unknown>(KEY.media)) {
      if (!value.deleted) continue
      // A tombstone without a stamp was written before this file carried one.
      if ((value.t ?? 0) > older) continue

      gone.push(key)
      highest = Math.max(highest, value.r)
    }

    for (let i = 0; i < gone.length; i += PUT_BATCH) {
      await this.storage.delete(gone.slice(i, i + PUT_BATCH))
    }

    return highest
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
      await this.storage.put(
        Object.fromEntries(entries.slice(i, i + PUT_BATCH))
      )
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

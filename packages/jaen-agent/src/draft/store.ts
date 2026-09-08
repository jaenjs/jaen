/**
 * The draft store, behind one narrow interface.
 *
 * A draft changes every few seconds, is mutable, is shared between the people
 * editing right now and matters for hours. A migration is made rarely, is
 * immutable and is the site's content. They have separate homes, and this is
 * the first one: nothing here touches git and nothing here touches the storage
 * gateway. See docs/architecture/draft-state.md, "The two lifecycles".
 *
 * The interface is a requirement of the design and not an afterthought. One
 * implementation runs on a Cloudflare Durable Object today (./durable and
 * ./object). One will run on a single process with SQLite the day the estate
 * wants its own machine, where the serialisation guarantee is free because
 * there is only one process. So nothing above this file knows what a Durable
 * Object is: the resolvers call the four operations and no Cloudflare type
 * appears in their signatures.
 *
 * Four operations for the editors:
 *
 *   read(site, sinceRevision?)   the keys at or above that revision
 *   write(site, input)           the new revision, or a rebase
 *   subscribe(site, viewer)      a handle onto the stream of revisions
 *   snapshot(site)               the whole draft, for the alarm and for publish
 *
 * And two things beside them, which are deliberately not part of the four and
 * are named here rather than hidden:
 *
 *   markPublished(site, revision) publish stamps what it published. The design
 *                                 puts `publishedRevision` in the object's meta
 *                                 key, and only the publish path can set it, so
 *                                 it cannot be one of the editors' operations
 *                                 and it cannot be left out either. Every
 *                                 implementation has to provide it.
 *   connect(site, ticket, req)    transport. `subscribe` mints the handle; the
 *                                 stream itself is a WebSocket the browser
 *                                 holds, and a promise of an async iterable
 *                                 cannot cross a Worker's request boundary. A
 *                                 single process implementation upgrades the
 *                                 same way, so this is plumbing rather than a
 *                                 second design.
 *
 * And the acts that rewrite the whole draft at once, of which one is built:
 *
 *   discardPreview(site)          what a discard would undo, so the person who
 *                                 asks for one is shown what will go before it
 *                                 goes.
 *   discard(site, input)          the draft is put back to the state the last
 *                                 publish wrote, from the snapshot that publish
 *                                 kept and never by replaying the chain.
 *   discardedSnapshot(site)       the draft as it was one instant before the
 *                                 last discard, read back out of the backstop.
 *
 * Import and restore are the other two of that kind (draft-state.md, "Three
 * operations that rewrite the shared draft") and are **not built**. They belong
 * here when they are.
 */
import type {FieldOverwrite, JaenChangeInput} from '../apply-change'
import type {
  FieldAuthors,
  JaenPageNode,
  JaenSiteState,
  JaenWidget
} from '../types'

/**
 * Where the media catalogue lives, learned from the first catalogue write.
 *
 * jaen has exactly one field that holds a catalogue rather than a value,
 * `useField('media_nodes', 'IMA:MEDIA_NODES')` on the media page, and the
 * object stores its entries one key per node. Reassembling the draft means
 * putting them back into that one field, so the object remembers which field
 * it was rather than hardcoding a page id.
 */
export interface MediaField {
  pageId: string
  fieldType: string
  fieldName: string
}

export interface DraftMeta {
  /** The site key, learned from the first call, so the object can name itself. */
  site: string
  /** Bumped once per accepted write. The whole concurrency story. */
  revision: number
  /** What publish last wrote as a migration. 0 until it has. */
  publishedRevision: number
  /** When that publish was made, and how large the state it wrote is. */
  publishedAt: string | null
  publishedBytes: number
  updatedAt: string | null
  /** The Zitadel subject of the last writer. */
  updatedBy: string | null
  /** And their display name, which is what a confirmation can print. */
  updatedByName: string | null
  /**
   * The revision the last discard produced, and who made it.
   *
   * It is the invalidation the design asks for: a client holding a revision
   * **below** this one is holding a draft that was thrown away, so it drops
   * its outbox and its local copy instead of folding them back on top. Every
   * read carries it, so a browser that was offline through the discard learns
   * of it on the first answer it gets rather than only from a socket frame it
   * was not there for.
   */
  discardedRevision: number
  discardedAt: string | null
  discardedBy: string | null
  discardedByName: string | null
  /** The revision the last snapshot was taken at. */
  snapshotRevision: number
  snapshotAt: string | null
  snapshotBytes: number
  /**
   * A reader whose sinceRevision is below this cannot be answered with a
   * delta, because the tombstones it would need are gone, so it is answered
   * with the whole draft instead. Raised by the alarm when it prunes.
   */
  prunedBefore: number
  mediaField: MediaField | null
  createdAt: string
}

/**
 * What changed at or above the reader's revision.
 *
 * A page is carried whole, because a page node is small (booklimo's ten pages
 * are 1,899 bytes on disk together) and a field level delta of a page would be
 * a second merge algorithm beside the build's. The catalogue is not carried
 * whole, because it is 118 KB, which is the entire reason its nodes are one
 * key each.
 */
export interface DraftDelta {
  /** Page id to page node, the shape the redux `page` slice has. */
  pages: Record<string, JaenPageNode>
  /** Media node id to node, for the field `mediaField` names. */
  media: Record<string, unknown>
  /** Media nodes that went. Empty in a full answer. */
  removedMedia: string[]
  /** Present only when the site metadata changed. */
  site: JaenSiteState | null
  widgets: JaenWidget[]
  /** fieldKey to {sub, name, at}, the ones this delta touched. */
  authors: FieldAuthors
  mediaField: MediaField | null
}

export interface DraftRead {
  site: string
  revision: number
  publishedRevision: number
  /** False when the reader's sinceRevision is already the object's revision. */
  changed: boolean
  /**
   * True when the answer replaces the reader's copy instead of merging onto
   * it. A reader with no revision, a revision older than the pruned window,
   * or a revision the object has never reached (which is what a lost object
   * looks like from the outside) gets one of these.
   */
  full: boolean
  delta: DraftDelta | null
  updatedAt: string | null
  updatedBy: string | null
  /**
   * The invalidation, carried by every read.
   *
   * A client whose own revision is below `discardedRevision` was holding a
   * draft that has been thrown away. It drops its outbox and its local copy
   * and takes this answer whole, which is why a discard also forces every
   * reader into a full answer. Zero means no discard has ever been made.
   */
  discardedRevision: number
  discardedAt: string | null
  discardedBy: string | null
  discardedByName: string | null
  snapshotRevision: number
  snapshotAt: string | null
  snapshotBytes: number
  readAt: string
}

/** One person, as a confirmation and a push have to name them. */
export interface DraftEditor {
  sub: string
  name: string
  at: string | null
}

/**
 * What a discard would undo, so that the confirmation names it before it is
 * made. `draft-state.md`: "behind a confirmation that names what will go: how
 * many pages, whose edits, since when".
 */
export interface DraftDiscardPreview {
  site: string
  revision: number
  publishedRevision: number
  /**
   * False when there is nothing to discard, and false when there is nothing
   * to restore **to**, which is the case this design cannot fix by trying
   * harder: the published state comes from the snapshot publish keeps, and an
   * object that has not published since that snapshot was introduced has none.
   * Replaying the chain instead is what the design explicitly does not do.
   */
  canDiscard: boolean
  reason: string | null
  /** Pages whose content differs from the published state. */
  pages: number
  /** Field keys that differ, the media catalogue counted as one. */
  fields: number
  /** Pages that exist only in the draft, which a discard removes. */
  pagesAdded: string[]
  /** Pages the draft dropped, which a discard brings back. */
  pagesRemoved: string[]
  mediaAdded: number
  mediaRemoved: number
  siteChanged: boolean
  widgetsChanged: number
  /** Who wrote the unpublished fields, and when they last did. */
  editors: DraftEditor[]
  /** The oldest of those instants, which is the "since when". */
  since: string | null
  /** When the state a discard would restore was published. */
  publishedAt: string | null
  takenAt: string
}

export interface DraftDiscardInput {
  actor: {sub: string; name: string; email: string}
  /**
   * The revision the confirmation named. A draft that has moved since is a
   * confirmation about something else, so the discard is refused and the
   * person is shown the new one. Null accepts whatever is there now.
   */
  atRevision: number | null
}

export interface DraftDiscardResult {
  site: string
  discarded: boolean
  /** The revision the discard produced, which is also the invalidation. */
  revision: number
  /** The revision it replaced. */
  previousRevision: number
  publishedRevision: number
  /** What the confirmation said would go, as it actually went. */
  pages: number
  fields: number
  editors: DraftEditor[]
  /** The backstop taken one instant before, so a discard is undoable. */
  snapshotRevision: number
  snapshotAt: string | null
  snapshotBytes: number
  by: DraftEditor
  at: string
  reason: string | null
}

export interface DraftWriteInput {
  changes: JaenChangeInput[]
  /** The revision the client last saw. Null means "whatever is there now". */
  baseRevision: number | null
  author: {sub: string; name: string; email: string}
}

export interface DraftWriteResult {
  revision: number
  /** True when baseRevision was not the object's revision, see the rebase. */
  rebased: boolean
  /** The fields whose value this write replaced, and who had written them. */
  overwrote: FieldOverwrite[]
  /** The field keys this write stamped. */
  touched: string[]
  /** How many storage keys it wrote, which is the cost of a save. */
  keys: number
  savedAt: string
}

/** The handle `subscribe` mints, single use and short lived. */
export interface DraftTicket {
  site: string
  ticket: string
  /** Where to open the socket. Filled in by the transport that answers. */
  url: string
  expiresAt: string
  /** The revision at the moment the ticket was minted. */
  revision: number
}

export interface DraftSnapshot {
  site: string
  revision: number
  takenAt: string
  data: {
    pages: JaenPageNode[]
    site: JaenSiteState
    widgets: JaenWidget[]
  }
  authors: FieldAuthors
}

export interface DraftStore {
  read(site: string, sinceRevision?: number | null): Promise<DraftRead>
  write(site: string, input: DraftWriteInput): Promise<DraftWriteResult>
  subscribe(
    site: string,
    viewer: {sub: string; name: string; email: string}
  ): Promise<DraftTicket>
  snapshot(site: string): Promise<DraftSnapshot>
  /**
   * Not one of the four, see the header.
   *
   * It carries the state it published and not only the number, because that
   * state is what a discard restores. Taking a fresh snapshot at discard time
   * would restore whatever the draft happens to hold, and reading the chain
   * back would restore what the build replays rather than what this publish
   * wrote. The migration's own payload is the only thing that is exactly "what
   * the last migration produced".
   */
  markPublished(
    site: string,
    revision: number,
    published?: DraftSnapshot | null
  ): Promise<DraftMeta>
  /** What a discard would undo. */
  discardPreview(site: string): Promise<DraftDiscardPreview>
  /** The draft put back to the published state, site wide. */
  discard(site: string, input: DraftDiscardInput): Promise<DraftDiscardResult>
  /** The draft as it stood one instant before the last discard. */
  discardedSnapshot(site: string): Promise<DraftSnapshot | null>
}

/** The keys the object stores, named once so both sides agree. */
export const KEY = {
  meta: 'meta',
  site: 'site',
  page: 'page:',
  media: 'media:',
  widget: 'widget:',
  author: 'author:',
  ticket: 'ticket:',
  /**
   * The state the last publish wrote, in chunks of at most CHUNK_BYTES.
   *
   * It lives in the object's own storage and not in the KV the alarm's
   * backstop goes to, for one reason that decides it: KV is eventually
   * consistent and gives no read-after-write guarantee, so a discard made a
   * second after a publish could restore what KV last settled on rather than
   * what that publish wrote. The object's storage is strongly consistent and
   * is read inside the same single threaded actor that writes it, which also
   * makes the whole discard atomic.
   *
   * Chunked and zero padded (`published:0000`), because one key and its value
   * together may be 2 MB on a SQLite backed object and a site's catalogue is
   * allowed to grow past that. Zero padded because `list` orders keys
   * lexicographically and `published:10` sorts before `published:2`.
   */
  published: 'published:'
} as const

export const emptyMeta = (site: string): DraftMeta => ({
  site,
  revision: 0,
  publishedRevision: 0,
  publishedAt: null,
  publishedBytes: 0,
  updatedAt: null,
  updatedBy: null,
  updatedByName: null,
  discardedRevision: 0,
  discardedAt: null,
  discardedBy: null,
  discardedByName: null,
  snapshotRevision: 0,
  snapshotAt: null,
  snapshotBytes: 0,
  prunedBefore: 0,
  mediaField: null,
  createdAt: new Date().toISOString()
})

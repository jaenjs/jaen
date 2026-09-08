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
  updatedAt: string | null
  /** The Zitadel subject of the last writer. */
  updatedBy: string | null
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
  snapshotRevision: number
  snapshotAt: string | null
  snapshotBytes: number
  readAt: string
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
  /** Not one of the four, see the header. */
  markPublished(site: string, revision: number): Promise<DraftMeta>
}

/** The keys the object stores, named once so both sides agree. */
export const KEY = {
  meta: 'meta',
  site: 'site',
  page: 'page:',
  media: 'media:',
  widget: 'widget:',
  author: 'author:',
  ticket: 'ticket:'
} as const

export const emptyMeta = (site: string): DraftMeta => ({
  site,
  revision: 0,
  publishedRevision: 0,
  updatedAt: null,
  updatedBy: null,
  snapshotRevision: 0,
  snapshotAt: null,
  snapshotBytes: 0,
  prunedBefore: 0,
  mediaField: null,
  createdAt: new Date().toISOString()
})

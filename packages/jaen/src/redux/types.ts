import {JaenPage, IJaenPopup, ISite, Widget} from '../types'
import {FieldOverwrite, JaenAuthors, JaenChange} from './apply-change'

export interface IError {
  code: string
  message: string
  details?: any
}

export interface IPageState {
  pages: {
    lastAddedNodeId?: string
    registeredPageFields: Record<string, number>
    nodes: Record<string, Partial<JaenPage>>
  }
}

export interface IStatusState {
  isPublishing: boolean
  isEditing: boolean
}

export interface IPopupState {
  nodes: Record<string, IJaenPopup>
  advanced: Record<
    string,
    {
      pageViews: number
    }
  >
}

export interface IJaenSiteState {
  siteMetadata: ISite['siteMetadata']
}

export interface IWidgetState {
  nodes: Array<Widget>
}

/**
 * The shared draft's client side. `outbox` is the offline queue: it lives in
 * the store rather than in a module so `persist-state` writes it to
 * localStorage on every action for free, and the flusher drains it when a call
 * succeeds again.
 */
export interface IRemoteState {
  /** The CMS is mounted. Drives the poller together with `status.isEditing`. */
  active: boolean
  outbox: Array<{id: number; change: JaenChange}>
  nextId: number
  /**
   * The highest revision this browser knows the object reached, from any
   * source: a read's answer, a save's answer, a socket frame.
   *
   * It replaced a `headSha` and a `blobSha` on 2026-09-08. A save is no longer
   * a commit and the draft is no longer the repository, so there is nothing a
   * sha could name: the draft lives in one Durable Object per site whose
   * revision is a monotonic counter. See docs/architecture/draft-state.md.
   *
   * It never goes backwards while the object lives. The two operations that
   * may move it down are the two that say the object's history was replaced:
   * `objectRestarted`, which is a new object answering in a lost one's place,
   * and `draftDiscarded`.
   */
  revision?: number
  /**
   * The highest revision whose **content** this browser has merged into its
   * store, and the number a read is asked from.
   *
   * It is not always `revision`, and the difference is the whole of the fix of
   * 2026-09-08 in the evening. A save that came back `rebased` tells this
   * browser the object is at R, and R contains another editor's change this
   * browser has never seen: the object is at R and this copy is not. Keeping
   * the two numbers apart is what lets a read be asked from what is really
   * held while an answer older than this browser's own save is refused.
   *
   * A read is asked from here, a save is based on here, and the answer of a
   * read is applied only when it is strictly above here **and** at or above
   * `revision`. See docs/architecture/draft-state.md, "A field sometimes
   * reverts".
   */
  appliedRevision?: number
  /**
   * How many answers were refused because they were older than what this
   * browser had already applied or already saved.
   *
   * A counter and not a flag, because the notebook's gate asserts that the
   * guard fired rather than inferring it from a value that did not move.
   */
  staleAnswers?: number
  /**
   * The revision the last publish took. `revision > publishedRevision` is the
   * CMS being able to say that what is saved is not yet what the site serves,
   * which is the whole reason the two lifecycles are kept apart.
   */
  publishedRevision?: number
  /**
   * Which path is carrying the other editors' changes right now. `socket` is
   * the object pushing, `poll` is the fallback for a browser whose socket was
   * refused. The poll never stops, it only slows down while a socket is up.
   */
  connection: 'socket' | 'poll'
  /**
   * What the toolbar says. `pending` is a change that has been recorded and is
   * waiting out its quiet window, which is a state the CMS has to be able to
   * say out loud: with saving batched, `idle` with a full outbox would read as
   * "Saved" while nothing had been saved.
   */
  saveState: 'idle' | 'pending' | 'saving' | 'saved' | 'offline' | 'error'
  lastSavedAt?: string
  lastError?: string
  /**
   * When a read last came back at a revision below the one this browser had,
   * which is the site's draft object having been lost and replaced. The answer
   * was not applied, because it is older than what is on the screen.
   */
  objectRestartedAt?: string
  /**
   * The last site wide discard this browser has honoured.
   *
   * A read or a frame carrying a higher number means the draft this browser
   * holds was thrown away by an admin, so the outbox and the local copy are
   * dropped instead of being folded back on top of the answer. Keeping the
   * mark is what makes that happen exactly once per discard, and what lets a
   * browser that was offline through it act on the first answer it gets.
   */
  discardedRevision?: number
  discardedAt?: string
  /** Who discarded, so the CMS says it rather than reverting under a hand. */
  discardedBy?: string
  /** fieldKey -> who last wrote it, from the agent. */
  authors: JaenAuthors
  /** Fields the last save took from somebody else, for the CMS to report. */
  lastOverwrote?: FieldOverwrite[]
}

export interface IJaenState {
  site: IJaenSiteState
  page: IPageState
  status: IStatusState
  popup: IPopupState
  widget: IWidgetState
  remote: IRemoteState
}

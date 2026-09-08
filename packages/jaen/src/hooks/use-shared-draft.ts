/**
 * What the CMS shows instead of a save button.
 *
 * With the agent configured there is no verb called save any more: every change
 * goes into the site's shared draft on its own, so the toolbar shows a state
 * and not a control. This hook is that state, and it is the only thing the CMS
 * needs to know about the shared draft.
 *
 * A save is not a commit and there is no commit URL here any more. What the
 * CMS can say instead, and now does, is whether what is saved is what the site
 * serves: `hasUnpublished` is `revision` past `publishedRevision`, which is
 * the two lifecycles of docs/architecture/draft-state.md made visible in one
 * word.
 */
import {useAppSelector, jaenAgent} from '../redux'
import type {IRemoteState} from '../redux/types'

export interface SharedDraftState {
  /** False on a site built without the `agent` plugin option. */
  enabled: boolean
  /** The site's key in the agent's SITES table. */
  site?: string
  saveState: IRemoteState['saveState']
  /** Changes recorded but not yet committed. */
  pending: number
  /** The instant of the last commit, ISO. */
  /** The instant the draft last took this browser's changes, ISO. */
  lastSavedAt?: string
  lastError?: string
  /** fieldKey -> who last wrote it and when. */
  authors: IRemoteState['authors']
  /** The draft revision this browser last saw. */
  revision?: number
  /** The revision the last publish took. */
  publishedRevision?: number
  /** Saved into the draft, and not yet in anything the site serves. */
  hasUnpublished: boolean
  /** `socket` while the object is pushing, `poll` while it is not. */
  connection: IRemoteState['connection']
  /**
   * The last site wide discard this browser has taken, if any.
   *
   * The CMS says who discarded and when rather than letting the draft change
   * under a person's hands, which is what `draft-state.md` asks of the third
   * of the three acts that rewrite the shared draft.
   */
  discardedRevision?: number
  discardedAt?: string
  discardedBy?: string
}

export const useSharedDraft = (): SharedDraftState => {
  const remote = useAppSelector(state => state.remote)

  return {
    enabled: Boolean(jaenAgent),
    site: jaenAgent?.site,
    saveState: remote?.saveState || 'idle',
    pending: remote?.outbox.length || 0,
    lastSavedAt: remote?.lastSavedAt,
    lastError: remote?.lastError,
    authors: remote?.authors || {},
    revision: remote?.revision,
    publishedRevision: remote?.publishedRevision,
    // Never published at all counts as unpublished the moment anything was
    // saved: a site whose object has a revision and no publish behind it is
    // exactly the case an editor must be told about.
    hasUnpublished:
      typeof remote?.revision === 'number' &&
      remote.revision > (remote.publishedRevision ?? 0),
    connection: remote?.connection || 'poll',
    discardedRevision: remote?.discardedRevision,
    discardedAt: remote?.discardedAt,
    discardedBy: remote?.discardedBy
  }
}

/**
 * What the CMS shows instead of a save button.
 *
 * With the agent configured there is no verb called save any more: every change
 * is committed on its own, so the toolbar shows a state and not a control. This
 * hook is that state, and it is the only thing the CMS needs to know about the
 * shared draft.
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
  lastSavedAt?: string
  /** The last commit's URL on GitHub. Undo is git, and this is the way in. */
  lastCommitUrl?: string
  lastError?: string
  /** fieldKey -> who last wrote it and when. */
  authors: IRemoteState['authors']
  headSha?: string
}

export const useSharedDraft = (): SharedDraftState => {
  const remote = useAppSelector(state => state.remote)

  return {
    enabled: Boolean(jaenAgent),
    site: jaenAgent?.site,
    saveState: remote?.saveState || 'idle',
    pending: remote?.outbox.length || 0,
    lastSavedAt: remote?.lastSavedAt,
    lastCommitUrl: remote?.lastCommitUrl,
    lastError: remote?.lastError,
    authors: remote?.authors || {},
    headSha: remote?.headSha
  }
}

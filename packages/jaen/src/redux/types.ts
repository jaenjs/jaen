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
  /** The branch head the client last saw, sent as `baseSha` and `sinceSha`. */
  headSha?: string
  blobSha?: string
  /**
   * What the toolbar says. `pending` is a change that has been recorded and is
   * waiting out its quiet window, which is a state the CMS has to be able to
   * say out loud: with saving batched, `idle` with a full outbox would read as
   * "Saved" while nothing had been saved.
   */
  saveState: 'idle' | 'pending' | 'saving' | 'saved' | 'offline' | 'error'
  lastSavedAt?: string
  lastCommitUrl?: string
  lastError?: string
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

import {createSlice, PayloadAction} from '@reduxjs/toolkit'

import {FieldOverwrite, JaenAuthors, JaenChange} from '../apply-change'
import {IRemoteState} from '../types'

export const remoteInitialState: IRemoteState = {
  active: false,
  outbox: [],
  nextId: 1,
  saveState: 'idle',
  connection: 'poll',
  authors: {}
}

const remoteSlice = createSlice({
  name: 'remote',
  initialState: remoteInitialState,
  reducers: {
    /**
     * The CMS is mounted. The poller and the socket run while this or
     * `status.isEditing` is set and stop otherwise, so a visitor who never
     * opens the CMS never polls anything and never opens a socket.
     */
    setActive: (state, action: PayloadAction<boolean>) => {
      state.active = action.payload
    },

    /**
     * The recorder's only action. It appends and never sends, so a save can
     * never make a dispatch fail.
     */
    record: (state, action: PayloadAction<JaenChange>) => {
      state.outbox.push({id: state.nextId, change: action.payload})
      state.nextId += 1

      // Something is waiting, and the toolbar has to say so. `offline`,
      // `error` and `saving` are left alone: all three already say that
      // something is out or waiting, and each of them says more than
      // `pending` does. Only the two states that claim there is nothing to do
      // are corrected.
      if (state.saveState === 'idle' || state.saveState === 'saved') {
        state.saveState = 'pending'
      }
    },

    /**
     * The first action after a reload. `persist-state` wrote the whole slice
     * to localStorage, `saving` included, and a browser that was killed
     * mid-call would otherwise say "Saving" for the rest of its life.
     *
     * `connection` is reset for the same reason and is the sharper case: a
     * browser that was killed with a socket open would come back claiming a
     * live connection it does not have, and the poll's own interval is chosen
     * off that claim.
     */
    resume: state => {
      state.saveState =
        state.outbox.length > 0
          ? 'pending'
          : state.lastSavedAt
            ? 'saved'
            : 'idle'
      state.connection = 'poll'
      state.lastOverwrote = []
    },

    saveStarted: state => {
      state.saveState = 'saving'
    },

    /**
     * A save came back. The flushed entries are dropped by id rather than by
     * count, because the recorder keeps appending while the call is in flight.
     *
     * There is no commit here any more. A save writes the site's Durable
     * Object and bumps its revision; the repository is written by a publish
     * and by nothing else. See docs/architecture/draft-state.md, "Publish: the
     * only writer of history".
     */
    saveSucceeded: (
      state,
      action: PayloadAction<{
        ids: number[]
        revision: number
        savedAt: string
        authors?: JaenAuthors
        overwrote?: FieldOverwrite[]
      }>
    ) => {
      const flushed = new Set(action.payload.ids)

      state.outbox = state.outbox.filter(entry => !flushed.has(entry.id))
      state.revision = action.payload.revision
      state.lastSavedAt = action.payload.savedAt
      // What the recorder appended while the call was out is not saved, and
      // the toolbar keeps saying so until the next flush takes it.
      state.saveState = state.outbox.length > 0 ? 'pending' : 'saved'
      state.lastError = undefined
      state.lastOverwrote = action.payload.overwrote || []

      if (action.payload.authors) {
        state.authors = action.payload.authors
      }
    },

    /**
     * A save did not come back. The outbox is untouched, which is what makes
     * it the offline queue: `persist-state` has already written it to
     * localStorage, so the changes survive a reload with the network still
     * down.
     */
    saveFailed: (
      state,
      action: PayloadAction<{offline: boolean; message?: string}>
    ) => {
      state.saveState = action.payload.offline ? 'offline' : 'error'
      state.lastError = action.payload.message
    },

    /** A read that answered a revision the client did not have. */
    remoteHydrated: (
      state,
      action: PayloadAction<{
        revision: number
        publishedRevision?: number | null
        authors?: JaenAuthors
      }>
    ) => {
      state.revision = action.payload.revision

      if (typeof action.payload.publishedRevision === 'number') {
        state.publishedRevision = action.payload.publishedRevision
      }

      if (action.payload.authors) {
        state.authors = action.payload.authors
      }
    },

    /**
     * A read that answered `changed: false`, or the first revision we ever
     * saw. It moves the client's mark without touching the draft, which is
     * what almost every poll and every socket frame about somebody else's
     * already-known revision costs.
     */
    revisionSeen: (
      state,
      action: PayloadAction<{revision: number; publishedRevision?: number | null}>
    ) => {
      state.revision = action.payload.revision

      if (typeof action.payload.publishedRevision === 'number') {
        state.publishedRevision = action.payload.publishedRevision
      }
    },

    /** A publish was accepted. What it took is live once the build lands. */
    publishQueued: (
      state,
      action: PayloadAction<{revision?: number}>
    ) => {
      if (typeof action.payload.revision === 'number') {
        state.publishedRevision = action.payload.revision
      } else if (typeof state.revision === 'number') {
        state.publishedRevision = state.revision
      }
    },

    /**
     * The push channel came up or went away. It is recorded so the CMS and the
     * notebooks can tell the two paths apart: a browser whose socket is
     * refused is carried by the poll and must still see the other editor.
     */
    connectionChanged: (
      state,
      action: PayloadAction<IRemoteState['connection']>
    ) => {
      state.connection = action.payload
    },

    dismissOverwrote: state => {
      state.lastOverwrote = []
    }
  }
})

export const actions = remoteSlice.actions
export default remoteSlice.reducer

import {createSlice, PayloadAction} from '@reduxjs/toolkit'

import {FieldOverwrite, JaenAuthors, JaenChange} from '../apply-change'
import {IRemoteState} from '../types'

export const remoteInitialState: IRemoteState = {
  active: false,
  outbox: [],
  nextId: 1,
  saveState: 'idle',
  authors: {}
}

const remoteSlice = createSlice({
  name: 'remote',
  initialState: remoteInitialState,
  reducers: {
    /**
     * The CMS is mounted. The poller runs while this or `status.isEditing` is
     * set and stops otherwise, so a visitor who never opens the CMS never
     * polls anything.
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
     */
    resume: state => {
      state.saveState =
        state.outbox.length > 0
          ? 'pending'
          : state.lastSavedAt
            ? 'saved'
            : 'idle'
      state.lastOverwrote = []
    },

    saveStarted: state => {
      state.saveState = 'saving'
    },

    /**
     * A save came back. The flushed entries are dropped by id rather than by
     * count, because the recorder keeps appending while the call is in flight.
     */
    saveSucceeded: (
      state,
      action: PayloadAction<{
        ids: number[]
        headSha: string
        blobSha?: string
        savedAt: string
        commitUrl?: string
        authors?: JaenAuthors
        overwrote?: FieldOverwrite[]
      }>
    ) => {
      const flushed = new Set(action.payload.ids)

      state.outbox = state.outbox.filter(entry => !flushed.has(entry.id))
      state.headSha = action.payload.headSha
      state.blobSha = action.payload.blobSha
      state.lastSavedAt = action.payload.savedAt
      state.lastCommitUrl = action.payload.commitUrl
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

    /** A poll that answered a head the client did not have. */
    remoteHydrated: (
      state,
      action: PayloadAction<{
        headSha: string
        blobSha?: string
        authors?: JaenAuthors
      }>
    ) => {
      state.headSha = action.payload.headSha
      state.blobSha = action.payload.blobSha

      if (action.payload.authors) {
        state.authors = action.payload.authors
      }
    },

    /** A poll that answered `changed: false`, or the first head we ever saw. */
    headSeen: (state, action: PayloadAction<string>) => {
      state.headSha = action.payload
    },

    dismissOverwrote: state => {
      state.lastOverwrote = []
    }
  }
})

export const actions = remoteSlice.actions
export default remoteSlice.reducer

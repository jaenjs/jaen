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

    /**
     * A read that answered a revision the client did not have.
     *
     * The authors map follows the answer it came with: a delta carries only
     * the fields it touched and is merged, a full answer is the whole map and
     * replaces it. Merging a full answer would keep attributing a field to
     * somebody the object has forgotten about, and replacing with a delta
     * would drop every attribution the delta did not mention.
     */
    remoteHydrated: (
      state,
      action: PayloadAction<{
        revision: number
        publishedRevision?: number | null
        authors?: JaenAuthors
        replaceAuthors?: boolean
      }>
    ) => {
      state.revision = action.payload.revision

      if (typeof action.payload.publishedRevision === 'number') {
        state.publishedRevision = action.payload.publishedRevision
      }

      if (action.payload.replaceAuthors) {
        state.authors = action.payload.authors || {}
      } else if (action.payload.authors) {
        state.authors = {...state.authors, ...action.payload.authors}
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
      action: PayloadAction<{
        revision: number
        publishedRevision?: number | null
      }>
    ) => {
      state.revision = action.payload.revision

      if (typeof action.payload.publishedRevision === 'number') {
        state.publishedRevision = action.payload.publishedRevision
      }
    },

    /**
     * A read came back at a revision below the one this browser already had.
     *
     * A revision is monotonic while its object lives, so this is the object
     * having been lost and replaced. The draft is not touched, because the
     * answer is older than the screen; the revision is adopted, because the
     * next save has to carry a base the new object recognises; and the instant
     * is kept so the CMS and a notebook can say it happened rather than infer
     * it from a number that moved.
     */
    objectRestarted: (
      state,
      action: PayloadAction<{
        revision: number
        publishedRevision?: number | null
      }>
    ) => {
      state.revision = action.payload.revision
      state.objectRestartedAt = new Date().toISOString()

      if (typeof action.payload.publishedRevision === 'number') {
        state.publishedRevision = action.payload.publishedRevision
      }
    },

    /** A publish was accepted. What it took is live once the build lands. */
    publishQueued: (state, action: PayloadAction<{revision?: number}>) => {
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
    },

    /**
     * An admin discarded every unpublished change of the site.
     *
     * This is the invalidation of `docs/architecture/draft-state.md`, "Three
     * operations that rewrite the shared draft", and it is the one place the
     * outbox is emptied without having been sent. Everything in it was made
     * against a draft that no longer exists, so folding it back on top of the
     * answer would put part of what was discarded back into every editor's
     * CMS, which is exactly what the operation was asked to prevent.
     *
     * The changes are not destroyed on the way out: `remote-state` parks them
     * under a key of their own in `localStorage` first, because "an edit a
     * person made is never lost" is above every number and a machine may not
     * be the thing that throws one away. What this reducer does is stop them
     * being sent and stop them being reapplied.
     *
     * `saveState` goes back to `saved` rather than staying `pending`: there is
     * nothing waiting any more, and the toolbar must not claim there is.
     */
    draftDiscarded: (
      state,
      action: PayloadAction<{
        revision: number
        publishedRevision?: number | null
        at?: string | null
        by?: string | null
      }>
    ) => {
      state.outbox = []
      state.revision = action.payload.revision
      state.publishedRevision =
        typeof action.payload.publishedRevision === 'number'
          ? action.payload.publishedRevision
          : action.payload.revision
      state.discardedRevision = action.payload.revision
      state.discardedAt = action.payload.at || new Date().toISOString()
      state.discardedBy = action.payload.by || undefined
      // Only the three states that claim something is outstanding are
      // corrected, and `idle` is what a browser that has never saved goes back
      // to. Setting `saved` here unconditionally would have made every browser
      // that opens a site somebody once discarded read "Saved" with no time
      // beside it, because nothing in it had ever been saved.
      if (
        state.saveState === 'pending' ||
        state.saveState === 'error' ||
        state.saveState === 'offline'
      ) {
        state.saveState = state.lastSavedAt ? 'saved' : 'idle'
      }

      state.lastError = undefined
      state.lastOverwrote = []
    }
  }
})

export const actions = remoteSlice.actions
export default remoteSlice.reducer

/**
 * @license
 *
 * SPDX-FileCopyrightText: Copyright © 2021 snek.at
 * SPDX-License-Identifier: EUPL-1.2
 *
 * Use of this source code is governed by an EUPL-1.2 license that can be found
 * in the LICENSE file at https://snek.at/license
 */
import {combineReducers, configureStore} from '@reduxjs/toolkit'
import deepmerge from 'deepmerge'
import React from 'react'
import {
  Provider,
  TypedUseSelectorHook,
  useDispatch,
  useSelector,
  useStore
} from 'react-redux'

import PersistState from './persist-state'
import RemoteState from './remote-state'
import {agentConfig} from '../clients/agent'

import page, {pageInitialState} from './slices/page'
import popup, {popupInitialState} from './slices/popup'
import remote, {remoteInitialState} from './slices/remote'
import site, {siteInitialState} from './slices/site'
import status, {statusInitialState} from './slices/status'
import widget, {widgetInitialState} from './slices/widget'

import {useDeepEqualSelector} from '../utils/use-deep-equal-selector'
import {setLeaveStoreFlush} from '../utils/on-leave'

export const persistKey = 'jaenjs-state'

/**
 * The jaen agent, when the site was built with the `agent` plugin option.
 * Everything below is a no-op without it, so a site that has not been rebuilt
 * behaves exactly as it did before the shared draft existed.
 *
 * It is read here, above the persister, because the persister needs to know
 * whether anything can hand the media catalogue back: see `dropCatalogue`.
 */
const agent = agentConfig()

const {loadState, persistState, persistMiddleware} = PersistState<RootState>(
  persistKey,
  {
    /**
     * Change 2 of docs/architecture/editing-performance.md, with the safety
     * condition the plan leaves implicit made explicit.
     *
     * The catalogue is 99% of the persisted payload on booklimo.at, it is
     * never edited by hand, and the agent's poller hands it back within
     * `activePollMs` of the store coming up. Without the agent nothing hands
     * it back at all and `localStorage` is the only store there is, so every
     * picture added since the last publish would be dropped on the next
     * write. The invariant wins over the bytes: no agent, no dropping.
     */
    dropCatalogue: Boolean(agent)
  }
)

const combinedReducer = combineReducers({
  site,
  page,
  status,
  popup,
  widget,
  remote
})

const remoteState =
  agent && typeof window !== 'undefined' ? RemoteState(agent) : null

// Reset state if action called
const rootReducer = (state: any, action: any) => {
  if (action.type === 'RESET_STATE') {
    const payload: {
      site?: typeof siteInitialState
      page?: typeof pageInitialState
      popup?: typeof popupInitialState
      widget?: typeof widgetInitialState
    } = action.payload || {}

    return {
      site: deepmerge(siteInitialState, payload.site || {}),
      page: deepmerge(pageInitialState, payload.page || {}),
      status: statusInitialState,
      popup: deepmerge(popupInitialState, payload.popup || {}),
      widget: deepmerge(widgetInitialState, payload.widget || {}),
      // Discard means the unsent changes go too. Anything the object already
      // took stays in the object, which is what the CMS says on the button:
      // this browser stops carrying what it had not sent, and the revision it
      // last saw is kept so a save it makes next carries a base the object
      // recognises.
      //
      // `appliedRevision` deliberately does not come with it. The page, site
      // and widget slices above are being reset, so this browser has just
      // stopped holding the draft's content, and the mark that says what it
      // has merged has to say so: the next read is asked for from nothing and
      // is answered whole. Carrying the mark over would ask for a delta onto a
      // copy that is no longer there.
      remote: {
        ...remoteInitialState,
        active: state?.remote?.active ?? false,
        revision: state?.remote?.revision,
        publishedRevision: state?.remote?.publishedRevision,
        connection: state?.remote?.connection ?? 'poll',
        authors: state?.remote?.authors ?? {}
      }
    }
  }

  return combinedReducer(state, action)
}

const persistedState = loadState()

export const store = configureStore({
  reducer: rootReducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      thunk: {extraArgument: {}}
    }).concat([
      ...persistMiddleware,
      ...(remoteState ? [remoteState.recordMiddleware] : [])
    ]),
  devTools: true || process.env.NODE_ENV !== 'production',
  preloadedState: persistedState
})

const persister = persistState(store)

export const {resetState} = persister

/**
 * Step 2 of the pass out of the page, `utils/on-leave.ts`.
 *
 * `persistState` registers its own `visibilitychange` and `pagehide`
 * listeners and they stay, because the store must be written on the way out
 * whether or not anything else is registered. What this adds is the ordering
 * the invariant needs: a field's debounce is flushed into the store BEFORE
 * this runs, which a listener registered later than the persister's own can
 * never be. See docs/architecture/editing-performance.md, "The half second
 * before this file begins".
 */
setLeaveStoreFlush(persister.flush)

/**
 * The agent's flusher and poller. Started once, beside `persistState`, so the
 * offline queue drains on the next start whether or not a CMS is open.
 */
export const disconnectRemote = remoteState ? remoteState.connect(store) : null

export const jaenAgent = agent

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof combinedReducer>
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch

export const useAppDispatch = () => useDispatch<AppDispatch>()
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
export const useAppDeepEqualSelector =
  useDeepEqualSelector as TypedUseSelectorHook<RootState>
export const useAppState = () => useStore().getState() as RootState

export const withRedux =
  <P extends object>(Component: React.ComponentType<P>): React.FC<P> =>
  props => {
    return (
      <Provider store={store}>
        <Component {...props} />
      </Provider>
    )
  }

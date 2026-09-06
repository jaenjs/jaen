/**
 * What every /app page mounts around its view.
 *
 * The navigation context carries the page's route params and a navigate that
 * is relative to /app, and the shell draws the frame. The toaster viewport is
 * mounted here, once per page, so every screen can call `toaster` from
 * shared/components without mounting anything.
 *
 * The query client is provided here as well. The client itself lives in
 * shared/hooks/query.ts, one per tab, because the hooks pass it explicitly
 * (useCaller renders in the frame's menu on every page, above this wrapper)
 * and the mutations invalidate through it outside React. What this wrapper
 * adds is the provider for whatever wants useQueryClient, and the start of
 * the persistence: the client is restored from the IndexedDB store of
 * shared/offline.ts on the first mount and written to it from then on, so a
 * reload without a connection renders the last answers. The client's rules,
 * networkMode offlineFirst and the staleTime per domain, are set where the
 * client is built. See okf/architecture/data-layer.md.
 *
 * The geolocation watcher that used to run here is gone. It asked every
 * visitor of every page for their position and nothing read the answer. A
 * driver sharing their position is a setting on the driver's own screen and
 * belongs there.
 */
import React, {useState} from 'react'
import {QueryClientProvider} from '@tanstack/react-query'
import {NavigationProvider, type NavigationContextValue} from '../shared/navigation'
import {AppToaster} from '../shared/components'
import {ensurePersisted, queryClient} from '../shared/hooks/query'
import {AppShell} from './components/AppShell'

interface AppWrapperProps {
  nav: NavigationContextValue
  children: React.ReactNode
}

export function AppWrapper({nav, children}: AppWrapperProps) {
  // Before the first render of the page, not in an effect after it: the
  // hooks below hold their first fetch until the restore has landed.
  useState(() => {
    ensurePersisted()
    return true
  })

  return (
    <QueryClientProvider client={queryClient}>
      <NavigationProvider value={nav}>
        <AppShell>{children}</AppShell>
        <AppToaster />
      </NavigationProvider>
    </QueryClientProvider>
  )
}

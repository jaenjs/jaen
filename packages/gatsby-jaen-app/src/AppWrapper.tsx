/**
 * What every /app page mounts around its view.
 *
 * The navigation context carries the page's route params and a navigate that
 * is relative to /app, and the shell draws the frame. The toaster viewport is
 * mounted here, once per page, so every screen can call `toaster` from
 * shared/components without mounting anything.
 *
 * The geolocation watcher that used to run here is gone. It asked every
 * visitor of every page for their position and nothing read the answer. A
 * driver sharing their position is a setting on the driver's own screen and
 * belongs there.
 */
import React from 'react'
import {NavigationProvider, type NavigationContextValue} from '../shared/navigation'
import {AppToaster} from '../shared/components'
import {AppShell} from './components/AppShell'

interface AppWrapperProps {
  nav: NavigationContextValue
  children: React.ReactNode
}

export function AppWrapper({nav, children}: AppWrapperProps) {
  return (
    <NavigationProvider value={nav}>
      <AppShell>{children}</AppShell>
      <AppToaster />
    </NavigationProvider>
  )
}

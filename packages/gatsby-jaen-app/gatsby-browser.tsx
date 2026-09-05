import './src/styles/app.css'
import React from 'react'
import { I18nProvider } from './shared/i18n'
import { AppFrameMenu } from './src/components/AppFrameMenu'
import { OfflineSession } from './shared/offline'

// Gatsby resolves a plugin's gatsby-browser.tsx ahead of the gatsby-browser.js
// stub beside it (measured in the sites' .cache/api-runner-browser-plugins.js),
// so what gatsby/gatsby-browser.ts exports has to be exported from here too or
// it never runs. The service worker reload lived there, unreachable.
export { onServiceWorkerUpdateReady } from './gatsby/gatsby-browser'

export const wrapRootElement = ({ element }: { element: React.ReactNode }) => (
  <I18nProvider code="de-AT">
    {element}
  </I18nProvider>
)

/**
 * The app's entries in the frame, on every page and not only under /app.
 * wrapPageElement runs inside every plugin's wrapRootElement, so jaen's
 * JaenFrameMenuProvider and AuthenticationProvider are in scope here.
 */
export const wrapPageElement = ({ element }: { element: React.ReactNode }) => (
  <>
    {element}
    <AppFrameMenu />
    {/* The offline store is cleared when the session is removed, on /logout
        as on any page, see shared/offline.ts. */}
    <OfflineSession />
  </>
)

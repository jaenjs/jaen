import './src/styles/app.css'
import React from 'react'
import {I18nProvider} from './shared/i18n'
import {AppFrameMenu} from './src/components/AppFrameMenu'
import {OfflineSession} from './shared/offline'

// Gatsby resolves a plugin's gatsby-browser.tsx ahead of the gatsby-browser.js
// stub beside it (measured in the sites' .cache/api-runner-browser-plugins.js),
// so what gatsby/gatsby-browser.ts exports has to be exported from here too or
// it never runs. The service worker reload lived there, unreachable.
export {onServiceWorkerUpdateReady} from './gatsby/gatsby-browser'

export const wrapRootElement = ({element}: {element: React.ReactNode}) => (
  <I18nProvider code="de-AT">{element}</I18nProvider>
)

/**
 * The app's entries in the frame, on every page and not only under /app.
 * wrapPageElement runs inside every plugin's wrapRootElement, so jaen's
 * JaenFrameMenuProvider and AuthenticationProvider are in scope here.
 */
export const wrapPageElement = ({element}: {element: React.ReactNode}) => (
  <>
    {element}
    <AppFrameMenu />
    {/* The offline store is cleared when the session is removed, on /logout
        as on any page, see shared/offline.ts. */}
    <OfflineSession />
  </>
)

/**
 * The viewport meta follows the route (design-consistency.md, rule 7).
 *
 * gatsby-ssr.tsx writes the app's meta into the static HTML of every /app
 * page, but a document is loaded once and Gatsby then routes on the client:
 * the sign-in lands on /loading, a public page, and walks into /app with the
 * public meta still in the head, and a person who leaves the app for the site
 * would keep the app's. Measured on the local build of 2026-09-06, the
 * dashboard reached from the sign-in carried "shrink-to-fit=no" and zoomed.
 * So the one meta element is rewritten on every route change: the app's
 * content under /app, the document's own content everywhere else. Browsers
 * re-read the viewport meta when its content changes.
 */
const APP_VIEWPORT =
  'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
const APP_ONLY =
  /,?\s*(maximum-scale=[^,]*|user-scalable=[^,]*|viewport-fit=[^,]*)/g

let publicViewport: string | undefined

export const onRouteUpdate = ({location}: {location: {pathname: string}}) => {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
  if (!meta) return
  if (publicViewport === undefined) {
    // The first document's own meta is the site's, unless it was an /app
    // page, whose meta is the app's with the three directives that are ours.
    const own = meta.content
    publicViewport = location.pathname.startsWith('/app')
      ? own.replace(APP_ONLY, '').replace(/^,\s*/, '')
      : own
  }
  const wanted = location.pathname.startsWith('/app')
    ? APP_VIEWPORT
    : publicViewport
  if (meta.content !== wanted) meta.content = wanted
}

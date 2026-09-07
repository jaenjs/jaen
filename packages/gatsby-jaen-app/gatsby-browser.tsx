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

/**
 * A view starts at its top (design-consistency.md, rule 12).
 *
 * Owner on app 1.4.1: scrolled down on the board, tapped Standorte and the
 * map opened with its header hidden under the frame's bar. Gatsby's own
 * handler is no help here. `gatsby-react-router-scroll` reads the position it
 * saved for the new entry's key and scrolls there synchronously in
 * `componentDidUpdate`, before the new route has laid anything out, and it
 * ignores the coordinates a `shouldUpdateScroll` returns entirely (version
 * 6.13.1, `windowScroll` calls `window.scrollTo(0, position)` with its own
 * position and uses our answer only as a boolean). So the app answers false
 * for its own routes and scrolls itself, one frame later, when the new view
 * has rendered.
 *
 * The position is the one Gatsby saved for this history entry: zero for a
 * push, which is every tap on the tab bar and every swipe between the bar's
 * places, and the list's own offset for a pop, which is the back out of a
 * detail. The retry is there because a list restores from the persisted query
 * cache a frame or two after the route mounts, and a document that is still
 * short cannot be scrolled to where it will reach; it stops as soon as the
 * offset is reached, after a second and a half, or the moment the person
 * scrolls themselves, so it never fights a thumb.
 */
const scrollAppView = (y: number) => {
  let tries = 0
  let stopped = false
  const stop = () => {
    stopped = true
  }
  const events = ['wheel', 'touchstart', 'keydown'] as const
  for (const e of events)
    window.addEventListener(e, stop, {passive: true, once: true})
  const done = () => {
    for (const e of events) window.removeEventListener(e, stop)
  }
  const step = () => {
    if (stopped) return done()
    window.scrollTo(0, y)
    if (++tries >= 20 || Math.abs(window.scrollY - y) <= 1) return done()
    window.setTimeout(step, 75)
  }
  window.requestAnimationFrame(step)
}

export const shouldUpdateScroll = ({
  routerProps,
  getSavedScrollPosition
}: {
  routerProps: {location: {pathname: string; key?: string}}
  getSavedScrollPosition: (location: unknown) => [number, number] | number
}) => {
  const {location} = routerProps
  // Outside the app the site keeps Gatsby's behaviour.
  if (!location.pathname.startsWith('/app')) return true
  let saved: [number, number] | number = 0
  try {
    saved = getSavedScrollPosition(location)
  } catch {
    // Swallowed on purpose: session storage can be refused (a locked-down
    // browser), and a view that starts at its top is the right answer then.
  }
  const y = Array.isArray(saved) ? Number(saved[1]) || 0 : Number(saved) || 0
  scrollAppView(y)
  return false
}

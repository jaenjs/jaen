import type {GatsbyBrowser} from 'gatsby'

/**
 * Take a new deployment the moment one is ready.
 *
 * The app registers gatsby-plugin-offline, so an installed PWA runs from a
 * service worker's cache. A new service worker installs but then waits for
 * every client of the old one to go away, and on iOS a home-screen app is only
 * "gone" when it is swiped out of the app switcher. Anyone who just closes it
 * keeps running yesterday's bundle indefinitely, which is exactly what happened:
 * deployment after deployment landed and the phone kept reporting the errors
 * that had already been fixed, because it was still running the code that had
 * them.
 *
 * Reloading here activates the waiting worker at the first safe moment. It is
 * one reload per deployment, and it only ever fires when a new bundle is
 * genuinely ready to take over.
 */
export const onServiceWorkerUpdateReady: GatsbyBrowser['onServiceWorkerUpdateReady'] =
  () => {
    window.location.reload()
  }

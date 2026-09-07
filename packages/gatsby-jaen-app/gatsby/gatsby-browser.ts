import type {GatsbyBrowser} from 'gatsby'

/**
 * Paints "Neue Version wird geladen" and reloads, when it is there.
 *
 * The function is defined by the inline script gatsby-ssr.tsx writes into the
 * head of every /app document and of the worker's app shell, and by
 * onClientEntry in gatsby-browser.tsx for a document that arrived without it.
 * It is reached through the window rather than imported, because this file is
 * compiled on its own into dist/gatsby and an import out of it would move
 * every emitted path by one directory. See src/update-guard.ts.
 */
const updateNotice = (): ((reload?: boolean) => void) | undefined =>
  (window as unknown as {__taxiAppUpdateNotice?: (reload?: boolean) => void})
    .__taxiAppUpdateNotice

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
 * genuinely ready to take over. The reload is not silent any more: the line
 * "Neue Version wird geladen" is painted first, so the second the document is
 * blank reads as an update and not as the app dying. See
 * okf/architecture/offline.md.
 */
export const onServiceWorkerUpdateReady: GatsbyBrowser['onServiceWorkerUpdateReady'] =
  () => {
    const notice = updateNotice()
    if (notice) {
      notice(true)
      return
    }
    window.location.reload()
  }

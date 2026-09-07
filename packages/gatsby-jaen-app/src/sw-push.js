// src/sw-push.js
// Appended raw to gatsby-plugin-offline's service worker at build time. This
// file never passes through webpack, so no DefinePlugin value reaches it: the
// backend URL and the bearer token arrive in the message the page posts, read
// on the page from __JAEN_APP_PYLON_URL__ like every other request. Nothing
// brand specific is hardcoded here, see okf/decisions/hard-rules.md.

self.addEventListener('push', event => {
  event.waitUntil(
    (async () => {
      // The pylon sends JSON. Anything else is shown with the defaults.
      let payload = {}
      try {
        if (event.data) {
          payload = await event.data.json()
        }
      } catch (e) {
        try {
          payload = JSON.parse(event.data ? await event.data.text() : '{}')
        } catch {
          payload = {}
        }
      }

      const data = payload.data || {}

      // The tap opens the transfer. Accept and reject live there, on the
      // slider screen, never in the notification shade: a driver should see
      // the job before answering it, so this notification carries no actions.
      let url = data.url
      if (!url && data.type === 'transfer-assigned' && data.transferId) {
        url = `/app/transfers/${data.transferId}/`
      }
      if (!url) url = '/app/transfers/'

      // The sender knows the driver's locale and sends title and body already
      // translated. The defaults are for a payload without them and are brand
      // neutral: the host name is the brand on both sites.
      const title =
        payload.title || self.location.hostname.replace(/^www\./, '')
      const body = payload.body || 'Neue Fahrt zugewiesen'
      const icon = payload.icon || '/icons/icon-192x192.png'

      // One notification per transfer: a second push about the same transfer
      // replaces the first rather than stacking.
      const tag =
        payload.tag ||
        (data.transferId ? `transfer-${data.transferId}` : 'app-push')

      // The car's picture on the driver's yes, the thumbnail the sender put
      // in the payload (okf/architecture/media.md). Android and desktop
      // Chrome draw it, iOS ignores the option rather than failing.
      const image = payload.image

      await self.registration.showNotification(title, {
        body,
        icon,
        tag,
        ...(image ? {image} : {}),
        data: {
          ...data,
          url
        }
      })
    })()
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()

  const url = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    (async () => {
      const targetUrl = new URL(url, self.location.origin).href

      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      })

      // An open tab is focused and sent to the transfer. Otherwise a new one.
      for (const client of windowClients) {
        if ('focus' in client) {
          await client.focus()
        }
        if ('navigate' in client) {
          try {
            await client.navigate(targetUrl)
            return
          } catch {
            // fall through to openWindow
          }
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    })()
  )
})

// ------------------------------------------------------------
// Position relay, best effort. The page reads the GPS (a worker cannot) and
// posts the position here when its own request failed, typically because the
// tab is being closed. The message carries the pylon URL and the bearer
// token, because the worker has neither of its own.
// ------------------------------------------------------------

self.addEventListener('message', event => {
  const msg = event.data || {}
  if (msg.type !== 'LIMOSEN_SET_DRIVER_LOCATION') return

  const pylonUrl = typeof msg.pylonUrl === 'string' ? msg.pylonUrl : ''
  if (!pylonUrl) return

  const location = msg.location || {}
  const latitude = location.latitude
  const longitude = location.longitude
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return

  const authorization =
    typeof msg.authorization === 'string' ? msg.authorization : undefined
  if (!authorization) return

  // Arguments are inlined so the document names no input type, which is what
  // keeps it valid against either brand's pylon build.
  const literal = v =>
    typeof v === 'number' && Number.isFinite(v) ? String(v) : null
  const fields = [
    ['latitude', literal(latitude)],
    ['longitude', literal(longitude)],
    ['accuracy', literal(location.accuracy)],
    ['altitude', literal(location.altitude)],
    ['altitudeAccuracy', literal(location.altitudeAccuracy)],
    ['heading', literal(location.heading)],
    ['speed', literal(location.speed)],
    [
      'recordedAtISO',
      typeof location.recordedAtISO === 'string'
        ? JSON.stringify(location.recordedAtISO)
        : null
    ]
  ]
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ')

  const query = `mutation { setDriverLocation(args: {${fields}}) { id updatedAt } }`

  event.waitUntil(
    fetch(pylonUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization
      },
      body: JSON.stringify({query}),
      mode: 'cors'
    }).catch(() => {
      // Best effort: the page already failed once, and a position that did
      // not arrive is replaced by the next one.
    })
  )
})

// ------------------------------------------------------------
// A deploy never leaves the installed app white.
//
// okf/architecture/offline.md, "The installed app never goes white after a
// deploy". gatsby-plugin-offline appends this file to the worker it
// generates, after its own sw-append.js and in the same script scope, so
// `navigationRoute`, `workbox` and `caches` below are the very objects that
// file created. That is the only reason this can be written here at all.
//
// Three things happen:
//
//   1. /app navigations are network first. The plugin's navigation route
//      answers every /app URL out of the precached app shell as soon as the
//      shell and the page's resources are cached, and that shell names the
//      chunks of the build it was installed with. After a deploy those chunks
//      are gone from the server and the document stays white. Network first
//      means a reload lands on the document the site serves today; the shell
//      is the answer when, and only when, there is no connection.
//   2. The previous build's chunks are kept. skipWaiting and clientsClaim are
//      on, so the new worker activates while the old page is still on the
//      screen, and workbox empties the outdated precache at that moment. The
//      install below copies every script and stylesheet of the build that is
//      running into a cache of its own first, so a page that asks for one of
//      them after the swap is served rather than answered 404.
//   3. A build asset the deploy really has taken away answers from that cache
//      if it is there, and only then reaches the page as the 404 it is, where
//      src/update-guard.ts shows "Neue Version wird geladen" and reloads once.
// ------------------------------------------------------------

/** The same shape gatsby-plugin-offline's own CacheFirst route used. */
const TAXI_BUILD_ASSET = /(\.js$|\.css$|static\/)/
/** Only the app. The public pages keep the plugin's behaviour unchanged. */
const TAXI_APP_NAVIGATION = /^\/app(\/|$)/
/**
 * The shell's URL. Written out rather than taken from sw-append.js, which
 * spells it with the plugin's `%pathPrefix%` placeholder: that placeholder is
 * substituted in the plugin's own appended file and NOT in this one, which is
 * copied in verbatim. Neither site sets a pathPrefix, and one that did would
 * have to say so here.
 */
const TAXI_APP_SHELL = `/offline-plugin-app-shell-fallback/index.html`
/** One generation, replaced at every install. */
const TAXI_PREVIOUS_BUILD = `taxi-app-previous-build`
/**
 * How long a navigation waits for the network before it falls back to the
 * shell. A driver in a lift is not made to stare at a spinner, and six
 * seconds is longer than any answer this origin gives when it answers at all.
 */
const TAXI_NAVIGATION_TIMEOUT_MS = 6000

/**
 * The runtime cache workbox writes into, by the name it uses, so what this
 * file stores is cleared by the same `clearPathResources` message the plugin
 * already sends on a compilation hash mismatch (it deletes every cache whose
 * name contains "runtime").
 */
const taxiRuntimeCacheName = () => {
  try {
    if (
      workbox.core &&
      workbox.core.cacheNames &&
      workbox.core.cacheNames.runtime
    ) {
      return workbox.core.cacheNames.runtime
    }
  } catch (e) {
    // Swallowed on purpose: an older workbox without core.cacheNames means a
    // cache of our own name, which the message above still clears because the
    // name carries "runtime".
  }
  return `gatsby-plugin-offline-runtime`
}

const taxiWithTimeout = (promise, ms) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout`)), ms)
    promise.then(
      value => {
        clearTimeout(timer)
        resolve(value)
      },
      error => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })

const taxiFromPreviousBuild = async request => {
  try {
    const cache = await caches.open(TAXI_PREVIOUS_BUILD)
    return await cache.match(request)
  } catch (e) {
    // Swallowed on purpose: no snapshot means the page reloads itself on the
    // 404 instead of carrying on, which is the guard's job and visible.
    return undefined
  }
}

// ---- 2. the previous build's chunks, kept across the swap ----

self.addEventListener(`install`, event => {
  event.waitUntil(
    (async () => {
      try {
        // One generation only: the build before this one. Anything older is
        // dead weight on a phone's storage budget.
        await caches.delete(TAXI_PREVIOUS_BUILD)
        const previous = await caches.open(TAXI_PREVIOUS_BUILD)
        const names = (await caches.keys()).filter(
          name =>
            name.includes(`gatsby-plugin-offline`) &&
            name !== TAXI_PREVIOUS_BUILD
        )
        for (const name of names) {
          const cache = await caches.open(name)
          for (const request of await cache.keys()) {
            const {pathname} = new URL(request.url)
            if (!TAXI_BUILD_ASSET.test(pathname)) continue
            const response = await cache.match(request)
            if (response) await previous.put(request, response.clone())
          }
        }
      } catch (e) {
        // Swallowed on purpose: storage can be full or refused, and then the
        // page that asks for a removed chunk reloads itself rather than
        // continuing. That is the guard, not a white screen.
      }
    })()
  )
})

// ---- 3. build assets, with the kept copy behind them ----
//
// The plugin's own two routes for scripts and stylesheets are neutralised in
// the plugin options (app/gatsby/gatsby-config.ts), because a route
// registered here can only ever run after them and they would answer first.

workbox.routing.registerRoute(TAXI_BUILD_ASSET, async ({event, request}) => {
  const req = request || event.request
  const hit = await caches.match(req)
  if (hit) return hit

  let response
  try {
    response = await fetch(req)
  } catch (e) {
    const kept = await taxiFromPreviousBuild(req)
    if (kept) return kept
    throw e
  }

  if (response && response.ok) {
    try {
      const cache = await caches.open(taxiRuntimeCacheName())
      await cache.put(req, response.clone())
    } catch (e) {
      // Swallowed on purpose: a full quota costs the next visit a fetch, and
      // nothing else.
    }
    return response
  }

  // The deploy took this file away. The copy from the build before keeps the
  // open page running until it reloads onto the new one.
  const kept = await taxiFromPreviousBuild(req)
  return kept || response
})

// ---- 1. /app navigations, network first, the shell as the fallback ----

const taxiAppShellResponse = async () => {
  try {
    const key = workbox.precaching.getCacheKeyForURL(TAXI_APP_SHELL)
    if (key) {
      const hit = await caches.match(key)
      if (hit) return hit
    }
  } catch (e) {
    // Swallowed on purpose: an app shell that is not precached is an app that
    // has no offline mode, which is what the plain fetch below answers.
  }
  return await caches.match(TAXI_APP_SHELL)
}

const taxiAppNavigation = async ({event}) => {
  try {
    const response = await taxiWithTimeout(
      fetch(event.request),
      TAXI_NAVIGATION_TIMEOUT_MS
    )
    // A 404 or a 500 is the site's own answer and is shown as such. Only a
    // dead connection, or one too slow to answer at all, reaches the shell.
    if (response) return response
  } catch (e) {
    // No connection, or slower than the timeout.
  }
  const shell = await taxiAppShellResponse()
  if (shell) return shell
  return await fetch(event.request)
}

// The plugin's navigation route answers every navigation out of the app
// shell, and its handler is the only thing that has to change: workbox 4.3.1,
// which gatsby-plugin-offline pins, exports registerRoute but NOT
// unregisterRoute (that arrived in workbox 5), so a route cannot be taken out
// of the router and a route added here can only ever run after it. What can
// be done is what is done: the route object itself is in scope, because this
// file is appended to the same script, and its handler is replaced by one
// that answers /app itself and hands everything else to the handler that was
// there. The public pages keep the plugin's behaviour to the letter.
const taxiPluginNavigation =
  navigationRoute && navigationRoute.handler ? navigationRoute.handler : null

if (taxiPluginNavigation) {
  navigationRoute.handler = {
    handle: args => {
      const request = args && args.event ? args.event.request : null
      let pathname = ``
      try {
        pathname = new URL(request.url).pathname
      } catch (e) {
        // Not a URL we can read, which is the plugin's business and not ours.
      }
      if (pathname && TAXI_APP_NAVIGATION.test(pathname)) {
        return taxiAppNavigation(args)
      }
      return taxiPluginNavigation.handle(args)
    }
  }
}

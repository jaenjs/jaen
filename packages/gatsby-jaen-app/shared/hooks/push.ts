/**
 * Web Push, the browser half.
 *
 * The pylon owns the VAPID key pair and exposes the public half through
 * `vapidPublicKey`, readable without a token because subscribing happens on a
 * fresh install before anything else. The subscription the browser hands back
 * goes to `addPushSubscription`, scoped by the backend to the caller's own
 * account, and `removePushSubscription` takes it away again. Sending is the
 * pylon's job on assignDriver, see okf/architecture/notifications.md section 7.
 *
 * The three GraphQL calls are written as documents with inlined arguments,
 * like shared/hooks.ts, so no input type is named and the same code is valid
 * against either brand's build.
 */
import {useCallback, useEffect, useState} from 'react'
import {fetchGraphQL} from '../../client/limosen'
import {appError, graphqlError} from '../errors'

const run = async (document: string): Promise<any> => {
  const result: any = await fetchGraphQL(
    {query: document, variables: undefined, operationName: undefined},
    {}
  )
  if (result?.errors?.length) {
    throw graphqlError(result.errors)
  }
  return result?.data
}

export async function fetchVapidPublicKey(): Promise<string> {
  const data = await run('query { vapidPublicKey }')
  const key = data?.vapidPublicKey
  if (typeof key !== 'string' || !key)
    throw appError('PushIncomplete', 'no VAPID public key')
  return key
}

export interface PushSubscriptionArgs {
  endpoint: string
  p256dh: string
  auth: string
}

export async function addPushSubscriptionMutation(
  args: PushSubscriptionArgs
): Promise<boolean> {
  const data = await run(
    `mutation { addPushSubscription(args: {endpoint: ${JSON.stringify(args.endpoint)}, ` +
      `p256dh: ${JSON.stringify(args.p256dh)}, auth: ${JSON.stringify(args.auth)}}) }`
  )
  return data?.addPushSubscription !== false
}

export async function removePushSubscriptionMutation(
  endpoint: string
): Promise<boolean> {
  const data = await run(
    `mutation { removePushSubscription(args: {endpoint: ${JSON.stringify(endpoint)}}) }`
  )
  return data?.removePushSubscription !== false
}

/** base64url, as VAPID keys are spelled, to the bytes PushManager wants. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i)
  return out
}

const supportsPush = (): boolean =>
  typeof window !== 'undefined' &&
  'Notification' in window &&
  'serviceWorker' in navigator &&
  'PushManager' in window

/**
 * Safari on iOS only offers push to a web app on the home screen. When push
 * is missing on an iPhone that is the reason nine times out of ten, and the
 * screen can say so instead of "not supported".
 */
const isIOSBrowserTab = (): boolean => {
  if (typeof navigator === 'undefined' || typeof window === 'undefined')
    return false
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent)
  const standalone =
    (window.navigator as any).standalone === true ||
    window.matchMedia?.('(display-mode: standalone)')?.matches
  return ios && !standalone
}

export interface PushNotificationsState {
  /** The browser can subscribe at all. False on an iPhone outside the home screen. */
  isSupported: boolean
  /** The reason for `isSupported: false` on an iPhone. */
  needsHomeScreen: boolean
  permission: NotificationPermission
  /** A subscription exists in this browser. */
  isSubscribed: boolean
  isBusy: boolean
  /** The last failure, unchanged, for the screen to show. */
  error: string | null
  subscribe: () => Promise<boolean>
  unsubscribe: () => Promise<void>
  /** A notification from this device, no server involved, so the driver sees what one looks like. */
  showLocalNotification: (title: string, body: string) => Promise<void>
}

export function usePushNotifications(): PushNotificationsState {
  const [isSupported, setIsSupported] = useState(false)
  const [needsHomeScreen, setNeedsHomeScreen] = useState(false)
  const [permission, setPermission] =
    useState<NotificationPermission>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supported = supportsPush()
    setIsSupported(supported)
    setNeedsHomeScreen(!supported && isIOSBrowserTab())
    if (!supported) return

    setPermission(Notification.permission)

    let cancelled = false
    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => {
        if (!cancelled) setIsSubscribed(!!sub)
      })
      .catch(() => {
        // No registration yet, for instance in development where the offline
        // plugin does not run. Not subscribed is the honest answer.
        if (!cancelled) setIsSubscribed(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!supportsPush()) return false
    setIsBusy(true)
    setError(null)
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result !== 'granted') return false

      const reg = await navigator.serviceWorker.ready
      const key = await fetchVapidPublicKey()
      const applicationServerKey = urlBase64ToUint8Array(
        key
      ) as unknown as BufferSource

      let subscription = await reg.pushManager.getSubscription()
      if (subscription) {
        // A subscription made with another key, an earlier deployment's or
        // the hardcoded one the old hook carried, cannot be reused: the
        // browser refuses to resubscribe under a different key until the old
        // one is gone.
        const current = subscription.options?.applicationServerKey
        const same =
          current &&
          new Uint8Array(current as ArrayBuffer).toString() ===
            urlBase64ToUint8Array(key).toString()
        if (!same) {
          await subscription.unsubscribe().catch(() => undefined)
          subscription = null
        }
      }
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        })
      }

      const raw = subscription.toJSON()
      const endpoint = raw.endpoint ?? subscription.endpoint
      const p256dh = raw.keys?.p256dh
      const auth = raw.keys?.auth
      if (!endpoint || !p256dh || !auth) {
        throw appError('PushIncomplete', 'push subscription is incomplete')
      }

      await addPushSubscriptionMutation({endpoint, p256dh, auth})
      setIsSubscribed(true)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return false
    } finally {
      setIsBusy(false)
    }
  }, [])

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!supportsPush()) return
    setIsBusy(true)
    setError(null)
    try {
      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.getSubscription()
      if (subscription) {
        // The backend first, so a server that still knows the endpoint is the
        // failure the driver sees, not a browser that already forgot it.
        await removePushSubscriptionMutation(subscription.endpoint)
        await subscription.unsubscribe()
      }
      setIsSubscribed(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsBusy(false)
    }
  }, [])

  const showLocalNotification = useCallback(
    async (title: string, body: string) => {
      if (typeof window === 'undefined' || !('Notification' in window)) {
        throw appError('PushUnsupported', 'notifications are not supported')
      }
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result !== 'granted')
        throw appError('PushDenied', 'notification permission was not granted')

      const options: NotificationOptions = {
        body,
        icon: '/icons/icon-192x192.png',
        // The same tag the service worker uses for a transfer, so the test
        // looks exactly like the real thing and replaces itself when repeated.
        tag: 'transfer-test',
        data: {url: '/app/me'}
      }
      // Android refuses `new Notification` from a page and wants the service
      // worker's registration to show it. The page constructor is the fallback
      // for a browser without a worker.
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration()
        if (reg) {
          await reg.showNotification(title, options)
          return
        }
      }
      // eslint-disable-next-line no-new
      new Notification(title, options)
    },
    []
  )

  return {
    isSupported,
    needsHomeScreen,
    permission,
    isSubscribed,
    isBusy,
    error,
    subscribe,
    unsubscribe,
    showLocalNotification
  }
}

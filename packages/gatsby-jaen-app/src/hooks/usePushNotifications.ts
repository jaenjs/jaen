/**
 * The hook the package exports under this name since the first push attempt.
 *
 * It used to carry a hardcoded VAPID public key and three mutations that
 * existed in no schema, each guarded by a runtime check that always took the
 * warning branch, so `subscribe()` reported success and stored nothing. The
 * real one lives with the other data hooks in shared/hooks/push.ts, against
 * `vapidPublicKey`, `addPushSubscription` and `removePushSubscription`. This
 * file keeps the export path so nothing that imported it breaks.
 */
export { usePushNotifications } from '../../shared/hooks/push'
export type { PushNotificationsState } from '../../shared/hooks/push'

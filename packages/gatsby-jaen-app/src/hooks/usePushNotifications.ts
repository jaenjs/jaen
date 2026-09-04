// src/hooks/usePushNotifications.ts
import { useCallback, useEffect, useState } from "react";

import { useMutation } from "../../client/limosen";
// Note: Push notification mutations may not be available in limosen schema
// These will need to be implemented or handled differently
type UserPushSubscriptionInput = {
  endpoint: string;
  expirationTime?: number;
  keys?: {
    auth: string;
    p256dh: string;
  };
  userAgent?: string;
};

const VAPID_PUBLIC_KEY =
  "BBmIQMlGvLpBO28tSCFBr3qS4N27DTgV-LRoKcT0boJoA-DdcDUp_Plo_GYqjpgNtoyVC74ogpgJA0_9gW_qC5U";

// Utility: base64url → Uint8Array (for applicationServerKey)
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = typeof atob !== "undefined" ? atob(base64) : "";
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  // ---------------- gqty mutations ----------------
  // Note: Push notification mutations are not available in limosen schema
  // These mutations are stubbed out - implement when API supports them

  const [mutateAddSub] = useMutation(
    (mutation: any, args: { subscription: UserPushSubscriptionInput }) => {
      // Push notification mutations not available in limosen schema
      if (typeof mutation.addCurrentUserPushSubscription === 'function') {
        const result = mutation.addCurrentUserPushSubscription({
          subscription: args.subscription
        });
        return {
          addCurrentUserPushSubscription: Array.isArray(result) ? result.map((s: any) => s.endpoint) : []
        };
      }
      console.warn('addCurrentUserPushSubscription mutation not available in limosen schema');
      return { addCurrentUserPushSubscription: [] };
    }
  );

  const [mutateRemoveSub] = useMutation(
    (mutation: any, args: { endpoint: string }) => {
      if (typeof mutation.removeCurrentUserPushSubscription === 'function') {
        const result = mutation.removeCurrentUserPushSubscription({
          endpoint: args.endpoint
        });
        return {
          removeCurrentUserPushSubscription: Array.isArray(result) ? result.map((s: any) => s.endpoint) : []
        };
      }
      console.warn('removeCurrentUserPushSubscription mutation not available in limosen schema');
      return { removeCurrentUserPushSubscription: [] };
    }
  );

  const [mutateSendTest] = useMutation(
    (mutation: any, _args: {}) => {
      if (typeof mutation.sendTestNotificationToCurrentUser === 'function') {
        const res = mutation.sendTestNotificationToCurrentUser({});
        return {
          sendTestNotificationToCurrentUser: {
            delivered: res.delivered,
            failed: res.failed
          }
        };
      }
      console.warn('sendTestNotificationToCurrentUser mutation not available in limosen schema');
      return {
        sendTestNotificationToCurrentUser: {
          delivered: 0,
          failed: 0
        }
      };
    }
  );

  // ------------------------------------------------
  // Capability / initial subscription state
  // ------------------------------------------------
  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window;

    setIsSupported(supported);

    if (!supported) return;

    setPermission(Notification.permission);

    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setIsSubscribed(!!sub);
      });
    });
  }, []);

  // ------------------------------------------------
  // Subscribe
  // ------------------------------------------------
  const subscribe = useCallback(async () => {
    if (!isSupported) return;
    if (!VAPID_PUBLIC_KEY) {
      console.error("VAPID_PUBLIC_KEY is not set");
      return;
    }

    setIsBusy(true);
    try {
      // 1) Ask for permission
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        console.warn("Notification permission not granted");
        return;
      }

      // 2) SW registration from gatsby-plugin-offline worker
      const reg = await navigator.serviceWorker.ready;

      // 3) Existing subscription or create a new one
      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        const applicationServerKey =
          (urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource);

        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        });
      }

      // 4) Send subscription to backend via gqty mutation
      const raw = subscription.toJSON();

      // ----- FIX: ensure endpoint is a definite string -----
      const endpoint = raw.endpoint ?? subscription.endpoint;
      if (!endpoint) {
        console.error("Push subscription has no endpoint");
        return;
      }
      // ----------------------------------------------

      // Ensure keys are valid strings before using them
      const authKey = raw.keys?.auth
      const p256dhKey = raw.keys?.p256dh
      const keys = authKey && p256dhKey
        ? {
            auth: authKey,
            p256dh: p256dhKey
          }
        : undefined

      const jsonSub: UserPushSubscriptionInput = {
        endpoint,
        expirationTime:
          typeof raw.expirationTime === "number"
            ? raw.expirationTime
            : undefined,
        keys,
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : undefined
        // deviceId: you can later add your own random per-device id here if you want
      };

      await mutateAddSub({
        args: {
          subscription: jsonSub
        }
      });

      setIsSubscribed(true);
    } catch (e) {
      console.error("Failed to subscribe for push", e);
    } finally {
      setIsBusy(false);
    }
  }, [isSupported, mutateAddSub]);

  // ------------------------------------------------
  // Unsubscribe
  // ------------------------------------------------
  const unsubscribe = useCallback(async () => {
    if (!isSupported) return;

    setIsBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        setIsSubscribed(false);
        return;
      }

      const endpoint = subscription.endpoint;

      // 1) Tell backend to remove this endpoint
      await mutateRemoveSub({
        args: { endpoint }
      });

      // 2) Unsubscribe in browser
      await subscription.unsubscribe();

      setIsSubscribed(false);
    } catch (e) {
      console.error("Failed to unsubscribe from push", e);
    } finally {
      setIsBusy(false);
    }
  }, [isSupported, mutateRemoveSub]);

  // ------------------------------------------------
  // Test notification
  // ------------------------------------------------
  const sendTestNotification = useCallback(async () => {
    setIsBusy(true);
    try {
      await mutateSendTest({ args: {} });
      // You *could* inspect delivered/failed here from the return value
    } catch (e) {
      console.error("Failed to send test notification", e);
    } finally {
      setIsBusy(false);
    }
  }, [mutateSendTest]);

  return {
    isSupported,
    permission,
    isSubscribed,
    isBusy,
    subscribe,
    unsubscribe,
    sendTestNotification
  };
}

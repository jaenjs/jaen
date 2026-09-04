// src/sw-push.js
// Appended to gatsby-plugin-offline's service worker.

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      // Try to parse payload (if backend sends one)
      let payload = {};
      try {
        if (event.data) {
          // Most push payloads are JSON
          payload = await event.data.json();
        }
      } catch (e) {
        // Fallback if payload is text JSON
        try {
          payload = JSON.parse(event.data ? await event.data.text() : "{}");
        } catch {
          payload = {};
        }
      }

      const data = payload.data || {};

      // Build URL:
      // - prefer payload.data.url if present
      // - else if this is a transfer assignment, build transfer URL from transferId
      // - else fallback to dashboard
      let url = data.url;
      if (!url && data.type === "transfer-assigned" && data.transferId) {
        url = `/app/transfers/${data.transferId}/`;
      }
      if (!url) url = "/app/dashboard";

      const title = payload.title || "LIMOSEN";
      const body =
        payload.body || "A new transfer has been assigned";
      const icon = payload.icon || "/icons/icon-192x192.png";

      // Use a stable tag so repeated updates don't spam multiple notifications
      const tag =
        payload.tag ||
        (data.transferId ? `transfer-${data.transferId}` : "limosen-push");

      const options = {
        body,
        icon,
        tag,
        data: {
          ...data,
          url
        }
      };

      await self.registration.showNotification(title, options);
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const targetUrl = new URL(url, self.location.origin).href;

      const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true
      });

      // If we already have a tab, focus it AND navigate it to the transfer
      for (const client of windowClients) {
        if ("focus" in client) {
          await client.focus();
        }
        if ("navigate" in client) {
          try {
            await client.navigate(targetUrl);
            return;
          } catch {
            // ignore and fall through to openWindow
          }
        }
      }

      // Otherwise open a new tab
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })()
  );
});

// ------------------------------------------------------------
// Location sending (best-effort) via postMessage from the app.
// NOTE: Service Workers cannot read GPS themselves.
// ------------------------------------------------------------

const LIMOSEN_GRAPHQL_URL = "https://api.limosen.at/graphql";

self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg.type !== "LIMOSEN_SET_DRIVER_LOCATION") return;

  const location = msg.location || {};
  const latitude = location.latitude;
  const longitude = location.longitude;

  if (typeof latitude !== "number" || typeof longitude !== "number") return;

  const authorization =
    typeof msg.authorization === "string" ? msg.authorization : undefined;

  const query = `
    mutation SetDriverLocation(
      $latitude: Number!
      $longitude: Number!
      $accuracy: Number
      $altitude: Number
      $altitudeAccuracy: Number
      $heading: Number
      $speed: Number
      $recordedAtISO: String
    ) {
      setDriverLocation(
        args: {
          latitude: $latitude
          longitude: $longitude
          accuracy: $accuracy
          altitude: $altitude
          altitudeAccuracy: $altitudeAccuracy
          heading: $heading
          speed: $speed
          recordedAtISO: $recordedAtISO
        }
      ) {
        id
        updatedAt
      }
    }
  `;

  event.waitUntil(
    fetch(LIMOSEN_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authorization ? { Authorization: authorization } : {})
      },
      body: JSON.stringify({
        query,
        variables: location
      }),
      mode: "cors"
    }).catch(() => {
      // ignore
    })
  );
});

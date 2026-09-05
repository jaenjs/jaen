// src/sw-push.js
// Appended raw to gatsby-plugin-offline's service worker at build time. This
// file never passes through webpack, so no DefinePlugin value reaches it: the
// backend URL and the bearer token arrive in the message the page posts, read
// on the page from __JAEN_APP_PYLON_URL__ like every other request. Nothing
// brand specific is hardcoded here, see okf/decisions/hard-rules.md.

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      // The pylon sends JSON. Anything else is shown with the defaults.
      let payload = {};
      try {
        if (event.data) {
          payload = await event.data.json();
        }
      } catch (e) {
        try {
          payload = JSON.parse(event.data ? await event.data.text() : "{}");
        } catch {
          payload = {};
        }
      }

      const data = payload.data || {};

      // The tap opens the transfer. Accept and reject live there, on the
      // slider screen, never in the notification shade: a driver should see
      // the job before answering it, so this notification carries no actions.
      let url = data.url;
      if (!url && data.type === "transfer-assigned" && data.transferId) {
        url = `/app/transfers/${data.transferId}/`;
      }
      if (!url) url = "/app/transfers/";

      // The sender knows the driver's locale and sends title and body already
      // translated. The defaults are for a payload without them and are brand
      // neutral: the host name is the brand on both sites.
      const title =
        payload.title || self.location.hostname.replace(/^www\./, "");
      const body = payload.body || "Neue Fahrt zugewiesen";
      const icon = payload.icon || "/icons/icon-192x192.png";

      // One notification per transfer: a second push about the same transfer
      // replaces the first rather than stacking.
      const tag =
        payload.tag ||
        (data.transferId ? `transfer-${data.transferId}` : "app-push");

      await self.registration.showNotification(title, {
        body,
        icon,
        tag,
        data: {
          ...data,
          url
        }
      });
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

      // An open tab is focused and sent to the transfer. Otherwise a new one.
      for (const client of windowClients) {
        if ("focus" in client) {
          await client.focus();
        }
        if ("navigate" in client) {
          try {
            await client.navigate(targetUrl);
            return;
          } catch {
            // fall through to openWindow
          }
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })()
  );
});

// ------------------------------------------------------------
// Position relay, best effort. The page reads the GPS (a worker cannot) and
// posts the position here when its own request failed, typically because the
// tab is being closed. The message carries the pylon URL and the bearer
// token, because the worker has neither of its own.
// ------------------------------------------------------------

self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg.type !== "LIMOSEN_SET_DRIVER_LOCATION") return;

  const pylonUrl = typeof msg.pylonUrl === "string" ? msg.pylonUrl : "";
  if (!pylonUrl) return;

  const location = msg.location || {};
  const latitude = location.latitude;
  const longitude = location.longitude;
  if (typeof latitude !== "number" || typeof longitude !== "number") return;

  const authorization =
    typeof msg.authorization === "string" ? msg.authorization : undefined;
  if (!authorization) return;

  // Arguments are inlined so the document names no input type, which is what
  // keeps it valid against either brand's pylon build.
  const literal = (v) => (typeof v === "number" && Number.isFinite(v) ? String(v) : null);
  const fields = [
    ["latitude", literal(latitude)],
    ["longitude", literal(longitude)],
    ["accuracy", literal(location.accuracy)],
    ["altitude", literal(location.altitude)],
    ["altitudeAccuracy", literal(location.altitudeAccuracy)],
    ["heading", literal(location.heading)],
    ["speed", literal(location.speed)],
    [
      "recordedAtISO",
      typeof location.recordedAtISO === "string"
        ? JSON.stringify(location.recordedAtISO)
        : null
    ]
  ]
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  const query = `mutation { setDriverLocation(args: {${fields}}) { id updatedAt } }`;

  event.waitUntil(
    fetch(pylonUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization
      },
      body: JSON.stringify({ query }),
      mode: "cors"
    }).catch(() => {
      // Best effort: the page already failed once, and a position that did
      // not arrive is replaced by the next one.
    })
  );
});

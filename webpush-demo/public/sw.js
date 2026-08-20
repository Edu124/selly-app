// ── Service worker ────────────────────────────────────────────────────────────
// This is the piece that makes a web page reachable when nobody is looking at it.
// The browser keeps it registered after every tab is closed, and wakes it when a
// push arrives from the push service. Nothing else on a web page can do this.
// ─────────────────────────────────────────────────────────────────────────────

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { /* non-JSON push */ }

  const title = data.title || "Selly";
  const body  = data.body  || "You have an update on your order.";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon : "/icon.png",
      badge: "/icon.png",
      // Same tag per order so a later update replaces the earlier one instead of
      // stacking three notifications for one order.
      tag        : "order-" + (data.orderId || "x"),
      renotify   : true,
      data       : { url: data.url || "/", orderId: data.orderId, status: data.status },
      vibrate    : [80, 40, 80],
    })
  );
});

// Tapping the notification should land them back in the order, not a new blank tab.
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.registration.scope) && "focus" in c) return c.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});

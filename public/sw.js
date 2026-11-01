/* dots service worker: receives Web Push reminders and opens the app on tap. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "dots";
  const options = {
    body: data.body || "Time to fill in today's dots.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || "dots-reminder",
    data: { url: data.url || "/" },
  };

  // iOS revokes push permission if a push arrives without a visible
  // notification, so always show one.
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin)
    .href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.startsWith(self.location.origin) && "focus" in client) {
            client.navigate?.(url);
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});

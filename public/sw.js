const CACHE_NAME = "planner-shell-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Stale-while-revalidate for same-origin static assets only (the app shell:
// index.html, the JS bundle, icons) -- this is what makes the installed PWA able
// to open at all when offline. Deliberately does not touch API calls to the
// backend (a different origin, so `url.origin !== self.location.origin` already
// excludes them): the app already has its own read-only data cache
// (src/cache.ts) that knows which responses are safe to serve stale and shows a
// banner when it does. This service worker only needs to get the UI shell to load.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

/* King Khan Fast Food – service worker
   Goal: always show the LATEST menu/prices when online, still open offline.
   - index.html / pages: NETWORK FIRST (never served from cache while online)
   - icons & photos: stale-while-revalidate
   - WhatsApp, fonts, visitor counter and everything else: not touched */
const CACHE = "kingkhan-2026-11-12";            // change to force a full refresh
const PRECACHE = ["/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Pages: always ask the network first (bypassing the browser HTTP cache).
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req, { cache: "no-store" })
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put("/index.html", copy));
          }
          return res;
        })
        .catch(() =>
          caches.match("/index.html").then((hit) => hit || new Response(
            "<h2 style='font-family:sans-serif;text-align:center;margin-top:30vh'>You are offline.<br>Please check your internet and try again.</h2>",
            { headers: { "Content-Type": "text/html; charset=utf-8" } }
          ))
        )
    );
    return;
  }

  // Never cache these files; let the browser fetch them directly.
  if (url.origin === self.location.origin &&
      (url.pathname === "/service-worker.js" || url.pathname === "/manifest.json" || url.pathname === "/index.html")) return;

  // Same-site icons and Unsplash food photos: serve fast, refresh in the background.
  const cacheable = (url.origin === self.location.origin) || url.hostname === "images.unsplash.com";
  if (!cacheable) return;
  event.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === "opaque")) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});

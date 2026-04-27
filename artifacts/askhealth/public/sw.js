// HealthCircle PWA service worker — minimal, network-first for navigations,
// cache-first for static assets, and a friendly offline fallback.
const SW_VERSION = "v1.0.1";
const STATIC_CACHE = `hc-static-${SW_VERSION}`;
const RUNTIME_CACHE = `hc-runtime-${SW_VERSION}`;
const OFFLINE_URL = "/offline.html";

const PRECACHE = [
  "/",
  "/offline.html",
  "/manifest.json",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/favicon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(PRECACHE).catch(() => undefined)
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isApiRequest(url) {
  return url.pathname.startsWith("/api/") || url.hostname.includes("clerk.");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never intercept API or auth requests — always hit the network fresh.
  if (isApiRequest(url)) return;

  // Cross-origin (fonts, images): try cache first, then network.
  if (url.origin !== self.location.origin) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req)
            .then((res) => {
              const copy = res.clone();
              caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
              return res;
            })
            .catch(() => cached)
      )
    );
    return;
  }

  // Navigation requests: network-first, fall back to cached index.html or offline page.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put("/", copy)).catch(() => undefined);
          return res;
        })
        .catch(async () => {
          const cached = await caches.match("/");
          return cached || caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // Same-origin static assets: cache-first.
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req)
          .then((res) => {
            if (res.ok && (res.type === "basic" || res.type === "default")) {
              const copy = res.clone();
              caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
            }
            return res;
          })
          .catch(() => cached)
    )
  );
});

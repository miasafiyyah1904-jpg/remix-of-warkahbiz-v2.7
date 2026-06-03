/* Warkah Biz service worker */
const CACHE_NAME = "warkahbiz-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (data && data.type === "DRAIN_QUEUE") {
    self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
      clients.forEach((c) => c.postMessage({ type: "DRAIN_QUEUE" }));
    });
  }
});

function isSupabase(url) {
  return url.hostname.endsWith(".supabase.co");
}

function isAppShell(url) {
  if (url.origin !== self.location.origin) return false;
  const p = url.pathname;
  if (p.endsWith(".js") || p.endsWith(".css") || p.endsWith(".html")) return true;
  // Treat navigation requests as app shell
  return false;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || fetchPromise;
}

async function networkFirstWithTimeout(request, timeoutMs) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const networkPromise = fetch(request).then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), timeoutMs)
    );
    return await Promise.race([networkPromise, timeoutPromise]);
  } catch (e) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw e;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (isSupabase(url)) {
    event.respondWith(networkFirstWithTimeout(request, 4000));
    return;
  }

  if (request.mode === "navigate" || isAppShell(url)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
});

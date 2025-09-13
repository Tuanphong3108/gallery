const CACHE_NAME = "gallery-cache-v1";
const urlsToCache = [
  "index.html",
  "viewer.js",
  "style.css",
  "manifest.json",
  "gallery.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", async (event) => {
  event.waitUntil((async () => {
    try {
      // Test mạng
      await fetch("index.html", { method: "HEAD", cache: "no-store" });

      // Nếu có mạng → clear toàn bộ cache
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      console.log("[SW] Online ✅ → Cache cleared, fresh files will be used.");

      // Cache lại
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(urlsToCache);

    } catch {
      console.log("[SW] Offline 🚫 → Keep old cache.");
    }

    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  event.respondWith((async () => {
    try {
      // Luôn ưu tiên network
      const networkResponse = await fetch(event.request, { cache: "no-store" });

      // Nếu fetch thành công → update cache
      const cache = await caches.open(CACHE_NAME);
      cache.put(event.request, networkResponse.clone());
      return networkResponse;

    } catch {
      // Nếu offline → lấy cache
      const cachedResponse = await caches.match(event.request);
      return cachedResponse || Response.error();
    }
  })());
});

// 🆕 Message outdated version
self.addEventListener("message", async (event) => {
  if (event.data === "checkVersion") {
    try {
      await fetch("index.html", { method: "HEAD", cache: "no-store" });
      // Nếu fetch được → notify client kiểm tra
      event.source.postMessage({ type: "outdated" });
    } catch {
      // Offline thì thôi
    }
  }
});

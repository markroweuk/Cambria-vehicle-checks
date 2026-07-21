const CACHE_NAME = "cambria-fleet-safety-v4-2";
const APP_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./images/cambria-logo.png",
  "./images/icon-192.png",
  "./images/icon-512.png",
  "./apple-touch-icon.png",
  "./images/vehicles/hc04xtl.svg",
  "./images/vehicles/yt60xtr.svg",
  "./images/vehicles/sc16lvy.svg",
  "./images/vehicles/mx10ayh.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then(match => match || caches.match("./index.html")))
  );
});

// Service worker de la app MAJ REALTY.
// No guarda páginas ni datos de usuarios: solo muestra un aviso cuando no hay conexión.
const CACHE = "maj-offline-v1";
const OFFLINE = "/offline.html";
const ICON = "/app-icons/icon-192.png";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE, ICON])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE)));
  } else if (new URL(event.request.url).pathname === ICON) {
    // El logo de la página sin conexión
    event.respondWith(fetch(event.request).catch(() => caches.match(ICON)));
  }
});

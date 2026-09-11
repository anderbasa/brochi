// Cachea el "cascarón" (HTML/CSS/JS/iconos) para abrir rápido y offline.
// Los datos (Firestore) y las fotos (Storage) nunca pasan por aquí: siempre red.
const CACHE = "brochi-v8";
const ASSETS = [
  "./",
  "./index.html",
  "./css/estilo.css",
  "./js/app.js",
  "./js/config.js",
  "./js/firebase.js",
  "./js/fotos.js",
  "./js/identidad.js",
  "./js/imagenes.js",
  "./js/ui.js",
  "./js/vista-lista.js",
  "./js/vista-recuerdos.js",
  "./js/vista-mapa.js",
  "./manifest.webmanifest",
  "./icons/favicon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== location.origin) return; // deja pasar Firebase, Leaflet, fuentes

  // Red primero (para recibir cambios), caché como respaldo sin conexión.
  // `cache: "no-store"` es importante: sin esto, un `fetch()` normal puede
  // devolver una respuesta ya guardada en la caché HTTP del propio
  // navegador (no la nuestra) aunque haya red, y entonces "red primero" no
  // seria realmente la versión más reciente publicada.
  e.respondWith(
    fetch(request.url, { cache: "no-store" })
      .then((resp) => {
        const copia = resp.clone();
        caches.open(CACHE).then((c) => c.put(request, copia));
        return resp;
      })
      .catch(() => caches.match(request).then((c) => c || caches.match("./index.html")))
  );
});

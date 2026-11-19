/* Service worker de Block of the Dead: permite instalar el juego y jugar sin conexión.
   Estrategia "red primero": con conexión siempre se sirve lo más nuevo (y se guarda una copia);
   sin conexión se usa la copia guardada. La caché lleva la versión del juego en el nombre. */
importScripts('js/config.js', 'js/precache.js');

const CACHE = 'botd-' + self.BOTD.VERSION;
const FONT_HOSTS = /(^|\.)fonts\.(googleapis|gstatic)\.com$/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(self.BOTD_PRECACHE)));
});

// Al activarse, borra las cachés de versiones anteriores
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('botd-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// La página pide activar la nueva versión cuando el jugador pulsa "Actualizar"
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !FONT_HOSTS.test(url.hostname)) return;
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })
        .then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});

/* =========================================================
   PRENOTA OMBRELLONE - SERVICE WORKER
   ========================================================= */

const CACHE_VERSION = "prenota-ombrellone-v1.1.0";

const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./admin.html",
  "./admin.css",
  "./admin.js",
  "./mia-prenotazione.html",
  "./mia-prenotazione.css",
  "./mia-prenotazione.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

/* Installazione: salva i file principali */
self.addEventListener("install", event => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

/* Attivazione: elimina le vecchie cache */
self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_VERSION)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* Richieste */
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  /*
    Le richieste verso Google Apps Script devono sempre andare online,
    perché contengono disponibilità e prenotazioni aggiornate.
  */
  if (
    url.hostname === "script.google.com" ||
    url.hostname === "script.googleusercontent.com"
  ) {
    event.respondWith(fetch(request));
    return;
  }

  /* Non gestire richieste diverse da GET */
  if (request.method !== "GET") {
    return;
  }

  /*
    Per le pagine HTML usa prima la rete:
    così gli aggiornamenti pubblicati su GitHub arrivano subito.
  */
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();

          caches.open(CACHE_VERSION).then(cache => {
            cache.put(request, copy);
          });

          return response;
        })
        .catch(async () => {
          return (
            (await caches.match(request)) ||
            (await caches.match("./index.html"))
          );
        })
    );

    return;
  }

  /*
    Per CSS, JavaScript e immagini usa prima la cache,
    ma aggiorna la copia in background quando possibile.
  */
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      const networkResponse = fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();

            caches.open(CACHE_VERSION).then(cache => {
              cache.put(request, copy);
            });
          }

          return response;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkResponse;
    })
  );
});

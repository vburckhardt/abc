// ===================== ABC de Léo — Service Worker =====================
// Stratégie "cache-first" simple, hors-ligne complet une fois installé.
// Change VERSION à chaque déploiement pour invalider l'ancien cache.
const VERSION = "v6";
const CACHE_NAME = "abc-de-leo-" + VERSION;

// Fichiers de l'app shell (chemins relatifs, valables sous un sous-répertoire
// GitHub Pages du type https://user.github.io/abc/).
const FICHIERS_APP = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./words.js",
  "./manifest.webmanifest",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(function (cache) {
        return cache
          .addAll(FICHIERS_APP.map(function (f) {
            return new Request(f, { cache: "reload" });
          }))
          .catch(function () {
            // Tolère l'absence de certains fichiers (ex: icônes pas encore créées)
          });
      })
      .then(function () {
        // Précharge la liste des fichiers audio si elle existe déjà.
        return fetch("./audio/manifest.json")
          .then(function (rep) {
            if (!rep.ok) return null;
            return rep.json();
          })
          .then(function (liste) {
            if (!liste || !Array.isArray(liste)) return;
            return caches.open(CACHE_NAME).then(function (cache) {
              return Promise.all(
                liste.map(function (chemin) {
                  return cache.add(chemin).catch(function () {});
                })
              );
            });
          })
          .catch(function () {
            // Pas de manifest audio encore généré : ce n'est pas grave.
          });
      })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (noms) {
      return Promise.all(
        noms
          .filter(function (n) {
            return n !== CACHE_NAME;
          })
          .map(function (n) {
            return caches.delete(n);
          })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then(function (reponseCache) {
      if (reponseCache) return reponseCache;
      return fetch(event.request)
        .then(function (reponseReseau) {
          // Met en cache les nouvelles ressources same-origin (ex: audio ajouté après coup).
          if (reponseReseau && reponseReseau.ok && event.request.url.indexOf(self.location.origin) === 0) {
            var copie = reponseReseau.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(event.request, copie);
            });
          }
          return reponseReseau;
        })
        .catch(function () {
          // Hors-ligne et pas en cache : rien à faire de plus ici.
          return new Response("", { status: 504 });
        });
    })
  );
});

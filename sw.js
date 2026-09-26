// ===================== ABC — Service Worker =====================
// Hors ligne complet une fois installé. En ligne, les fichiers viennent
// toujours du serveur (le cache ne sert que hors ligne, ou si le réseau ne
// répond pas en 4 s). Le numéro de version est dans version.js : à augmenter
// à chaque mise à jour.
importScripts("./version.js");
const CACHE_NAME = "abc-v" + self.APP_VERSION;

// Chemins relatifs : fonctionne sous un sous-dossier (ex. /abc/).
const FICHIERS_APP = [
  "./",
  "./index.html",
  "./version.js",
  "./style.css",
  "./app.js",
  "./words.js",
  "./syllabes.js",
  "./manifest.webmanifest",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // Un par un : un fichier manquant n'empêche pas de mettre les autres en cache.
      return Promise.all(FICHIERS_APP.map(function (f) {
        return cache.add(new Request(f, { cache: "reload" })).catch(function () {});
      }));
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (noms) {
      return Promise.all(noms.filter(function (n) {
        return n !== CACHE_NAME;
      }).map(function (n) {
        return caches.delete(n);
      }));
    })
  );
  self.clients.claim();
});

function depuisCache(requete) {
  return caches.match(requete, { ignoreSearch: true }).then(function (r) {
    if (r) return r;
    if (requete.mode === "navigate") return caches.match("./index.html");
    return new Response("", { status: 504 });
  });
}

self.addEventListener("fetch", function (event) {
  var requete = event.request;
  if (requete.method !== "GET" || new URL(requete.url).origin !== self.location.origin) return;
  var reseau = fetch(requete, { cache: "no-store" }).then(function (reponse) {
    if (reponse && reponse.ok) {
      var copie = reponse.clone();
      caches.open(CACHE_NAME).then(function (cache) {
        cache.put(requete, copie);
      });
    }
    return reponse;
  });
  var delai = new Promise(function (_, refuser) {
    setTimeout(refuser, 4000);
  });
  event.respondWith(Promise.race([reseau, delai]).catch(function () {
    return depuisCache(requete);
  }));
});

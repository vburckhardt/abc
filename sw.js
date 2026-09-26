// ===================== ABC — Service Worker =====================
// Hors ligne complet une fois installé. Le numéro de version est dans
// version.js (à augmenter à chaque mise à jour).
importScripts("./version.js");
const VERSION = "v" + self.APP_VERSION;
const CACHE_NAME = "abc-" + VERSION;

// Fichiers de l'app shell (chemins relatifs, valables sous un sous-répertoire
// GitHub Pages du type https://user.github.io/abc/).
const FICHIERS_APP = [
  "./",
  "./index.html",
  "./version.js",
  "./style.css",
  "./app.js",
  "./words.js",
  "./enregistrements.js",
  "./enregistrer.html",
  "./enregistrer.js",
  "./enregistrer.css",
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

// En ligne : le code de l'app (pages, scripts, styles, mots, version) vient
// toujours du serveur ; le cache ne sert que hors ligne (ou si le réseau ne
// répond pas en 4 s). Les sons (audio/) restent « cache d'abord » : gros
// fichiers qui changent rarement.
function mettreEnCache(requete, reponse) {
  if (reponse && reponse.ok && requete.url.indexOf(self.location.origin) === 0) {
    var copie = reponse.clone();
    caches.open(CACHE_NAME).then(function (cache) {
      cache.put(requete, copie);
    });
  }
  return reponse;
}

function depuisCache(requete) {
  return caches.match(requete, { ignoreSearch: true }).then(function (r) {
    if (r) return r;
    if (requete.mode === "navigate") return caches.match("./index.html");
    return new Response("", { status: 504 });
  });
}

function reseauDabord(requete) {
  var reseau = fetch(requete, { cache: "no-store" }).then(function (r) {
    return mettreEnCache(requete, r);
  });
  var delai = new Promise(function (_, refuser) {
    setTimeout(refuser, 4000);
  });
  return Promise.race([reseau, delai]).catch(function () {
    return depuisCache(requete);
  });
}

function cacheDabord(requete) {
  return caches.match(requete).then(function (r) {
    if (r) return r;
    return fetch(requete)
      .then(function (reponse) {
        return mettreEnCache(requete, reponse);
      })
      .catch(function () {
        return new Response("", { status: 504 });
      });
  });
}

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  var estAudio = url.pathname.indexOf("/audio/") !== -1;
  event.respondWith(estAudio ? cacheDabord(event.request) : reseauDabord(event.request));
});

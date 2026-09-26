// ===================== ABC de Léo — enregistrements.js =====================
// Stockage local (IndexedDB) des sons de lettres enregistrés par un parent.
// Aucune promesse ne doit jamais être rejetée : en navigation privée ou si
// IndexedDB est indisponible, on répond simplement "pas d'enregistrement".

(function () {
  "use strict";

  var NOM_BASE = "abc-enregistrements";
  var NOM_MAGASIN = "sons";
  var VERSION_BASE = 1;

  var promesseBase = null;

  function ouvrirBase() {
    if (promesseBase) return promesseBase;
    promesseBase = new Promise(function (resolve) {
      if (!window.indexedDB) {
        resolve(null);
        return;
      }
      try {
        var requete = indexedDB.open(NOM_BASE, VERSION_BASE);
        requete.onupgradeneeded = function () {
          var base = requete.result;
          if (!base.objectStoreNames.contains(NOM_MAGASIN)) {
            base.createObjectStore(NOM_MAGASIN);
          }
        };
        requete.onsuccess = function () {
          resolve(requete.result);
        };
        requete.onerror = function () {
          resolve(null);
        };
        requete.onblocked = function () {
          resolve(null);
        };
      } catch (e) {
        resolve(null);
      }
    });
    return promesseBase;
  }

  function avecMagasin(mode, callback) {
    return ouvrirBase().then(function (base) {
      if (!base) return null;
      return new Promise(function (resolve) {
        try {
          var transaction = base.transaction(NOM_MAGASIN, mode);
          var magasin = transaction.objectStore(NOM_MAGASIN);
          var resultat;
          try {
            resultat = callback(magasin);
          } catch (e) {
            resolve(null);
            return;
          }
          transaction.oncomplete = function () {
            resolve(resultat && resultat.result !== undefined ? resultat.result : resultat);
          };
          transaction.onerror = function () {
            resolve(null);
          };
          transaction.onabort = function () {
            resolve(null);
          };
        } catch (e) {
          resolve(null);
        }
      });
    });
  }

  // Lit l'enregistrement d'une lettre. Résout un Blob, ou null si absent.
  function lire(lettre) {
    var l = (lettre || "").toLowerCase();
    return avecMagasin("readonly", function (magasin) {
      var requete = magasin.get(l);
      var sortie = {};
      requete.onsuccess = function () {
        sortie.result = requete.result || null;
      };
      requete.onerror = function () {
        sortie.result = null;
      };
      return sortie;
    }).then(function (v) {
      return v && v instanceof Blob ? v : (v === null ? null : v);
    }).catch(function () {
      return null;
    });
  }

  // Enregistre (remplace) le son d'une lettre. Résout true/false.
  function ecrire(lettre, blob) {
    var l = (lettre || "").toLowerCase();
    return avecMagasin("readwrite", function (magasin) {
      magasin.put(blob, l);
      return true;
    }).then(function (v) {
      return !!v;
    }).catch(function () {
      return false;
    });
  }

  // Efface l'enregistrement d'une lettre. Résout toujours.
  function effacer(lettre) {
    var l = (lettre || "").toLowerCase();
    return avecMagasin("readwrite", function (magasin) {
      magasin.delete(l);
      return true;
    }).then(function () {
      return true;
    }).catch(function () {
      return false;
    });
  }

  // Liste les lettres qui ont un enregistrement. Résout un tableau (jamais rejeté).
  function lettres() {
    return avecMagasin("readonly", function (magasin) {
      var sortie = {};
      // getAllKeys n'existe pas partout (vieux Safari) : on retombe sur un curseur.
      if (magasin.getAllKeys) {
        var requete = magasin.getAllKeys();
        requete.onsuccess = function () {
          sortie.result = requete.result || [];
        };
        requete.onerror = function () {
          sortie.result = [];
        };
      } else {
        sortie.result = [];
        var curseurRequete = magasin.openCursor();
        curseurRequete.onsuccess = function (e) {
          var curseur = e.target.result;
          if (curseur) {
            sortie.result.push(curseur.key);
            curseur.continue();
          }
        };
        curseurRequete.onerror = function () {};
      }
      return sortie;
    }).then(function (v) {
      return Array.isArray(v) ? v : [];
    }).catch(function () {
      return [];
    });
  }

  // Efface tous les enregistrements. Résout toujours.
  function toutEffacer() {
    return avecMagasin("readwrite", function (magasin) {
      magasin.clear();
      return true;
    }).then(function () {
      return true;
    }).catch(function () {
      return false;
    });
  }

  window.Enregistrements = {
    lire: lire,
    ecrire: ecrire,
    effacer: effacer,
    lettres: lettres,
    toutEffacer: toutEffacer
  };
})();

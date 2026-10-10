// Ce que dit l'app : pour chaque son, le texte donné à la voix et le
// fichier enregistré (audio/…). Utilisé par l'app et par
// tools/liste_sons.js, qui écrit audio/liste.tsv pour tools/voix_mac.sh.
// Fonctionne dans la page (window) et dans Node (self).
(function (racine) {
  // Noms des lettres écrits pour la voix (une lettre seule peut être mal
  // lue ; « bé », « esse »… se lisent comme du français).
  var NOMS_LETTRES = {
    a: "a", b: "bé", c: "cé", d: "dé", e: "eu", f: "effe", g: "gé",
    h: "hache", i: "i", j: "ji", k: "ka", l: "elle", m: "emme", n: "enne",
    o: "o", p: "pé", q: "ku", r: "erre", s: "esse", t: "té", u: "u",
    v: "vé", w: "double vé", x: "ixe", y: "i grec", z: "zède"
  };

  // Minuscules sans accents : « ZÈBRE » -> « zebre ».
  function nomFichier(texte) {
    return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  racine.SONS = {
    lettres: Object.keys(NOMS_LETTRES),
    lettre: function (l) {
      var n = nomFichier(l);
      return { fichier: "audio/lettres/" + n + ".m4a", texte: NOMS_LETTRES[n] };
    },
    syllabe: function (s) {
      return { fichier: "audio/syllabes/" + s + ".m4a", texte: s };
    },
    // `dire` (facultatif dans words.js) : orthographe pour la voix quand le
    // mot est mal lu (noms propres). En minuscules, sinon « CHAT » peut être
    // épelé comme un sigle.
    mot: function (entree) {
      return {
        fichier: "audio/mots/" + nomFichier(entree.mot) + ".m4a",
        texte: (entree.dire || entree.mot).toLowerCase()
      };
    },
    bravo: { fichier: "audio/bravo.m4a", texte: "bravo !" }
  };
})(self);

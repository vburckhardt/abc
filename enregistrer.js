// ===================== ABC de Léo — enregistrer.js =====================
// Page réservée aux parents : enregistrer le son de chaque lettre avec le
// micro de l'appareil. Les fichiers sont stockés dans IndexedDB (voir
// enregistrements.js) et lus par app.js quand le réglage "Leur son" est actif.

(function () {
  "use strict";

  var ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");

  var grilleEl = document.getElementById("grille-lettres");
  var panneauEl = document.getElementById("panneau-lettre");
  var lettrePanneauEl = document.getElementById("lettre-panneau-geante");
  var indicateurEl = document.getElementById("indicateur-enregistrement");
  var messageEl = document.getElementById("message-enregistrer");
  var btnMicro = document.getElementById("btn-micro");
  var btnMicroIcone = document.getElementById("btn-micro-icone");
  var btnMicroTexte = document.getElementById("btn-micro-texte");
  var btnEcouter = document.getElementById("btn-ecouter");
  var btnEffacerLettre = document.getElementById("btn-effacer-lettre");
  var btnLettreSuivante = document.getElementById("btn-lettre-suivante");
  var btnToutEffacer = document.getElementById("btn-tout-effacer");

  var lettreActuelle = null;
  var tuiles = {}; // lettre -> élément tuile

  var flux = null; // MediaStream courant
  var enregistreur = null; // MediaRecorder courant
  var morceaux = [];
  var enregistrementEnCours = false;
  var timerArretAuto = null;
  var DUREE_MAX_MS = 3000;

  var ctx = null;
  function obtenirContexte() {
    if (!ctx) {
      var Ctor = window.AudioContext || window.webkitAudioContext;
      if (Ctor) ctx = new Ctor();
    }
    return ctx;
  }

  var sourceEcoute = null; // source Web Audio en cours de lecture (écoute)
  var urlEcoute = null; // object URL à libérer

  // ------------------------------------------------------------------
  // Construction de la grille A-Z
  // ------------------------------------------------------------------
  function construireGrille() {
    grilleEl.innerHTML = "";
    ALPHABET.forEach(function (l) {
      var tuile = document.createElement("button");
      tuile.type = "button";
      tuile.className = "tuile-lettre";
      tuile.textContent = l.toUpperCase();
      tuile.dataset.lettre = l;
      var pastille = document.createElement("span");
      pastille.className = "pastille";
      pastille.hidden = true;
      tuile.appendChild(pastille);
      tuile.addEventListener("click", function () {
        selectionnerLettre(l);
      });
      grilleEl.appendChild(tuile);
      tuiles[l] = tuile;
    });
  }

  function rafraichirPastilles() {
    window.Enregistrements.lettres().then(function (liste) {
      var presentes = {};
      liste.forEach(function (l) { presentes[l] = true; });
      ALPHABET.forEach(function (l) {
        var pastille = tuiles[l].querySelector(".pastille");
        pastille.hidden = !presentes[l];
      });
    });
  }

  // ------------------------------------------------------------------
  // Sélection d'une lettre : affiche le panneau
  // ------------------------------------------------------------------
  function selectionnerLettre(l) {
    arreterEcoute();
    lettreActuelle = l;
    Object.keys(tuiles).forEach(function (k) {
      tuiles[k].classList.toggle("selectionnee", k === l);
    });
    lettrePanneauEl.textContent = l.toUpperCase();
    panneauEl.classList.remove("ecran-actif-masque");
    afficherMessage("");
    mettreAJourEtatBoutons();
  }

  function mettreAJourEtatBoutons() {
    window.Enregistrements.lire(lettreActuelle).then(function (blob) {
      btnEcouter.disabled = !blob;
      btnEffacerLettre.disabled = !blob;
    });
  }

  function afficherMessage(texte, estErreur) {
    messageEl.textContent = texte || "";
    messageEl.classList.toggle("erreur", !!estErreur);
  }

  // ------------------------------------------------------------------
  // Enregistrement
  // ------------------------------------------------------------------
  function choisirMimeType() {
    if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return "";
    var candidats = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
    for (var i = 0; i < candidats.length; i++) {
      if (MediaRecorder.isTypeSupported(candidats[i])) return candidats[i];
    }
    return "";
  }

  function basculerEnregistrement() {
    if (enregistrementEnCours) {
      arreterEnregistrement();
    } else {
      demarrerEnregistrement();
    }
  }

  function demarrerEnregistrement() {
    if (!lettreActuelle) return;
    if (typeof MediaRecorder === "undefined") {
      afficherMessage("L'enregistrement nécessite iOS 14.3 ou plus récent.", true);
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      afficherMessage("Le micro n'est pas disponible sur cet appareil.", true);
      return;
    }
    afficherMessage("");
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(function (media) {
        flux = media;
        morceaux = [];
        var mime = choisirMimeType();
        try {
          enregistreur = mime ? new MediaRecorder(flux, { mimeType: mime }) : new MediaRecorder(flux);
        } catch (e) {
          afficherMessage("L'enregistrement nécessite iOS 14.3 ou plus récent.", true);
          arreterPistes();
          return;
        }
        enregistreur.addEventListener("dataavailable", function (e) {
          if (e.data && e.data.size > 0) morceaux.push(e.data);
        });
        enregistreur.addEventListener("stop", surArretEnregistreur);
        enregistreur.start();
        enregistrementEnCours = true;
        majBoutonMicro();
        indicateurEl.classList.remove("ecran-actif-masque");
        timerArretAuto = setTimeout(arreterEnregistrement, DUREE_MAX_MS);
      })
      .catch(function () {
        afficherMessage("Autorisez le micro dans Réglages > Safari (ou pour l'app).", true);
      });
  }

  function arreterEnregistrement() {
    clearTimeout(timerArretAuto);
    timerArretAuto = null;
    if (enregistreur && enregistreur.state !== "inactive") {
      try { enregistreur.stop(); } catch (e) {}
    }
    enregistrementEnCours = false;
    majBoutonMicro();
    indicateurEl.classList.add("ecran-actif-masque");
  }

  function majBoutonMicro() {
    btnMicro.classList.toggle("en-cours", enregistrementEnCours);
    btnMicroIcone.textContent = enregistrementEnCours ? "⏹" : "🎙️";
    btnMicroTexte.textContent = enregistrementEnCours ? "Arrêter" : "Enregistrer";
  }

  function arreterPistes() {
    if (flux) {
      flux.getTracks().forEach(function (piste) { piste.stop(); });
      flux = null;
    }
  }

  function surArretEnregistreur() {
    var mimeType = (enregistreur && enregistreur.mimeType) || "audio/webm";
    var brut = new Blob(morceaux, { type: mimeType });
    morceaux = [];
    arreterPistes();
    var lettrePourCetEnregistrement = lettreActuelle;

    if (brut.size === 0) {
      afficherMessage("Rien n'a été enregistré, réessayez.", true);
      return;
    }

    afficherMessage("Traitement du son…");
    traiterEnregistrement(brut)
      .then(function (blobWav) {
        return window.Enregistrements.ecrire(lettrePourCetEnregistrement, blobWav).then(function () {
          return blobWav;
        });
      })
      .then(function (blobWav) {
        rafraichirPastilles();
        if (lettreActuelle === lettrePourCetEnregistrement) {
          mettreAJourEtatBoutons();
          afficherMessage("Son enregistré !");
          jouerBlob(blobWav);
        }
        // Prévient les autres pages ouvertes (ex: index.html) qu'un son a changé.
        try {
          localStorage.setItem("abc-enregistrements-maj", String(Date.now()));
        } catch (e) {}
      })
      .catch(function () {
        afficherMessage("Impossible de traiter l'enregistrement, réessayez.", true);
      });
  }

  // ------------------------------------------------------------------
  // Traitement audio : décodage, mono, découpe des silences, fondu,
  // normalisation, puis encodage WAV 16 bits.
  // ------------------------------------------------------------------
  function traiterEnregistrement(blob) {
    var c = obtenirContexte();
    if (!c) return Promise.reject(new Error("pas de contexte audio"));
    return blob.arrayBuffer().then(function (arr) {
      return c.decodeAudioData(arr.slice(0));
    }).then(function (buffer) {
      var mono = versMono(buffer);
      var decoupe = couperSilence(mono, buffer.sampleRate);
      appliquerFondu(decoupe, buffer.sampleRate);
      normaliser(decoupe);
      return encoderWav(decoupe, buffer.sampleRate);
    });
  }

  function versMono(buffer) {
    var n = buffer.length;
    var sortie = new Float32Array(n);
    var nbCanaux = buffer.numberOfChannels;
    for (var canal = 0; canal < nbCanaux; canal++) {
      var donnees = buffer.getChannelData(canal);
      for (var i = 0; i < n; i++) {
        sortie[i] += donnees[i] / nbCanaux;
      }
    }
    return sortie;
  }

  // Coupe le silence en tête/queue (seuil ~ -40 dBFS relatif au pic), garde
  // une petite marge de 40 ms de chaque côté.
  function couperSilence(donnees, sampleRate) {
    var pic = 0;
    for (var i = 0; i < donnees.length; i++) {
      var v = Math.abs(donnees[i]);
      if (v > pic) pic = v;
    }
    if (pic === 0) return donnees; // silence complet : on ne touche à rien

    var seuil = pic * Math.pow(10, -40 / 20); // -40 dBFS relatif au pic
    var marge = Math.round(sampleRate * 0.04); // 40 ms

    var debut = 0;
    while (debut < donnees.length && Math.abs(donnees[debut]) < seuil) debut++;
    var fin = donnees.length - 1;
    while (fin > debut && Math.abs(donnees[fin]) < seuil) fin--;

    debut = Math.max(0, debut - marge);
    fin = Math.min(donnees.length - 1, fin + marge);

    if (fin <= debut) return donnees; // rien d'audible trouvé : on garde tel quel
    return donnees.slice(debut, fin + 1);
  }

  // Fondu d'entrée/sortie de 10 ms pour éviter les clics.
  function appliquerFondu(donnees, sampleRate) {
    var n = Math.min(Math.round(sampleRate * 0.01), Math.floor(donnees.length / 2));
    for (var i = 0; i < n; i++) {
      var gain = i / n;
      donnees[i] *= gain;
      donnees[donnees.length - 1 - i] *= gain;
    }
  }

  // Normalise le pic à ~0.9.
  function normaliser(donnees) {
    var pic = 0;
    for (var i = 0; i < donnees.length; i++) {
      var v = Math.abs(donnees[i]);
      if (v > pic) pic = v;
    }
    if (pic === 0) return;
    var facteur = 0.9 / pic;
    for (var j = 0; j < donnees.length; j++) {
      donnees[j] *= facteur;
    }
  }

  // Encode un Float32Array mono en WAV PCM 16 bits.
  function encoderWav(donnees, sampleRate) {
    var octetsParEchantillon = 2;
    var tailleDonnees = donnees.length * octetsParEchantillon;
    var buffer = new ArrayBuffer(44 + tailleDonnees);
    var vue = new DataView(buffer);

    function ecrireChaine(decalage, chaine) {
      for (var i = 0; i < chaine.length; i++) {
        vue.setUint8(decalage + i, chaine.charCodeAt(i));
      }
    }

    ecrireChaine(0, "RIFF");
    vue.setUint32(4, 36 + tailleDonnees, true);
    ecrireChaine(8, "WAVE");
    ecrireChaine(12, "fmt ");
    vue.setUint32(16, 16, true); // taille du sous-bloc fmt
    vue.setUint16(20, 1, true); // PCM
    vue.setUint16(22, 1, true); // mono
    vue.setUint32(24, sampleRate, true);
    vue.setUint32(28, sampleRate * octetsParEchantillon, true); // débit d'octets
    vue.setUint16(32, octetsParEchantillon, true); // alignement bloc
    vue.setUint16(34, 16, true); // bits par échantillon
    ecrireChaine(36, "data");
    vue.setUint32(40, tailleDonnees, true);

    var decalage = 44;
    for (var i = 0; i < donnees.length; i++) {
      var echantillon = Math.max(-1, Math.min(1, donnees[i]));
      vue.setInt16(decalage, echantillon < 0 ? echantillon * 0x8000 : echantillon * 0x7fff, true);
      decalage += 2;
    }

    return new Blob([buffer], { type: "audio/wav" });
  }

  // ------------------------------------------------------------------
  // Écoute
  // ------------------------------------------------------------------
  function jouerBlob(blob) {
    arreterEcoute();
    try {
      urlEcoute = URL.createObjectURL(blob);
    } catch (e) {
      return;
    }
    var audio = new Audio(urlEcoute);
    audio.addEventListener("ended", arreterEcoute);
    audio.play().catch(function () {});
    sourceEcoute = audio;
  }

  function arreterEcoute() {
    if (sourceEcoute) {
      try { sourceEcoute.pause(); } catch (e) {}
      sourceEcoute = null;
    }
    if (urlEcoute) {
      URL.revokeObjectURL(urlEcoute);
      urlEcoute = null;
    }
  }

  function ecouter() {
    if (!lettreActuelle) return;
    window.Enregistrements.lire(lettreActuelle).then(function (blob) {
      if (blob) jouerBlob(blob);
    });
  }

  function effacerLettre() {
    if (!lettreActuelle) return;
    window.Enregistrements.effacer(lettreActuelle).then(function () {
      rafraichirPastilles();
      mettreAJourEtatBoutons();
      afficherMessage("Enregistrement effacé.");
      try {
        localStorage.setItem("abc-enregistrements-maj", String(Date.now()));
      } catch (e) {}
    });
  }

  function lettreSuivante() {
    if (!lettreActuelle) return;
    var index = ALPHABET.indexOf(lettreActuelle);
    var suivante = ALPHABET[(index + 1) % ALPHABET.length];
    selectionnerLettre(suivante);
  }

  function toutEffacer() {
    if (!window.confirm("Effacer tous les enregistrements de lettres ?")) return;
    window.Enregistrements.toutEffacer().then(function () {
      rafraichirPastilles();
      if (lettreActuelle) mettreAJourEtatBoutons();
      afficherMessage("Tous les enregistrements ont été effacés.");
      try {
        localStorage.setItem("abc-enregistrements-maj", String(Date.now()));
      } catch (e) {}
    });
  }

  // ------------------------------------------------------------------
  // Écouteurs
  // ------------------------------------------------------------------
  btnMicro.addEventListener("click", basculerEnregistrement);
  btnEcouter.addEventListener("click", ecouter);
  btnEffacerLettre.addEventListener("click", effacerLettre);
  btnLettreSuivante.addEventListener("click", lettreSuivante);
  btnToutEffacer.addEventListener("click", toutEffacer);

  window.addEventListener("pagehide", function () {
    arreterEnregistrement();
    arreterPistes();
    arreterEcoute();
  });

  construireGrille();
  rafraichirPastilles();
})();

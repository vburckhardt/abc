// ===================== ABC de Léo — app.js =====================
// Application unique, sans framework, sans build. Toutes les routes sont
// gérées en montrant/masquant des <section>. Tout est en français.

(function () {
  "use strict";

  // ----------------------------------------------------------------
  // Normalisation des mots -> identifiant de fichier audio.
  // RÈGLE (à respecter aussi côté générateur Python `tools/generate_audio.py`) :
  //   1. Décomposer en NFD (séparer lettre + accent)
  //   2. Retirer les diacritiques (accents)
  //   3. Passer en minuscules
  //   4. Retirer tout ce qui n'est pas a-z (espaces, apostrophes, tirets…)
  // Exemples : "LÉO" -> "leo", "GÂTEAU" -> "gateau", "BURCKHARDT" -> "burckhardt"
  // ----------------------------------------------------------------
  function normaliserId(mot) {
    return mot
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z]/g, "");
  }
  window.normaliserId = normaliserId; // exposé pour debug éventuel

  // Retire les accents d'une seule lettre pour la comparaison clavier.
  function lettrePlate(l) {
    return l.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  }

  var MOTS = window.MOTS || [];

  // ----------------------------------------------------------------
  // Réglages (localStorage, avec valeurs par défaut si indisponible)
  // ----------------------------------------------------------------
  var REGLAGES_DEFAUT = {
    modeLettre: "son", // "son" | "nom"
    lectureAuto: true, // lire la bande de lettres après chaque lettre
    categories: { courts: true, moyens: false, longs: false, famille: true },
    sonActif: true
  };

  var reglages = chargerReglages();

  function chargerReglages() {
    try {
      var brut = localStorage.getItem("abc-reglages");
      if (!brut) return clone(REGLAGES_DEFAUT);
      var parse = JSON.parse(brut);
      return {
        modeLettre: parse.modeLettre === "nom" ? "nom" : "son",
        lectureAuto: parse.lectureAuto !== false,
        categories: Object.assign(clone(REGLAGES_DEFAUT.categories), parse.categories || {}),
        sonActif: parse.sonActif !== false
      };
    } catch (e) {
      return clone(REGLAGES_DEFAUT);
    }
  }

  function sauverReglages() {
    try {
      localStorage.setItem("abc-reglages", JSON.stringify(reglages));
    } catch (e) {
      // stockage indisponible : on continue sans persister
    }
  }

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  // ==================================================================
  // MOTEUR AUDIO (Web Audio API, avec déblocage iOS)
  // ==================================================================
  var ctx = null;
  var buffers = new Map(); // chemin -> AudioBuffer (ou null si échec)
  var enCoursLettre = null; // source actuellement jouée pour une lettre

  function obtenirContexte() {
    if (!ctx) {
      var Ctor = window.AudioContext || window.webkitAudioContext;
      if (Ctor) ctx = new Ctor();
    }
    return ctx;
  }

  function debloquerAudio() {
    var c = obtenirContexte();
    if (c && c.state === "suspended") {
      c.resume().catch(function () {});
    }
    // Permet au son de jouer même avec l'interrupteur silencieux sur iPhone.
    try {
      if (navigator.audioSession) {
        navigator.audioSession.type = "playback";
      }
    } catch (e) {}
  }

  function chargerBuffer(chemin) {
    if (buffers.has(chemin)) return Promise.resolve(buffers.get(chemin));
    var c = obtenirContexte();
    if (!c) return Promise.resolve(null);
    return fetch(chemin)
      .then(function (rep) {
        if (!rep.ok) throw new Error("fichier absent");
        return rep.arrayBuffer();
      })
      .then(function (arr) {
        return c.decodeAudioData(arr);
      })
      .then(function (buf) {
        buffers.set(chemin, buf);
        return buf;
      })
      .catch(function () {
        buffers.set(chemin, null); // évite de re-fetcher un fichier manquant
        return null;
      });
  }

  // Joue un buffer, retourne le "source node" (ou null).
  function jouerBuffer(buf) {
    if (!buf || !reglages.sonActif) return null;
    var c = obtenirContexte();
    if (!c) return null;
    try {
      var src = c.createBufferSource();
      src.buffer = buf;
      src.connect(c.destination);
      src.start(0);
      return src;
    } catch (e) {
      return null;
    }
  }

  // Lettres dont le son est dit par la voix de l'appareil plutôt que par le
  // fichier enregistré (choisi à l'oreille sur ecoute.html). Le fichier sert
  // de secours si la synthèse vocale n'existe pas.
  var SON_VOIX_APPAREIL = { o: "o" };

  // Joue le son d'une lettre (son OU nom selon réglage). Arrête la précédente.
  function jouerLettre(lettre) {
    if (!reglages.sonActif) return;
    var l = lettrePlate(lettre).toLowerCase();
    if (l.length !== 1 || l < "a" || l > "z") return;
    var dossier = reglages.modeLettre === "nom" ? "noms" : "sons";
    var chemin = "./audio/" + dossier + "/" + l + ".mp3";
    if (synthese) synthese.cancel(); // coupe une lecture de mot en cours
    if (enCoursLettre) {
      try { enCoursLettre.stop(0); } catch (e) {}
      enCoursLettre = null;
    }
    if (dossier === "sons" && synthese && SON_VOIX_APPAREIL[l]) {
      dire(SON_VOIX_APPAREIL[l]);
      return;
    }
    chargerBuffer(chemin).then(function (buf) {
      enCoursLettre = jouerBuffer(buf);
    });
  }

  // Joue un mot par son id normalisé.
  function jouerMot(id) {
    if (!reglages.sonActif) return Promise.resolve();
    var chemin = "./audio/mots/" + id + ".mp3";
    return chargerBuffer(chemin).then(function (buf) {
      var src = jouerBuffer(buf);
      if (!src || !buf) return Promise.resolve();
      return new Promise(function (resolve) {
        src.onended = resolve;
        // filet de sécurité si onended ne se déclenche pas
        setTimeout(resolve, (buf.duration || 1) * 1000 + 300);
      });
    });
  }

  function jouerBravo() {
    if (!reglages.sonActif) return Promise.resolve();
    return chargerBuffer("./audio/bravo.mp3").then(function (buf) {
      var src = jouerBuffer(buf);
      if (!src || !buf) return Promise.resolve();
      return new Promise(function (resolve) {
        src.onended = resolve;
        setTimeout(resolve, (buf.duration || 1) * 1000 + 300);
      });
    });
  }

  // Joue mot puis bravo, l'un après l'autre.
  function jouerSequenceMotBravo(id) {
    return jouerMot(id).then(jouerBravo);
  }

  function precharger26Lettres() {
    for (var code = 97; code <= 122; code++) {
      var l = String.fromCharCode(code);
      chargerBuffer("./audio/sons/" + l + ".mp3");
      chargerBuffer("./audio/noms/" + l + ".mp3");
    }
  }

  // Petits sons synthétisés (ding / bonk) via oscillateur, pas de fichier.
  function jouerTon(freqDepart, freqFin, duree, type) {
    if (!reglages.sonActif) return;
    var c = obtenirContexte();
    if (!c) return;
    try {
      var osc = c.createOscillator();
      var gain = c.createGain();
      osc.type = type || "sine";
      osc.frequency.setValueAtTime(freqDepart, c.currentTime);
      if (freqFin) osc.frequency.exponentialRampToValueAtTime(freqFin, c.currentTime + duree);
      gain.gain.setValueAtTime(0.0001, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.35, c.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duree);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + duree + 0.05);
    } catch (e) {}
  }

  function jouerDing() {
    jouerTon(880, 1320, 0.18, "sine");
  }

  function jouerBonk() {
    jouerTon(180, 90, 0.22, "sine");
  }

  // ------------------------------------------------------------------
  // Voix de l'appareil (speechSynthesis) pour lire n'importe quelle suite
  // de lettres tapée. Les voix françaises d'iOS fonctionnent hors ligne.
  // ------------------------------------------------------------------
  var synthese = window.speechSynthesis || null;
  var voixFr = null;

  function choisirVoixFr() {
    if (!synthese) return;
    var voix = synthese.getVoices().filter(function (v) {
      return /^fr/i.test(v.lang);
    });
    // Préférence : fr-FR, installée localement (hors ligne).
    voix.sort(function (a, b) {
      var sa = (/fr[-_]FR/i.test(a.lang) ? 2 : 0) + (a.localService ? 1 : 0);
      var sb = (/fr[-_]FR/i.test(b.lang) ? 2 : 0) + (b.localService ? 1 : 0);
      return sb - sa;
    });
    voixFr = voix[0] || null;
  }
  if (synthese) {
    choisirVoixFr();
    if ("onvoiceschanged" in synthese) synthese.onvoiceschanged = choisirVoixFr;
  }

  function dire(texte) {
    if (!synthese || !reglages.sonActif || !texte) return;
    synthese.cancel();
    // En minuscules, sinon « CHAT » peut être épelé comme un sigle.
    var u = new SpeechSynthesisUtterance(texte.toLowerCase());
    u.lang = "fr-FR";
    if (voixFr) u.voice = voixFr;
    u.rate = 0.8;
    synthese.speak(u);
  }

  // iOS n'autorise la synthèse vocale qu'après un premier appel pendant un geste.
  function debloquerSynthese() {
    if (!synthese) return;
    var u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    synthese.speak(u);
  }

  // Déblocage sur premier geste utilisateur.
  var debloqueDeja = false;
  // On relance le contexte à chaque geste : iOS le suspend quand l'app
  // passe en arrière-plan.
  function surPremierGeste() {
    debloquerAudio();
    if (debloqueDeja) return;
    debloqueDeja = true;
    debloquerSynthese();
    precharger26Lettres();
  }
  window.addEventListener("pointerdown", surPremierGeste, { once: false, passive: true });
  window.addEventListener("keydown", surPremierGeste, { once: false });

  // ==================================================================
  // NAVIGATION ENTRE ÉCRANS
  // ==================================================================
  var ecrans = {
    accueil: document.getElementById("screen-home"),
    lettres: document.getElementById("screen-lettres"),
    mots: document.getElementById("screen-mots")
  };
  var overlayReglages = document.getElementById("overlay-reglages");

  function afficherEcran(nom) {
    Object.keys(ecrans).forEach(function (k) {
      ecrans[k].classList.toggle("ecran-actif-masque", k !== nom);
    });
    if (nom === "lettres") {
      resetLettresEcran();
    } else if (nom === "mots") {
      demarrerNouveauMot();
    } else {
      clearTimeout(timerMotSuivant);
    }
  }

  document.getElementById("btn-go-lettres").addEventListener("click", function () {
    afficherEcran("lettres");
  });
  document.getElementById("btn-go-mots").addEventListener("click", function () {
    afficherEcran("mots");
  });
  Array.prototype.forEach.call(document.querySelectorAll("[data-home]"), function (btn) {
    btn.addEventListener("click", function () {
      afficherEcran("accueil");
    });
  });

  // ----------------------------------------------------------------
  // Réglages : ouverture par appui long (2s) sur le bouton engrenage
  // ----------------------------------------------------------------
  var btnReglages = document.getElementById("btn-reglages");
  var anneauProgres = document.getElementById("anneau-progres");
  var CIRCONFERENCE = 119; // 2 * PI * 19, cf. style.css
  var appuiTimer = null;
  var appuiDebut = 0;
  var DUREE_APPUI = 2000;

  function demarrerAppuiLong() {
    appuiDebut = Date.now();
    annulerAppuiLong();
    function boucle() {
      var ecoule = Date.now() - appuiDebut;
      var ratio = Math.min(1, ecoule / DUREE_APPUI);
      anneauProgres.style.strokeDashoffset = String(CIRCONFERENCE * (1 - ratio));
      if (ratio >= 1) {
        anneauProgres.style.strokeDashoffset = "0";
        ouvrirReglages();
        annulerAppuiLong();
        return;
      }
      appuiTimer = requestAnimationFrame(boucle);
    }
    appuiTimer = requestAnimationFrame(boucle);
  }

  function annulerAppuiLong() {
    if (appuiTimer) cancelAnimationFrame(appuiTimer);
    appuiTimer = null;
    anneauProgres.style.strokeDashoffset = String(CIRCONFERENCE);
  }

  btnReglages.addEventListener("pointerdown", demarrerAppuiLong);
  btnReglages.addEventListener("pointerup", annulerAppuiLong);
  btnReglages.addEventListener("pointerleave", annulerAppuiLong);
  btnReglages.addEventListener("pointercancel", annulerAppuiLong);
  // Empêche le menu contextuel / le déclenchement de "click" simple.
  btnReglages.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  btnReglages.addEventListener("click", function (e) { e.preventDefault(); });

  function ouvrirReglages() {
    remplirFormulaireReglages();
    overlayReglages.classList.remove("ecran-actif-masque");
  }
  function fermerReglages() {
    overlayReglages.classList.add("ecran-actif-masque");
  }
  document.getElementById("btn-fermer-reglages").addEventListener("click", fermerReglages);

  function remplirFormulaireReglages() {
    document.getElementById("radio-son").checked = reglages.modeLettre === "son";
    document.getElementById("radio-nom").checked = reglages.modeLettre === "nom";
    document.getElementById("radio-lecture-auto").checked = reglages.lectureAuto;
    document.getElementById("radio-lecture-bouton").checked = !reglages.lectureAuto;
    document.getElementById("cat-courts").checked = !!reglages.categories.courts;
    document.getElementById("cat-moyens").checked = !!reglages.categories.moyens;
    document.getElementById("cat-longs").checked = !!reglages.categories.longs;
    document.getElementById("cat-famille").checked = !!reglages.categories.famille;
    document.getElementById("son-actif").checked = !!reglages.sonActif;
  }

  document.getElementById("radio-son").addEventListener("change", function () {
    reglages.modeLettre = "son";
    sauverReglages();
  });
  document.getElementById("radio-nom").addEventListener("change", function () {
    reglages.modeLettre = "nom";
    sauverReglages();
  });

  document.getElementById("radio-lecture-auto").addEventListener("change", function () {
    reglages.lectureAuto = true;
    sauverReglages();
  });
  document.getElementById("radio-lecture-bouton").addEventListener("change", function () {
    reglages.lectureAuto = false;
    sauverReglages();
  });

  function surChangementCategorie() {
    var c = {
      courts: document.getElementById("cat-courts").checked,
      moyens: document.getElementById("cat-moyens").checked,
      longs: document.getElementById("cat-longs").checked,
      famille: document.getElementById("cat-famille").checked
    };
    // Au moins une catégorie doit rester cochée.
    var auMoinsUne = c.courts || c.moyens || c.longs || c.famille;
    if (!auMoinsUne) {
      // On annule en remettant l'état précédent.
      remplirFormulaireReglages();
      return;
    }
    reglages.categories = c;
    sauverReglages();
  }
  ["cat-courts", "cat-moyens", "cat-longs", "cat-famille"].forEach(function (id) {
    document.getElementById(id).addEventListener("change", surChangementCategorie);
  });

  document.getElementById("son-actif").addEventListener("change", function (e) {
    reglages.sonActif = e.target.checked;
    sauverReglages();
  });

  // ==================================================================
  // CLAVIER À L'ÉCRAN (A-Z alphabétique)
  // ==================================================================
  var ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  function construireClavier(conteneur, avecEffacement, surTouche) {
    conteneur.innerHTML = "";
    ALPHABET.forEach(function (l) {
      var touche = document.createElement("button");
      touche.type = "button";
      touche.className = "touche";
      touche.textContent = l;
      touche.dataset.lettre = l;
      touche.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        touche.classList.add("appuyee");
        surTouche(l);
      });
      touche.addEventListener("pointerup", function () {
        touche.classList.remove("appuyee");
      });
      touche.addEventListener("pointerleave", function () {
        touche.classList.remove("appuyee");
      });
      conteneur.appendChild(touche);
    });
    if (avecEffacement) {
      var eff = document.createElement("button");
      eff.type = "button";
      eff.className = "touche touche-efface";
      eff.textContent = "⌫";
      eff.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        surTouche("BACKSPACE");
      });
      conteneur.appendChild(eff);
    }
  }

  var clavierLettresEl = document.getElementById("clavier-lettres");
  var clavierMotsEl = document.getElementById("clavier-mots");

  // ==================================================================
  // ÉCRAN "LETTRES" (frappe libre)
  // ==================================================================
  var lettreGeanteEl = document.getElementById("lettre-geante");
  var bandeLettresEl = document.getElementById("bande-lettres");
  var motTrouveEl = document.getElementById("mot-trouve-lettres");
  var bandeLettres = ""; // chaîne des dernières lettres tapées (max ~12)
  var MAX_BANDE = 12;
  var timerLecture = null; // lecture de la bande après une petite pause
  var DELAI_LECTURE = 900; // ms sans frappe avant de lire (laisse finir le son de la lettre)
  var btnLire = document.getElementById("btn-lire");

  function lireBande() {
    clearTimeout(timerLecture);
    if (!bandeLettres) return;
    btnLire.classList.remove("parle");
    void btnLire.offsetWidth;
    btnLire.classList.add("parle");
    dire(bandeLettres);
  }

  function programmerLecture() {
    clearTimeout(timerLecture);
    if (!reglages.lectureAuto || bandeLettres.length < 2) return;
    timerLecture = setTimeout(lireBande, DELAI_LECTURE);
  }

  btnLire.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    lireBande();
  });
  bandeLettresEl.addEventListener("pointerdown", lireBande);

  var COULEURS = ["#ff6f9c", "#4ea8de", "#67c96e", "#ffca3a", "#9d7bff", "#ff8a3d", "#2ec4b6", "#e8555a"];

  function resetLettresEcran() {
    clearTimeout(timerLecture);
    bandeLettres = "";
    bandeLettresEl.textContent = "";
    lettreGeanteEl.textContent = "";
    motTrouveEl.textContent = "";
    motTrouveEl.classList.remove("affiche");
  }

  function surToucheLettres(l) {
    if (l === "BACKSPACE") {
      bandeLettres = bandeLettres.slice(0, -1);
      bandeLettresEl.textContent = bandeLettres;
      programmerLecture();
      return;
    }
    // Affichage géant avec couleur aléatoire + animation pop.
    lettreGeanteEl.textContent = l;
    lettreGeanteEl.style.color = COULEURS[Math.floor(Math.random() * COULEURS.length)];
    lettreGeanteEl.classList.remove("pop");
    // force reflow pour rejouer l'animation
    void lettreGeanteEl.offsetWidth;
    lettreGeanteEl.classList.add("pop");

    jouerLettre(l);

    bandeLettres += l;
    if (bandeLettres.length > MAX_BANDE) {
      bandeLettres = bandeLettres.slice(bandeLettres.length - MAX_BANDE);
    }
    bandeLettresEl.textContent = bandeLettres;

    // Un mot connu est lu avec le vrai enregistrement ; sinon on lit la
    // bande avec la voix de l'appareil après une petite pause.
    if (!verifierMotDansBande()) programmerLecture();
  }

  function verifierMotDansBande() {
    var venteBande = bandeLettres; // déjà en majuscules
    for (var i = 0; i < MOTS.length; i++) {
      var entree = MOTS[i];
      var idMot = normaliserId(entree.mot);
      if (idMot.length < 3) continue;
      var motPlat = lettrePlate(entree.mot); // majuscules sans accent, même longueur que mot
      if (motPlat.length > venteBande.length) continue;
      if (venteBande.slice(venteBande.length - motPlat.length) === motPlat) {
        afficherMotTrouve(entree);
        return true;
      }
    }
    return false;
  }

  function afficherMotTrouve(entree) {
    clearTimeout(timerLecture);
    motTrouveEl.innerHTML =
      '<span class="emoji">' + entree.emoji + "</span><span>" + entree.mot + "</span>";
    motTrouveEl.classList.remove("affiche");
    void motTrouveEl.offsetWidth;
    motTrouveEl.classList.add("affiche");
    lancerConfettis();
    jouerMot(normaliserId(entree.mot));
    setTimeout(function () {
      bandeLettres = "";
      bandeLettresEl.textContent = "";
    }, 600);
  }

  construireClavier(clavierLettresEl, true, surToucheLettres);

  // ==================================================================
  // ÉCRAN "MOTS" (copier un mot)
  // ==================================================================
  var motEmojiEl = document.getElementById("mot-emoji");
  var motBoitesEl = document.getElementById("mot-boites");
  var btnMotSuivant = document.getElementById("btn-mot-suivant");

  var motActuel = null; // entrée MOTS courante
  var positionActuelle = 0; // index de la prochaine lettre attendue
  var derniersMots = []; // évite de répéter les 5 derniers
  var timerMotSuivant = null; // délai avant le mot suivant après un bravo

  function motCorrespondCategorie(entree) {
    if (entree.famille) return !!reglages.categories.famille;
    var n = entree.mot.length;
    if (n <= 4) return !!reglages.categories.courts;
    if (n <= 6) return !!reglages.categories.moyens;
    return !!reglages.categories.longs;
  }

  function choisirMotAleatoire() {
    var candidats = MOTS.filter(function (m) {
      return motCorrespondCategorie(m) && !derniersMots.includes(m.mot);
    });
    if (candidats.length === 0) {
      // Si tout est exclu (peu de mots dispo), on relâche la contrainte "pas de répétition".
      candidats = MOTS.filter(motCorrespondCategorie);
    }
    if (candidats.length === 0) {
      // Aucune catégorie valide (ne devrait pas arriver, au moins une catégorie reste cochée)
      candidats = MOTS.slice();
    }
    return candidats[Math.floor(Math.random() * candidats.length)];
  }

  function demarrerNouveauMot() {
    clearTimeout(timerMotSuivant);
    timerMotSuivant = null;
    motActuel = choisirMotAleatoire();
    if (!motActuel) return;
    derniersMots.push(motActuel.mot);
    if (derniersMots.length > 5) derniersMots.shift();
    positionActuelle = 0;
    motEmojiEl.textContent = motActuel.emoji;
    construireBoitesMot();
    mettreAJourGlowClavier();
  }

  function construireBoitesMot() {
    motBoitesEl.innerHTML = "";
    var lettres = Array.from(motActuel.mot); // gère les caractères accentués correctement
    lettres.forEach(function (l, i) {
      var boite = document.createElement("div");
      boite.className = "boite-lettre";
      boite.dataset.index = String(i);
      motBoitesEl.appendChild(boite);
    });
    marquerBoiteActive();
  }

  function marquerBoiteActive() {
    var boites = motBoitesEl.querySelectorAll(".boite-lettre");
    boites.forEach(function (b, i) {
      b.classList.toggle("active", i === positionActuelle);
    });
  }

  function mettreAJourGlowClavier() {
    var touches = clavierMotsEl.querySelectorAll(".touche");
    touches.forEach(function (t) { t.classList.remove("glow"); });
    if (!motActuel || positionActuelle >= motActuel.mot.length) return;
    var attendue = lettrePlate(Array.from(motActuel.mot)[positionActuelle]);
    var touche = clavierMotsEl.querySelector('.touche[data-lettre="' + attendue + '"]');
    if (touche) touche.classList.add("glow");
  }

  function surToucheMots(l) {
    if (!motActuel || l === "BACKSPACE") return;
    var lettresMot = Array.from(motActuel.mot);
    if (positionActuelle >= lettresMot.length) return; // mot fini, on attend le suivant
    var attendue = lettrePlate(lettresMot[positionActuelle]);
    var boites = motBoitesEl.querySelectorAll(".boite-lettre");
    if (l === attendue) {
      jouerDing();
      var boite = boites[positionActuelle];
      boite.textContent = lettresMot[positionActuelle];
      boite.classList.remove("active");
      boite.classList.add("remplie");
      positionActuelle++;
      if (positionActuelle >= lettresMot.length) {
        // Mot complet !
        mettreAJourGlowClavier();
        var idMot = normaliserId(motActuel.mot);
        jouerSequenceMotBravo(idMot).then(function () {});
        lancerConfettis();
        timerMotSuivant = setTimeout(demarrerNouveauMot, 2500);
      } else {
        marquerBoiteActive();
        mettreAJourGlowClavier();
      }
    } else {
      jouerBonk();
      var cible = boites[positionActuelle];
      cible.classList.remove("secoue");
      void cible.offsetWidth;
      cible.classList.add("secoue");
    }
  }

  construireClavier(clavierMotsEl, false, surToucheMots);

  motEmojiEl.addEventListener("click", function () {
    if (motActuel) jouerMot(normaliserId(motActuel.mot));
  });

  btnMotSuivant.addEventListener("click", function () {
    demarrerNouveauMot();
  });

  // ==================================================================
  // CLAVIER PHYSIQUE (bureau)
  // ==================================================================
  window.addEventListener("keydown", function (e) {
    // Ignore les raccourcis avec modificateurs.
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    var ecranLettresVisible = !ecrans.lettres.classList.contains("ecran-actif-masque");
    var ecranMotsVisible = !ecrans.mots.classList.contains("ecran-actif-masque");
    var reglagesOuverts = !overlayReglages.classList.contains("ecran-actif-masque");
    if (reglagesOuverts) return;

    if (e.key === "Backspace" && ecranLettresVisible) {
      e.preventDefault();
      surToucheLettres("BACKSPACE");
      return;
    }

    if (/^[a-zA-Z]$/.test(e.key)) {
      var L = e.key.toUpperCase();
      if (ecranLettresVisible) {
        e.preventDefault();
        surToucheLettres(L);
      } else if (ecranMotsVisible) {
        e.preventDefault();
        surToucheMots(L);
      }
    }
  });

  // ==================================================================
  // CONFETTIS (léger, DOM + CSS)
  // ==================================================================
  var confettisEl = document.getElementById("confettis");
  function lancerConfettis() {
    var n = 24;
    for (var i = 0; i < n; i++) {
      var piece = document.createElement("div");
      piece.className = "confetti";
      piece.style.left = Math.random() * 100 + "vw";
      piece.style.background = COULEURS[Math.floor(Math.random() * COULEURS.length)];
      var duree = 1.2 + Math.random() * 1.1;
      piece.style.animationDuration = duree + "s";
      piece.style.width = piece.style.height = 8 + Math.random() * 8 + "px";
      confettisEl.appendChild(piece);
      (function (el, d) {
        setTimeout(function () { el.remove(); }, d * 1000 + 100);
      })(piece, duree);
    }
  }

  // ==================================================================
  // SERVICE WORKER (uniquement en http/https, pas en fichier local)
  // ==================================================================
  if ("serviceWorker" in navigator && (location.protocol === "http:" || location.protocol === "https:")) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("./sw.js").catch(function () {});
    });
  }

  // ==================================================================
  // Initialisation
  // ==================================================================
  afficherEcran("accueil");
})();

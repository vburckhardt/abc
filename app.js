// ===================== ABC — app.js =====================
// Application unique, sans framework, sans build. Toutes les routes sont
// gérées en montrant/masquant des <section>. Tout est en français.

(function () {
  "use strict";

  // Retire les accents d'une seule lettre pour la comparaison clavier.
  function lettrePlate(l) {
    return l.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  }

  var MOTS = window.MOTS || [];
  // Syllabes valides (« ma », « cha », « bra »…), voir syllabes.js.
  var SYLLABES = new Set(window.SYLLABES || []);

  // ----------------------------------------------------------------
  // Réglages (localStorage, avec valeurs par défaut si indisponible)
  // ----------------------------------------------------------------
  var REGLAGES_DEFAUT = {
    categories: { courts: true, moyens: false, longs: false, famille: true },
    sonActif: true,
    voix: "" // voiceURI choisie dans les réglages ; "" = automatique
  };

  var reglages = chargerReglages();

  function chargerReglages() {
    try {
      var brut = localStorage.getItem("abc-reglages");
      if (!brut) return clone(REGLAGES_DEFAUT);
      var parse = JSON.parse(brut);
      return {
        categories: Object.assign(clone(REGLAGES_DEFAUT.categories), parse.categories || {}),
        sonActif: parse.sonActif !== false,
        voix: typeof parse.voix === "string" ? parse.voix : ""
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
  // SONS
  // Noms des lettres, syllabes, mots et « Bravo ! » sont des sons enregistrés
  // (audio/…, voir sons.js et tools/voix_mac.sh), joués avec Web Audio. Un
  // son qui manque est dit par la voix de l'appareil (speechSynthesis). Le
  // « bonk » d'erreur est synthétisé.
  // ==================================================================
  var ctx = null;

  function obtenirContexte() {
    if (!ctx) {
      var Ctor = window.AudioContext || window.webkitAudioContext;
      if (Ctor) ctx = new Ctor();
    }
    return ctx;
  }

  function debloquerAudio() {
    var c = obtenirContexte();
    // « suspended » au départ, « interrupted » après un appel sur iPhone.
    if (c && c.state !== "running") {
      c.resume().catch(function () {});
    }
    // Permet au son de jouer même avec l'interrupteur silencieux sur iPhone.
    try {
      if (navigator.audioSession) {
        navigator.audioSession.type = "playback";
      }
    } catch (e) {}
  }

  var SONS = window.SONS;
  var tampons = new Map(); // fichier -> promesse d'AudioBuffer (null : absent)
  var MAX_TAMPONS = 120; // au-delà, les moins récents sont oubliés
  var sourceEnCours = null;
  var numeroSon = 0; // chaque nouveau son remplace le précédent

  function chargerSon(son) {
    var p = tampons.get(son.fichier);
    if (p) {
      // remis en dernier : les sons fréquents (lettres) restent en mémoire
      tampons.delete(son.fichier);
      tampons.set(son.fichier, p);
      return p;
    }
    var c = obtenirContexte();
    p = !c || !window.fetch ? Promise.resolve(null) : fetch(son.fichier).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.arrayBuffer();
    }).then(function (donnees) {
      // Forme à rappels (anciens Safari) ; la promesse rendue par les
      // navigateurs récents est ignorée.
      return new Promise(function (ok, erreur) {
        var p = c.decodeAudioData(donnees, ok, erreur);
        if (p && p.catch) p.catch(function () {});
      });
    }).catch(function () {
      return null;
    });
    tampons.set(son.fichier, p);
    if (tampons.size > MAX_TAMPONS) tampons.delete(tampons.keys().next().value);
    return p;
  }

  // Joue un son (coupe ce qui était en train d'être dit) ; la promesse est
  // résolue à la fin du son.
  function jouerSon(son) {
    if (!reglages.sonActif || !son.texte) return Promise.resolve();
    var numero = ++numeroSon;
    arreterSource();
    return chargerSon(son).then(function (tampon) {
      if (numero !== numeroSon) return; // remplacé entre-temps
      if (!tampon) return dire(son.texte);
      if (synthese && (synthese.speaking || synthese.pending)) synthese.cancel();
      return new Promise(function (resolve) {
        var src = ctx.createBufferSource();
        src.buffer = tampon;
        src.connect(ctx.destination);
        src.onended = resolve;
        sourceEnCours = src;
        src.start();
        // filet de sécurité si onended ne vient pas (son pas encore débloqué)
        setTimeout(resolve, tampon.duration * 1000 + 500);
      });
    });
  }

  function arreterSource() {
    if (!sourceEnCours) return;
    try { sourceEnCours.stop(); } catch (e) {}
    sourceEnCours = null;
  }

  // Coupe tout (changement d'écran, app en arrière-plan).
  function arreterParole() {
    numeroSon++;
    arreterSource();
    if (synthese) synthese.cancel();
  }

  function jouerLettre(lettre) {
    jouerSon(SONS.lettre(lettre));
  }

  function jouerMot(entree) {
    return jouerSon(SONS.mot(entree));
  }

  function jouerSequenceMotBravo(entree) {
    var lecture = jouerMot(entree);
    var numero = numeroSon;
    return lecture.then(function () {
      if (numero === numeroSon) return jouerSon(SONS.bravo);
    });
  }

  // Petit son d'erreur synthétisé (oscillateur), pas de fichier.
  function jouerBonk() {
    if (!reglages.sonActif) return;
    var c = obtenirContexte();
    if (!c) return;
    try {
      var osc = c.createOscillator();
      var gain = c.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(180, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(90, c.currentTime + 0.22);
      gain.gain.setValueAtTime(0.0001, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.35, c.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + 0.27);
    } catch (e) {}
  }

  // ------------------------------------------------------------------
  // Voix de l'appareil (speechSynthesis)
  // L'iPhone propose aussi des voix « fantaisie » très robotiques (Eddy,
  // Grandma, Rocko…, moteur « Eloquence ») : elles sont écartées. Parmi les
  // autres, on préfère une voix premium ou améliorée (téléchargée dans les
  // réglages de l'iPhone), puis fr-FR, puis installée localement (hors
  // ligne). Le parent peut aussi choisir la voix dans les réglages.
  // ------------------------------------------------------------------
  var synthese = window.speechSynthesis || null;
  var voixFr = null;

  var NOMS_FANTAISIE = /^(eddy|flo|grandma|grandpa|grand-m[eè]re|grand-p[eè]re|reed|rocko|sandy|shelley)\b/i;

  function estFantaisie(v) {
    return /eloquence/i.test(v.voiceURI) || NOMS_FANTAISIE.test(v.name);
  }

  // 2 = premium, 1 = améliorée / naturelle, 0 = standard.
  function qualiteVoix(v) {
    var id = v.voiceURI + " " + v.name;
    if (/premium/i.test(id)) return 2;
    if (/enhanced|am[ée]lior[ée]e|natural|neural/i.test(id)) return 1;
    return 0;
  }

  function noteVoix(v) {
    return qualiteVoix(v) * 4 + (/fr[-_]FR/i.test(v.lang) ? 2 : 0) + (v.localService ? 1 : 0);
  }

  // Voix françaises utilisables, la meilleure d'abord.
  function voixFrancaises() {
    if (!synthese) return [];
    return synthese.getVoices().filter(function (v) {
      return /^fr/i.test(v.lang) && !estFantaisie(v);
    }).sort(function (a, b) {
      return noteVoix(b) - noteVoix(a);
    });
  }

  function choisirVoixFr() {
    var voix = voixFrancaises();
    var choisie = voix.filter(function (v) { return v.voiceURI === reglages.voix; })[0];
    voixFr = choisie || voix[0] || null;
  }
  if (synthese) {
    choisirVoixFr();
    if ("onvoiceschanged" in synthese) synthese.onvoiceschanged = choisirVoixFr;
  }

  var repliqueEnCours = null; // garde une référence (sinon le navigateur peut l'oublier)

  // Dit un texte avec la voix de l'appareil (quand le son enregistré manque) ;
  // la promesse est résolue quand la voix a fini.
  // Sur iPhone, cancel() suivi tout de suite de speak() peut ne rien dire :
  // on n'interrompt que si la voix parle, et on reparle un instant après.
  function dire(texte) {
    if (!synthese || !reglages.sonActif || !texte) return Promise.resolve();
    if (!voixDebloquee) {
      // Pas encore de vrai geste : sera dit au moment où le doigt se lève.
      texteEnAttente = texte;
      return Promise.resolve();
    }
    // Sur iPhone, la liste des voix peut être vide au chargement.
    if (!voixFr) choisirVoixFr();
    // En minuscules, sinon « CHAT » peut être épelé comme un sigle.
    var u = new SpeechSynthesisUtterance(texte.toLowerCase());
    u.lang = "fr-FR";
    if (voixFr) u.voice = voixFr;
    u.rate = 0.9;
    repliqueEnCours = u;
    return new Promise(function (resolve) {
      u.onend = resolve;
      u.onerror = resolve;
      // filet de sécurité si onend ne se déclenche pas
      setTimeout(resolve, 900 + 150 * texte.length);
      if (synthese.speaking || synthese.pending) {
        synthese.cancel();
        setTimeout(function () {
          if (repliqueEnCours === u) synthese.speak(u);
          else resolve(); // remplacée entre-temps par une autre réplique
        }, 80);
      } else {
        synthese.speak(u);
      }
    });
  }

  // ------------------------------------------------------------------
  // Déblocage du son sur iPhone
  // Safari ne laisse la page parler qu'après un « vrai » geste : doigt qui se
  // lève (touchend / click) ou touche du clavier ; un doigt qui se pose
  // (pointerdown) ne compte pas. Au premier vrai geste :
  // - on parle tout de suite (ce qui attendait, sinon une réplique vide) :
  //   ensuite la voix est libre de parler à tout moment ;
  // - on joue un son muet via <audio> : l'iPhone passe en « lecture de
  //   média », l'interrupteur silencieux ne coupe plus le son.
  // Le contexte Web Audio (le « bonk ») est relancé à chaque geste : iOS le
  // suspend quand l'app passe en arrière-plan.
  // ------------------------------------------------------------------
  var voixDebloquee = false;
  var texteEnAttente = null;
  var SON_MUET = "data:audio/wav;base64,UklGRiwAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQgAAAAAAAAAAAAAAA==";

  function debloquerVoix() {
    if (voixDebloquee) return;
    voixDebloquee = true;
    try {
      var a = new Audio(SON_MUET);
      a.setAttribute("playsinline", "");
      a.play().catch(function () {});
    } catch (e) {}
    if (!synthese) return;
    var texte = texteEnAttente;
    texteEnAttente = null;
    if (texte) {
      dire(texte);
    } else {
      var u = new SpeechSynthesisUtterance("");
      u.volume = 0;
      synthese.speak(u);
    }
  }

  function surGeste() {
    debloquerAudio();
    debloquerVoix();
  }
  window.addEventListener("pointerdown", debloquerAudio, { passive: true });
  ["touchend", "click", "keydown"].forEach(function (type) {
    window.addEventListener(type, surGeste, true);
  });

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
      annulerTimersMots();
      arreterParole();
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
    afficherEtatVoix();
    overlayReglages.classList.remove("ecran-actif-masque");
  }
  function fermerReglages() {
    overlayReglages.classList.add("ecran-actif-masque");
  }
  document.getElementById("btn-fermer-reglages").addEventListener("click", fermerReglages);

  function remplirFormulaireReglages() {
    document.getElementById("cat-courts").checked = !!reglages.categories.courts;
    document.getElementById("cat-moyens").checked = !!reglages.categories.moyens;
    document.getElementById("cat-longs").checked = !!reglages.categories.longs;
    document.getElementById("cat-famille").checked = !!reglages.categories.famille;
    document.getElementById("son-actif").checked = !!reglages.sonActif;
  }

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

  // Choix de la voix : « Automatique » (la meilleure trouvée) ou une voix
  // française précise.
  var choixVoixEl = document.getElementById("choix-voix");

  function nomVoix(v) {
    var q = /premium|enhanced|am[ée]lior/i.test(v.name) ? "" : ["", " · améliorée", " · premium"][qualiteVoix(v)];
    var pays = /fr[-_]FR/i.test(v.lang) ? "" : " (" + v.lang + ")";
    return v.name + pays + q;
  }

  function remplirChoixVoix() {
    choisirVoixFr();
    var voix = voixFrancaises();
    choixVoixEl.innerHTML = "";
    choixVoixEl.add(new Option("Automatique" + (voix[0] ? " (" + nomVoix(voix[0]) + ")" : ""), ""));
    voix.forEach(function (v) {
      choixVoixEl.add(new Option(nomVoix(v), v.voiceURI));
    });
    choixVoixEl.value = voixFr && voixFr.voiceURI === reglages.voix ? reglages.voix : "";
  }

  choixVoixEl.addEventListener("change", function () {
    reglages.voix = choixVoixEl.value;
    sauverReglages();
    choisirVoixFr();
    dire("Bonjour ! a, bé, cé.");
  });

  // État de la voix (pour le parent : savoir pourquoi il n'y aurait pas de
  // son). Le choix de la voix de l'appareil n'est montré que si les sons
  // enregistrés manquent.
  function afficherEtatVoix() {
    var el = document.getElementById("etat-voix");
    chargerSon(SONS.lettre("a")).then(function (enregistres) {
      document.getElementById("voix-appareil").hidden = !!enregistres;
      if (!enregistres) remplirChoixVoix();
      var etat;
      if (enregistres) etat = "Sons enregistrés";
      else if (synthese) etat = "Voix de l'appareil · " + voixFrancaises().length + " voix française(s)";
      else etat = "Voix de l'appareil : indisponible dans ce navigateur";
      el.textContent = etat + " · " + (voixDebloquee ? "activée" : "pas encore activée") +
        (reglages.sonActif ? "" : " · son coupé dans les réglages");
    });
  }

  document.getElementById("btn-tester-voix").addEventListener("click", function () {
    chargerSon(SONS.bravo).then(function (enregistre) {
      if (enregistre) jouerSon(SONS.bravo);
      else dire("Bonjour ! a, bé, cé.");
    });
    setTimeout(afficherEtatVoix, 300);
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

  // On ne lit que du vrai : la syllabe valide qui termine ce qui est tapé
  // (3 lettres d'abord, puis 2 : « XQCHA » -> « cha », « BLMA » -> « ma »).
  // Les suites sans syllabe ne sont pas lues ; chaque lettre a déjà dit
  // son nom. Les mots de la liste sont gérés à part (image + mot).
  function syllabeFinale() {
    for (var n = 3; n >= 2; n--) {
      if (bandeLettres.length < n) continue;
      var s = bandeLettres.slice(-n).toLowerCase();
      if (SYLLABES.has(s)) return s;
    }
    return null;
  }

  function lireBande() {
    clearTimeout(timerLecture);
    var syllabe = syllabeFinale();
    if (!syllabe) return;
    // La bande sautille pendant la lecture.
    bandeLettresEl.classList.remove("parle");
    void bandeLettresEl.offsetWidth;
    bandeLettresEl.classList.add("parle");
    jouerSon(SONS.syllabe(syllabe));
  }

  function programmerLecture() {
    clearTimeout(timerLecture);
    var syllabe = syllabeFinale();
    if (!syllabe) return;
    chargerSon(SONS.syllabe(syllabe)); // prêt pour la fin de la pause
    timerLecture = setTimeout(lireBande, DELAI_LECTURE);
  }

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

    // Un mot de la liste s'affiche avec son image ; sinon on lit la syllabe
    // finale éventuelle après une petite pause.
    if (!verifierMotDansBande()) programmerLecture();
  }

  function verifierMotDansBande() {
    var venteBande = bandeLettres; // déjà en majuscules
    for (var i = 0; i < MOTS.length; i++) {
      var entree = MOTS[i];
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
    jouerMot(entree);
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
  var timerLectureMot = null; // lecture « mot + Bravo » après la dernière lettre

  function annulerTimersMots() {
    clearTimeout(timerMotSuivant);
    clearTimeout(timerLectureMot);
    timerMotSuivant = timerLectureMot = null;
  }

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
    annulerTimersMots();
    arreterParole();
    motActuel = choisirMotAleatoire();
    if (!motActuel) return;
    chargerSon(SONS.mot(motActuel));
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
      jouerLettre(lettresMot[positionActuelle]); // dit le nom de la lettre
      var boite = boites[positionActuelle];
      boite.textContent = lettresMot[positionActuelle];
      boite.classList.remove("active");
      boite.classList.add("remplie");
      positionActuelle++;
      if (positionActuelle >= lettresMot.length) {
        // Mot complet !
        mettreAJourGlowClavier();
        // Laisse finir le nom de la dernière lettre avant de lire le mot.
        var motFini = motActuel;
        timerLectureMot = setTimeout(function () { jouerSequenceMotBravo(motFini); }, 700);
        lancerConfettis();
        timerMotSuivant = setTimeout(demarrerNouveauMot, 3200);
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
    if (motActuel) jouerMot(motActuel);
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
  // En ligne, une nouvelle version est cherchée à chaque ouverture ; quand
  // elle est installée, la page se recharge une fois toute seule.
  if ("serviceWorker" in navigator && (location.protocol === "http:" || location.protocol === "https:")) {
    var avaitUnControleur = !!navigator.serviceWorker.controller;
    var rechargee = false;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      // Première installation : rien à recharger.
      if (!avaitUnControleur || rechargee) return;
      rechargee = true;
      location.reload();
    });
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("./sw.js").then(function (reg) {
        reg.update().catch(function () {});
      }).catch(function () {});
    });
  }

  // ==================================================================
  // NUMÉRO DE VERSION (accueil) + comparaison avec le serveur
  // ==================================================================
  var versionLocale = window.APP_VERSION || "?";
  var versionEl = document.getElementById("version-app");

  function afficherVersion(versionServeur) {
    var texte = "version " + versionLocale;
    if (versionServeur && versionServeur !== versionLocale) {
      texte += " · nouvelle version " + versionServeur + " en cours…";
      versionEl.classList.add("a-jour-non");
    } else if (versionServeur) {
      texte += " ✓";
      versionEl.classList.remove("a-jour-non");
    }
    versionEl.textContent = texte;
  }

  function verifierVersionServeur() {
    afficherVersion(null);
    if (!navigator.onLine || !window.fetch) return;
    fetch("./version.js?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.text() : ""; })
      .then(function (txt) {
        var m = /APP_VERSION\s*=\s*"([^"]+)"/.exec(txt);
        afficherVersion(m ? m[1] : null);
      })
      .catch(function () {});
  }
  verifierVersionServeur();

  // ==================================================================
  // Passage en arrière-plan : on coupe la voix (sur iOS, une lecture
  // interrompue par l'arrière-plan peut bloquer la synthèse vocale).
  // ==================================================================
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") arreterParole();
  });

  // ==================================================================
  // Initialisation
  // ==================================================================
  afficherEcran("accueil");
  // Lettres et « Bravo » prêts tout de suite ; syllabes et mots à la demande.
  SONS.lettres.forEach(function (l) { chargerSon(SONS.lettre(l)); });
  chargerSon(SONS.bravo);
})();

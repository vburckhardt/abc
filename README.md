# ABC

Petite application web hors ligne pour apprendre les lettres et les mots,
pensée pour un enfant de 5 ans. Pas de dépendance, pas de build, pas de
ressource externe : du HTML/CSS/JS simple. Faite pour l'iPhone (écran
d'accueil), utilisable aussi sur ordinateur avec un vrai clavier.

- **Lettres** : clavier A–Z ; chaque lettre s'affiche en grand et dit son
  nom. Ce qui est tapé est lu par la voix de l'appareil (après une petite
  pause, ou avec 🔊). Un mot de la liste tapé en entier est reconnu.
- **Mots** : une image et un mot à recopier ; la touche suivante brille,
  chaque bonne lettre dit son nom, le mot est lu à la fin.
- **Réglages** : appui long de 2 s sur ⚙️ (en bas de l'accueil).

Tous les chemins sont relatifs (`./…`), l'app fonctionne donc sous un
sous-dossier. Le service worker (`sw.js`) met tout en cache pour le hors
ligne : **augmentez `APP_VERSION` dans `version.js` à chaque mise à jour** (numéro affiché en bas de l'accueil), sinon les
appareils gardent l'ancienne version.

## Ajouter des mots

1. Éditez `words.js`, par exemple `{ mot: "ÉCOLE", emoji: "🏫" }`
   (`famille: true` pour la catégorie « Famille »).
2. Générez les sons de secours (une fois : `pip install piper-tts imageio-ffmpeg numpy`) :
   ```
   python3 tools/generate_audio.py
   ```
   La voix française Piper « siwis » (CC-BY 4.0) est téléchargée la première
   fois. Seuls les sons manquants sont créés ; `audio/manifest.json` est mis
   à jour.
3. Augmentez `APP_VERSION` dans `version.js`.

## Voix

- **Mots et texte tapé** : voix française de l'appareil (hors ligne sur
  iOS). La voix Piper ne sait pas faire les voyelles nasales (« main »
  devient « mai »). Les mots listés dans `MOTS_ENREGISTRES` (`app.js`),
  par exemple des noms propres mal lus par l'appareil, gardent leur fichier
  `audio/mots/<id>.mp3`. Ces fichiers servent aussi de secours.
- **Noms des lettres** : `audio/noms/<lettre>.mp3` (Piper).
- **Sons des lettres** (« sss », « mmm », « beu ») : les sons générés
  (`audio/sons/`) ne sont pas assez bons, ils sont désactivés
  (`SONS_LETTRES_DISPONIBLES = false` dans `app.js`).

## Enregistrer ses propres sons de lettres

Réglages → **🎙️ Enregistrer les sons** (`enregistrer.html`). Touchez une
lettre, enregistrez son son avec le micro, réécoutez. Les enregistrements
restent **sur l'appareil** (IndexedDB) : il faut donc enregistrer depuis
l'app installée elle-même. Dès qu'un son est enregistré, le réglage
« Les lettres disent : leur son » apparaît ; les lettres sans
enregistrement disent leur nom.

## Outils

- `tools/generate_audio.py` : génère les fichiers audio (Piper, hors ligne).
- `tools/variantes.py` + `ecoute.html` : plusieurs versions générées de
  chaque son de lettre, à comparer à l'oreille.

## Fichiers

- `index.html`, `style.css`, `app.js` : l'application
- `words.js` : la liste des mots
- `enregistrer.html`, `enregistrements.js` : enregistrement des sons
- `sw.js`, `manifest.webmanifest`, `icon-*.png` : hors ligne et icône
- `audio/` : sons générés (`noms/`, `sons/`, `mots/`, `bravo.mp3`, `essai/`)

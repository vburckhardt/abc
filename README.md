# ABC de Léo

Petite application web hors-ligne pour apprendre les lettres et les mots,
pensée pour un enfant de 5 ans. Aucune dépendance, aucun build, aucune
ressource externe : uniquement du HTML/CSS/JS "vanilla".

## Mettre en ligne (GitHub Pages)

1. Poussez ce dépôt sur GitHub.
2. Dans **Settings → Pages**, choisissez **Deploy from a branch**, branche
   `main` (après fusion de cette branche), dossier **/ (root)**.
3. L'application sera disponible à une adresse du type
   `https://votre-utilisateur.github.io/abc/`.
   Tous les chemins du code sont **relatifs** (`./...`), donc ça fonctionne
   même sous ce sous-répertoire.

## Installer sur iPhone (écran d'accueil)

1. Ouvrez le lien ci-dessus dans **Safari** sur l'iPhone.
2. Appuyez sur le bouton **Partager** (le carré avec la flèche vers le haut).
3. Choisissez **« Sur l'écran d'accueil »**.
4. L'icône « ABC » apparaît sur l'écran d'accueil et s'ouvre en plein écran,
   comme une vraie application, même sans connexion internet une fois
   qu'elle a été ouverte une première fois (grâce au service worker).

## Ajouter des mots

1. Éditez `words.js`, par exemple : `{ mot: "ÉCOLE", emoji: "🏫" }`
   (ajoutez `famille: true` pour la catégorie « Famille »).
2. Générez les sons (une seule fois : `pip install piper-tts imageio-ffmpeg numpy`) :
   ```
   python3 tools/generate_audio.py
   ```
   La voix française (Piper « siwis », CC-BY 4.0) est téléchargée
   automatiquement la première fois. Le script ne crée que les sons
   manquants et met à jour `audio/manifest.json`.
   Si un mot est mal prononcé, ajoutez sa prononciation dans
   `PRONONCIATION` en haut du script.
3. **Changez `VERSION` dans `sw.js`** (ex. `"v2"`), sinon l'iPhone garde
   l'ancienne version en cache. Commitez, poussez, puis ouvrez l'app deux
   fois sur l'iPhone.

## Les sons des lettres (méthode syllabique)

Par défaut les lettres disent leur **son** (« sss », « mmm », « beu »).
Les réglages (appui long 2 s sur ⚙️ en bas de l'accueil) permettent de
passer au **nom** (« esse »). Le H ne fait pas de bruit : il dit son nom.
Le W dit aussi son nom.

Comment c'est fabriqué : les voyelles et « beu/deu/keu… » sont lues par la
voix. Les consonnes continues (f, j, l, m, n, r, s, v, z) sont extraites
d'un « a-sss-a » puis allongées, parce que la voix ne sait pas bien dire
un son isolé.

## Fichiers

- `index.html`, `style.css`, `app.js` — l'application
- `words.js` — la liste des mots
- `sw.js`, `manifest.webmanifest`, `icon-*.png` — hors-ligne et icône iPhone
- `audio/` — sons générés (`sons/`, `noms/`, `mots/`, `bravo.mp3`)
- `tools/generate_audio.py` — générateur des sons

---

## English (short version)

Offline vanilla-JS PWA (no framework/build/CDN) teaching a 5-year-old French
child letters and short words, primarily on iPhone (Safari "Add to Home
Screen") and also usable on desktop with a keyboard.

- Enable **GitHub Pages** from the branch root (Settings → Pages).
- Open the resulting `https://user.github.io/abc/` URL in iPhone Safari,
  then Share → "Sur l'écran d'accueil" to install it.
- To add words: edit `words.js`, then run `python3 tools/generate_audio.py`
  to generate the matching MP3s and refresh `audio/manifest.json`.
- All paths are relative so the app works under any GitHub Pages sub-path.
- Bump `VERSION` in `sw.js` on every update so installed copies refresh.
- Letter sounds are generated offline with the Piper French voice; continuous
  consonants are cut from "a-C-a" carriers and time-stretched.

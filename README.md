# ABC

Petite application web hors ligne pour apprendre les lettres et les mots,
pensée pour les 4-5 ans. Pas de dépendance, pas de build, pas de ressource
externe : du HTML/CSS/JS simple. Faite pour l'iPhone (écran d'accueil),
utilisable aussi sur ordinateur avec un vrai clavier.

- **Lettres** : clavier A–Z ; chaque lettre s'affiche en grand et dit son
  nom. Si ce qui est tapé se termine par une syllabe valide (« MA »,
  « CHA », « BRA »…), elle est lue après une petite pause ; sinon rien
  n'est lu. Un mot de la liste tapé en entier s'affiche avec son image.
- **Mots** : une image et un mot à recopier ; la touche suivante brille,
  chaque bonne lettre dit son nom, le mot est lu à la fin, puis « Bravo ! ».
- **Réglages** : appui long de 2 s sur ⚙️ (en bas de l'accueil) :
  catégories de mots, son, choix de la voix.

## Voix

Tout ce que dit l'app (noms des lettres, syllabes, mots, « Bravo ! ») est
enregistré à l'avance avec une voix naturelle (Audrey Premium du Mac) dans
`audio/`, et joué hors ligne. Sur iPhone, une page web ne peut utiliser que
les voix de base (Thomas, Amélie), pas les voix premium téléchargées. Un son
qui manque est dit par la voix de l'appareil (choix dans les Réglages).

`sons.js` donne pour chaque son le texte dit et le fichier : noms des
lettres en toutes lettres (« bé », « ji », « esse »…), mot en minuscules ou
orthographe pour la voix (`dire` dans `words.js`).

Enregistrer les sons, sur un Mac :

1. Réglages Système › Accessibilité › Contenu énoncé › Voix du système ›
   Gérer les voix… › Français : télécharger Audrey (Premium).
2. `node tools/liste_sons.js` si `words.js` ou `syllabes.js` a changé
   (écrit `audio/liste.tsv`).
3. `bash tools/voix_mac.sh` : enregistre les sons manquants (`audio/…`).
   Autre voix : `bash tools/voix_mac.sh "Thomas (Premium)"`.

## Mettre à jour

À chaque changement, **augmentez `APP_VERSION` dans `version.js`**. Le
numéro est affiché en bas de l'accueil (✓ = identique au serveur). En
ligne, l'app charge toujours la dernière version ; hors ligne, elle utilise
la copie en cache (`sw.js`). Tous les chemins sont relatifs (`./…`).

## Ajouter des mots

Dans `words.js` : `{ mot: "ÉCOLE", emoji: "🏫" }` (`famille: true` pour la
catégorie « Famille »). Chaque mot doit avoir une image claire pour un
enfant qui ne lit pas encore.

Puis enregistrer son son : `node tools/liste_sons.js`, puis
`bash tools/voix_mac.sh` sur le Mac (voir « Voix »).

## Syllabes

`syllabes.js` liste les 594 syllabes valides (A–Z, 2-3 lettres), d'après
le syllabaire [Syllabux](https://forge.apps.education.fr/educajou/syllabux)
(Arnaud Champollion, Éducajou). Régénérer : `python3 tools/import_syllabes.py
<dossier syllabux>`.

## Fichiers

- `index.html`, `style.css`, `app.js` : l'application
- `words.js` : les mots ; `syllabes.js` : les syllabes
- `sons.js`, `audio/` : les sons enregistrés (`audio/liste.tsv` : la liste)
- `tools/` : `liste_sons.js`, `voix_mac.sh` (sons), `import_syllabes.py`
- `version.js`, `sw.js`, `manifest.webmanifest`, `icon-*.png` : version,
  hors ligne, icône

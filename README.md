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
  catégories de mots, son.

## Voix

Tout est dit par la voix française de l'appareil (`speechSynthesis`, hors
ligne sur iOS). Les noms des lettres sont écrits en toutes lettres pour la
voix (`NOMS_LETTRES` dans `app.js` : « bé », « ji », « esse »…). Un mot mal
prononcé peut recevoir une orthographe pour la voix (`dire` dans
`words.js`).

## Mettre à jour

À chaque changement, **augmentez `APP_VERSION` dans `version.js`**. Le
numéro est affiché en bas de l'accueil (✓ = identique au serveur). En
ligne, l'app charge toujours la dernière version ; hors ligne, elle utilise
la copie en cache (`sw.js`). Tous les chemins sont relatifs (`./…`).

## Ajouter des mots

Dans `words.js` : `{ mot: "ÉCOLE", emoji: "🏫" }` (`famille: true` pour la
catégorie « Famille »). Chaque mot doit avoir une image claire pour un
enfant qui ne lit pas encore.

## Syllabes

`syllabes.js` liste les 594 syllabes valides (A–Z, 2-3 lettres), d'après
le syllabaire [Syllabux](https://forge.apps.education.fr/educajou/syllabux)
(Arnaud Champollion, Éducajou). Régénérer : `python3 tools/import_syllabes.py
<dossier syllabux>`.

## Fichiers

- `index.html`, `style.css`, `app.js` : l'application
- `words.js` : les mots ; `syllabes.js` : les syllabes
- `version.js`, `sw.js`, `manifest.webmanifest`, `icon-*.png` : version,
  hors ligne, icône

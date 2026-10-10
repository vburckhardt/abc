#!/usr/bin/env node
// Écrit audio/liste.tsv : chaque son de l'app (fichier, texte), d'après
// sons.js, words.js et syllabes.js. tools/voix_mac.sh enregistre ceux qui
// manquent, et le service worker les met en cache pour le hors ligne.
// À relancer après un changement dans words.js ou syllabes.js.
//
// Usage : node tools/liste_sons.js
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RACINE = path.join(__dirname, "..");
const ctx = {};
ctx.self = ctx.window = ctx;
vm.createContext(ctx);
for (const f of ["words.js", "syllabes.js", "sons.js"]) {
  vm.runInContext(fs.readFileSync(path.join(RACINE, f), "utf8"), ctx, { filename: f });
}
const { SONS, MOTS, SYLLABES } = ctx;

const sons = [SONS.bravo]
  .concat(SONS.lettres.map(SONS.lettre))
  .concat(MOTS.map(SONS.mot))
  .concat(SYLLABES.map(SONS.syllabe));

// Un fichier = un texte (deux mots qui donneraient le même fichier : erreur).
const vus = new Map();
for (const s of sons) {
  if (vus.has(s.fichier) && vus.get(s.fichier) !== s.texte) {
    throw new Error(s.fichier + " : « " + vus.get(s.fichier) + " » et « " + s.texte + " »");
  }
  vus.set(s.fichier, s.texte);
}

const lignes = ["# fichier\ttexte (généré par tools/liste_sons.js)"];
for (const [fichier, texte] of vus) lignes.push(fichier + "\t" + texte);
fs.mkdirSync(path.join(RACINE, "audio"), { recursive: true });
fs.writeFileSync(path.join(RACINE, "audio", "liste.tsv"), lignes.join("\n") + "\n");
console.log("audio/liste.tsv : " + vus.size + " sons");

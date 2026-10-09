#!/bin/bash
# Enregistre les sons de l'app (audio/…) avec une voix du Mac, par défaut
# Audrey (Premium). La liste vient de audio/liste.tsv (tools/liste_sons.js).
# Seuls les sons manquants sont faits : supprimez un fichier pour le refaire,
# ou le dossier audio/ entier (sauf liste.tsv) pour changer de voix.
#
# Avant : Réglages Système › Accessibilité › Contenu énoncé › Voix du
# système › Gérer les voix… › Français › Audrey (Premium).
#
# Usage : bash tools/voix_mac.sh                  (Audrey Premium)
#         bash tools/voix_mac.sh "Thomas (Premium)"
set -eu
cd "$(dirname "$0")/.."

# Noms des voix françaises installées, un par ligne.
voix_fr() {
  say -v '?' | grep -E '[[:space:]]fr_[A-Z]{2}[[:space:]]' |
    sed -E 's/[[:space:]]+fr_[A-Z]{2}[[:space:]].*//'
}

VOIX=${1:-"Audrey (Premium)"}
if ! voix_fr | grep -qxF "$VOIX"; then
  echo "Voix « $VOIX » introuvable sur ce Mac. Voix françaises installées :"
  voix_fr | sed 's/^/  /'
  echo "Téléchargez-la (Réglages Système › Accessibilité › Contenu énoncé ›"
  echo "Voix du système › Gérer les voix…), ou choisissez-en une de la liste :"
  echo "  bash tools/voix_mac.sh \"Nom de la voix\""
  exit 1
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
faits=0
deja=0
echo "Voix : $VOIX"
while IFS=$'\t' read -r fichier texte; do
  case "$fichier" in '' | '#'*) continue ;; esac
  if [ -s "$fichier" ]; then
    deja=$((deja + 1))
    continue
  fi
  mkdir -p "$(dirname "$fichier")"
  say -v "$VOIX" -o "$tmp/son.aiff" "$texte" < /dev/null
  afconvert -f m4af -d aac "$tmp/son.aiff" "$fichier" < /dev/null
  faits=$((faits + 1))
  if [ $((faits % 50)) -eq 0 ]; then
    echo "  $faits sons…"
  fi
done < audio/liste.tsv
echo "Terminé : $faits nouveaux sons ($deja déjà là)."

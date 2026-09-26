#!/usr/bin/env python3
"""Écrit syllabes.js : la liste des syllabes valides que l'app peut lire.

La liste vient des noms de fichiers de Syllabux (Arnaud Champollion,
Éducajou, GNU GPL v2), un syllabaire pour le CP : syllabes CV, VC et CVC
(« ma », « cha », « bra », « ol »…). On garde celles qui s'écrivent avec
les lettres A–Z du clavier de l'app (2 ou 3 lettres). Seule la liste est
reprise, pas les enregistrements : l'app les fait dire par la voix de
l'appareil.

Usage :
    git clone --depth 1 https://forge.apps.education.fr/educajou/syllabux.git /tmp/syllabux
    python3 tools/import_syllabes.py /tmp/syllabux
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    src = os.path.join(sys.argv[1], "sons")
    noms = sorted(f[:-4] for f in os.listdir(src)
                  if f.endswith(".mp3") and re.fullmatch(r"[a-z]{2,3}", f[:-4]))
    with open(os.path.join(ROOT, "syllabes.js"), "w", encoding="utf-8") as f:
        f.write("// Syllabes valides lues sur l'écran Lettres (générée par\n"
                "// tools/import_syllabes.py, d'après le syllabaire Syllabux).\n")
        f.write("window.SYLLABES = " + json.dumps(noms) + ";\n")
    print(len(noms), "syllabes")


if __name__ == "__main__":
    main()

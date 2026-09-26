#!/usr/bin/env python3
"""Génère plusieurs versions du son de chaque lettre, à écouter sur ecoute.html.

    python3 tools/variantes.py

Versions :
  1 = version actuelle de l'app (audio/sons/<l>.mp3)
  2 = consonne naturelle, courte, non allongée / voyelle et syllabe en phonèmes
  3 = syllabe lue par la voix, plus lente (« Feu », « Meu », « Beu », « A »)
  (4 = voix de l'iPhone, jouée directement par la page)
Une fois choisi, recopier la version voulue dans audio/sons/<l>.mp3.
"""
import os
import shutil
import sys

import numpy as np
from piper.config import SynthesisConfig

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import generate_audio as g  # noqa: E402

OUT = os.path.join(g.AUDIO, "essai")

VOYELLES = {"a": "a", "e": "ø", "i": "i", "o": "o", "u": "y", "y": "i"}
OCCLUSIVES = {"b": "b", "c": "k", "d": "d", "g": "ɡ", "k": "k", "p": "p", "q": "k", "t": "t"}
CONTINUES = {"f": "f", "j": "ʒ", "l": "l", "m": "m", "n": "n", "r": "ʁ", "s": "s", "v": "v", "z": "z"}
SYLLABE = {  # texte pour la version 3
    "a": "A.", "e": "Heu.", "i": "I.", "o": "O.", "u": "U.", "y": "I.",
    "b": "Beu.", "c": "Keu.", "d": "Deu.", "g": "Gueu.", "k": "Keu.", "p": "Peu.",
    "q": "Keu.", "t": "Teu.", "f": "Feu.", "j": "Jeu.", "l": "Leu.", "m": "Meu.",
    "n": "Neu.", "r": "Reu.", "s": "Seu.", "v": "Veu.", "z": "Zeu.", "x": "Kseu.",
    "h": "Hache.", "w": "Double vé.",
}


def texte_lent(s, t, lenteur=1.4):
    cfg = SynthesisConfig(length_scale=lenteur)
    return np.concatenate([c.audio_float_array for c in s.v.synthesize(t, syn_config=cfg)]).astype(np.float64)


def consonne_naturelle(s, c):
    a = s.ph("aˈ" + c + "ːa.", 1.8)
    b, e = g.cut_consonant(a)
    seg = a[b:e]
    return g.fade(np.concatenate([seg, np.zeros(int(0.05 * g.SR))]), 0.01, 0.06)


def version2(s, l):
    if l in VOYELLES:
        return g.fade(g.trim(s.ph("ˈ" + VOYELLES[l] + ".", 1.5)), 0.005, 0.05)
    if l in OCCLUSIVES:
        return g.fade(g.trim(s.ph(OCCLUSIVES[l] + "ˈə.", 1.3)), 0.005, 0.05)
    if l in CONTINUES:
        return consonne_naturelle(s, CONTINUES[l])
    if l == "x":
        a = s.ph("aˈksːa.", 1.8)
        b, e = g.cut_consonant(a)
        return g.fade(a[b:e], 0.005, 0.06)
    return g.trim(s.ph(g.NOMS[l]))  # h, w


def main():
    s = g.Synth(g.load_voice())
    os.makedirs(OUT, exist_ok=True)
    for l in "abcdefghijklmnopqrstuvwxyz":
        shutil.copy(os.path.join(g.AUDIO, "sons", l + ".mp3"), os.path.join(OUT, f"{l}-1.mp3"))
        gain = g.GAIN.get(l, 1.0)
        g.write_mp3(version2(s, l), os.path.join(OUT, f"{l}-2.mp3"), gain)
        g.write_mp3(g.fade(g.trim(texte_lent(s, SYLLABE[l])), 0.005, 0.05), os.path.join(OUT, f"{l}-3.mp3"))
        print("✓", l)


if __name__ == "__main__":
    main()

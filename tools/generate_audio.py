#!/usr/bin/env python3
"""Génère tous les sons de l'app (lettres, noms des lettres, mots) hors ligne.

Voix : Piper « siwis » (français, licence CC-BY 4.0), exécutée en local.
Les sons syllabiques continus (sss, mmm, fff…) ne sortent pas bien quand on
demande un phonème isolé au modèle : on synthétise donc « a-sss-a », on
découpe la consonne au milieu, puis on l'allonge (grains de bruit pour les
consonnes sourdes, grains alignés sur la période de la voix pour les sonores).

Usage :
    pip install piper-tts imageio-ffmpeg numpy
    python3 tools/generate_audio.py            # ne régénère que ce qui manque
    python3 tools/generate_audio.py --force    # tout régénérer
"""
import argparse
import io
import json
import os
import re
import subprocess
import sys
import tarfile
import unicodedata
import urllib.request

import numpy as np
from piper import PiperVoice
from piper.config import SynthesisConfig

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO = os.path.join(ROOT, "audio")
VOICE_DIR = os.path.join(ROOT, "tools", ".voice")
VOICE_URL = "https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-fr-siwis-medium.tar.gz"
SR = 22050

# Son syllabique de chaque lettre.
#   ("stretch", phonème) : consonne continue découpée puis allongée
#   ("text", texte)       : syllabe/voyelle lue par la voix (« Beu. »)
#   ("ph", phonèmes)      : idem mais en phonèmes (accent ˈ avant la voyelle)
#   ("name",)             : pas de son propre, on dit le nom (H, W)
SONS = {
    "a": ("text", "A."), "b": ("text", "Beu."), "c": ("text", "Keu."), "d": ("text", "Deu."),
    "e": ("ph", "ˈø."), "f": ("stretch", "f"), "g": ("text", "Gueu."), "h": ("name",),
    "i": ("text", "I."), "j": ("stretch", "ʒ"), "k": ("text", "Keu."), "l": ("stretch", "l"),
    "m": ("stretch", "m"), "n": ("stretch", "n"), "o": ("text", "O."), "p": ("text", "Peu."),
    "q": ("text", "Keu."), "r": ("stretch", "ʁ"), "s": ("stretch", "s"), "t": ("text", "Teu."),
    "u": ("text", "U."), "v": ("stretch", "v"), "w": ("name",), "x": ("x",),
    "y": ("text", "I."), "z": ("stretch", "z"),
}
VOICED = set("ʒlmnʁvz")
# Les consonnes sifflantes sont naturellement plus faibles que les voyelles.
GAIN = {"f": 0.45, "s": 0.7, "x": 0.7}

# Nom de chaque lettre, en phonèmes.
NOMS = {
    "a": "ˈa.", "b": "bˈe.", "c": "sˈe.", "d": "dˈe.", "e": "ˈø.", "f": "ˈɛf.",
    "g": "ʒˈe.", "h": "ˈaʃ.", "i": "ˈi.", "j": "ʒˈi.", "k": "kˈa.", "l": "ˈɛl.",
    "m": "ˈɛm.", "n": "ˈɛn.", "o": "ˈo.", "p": "pˈe.", "q": "kˈy.", "r": "ˈɛʁ.",
    "s": "ˈɛs.", "t": "tˈe.", "u": "ˈy.", "v": "vˈe.", "w": "dˈubl vˈe.",
    "x": "ˈiks.", "y": "ˈi ɡʁˈɛk.", "z": "zˈɛd.",
}

# Prononciations forcées (phonèmes) pour les mots que la voix lit mal.
PRONONCIATION = {
    "burckhardt": "byʁkˈaʁt.",
}


def word_id(mot):
    """Même règle que app.js : sans accents, en minuscules."""
    s = unicodedata.normalize("NFD", mot)
    return "".join(c for c in s if unicodedata.category(c) != "Mn").lower()


def load_words():
    src = open(os.path.join(ROOT, "words.js"), encoding="utf-8").read()
    return re.findall(r'mot:\s*"([^"]+)"', src)


def load_voice():
    onnx = os.path.join(VOICE_DIR, "fr-siwis-medium.onnx")
    if not os.path.exists(onnx):
        os.makedirs(VOICE_DIR, exist_ok=True)
        print("Téléchargement de la voix…")
        data = urllib.request.urlopen(VOICE_URL).read()
        tarfile.open(fileobj=io.BytesIO(data)).extractall(VOICE_DIR)
    return PiperVoice.load(onnx)


class Synth:
    def __init__(self, voice):
        self.v = voice

    def ph(self, phonemes, length=1.0):
        ids = self.v.phonemes_to_ids(list(phonemes))
        cfg = SynthesisConfig(length_scale=length, noise_w_scale=0.3)
        return self.v.phoneme_ids_to_audio(ids, cfg).astype(np.float64)

    def text(self, t):
        return np.concatenate([c.audio_float_array for c in self.v.synthesize(t)]).astype(np.float64)


def spectra(a, n=512, hop=128):
    w = np.hanning(n)
    S = np.array([np.abs(np.fft.rfft(a[i:i + n] * w)) ** 2 for i in range(0, len(a) - n, hop)])
    return S, np.fft.rfftfreq(n, 1 / SR), hop


def cut_consonant(a):
    """Retourne (début, fin) de la consonne entre les deux « a »."""
    S, f, hop = spectra(a)
    vowel = 10 * np.log10(S[:, (f > 500) & (f < 1500)].sum(1) + 1e-12)
    vi = np.where(vowel > vowel.max() - 8)[0]
    k = np.argmax(np.diff(vi))
    return vi[k] * hop + 512, vi[k + 1] * hop


def estimate_period(x):
    x = x - x.mean()
    ac = np.correlate(x, x, "full")[len(x) - 1:]
    lo, hi = SR // 400, SR // 70
    return lo + int(np.argmax(ac[lo:hi]))


def stretch(seg, voiced, dur=0.65):
    """Allonge la partie stable du segment jusqu'à `dur` secondes."""
    core = seg[len(seg) // 5: len(seg) * 4 // 5]
    out_len = int(dur * SR)
    out = np.zeros(out_len + 4096)
    rng = np.random.default_rng(1)
    if voiced:
        T = estimate_period(core)
        n = 2 * T
        marks = list(range(0, len(core) - n, T)) or [0]
        order = marks + marks[::-1][1:-1]  # aller-retour pour éviter les sauts
        win = np.hanning(n)
        pos, i = 0, 0
        while pos < out_len:
            m = order[i % len(order)]
            out[pos:pos + n] += core[m:m + n] * win
            pos += T
            i += 1
    else:
        n = 512
        hop = n // 2
        win = np.hanning(n)
        pos = 0
        while pos < out_len:
            m = rng.integers(0, max(1, len(core) - n))
            g = core[m:m + n]
            out[pos:pos + len(g)] += g * win[:len(g)]
            pos += hop
    return out[:out_len]


def fade(a, fin=0.02, fout=0.08):
    a = a.copy()
    i, o = int(fin * SR), int(fout * SR)
    a[:i] *= np.linspace(0, 1, i)
    a[-o:] *= np.linspace(1, 0, o)
    return a


def trim(a, db=-40):
    env = np.abs(a)
    thr = env.max() * 10 ** (db / 20)
    idx = np.where(env > thr)[0]
    if len(idx) == 0:
        return a
    return a[max(0, idx[0] - 300): idx[-1] + 600]


def normalize(a, rms=0.12, peak=0.95):
    """Même volume perçu pour tous les sons (RMS), sans saturer."""
    r = np.sqrt((a ** 2).mean())
    if r == 0:
        return a
    a = a * (rms / r)
    m = np.abs(a).max()
    return a * (peak / m) if m > peak else a


def make_son(s, letter):
    kind = SONS[letter]
    if kind[0] == "text":
        return fade(trim(s.text(kind[1])), 0.005, 0.05)
    if kind[0] == "ph":
        return fade(trim(s.ph(kind[1], 1.3)), 0.005, 0.05)
    if kind[0] == "name":
        return trim(s.ph(NOMS[letter]))
    if kind[0] == "x":  # « ksss » : le k du carrier puis un s allongé
        a = s.ph("aˈksːa.", 1.5)
        b, e = cut_consonant(a)
        k = a[b: b + int(0.06 * SR)]
        ss = make_son(s, "s")
        return fade(np.concatenate([k, ss[int(0.02 * SR):]]), 0.005, 0.08)
    c = kind[1]
    a = s.ph("aˈ" + c + "ːa.", 1.5)
    b, e = cut_consonant(a)
    return fade(stretch(a[b:e], c in VOICED))


def write_mp3(a, path, gain=1.0):
    import imageio_ffmpeg
    pcm = (np.clip(normalize(a) * gain, -1, 1) * 32767).astype("<i2").tobytes()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    subprocess.run(
        [imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error",
         "-f", "s16le", "-ar", str(SR), "-ac", "1", "-i", "-",
         "-codec:a", "libmp3lame", "-b:a", "48k", path],
        input=pcm, check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    s = Synth(load_voice())
    jobs = []
    for l in SONS:
        jobs.append((f"sons/{l}.mp3", lambda l=l: make_son(s, l), GAIN.get(l, 1.0)))
        jobs.append((f"noms/{l}.mp3", lambda l=l: trim(s.ph(NOMS[l])), 1.0))
    for mot in load_words():
        wid = word_id(mot)
        if wid in PRONONCIATION:
            jobs.append((f"mots/{wid}.mp3", lambda p=PRONONCIATION[wid]: trim(s.ph(p)), 1.0))
        else:
            txt = mot.capitalize() + "."
            jobs.append((f"mots/{wid}.mp3", lambda t=txt: trim(s.text(t)), 1.0))
    jobs.append(("bravo.mp3", lambda: trim(s.text("Bravo !")), 1.0))

    for rel, fn, gain in jobs:
        path = os.path.join(AUDIO, rel)
        if args.force or not os.path.exists(path):
            write_mp3(fn(), path, gain)
            print("✓", rel)

    manifest = sorted("audio/" + rel for rel, _, _ in jobs)
    with open(os.path.join(AUDIO, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=0)
    print(f"{len(manifest)} fichiers dans audio/manifest.json")


if __name__ == "__main__":
    sys.exit(main())

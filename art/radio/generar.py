"""Las canciones de prueba de la radio (plan 022 T246, Hernán 2026-10-09): `muestra`.

Cien bucles cortos sintetizados aquí mismo (nada se descarga), 25 por género
(techno, house, reggaetón, indie), en MP3 mono de 48 kbps. Dos duran ~30 s
(la primera canción y otra) para probar el avance y la precarga del final; el
resto, 4 s. Títulos y artistas inventados, todos `muestra`.

Se corre con el Blender del proyecto (su ffmpeg codifica el MP3; numpy viene
con él), desde la raíz del repo:

    "C:/Program Files/Blender Foundation/Blender 4.0/blender.exe" -b --factory-startup \
        -P art/radio/generar.py

Escribe:
  - apps/web/public/radio/muestra/<id>.mp3
  - apps/web/lib/radio/muestra.json (el catálogo de muestra que siembra la radio)
Es determinista (semilla fija). Falla si el total pasa de MAX_BYTES.
"""
import json
import os
import shutil
import tempfile
import wave

import bpy
import numpy as np

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_MP3 = os.path.join(REPO, "apps", "web", "public", "radio", "muestra")
OUT_JSON = os.path.join(REPO, "apps", "web", "lib", "radio", "muestra.json")
PUBLIC_PREFIX = "/radio/muestra/"

SR = 22050
FPS = 24
KBPS = 48
SHORT_S = 4.0
LONG_S = 30.0
PER_GENRE = 25
MAX_BYTES = 3_000_000

GENRES = [
    ("techno", "Techno"),
    ("house", "House"),
    ("reggaeton", "Reggaetón"),
    ("indie", "Indie"),
]
# (género, índice dentro del género) de las largas; la primera es la primera canción.
LONG = {("techno", 0), ("house", 0)}
FIRST = ("techno", 0)

TEMPO = {"techno": (128, 136), "house": (120, 126), "reggaeton": (88, 98), "indie": (104, 140)}

WORDS_A = ["Marea", "Faro", "Boia", "Salitre", "Ola", "Muelle", "Neón", "Luna", "Brisa", "Coral",
           "Arena", "Ancla", "Velero", "Palmera", "Calita", "Albufera", "Tabarca", "Postiguet",
           "Medusa", "Gaviota", "Espuma", "Sirena", "Bahía", "Duna", "Corriente"]
WORDS_B = ["de medianoche", "eléctrica", "en bucle", "de agosto", "sin prisa", "al amanecer",
           "infinita", "de cristal", "del sur", "a la deriva", "de neón", "lenta", "salvaje",
           "dorada", "en Alicante", "del puerto", "de verano", "secreta", "azul", "de fiesta"]
ARTISTS = ["DJ Muestra", "Las Boias", "Capitana Ola", "Faro Norte", "Kiko Salitre",
           "Neón Club", "Medusa Ritmo", "Los del Muelle", "Ana Marea", "Trío Calita",
           "MC Gaviota", "Luna Postiguet", "Banda Velero", "Coral Sound", "Brisa FM",
           "Sirena 303", "Duna Beat", "Tabarca Crew"]


def env(n, attack, decay):
    t = np.arange(n) / SR
    a = np.minimum(1.0, t / max(attack, 1e-4))
    return a * np.exp(-t / decay)


def kick(n, rng):
    t = np.arange(n) / SR
    f = 45 + 110 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * env(n, 0.001, 0.18 + rng.uniform(0, 0.08))


def noise_hit(n, rng, decay, hp=True):
    x = rng.uniform(-1, 1, n)
    if hp:
        x = np.diff(x, prepend=0.0)
    return x * env(n, 0.0005, decay)


def snare(n, rng):
    t = np.arange(n) / SR
    body = np.sin(2 * np.pi * 190 * t) * env(n, 0.001, 0.06)
    return 0.6 * body + 0.7 * noise_hit(n, rng, 0.09, hp=False)


def clap(n, rng):
    x = np.zeros(n)
    for k, d in enumerate((0, 0.011, 0.022)):
        s = int(d * SR)
        m = n - s
        x[s:] += noise_hit(m, rng, 0.03 if k < 2 else 0.12) * 0.6
    return x


def tone(freq, n, wave_kind, decay, attack=0.004):
    t = np.arange(n) / SR
    ph = 2 * np.pi * freq * t
    if wave_kind == "saw":
        x = 2 * ((freq * t) % 1.0) - 1
    elif wave_kind == "square":
        x = np.sign(np.sin(ph)) * 0.7
    elif wave_kind == "tri":
        x = 2 * np.abs(2 * ((freq * t) % 1.0) - 1) - 1
    else:
        x = np.sin(ph) + 0.3 * np.sin(2 * ph)
    return x * env(n, attack, decay)


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def add(buf, at, x, gain):
    s = int(at)
    if s >= len(buf):
        return
    e = min(len(buf), s + len(x))
    buf[s:e] += x[: e - s] * gain


MINOR = [0, 2, 3, 5, 7, 8, 10]
MAJOR = [0, 2, 4, 5, 7, 9, 11]


def track(genre, seconds, rng):
    lo, hi = TEMPO[genre]
    bpm = int(rng.integers(lo, hi + 1))
    beat = SR * 60.0 / bpm
    six = beat / 4
    n = int(seconds * SR)
    buf = np.zeros(n)
    root = int(rng.integers(36, 46))
    scale = MAJOR if genre in ("indie", "house") and rng.random() < 0.6 else MINOR
    prog = [int(rng.choice([0, 3, 4, 5])) for _ in range(4)]
    prog[0] = 0
    wave_kind = {"techno": "saw", "house": "square", "reggaeton": "sine", "indie": "tri"}[genre]
    melody = [int(rng.integers(0, 7)) for _ in range(8)]
    k_len, h_len = int(0.35 * SR), int(0.08 * SR)
    steps = int(n / six) + 1
    for st in range(steps):
        at = st * six
        b, s16 = divmod(st, 4)
        bar = st // 16
        deg = prog[bar % 4]
        chord_root = root + scale[deg % 7]
        if genre == "techno":
            if s16 == 0:
                add(buf, at, kick(k_len, rng), 0.9)
            if s16 == 2:
                add(buf, at, noise_hit(h_len, rng, 0.04), 0.35)
                add(buf, at, tone(midi(chord_root), int(six * 1.8), "saw", 0.12), 0.18)
            if st % 16 in (3, 7, 11) and rng.random() < 0.5:
                add(buf, at, tone(midi(chord_root + 24 + scale[melody[st % 8]]), int(six), "square", 0.05), 0.08)
            if b % 2 == 1 and s16 == 0:
                add(buf, at, clap(int(0.2 * SR), rng), 0.3)
        elif genre == "house":
            if s16 == 0:
                add(buf, at, kick(k_len, rng), 0.85)
            if s16 == 2:
                add(buf, at, noise_hit(int(0.18 * SR), rng, 0.09), 0.3)
            if b % 2 == 1 and s16 == 0:
                add(buf, at, clap(int(0.25 * SR), rng), 0.45)
            if st % 8 in (3, 6):
                for iv in (0, 2, 4):
                    m = root + 12 + scale[(deg + iv) % 7] + (12 if deg + iv >= 7 else 0)
                    add(buf, at, tone(midi(m), int(beat * 0.6), "square", 0.1), 0.06)
            if s16 in (0, 3) and rng.random() < 0.8:
                add(buf, at, tone(midi(chord_root), int(six * 1.5), "sine", 0.1), 0.35)
        elif genre == "reggaeton":
            pos = st % 8  # dembow: bombo en 0 y 4, caja en 3 y 6
            if pos in (0, 4):
                add(buf, at, kick(k_len, rng), 0.95)
            if pos in (3, 6):
                add(buf, at, snare(int(0.18 * SR), rng), 0.45)
            if s16 % 2 == 0:
                add(buf, at, noise_hit(h_len, rng, 0.03), 0.18)
            if pos in (0, 3, 4, 6):
                add(buf, at, tone(midi(chord_root), int(six * 2), "sine", 0.2), 0.4)
            if st % 16 == 8:
                for i, d in enumerate(melody[:4]):
                    add(buf, at + i * beat / 2, tone(midi(root + 24 + scale[d]), int(beat / 2), "tri", 0.2), 0.12)
        else:  # indie
            if s16 == 0 and b % 4 in (0, 2):
                add(buf, at, kick(k_len, rng), 0.8)
            if s16 == 0 and b % 4 in (1, 3):
                add(buf, at, snare(int(0.22 * SR), rng), 0.5)
            if s16 % 2 == 0:
                add(buf, at, noise_hit(h_len, rng, 0.05), 0.15)
            if s16 in (0, 2):  # rasgueo
                for i, iv in enumerate((0, 2, 4, 7)):
                    m = root + 12 + scale[(deg + iv) % 7] + 12 * ((deg + iv) // 7)
                    add(buf, at + i * 0.012 * SR, tone(midi(m), int(beat), "tri", 0.25), 0.05)
            if s16 == 0:
                add(buf, at, tone(midi(root + 24 + scale[melody[b % 8]]), int(beat * 0.9), "sine", 0.3, 0.02), 0.12)
    # Fundido de entrada y salida (para que el bucle no haga clic).
    f = int(0.02 * SR)
    buf[:f] *= np.linspace(0, 1, f)
    fo = int(0.4 * SR)
    buf[-fo:] *= np.linspace(1, 0, fo)
    peak = np.max(np.abs(buf)) or 1.0
    return (buf / peak * 0.85 * 32767).astype(np.int16), bpm


def encode(pcm, wav_path, mp3_path):
    with wave.open(wav_path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    sc = bpy.context.scene
    if sc.sequence_editor:
        for s in list(sc.sequence_editor.sequences):
            sc.sequence_editor.sequences.remove(s)
    else:
        sc.sequence_editor_create()
    sc.render.fps = FPS
    s = sc.sequence_editor.sequences.new_sound("pista", wav_path, 1, 1)
    sc.frame_start = 1
    sc.frame_end = s.frame_final_end - 1
    sc.render.ffmpeg.audio_mixrate = SR
    sc.render.ffmpeg.audio_channels = "MONO"
    r = bpy.ops.sound.mixdown(filepath=mp3_path, container="MP3", codec="MP3", bitrate=KBPS, format="S16")
    if "FINISHED" not in r:
        raise SystemExit(f"mixdown falló: {mp3_path}")


def main():
    rng = np.random.default_rng(2026_10_09)
    if os.path.isdir(OUT_MP3):
        shutil.rmtree(OUT_MP3)
    os.makedirs(OUT_MP3)
    tmp = tempfile.mkdtemp(prefix="boia-radio-")
    songs = []
    used_titles = set()
    order = 0
    for gi, (gid, _) in enumerate(GENRES):
        for k in range(PER_GENRE):
            order += 1
            seconds = LONG_S if (gid, k) in LONG else SHORT_S
            pcm, bpm = track(gid, seconds, rng)
            sid = f"muestra-{order:03d}"
            mp3 = os.path.join(OUT_MP3, f"{sid}.mp3")
            encode(pcm, os.path.join(tmp, "pista.wav"), mp3)
            while True:
                title = f"{rng.choice(WORDS_A)} {rng.choice(WORDS_B)}"
                if title not in used_titles:
                    used_titles.add(title)
                    break
            songs.append({
                "id": sid,
                "title": title,
                "artist": str(rng.choice(ARTISTS)),
                "genreId": gid,
                "durationSeconds": round(len(pcm) / SR, 2),
                "src": PUBLIC_PREFIX + f"{sid}.mp3",
                "bytes": os.path.getsize(mp3),
                "first": (gid, k) == FIRST,
                "bpm": bpm,
            })
    # Orden de la lista: intercalados por género (la primera canción, la primera).
    by_genre = {g: [s for s in songs if s["genreId"] == g] for g, _ in GENRES}
    mixed = [s for row in zip(*by_genre.values()) for s in row]
    for i, s in enumerate(mixed):
        s["order"] = i
    total = sum(s["bytes"] for s in mixed)
    if total > MAX_BYTES:
        raise SystemExit(f"las canciones pesan {total} B (> {MAX_BYTES})")
    data = {
        "muestra": True,
        "generatedBy": "art/radio/generar.py",
        "totalBytes": total,
        "genres": [{"id": g, "name": name} for g, name in GENRES],
        "songs": [{k: v for k, v in s.items() if k not in ("bytes", "bpm")} for s in mixed],
    }
    with open(OUT_JSON, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    shutil.rmtree(tmp, ignore_errors=True)
    print(f"radio muestra: {len(mixed)} canciones, {total} bytes")


main()

"""La isla del after (plan 029, T273): sólo existe de 03:00 a 07:00 de Alicante. MUESTRA.

Un islote de arena oscura con una pista de baile improvisada. Al fondo, un
sound system de andar por casa: dos columnas de altavoces algo torcidas, la
mesa del DJ sobre cajas de fruta con la boia DJ (cascos, un brazo arriba) y
una pancarta de tablas con «AFTER» en neón. En medio, un poste con la bola de
discoteca; entre los postes, guirnaldas de bombillas de colores que laten con
la música (en /mar: `apps/web/app/mar/engine/after.ts`). Una boia bailando
con gafas de sol, otra dormida en la arena con las gafas puestas, latas por el
suelo, un flamenco hinchable pinchado, dos palmeras cansadas y el muelle.
Los peces que bailan alrededor los pone el motor (no van en el modelo).

Todo de marca y amable: cerveza y latas de refresco, nada más (D: brand-safe).
Medidas en unidades de escena del mar 3D (la isla de /mar mide R ≈ 7).
Presupuesto propio: el GLB servido pesa ≤ 300 KB (plan 029), así que la isla
va por debajo de ~12 000 triángulos (DETAIL bajo y pocas piezas).
"""
import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector

import mascota as MASC
from islas import allday as AD

ID = "after"
LABEL = "La isla del after"
DOC = ("islote de arena oscura con un sound system de andar por casa, la boia DJ con cascos, la pancarta «AFTER» "
       "en neón, bola de discoteca, guirnaldas de bombillas, una boia bailando y otra dormida con gafas de sol, "
       "latas, un flamenco pinchado y dos palmeras; sólo sale de 03:00 a 07:00 de Alicante")
RADIUS = 7.0            # orilla de la isla en z = 0, en unidades del modelo
DETAIL = 0.35           # segmentos de cada pieza respecto a los de los mundos (comun.ligero)
TOP = 1.3               # la meseta de arena pisada (z), donde se apoya todo
UP = Vector((0.0, 0.0, 1.0))

# Papeles nuevos de esta isla (color plano en el glTF); los demás son los del tema de arcilla.
ROLES = {
    "af_sand": "#C9AE7E",          # arena pisada, algo oscura (la isla de madrugada)
    "af_sand_dark": "#9E8460",
    "af_rock": "#4E4460",          # roca morada de la orilla
    "af_floor": "#5B4A6E",         # la lona de la pista
    # Los papeles `snd_*` son los que usan las piezas de islas/allday.py que se reutilizan (altavoces, focos, cascos).
    "snd_cab": "#232330",          # cajas de los altavoces
    "snd_baffle": "#34364A",
    "snd_cone": "#101016",
    "snd_truss": "#8E929E",        # el gancho de los focos
    "af_crate": "#B98A4C",         # cajas de fruta de la mesa del DJ
    "af_pole": "#6B6F7A",          # postes de metal
    "af_mirror": "#D7DEEA",        # la bola de discoteca
    "af_can": "#D64545",           # latas de refresco
    "af_can_b": "#3F7BD9",
    "af_flamingo": "#F48FB1",      # el flamenco pinchado
    "af_flamingo_dark": "#E0609A",
    "af_banner": "#7A5A3A",        # las tablas de la pancarta
    "af_shades": "#1E1E28",
}
# Papeles que brillan (emisivos): el neón de la pancarta, las bombillas y la tira de la mesa. El motor los hace latir.
GLOW = {
    "af_neon": "#FF4FB0",
    "af_neon_cyan": "#4FE6FF",
    "af_bulb_warm": "#FFC04A",
    "af_bulb_green": "#4BFF7A",
    "snd_magenta": "#FF4FB0",      # las orejeras de los cascos del DJ (allday.auriculares)
    "snd_cyan": "#4FE6FF",
    "snd_spot": "#FFC04A",
}


def build(B, K):
    """Construye la isla con el Builder B; K es el módulo comun."""
    rng = random.Random(327)
    R = RADIUS
    H = 1.0
    K.terreno(B, "af_sand", R * 1.02, H, segs=30, rings=8, noise=K.shore_noise(4))
    K.terreno(B, "af_sand_dark", R * 1.12, 0.22, sink=0.8, q=2.0, segs=24, rings=5, noise=K.shore_noise(6))
    # La meseta de arena pisada (q alto: casi plana).
    B.blob("af_sand", (R * 0.78, R * 0.78, 0.6), Vector((0.0, 0.0, TOP - 0.6)), 2.0, 5.0, segs=30, rings=8)
    for i in range(9):
        ang = i * 40 + rng.uniform(-10, 10)
        if abs(((ang + 90 + 180) % 360) - 180) < 26:
            continue
        r = R * rng.uniform(0.94, 1.06)
        K.roca(B, "af_rock", K.polar(r, ang, 0.1), rng.uniform(0.4, 0.8), rng, segs=6)

    # --- La pista: una lona en la arena con el poste de la bola en medio ---------------------------------
    pista(B, Vector((0.0, -0.9, TOP)), 2.4)
    bola_pole = Vector((0.0, -0.9, TOP))
    poste(B, bola_pole, 3.9)
    bola(B, bola_pole + UP * 3.75, 0.34)

    # --- El sound system: columnas, la mesa del DJ y la pancarta ------------------------------------------
    for s in (-1, 1):
        AD.columna(B, Vector((s * 2.5, 2.4, TOP - 0.02)), -s * 22 + s * 6)
    mesa_dj(B, Vector((0.0, 2.35, TOP)))
    # La boia DJ: cascos y gafas de sol a las cuatro de la mañana (sin ojos a la vista: menos triángulos).
    AD.boia_bailando(B, Vector((0.0, 3.15, TOP + 0.55)), 1.0, K.g_toward(K.FRONT), "uno", True, tilt=-7,
                     cascos=True, boca="sonrisa")
    pancarta(B, Vector((0.0, 3.9, TOP)), 1.0)

    # --- Guirnaldas de bombillas entre los postes ----------------------------------------------------------
    posts = [Vector((-4.3, -0.4, TOP - 0.15)), Vector((4.3, -0.4, TOP - 0.15)),
             Vector((-3.0, -3.6, TOP - 0.45)), Vector((3.0, -3.6, TOP - 0.45))]
    for p in posts:
        poste(B, p, 2.6, r=0.045)
    bola_top = bola_pole + UP * 3.3
    for i, p in enumerate(posts):
        guirnalda(B, p + UP * 2.55, bola_top, 0.55, 7, i)
    guirnalda(B, posts[0] + UP * 2.55, posts[2] + UP * 2.55, 0.3, 5, 4)
    guirnalda(B, posts[1] + UP * 2.55, posts[3] + UP * 2.55, 0.3, 5, 5)

    # --- Las boias: una bailando y otra dormida -------------------------------------------------------------
    AD.boia_bailando(B, Vector((-1.25, -1.55, TOP + 0.1)), 1.15,
                     K.g_toward(Matrix.Rotation(math.radians(30), 3, "Z") @ K.FRONT), "arriba", True, tilt=12,
                     boca="sonrisa")
    boia_dormida(B, K, Vector((3.4, -1.5, TOP - 0.1)), 1.05, rng)

    # --- Por la arena: latas, el flamenco pinchado, las gafas, las palmeras y el muelle -----------------------
    for i in range(7):
        ang = rng.uniform(-200, 20)
        r = rng.uniform(1.6, 4.6)
        p = K.polar(r, ang)
        z = _ground(R, H, p)
        lata(B, Vector((p.x, p.y, z)), rng, "af_can" if i % 2 else "af_can_b")
    flamenco_pinchado(B, Vector((-3.4, 1.0, _ground(R, H, Vector((-3.4, 1.0))))))
    gafas_perdidas(B, Vector((1.4, -3.4, _ground(R, H, Vector((1.4, -3.4))) + 0.05)))
    for ang, r, h in ((150, 5.3, 3.4), (20, 5.4, 3.0)):
        p = K.polar(r, ang)
        AD.palmera(B, Vector((p.x, p.y, _ground(R, H, p) - 0.1)), h, rng)
    K.muelle(B, Vector((0.0, -R * 0.9, 0.0)), 2.4, width=1.0)
    return {"top": TOP, "height": max(v.co.z for o in bpy.data.objects if o.type == "MESH" for v in o.data.vertices)}


def _ground(R, H, p):
    """Altura aproximada del terreno en p: la arena (terreno()) o la meseta."""
    d = math.hypot(p.x, p.y)
    sand = (H + 0.6) * max(0.0, 1.0 - min(1.0, d / (R * 1.02)) ** 2.4) ** (1 / 2.4) - 0.6
    flat = TOP - 0.6 + 0.6 * max(0.0, 1.0 - min(1.0, d / (R * 0.78)) ** 5.0) ** (1 / 5.0)
    return max(sand, flat)


# --- Piezas ---------------------------------------------------------------------------------------------
def pista(B, c, r):
    """La lona de la pista: un disco bajo con el borde de neón y la marca de pisadas (un disco más claro)."""
    B.lathe("af_floor", [(0.0, 0.06), (r, 0.06), (r + 0.05, 0.02), (r + 0.05, -0.2), (0.0, -0.2)], c, segs=28)
    B.torus("af_neon_cyan", r + 0.03, 0.035, Matrix.Translation(c + UP * 0.06), nu=28, nv=4)
    B.blob("af_sand_dark", (r * 0.45, r * 0.3, 0.015), c + Vector((0.3, 0.2, 0.065)), 2.0, 2.0, segs=14, rings=4)


def poste(B, base, h, r=0.07):
    """Poste de metal clavado en la arena, un pelo torcido."""
    lean = Vector((0.06 * h * math.sin(base.x), 0.04 * h, 0.0))
    B.tube("af_pole", [base - UP * 0.3, base + UP * h + lean], r, segs=6)
    B.blob("af_sand_dark", (r * 4, r * 4, 0.03), base + UP * 0.01, 2.0, 2.0, segs=10, rings=4)


def bola(B, c, r):
    """La bola de discoteca: una esfera de pocas caras, todas planas (los espejitos), colgada de su gancho."""
    bm = bmesh.new()
    B.G.superquadric(bm, (r, r, r), 2.0, 2.0, matrix=Matrix.Translation(c), segs=14, rings=8)
    B.mk(bm, "af_mirror", sharp=0, smooth=False)
    B.tube("af_pole", [c + UP * r * 0.9, c + UP * (r + 0.12)], 0.02, segs=4)


def mesa_dj(B, at):
    """La mesa del DJ: dos cajas de fruta con una tabla encima, la tira de neón, un plato y la mesa de mezclas."""
    M = AD._M(at, 0.0)
    for sx in (-1, 1):
        AD.caja(B, "af_crate", (0.32, 0.26, 0.26), M @ Matrix.Translation((sx * 0.62, 0.0, 0.26)))
    AD.caja(B, "wood", (1.05, 0.34, 0.03), M @ Matrix.Translation((0.0, 0.0, 0.55)))
    AD.caja(B, "af_neon", (0.95, 0.012, 0.03), M @ Matrix.Translation((0.0, -0.35, 0.47)))
    p = M @ Vector((-0.45, 0.0, 0.58))
    B.lathe("metal", [(0.0, 0.0), (0.28, 0.0), (0.28, 0.035), (0.0, 0.035)], p, segs=12)
    B.lathe("ink", [(0.0, 0.035), (0.22, 0.035), (0.22, 0.05), (0.0, 0.05)], p, segs=12)
    AD.caja(B, "snd_baffle", (0.3, 0.26, 0.05), M @ Matrix.Translation((0.35, 0.0, 0.63)))
    for i in range(3):
        AD.caja(B, "af_neon_cyan" if i % 2 else "af_bulb_warm", (0.025, 0.07, 0.02),
                M @ Matrix.Translation((0.2 + i * 0.13, -0.04, 0.69)))
    # Una lata abierta sobre la mesa, como no podía ser de otra manera.
    B.lathe("af_can", [(0.0, 0.0), (0.055, 0.0), (0.055, 0.17), (0.0, 0.17)], M @ Vector((0.0, 0.1, 0.58)), segs=8)


def pancarta(B, at, h):
    """Dos tablas clavadas con la pancarta «AFTER» en neón rosa; las letras, bloques de cajas."""
    for sx in (-1, 1):
        B.tube("af_banner", [at + Vector((sx * 1.55, 0.0, -0.3)), at + Vector((sx * 1.5, 0.0, 2.9))], 0.06, segs=5)
    M = Matrix.Translation(at + Vector((0.0, 0.0, 2.25)))
    AD.caja(B, "af_banner", (1.6, 0.03, 0.42), M)
    letras(B, M @ Matrix.Translation((0.0, -0.05, 0.0)), 0.5)
    # Un foco de pinza colgado de la tabla, apuntando a la mesa.
    AD.foco(B, at + Vector((-1.2, -0.1, 2.75)), Vector((0.4, -0.5, -0.75)).normalized(), "af_bulb_warm")
    AD.foco(B, at + Vector((1.2, -0.1, 2.75)), Vector((-0.4, -0.5, -0.75)).normalized(), "af_neon")


GLYPHS = {
    "A": [".#.", "#.#", "###", "#.#", "#.#"],
    "F": ["###", "#..", "##.", "#..", "#.."],
    "T": ["###", ".#.", ".#.", ".#.", ".#."],
    "E": ["###", "#..", "##.", "#..", "###"],
    "R": ["##.", "#.#", "##.", "#.#", "#.#"],
}


def letras(B, M, s, text="AFTER", role="af_neon"):
    """Letras en bloques de neón (pocos triángulos), en el plano XZ del marco M, mirando a -Y."""
    cell = s / 2.5
    width = len(text) * 4 * cell - cell
    for li, ch in enumerate(text):
        for r, row in enumerate(GLYPHS[ch]):
            c = 0
            while c < 3:
                if row[c] != "#":
                    c += 1
                    continue
                c0 = c
                while c < 3 and row[c] == "#":
                    c += 1
                x = -width / 2 + (li * 4 + (c0 + c) / 2) * cell
                z = (2 - r) * cell
                AD.caja(B, role, ((c - c0) * cell * 0.5, 0.02, cell * 0.5), M @ Matrix.Translation((x, -0.02, z)))


BULBS = ("af_bulb_warm", "af_neon", "af_neon_cyan", "af_bulb_green")


def guirnalda(B, a, b, sag, n, start):
    """Guirnalda de bombillas de a a b: el cable con comba y `n` bombillas de colores por turnos."""
    pts = []
    for i in range(9):
        t = i / 8
        pts.append(a.lerp(b, t) - UP * sag * math.sin(math.pi * t))
    B.tube("ink", pts, 0.012, segs=3)
    for i in range(n):
        t = (i + 0.5) / n
        p = a.lerp(b, t) - UP * (sag * math.sin(math.pi * t) + 0.07)
        B.blob(BULBS[(start + i) % len(BULBS)], (0.06, 0.06, 0.08), p, segs=5, rings=3)


def lata(B, at, rng, role):
    """Una lata tirada en la arena, de lado."""
    yaw = rng.uniform(0, 360)
    m = Matrix.Translation(at + UP * 0.055) @ Matrix.Rotation(math.radians(yaw), 4, "Z") @ Matrix.Rotation(
        math.pi / 2, 4, "X")
    B.lathe(role, [(0.0, -0.09), (0.05, -0.09), (0.055, 0.08), (0.0, 0.09)], (0, 0, 0), segs=8, extra=m)


def flamenco_pinchado(B, at):
    """El flamenco hinchable, pinchado: el aro desinflado y el cuello caído en la arena."""
    ring = Matrix.Translation(at + UP * 0.06) @ Matrix.Diagonal((1.1, 1.0, 0.45, 1.0))
    B.torus("af_flamingo", 0.48, 0.15, ring, nu=16, nv=6)
    neck = [at + Vector((0.5, 0.0, 0.1)), at + Vector((0.75, 0.05, 0.2)), at + Vector((1.0, 0.12, 0.08)),
            at + Vector((1.15, 0.15, 0.04))]
    B.tube("af_flamingo", neck, [0.08, 0.07, 0.06, 0.05], segs=6)
    head = neck[-1] + Vector((0.08, 0.02, 0.0))
    B.blob("af_flamingo", (0.09, 0.07, 0.06), head, segs=8, rings=4)
    B.tube("af_flamingo_dark", [head + Vector((0.07, 0.0, 0.0)), head + Vector((0.2, 0.0, -0.03))], [0.035, 0.015],
           segs=5)


def gafas_perdidas(B, at):
    """Unas gafas de sol grandes olvidadas en la arena."""
    for sx in (-1, 1):
        B.blob("af_shades", (0.16, 0.12, 0.025), at + Vector((sx * 0.18, 0.0, 0.0)), 2.6, 2.6, segs=10, rings=4)
    B.tube("af_shades", [at + Vector((-0.05, 0.0, 0.02)), at + Vector((0.05, 0.0, 0.02))], 0.015, segs=4)
    for sx in (-1, 1):
        B.tube("af_shades", [at + Vector((sx * 0.33, 0.0, 0.0)), at + Vector((sx * 0.38, 0.45, 0.02))], 0.014, segs=4)


def boia_dormida(B, K, base, k, rng):
    """Una boia dormida en la arena, con las gafas de sol puestas y una burbuja de «zzz» (tres bolitas)."""
    before = {o.name for o in bpy.data.objects}
    D = MASC.mdir(K.g_toward(Matrix.Rotation(math.radians(-50), 3, "Z") @ K.FRONT))
    Rt = UP.cross(D).normalized()
    a = c = 0.40 * k
    body = MASC.Body(base + UP * (0.36 * k), a, c, D, Rt)
    shell = [B.blob("mascota", (a, a, c), body.C, 2.0, 2.0, segs=48, rings=24)]
    eye, MASC.eye = MASC.eye, lambda *a, **kw: None
    try:
        MASC.face(B, body, k, "sonrisa")
    finally:
        MASC.eye = eye
    AD.gafas_sol(B, body, k)
    MASC.cap(B, body, k, parts=shell)
    MASC.ring_float(B, body, base, k, "white", "mascota_gorro", parts=shell)
    MASC.outline_parts(B, shell, k)
    # Tumbada de lado: todo gira sobre la base alrededor de la mirada (la cara sigue hacia D), apoyada en el aro.
    r3 = Matrix.Rotation(math.radians(78), 3, D)
    rot = Matrix.Translation(base) @ r3.to_4x4() @ Matrix.Translation(-base)
    for o in bpy.data.objects:
        if o.type == "MESH" and o.name not in before:
            o.data.transform(rot)
    top = r3 @ UP
    for i in range(3):
        p = base + top * (0.78 * k + i * 0.16 * k) + UP * (0.12 * k + i * 0.1 * k) + D * 0.1 * k
        B.blob("white", (0.035 + i * 0.012, 0.035 + i * 0.012, 0.03 + i * 0.01), p, segs=6, rings=4)

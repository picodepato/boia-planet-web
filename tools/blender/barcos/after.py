"""El barco del after (plan 029, T273): el premio de la isla del after. MUESTRA.

Un barquito de fiesta hecho polvo, de vuelta de un after: casco morado con
arañazos y abolladuras, una cabina torcida con las ventanas de neón, tiras de
neón rosa por la borda, un mástil con la bola de discoteca y una guirnalda de
bombillas hasta la proa, un altavoz reventado en la popa (el cono rajado y
colgando), latas por la cubierta, unas gafas de sol enormes en la proa, un
flamenco hinchable pinchado colgando por babor y una bandera que ya no puede
más. Todo de marca y amable (latas de refresco, nada más).

Contrato de los barcos especiales (export_barcos_glb.py, ESPECIALES):
    ID, LABEL, DOC        id del estilo (el `assetKey` del cosmético), nombre y una frase para el manifiesto
    SLOT                  (x, y) de Blender donde va la pasajera en cubierta
    DETAIL                segmentos por pieza respecto a los mundos (0..1]
    ROLES, GLOW           papeles nuevos: {rol: "#hex"} planos y emisivos
    build(B, K) -> dict   construye con el Builder B (K = islas/comun.py);
                          devuelve {"length": eslora, "height": alto total}
Proa a +X y flotación en z = 0 (como los demás barcos); unidades de la
escena de /mar (el barco mide ~3,9 de eslora; /mar lo reescala a SHIP_LENGTH).
El GLB servido pesa ≤ 300 KB (plan 029): pocas piezas y DETAIL bajo.
"""
import math
import random

import bmesh
from mathutils import Matrix, Vector

ID = "after"
LABEL = "Barco del after"
DOC = ("barquito de fiesta hecho polvo: casco morado con arañazos, cabina torcida con ventanas de neón, tiras de "
       "neón rosa, mástil con bola de discoteca y guirnalda de bombillas, altavoz reventado en la popa, latas por "
       "la cubierta, gafas de sol enormes en la proa, flamenco pinchado colgando y una bandera cansada")
SLOT = (0.55, -0.32)       # la pasajera, a estribor de la cabina
DETAIL = 0.4
UP = Vector((0.0, 0.0, 1.0))

ROLES = {
    "ab_hull": "#5B3D7A",          # casco morado
    "ab_hull_dark": "#3A2650",     # arañazos y la obra viva
    "ab_deck": "#A98A62",          # cubierta de tablas
    "ab_cabin": "#2B2638",         # la cabina
    "ab_roof": "#4A4260",
    "ab_rub": "#1E1A28",           # el cintón de goma
    "ab_pole": "#8E929E",          # mástil y herrajes
    "ab_mirror": "#D7DEEA",        # la bola de discoteca
    "ab_cab": "#232330",           # la caja del altavoz
    "ab_cone": "#101016",
    "ab_can": "#D64545",
    "ab_can_b": "#3F7BD9",
    "ab_shades": "#1E1E28",
    "ab_flamingo": "#F48FB1",
    "ab_flamingo_dark": "#E0609A",
    "ab_flag": "#C9B99A",          # la bandera, descolorida
}
GLOW = {
    "ab_neon": "#FF4FB0",
    "ab_neon_cyan": "#4FE6FF",
    "ab_bulb_warm": "#FFC04A",
    "ab_bulb_green": "#4BFF7A",
}

L = 3.9                    # eslora
W = 0.72                   # semimanga
DECK_Z = 0.52              # altura de la cubierta


def build(B, K):
    rng = random.Random(425)
    casco(B, rng)
    cubierta(B)
    cabina(B)
    neon(B)
    top = mastil(B)
    altavoz_reventado(B, Vector((-1.3, -0.22, DECK_Z)))
    for i, (x, y) in enumerate(((0.95, 0.35), (0.3, 0.52), (-0.75, -0.5), (-1.55, 0.45), (0.1, -0.55))):
        lata(B, Vector((x, y, DECK_Z)), rng, "ab_can" if i % 2 else "ab_can_b")
    gafas(B, Vector((1.74, 0.0, 0.4)))
    flamenco(B, Vector((-0.2, -(W + 0.02), 0.3)))
    bandera(B, Vector((-1.78, 0.0, DECK_Z)))
    return {"length": L, "height": top}


def caja(B, role, size, M):
    """Caja de aristas vivas (12 triángulos) de semiejes size en el marco M."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=2.0)
    bmesh.ops.transform(bm, verts=bm.verts[:], matrix=M @ Matrix.Diagonal((size[0], size[1], size[2], 1.0)))
    return B.mk(bm, role, sharp=30)


def _M(at, yaw=0.0, pitch=0.0, roll=0.0):
    return (Matrix.Translation(Vector(at)) @ Matrix.Rotation(math.radians(yaw), 4, "Z")
            @ Matrix.Rotation(math.radians(pitch), 4, "Y") @ Matrix.Rotation(math.radians(roll), 4, "X"))


# --- Casco y cubierta -----------------------------------------------------------------------------------
def casco(B, rng):
    """Casco rechoncho de proa redonda: un superelipsoide achatado, la obra viva más oscura y el cintón."""
    B.blob("ab_hull", (L / 2, W, 0.47), Vector((0.0, 0.0, 0.08)), 2.6, 2.4, segs=28, rings=10)
    B.blob("ab_hull_dark", (L / 2 * 0.99, W * 0.99, 0.42), Vector((0.0, 0.0, -0.14)), 2.6, 2.4, segs=24, rings=8)
    # El cintón de goma por la borda, con una abolladura (un punto hundido).
    ring = []
    n = 22
    for i in range(n):
        th = 2 * math.pi * i / n
        rx, ry = (L / 2) * 1.0, W * 1.03
        px, py = rx * math.copysign(abs(math.cos(th)) ** 0.75, math.cos(th)), ry * math.copysign(abs(math.sin(th)) ** 0.75, math.sin(th))
        dent = 0.9 if 7 <= i <= 8 else 1.0
        ring.append(Vector((px * dent, py * dent, DECK_Z + 0.02)))
    B.tube("ab_rub", ring, 0.05, segs=5, closed=True)
    # Arañazos: tiras finas y oscuras en el costado, torcidas.
    for x, s, ang, ln in ((0.9, -1, 20, 0.5), (-0.4, -1, -15, 0.7), (0.2, 1, 30, 0.45), (-1.1, 1, -25, 0.6)):
        y = s * (W * 0.98)
        caja(B, "ab_hull_dark", (ln / 2, 0.012, 0.018), _M((x, y, 0.3), 0.0, ang))
    # Una abolladura: un bollo hundido en el costado de estribor.
    B.blob("ab_hull_dark", (0.22, 0.05, 0.14), Vector((0.55, -W * 0.93, 0.25)), 2.0, 2.0, segs=10, rings=5)


def cubierta(B):
    """Cubierta de tablas (una caja por tabla, pocas) y el trancanil."""
    for i in range(7):
        y = -W * 0.8 + i * (W * 1.6 / 6)
        caja(B, "ab_deck", (L / 2 * 0.86, W * 0.11, 0.02), _M((0.0, y, DECK_Z)))
    caja(B, "ab_hull_dark", (L / 2 * 0.9, W * 0.95, 0.012), _M((0.0, 0.0, DECK_Z - 0.03)))


def cabina(B):
    """La cabina, un poco torcida (se apoya mal), con las ventanas de neón y el techo abollado."""
    M = _M((-0.35, 0.0, DECK_Z + 0.36), 4.0, 0.0, 3.0)
    caja(B, "ab_cabin", (0.5, 0.46, 0.36), M)
    caja(B, "ab_roof", (0.58, 0.54, 0.04), M @ Matrix.Translation((0.0, 0.0, 0.4)) @ Matrix.Rotation(math.radians(-4), 4, "Y"))
    # Ventanas: una tira de neón cian al frente y dos ojos de buey a los lados.
    caja(B, "ab_neon_cyan", (0.012, 0.34, 0.1), M @ Matrix.Translation((0.51, 0.0, 0.06)))
    for sy in (-1, 1):
        caja(B, "ab_neon_cyan", (0.18, 0.012, 0.1), M @ Matrix.Translation((0.08, sy * 0.47, 0.06)))
    # La puerta de popa, entreabierta.
    caja(B, "ab_hull_dark", (0.012, 0.16, 0.28), M @ Matrix.Translation((-0.5, 0.1, -0.06)) @ Matrix.Rotation(math.radians(25), 4, "Z"))


def neon(B):
    """Tiras de neón rosa por la borda, de proa a popa, y una por el techo."""
    for sy in (-1, 1):
        pts = [Vector((x, sy * (W * 1.0 + 0.02) * (1.0 - 0.35 * (x / (L / 2)) ** 4), DECK_Z - 0.08))
               for x in (-1.6, -0.9, -0.2, 0.5, 1.1, 1.55)]
        B.tube("ab_neon", pts, 0.022, segs=4)
    B.tube("ab_neon", [Vector((-0.9, -0.5, DECK_Z + 0.8)), Vector((-0.9, 0.5, DECK_Z + 0.8))], 0.02, segs=4)


# --- Mástil, bola y guirnalda ---------------------------------------------------------------------------
BULBS = ("ab_bulb_warm", "ab_neon", "ab_neon_cyan", "ab_bulb_green")


def mastil(B):
    """Mástil torcido a popa con la bola de discoteca en lo alto y la guirnalda hasta la proa. Devuelve el tope."""
    foot = Vector((-1.05, 0.0, DECK_Z))
    top = foot + Vector((-0.12, 0.05, 1.75))
    B.tube("ab_pole", [foot - UP * 0.1, top], [0.045, 0.03], segs=6)
    # La bola de discoteca: una esfera de caras planas colgada de un gancho.
    c = top + Vector((0.0, 0.0, 0.28))
    bm = bmesh.new()
    B.G.superquadric(bm, (0.2, 0.2, 0.2), 2.0, 2.0, matrix=Matrix.Translation(c), segs=12, rings=7)
    B.mk(bm, "ab_mirror", sharp=0, smooth=False)
    B.tube("ab_pole", [top, c - UP * 0.17], 0.015, segs=4)
    # La guirnalda: del mástil a la proa, con comba y bombillas de colores; otra corta a popa.
    guirnalda(B, top - UP * 0.1, Vector((1.7, 0.0, DECK_Z + 0.25)), 0.45, 9, 0)
    guirnalda(B, top - UP * 0.1, Vector((-1.85, 0.0, DECK_Z + 0.2)), 0.2, 4, 2)
    return c.z + 0.2


def guirnalda(B, a, b, sag, n, start):
    pts = []
    for i in range(9):
        t = i / 8
        pts.append(a.lerp(b, t) - UP * sag * math.sin(math.pi * t))
    B.tube("ab_rub", pts, 0.01, segs=3)
    for i in range(n):
        t = (i + 0.5) / n
        p = a.lerp(b, t) - UP * (sag * math.sin(math.pi * t) + 0.06)
        B.blob(BULBS[(start + i) % len(BULBS)], (0.05, 0.05, 0.065), p, segs=5, rings=3)


# --- Lo que hay por la cubierta ---------------------------------------------------------------------------
def altavoz_reventado(B, at):
    """Un altavoz grande en la popa, con el cono rajado y un trozo colgando; la caja, algo ladeada."""
    # El frente del altavoz (su +X local) mira a estribor (-Y): se ve desde la cámara de la tienda.
    M = _M(at + UP * 0.3, -78.0, 0.0, 6.0)
    caja(B, "ab_cab", (0.3, 0.34, 0.3), M)
    front = M @ Matrix.Translation((0.31, 0.0, 0.0)) @ Matrix.Rotation(math.pi / 2, 4, "Y")   # +Z local hacia +X
    B.lathe("ab_pole", [(0.2, 0.0), (0.24, 0.03), (0.26, 0.0)], (0, 0, 0), segs=12, extra=front)
    B.lathe("ab_cone", [(0.0, -0.08), (0.06, -0.06), (0.21, 0.0)], (0, 0, 0), segs=12, extra=front)
    # La raja: un trozo del cono colgando hacia abajo, y un par de cables sueltos.
    caja(B, "ab_cone", (0.012, 0.07, 0.12), M @ Matrix.Translation((0.33, -0.05, -0.2)) @ Matrix.Rotation(math.radians(20), 4, "X"))
    B.tube("ab_can", [M @ Vector((0.0, -0.36, -0.2)), M @ Vector((0.08, -0.5, -0.32)), M @ Vector((0.05, -0.58, -0.3))], 0.008, segs=3)
    B.tube("ab_neon_cyan", [M @ Vector((-0.1, -0.36, -0.1)), M @ Vector((-0.06, -0.48, -0.24))], 0.008, segs=3)


def lata(B, at, rng, role):
    yaw = rng.uniform(0, 360)
    m = Matrix.Translation(at + UP * 0.05) @ Matrix.Rotation(math.radians(yaw), 4, "Z") @ Matrix.Rotation(
        math.pi / 2, 4, "X")
    B.lathe(role, [(0.0, -0.08), (0.045, -0.08), (0.05, 0.07), (0.0, 0.08)], (0, 0, 0), segs=7, extra=m)


def gafas(B, at):
    """Unas gafas de sol enormes puestas en la proa, como si el barco las llevara."""
    for sy in (-1, 1):
        m = Matrix.Translation(at + Vector((0.0, sy * 0.27, 0.0))) @ Matrix.Rotation(math.radians(78), 4, "Y")
        B.blob("ab_shades", (0.2, 0.24, 0.035), (0, 0, 0), 2.6, 2.6, extra=m, segs=10, rings=4)
    B.tube("ab_shades", [at + Vector((0.0, -0.05, 0.12)), at + Vector((0.0, 0.05, 0.12))], 0.018, segs=4)
    for sy in (-1, 1):
        B.tube("ab_shades", [at + Vector((-0.06, sy * 0.5, 0.14)), at + Vector((-0.7, sy * 0.72, 0.2))], 0.016, segs=4)


def flamenco(B, at):
    """El flamenco hinchable pinchado, colgando por babor con el cuello caído hasta el agua."""
    ring = Matrix.Translation(at) @ Matrix.Rotation(math.radians(-75), 4, "X") @ Matrix.Diagonal((1.0, 1.0, 0.45, 1.0))
    B.torus("ab_flamingo", 0.3, 0.1, ring, nu=14, nv=6)
    neck = [at + Vector((0.25, -0.08, -0.05)), at + Vector((0.4, -0.14, -0.18)), at + Vector((0.5, -0.16, -0.26))]
    B.tube("ab_flamingo", neck, [0.06, 0.05, 0.04], segs=6)
    head = neck[-1] + Vector((0.06, 0.02, -0.01))
    B.blob("ab_flamingo", (0.07, 0.055, 0.05), head, segs=8, rings=4)
    B.tube("ab_flamingo_dark", [head + Vector((0.05, 0.0, 0.0)), head + Vector((0.15, 0.0, -0.03))], [0.03, 0.012], segs=5)


def bandera(B, at):
    """Un palo corto en la popa con una bandera caída, descolorida."""
    top = at + UP * 0.7
    B.tube("ab_pole", [at, top], 0.02, segs=5)
    bm = bmesh.new()
    pts = [top - UP * 0.02, top - Vector((0.28, 0.0, 0.12)), top - Vector((0.34, 0.03, 0.35)), top - Vector((0.08, 0.0, 0.32))]
    v = [bm.verts.new(p) for p in pts]
    bm.faces.new(v)
    w = [bm.verts.new(p + Vector((0.0, 0.012, 0.0))) for p in pts]
    bm.faces.new(w[::-1])
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    B.mk(bm, "ab_flag", sharp=20, smooth=False)

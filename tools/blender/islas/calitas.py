"""Las Calitas (plan 020, T232): la isla de los comentarios. MUESTRA.

La isla del lugar `calitas` del mapa (plan 019 T222, decisión 16), donde la
gente escribe, responde y vota. Una cala pequeña de la costa de Alicante: un
peñón de roca ocre en media luna por detrás que abraza una playa de arena
abierta al frente (hacia el puerto y la cámara de /mar), con matorral y pinos
en lo alto de las rocas. En medio de la playa, lo que da sentido al lugar: el
tablón de los comentarios lleno de notas de colores, con un bocadillo de
cómic encima que brilla de noche. Dos sombrillas con sus toallas, el muelle
de tablas, una boia de BOIA en la arena hablando junto al tablón y otra en el
agua.

Es la versión de Blender de la composición a mano de `islands.ts`
(`calitas()`): misma idea (peñón al norte, playa al sur, tablón y bocadillo,
dos sombrillas, muelle), así que de lejos y de cerca cuadra.

Medidas en unidades de escena del mar 3D (la isla de /mar escala por RADIUS).
"""
import math
import random

from mathutils import Matrix, Vector

import mascota as MASC

ID = "calitas"           # el id del lugar del mapa: la isla de los comentarios
LABEL = "Las Calitas"
DOC = ("cala pequeña con un peñón de roca ocre en media luna que abraza una playa de arena, matorral y pinos en lo "
       "alto; en la playa el tablón de los comentarios con notas de colores y un bocadillo de cómic que brilla de "
       "noche, dos sombrillas con toallas, muelle, una boia de BOIA hablando junto al tablón y otra en el agua")
RADIUS = 7.0            # orilla de la isla en z = 0, en unidades del modelo
DETAIL = 0.5            # segmentos de cada pieza respecto a los de los mundos (comun.ligero)

H = 0.6                 # alto de la playa en el centro (cúpula de arena)
# El peñón: bloques de roca en media luna por detrás (+Y), (ángulo en grados, distancia, semiejes x/y/z).
# 90 grados es el fondo; los extremos bajan hacia el frente y cierran la cala por los lados.
CLIFFS = [
    (198, 5.4, 1.15, 0.95, 1.05), (172, 5.0, 1.45, 1.2, 1.55), (142, 4.7, 1.6, 1.3, 1.95), (112, 4.6, 1.7, 1.35, 2.3),
    (85, 4.7, 1.75, 1.35, 2.45), (58, 4.7, 1.6, 1.3, 2.05), (32, 4.9, 1.45, 1.2, 1.6), (6, 5.3, 1.2, 1.0, 1.15),
    (-16, 5.7, 0.95, 0.8, 0.85),
]
BOARD_C = Vector((0.0, -0.4, 0.0))     # el tablón de los comentarios, en medio de la playa
BOARD_W, BOARD_H = 3.2, 1.9           # la tabla (ancho y alto)
POST_H = 3.1                          # alto de los postes
BUBBLE_Z = 5.0                        # centro del bocadillo de cómic, encima del tablón

# Papeles nuevos de esta isla (color plano en el glTF); los demás son los del tema de arcilla.
ROLES = {
    "lc_rock": "#C98A55",          # la roca ocre de las calas de Alicante
    "lc_rock_dark": "#9C6440",     # sus sombras y cantos
    "lc_sand": "#EBD3A0",          # la playa
    "lc_scrub": "#8E9C52",         # matorral en lo alto del peñón
    "lc_scrub_dark": "#5F7A3C",    # matas
    "lc_pine": "#3E6B3A",          # pinos
    "lc_board": "#B07A48",         # la tabla del tablón
    "lc_note_a": "#FFD23F",        # las notas: amarilla, rosa, blanca, naranja y azul
    "lc_note_b": "#F28BB8",
    "lc_note_c": "#FFF7EC",
    "lc_note_d": "#F26A1B",
    "lc_note_e": "#8FD3F4",
    "lc_dots": "#5B3FA0",          # los puntos suspensivos del bocadillo
    "lc_umbrella_a": "#F26A1B",
    "lc_umbrella_b": "#8E3FB0",
    "lc_towel_a": "#FFD23F",
    "lc_towel_b": "#F28BB8",
}
# Papeles que brillan (emisivos): el bocadillo de cómic.
GLOW = {
    "lc_bubble": "#FFF4DC",
}
NOTES = ["lc_note_a", "lc_note_b", "lc_note_c", "lc_note_d", "lc_note_e", "lc_note_a", "lc_note_c", "lc_note_b"]


def build(B, K):
    """Construye la isla con el Builder B; K es el módulo comun."""
    rng = random.Random(2232)
    R = RADIUS
    K.terreno(B, "lc_sand", R * 1.0, H, segs=40, rings=12, noise=K.shore_noise(2))
    K.terreno(B, "lc_sand", R * 1.12, 0.22, sink=0.8, q=2.0, segs=32, rings=6, noise=K.shore_noise(5))

    # --- El peñón en media luna, con matorral y pinos encima --------------------------------------------------------
    for i, (ang, r, sx, sy, sz) in enumerate(CLIFFS):
        c = K.polar(r, ang)
        z0 = _ground(c)
        rot = Matrix.Rotation(math.radians(ang + 90), 4, "Z")
        B.blob("lc_rock" if i % 3 else "lc_rock_dark", (sx, sy, sz), Vector((c.x, c.y, z0 - 0.15)), 2.6, 2.2,
               extra=rot, segs=20, rings=10)
        top = z0 - 0.15 + sz
        if sz > 1.2:
            B.blob("lc_scrub", (sx * 0.72, sy * 0.68, 0.22), Vector((c.x, c.y, top - 0.12)), 2.4, 2.0,
                   extra=rot, segs=16, rings=6)
        # Estratos: una losa más oscura a media altura del lado de la cala.
        inward = Vector((-c.x, -c.y, 0.0)).normalized()
        B.blob("lc_rock_dark", (sx * 0.8, 0.18, 0.12), Vector((c.x, c.y, z0)) + inward * sy * 0.82
               + Vector((0, 0, sz * 0.25)), 3.0, 2.0, extra=rot, segs=12, rings=4)
    # Pinos en lo alto del peñón.
    for ang, r, h in ((150, 4.9, 1.7), (118, 5.0, 2.0), (92, 5.3, 1.6), (64, 4.9, 1.9), (36, 5.2, 1.5), (170, 5.4, 1.3)):
        c = K.polar(r, ang)
        z = _top_of_cliffs(c)
        pino(B, Vector((c.x, c.y, z - 0.1)), h)
    for ang, r in ((130, 4.3), (100, 4.1), (75, 4.4), (45, 4.6), (160, 4.6)):
        c = K.polar(r, ang)
        s = rng.uniform(0.26, 0.36)
        B.blob("lc_scrub_dark", (s, s * 0.8, s * 0.55), Vector((c.x, c.y, _top_of_cliffs(c) - 0.02)), 2.0, 2.0,
               extra=Matrix.Rotation(rng.random() * math.pi, 4, "Z"), segs=10, rings=4)

    # Cantos de la orilla: rodean el peñón y las puntas de la cala; la playa del frente queda despejada.
    for i in range(12):
        ang = -30 + i * 21 + rng.uniform(-6, 6)
        r = R * rng.uniform(0.95, 1.06)
        K.roca(B, "lc_rock_dark" if i % 2 else "lc_rock", K.polar(r, ang, 0.1), rng.uniform(0.4, 0.7), rng)
    for ang in (-150, -40):
        K.roca(B, "lc_rock", K.polar(R * 1.02, ang, 0.1), 0.55, rng)

    # --- La playa: el tablón, el bocadillo, sombrillas y toallas ------------------------------------------------------
    tablon(B, K, rng)
    for x, y, canopy, towel, ang in ((-2.7, -3.4, "lc_umbrella_a", "lc_towel_a", 20),
                                     (2.6, -3.7, "lc_umbrella_b", "lc_towel_b", -25)):
        sombrilla(B, K, Vector((x, y, _ground(Vector((x, y, 0))))), canopy, towel, ang)

    # --- El muelle, a la derecha del frente; las boias -----------------------------------------------------------------
    K.muelle(B, Vector((3.4, -R * 0.88, 0.0)), 2.4, width=1.0)
    # Una boia en la arena, junto al tablón, hablando (es la isla de los comentarios), y otra en el agua.
    p = Vector((-1.75, -1.9, 0.0))
    boia(B, K, Vector((p.x, p.y, _ground(p) + 0.08)), 1.3, K.g_toward(Vector((0.35, -1.0, 0.0))), "habla")
    p = K.polar(R * 1.2, -118)
    look = (p.normalized() * 0.5 + K.FRONT).normalized()
    boia(B, K, p, 1.4, K.g_toward(look), "sonrisa")
    return {"top": H, "height": BUBBLE_Z + 0.95}


# --- Terreno ---------------------------------------------------------------------------------------------------
def _ground(p):
    """Alto aproximado de la arena en el punto p (la cúpula de comun.terreno)."""
    d = math.hypot(p.x, p.y)
    return (H + 0.6) * max(0.0, 1.0 - min(1.0, d / RADIUS) ** 2.4) ** (1 / 2.4) - 0.6


def _top_of_cliffs(p):
    """Alto de lo alto del peñón sobre p: el bloque de CLIFFS más alto que lo cubre (o la arena)."""
    best = _ground(p)
    for ang, r, sx, sy, sz in CLIFFS:
        c = K_polar(r, ang)
        rot = math.radians(ang + 90)
        dx, dy = p.x - c.x, p.y - c.y
        u = dx * math.cos(rot) + dy * math.sin(rot)
        v = -dx * math.sin(rot) + dy * math.cos(rot)
        q = (abs(u / sx) ** 2.6 + abs(v / sy) ** 2.6)
        if q < 1.0:
            z = _ground(c) - 0.15 + sz * (1.0 - q) ** (1 / 2.2)
            best = max(best, z)
    return best


def K_polar(r, ang):
    a = math.radians(ang)
    return Vector((r * math.cos(a), r * math.sin(a), 0.0))


# --- Piezas ---------------------------------------------------------------------------------------------------
def pino(B, base, h):
    """Pino mediterráneo: tronco algo inclinado y dos pisos de copa."""
    B.tube("trunk", [base, base + Vector((0.06 * h, 0.0, 0.45 * h))], [0.07 * h, 0.05 * h], segs=6)
    for z0, z1, r in ((0.32, 0.7, 0.42), (0.56, 1.0, 0.3)):
        B.lathe("lc_pine", [(0.0, z0 * h), (r * h, z0 * h + 0.02), (0.0, z1 * h)], tuple(base), segs=8)


def tablon(B, K, rng):
    """El tablón de los comentarios: dos postes, la tabla con su tejadillo, notas de colores y el bocadillo."""
    c = BOARD_C
    z = _ground(c)
    front = K.FRONT
    for s in (-1, 1):
        x = c.x + s * (BOARD_W * 0.5 + 0.05)
        B.tube("wood_dark", [Vector((x, c.y, z - 0.3)), Vector((x, c.y, z + POST_H))], 0.1, segs=6)
    mid = z + POST_H - 0.25 - BOARD_H * 0.5
    K.caja(B, "lc_board", (BOARD_W * 0.5, 0.07, BOARD_H * 0.5), Vector((c.x, c.y, mid)))
    # Marco y tejadillo.
    K.caja(B, "wood_dark", (BOARD_W * 0.5 + 0.12, 0.1, 0.06), Vector((c.x, c.y, mid + BOARD_H * 0.5 + 0.04)))
    K.caja(B, "wood_dark", (BOARD_W * 0.5 + 0.12, 0.1, 0.06), Vector((c.x, c.y, mid - BOARD_H * 0.5 - 0.04)))
    K.caja(B, "roof_tile", (BOARD_W * 0.5 + 0.3, 0.32, 0.05), Vector((c.x, c.y - 0.02, z + POST_H + 0.08)))
    # Las notas: 4 × 2, algo torcidas, pegadas a la cara del frente.
    for i, role in enumerate(NOTES):
        col, row = i % 4, i // 4
        x = c.x - BOARD_W * 0.36 + col * BOARD_W * 0.24 + rng.uniform(-0.05, 0.05)
        zz = mid + 0.42 - row * 0.82 + rng.uniform(-0.05, 0.05)
        at = Vector((x, c.y, zz)) + front * 0.085
        m = Matrix.Translation(at) @ Matrix.Rotation(rng.uniform(-0.2, 0.2), 4, "Y")
        B.blob(role, (0.29, 0.015, 0.27), (0, 0, 0), 8.0, 8.0, extra=m, segs=8, rings=4)
        # Las líneas escritas de cada nota y su chincheta.
        for li in range(3):
            B.blob("ink", (0.18 - 0.04 * (li == 2), 0.008, 0.015), (0, 0, 0), 6.0, 6.0,
                   extra=m @ Matrix.Translation((-0.03 * (li == 2), -0.02, 0.08 - li * 0.09)), segs=8, rings=4)
        B.blob("red", (0.04, 0.03, 0.04), (0, 0, 0), extra=m @ Matrix.Translation((0, -0.03, 0.22)), segs=8, rings=4)
    # El bocadillo de cómic encima: brilla de noche; tres puntos suspensivos y la colita hacia el tablón.
    bc = Vector((c.x + 0.45, c.y, z + BUBBLE_Z))
    m = MASC.facing(front, bc)
    B.blob("lc_bubble", (1.25, 0.8, 0.22), (0, 0, 0), 2.3, 2.0, extra=m, segs=32, rings=12)
    B.blob("ink", (1.31, 0.86, 0.17), (0, 0, 0), 2.3, 2.0, extra=m @ Matrix.Translation((0, 0, -0.08)), segs=32,
           rings=8)
    tail = [m @ Vector((-0.45, -0.6, 0.0)), m @ Vector((-0.75, -1.05, 0.0)), m @ Vector((-0.9, -1.3, 0.0))]
    B.tube("lc_bubble", tail, [0.26, 0.13, 0.03], segs=8)
    for i in (-1, 0, 1):
        B.blob("lc_dots", (0.14, 0.14, 0.06), (0, 0, 0), extra=m @ Matrix.Translation((i * 0.42, 0.0, 0.22)),
               segs=12, rings=6)


def sombrilla(B, K, base, canopy, towel, ang):
    """Sombrilla de playa (mástil blanco y copa a gajos) con su toalla al lado."""
    top = base + Vector((0.12, 0.0, 2.05))
    B.tube("white", [base - Vector((0, 0, 0.2)), top], 0.05, segs=6)
    prof = [(0.0, 0.0), (1.15, -0.42), (1.12, -0.5), (0.0, -0.08)]
    B.lathe(canopy, prof, tuple(top + Vector((0, 0, 0.08))), segs=28)
    B.blob("white", (0.08, 0.08, 0.08), top + Vector((0, 0, 0.12)), segs=8, rings=4)
    rot = Matrix.Rotation(math.radians(ang), 4, "Z")
    at = base + (rot @ Vector((0.85, -0.35, 0.0))) + Vector((0, 0, 0.03))
    B.blob(towel, (0.42, 0.75, 0.025), (0, 0, 0), 8.0, 8.0, extra=Matrix.Translation(at) @ rot, segs=8, rings=4)
    B.blob("white", (0.42, 0.08, 0.03), (0, 0, 0), 8.0, 8.0,
           extra=Matrix.Translation(at + rot @ Vector((0, 0.45, 0.01))) @ rot, segs=8, rings=4)


def boia(B, K, base, k, g, mouth):
    """La mascota de BOIA (mascota.py) con su gorro y su aro, mirando hacia el ángulo g."""
    base = Vector(base)
    D = MASC.mdir(g)
    Rt = K.UP.cross(D).normalized()
    a = c = 0.40 * k
    body = MASC.Body(base + K.UP * (0.36 * k), a, c, D, Rt)
    shell = [B.blob("mascota", (a, a, c), body.C, 2.0, 2.0, segs=36, rings=18)]
    MASC.face(B, body, k, mouth)
    MASC.cap(B, body, k, parts=shell)
    MASC.ring_float(B, body, base, k, "white", "mascota_gorro", parts=shell)
    MASC.outline_parts(B, shell, k)        # el trazo negro del logo (T231)

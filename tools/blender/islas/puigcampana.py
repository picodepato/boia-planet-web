"""El Puig Campana (plan 019, T221): la montaña de Finestrat como isla del Cañón. MUESTRA.

La isla del lugar `canon` del mapa (el minijuego del Cañón), que hasta ahora
era Els Banyets (decisión 15 de la reunión del 2026-10-08). Una isla de
matorral mediterráneo con playa de arena y, en medio, el Puig Campana: la
montaña de caliza clara en pirámide empinada que se ve desde Benidorm, con
la muesca cuadrada de la Portà cortada en la cresta, a la derecha de la cima
(la leyenda: el mordisco que, de una patada, acabó siendo la Isla de
Benidorm), y el diente de roca que queda al otro lado. A sus pies, el pueblo
blanco de Finestrat sobre su peñón, con las ventanas encendidas de noche;
pinos, matas y peñascos por la falda. Al frente, lo que da nombre al lugar:
el cañón en su plataforma de piedra apuntando al mar, con su bandera y una
antorcha; el muelle de tablas y una boia de BOIA en el agua.

El módulo se llama como la montaña y su `ID` es el del lugar del mapa
(`canon`): el GLB sale como art/islas/3d/canon.glb, que es el que /mar pide.

Medidas en unidades de escena del mar 3D (la isla de /mar escala por RADIUS).
"""
import math
import random

import bmesh
from mathutils import Matrix, Vector

import mascota as MASC

ID = "canon"             # el id del lugar del mapa: la isla del minijuego del Cañón
LABEL = "Puig Campana"
DOC = ("la montaña de caliza del Puig Campana en pirámide empinada con la muesca de la Portà en la cresta, el pueblo "
       "blanco de Finestrat a sus pies con las ventanas encendidas de noche, pinos, el cañón del minijuego apuntando "
       "al mar con su bandera y antorcha, muelle y una boia de BOIA")
RADIUS = 7.0            # orilla de la isla en z = 0, en unidades del modelo
DETAIL = 0.5            # segmentos de cada pieza respecto a los de los mundos (comun.ligero)

H = 1.0                 # alto del terreno de matorral en el centro
BASE_Z = -0.6           # la base de la montaña, hundida bajo el terreno
# La planta de la montaña: centro algo atrás (el frente queda para el cañón), semieje en x y hacia el frente (sur)
# y hacia atrás (norte); la cara sur, la que mira a Benidorm y a la cámara de /mar, es la más empinada.
MOUNT_C = Vector((0.2, 0.7, 0.0))
MOUNT_A = 5.3
MOUNT_S, MOUNT_N = 3.9, 4.6
SUMMIT_H = 7.4
# La cresta vista desde el frente, de oeste a este: (x respecto al centro, alto). La cima a la izquierda del
# centro; a su derecha la Portà, la muesca cuadrada de paredes casi verticales, y pasada ella el diente.
RIDGE = [
    (-5.3, 0.1), (-4.3, 1.5), (-2.8, 3.9), (-1.2, 6.6), (-0.5, SUMMIT_H), (0.3, 6.95), (0.95, 6.4),
    (1.0, 6.35), (1.05, 5.15),             # pared oeste de la Portà
    (1.78, 5.15), (1.83, 5.85),            # pared este
    (2.2, 6.0), (2.75, 5.0), (3.6, 3.2), (4.6, 1.3), (5.3, 0.1),
]
NOTCH = (0.95, 1.83)    # tramo de la cresta sin ruido: las paredes de la muesca quedan limpias
SLOPE_P = 1.12          # perfil de las laderas: algo cóncavo (pirámide de verdad, no tienda)

# Papeles nuevos de esta isla (color plano en el glTF); los demás son los del tema de arcilla.
ROLES = {
    "pc_rock": "#B9AE98",          # la caliza clara de la montaña
    "pc_rock_dark": "#8A8273",     # peñascos, el peñón del pueblo
    "pc_scrub": "#8E9C52",         # matorral de la falda
    "pc_scrub_dark": "#5F7A3C",    # matas
    "pc_sand": "#E6D3A6",          # la playa
    "pc_pine": "#3E6B3A",          # pinos
}
# Papeles que brillan (emisivos): las ventanas de Finestrat y la llama de la antorcha.
GLOW = {
    "pc_window": "#FFD98A",
    "pc_flame": "#FFB13B",
}

# El pueblo: casas cubo (dx, dy respecto al peñón; semiejes x, y, z; giro en grados).
VILLAGE_C = Vector((-3.1, -2.7, 0.0))
HOUSES = [
    (-0.55, 0.25, 0.30, 0.26, 0.26, 8), (0.05, 0.42, 0.26, 0.24, 0.32, -6), (0.62, 0.18, 0.28, 0.22, 0.24, 14),
    (-0.30, -0.35, 0.24, 0.22, 0.22, -12), (0.35, -0.38, 0.30, 0.24, 0.28, 4), (-0.85, -0.30, 0.20, 0.20, 0.20, 20),
]
CHURCH = (0.15, 0.0, 0.30, 0.42, 0.42, 0)   # la iglesia, en lo alto del peñón, con su torre
CANNON_C = Vector((0.9, -4.6, 0.0))         # la plataforma del cañón, al frente


def build(B, K):
    """Construye la isla con el Builder B; K es el módulo comun."""
    rng = random.Random(1406)
    R = RADIUS
    K.terreno(B, "pc_scrub", R * 1.02, H, segs=40, rings=12, noise=K.shore_noise(4))
    K.terreno(B, "pc_sand", R * 1.12, 0.25, sink=0.8, q=2.0, segs=32, rings=6, noise=K.shore_noise(6))
    # Cantos de la orilla (sin tapar el muelle del frente, a la izquierda).
    for i in range(11):
        ang = i * 360 / 11 + rng.uniform(-8, 8)
        if abs(((ang + 100 + 180) % 360) - 180) < 20:
            continue
        r = R * rng.uniform(0.93, 1.06)
        K.roca(B, "pc_rock_dark" if i % 2 else "pc_rock", K.polar(r, ang, 0.1), rng.uniform(0.4, 0.75), rng)

    # --- La montaña ---------------------------------------------------------------------------------------------
    montana(B)
    # Peñascos por la falda y el canchal bajo la Portà.
    for u, t, s in ((-3.6, -0.55, 0.5), (-2.0, -0.7, 0.42), (0.6, -0.72, 0.45), (2.9, -0.6, 0.5), (4.2, -0.5, 0.4),
                    (-3.0, 0.6, 0.48), (1.8, 0.66, 0.44), (3.9, 0.55, 0.42), (1.4, -0.42, 0.3), (1.5, -0.52, 0.26)):
        p = mount_point(u, t)
        K.roca(B, "pc_rock_dark", p - Vector((0, 0, 0.12 * s)), s, rng)
    # Matas en lo bajo de las laderas: la roca pelada queda arriba.
    for u, t in ((-4.4, -0.8), (-2.6, -0.86), (-0.4, -0.84), (2.0, -0.82), (3.8, -0.78), (-3.8, 0.84), (-1.0, 0.88),
                 (1.2, 0.86), (3.4, 0.82), (4.7, 0.7)):
        p = mount_point(u, t)
        s = 0.26 + 0.1 * rng.random()
        B.blob("pc_scrub_dark", (s, s * 0.8, s * 0.5), p + Vector((0, 0, 0.02)), 2.0, 2.0,
               extra=Matrix.Rotation(rng.random() * math.pi, 4, "Z"), segs=10, rings=4)

    # --- La falda: pinos y matas --------------------------------------------------------------------------------
    for ang, r, h in ((-152, 5.3, 1.7), (-128, 5.9, 1.4), (-18, 5.4, 1.8), (-45, 6.0, 1.3), (22, 5.7, 1.5),
                      (62, 5.9, 1.4), (118, 5.8, 1.6), (155, 5.6, 1.5), (90, 6.1, 1.2)):
        p = K.polar(r, ang)
        pino(B, Vector((p.x, p.y, _ground(p) - 0.08)), h)
    for i in range(14):
        ang = -170 + i * 26 + rng.uniform(-6, 6)
        p = K.polar(R * rng.uniform(0.78, 0.9), ang)
        if abs(((ang + 100 + 180) % 360) - 180) < 24:
            continue
        s = rng.uniform(0.22, 0.36)
        B.blob("pc_scrub_dark", (s, s * 0.8, s * 0.55), Vector((p.x, p.y, _ground(p) + s * 0.2)), 2.0, 2.0,
               extra=Matrix.Rotation(rng.random() * math.pi, 4, "Z"), segs=10, rings=4)

    # --- Finestrat: el pueblo blanco sobre su peñón ----------------------------------------------------------------
    finestrat(B, K)

    # --- Al frente: el cañón, su bandera y la antorcha; el muelle; la boia en el agua -------------------------------
    canon(B, K)
    K.muelle(B, Vector((-1.4, -R * 0.9, 0.0)), 2.6, width=1.1)
    p = K.polar(R * 1.22, -44)
    look = (p.normalized() * 0.6 + K.FRONT).normalized()
    boia(B, K, p, 1.45, K.g_toward(look))
    return {"top": H, "height": SUMMIT_H}


# --- Terreno -------------------------------------------------------------------------------------------------
def ridge_h(u):
    """Alto de la cresta en x = u (respecto al centro de la montaña), interpolando RIDGE."""
    if u <= RIDGE[0][0] or u >= RIDGE[-1][0]:
        return 0.0
    for (x0, h0), (x1, h1) in zip(RIDGE, RIDGE[1:]):
        if x0 <= u <= x1:
            return h0 if x1 <= x0 else h0 + (h1 - h0) * (u - x0) / (x1 - x0)
    return 0.0


def half_width(u, south):
    """Semiancho de la planta en x = u hacia el frente (south) o hacia atrás."""
    k = max(0.0, 1.0 - (u / MOUNT_A) ** 2) ** 0.5
    return max(0.35, (MOUNT_S if south else MOUNT_N) * k)


def slope(t):
    return (1.0 - min(1.0, abs(t))) ** SLOPE_P


def bump(u, t):
    """Lomas de las laderas: nada en la cresta, en la base ni en la Portà."""
    if NOTCH[0] <= u <= NOTCH[1]:
        return 0.0
    k = (1.0 - abs(t)) * abs(t) * 4.0 * (ridge_h(u) / SUMMIT_H)     # 0 en la cresta y en la base
    return k * (0.55 * math.sin(2.1 * u + 0.7) * math.sin(5.5 * t + 0.4 * u)
                + 0.35 * math.sin(4.6 * u + 1.9) * math.cos(3.1 * t)          # contrafuertes
                + 0.18 * math.sin(9.0 * u) * math.sin(8.0 * t))


def mount_z_at(u, t):
    return BASE_Z + (ridge_h(u) - BASE_Z) * slope(t) + bump(u, t)


def mount_point(u, t):
    """Punto de la ladera: u en x respecto al centro, t en [-1 (pie sur) … 0 (cresta) … 1 (pie norte)]."""
    y = MOUNT_C.y + (t * half_width(u, True) if t < 0 else t * half_width(u, False))
    return Vector((MOUNT_C.x + u, y, mount_z_at(u, t)))


def mount_z(p):
    """Alto de la montaña sobre el punto p, o -inf fuera de su planta."""
    u = p.x - MOUNT_C.x
    if abs(u) >= MOUNT_A:
        return -1e9
    dy = p.y - MOUNT_C.y
    t = dy / half_width(u, dy < 0)
    if abs(t) >= 1.0:
        return -1e9
    return mount_z_at(u, t)


def montana(B):
    """La montaña: una rejilla de alturas sobre la planta (cresta de RIDGE, laderas de slope) cerrada por abajo."""
    us = sorted({x for x, _ in RIDGE} | {-MOUNT_A + 2 * MOUNT_A * i / 26 for i in range(27)})
    walls = [(RIDGE[7][0], RIDGE[8][0]), (RIDGE[9][0], RIDGE[10][0])]
    us = [u for u in us if not any(a < u < b for a, b in walls)]
    ts = [-1.0 + 2.0 * j / 20 for j in range(21)]
    bm = bmesh.new()
    grid = [[bm.verts.new(mount_point(u, t)) for t in ts] for u in us]
    for i in range(len(us) - 1):
        for j in range(len(ts) - 1):
            bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
    # Tapa de abajo (bajo el terreno): la malla queda cerrada y sus normales, hacia fuera.
    bottom = bm.verts.new(Vector((MOUNT_C.x, MOUNT_C.y, BASE_Z - 0.3)))
    for e in [e for e in bm.edges if len(e.link_faces) == 1]:
        bm.faces.new((e.verts[0], e.verts[1], bottom))
    return B.mk(bm, "pc_rock", sharp=30)


def _ground(p):
    """Alto aproximado del suelo en el punto p: la cúpula de matorral (comun.terreno) o la montaña."""
    d = math.hypot(p.x, p.y)
    dome = (H + 0.6) * max(0.0, 1.0 - min(1.0, d / (RADIUS * 1.02)) ** 2.4) ** (1 / 2.4) - 0.6
    return max(dome, mount_z(p))


# --- Piezas -----------------------------------------------------------------------------------------------------
def pino(B, base, h):
    """Pino mediterráneo: tronco y dos pisos de copa."""
    B.tube("trunk", [base, base + Vector((0.04 * h, 0.0, 0.42 * h))], [0.07 * h, 0.05 * h], segs=6)
    for z0, z1, r in ((0.30, 0.68, 0.40), (0.55, 1.0, 0.28)):
        B.lathe("pc_pine", [(0.0, z0 * h), (r * h, z0 * h + 0.02), (0.0, z1 * h)], tuple(base), segs=8)


def casa(B, K, at, hx, hy, hz, ang, church=False):
    """Casa cubo encalada con tejado de teja y ventanas que se encienden de noche; la iglesia lleva torre."""
    K.caja(B, "whitewash", (hx, hy, hz), at + Vector((0, 0, hz)), ang)
    K.caja(B, "roof_tile", (hx * 1.08, hy * 1.08, 0.035), at + Vector((0, 0, 2 * hz + 0.02)), ang)
    rot = Matrix.Rotation(math.radians(ang), 4, "Z")
    front = rot @ Vector((0.0, -1.0, 0.0))
    for sx in (-0.45, 0.45):
        w = at + front * (hy + 0.012) + (rot @ Vector((sx * hx, 0.0, 0.0))) + Vector((0, 0, hz * 1.15))
        B.blob("pc_window", (0.045, 0.012, 0.06), (0, 0, 0), 6.0, 6.0,
               extra=Matrix.Translation(w) @ rot, segs=8, rings=4)
    B.blob("blue_door", (0.05, 0.012, 0.1), (0, 0, 0), 6.0, 6.0,
           extra=Matrix.Translation(at + front * (hy + 0.012) + Vector((0, 0, 0.1))) @ rot, segs=8, rings=4)
    if church:
        tower = at + (rot @ Vector((hx * 0.6, hy * 0.45, 0.0)))
        K.caja(B, "whitewash", (0.14, 0.14, hz * 1.9), tower + Vector((0, 0, hz * 1.9)), ang)
        K.caja(B, "roof_tile", (0.16, 0.16, 0.03), tower + Vector((0, 0, hz * 3.8 + 0.02)), ang)
        B.blob("pc_window", (0.05, 0.016, 0.08), (0, 0, 0), 6.0, 6.0,
               extra=Matrix.Translation(tower + front * 0.15 + Vector((0, 0, hz * 3.2))) @ rot, segs=8, rings=4)


def finestrat(B, K):
    """El pueblo blanco sobre su peñón de roca, al pie suroeste de la montaña."""
    z = _ground(VILLAGE_C)
    knoll = Vector((VILLAGE_C.x, VILLAGE_C.y, z - 0.2))
    B.blob("pc_rock_dark", (1.45, 1.1, 0.75), knoll, 2.0, 2.6, extra=Matrix.Rotation(0.25, 4, "Z"), segs=20, rings=8)
    top = knoll.z + 0.75
    for dx, dy, hx, hy, hz, ang in HOUSES:
        d = math.hypot(dx / 1.45, dy / 1.1)
        zz = knoll.z + 0.75 * max(0.0, 1.0 - min(1.0, d) ** 2.6) ** (1 / 2.6) - 0.04
        casa(B, K, Vector((VILLAGE_C.x + dx, VILLAGE_C.y + dy, zz)), hx, hy, hz, ang)
    dx, dy, hx, hy, hz, ang = CHURCH
    casa(B, K, Vector((VILLAGE_C.x + dx, VILLAGE_C.y + dy, top - 0.03)), hx, hy, hz, ang, church=True)


def canon(B, K):
    """El cañón del minijuego en su plataforma de piedra, apuntando al mar; la bandera y la antorcha."""
    z = _ground(CANNON_C)
    base = Vector((CANNON_C.x, CANNON_C.y, z - 0.02))
    K.caja(B, "stone", (1.05, 0.85, 0.12), base + Vector((0, 0, 0.1)), ang=-8)
    K.caja(B, "pc_rock_dark", (1.2, 1.0, 0.07), base + Vector((0, 0, 0.0)), ang=-8)
    deck = base.z + 0.22
    s = 1.4                                                             # el cañón, grande: es el nombre del lugar
    el = math.radians(16)
    D = Vector((-0.08, -math.cos(el), math.sin(el))).normalized()      # al mar (al frente), algo alzado
    piv = Vector((base.x, base.y + 0.1, deck + 0.4 * s))
    m = MASC.facing(D, piv)
    prof = [(0.0, -0.58), (0.21, -0.58), (0.23, -0.44), (0.18, -0.36), (0.16, 0.42), (0.19, 0.50), (0.15, 0.56),
            (0.10, 0.56), (0.0, 0.50)]
    B.lathe("iron", [(r * s, z * s) for r, z in prof], (0, 0, 0), segs=16, extra=m)
    B.blob("iron", (0.11 * s, 0.11 * s, 0.11 * s), (0, 0, 0), extra=m @ Matrix.Translation((0, 0, -0.64 * s)),
           segs=10, rings=6)
    Rt = D.cross(K.UP).normalized()
    yaw = math.atan2(Rt.y, Rt.x)
    for side in (-1, 1):
        w = piv + Rt * side * 0.32 * s - Vector((0, 0, 0.14 * s))
        # Rueda con el eje a lo largo de Rt (la derecha del cañón).
        B.torus("wood_dark", 0.22 * s, 0.05 * s, Matrix.Translation(w) @ Matrix.Rotation(yaw, 4, "Z")
                @ Matrix.Rotation(math.pi / 2, 4, "Y"), nu=16, nv=6)
        for sp in range(4):
            a = sp * math.pi / 4
            B.tube("wood", [w + (Rt.cross(K.UP) * math.cos(a) + K.UP * math.sin(a)) * 0.2 * s,
                            w - (Rt.cross(K.UP) * math.cos(a) + K.UP * math.sin(a)) * 0.2 * s], 0.025 * s, segs=5)
    K.caja(B, "wood", (0.36 * s, 0.07 * s, 0.07 * s), piv - Vector((0, 0, 0.14 * s)), ang=math.degrees(yaw))
    for dx, dy, dz in ((0, 0, 0), (0.24, 0, 0), (0.12, 0.2, 0), (0.12, 0.07, 0.19)):
        B.blob("iron", (0.12, 0.12, 0.12), base + Vector((0.72 + dx, 0.38 + dy, deck + 0.12 + dz)), segs=10, rings=6)
    # La bandera, a la izquierda de la plataforma; la antorcha, a la derecha.
    pole = base + Vector((-0.95, 0.55, 0.0))
    B.tube("wood_dark", [pole, pole + Vector((0, 0, 2.3))], [0.045, 0.03], segs=6)
    B.blob("flag", (0.34, 0.03, 0.17), pole + Vector((0.36, 0.0, 2.08)), 1.5, 1.5, segs=10, rings=4)
    torch = base + Vector((1.15, -0.2, 0.0))
    B.tube("wood_dark", [torch, torch + Vector((0, 0, 1.15))], [0.05, 0.04], segs=6)
    B.blob("iron", (0.1, 0.1, 0.07), torch + Vector((0, 0, 1.15)), 3.0, 2.0, segs=8, rings=4)
    B.blob("pc_flame", (0.09, 0.09, 0.2), torch + Vector((0, 0, 1.38)), 2.0, 1.4, segs=8, rings=6)


def boia(B, K, base, k, g):
    """La mascota de BOIA (mascota.py) flotando en el agua, mirando hacia el ángulo g, con su gorro y su aro."""
    base = Vector(base)
    D = MASC.mdir(g)
    Rt = K.UP.cross(D).normalized()
    a = c = 0.40 * k
    body = MASC.Body(base + K.UP * (0.36 * k), a, c, D, Rt)
    shell = [B.blob("mascota", (a, a, c), body.C, 2.0, 2.0, segs=36, rings=18)]
    MASC.face(B, body, k, "sonrisa")
    MASC.cap(B, body, k, parts=shell)
    MASC.ring_float(B, body, base, k, "white", "mascota_gorro", parts=shell)
    MASC.outline_parts(B, shell, k)        # el trazo negro del logo (T231)

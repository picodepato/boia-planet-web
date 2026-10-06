"""El Faro de Tabarca (plan 014, T166): la isla del tablón, a la entrada del mundo. MUESTRA.

El lugar `faro` del mapa (Isla de Nueva Tabarca, Alicante), desde T157 en el
sitio del antiguo castillo junto a la salida. Una isla baja y llana de roca
rojiza con matorral seco, cantos en la orilla y un tramo de la muralla de
piedra por detrás; en medio, el faro de verdad del siglo XIX: la casa de los
fareros, de dos plantas en piedra clara con las esquinas y cornisas en ocre,
ventanas de arco y la puerta azul al frente, y de su centro la torre cuadrada,
algo más estrecha arriba, con la galería y la linterna de cristal que brilla
de noche bajo su cúpula. El faro es el protagonista y se ve desde lejos: a la
entrada tiene que pesar en la vista como pesaba el castillo (LANTERN_Z, en
radios de la isla). Delante, el muelle de tablas con la boia farera esperando
y un par de gaviotas.

El haz que gira no va en el GLB: lo pone /mar (`islands.ts`, el faro de a
mano lo conserva al cambiar al modelo) en LANTERN_Z × escala.

Medidas en unidades de escena del mar 3D con la isla a R = RADIUS; /mar la
escala por su radio de lugar / RADIUS. Frente (el puerto, la cámara) a -Y.
"""
import math
import random

import bmesh
from mathutils import Matrix, Vector

import mascota as MASC

ID = "faro"
LABEL = "Faro de Tabarca"
DOC = ("isla baja y llana de roca rojiza con matorral seco y un tramo de muralla; en medio el faro de Tabarca, "
       "la casa de los fareros de piedra clara con la torre cuadrada en el centro y la linterna que brilla de noche; "
       "muelle con la boia farera y gaviotas")
RADIUS = 7.0            # orilla de la isla en z = 0, en unidades del modelo
DETAIL = 0.5            # segmentos de cada pieza respecto a los de los mundos (comun.ligero)

H = 0.75                # alto de la roca de la orilla
TOP = 1.15              # la meseta llana
PLATEAU = 0.80          # radio de la meseta, en radios de la isla

# La casa de los fareros (semiejes) y la torre, sobre la meseta.
HOUSE_W, HOUSE_D, HOUSE_H = 2.55, 1.65, 2.5     # mitad del ancho (X), mitad del fondo (Y), alto
TOWER_B, TOWER_T, TOWER_H = 0.95, 0.72, 7.4     # mitad del lado abajo y arriba, alto sobre la azotea
GALLERY = 1.15                                   # mitad del lado de la galería
LAMP_R, LAMP_H = 0.62, 1.25                      # la linterna: radio y alto del cristal
# Centro de la linterna sobre el agua (para el haz de /mar, `FARO_LANTERN` en apps/web/app/mar/engine/islands.ts):
# meseta + casa + torre + galería + medio cristal. Literal para que lo lean las pruebas; build() comprueba la suma.
LANTERN_Z = 11.955
assert abs(LANTERN_Z - (TOP + HOUSE_H + TOWER_H + 0.28 + LAMP_H * 0.5)) < 1e-6, "LANTERN_Z no cuadra con las medidas"

# Papeles nuevos de esta isla (color plano en el glTF); los demás son los del tema de arcilla.
ROLES = {
    "tb_rock": "#A98B74",          # roca rojiza de Tabarca
    "tb_rock_dark": "#7E6553",
    "tb_dry": "#CDB67E",           # la meseta de hierba seca
    "tb_scrub": "#7F8E4B",         # matorral
    "tb_scrub_dry": "#B4A46A",
    "tb_wall": "#EBDDBE",          # piedra clara del faro
    "tb_trim": "#CF8E5B",          # esquinas, cornisas y marcos en ocre
    "tb_window": "#3B4B63",        # ventanas en sombra
    "tb_dome": "#5C7F78",          # la cúpula de cobre viejo
}
# Papeles que brillan (emisivos): el cristal de la linterna y las ventanas encendidas de noche.
GLOW = {
    "tb_lamp": "#FFF0C2",
    "tb_window_lit": "#FFD9A0",
}

UP = Vector((0.0, 0.0, 1.0))


def build(B, K):
    """Construye la isla con el Builder B; K es el módulo comun."""
    rng = random.Random(1854)   # el año del faro
    R = RADIUS
    K.terreno(B, "tb_rock", R * 1.02, H, q=3.0, segs=40, rings=10, noise=K.shore_noise(5))
    K.terreno(B, "tb_rock_dark", R * 1.12, 0.22, sink=0.8, q=2.0, segs=32, rings=6, noise=K.shore_noise(2))
    # La meseta de hierba seca, llana.
    B.blob("tb_dry", (R * PLATEAU, R * PLATEAU * 0.96, 0.75), Vector((0.0, 0.1, TOP - 0.75)), 2.0, 3.2, segs=40, rings=10)
    # Cantos de la orilla (sin tapar el muelle del frente).
    for i in range(14):
        ang = i * 360 / 14 + rng.uniform(-7, 7)
        if abs(((ang + 90 + 180) % 360) - 180) < 20:
            continue
        r = R * rng.uniform(0.92, 1.06)
        K.roca(B, "tb_rock_dark" if i % 3 else "tb_rock", K.polar(r, ang, 0.08), rng.uniform(0.35, 0.75), rng)

    # --- El faro -------------------------------------------------------------------------------------------
    faro(B, K, Vector((0.0, 0.35, TOP)))

    # --- La muralla por detrás, el matorral y los caminos ---------------------------------------------------
    muralla(B, K, R)
    matorral(B, K, R, rng)
    camino(B, K, R)

    # --- El muelle, la boia farera y las gaviotas ------------------------------------------------------------
    # El muelle arranca sobre la roca de la orilla y sale al agua; la boia farera, a la salida del camino.
    K.muelle(B, Vector((0.0, -R * 0.88, 0.0)), 2.6, width=1.1, z=0.42)
    for i in range(2):
        y = -R * 0.84 + i * 0.3
        caja(B, "stone", Vector((0.0, y, 0.52 - i * 0.12)), (0.6, 0.16, 0.05))
    boia_farera(B, K, Vector((0.95, -R * 0.62, _ground(Vector((0.95, -R * 0.62))))), 1.1)
    for at, yaw in (((-2.6, -1.4, TOP + 4.2), 20), ((3.1, 1.2, TOP + 5.3), -140), ((-1.1, -5.9, 0.55), 70)):
        gaviota(B, Vector(at), 0.42, yaw)
    return {"top": TOP, "height": LANTERN_Z + LAMP_H * 0.5 + 0.95}


# --- Terreno ---------------------------------------------------------------------------------------------
def _ground(p):
    """Alto aproximado del suelo en el punto p: la roca o la meseta."""
    R = RADIUS
    d = math.hypot(p.x, p.y - 0.1)
    rock = (H + 0.6) * max(0.0, 1.0 - min(1.0, d / (R * 1.02)) ** 3.0) ** (1 / 3.0) - 0.6
    plateau = TOP - 0.75 + 0.75 * max(0.0, 1.0 - min(1.0, d / (R * PLATEAU)) ** 3.2) ** (1 / 3.2)
    return max(rock, plateau)


# --- Piezas de obra ----------------------------------------------------------------------------------------
def caja(B, role, center, half, yaw=0.0, sharp=40):
    """Caja de aristas vivas: centro y semiejes (x, y, z), girada `yaw` grados en Z."""
    bm = bmesh.new()
    m = Matrix.Translation(Vector(center)) @ Matrix.Rotation(math.radians(yaw), 4, "Z")
    vs = [bm.verts.new(m @ Vector((sx * half[0], sy * half[1], sz * half[2])))
          for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)]
    for f in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
        bm.faces.new([vs[k] for k in f])
    return B.mk(bm, role, sharp=sharp)


def tronco(B, role, base, hb, ht, h, sharp=40):
    """Tronco de pirámide cuadrada: base en `base` (centro), semilado `hb` abajo y `ht` arriba, alto h."""
    bm = bmesh.new()
    lo = [bm.verts.new(base + Vector((sx * hb, sy * hb, 0.0))) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    hi = [bm.verts.new(base + Vector((sx * ht, sy * ht, h))) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    bm.faces.new(lo[::-1])
    bm.faces.new(hi)
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    return B.mk(bm, role, sharp=sharp)


def ventana(B, at, n, w, h, lit=False):
    """Ventana de arco en la pared: hueco en sombra (o encendido) con su marco ocre; `n` la normal de la pared."""
    n = n.normalized()
    side = UP.cross(n).normalized()
    role = "tb_window_lit" if lit else "tb_window"
    body = at + n * 0.03
    # El hueco: losa hasta donde empieza el arco y medio cilindro encima.
    bm = bmesh.new()
    hh = h - w * 0.5
    _slab(bm, body, side, n, UP, w * 0.5, hh * 0.5, 0.045, UP * (hh * 0.5))
    B.mk(bm, role, sharp=40)
    B.tube(role, [body + UP * hh - n * 0.02, body + UP * hh + n * 0.045], w * 0.5, segs=10)
    # El marco: dos jambas y el arco.
    for s in (-1, 1):
        B.tube("tb_trim", [body + side * s * (w * 0.5 + 0.04) + n * 0.02, body + side * s * (w * 0.5 + 0.04) + UP * hh + n * 0.02],
               0.045, segs=6)
    arc = [body + UP * hh + n * 0.02 + (side * math.cos(t) + UP * math.sin(t)) * (w * 0.5 + 0.04)
           for t in (math.pi * i / 6 for i in range(7))]
    B.tube("tb_trim", arc, 0.045, segs=6)
    # El alféizar.
    _bar(B, "tb_trim", body + n * 0.04, side, n, UP, w * 0.5 + 0.1, 0.06, 0.04)


def _slab(bm, c, ex, ey, ez, hx, hz, hy, shift):
    """Losa (caja) en la base ortonormal (ex, ey, ez) centrada en c + shift: semiejes hx (ex), hy (ey), hz (ez)."""
    c = c + shift
    vs = [bm.verts.new(c + ex * (sx * hx) + ey * (sy * hy) + ez * (sz * hz))
          for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)]
    for f in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
        bm.faces.new([vs[k] for k in f])


def _bar(B, role, c, ex, ey, ez, hx, hz, hy):
    bm = bmesh.new()
    _slab(bm, c, ex, ey, ez, hx, hz, hy, Vector((0, 0, 0)))
    return B.mk(bm, role, sharp=40)


def faro(B, K, base):
    """La casa de los fareros con la torre cuadrada en el centro, la galería, la linterna y la cúpula."""
    bz = base.z
    c = Vector((base.x, base.y, 0.0))
    # Zócalo y la casa de dos plantas.
    caja(B, "tb_rock_dark", c + UP * (bz + 0.1), (HOUSE_W + 0.25, HOUSE_D + 0.25, 0.14))
    caja(B, "tb_wall", c + UP * (bz + HOUSE_H * 0.5), (HOUSE_W, HOUSE_D, HOUSE_H * 0.5))
    # Esquinas en ocre (sillares), la línea de la primera planta y la cornisa.
    for sx in (-1, 1):
        for sy in (-1, 1):
            caja(B, "tb_trim", c + Vector((sx * HOUSE_W, sy * HOUSE_D, bz + HOUSE_H * 0.5)), (0.11, 0.11, HOUSE_H * 0.5))
    caja(B, "tb_trim", c + UP * (bz + HOUSE_H * 0.5), (HOUSE_W + 0.03, HOUSE_D + 0.03, 0.05))
    caja(B, "tb_trim", c + UP * (bz + HOUSE_H + 0.06), (HOUSE_W + 0.16, HOUSE_D + 0.16, 0.08))
    # El pretil de la azotea.
    for sx in (-1, 1):
        caja(B, "tb_wall", c + Vector((sx * (HOUSE_W + 0.06), 0.0, bz + HOUSE_H + 0.3)), (0.08, HOUSE_D + 0.12, 0.17))
    for sy in (-1, 1):
        caja(B, "tb_wall", c + Vector((0.0, sy * (HOUSE_D + 0.06), bz + HOUSE_H + 0.3)), (HOUSE_W + 0.12, 0.08, 0.17))
    # Ventanas: frente y espalda (tres por planta), lados (una por planta); alguna encendida de noche.
    front, back = Vector((0, -1, 0)), Vector((0, 1, 0))
    for floor, z in ((0, 0.95), (1, HOUSE_H * 0.5 + 0.95)):
        for x in (-1.6, 0.0, 1.6):
            if floor == 0 and x == 0.0:
                continue   # la puerta
            ventana(B, c + Vector((x, -HOUSE_D, bz + z - 0.42)), front, 0.42, 0.84, lit=(floor == 1 and x != 0.0))
            ventana(B, c + Vector((x, HOUSE_D, bz + z - 0.42)), back, 0.42, 0.84, lit=(floor == 0 and x > 0))
        for sx in (-1, 1):
            ventana(B, c + Vector((sx * HOUSE_W, 0.0, bz + z - 0.42)), Vector((sx, 0, 0)), 0.42, 0.84, lit=(floor == 1 and sx > 0))
    # La puerta azul con su arco y la escalerita.
    door = c + Vector((0.0, -HOUSE_D, bz))
    _bar(B, "blue_door", door + front * 0.03 + UP * 0.55, Vector((1, 0, 0)), front, UP, 0.34, 0.55, 0.04)
    B.tube("blue_door", [door + UP * 1.1 - front * 0.01, door + UP * 1.1 + front * 0.07], 0.34, segs=12)
    arc = [door + UP * 1.1 + front * 0.03 + (Vector((math.cos(t), 0, math.sin(t)))) * 0.4
           for t in (math.pi * i / 6 for i in range(7))]
    B.tube("tb_trim", arc, 0.05, segs=6)
    for s in (-1, 1):
        B.tube("tb_trim", [door + Vector((s * 0.4, -0.03, 0.0)), door + Vector((s * 0.4, -0.03, 1.1))], 0.05, segs=6)
    for i in range(3):
        caja(B, "stone", door + front * (0.22 + i * 0.22) + UP * (0.12 - i * 0.06), (0.75 + i * 0.1, 0.12, 0.05))
    # Farolillo sobre la puerta.
    B.blob("lantern", (0.09, 0.09, 0.11), door + front * 0.14 + UP * 1.75, segs=8, rings=4)
    # La torre cuadrada, un poco más estrecha arriba, con su cornisa a media altura.
    roof = c + UP * (bz + HOUSE_H)
    tronco(B, "tb_wall", roof, TOWER_B, TOWER_T, TOWER_H)
    for sx in (-1, 1):
        for sy in (-1, 1):
            # Sillares ocre en las aristas de la torre: tubos finos que siguen la inclinación.
            lo = roof + Vector((sx * TOWER_B, sy * TOWER_B, 0.0))
            hi = roof + Vector((sx * TOWER_T, sy * TOWER_T, TOWER_H))
            B.tube("tb_trim", [lo, hi], 0.075, segs=5)
    mid = TOWER_B + (TOWER_T - TOWER_B) * 0.52
    caja(B, "tb_trim", roof + UP * (TOWER_H * 0.52), (mid + 0.1, mid + 0.1, 0.06))
    # Ventanitas de la torre (saeteras) mirando al frente.
    for z in (TOWER_H * 0.25, TOWER_H * 0.72):
        hw = TOWER_B + (TOWER_T - TOWER_B) * (z / TOWER_H)
        ventana(B, roof + Vector((0.0, -hw, z - 0.3)), front, 0.24, 0.6, lit=(z > TOWER_H * 0.5))
    # La galería: cornisa en ocre, suelo y barandilla de hierro.
    gal = roof + UP * TOWER_H
    caja(B, "tb_trim", gal + UP * 0.1, (GALLERY, GALLERY, 0.1))
    caja(B, "tb_wall", gal + UP * 0.24, (GALLERY - 0.06, GALLERY - 0.06, 0.04))
    rail_z = gal.z + 0.28
    corners = [gal + Vector((sx * (GALLERY - 0.1), sy * (GALLERY - 0.1), 0.28)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    ring = corners + [corners[0]]
    B.tube("metal", [p + UP * 0.62 for p in ring], 0.025, segs=4)
    B.tube("metal", [p + UP * 0.32 for p in ring], 0.02, segs=4)
    for i in range(4):
        a, b = corners[i], corners[(i + 1) % 4]
        for t in (0.0, 0.25, 0.5, 0.75):
            p = a.lerp(b, t)
            B.tube("metal", [p, p + UP * 0.62], 0.02, segs=4)
    # La linterna: tambor de metal, el cristal que brilla con sus montantes, la cúpula y el remate.
    lamp = Vector((c.x, c.y, rail_z))
    B.lathe("metal", [(0.0, 0.0), (LAMP_R + 0.1, 0.0), (LAMP_R + 0.1, 0.12), (LAMP_R, 0.16), (0.0, 0.16)], tuple(lamp), segs=16)
    glass = lamp + UP * 0.16
    B.lathe("tb_lamp", [(0.0, 0.0), (LAMP_R, 0.0), (LAMP_R, LAMP_H), (0.0, LAMP_H)], tuple(glass), segs=16)
    for i in range(8):
        a = 2 * math.pi * i / 8 + math.pi / 8
        p = glass + Vector((math.cos(a) * (LAMP_R + 0.02), math.sin(a) * (LAMP_R + 0.02), 0.0))
        B.tube("metal", [p, p + UP * LAMP_H], 0.03, segs=4)
    B.torus("metal", LAMP_R + 0.02, 0.03, Matrix.Translation(glass + UP * (LAMP_H * 0.5)), nu=16, nv=4)
    dome = glass + UP * LAMP_H
    B.lathe("tb_dome", [(0.0, -0.02), (LAMP_R + 0.14, -0.02), (LAMP_R + 0.14, 0.1), (LAMP_R * 0.95, 0.3), (LAMP_R * 0.6, 0.55),
                        (0.12, 0.72), (0.0, 0.74)], tuple(dome), segs=16)
    B.tube("metal", [dome + UP * 0.7, dome + UP * 0.95], 0.03, segs=5)
    B.blob("gold", (0.09, 0.09, 0.09), dome + UP * 0.95, segs=10, rings=6)
    return dome


# --- La isla: muralla, matorral, camino -----------------------------------------------------------------------
def muralla(B, K, R):
    """Un tramo de la muralla de Tabarca por detrás, con sus almenas y una garita redonda."""
    r = R * 0.86
    pts = [K.polar(r, ang) for ang in range(40, 141, 10)]
    for a, b in zip(pts, pts[1:]):
        mid = (a + b) * 0.5
        mid.z = _ground(mid) - 0.1
        length = (b - a).length
        yaw = math.degrees(math.atan2(b.y - a.y, b.x - a.x))
        caja(B, "stone", mid + UP * 0.55, (length * 0.5 + 0.03, 0.22, 0.55), yaw)
        caja(B, "tb_rock_dark", mid + UP * 1.12, (length * 0.5 + 0.03, 0.26, 0.04), yaw)
        for t in (0.25, 0.75):
            p = a.lerp(b, t)
            p.z = mid.z + 1.16
            caja(B, "stone", p + UP * 0.14, (0.16, 0.2, 0.14), yaw)
    # La garita en la punta oeste.
    g = pts[-1]
    g.z = _ground(g) - 0.1
    B.lathe("stone", [(0.0, 0.0), (0.42, 0.0), (0.42, 1.5), (0.0, 1.5)], tuple(g), segs=12)
    B.lathe("tb_trim", [(0.0, 1.45), (0.5, 1.45), (0.0, 1.95)], tuple(g), segs=12)


def matorral(B, K, R, rng):
    """Matorral seco de Tabarca: matas bajas y redondas, verdes y pajizas, por la meseta y la roca."""
    for i in range(26):
        ang = rng.uniform(0, 360)
        if abs(((ang + 90 + 180) % 360) - 180) < 30 and rng.random() < 0.6:
            continue
        r = R * rng.uniform(0.3, 0.95)
        p = K.polar(r, ang)
        # Ni dentro de la casa ni sobre el muelle.
        if abs(p.x) < HOUSE_W + 0.6 and abs(p.y - 0.35) < HOUSE_D + 0.6:
            continue
        p.z = _ground(p) - 0.06
        s = rng.uniform(0.28, 0.6)
        role = "tb_scrub" if rng.random() < 0.55 else "tb_scrub_dry"
        B.blob(role, (s, s * rng.uniform(0.8, 1.2), s * 0.6), p, 2.0, 2.0,
               extra=Matrix.Rotation(rng.uniform(0, math.pi), 4, "Z"), segs=10, rings=6)
        if rng.random() < 0.35:
            q = p + Vector((s * 0.7, s * 0.3, 0.0))
            B.blob(role, (s * 0.6, s * 0.5, s * 0.4), q, 2.0, 2.0, segs=8, rings=4)
    # Unas pitas (ágaves) de hojas en punta, a los lados.
    for ang, r in ((-150, 0.62), (-30, 0.66), (175, 0.5)):
        p = K.polar(R * r, ang)
        p.z = _ground(p) - 0.02
        pita(B, p, 0.9, rng)


def pita(B, at, s, rng):
    """Pita: rosetón de hojas carnosas en punta."""
    for i in range(7):
        a = 2 * math.pi * i / 7 + rng.uniform(-0.2, 0.2)
        d = Vector((math.cos(a), math.sin(a), 0.0))
        tip = at + d * 0.55 * s + UP * 0.6 * s
        B.tube("tb_scrub", [at + UP * 0.05 * s, at + d * 0.3 * s + UP * 0.35 * s, tip], [0.11 * s, 0.08 * s, 0.015 * s], segs=5)


def camino(B, K, R):
    """Camino de losas del muelle a la puerta."""
    for i in range(6):
        y = -R * 0.74 + i * 0.6
        caja(B, "stone", Vector((0.0, y, _ground(Vector((0.0, y))) + 0.02)), (0.42, 0.24, 0.03), 0.0)


# --- La boia farera y las gaviotas ---------------------------------------------------------------------------
def boia_farera(B, K, base, k):
    """La mascota de BOIA (mascota.py) en el muelle mirando al frente, con su gorro y su aro."""
    base = Vector(base)
    D = MASC.mdir(K.g_toward(K.FRONT))
    Rt = K.UP.cross(D).normalized()
    a = c = 0.40 * k
    body = MASC.Body(base + K.UP * (0.36 * k), a, c, D, Rt)
    B.blob("mascota", (a, a, c), body.C, 2.0, 2.0, segs=36, rings=18)
    MASC.face(B, body, k, "sonrisa")
    MASC.cap(B, body, k, pompom=True)
    MASC.ring_float(B, body, base, k, "white", "red")
    # Un catalejo en la mano, mirando al mar.
    p, n = body.point(1.3, 0.1, -0.02 * k)
    out = (n * 0.8 + K.FRONT * 0.6).normalized()
    hand = p + out * 0.22 * k
    B.tube("mascota", [p - n * 0.04 * k, hand], [0.07 * k, 0.05 * k], segs=6)
    B.blob("white", (0.065 * k, 0.065 * k, 0.065 * k), hand, segs=8, rings=4)
    B.tube("metal", [hand - K.FRONT * 0.1 * k, hand + K.FRONT * 0.32 * k], [0.03 * k, 0.045 * k], segs=6)


def gaviota(B, at, s, yaw):
    """Gaviota en vuelo: cuerpo, dos alas en V suave, cabeza y pico naranja."""
    at = Vector(at)
    rot = Matrix.Rotation(math.radians(yaw), 4, "Z")
    fwd = rot @ Vector((0.0, -1.0, 0.0))
    side = rot @ Vector((1.0, 0.0, 0.0))
    B.blob("seagull", (0.09 * s, 0.26 * s, 0.08 * s), at, 2.0, 2.0, extra=rot, segs=8, rings=4)
    B.blob("seagull", (0.07 * s, 0.07 * s, 0.07 * s), at + fwd * 0.28 * s + UP * 0.04 * s, segs=8, rings=4)
    B.tube("beak", [at + fwd * 0.33 * s + UP * 0.03 * s, at + fwd * 0.44 * s + UP * 0.01 * s], [0.025 * s, 0.008 * s], segs=4)
    for sd in (-1, 1):
        root = at + side * sd * 0.06 * s
        tip = at + side * sd * 0.72 * s + UP * 0.22 * s - fwd * 0.08 * s
        mid = root.lerp(tip, 0.5) + UP * 0.02 * s
        B.tube("gull_wing", [root, mid, tip], [0.07 * s, 0.05 * s, 0.012 * s], segs=4)

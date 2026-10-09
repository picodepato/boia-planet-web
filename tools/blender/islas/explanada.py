"""La Explanada de España de Alicante (plan 023, T252): el decorado sin nombre a la derecha del puerto. MUESTRA.

No es un lugar del mapa compartido: es la pieza `explanada` del decorado propio
de /mar (`apps/web/app/mar/engine/compact.ts`, `decor.ts`), la isla alargada
al este de la salida, sin rótulo. Su modelo entra por el mismo camino que las
islas (`island-models.ts`, id `explanada`).

El paseo de verdad: un paseo marítimo de unos 500 m entre el puerto y las
fachadas de la ciudad, pavimentado con 6,6 millones de teselas de mármol rojo,
crema y negro que forman las olas paralelas que lo identifican (franjas
sinusoidales a lo largo del paseo), cuatro hileras de palmeras datileras con
bancos y farolas de hierro con globos blancos entre ellas, la balaustrada de
piedra hacia el puerto y, en su extremo de levante, la Concha, el auditorio
en forma de concha abierta hacia el paseo. Aquí, en arcilla y a lo ancho de
la isla: el paseo central con el mosaico de olas, dos hileras de palmeras en
sus alcorques con bancos y farolas, el muro de mar con su balaustrada y una
escalerita al muelle, la Concha en el extremo este, las fachadas crema y
rosa de la ciudad por detrás (ventanas encendidas de noche) y una boia de
BOIA paseando con un helado.

Referencias usadas (de memoria del paseo, sin imágenes en el repo): la
proporción largo/ancho del decorado (34 × 13 u, `DECOR_SIZE`), el mosaico de
olas con cuatro franjas (dos rojas y dos negras) sobre fondo crema, las
palmeras más altas que las farolas, y la Concha como media cúpula sobre una
tarima baja.

Medidas en unidades de escena del mar 3D: RADIUS es el semilargo de la isla
(/mar la escala por `DECOR_SIZE.explanadaL / RADIUS` = 1). Frente (el puerto,
la cámara) a -Y; las fachadas, a +Y.
"""
import math
import random

import bmesh
from mathutils import Matrix, Vector

import mascota as MASC
from islas.allday import palmera
from islas.faro import caja as box

ID = "explanada"
LABEL = "Explanada de Alicante"
DOC = ("paseo marítimo alargado de la Explanada de Alicante con el mosaico de olas rojo, crema y negro, dos hileras de "
       "palmeras con bancos y farolas de globos que brillan de noche, la balaustrada y el muelle hacia el puerto, la "
       "Concha en el extremo este, las fachadas de la ciudad por detrás con ventanas encendidas y una boia paseando; "
       "sin rótulo")
RADIUS = 17.0           # semilargo de la isla (DECOR_SIZE.explanadaL); el semiancho es HALF_W
HALF_W = 6.5            # semiancho (DECOR_SIZE.explanadaW)
DETAIL = 0.5            # segmentos de cada pieza respecto a los de los mundos (comun.ligero)

TOP = 0.9               # cima de la tierra: donde se apoya el paseo
PAVE_Z = TOP + 0.12     # cara del pavimento
WALK_HALF = 1.45        # semiancho del paseo central (el mosaico)
SIDE_HALF = 3.7         # semiancho del pavimento entero
X0, X1 = -15.2, 15.2    # el pavimento, a lo largo
WALK_X1 = 11.3          # el mosaico acaba donde empieza la tarima de la Concha
ROW_Y = 2.3             # las dos hileras de palmeras, a cada lado del paseo
WALL_Y = -3.95          # el muro de mar, al frente, pegado al bordillo
FACADE_Y0 = 4.4         # las fachadas, por detrás
FACADE_D = 1.9
CONCHA_C = Vector((13.6, 0.35, 0.0))
CONCHA_R = 2.3
CONCHA_H = 2.5
PALM_H = (3.3, 4.1)     # alto del tronco de las palmeras
LAMP_H = 2.4            # el poste de las farolas
WAVE_LEN, WAVE_AMP = 4.4, 0.3   # las olas del mosaico: periodo y amplitud

# Papeles nuevos de esta isla (color plano en el glTF); los demás son los del tema de arcilla.
ROLES = {
    "exp_cream": "#EFE3C9",        # el mármol crema del mosaico y del pavimento
    "exp_red": "#B8332B",          # el mármol rojo de Alicante
    "exp_black": "#2B2327",        # el mármol negro
    "exp_wall": "#D9CDB4",         # la piedra clara del muro y la balaustrada
    "exp_iron": "#2E2A2C",         # el hierro de farolas y bancos
    "exp_facade_a": "#F6EEDF",     # fachadas: crema
    "exp_facade_b": "#E9C9A4",     # ocre claro
    "exp_facade_c": "#E6B9A8",     # rosa viejo
    "exp_window": "#3B4B63",       # ventanas en sombra
    "exp_concha": "#F2E6D0",       # la Concha
    "exp_concha_in": "#C9655A",    # su interior
    "exp_planter": "#B9A58A",      # alcorques de piedra
    "exp_ice": "#F6C8D6",          # el helado de la boia
}
# Papeles que brillan (emisivos): los globos de las farolas y las ventanas encendidas de noche.
GLOW = {
    "exp_globe": "#FFF4D6",
    "exp_window_lit": "#FFD9A0",
}

UP = Vector((0.0, 0.0, 1.0))
FRONT = Vector((0.0, -1.0, 0.0))

FACADES = [
    # (x centro, semiancho, alto, papel, plantas)
    (-13.3, 1.9, 3.6, "exp_facade_a", 3),
    (-9.3, 1.9, 4.6, "exp_facade_b", 4),
    (-5.3, 1.85, 3.1, "exp_facade_c", 3),
    (-1.5, 1.8, 4.2, "exp_facade_a", 4),
    (2.3, 1.85, 3.4, "exp_facade_b", 3),
    (6.2, 1.95, 4.8, "exp_facade_a", 4),
    (10.2, 1.9, 3.3, "exp_facade_c", 3),
    (14.0, 1.75, 4.0, "exp_facade_b", 4),
]


def build(B, K):
    """Construye la isla con el Builder B; K es el módulo comun."""
    rng = random.Random(1867)   # el año en que se trazó el paseo
    terreno(B, K, rng)
    pavimento(B)
    mosaico(B)
    muro(B, K)
    K.muelle(B, Vector((-2.0, WALL_Y - 0.1, 0.0)), 2.4, width=1.1, z=0.42)
    paseo(B, rng)
    concha(B)
    fachadas(B, rng)
    boia_paseando(B, K, Vector((-4.2, -0.3, PAVE_Z)), 1.05)
    # El alto: lo más alto de las fachadas (con su cornisa) o de las palmeras (el penacho sube poco del tronco).
    return {"top": TOP, "height": max(PAVE_Z + CONCHA_H + 0.3, 0.35 + max(f[2] for f in FACADES) + 0.3,
                                      PAVE_Z + PALM_H[1] + 0.3)}


# --- Terreno y pavimento ---------------------------------------------------------------------------------
def terreno(B, K, rng):
    """Isla alargada de arena con la cima llana (superelipsoide achatado) y cantos de roca en las puntas."""
    # Planta casi rectangular (p alto): en las puntas la losa del paseo no vuela sobre el agua.
    B.blob("sand", (RADIUS * 1.03, HALF_W * 1.08, TOP + 0.6), Vector((0.0, 0.0, -0.6)), 3.6, 4.0, segs=56, rings=10)
    B.blob("shallow", (RADIUS * 1.12, HALF_W * 1.2, 0.25), Vector((0.0, 0.0, -0.55)), 3.2, 3.0, segs=40, rings=6)
    for sx in (-1, 1):
        for i in range(4):
            ang = rng.uniform(-50, 50) + (0 if sx > 0 else 180)
            p = K.polar(1.0, ang)
            p.x *= RADIUS * rng.uniform(0.96, 1.04)
            p.y *= HALF_W * rng.uniform(0.9, 1.0)
            p.z = 0.1
            K.roca(B, "rock", p, rng.uniform(0.35, 0.6), rng)


def pavimento(B):
    """La losa crema del paseo entero, con un bordillo de piedra."""
    cx, hx = (X0 + X1) * 0.5, (X1 - X0) * 0.5
    box(B, "exp_wall", Vector((cx, 0.0, TOP + 0.03)), (hx + 0.15, SIDE_HALF + 0.15, 0.06))
    box(B, "exp_cream", Vector((cx, 0.0, PAVE_Z - 0.04)), (hx, SIDE_HALF, 0.04))


def mosaico(B):
    """Las olas de mármol: franjas sinusoidales paralelas, dos rojas y dos negras, sobre la losa crema."""
    n = int((WALK_X1 - X0) / 0.35)
    for y0, role in ((-1.05, "exp_red"), (-0.35, "exp_black"), (0.35, "exp_red"), (1.05, "exp_black")):
        banda(B, role, X0 + 0.1, WALK_X1 - 0.1, y0, 0.3, n)
    # El borde del paseo central: dos listones negros rectos.
    for sy in (-1, 1):
        box(B, "exp_black", Vector(((X0 + WALK_X1) * 0.5, sy * (WALK_HALF + 0.05), PAVE_Z + 0.005)),
            ((WALK_X1 - X0) * 0.5, 0.05, 0.012))


def banda(B, role, x0, x1, y0, hw, n):
    """Franja de mármol con el borde en ola (y = y0 ± hw + A·sen), de grosor mínimo, pegada al pavimento."""
    bm = bmesh.new()
    lo, hi = [], []
    for i in range(n + 1):
        x = x0 + (x1 - x0) * i / n
        y = y0 + WAVE_AMP * math.sin(2 * math.pi * x / WAVE_LEN)
        for z, rows in ((PAVE_Z - 0.01, lo), (PAVE_Z + 0.012, hi)):
            rows.append((bm.verts.new(Vector((x, y - hw, z))), bm.verts.new(Vector((x, y + hw, z)))))
    for i in range(n):
        bm.faces.new((hi[i][0], hi[i + 1][0], hi[i + 1][1], hi[i][1]))
        bm.faces.new((lo[i][1], lo[i + 1][1], lo[i + 1][0], lo[i][0]))
        bm.faces.new((lo[i][0], lo[i + 1][0], hi[i + 1][0], hi[i][0]))
        bm.faces.new((hi[i][1], hi[i + 1][1], lo[i + 1][1], lo[i][1]))
    bm.faces.new((lo[0][0], hi[0][0], hi[0][1], lo[0][1]))
    bm.faces.new((lo[n][1], hi[n][1], hi[n][0], lo[n][0]))
    B.mk(bm, role, sharp=30)


# --- El muro de mar, la balaustrada y la escalera ----------------------------------------------------------
def muro(B, K):
    """Muro de piedra al frente con la balaustrada encima y una escalera que baja al muelle."""
    cx, hx = (X0 + X1) * 0.5, (X1 - X0) * 0.5 + 0.15
    # El muro baja de la losa a la arena (no al agua: la playa se ve delante).
    box(B, "exp_wall", Vector((cx, WALL_Y, (PAVE_Z + 0.15) * 0.5)), (hx, 0.26, (PAVE_Z - 0.15) * 0.5))
    rail_z = PAVE_Z + 0.78
    box(B, "exp_wall", Vector((cx, WALL_Y, rail_z)), (hx, 0.17, 0.05))
    box(B, "exp_wall", Vector((cx, WALL_Y, PAVE_Z + 0.08)), (hx, 0.2, 0.08))
    x = X0 - 0.1
    while x <= X1 + 0.1:
        if abs(x + 2.0) > 1.0:   # el hueco de la escalera
            B.lathe("exp_wall", [(0.0, 0.0), (0.07, 0.0), (0.05, 0.18), (0.08, 0.36), (0.05, 0.5), (0.07, 0.62), (0.0, 0.62)],
                    (x, WALL_Y, PAVE_Z + 0.16), segs=8)
        x += 0.62
    for sx in (-1, 1):
        box(B, "exp_wall", Vector((-2.0 + sx * 1.05, WALL_Y, PAVE_Z + 0.45)), (0.1, 0.22, 0.45))
        B.blob("exp_wall", (0.16, 0.16, 0.12), Vector((-2.0 + sx * 1.05, WALL_Y, PAVE_Z + 0.98)), segs=8, rings=4)
    for i in range(4):
        box(B, "exp_wall", Vector((-2.0, WALL_Y - 0.35 - i * 0.26, PAVE_Z - 0.12 - i * 0.14)), (0.9, 0.14, 0.06))


# --- Palmeras, farolas y bancos --------------------------------------------------------------------------
def paseo(B, rng):
    """Dos hileras de palmeras en sus alcorques; entre ellas, farolas de globos y bancos de listones."""
    xs = [-13.6 + i * 3.0 for i in range(9)]
    for sy in (-1, 1):
        y = sy * ROW_Y
        for x in xs:
            B.lathe("exp_planter", [(0.0, -0.02), (0.46, -0.02), (0.46, 0.14), (0.36, 0.14), (0.0, 0.14)],
                    (x, y, PAVE_Z), segs=12)
            palmera(B, Vector((x + rng.uniform(-0.1, 0.1), y, PAVE_Z + 0.08)), rng.uniform(*PALM_H), rng)
        for i, x in enumerate(xs[:-1]):
            mid = x + 1.5
            if (i + (0 if sy > 0 else 1)) % 2 == 0:
                farola(B, Vector((mid, y, PAVE_Z)))
            else:
                banco(B, Vector((mid, y, PAVE_Z)), facing=-sy)


def farola(B, base):
    """Farola de hierro de la Explanada: fuste con basa, tres brazos y tres globos blancos que brillan de noche."""
    B.lathe("exp_iron", [(0.0, 0.0), (0.2, 0.0), (0.14, 0.12), (0.09, 0.3), (0.0, 0.3)], tuple(base), segs=10)
    top = base + UP * LAMP_H
    B.tube("exp_iron", [base + UP * 0.25, base + UP * (LAMP_H * 0.6), top], [0.065, 0.05, 0.04], segs=6)
    B.blob("exp_globe", (0.2, 0.2, 0.2), top + UP * 0.3, segs=10, rings=6)
    for i in range(2):
        a = math.radians(i * 180)
        d = Vector((math.cos(a), math.sin(a), 0.0))
        elbow = top - UP * 0.25 + d * 0.3
        B.tube("exp_iron", [top - UP * 0.3, elbow, elbow + UP * 0.2], 0.025, segs=5)
        B.blob("exp_globe", (0.16, 0.16, 0.16), elbow + UP * 0.34, segs=10, rings=6)


def banco(B, base, facing):
    """Banco de listones de madera con los pies de hierro, mirando hacia el paseo central."""
    f = Vector((0.0, facing, 0.0))
    for i in range(3):
        box(B, "wood", base + UP * 0.42 - f * (0.14 - i * 0.14), (0.75, 0.055, 0.02))
    for i in range(2):
        box(B, "wood", base + UP * (0.62 + i * 0.16) - f * 0.22, (0.75, 0.02, 0.055))
    for sx in (-1, 1):
        box(B, "exp_iron", base + Vector((sx * 0.62, 0.0, 0.2)), (0.04, 0.17, 0.2))
        B.tube("exp_iron", [base + Vector((sx * 0.62, -facing * 0.2, 0.4)), base + Vector((sx * 0.62, -facing * 0.24, 0.82))],
               0.025, segs=5)


# --- La Concha ---------------------------------------------------------------------------------------------
def concha(B):
    """El auditorio de la Concha: tarima redonda y media cúpula con grosor abierta hacia el paseo (−X)."""
    c = Vector((CONCHA_C.x, CONCHA_C.y, PAVE_Z))
    B.lathe("stone", [(0.0, -0.1), (CONCHA_R + 0.5, -0.1), (CONCHA_R + 0.5, 0.22), (0.0, 0.22)], tuple(c), segs=24)
    B.lathe("exp_wall", [(0.0, 0.2), (CONCHA_R + 0.3, 0.2), (CONCHA_R + 0.3, 0.3), (0.0, 0.3)], tuple(c), segs=24)
    floor = c + UP * 0.3
    casco(B, floor, CONCHA_R, CONCHA_H, 0.12, 14, 7)
    # Las boias de atrezo: dos focos a los lados de la boca.
    for sy in (-1, 1):
        p = floor + Vector((-CONCHA_R * 0.9, sy * (CONCHA_R - 0.3), 0.0))
        B.tube("exp_iron", [p, p + UP * 0.6], 0.03, segs=5)
        B.blob("exp_iron", (0.1, 0.1, 0.12), p + UP * 0.68, segs=8, rings=4)


def casco(B, floor, r, h, thick, nu, nv):
    """Media cúpula (cuarto de esfera alargada) con grosor: fuera crema, dentro rojo. La boca mira a −X."""
    def shell(role, rr, hh, flip):
        bm = bmesh.new()
        grid = []
        for j in range(nv + 1):
            lat = math.pi / 2 * j / nv
            row = []
            for i in range(nu + 1):
                az = -math.pi / 2 + math.pi * i / nu     # de −Y a +Y pasando por +X (la espalda)
                row.append(bm.verts.new(floor + Vector((rr * math.cos(lat) * math.cos(az), rr * math.cos(lat) * math.sin(az),
                                                        hh * math.sin(lat)))))
            grid.append(row)
        for j in range(nv):
            for i in range(nu):
                f = (grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i])
                bm.faces.new(f[::-1] if flip else f)
        bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-4)
        return B.mk(bm, role, sharp=50, smooth=True)

    shell("exp_concha", r, h, False)
    shell("exp_concha_in", r - thick, h - thick, True)
    # El canto de la boca, que cierra el grosor.
    bm = bmesh.new()
    outer, inner = [], []
    for j in range(nv + 1):
        lat = math.pi / 2 * j / nv
        for rr, hh, rows in ((r, h, outer), (r - thick, h - thick, inner)):
            rows.append((bm.verts.new(floor + Vector((0.0, -rr * math.cos(lat), hh * math.sin(lat)))),
                         bm.verts.new(floor + Vector((0.0, rr * math.cos(lat), hh * math.sin(lat))))))
    for j in range(nv):
        bm.faces.new((outer[j][0], outer[j + 1][0], inner[j + 1][0], inner[j][0]))
        bm.faces.new((inner[j][1], inner[j + 1][1], outer[j + 1][1], outer[j][1]))
    B.mk(bm, "exp_concha", sharp=50)


# --- Las fachadas de la ciudad -----------------------------------------------------------------------------
def fachadas(B, rng):
    """Casas de la Explanada por detrás: cuerpos de color, cornisa, balcones y ventanas (algunas encendidas)."""
    y_c = FACADE_Y0 + FACADE_D * 0.5
    for x, hw, h, role, floors in FACADES:
        base_z = 0.35
        box(B, role, Vector((x, y_c, base_z + h * 0.5)), (hw, FACADE_D * 0.5, h * 0.5))
        box(B, "exp_wall", Vector((x, y_c, base_z + h + 0.05)), (hw + 0.08, FACADE_D * 0.5 + 0.08, 0.05))
        box(B, "exp_wall", Vector((x, y_c, base_z + h + 0.22)), (hw * 0.5, FACADE_D * 0.3, 0.12))
        fh = h / floors
        n_win = 3 if hw > 1.8 else 2
        for fl in range(floors):
            z = base_z + fh * (fl + 0.55)
            for k in range(n_win):
                wx = x + (k - (n_win - 1) * 0.5) * (hw * 1.5 / n_win)
                lit = fl > 0 and rng.random() < 0.45
                at = Vector((wx, FACADE_Y0 - 0.02, z))
                if fl == 0:
                    box(B, "exp_window", at - UP * 0.12, (0.2, 0.025, 0.34))
                else:
                    box(B, "exp_window_lit" if lit else "exp_window", at, (0.17, 0.025, 0.26))
                    box(B, "exp_iron", at - UP * 0.28 + FRONT * 0.14, (0.26, 0.14, 0.015))
                    for sx in (-1, 1):
                        B.tube("exp_iron", [at - UP * 0.27 + FRONT * 0.27 + Vector((sx * 0.24, 0.0, 0.0)),
                                            at - UP * 0.02 + FRONT * 0.27 + Vector((sx * 0.24, 0.0, 0.0))], 0.012, segs=4)
                    B.tube("exp_iron", [at - UP * 0.02 + FRONT * 0.27 + Vector((-0.24, 0.0, 0.0)),
                                        at - UP * 0.02 + FRONT * 0.27 + Vector((0.24, 0.0, 0.0))], 0.015, segs=4)


# --- La boia paseando --------------------------------------------------------------------------------------
def boia_paseando(B, K, base, k):
    """La mascota de BOIA (mascota.py) paseando por el mosaico con un helado, mirando al frente y a la izquierda."""
    base = Vector(base)
    D = MASC.mdir(K.g_toward((K.FRONT - K.RIGHT * 0.5).normalized()))
    Rt = K.UP.cross(D).normalized()
    a = c = 0.40 * k
    body = MASC.Body(base + K.UP * (0.36 * k), a, c, D, Rt)
    shell = [B.blob("mascota", (a, a, c), body.C, 2.0, 2.0, segs=36, rings=18)]
    MASC.face(B, body, k, "sonrisa")
    MASC.cap(B, body, k, pompom=True, parts=shell)
    MASC.ring_float(B, body, base, k, "white", "red", parts=shell)
    MASC.outline_parts(B, shell, k)        # el trazo negro del logo (T231)
    # El helado en la mano: cucurucho y bola.
    p, n = body.point(1.2, 0.05, -0.02 * k)
    hand = p + (n * 0.8 + K.UP * 0.3).normalized() * 0.2 * k
    B.tube("mascota", [p - n * 0.04 * k, hand], [0.07 * k, 0.05 * k], segs=6)
    B.lathe("rice", [(0.0, 0.0), (0.06 * k, 0.16 * k), (0.0, 0.16 * k)], tuple(hand + K.UP * 0.02 * k), segs=8)
    B.blob("exp_ice", (0.075 * k, 0.075 * k, 0.075 * k), hand + K.UP * 0.22 * k, segs=10, rings=6)

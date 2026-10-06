"""El Vecino Quejica (plan 015, T174): el miniboss del Cañón y del castillo. MUESTRA.

El vecino de arriba al que la música no le deja dormir: un señor mayor y
barrigón en batita azul y gorro de dormir, con sus zapatillas de andar por
casa, que ha bajado al mar en una barcaza de obra naranja y se ha traído un
megáfono enorme para gritar «¡BAJAD LA MÚSICA!». Está furioso: cejas en
pico, boca abierta de par en par, una venita de enfado en la frente y el
periódico enrollado en el puño que agita en alto. Al lado de la barandilla,
la maceta del balcón; en los costados, los neumáticos de la barcaza.

Lo que tiene que leerse: desde la cámara del Cañón (baja, por detrás del
barco), la cara enfadada, el gorro y el megáfono; desde la cámara alta del
castillo, la barcaza naranja, la bocina crema y el gorro rojo. Estilo de
arcilla de los demás modelos y enemigos: un color plano por papel, sin
texturas, caras planas en /mar.

Unidades: 1 = el radio de choque del boss (el juego escala por su radio de
escena, como la geometría de a mano de `survivors-vecino.ts`, que mide lo
mismo: barcaza de 2,6 de largo y 1,3 de ancho, bocina hacia +X). Frente
(la bocina, rumbo 0 del motor) a +X de Blender; agua en z = 0; centro en el
origen.
"""
import math

from mathutils import Matrix, Vector

import mascota as MASC

ID = "vecino"
LABEL = "El Vecino Quejica"
DOC = ("barcaza de obra naranja con neumáticos y barandilla; encima, el vecino de arriba en batita azul, gorro "
       "de dormir y zapatillas, barrigón y furioso (cejas en pico, boca abierta, venita en la frente), con el "
       "periódico enrollado en alto y la otra mano en un megáfono enorme de color crema que apunta al frente")
RADIUS = 1.0            # el radio de choque del boss, en unidades del modelo
DETAIL = 0.6            # segmentos de cada pieza respecto a los de los mundos (islas/comun.ligero)

# La barcaza (semiejes y alturas): lo mismo que mide la geometría de a mano.
HULL_L, HULL_W, HULL_H = 1.30, 0.65, 0.22     # mitad del largo (X), mitad del ancho (Y), mitad del alto
DECK_Z = 0.49                                 # la cubierta, donde pisa el vecino
RAIL_Z = 0.64
# El megáfono: eje a +X, sobre su poste, algo a estribor para que la cara del vecino se vea a su lado.
HORN_X, HORN_Y, HORN_Z = 0.36, -0.2, 1.5      # dónde se apoya (el cuello) y a qué altura
HORN_LEN, HORN_R = 1.12, 0.62                 # largo del cono y radio de la boca
# El vecino: de pie hacia la popa, a babor, mirando a la bocina.
MAN_X, MAN_Y = -0.58, 0.28
BELLY_R = 0.33
HEAD_R = 0.27
HEAD_Z = 1.52           # centro de la cabeza: la barbilla queda por encima de la barriga
HEAD_X = 0.06           # la cabeza algo adelantada, para que la cara asome sobre la barriga

ROLES = {
    "vq_hull": "#B95926",         # la barcaza naranja de obra (survivors-vecino.ts: hull)
    "vq_hull_dark": "#8A3E1C",    # la línea de flotación
    "vq_deck": "#F2BD70",         # la cubierta (deck)
    "vq_plank": "#D9A258",        # las juntas de las tablas
    "vq_horn": "#FFF1CE",         # la bocina crema (horn)
    "vq_horn_band": "#D8463C",    # las bandas rojas de la bocina
    "vq_mouth": "#332E3E",        # el interior de la bocina y la boca (mouth)
    "vq_robe": "#5B7894",         # la batita azul (coat)
    "vq_robe_dark": "#3F5872",    # cinturón y solapas
    "vq_pyjama": "#CFE0EC",       # el pijama que asoma
    "vq_skin": "#E7B887",         # la piel (skin)
    "vq_skin_dark": "#D59A6A",    # la nariz y las orejas
    "vq_hair": "#CFCAC2",         # pelo y bigote canosos
    "vq_cap": "#F0D070",          # el gorro de dormir, amarillo pálido (no el de Papá Noel)
    "vq_cap_band": "#E0B64C",     # su vuelta
    "vq_buoy_band": "#D8463C",    # las bandas de la boya salvavidas
    "vq_slipper": "#E98BA8",      # las zapatillas de andar por casa
    "vq_anger": "#D5443C",        # la venita de la frente
}
GLOW = {}

UP = Vector((0.0, 0.0, 1.0))
FWD = Vector((1.0, 0.0, 0.0))        # el frente: la bocina, rumbo 0
RIGHT = Vector((0.0, -1.0, 0.0))     # la derecha mirando al frente


def rot(axis, deg):
    return Matrix.Rotation(math.radians(deg), 4, axis)


def caja(B, role, size, at, extra=None, segs=8, rings=4):
    """Caja de aristas suaves (superelipsoide casi cúbica)."""
    return B.blob(role, size, at, 6.0, 6.0, extra=extra, segs=segs, rings=rings)


def build(B, K):
    """Construye el Vecino con el Builder B; K es islas/comun. Devuelve las medidas para el manifiesto."""
    barcaza(B, K)
    top_horn = megafono(B)
    top_cap = vecino(B, K)
    maceta(B, Vector((-1.08, 0.42, DECK_Z)))
    return {"length": HULL_L * 2 + 0.06, "height": max(top_horn, top_cap)}


# --- La barcaza ------------------------------------------------------------------------------------------------
def barcaza(B, K):
    # Casco chato con la línea de flotación oscura por debajo y la cubierta clara encima.
    caja(B, "vq_hull", (HULL_L, HULL_W, HULL_H), Vector((0.0, 0.0, HULL_H - 0.05)), segs=12, rings=6)
    caja(B, "vq_hull_dark", (HULL_L + 0.02, HULL_W + 0.02, 0.07), Vector((0.0, 0.0, 0.04)), segs=12, rings=4)
    caja(B, "vq_deck", (HULL_L + 0.04, HULL_W + 0.04, 0.05), Vector((0.0, 0.0, DECK_Z - 0.05)), segs=12, rings=4)
    # Las juntas de las tablas, a lo largo.
    for y in (-0.42, -0.14, 0.14, 0.42):
        B.tube("vq_plank", [Vector((-HULL_L + 0.1, y, DECK_Z)), Vector((HULL_L - 0.1, y, DECK_Z))], 0.012, segs=4)
    # La proa: una plancha algo levantada, y los norays.
    caja(B, "vq_hull", (0.16, HULL_W - 0.02, 0.05), Vector((HULL_L - 0.1, 0.0, DECK_Z + 0.04)), segs=8, rings=4)
    for sy in (-1, 1):
        B.lathe("iron", [(0.0, 0.0), (0.045, 0.0), (0.045, 0.12), (0.06, 0.13), (0.06, 0.17), (0.0, 0.18)],
                Vector((HULL_L - 0.14, sy * (HULL_W - 0.12), DECK_Z + 0.08)), segs=10)
    # Barandilla por los dos costados y por la popa: listón y postes.
    for sy in (-1, 1):
        y = sy * (HULL_W - 0.03)
        B.tube("wood_dark", [Vector((-HULL_L + 0.08, y, RAIL_Z)), Vector((HULL_L - 0.5, y, RAIL_Z))], 0.035, segs=6)
        for x in (-HULL_L + 0.1, -0.45, 0.25, HULL_L - 0.5):
            B.tube("wood_dark", [Vector((x, y, DECK_Z - 0.02)), Vector((x, y, RAIL_Z + 0.03))], 0.03, segs=6)
    B.tube("wood_dark", [Vector((-HULL_L + 0.08, -(HULL_W - 0.03), RAIL_Z)), Vector((-HULL_L + 0.08, HULL_W - 0.03, RAIL_Z))],
           0.035, segs=6)
    # Los neumáticos colgados en los costados.
    for sy in (-1, 1):
        for x in (-0.85, -0.2, 0.5):
            m = Matrix.Translation(Vector((x, sy * (HULL_W + 0.035), 0.3))) @ rot("X", 90)
            B.torus("ink", 0.11, 0.045, m, nu=14, nv=6)
    # Una boya salvavidas colgada de la barandilla de popa.
    m = Matrix.Translation(Vector((-HULL_L - 0.02, 0.0, RAIL_Z - 0.12))) @ rot("Y", 90)
    B.torus("white", 0.14, 0.04, m, nu=16, nv=6)
    for ang in (0, 90, 180, 270):
        p = Vector((-HULL_L - 0.02, 0.14 * math.cos(math.radians(ang)), RAIL_Z - 0.12 + 0.14 * math.sin(math.radians(ang))))
        B.blob("vq_buoy_band", (0.03, 0.045, 0.045), p, segs=8, rings=4)


# --- El megáfono ------------------------------------------------------------------------------------------------
def megafono(B):
    """La bocina enorme sobre su poste, con la boca abierta y oscura hacia +X. Devuelve su alto."""
    base = Vector((HORN_X, HORN_Y, DECK_Z))
    # Poste con pie, y la rótula en lo alto.
    B.lathe("iron", [(0.0, 0.0), (0.16, 0.0), (0.16, 0.03), (0.07, 0.05), (0.07, 0.9), (0.0, 0.92)], base, segs=12)
    B.blob("iron", (0.1, 0.1, 0.1), base + UP * 0.94, segs=12, rings=6)
    # La bocina: un torno a lo largo de X (el perfil gira alrededor de Z y se tumba). Abierta por la boca.
    along = Matrix.Translation(Vector((HORN_X - 0.32, HORN_Y, HORN_Z))) @ rot("Y", 90)
    prof = [(0.0, -0.02), (0.13, -0.02), (0.15, 0.0), (0.13, 0.16), (0.15, 0.26), (0.2, 0.38),
            (0.3, 0.62), (0.46, 0.9), (HORN_R, HORN_LEN + 0.06), (HORN_R + 0.05, HORN_LEN + 0.1), (HORN_R + 0.05, HORN_LEN + 0.18)]
    B.lathe("vq_horn", prof, (0.0, 0.0, 0.0), segs=22, extra=along)
    # El interior oscuro: otro cono algo más pequeño, cerrado al fondo.
    inner = [(0.0, 0.3), (0.17, 0.36), (0.27, 0.6), (0.43, 0.9), (HORN_R - 0.03, HORN_LEN + 0.06), (HORN_R - 0.03, HORN_LEN + 0.17)]
    B.lathe("vq_mouth", inner, (0.0, 0.0, 0.0), segs=22, extra=along)
    # Las bandas rojas, y el asa de abajo.
    for t, r in ((0.5, 0.26), (0.8, 0.38), (HORN_LEN + 0.12, HORN_R + 0.055)):
        m = Matrix.Translation(Vector((HORN_X - 0.32 + t, HORN_Y, HORN_Z))) @ rot("Y", 90)
        B.torus("vq_horn_band", r, 0.028, m, nu=22, nv=6)
    # Y el asa de abajo, del lado del vecino, donde pone la mano (por debajo de su cara).
    neck = Vector((HORN_X - 0.1, HORN_Y, HORN_Z))
    B.tube("iron", [neck - UP * 0.12, neck - UP * 0.3, neck - UP * 0.34 - FWD * 0.3], [0.03, 0.03, 0.03], segs=6)
    B.tube("vq_robe_dark", [GRIP + FWD * 0.1, GRIP - FWD * 0.12], 0.045, segs=8)
    return HORN_Z + HORN_R + 0.06


GRIP = Vector((HORN_X - 0.3, HORN_Y, HORN_Z - 0.34))


# --- El vecino ----------------------------------------------------------------------------------------------------
def vecino(B, K):
    """De pie en la popa, mirando a la bocina. Devuelve lo alto del gorro."""
    base = Vector((MAN_X, MAN_Y, DECK_Z))
    # Zapatillas y pijama.
    for sy in (-1, 1):
        foot = base + Vector((0.08, sy * 0.15, 0.04))
        B.blob("vq_slipper", (0.13, 0.07, 0.045), foot, 2.6, 2.2, segs=10, rings=6)
        B.blob("vq_slipper", (0.07, 0.075, 0.05), foot + FWD * 0.02 + UP * 0.02, segs=8, rings=4)
        B.tube("vq_pyjama", [base + Vector((0.02, sy * 0.15, 0.06)), base + Vector((0.0, sy * 0.14, 0.42))], 0.07, segs=8)
    # La batita: barriga grande, el cinturón y las solapas.
    belly = base + UP * (0.36 + BELLY_R * 0.75)
    B.blob("vq_robe", (BELLY_R + 0.04, BELLY_R, BELLY_R + 0.03), belly, 2.2, 2.2, segs=20, rings=10)
    B.blob("vq_robe", (BELLY_R - 0.02, BELLY_R - 0.03, 0.2), belly - UP * 0.26, 2.0, 3.0, segs=16, rings=6)
    # Los hombros, algo más altos y estrechos, donde arranca el cuello.
    B.blob("vq_robe", (BELLY_R - 0.06, BELLY_R - 0.04, 0.16), belly + UP * 0.28, 2.0, 2.6, segs=16, rings=6)
    B.torus("vq_robe_dark", BELLY_R + 0.015, 0.035, Matrix.Translation(belly - UP * 0.04), nu=20, nv=6)
    knot = belly - UP * 0.04 + FWD * (BELLY_R + 0.02)
    B.blob("vq_robe_dark", (0.05, 0.06, 0.045), knot, segs=8, rings=4)
    for sy in (-1, 1):
        lapel = [belly + Vector((BELLY_R - 0.02, sy * 0.05, 0.1)), belly + Vector((BELLY_R - 0.06, sy * 0.14, 0.3))]
        B.tube("vq_robe_dark", lapel, [0.03, 0.045], segs=6)
    B.blob("vq_pyjama", (0.07, 0.1, 0.05), belly + Vector((BELLY_R - 0.08, 0.0, 0.3)), segs=8, rings=4)
    # Brazos: el izquierdo (a babor) en alto con el periódico; el derecho, a la bocina.
    sh_l = belly + Vector((0.08, BELLY_R + 0.02, 0.26))
    fist = sh_l + Vector((0.04, 0.16, 0.5))
    B.tube("vq_robe", [sh_l, sh_l + Vector((0.0, 0.2, 0.12)), fist - UP * 0.06], [0.085, 0.075, 0.065], segs=8)
    B.blob("vq_skin", (0.075, 0.075, 0.07), fist, segs=10, rings=6)
    paper = fist + UP * 0.03
    B.tube("paper", [paper + Vector((-0.2, -0.05, 0.04)), paper + Vector((0.24, 0.06, 0.1))], 0.045, segs=8)
    B.tube("ink", [paper + Vector((-0.05, -0.03, 0.06)), paper + Vector((0.08, 0.0, 0.08))], 0.047, segs=6)
    sh_r = belly + Vector((0.1, -(BELLY_R + 0.02), 0.24))
    hand = GRIP - FWD * 0.02
    B.tube("vq_robe", [sh_r, sh_r + Vector((0.16, -0.1, -0.04)), hand - FWD * 0.06], [0.085, 0.075, 0.065], segs=8)
    B.blob("vq_skin", (0.07, 0.07, 0.065), hand, segs=10, rings=6)
    # La cabeza.
    head_c = base + UP * (HEAD_Z - DECK_Z) + FWD * HEAD_X
    head = MASC.Body(head_c, HEAD_R, HEAD_R * 0.96, FWD, RIGHT)
    B.blob("vq_skin", (HEAD_R, HEAD_R, HEAD_R * 0.96), head_c, 2.0, 2.0, segs=24, rings=12)
    B.blob("vq_skin", (0.16, 0.14, 0.1), head_c - UP * 0.22 + FWD * 0.04, 2.0, 2.0, segs=12, rings=6)   # la papada
    B.tube("vq_skin", [head_c - UP * 0.3, head_c - UP * 0.15], 0.1, segs=10)                            # el cuello
    cara(B, head)
    return gorro(B, head)


def cara(B, head):
    k = 1.0
    # Ojos pequeños y apretados, con la pupila; cejas gruesas en pico (furioso).
    for sy, az in ((-1, 0.36), (1, -0.36)):
        p, n = head.point(az, 0.18)
        m = MASC.facing(n, p)
        B.blob("white", (0.06, 0.045, 0.02), (0, 0, 0), extra=m @ Matrix.Translation((0, 0, 0.005)), segs=12, rings=6)
        B.blob("ink", (0.028, 0.028, 0.012), (0, 0, 0), extra=m @ Matrix.Translation((0.005 * sy, -0.004, 0.022)), segs=8, rings=4)
        brow = [head.point(az + sy * 0.26, 0.3, -0.004)[0], head.point(az + sy * 0.04, 0.42, 0.0)[0], head.point(az - sy * 0.14, 0.54, 0.0)[0]]
        B.tube("vq_hair", brow, [0.024, 0.032, 0.026], segs=6)
    # La venita de enfado en la frente, dos cruces rojas.
    p, n = head.point(0.0, 0.78)
    m = MASC.facing(n, p + n * 0.004)
    for a in (35, -55):
        B.blob("vq_anger", (0.035, 0.008, 0.006), (0, 0, 0), extra=m @ rot("Z", a) @ Matrix.Translation((0, 0, 0.004)), segs=6, rings=4)
    # La nariz grande y las orejas.
    p, n = head.point(0.0, -0.02)
    B.blob("vq_skin_dark", (0.075, 0.065, 0.07), p + n * 0.04, segs=12, rings=6)
    for sy in (-1, 1):
        p, n = head.point(sy * math.pi / 2, -0.05)
        B.blob("vq_skin_dark", (0.03, 0.05, 0.07), p, segs=8, rings=4)
    # La boca abierta de par en par: hueco oscuro, dientes de arriba y lengua.
    p, n = head.point(0.0, -0.6)
    m = MASC.facing(n, p)
    B.blob("vq_mouth", (0.16, 0.11, 0.045), (0, 0, 0), extra=m @ Matrix.Translation((0, 0, -0.01)), p=2.6, q=2.0, segs=16, rings=8)
    B.blob("white", (0.12, 0.025, 0.015), (0, 0, 0), extra=m @ Matrix.Translation((0, 0.07, 0.03)), p=4.0, q=4.0, segs=10, rings=4)
    B.blob("jelly", (0.075, 0.05, 0.022), (0, 0, 0), extra=m @ Matrix.Translation((0, -0.05, 0.028)), segs=10, rings=4)
    # El bigote canoso, bajo la nariz y por encima de la boca abierta.
    for sy in (-1, 1):
        mus = [head.point(0.0, -0.2, 0.008)[0], head.point(sy * 0.28, -0.24, 0.012)[0], head.point(sy * 0.46, -0.34, 0.006)[0]]
        B.tube("vq_hair", mus, [0.024, 0.028, 0.016], segs=6)
    # Patillas y pelo de los lados: calvo arriba.
    for sy in (-1, 1):
        p, n = head.point(sy * 1.35, 0.2)
        B.blob("vq_hair", (0.07, 0.1, 0.11), p - n * 0.02, 2.2, 2.2, segs=10, rings=6)
    p, n = head.point(math.pi, 0.1)
    B.blob("vq_hair", (0.14, 0.2, 0.1), p - n * 0.03, 2.2, 2.2, segs=12, rings=6)


def gorro(B, head):
    """El gorro de dormir rojo: ancho en la cabeza, en punta y doblado hacia atrás, con el pompón. Devuelve su alto."""
    C = head.C
    seat = C + UP * (head.c * 0.72)
    B.torus("vq_cap_band", HEAD_R * 0.78, 0.05, Matrix.Translation(seat), nu=22, nv=6)
    base = seat + UP * 0.03
    mid = base + UP * 0.26 - FWD * 0.04
    tip = base + UP * 0.34 - FWD * 0.36 + RIGHT * 0.1
    pts, radii = [], []
    n = 8
    for i in range(n + 1):
        t = i / n
        pts.append((1 - t) ** 2 * base + 2 * (1 - t) * t * mid + t * t * tip)
        radii.append(max(0.03, HEAD_R * 0.8 * (1 - t) ** 0.85))
    B.tube("vq_cap", pts, radii, segs=16)
    B.blob("white", (0.07, 0.07, 0.07), tip, segs=12, rings=6)
    return max(p.z for p in pts) + 0.07


# --- La maceta del balcón ------------------------------------------------------------------------------------------
def maceta(B, at):
    B.lathe("terracotta", [(0.0, 0.0), (0.09, 0.0), (0.11, 0.17), (0.125, 0.18), (0.125, 0.21), (0.0, 0.21)], at, segs=12)
    B.blob("grass", (0.1, 0.1, 0.03), at + UP * 0.21, segs=10, rings=4)
    for dx, dy, h in ((0.0, 0.0, 0.22), (0.05, 0.03, 0.16), (-0.04, 0.05, 0.14), (-0.02, -0.05, 0.18)):
        p = at + Vector((dx, dy, 0.2))
        B.tube("pine", [p, p + UP * h], [0.012, 0.006], segs=4)
        B.blob("leaf", (0.05, 0.035, 0.05), p + UP * h, segs=8, rings=4)
    B.blob("pepper", (0.03, 0.03, 0.03), at + Vector((0.03, -0.03, 0.4)), segs=8, rings=4)

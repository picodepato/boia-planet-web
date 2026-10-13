"""«El guiri del flamenco» (plan 029, T270): el turista perdido que va a la deriva. MUESTRA.

Un turista quemado por el sol sentado en un flamenco hinchable rosa, dando
vueltas por el mapa sin saber dónde está el after. El flamenco: el aro con la
cola de plumas detrás y el cuello largo que sube por delante hasta la cabeza
con el pico negro. El guiri: barriga roja de sol, bañador azul de flores,
sombrero de paja con su cinta, gafas de sol, nariz pelada, un cubata con
pajita naranja en la mano izquierda y los pies colgando por delante del aro.

Tres piezas (PARTS), cada una un nodo del glTF con su pivote; el motor las
anima sólo con transformaciones:
    flotador   el flamenco entero (pivote en el origen: cabecea con el agua)
    guiri      el turista sentado (pivote en el asiento: se bambolea)
    brazo      el brazo derecho; pivote en el hombro (saluda al tocarlo)

Unidades: las de la escena de /mar (el barco mide 3,9 de eslora). Frente (la
cabeza del flamenco, hacia donde deriva) a +X de Blender; la línea de
flotación en z = 0; centro en el origen.
"""
import math

from mathutils import Matrix, Vector

ID = "guiri"
LABEL = "El guiri del flamenco"
DOC = ("turista quemado por el sol sentado en un flamenco hinchable rosa: aro con cola de plumas y cuello largo con "
       "pico negro; barriga roja, bañador azul de flores, sombrero de paja con cinta, gafas de sol, cubata con "
       "pajita naranja en la mano izquierda y el brazo derecho que saluda")
DETAIL = 0.6
# Pivote de cada pieza (Blender: x al frente, y a babor, z arriba), en orden (literal: check.py lo lee tal cual).
PARTS = {
    "flotador": (0.0, 0.0, 0.0),
    "guiri": (0.0, 0.0, 0.12),
    "brazo": (-0.02, -0.21, 0.64),
}
SEAT = PARTS["guiri"]
SHOULDER = PARTS["brazo"]

ROLES = {
    "gu_pink": "#F48FB1",        # el flamenco
    "gu_pink_dark": "#E0609A",   # las plumas de la cola y el pico de la nariz del flamenco
    "gu_beak": "#2B2B2B",        # el pico
    "gu_skin": "#E8735A",        # la piel, roja de sol
    "gu_skin_pale": "#F5C7A6",   # la marca blanca de las gafas y la nariz pelada
    "gu_shorts": "#3A7BD5",      # el bañador
    "gu_flower": "#FFE066",      # las flores del bañador
    "gu_hat": "#E9D18A",         # el sombrero de paja
    "gu_hat_band": "#C84B3C",    # su cinta
    "gu_shades": "#1E1E28",      # las gafas de sol
    "gu_drink": "#7FD3F7",       # el cubata
    "gu_straw": "#EC4F24",       # la pajita, naranja BOIA
    "gu_cheek": "#F06A6A",       # los coloretes
}
GLOW = {}

UP = Vector((0.0, 0.0, 1.0))
FWD = Vector((1.0, 0.0, 0.0))


def rot(axis, deg):
    return Matrix.Rotation(math.radians(deg), 4, axis)


def build(B, K):
    with B.pieza("flotador"):
        flamenco(B)
    with B.pieza("guiri"):
        top = turista(B)
    with B.pieza("brazo"):
        brazo(B)
    return {"length": 0.95 + 0.72, "height": top}


# --- El flamenco hinchable ------------------------------------------------------------------------------------
def flamenco(B):
    # El aro, hinchado: un toro algo ovalado, con la flotación a media altura.
    ring = Matrix.Translation(Vector((0.0, 0.0, 0.04))) @ Matrix.Diagonal((1.08, 1.0, 1.0, 1.0))
    B.torus("gu_pink", 0.5, 0.17, ring, nu=28, nv=10)
    # El fondo del asiento, donde se sienta el guiri.
    B.blob("gu_pink_dark", (0.36, 0.33, 0.03), Vector((0.0, 0.0, 0.02)), 3.0, 3.0, segs=18, rings=4)
    # La cola: tres plumas hinchadas en abanico, por detrás y algo levantadas.
    for i, (yaw, lift) in enumerate(((0, 28), (-26, 22), (26, 22))):
        m = rot("Z", yaw) @ rot("Y", -lift)
        at = Vector((-0.58, 0.0, 0.16)) + (rot("Z", yaw) @ Vector((-0.12, 0.0, 0.0)))
        B.blob("gu_pink_dark" if i else "gu_pink", (0.2, 0.07, 0.05), at, 2.2, 2.0, extra=m, segs=12, rings=6)
    # El cuello: sale del aro por delante y sube en S hasta la cabeza.
    neck = [Vector((0.5, 0.0, 0.1)), Vector((0.62, 0.0, 0.26)), Vector((0.7, 0.0, 0.46)),
            Vector((0.72, 0.0, 0.66)), Vector((0.78, 0.0, 0.82))]
    B.tube("gu_pink", neck, [0.11, 0.09, 0.075, 0.07, 0.065], segs=10)
    # La cabeza y el pico, hacia delante y abajo.
    head = Vector((0.84, 0.0, 0.88))
    B.blob("gu_pink", (0.11, 0.085, 0.085), head, 2.2, 2.2, segs=14, rings=8)
    beak = [head + Vector((0.08, 0.0, -0.01)), head + Vector((0.17, 0.0, -0.06)), head + Vector((0.23, 0.0, -0.13))]
    B.tube("gu_pink_dark", beak, [0.05, 0.04, 0.025], segs=8)
    B.blob("gu_beak", (0.045, 0.03, 0.03), beak[-1] + Vector((0.02, 0.0, -0.025)), 2.0, 2.0, segs=8, rings=4)
    # Los ojos del flamenco, blancos con el punto negro.
    for sy in (-1, 1):
        c = head + Vector((0.055, sy * 0.07, 0.03))
        look = (FWD * 0.6 + Vector((0.0, sy * 0.8, 0.2))).normalized()
        m = look.to_track_quat("Z", "Y").to_matrix().to_4x4()
        B.blob("white", (0.028, 0.028, 0.012), c, extra=m, segs=10, rings=6)
        B.blob("ink", (0.013, 0.013, 0.007), c + look * 0.012, extra=m, segs=8, rings=4)


# --- El turista -----------------------------------------------------------------------------------------------
def turista(B):
    """El guiri sentado en el aro; devuelve la altura del punto más alto (la copa del sombrero)."""
    seat = Vector(SEAT)
    # El bañador (la cadera y los muslos, sentados) con sus flores.
    hip = seat + Vector((0.0, 0.0, 0.1))
    B.blob("gu_shorts", (0.2, 0.24, 0.11), hip, 2.4, 2.2, segs=16, rings=8)
    for sy in (-1, 1):
        thigh = [hip + Vector((0.08, sy * 0.11, 0.02)), hip + Vector((0.3, sy * 0.13, 0.06))]
        B.tube("gu_shorts", thigh, [0.085, 0.07], segs=10)
        for dx, dz in ((0.0, 0.06), (0.16, 0.08)):
            B.blob("gu_flower", (0.025, 0.02, 0.012), hip + Vector((dx + 0.05, sy * 0.19, dz)), 1.6, 1.6,
                   segs=8, rings=4)
        # Las piernas, colgando por delante del aro, y los pies.
        knee = hip + Vector((0.36, sy * 0.14, 0.06))
        shin = [knee, knee + Vector((0.1, sy * 0.01, -0.14)), knee + Vector((0.14, sy * 0.02, -0.24))]
        B.tube("gu_skin", shin, [0.055, 0.045, 0.04], segs=8)
        B.blob("gu_skin", (0.075, 0.04, 0.03), shin[-1] + Vector((0.05, 0.0, -0.02)), 2.2, 2.0, segs=10, rings=4)
    # La barriga, bien roja de sol, y el pecho.
    belly = seat + Vector((0.0, 0.0, 0.34))
    B.blob("gu_skin", (0.19, 0.2, 0.22), belly, 2.2, 2.0, segs=18, rings=10)
    # Una franja pálida: la marca del tirante de la bolsa que ya no lleva.
    strap = [belly + Vector((0.15, -0.14, 0.17)), belly + Vector((0.19, 0.0, 0.0)), belly + Vector((0.15, 0.14, -0.17))]
    B.tube("gu_skin_pale", strap, 0.018, segs=6)
    # El hombro izquierdo y el brazo izquierdo, que sujeta el cubata.
    sh = belly + Vector((-0.02, 0.21, 0.18))
    B.blob("gu_skin", (0.07, 0.07, 0.07), sh, segs=10, rings=6)
    arm = [sh, sh + Vector((0.12, 0.08, -0.12)), sh + Vector((0.26, 0.04, -0.02))]
    B.tube("gu_skin", arm, [0.052, 0.045, 0.045], segs=8)
    hand = arm[-1] + Vector((0.04, 0.0, 0.02))
    B.blob("gu_skin", (0.05, 0.045, 0.04), hand, segs=10, rings=6)
    # El cubata: un vaso alto azulito con la pajita naranja.
    glass = hand + Vector((0.02, 0.0, 0.06))
    B.lathe("gu_drink", [(0.0, 0.0), (0.045, 0.0), (0.05, 0.08), (0.055, 0.14), (0.0, 0.14)], glass, segs=12)
    B.tube("gu_straw", [glass + Vector((0.01, 0.0, 0.1)), glass + Vector((0.04, 0.02, 0.26))], 0.008, segs=5)
    # El cuello y la cabeza.
    neck = belly + Vector((0.02, 0.0, 0.24))
    B.tube("gu_skin", [neck - UP * 0.02, neck + UP * 0.06], 0.06, segs=10)
    head = neck + Vector((0.02, 0.0, 0.2))
    B.blob("gu_skin", (0.15, 0.15, 0.16), head, 2.2, 2.2, segs=18, rings=10)
    # Las orejas.
    for sy in (-1, 1):
        B.blob("gu_skin", (0.03, 0.02, 0.04), head + Vector((-0.02, sy * 0.15, 0.0)), segs=8, rings=4)
    # La nariz pelada, los coloretes y la sonrisa de quien no se entera de nada.
    B.blob("gu_skin_pale", (0.045, 0.035, 0.035), head + Vector((0.14, 0.0, -0.03)), 2.2, 2.0, segs=10, rings=6)
    for sy in (-1, 1):
        B.blob("gu_cheek", (0.025, 0.02, 0.015), head + Vector((0.11, sy * 0.09, -0.07)), segs=8, rings=4)
    smile = [head + Vector((0.12, -0.06, -0.09)), head + Vector((0.145, 0.0, -0.105)), head + Vector((0.12, 0.06, -0.09))]
    B.tube("ink", smile, 0.008, segs=5)
    # Las gafas de sol: dos cristales con el puente y las patillas, y la marca pálida alrededor.
    for sy in (-1, 1):
        c = head + Vector((0.13, sy * 0.065, 0.04))
        look = (FWD * 0.9 + Vector((0.0, sy * 0.35, 0.2))).normalized()
        m = look.to_track_quat("Z", "Y").to_matrix().to_4x4()
        B.blob("gu_skin_pale", (0.055, 0.05, 0.01), c - look * 0.006, 2.4, 2.4, extra=m, segs=12, rings=4)
        B.blob("gu_shades", (0.045, 0.04, 0.014), c, 2.6, 2.6, extra=m, segs=12, rings=4)
        temple = [c + Vector((-0.02, sy * 0.045, 0.0)), head + Vector((-0.02, sy * 0.16, 0.05))]
        B.tube("gu_shades", temple, 0.007, segs=5)
    B.tube("gu_shades", [head + Vector((0.145, -0.03, 0.045)), head + Vector((0.145, 0.03, 0.045))], 0.008, segs=5)
    # El sombrero de paja: copa, ala ancha algo caída y la cinta roja.
    crown = head + Vector((-0.01, 0.0, 0.12))
    B.lathe("gu_hat", [(0.0, 0.0), (0.13, 0.0), (0.125, 0.07), (0.11, 0.1), (0.0, 0.1)], crown, segs=18)
    B.blob("gu_hat", (0.26, 0.26, 0.012), crown + UP * 0.005, 2.6, 2.6, segs=22, rings=4)
    band = Matrix.Translation(crown + UP * 0.025)
    B.torus("gu_hat_band", 0.128, 0.014, band, nu=18, nv=5)
    return crown.z + 0.1 + 0.02


# --- El brazo derecho -----------------------------------------------------------------------------------------
def brazo(B):
    """El brazo derecho desde el hombro, levantado a medias: el motor lo gira para saludar."""
    piv = Vector(SHOULDER)
    B.blob("gu_skin", (0.07, 0.07, 0.07), piv, segs=10, rings=6)
    arm = [piv, piv + Vector((0.06, -0.12, 0.12)), piv + Vector((0.1, -0.16, 0.3))]
    B.tube("gu_skin", arm, [0.052, 0.046, 0.042], segs=8)
    hand = arm[-1] + Vector((0.01, -0.01, 0.05))
    B.blob("gu_skin", (0.045, 0.035, 0.06), hand, 2.2, 2.0, segs=10, rings=6)
    for i in range(3):
        f0 = hand + Vector((0.0, -0.02 + i * 0.02, 0.05))
        B.tube("gu_skin", [f0, f0 + Vector((0.0, 0.0, 0.05))], 0.012, segs=5)

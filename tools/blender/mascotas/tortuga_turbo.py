"""«Tortuga turbo» (plan 015, T175): la mascota que nada detrás del barco. MUESTRA.

Una tortuga marina de barro pintado que sigue al barco por su estela: el
caparazón verde con sus placas, el rayo naranja de BOIA pintado encima como
una franja de carreras, gafas de aviador en la cabeza, una sonrisa y dos
tubos de escape de «turbo» asomando por detrás del caparazón. Cuatro aletas
que reman (las anima el motor).

Cinco piezas (PARTS), cada una un nodo del glTF con su pivote:
    body            caparazón, vientre, cabeza y cola (pivote en el origen)
    fl, fr, bl, br  aletas delantera/trasera izquierda/derecha; pivote en el
                    hombro (giran al remar)

Unidades: las de la escena de /mar (el barco mide 3,9 de eslora). Frente (la
cabeza, hacia donde nada) a +X de Blender; la línea de flotación en z = 0
(el motor la hunde y la saca un poco); centro en el origen.
"""
import math

from mathutils import Matrix, Vector

ID = "tortuga-turbo"
LABEL = "Tortuga turbo"
DOC = ("tortuga marina verde con las placas del caparazón, el rayo naranja de BOIA pintado encima, gafas de "
       "aviador, sonrisa, dos tubos de escape por detrás y cuatro aletas que reman detrás del barco")
DETAIL = 0.6
# Pivote de cada pieza (Blender: x al frente, y a babor, z arriba).
PARTS = {
    "body": (0.0, 0.0, 0.0),
    "fl": (0.24, 0.3, 0.1),
    "fr": (0.24, -0.3, 0.1),
    "bl": (-0.26, 0.27, 0.08),
    "br": (-0.26, -0.27, 0.08),
}

ROLES = {
    "tt_shell": "#3F8F5A",       # el caparazón
    "tt_plate": "#2E6E44",       # sus placas
    "tt_rim": "#6FB06A",         # el borde del caparazón
    "tt_belly": "#F3E2B4",       # el vientre
    "tt_skin": "#8CC86B",        # cabeza, cola y aletas
    "tt_skin_dark": "#5E9A4A",   # la punta de las aletas
    "tt_stripe": "#EC4F24",      # el rayo naranja de BOIA
    "tt_goggle": "#F2C230",      # el aro dorado de las gafas
    "tt_strap": "#3A2A1E",       # la correa
    "tt_lens": "#9ED7F5",        # el cristal
    "tt_pipe": "#4A5468",        # los tubos de escape
    "tt_cheek": "#F28BB8",       # los coloretes
}
GLOW = {}

UP = Vector((0.0, 0.0, 1.0))
FWD = Vector((1.0, 0.0, 0.0))


def rot(axis, deg):
    return Matrix.Rotation(math.radians(deg), 4, axis)


def build(B, K):
    with B.pieza("body"):
        top = cuerpo(B)
    for name, side, front in (("fl", 1, True), ("fr", -1, True), ("bl", 1, False), ("br", -1, False)):
        with B.pieza(name):
            aleta(B, Vector(PARTS[name]), side, front)
    return {"length": 0.56 + 0.7, "height": top}


# --- El cuerpo ------------------------------------------------------------------------------------------------
def cuerpo(B):
    # El caparazón: una cúpula sobre el vientre plano, con el borde claro.
    B.blob("tt_shell", (0.42, 0.34, 0.24), Vector((0.0, 0.0, 0.14)), 2.4, 2.4, segs=24, rings=12)
    B.blob("tt_belly", (0.4, 0.32, 0.07), Vector((0.0, 0.0, 0.08)), 2.4, 3.0, segs=20, rings=6)
    rim = Matrix.Translation(Vector((0.0, 0.0, 0.15))) @ Matrix.Diagonal((1.0, 0.82, 1.0, 1.0))
    B.torus("tt_rim", 0.415, 0.032, rim, nu=28, nv=6)
    # Las placas: una en lo alto y seis alrededor, pegadas a la cúpula (sobre su superficie, con su normal).
    plate(B, Vector((0.0, 0.0, 0.38)), UP, 0.1, 0.085)
    for i in range(6):
        p, n = shell_point(math.radians(30 + 60 * i), 0.3)
        plate(B, p, n, 0.1, 0.08)
    # El rayo naranja de BOIA, pintado sobre el caparazón de atrás adelante.
    ray = [Vector((-0.3, 0.02, 0.28)), Vector((-0.12, 0.07, 0.37)), Vector((-0.02, -0.03, 0.4)),
           Vector((0.12, 0.05, 0.37)), Vector((0.28, 0.0, 0.29))]
    B.tube("tt_stripe", ray, [0.02, 0.03, 0.032, 0.03, 0.018], segs=6)
    # Los tubos de escape del turbo, asomando por detrás del caparazón.
    for sy in (-1, 1):
        at = Vector((-0.36, sy * 0.13, 0.2))
        B.lathe("tt_pipe", [(0.0, 0.0), (0.03, 0.0), (0.035, 0.02), (0.035, 0.14), (0.045, 0.16), (0.045, 0.18), (0.0, 0.18)],
                at, segs=10, extra=rot("Y", -90))
        B.blob("ink", (0.006, 0.03, 0.03), at - FWD * 0.18, segs=8, rings=4)
    # La cabeza: el cuello sale por delante, la cabeza algo levantada.
    B.tube("tt_skin", [Vector((0.3, 0.0, 0.12)), Vector((0.46, 0.0, 0.17)), Vector((0.52, 0.0, 0.2))], [0.085, 0.075, 0.07], segs=8)
    head = Vector((0.58, 0.0, 0.22))
    B.blob("tt_skin", (0.15, 0.12, 0.11), head, 2.2, 2.2, segs=16, rings=8)
    # Los ojos con sus gafas de aviador (aro dorado, cristal azul) y la correa alrededor de la cabeza.
    for sy in (-1, 1):
        c = head + Vector((0.09, sy * 0.075, 0.045))
        look = (FWD * 0.85 + Vector((0.0, sy * 0.45, 0.25))).normalized()
        m = look.to_track_quat("Z", "Y").to_matrix().to_4x4()
        B.blob("white", (0.04, 0.045, 0.02), c, extra=m, segs=12, rings=6)
        B.blob("ink", (0.018, 0.02, 0.008), c + look * 0.018 + FWD * 0.004, extra=m, segs=8, rings=4)
        B.blob("tt_lens", (0.05, 0.052, 0.006), c + look * 0.026, extra=m, segs=12, rings=4)
        B.torus("tt_goggle", 0.05, 0.011, Matrix.Translation(c + look * 0.026) @ m, nu=16, nv=5)
        B.blob("tt_cheek", (0.02, 0.014, 0.01), head + Vector((0.08, sy * 0.1, -0.015)), segs=8, rings=4)
    strap = Matrix.Translation(head + UP * 0.045 + FWD * 0.01) @ Matrix.Diagonal((1.0, 0.95, 1.0, 1.0))
    B.torus("tt_strap", 0.135, 0.013, strap, nu=20, nv=5)
    # La sonrisa.
    smile = [head + Vector((0.13, -0.05, -0.035)), head + Vector((0.148, 0.0, -0.05)), head + Vector((0.13, 0.05, -0.035))]
    B.tube("ink", smile, 0.007, segs=5)
    # La cola.
    B.tube("tt_skin", [Vector((-0.38, 0.0, 0.1)), Vector((-0.5, 0.0, 0.09)), Vector((-0.56, 0.0, 0.1))], [0.045, 0.025, 0.012], segs=6)
    return 0.38 + 0.03 + 0.04


SHELL = ((0.42, 0.34, 0.24), (0.0, 0.0, 0.14), 2.4, 2.4)   # semiejes, centro y exponentes de la cúpula


def shell_point(ang, z):
    """Punto de la superficie del caparazón a la altura z en el acimut `ang`, y su normal (gradiente)."""
    (a, b, c), C, p, q = SHELL
    zz = (z - C[2]) / c
    f = max(0.0, 1.0 - abs(zz) ** q) ** (1.0 / q)      # cuánto se estrecha la superelipse a esa altura
    k = 1.0 / (abs(math.cos(ang)) ** p + abs(math.sin(ang)) ** p) ** (1.0 / p)
    x, y = f * a * math.cos(ang) * k, f * b * math.sin(ang) * k

    def F(X, Y, Z):
        return (abs(X / a) ** p + abs(Y / b) ** p) ** (q / p) + abs((Z - C[2]) / c) ** q

    e = 1e-4
    n = Vector(((F(x + e, y, z) - F(x - e, y, z)), (F(x, y + e, z) - F(x, y - e, z)), (F(x, y, z + e) - F(x, y, z - e))))
    return Vector((x, y, z)), n.normalized()


def plate(B, p, n, a, b):
    m = n.to_track_quat("Z", "Y").to_matrix().to_4x4()
    B.blob("tt_plate", (a, b, 0.022), p, 3.0, 3.0, extra=m, segs=10, rings=4)


# --- Las aletas -----------------------------------------------------------------------------------------------
def aleta(B, piv, side, front):
    """Una aleta plana desde el hombro `piv`, hacia fuera y (delante) hacia delante o (detrás) hacia atrás."""
    if front:
        yaw, size, d = side * 32, (0.21, 0.085, 0.03), Vector((0.1, side * 0.15, 0.0))
    else:
        yaw, size, d = -side * 38, (0.15, 0.07, 0.028), Vector((-0.07, side * 0.11, 0.0))
    m = rot("Z", yaw)
    B.blob("tt_skin", size, piv + d, 2.6, 2.2, extra=m, segs=14, rings=6)
    tip = piv + d + (m @ Vector((size[0] * 0.75, 0.0, 0.0)))
    B.blob("tt_skin_dark", (size[0] * 0.3, size[1] * 0.8, size[2] * 0.9), tip, 2.4, 2.2, extra=m, segs=10, rings=4)
    # El hombro, redondo, donde la aleta se une al cuerpo.
    B.blob("tt_skin", (0.05, 0.05, 0.04), piv, segs=10, rings=6)

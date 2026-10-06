"""«Cañoncito» (plan 015, T175): la mascota de cubierta que gana el castillo. MUESTRA.

Un cañón pequeño de juguete, de barro pintado como el resto del barco: la
cureña de madera con sus cuatro ruedas, el tubo de hierro azulado con sus
bandas y la franja naranja de BOIA, dos ojos grandes encima de la boca (es
una mascota, no un arma), una mecha que sale por detrás con su chispa y, en
la boca, una nube de humo que el motor enseña sólo al «disparar» (crece y
se encoge; en reposo no se ve).

Tres piezas (PARTS), cada una un nodo del glTF con su pivote: el motor las
anima sólo con transformaciones, como al minikraken:
    base    la cureña y las ruedas (no se mueve: el pivote en el origen)
    barrel  el tubo, con los ojos y la mecha; pivote en los muñones (gira y
            retrocede al disparar)
    puff    la nube de humo; pivote en la boca (escala 0 en reposo)

Unidades: las de la escena de /mar en cubierta (el minikraken mide 0,575 de
alto ahí). Frente (la boca del cañón, hacia la cámara en cubierta) a +X de
Blender; la cubierta en z = 0; centro en el origen.
"""
import math

from mathutils import Matrix, Vector

ID = "canoncito"
LABEL = "Cañoncito"
DOC = ("cañón de juguete sobre una cureña de madera con cuatro ruedas; tubo de hierro azulado con bandas y la "
       "franja naranja de BOIA, dos ojos grandes sobre la boca, mecha con chispa por detrás y una nube de humo "
       "en la boca que sólo se ve al disparar")
DETAIL = 0.6
# Pivote de cada pieza (Blender: x al frente, z arriba), en el orden de dibujo.
TRUNNION = (0.0, 0.0, 0.25)
MUZZLE = (0.33, 0.0, 0.25)
PARTS = {"base": (0.0, 0.0, 0.0), "barrel": (0.0, 0.0, 0.25), "puff": (0.33, 0.0, 0.25)}

ROLES = {
    "cn_wood": "#A86A3A",        # la cureña
    "cn_wood_dark": "#6E4224",   # ruedas y ejes
    "cn_iron": "#4A5468",        # el tubo
    "cn_iron_dark": "#2F3647",   # bandas y la boca
    "cn_band": "#EC4F24",        # la franja naranja de BOIA
    "cn_hub": "#F2C230",         # los bujes dorados
    "cn_fuse": "#D9C4A0",        # la mecha
    "cn_spark": "#FFD23F",       # la chispa
    "cn_smoke": "#F1ECE2",       # la nube de humo
    "cn_cheek": "#F28BB8",       # los coloretes
}
GLOW = {}

UP = Vector((0.0, 0.0, 1.0))
FWD = Vector((1.0, 0.0, 0.0))


def rot(axis, deg):
    return Matrix.Rotation(math.radians(deg), 4, axis)


def caja(B, role, size, at, extra=None, segs=8, rings=4):
    return B.blob(role, size, at, 6.0, 6.0, extra=extra, segs=segs, rings=rings)


def build(B, K):
    """Construye las tres piezas, cada una en su `B.pieza`. Devuelve las medidas para el manifiesto."""
    with B.pieza("base"):
        cureña(B)
    with B.pieza("barrel"):
        top = tubo(B)
    with B.pieza("puff"):
        humo(B)
    return {"length": 0.62 + 0.26, "height": top}


# --- La cureña ------------------------------------------------------------------------------------------------
def cureña(B):
    # El bloque de madera, algo más estrecho por delante, sobre dos largueros.
    caja(B, "cn_wood", (0.2, 0.13, 0.055), Vector((-0.03, 0.0, 0.13)), segs=12, rings=6)
    for sy in (-1, 1):
        caja(B, "cn_wood", (0.19, 0.025, 0.035), Vector((-0.02, sy * 0.115, 0.075)), segs=8, rings=4)
        # Las mejillas que sujetan los muñones del tubo.
        caja(B, "cn_wood", (0.09, 0.022, 0.07), Vector((0.0, sy * 0.1, 0.22)), segs=8, rings=4)
        B.blob("cn_wood_dark", (0.035, 0.018, 0.035), Vector((0.0, sy * 0.122, 0.25)), segs=8, rings=4)
    # Los ejes y las ruedas, con su buje dorado.
    for x in (-0.13, 0.1):
        B.tube("cn_wood_dark", [Vector((x, -0.17, 0.07)), Vector((x, 0.17, 0.07))], 0.016, segs=6)
        for sy in (-1, 1):
            at = Vector((x, sy * 0.16, 0.07))
            B.lathe("cn_wood_dark", [(0.0, 0.0), (0.07, 0.0), (0.075, 0.012), (0.075, 0.03), (0.07, 0.042), (0.0, 0.042)],
                    at, segs=14, extra=rot("X", -90 * sy))
            B.blob("cn_hub", (0.02, 0.012, 0.02), at + Vector((0.0, sy * 0.045, 0.0)), segs=8, rings=4)
    # La franja naranja de BOIA cruzando la cureña.
    B.tube("cn_band", [Vector((-0.16, -0.135, 0.17)), Vector((-0.16, 0.135, 0.17))], 0.018, segs=6)


# --- El tubo --------------------------------------------------------------------------------------------------
def tubo(B):
    """El tubo con sus bandas, los ojos y la mecha; devuelve la altura del punto más alto."""
    piv = Vector(TRUNNION)
    along = Matrix.Translation(piv) @ rot("Y", 90)
    # Un torno a lo largo de X: (radio, avance desde el pivote). Boca abocinada por delante, culata detrás.
    prof = [(0.0, -0.24), (0.05, -0.24), (0.075, -0.2), (0.085, -0.1), (0.08, 0.02), (0.075, 0.18),
            (0.085, 0.26), (0.1, 0.32), (0.1, 0.34), (0.0, 0.34)]
    B.lathe("cn_iron", prof, (0.0, 0.0, 0.0), segs=18, extra=along)
    # La boca oscura.
    B.blob("cn_iron_dark", (0.012, 0.075, 0.075), piv + FWD * 0.335, segs=12, rings=6)
    # El cascabel de la culata y los muñones.
    B.blob("cn_iron", (0.05, 0.05, 0.05), piv - FWD * 0.27, segs=10, rings=6)
    B.tube("cn_iron_dark", [piv + Vector((0.0, -0.13, 0.0)), piv + Vector((0.0, 0.13, 0.0))], 0.02, segs=6)
    # Bandas: dos de hierro oscuro y la naranja de BOIA en medio.
    for t, r, role in ((-0.13, 0.09, "cn_iron_dark"), (0.22, 0.082, "cn_iron_dark"), (0.06, 0.084, "cn_band")):
        m = Matrix.Translation(piv + FWD * t) @ rot("Y", 90)
        B.torus(role, r, 0.014, m, nu=18, nv=6)
    # Los ojos, encima del tubo cerca de la boca, mirando al frente y hacia arriba.
    for sy in (-1, 1):
        c = piv + Vector((0.2, sy * 0.045, 0.075))
        look = (FWD * 0.55 + UP * 0.8).normalized()
        m = look.to_track_quat("Z", "Y").to_matrix().to_4x4()
        B.blob("white", (0.036, 0.042, 0.016), c, extra=m, segs=12, rings=6)
        B.blob("ink", (0.016, 0.018, 0.008), c + look * 0.012 + FWD * 0.006, extra=m, segs=8, rings=4)
        B.blob("white", (0.006, 0.006, 0.004), c + look * 0.018 + FWD * 0.012 + Vector((0.0, -sy * 0.008, 0.004)),
               segs=6, rings=4)
        # Una ceja alegre y un colorete.
        brow = [c + Vector((-0.02, sy * 0.012, 0.03)), c + Vector((0.0, sy * 0.02, 0.038)), c + Vector((0.025, sy * 0.014, 0.032))]
        B.tube("ink", brow, 0.006, segs=5)
        B.blob("cn_cheek", (0.018, 0.012, 0.01), piv + Vector((0.2, sy * 0.082, 0.015)), segs=8, rings=4)
    # La mecha: sale de la culata y se riza hacia arriba, con la chispa en la punta.
    fuse = [piv - FWD * 0.3, piv + Vector((-0.34, 0.03, 0.04)), piv + Vector((-0.33, 0.07, 0.1)), piv + Vector((-0.29, 0.06, 0.14))]
    B.tube("cn_fuse", fuse, 0.012, segs=5)
    B.blob("cn_spark", (0.025, 0.025, 0.025), fuse[-1] + UP * 0.012, 1.2, 1.2, segs=8, rings=4)
    return piv.z + 0.1 + 0.04


# --- La nube de humo ------------------------------------------------------------------------------------------
def humo(B):
    """Cuatro nubecillas delante de la boca (el motor las escala desde 0 en el pivote)."""
    piv = Vector(MUZZLE)
    for d, s in (((0.07, 0.0, 0.02), 0.085), ((0.15, 0.035, 0.065), 0.06), ((0.14, -0.05, -0.02), 0.05),
                 ((0.22, -0.01, 0.035), 0.045)):
        B.blob("cn_smoke", (s, s, s * 0.9), piv + Vector(d), segs=10, rings=6)

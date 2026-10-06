"""La Isla de Nochevieja (T71): la montaña nevada de la fiesta de fin de año. MUESTRA.

El lugar `ultima` del mapa, donde se entrega la Boia Fiestera. Una isla de roca
fría con la meseta nevada y, detrás, una montaña con la cima de nieve. Arriba,
la torre del reloj de las campanadas (las agujas a punto de dar las doce) con
la bola dorada, y desde ella y desde cuatro focos de la explanada, rayos de
luces de fiesta hacia todas partes. Por la meseta, tiendas de campaña de
colores (iluminadas por dentro de noche) y boias de BOIA bailando con los
brazos arriba, alguna con bengala. Delante, el escenario redondo con su arco de
bombillas y bola de espejos (el sitio de la Fiestera), el cuenco de las doce
uvas, un racimo gigante, una botella de cava descorchándose en su cubitera, una
torre de copas, confeti por el suelo y serpentinas en el aire, y tres fuegos
artificiales con su estela sobre la isla. El muelle de tablas, al frente.

Medidas en unidades de escena del mar 3D (la isla de /mar mide R ≈ 7).
"""
import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector

import mascota as MASC

ID = "ultima"
LABEL = "Isla de Nochevieja"
DOC = ("montaña nevada con la torre del reloj de las campanadas y rayos de luces de fiesta hacia todas partes, "
       "tiendas de campaña con boias bailando, uvas, cava, confeti y fuegos artificiales")
RADIUS = 7.0            # orilla de la isla en z = 0, en unidades del modelo
SNOW = 0.82             # radio de la meseta nevada, en radios de la isla
DETAIL = 0.5            # segmentos de cada pieza respecto a los de los mundos (comun.ligero)

H = 1.0                 # alto de la roca
TOP = 1.45              # la meseta nevada
MOUNT = Vector((0.0, 1.9, TOP - 0.35))   # centro de la base de la montaña (detrás: el frente queda libre)
MOUNT_A, MOUNT_B, MOUNT_H, MOUNT_Q = 2.9, 2.5, 4.0, 1.3
STAGE = Vector((0.0, -1.5))              # el escenario de la Fiestera, en la explanada del frente

# Papeles nuevos de esta isla (color plano en el glTF); los demás son los del tema de arcilla.
ROLES = {
    "nv_rock": "#6F7C95",          # roca fría
    "nv_rock_dark": "#4E586F",
    "nv_snow": "#F2F6FB",          # nieve
    "nv_snow_shade": "#C9D9EA",    # ventisqueros y la falda de la montaña
    "nv_pine": "#2F6B4F",          # pinos nevados
    "nv_purple": "#7A4FC4",        # tiendas, confeti y aros
    "nv_grape": "#A6C83C",         # las doce uvas (verdes, las de Nochevieja)
    "nv_bottle": "#1F4A35",        # la botella de cava
    "nv_glass": "#DCEEF4",         # copas
}
# Papeles que brillan (emisivos): los rayos de las luces, los fuegos y la esfera del reloj.
GLOW = {
    "nv_beam_a": "#FF4FD8",
    "nv_beam_b": "#4FE3FF",
    "nv_beam_c": "#FFE14F",
    "nv_beam_d": "#7DFF6A",
    "nv_clock": "#FFF4D6",
}
BEAMS = ("nv_beam_a", "nv_beam_b", "nv_beam_c", "nv_beam_d")
TENTS = ("mascota", "firework_c", "fiestera", "fiestera_band", "nv_purple")
CONFETTI = ("fiestera", "fiestera_band", "firework_c", "nv_grape", "nv_purple")

# Tiendas: (ángulo en grados, 0 = +X, -90 = frente; distancia al centro; forma).
TIENDAS = [
    (-150, 4.4, "canadiense"), (-128, 5.0, "iglu"), (-168, 3.6, "iglu"), (-30, 4.4, "canadiense"),
    (-52, 5.0, "iglu"), (-12, 3.7, "canadiense"), (165, 4.6, "canadiense"), (145, 5.0, "iglu"),
    (15, 4.7, "iglu"), (35, 5.0, "canadiense"), (122, 4.9, "canadiense"), (58, 4.9, "iglu"),
]
# Boias bailando: (x, y, inclinación en grados, mano con bengala, boca, aro, bandas del aro).
BOIAS = [
    (-1.75, -2.55, 14, True, "habla", "fiestera_band", "fiestera"),
    (1.75, -2.55, -14, False, "sonrisa", "white", "mascota_gorro"),
    (-2.15, -0.75, -10, False, "sonrisa", "firework_c", "white"),
    (2.2, -0.75, 12, True, "sonrisa", "fiestera_band", "nv_purple"),
    (-3.55, 1.15, 10, False, "sonrisa", "white", "fiestera"),
    (3.75, 1.0, -12, True, "sonrisa", "fiestera_band", "fiestera"),
    (-4.05, -2.25, -8, False, "sonrisa", "firework_c", "white"),
]


def build(B, K):
    """Construye la isla con el Builder B; K es el módulo comun."""
    rng = random.Random(3112)
    R = RADIUS
    K.terreno(B, "nv_rock", R * 1.02, H, segs=40, rings=12, noise=K.shore_noise(3))
    K.terreno(B, "nv_rock_dark", R * 1.12, 0.25, sink=0.8, q=2.0, segs=32, rings=6, noise=K.shore_noise(7))
    # La meseta nevada.
    B.blob("nv_snow", (R * SNOW, R * SNOW, 0.9), Vector((0.0, 0.0, TOP - 0.9)), 2.0, 2.4, segs=40, rings=12)
    # Cantos de la orilla (sin tapar el muelle del frente).
    for i in range(11):
        ang = i * 360 / 11 + rng.uniform(-8, 8)
        if abs(((ang + 90 + 180) % 360) - 180) < 22:
            continue
        r = R * rng.uniform(0.93, 1.06)
        K.roca(B, "nv_rock_dark" if i % 2 else "nv_rock", K.polar(r, ang, 0.1), rng.uniform(0.45, 0.8), rng)
    # Ventisqueros en el borde de la meseta.
    for ang in (-140, -40, 160, 20):
        p = K.polar(R * 0.74, ang)
        B.blob("nv_snow_shade", (0.9, 0.55, 0.22), Vector((p.x, p.y, _ground(p) - 0.05)), 2.0, 2.0,
               extra=Matrix.Rotation(math.radians(ang + 90), 4, "Z"), segs=10, rings=4)

    # --- La montaña nevada y la torre del reloj -----------------------------------------------------------
    montana(B, "nv_rock", 1.0, None)
    montana(B, "nv_snow", 1.035, lambda th: 0.27 + 0.07 * math.sin(5 * th + 0.7) + 0.05 * math.sin(9 * th + 2.0))
    for ang, lat in ((-120, 0.18), (-62, 0.24), (-8, 0.12), (150, 0.16), (195, 0.22)):
        p = _mount_point(ang, lat, 0.98)
        K.roca(B, "nv_rock_dark", p, rng.uniform(0.4, 0.6), rng)
    summit = Vector((MOUNT.x, MOUNT.y - 0.15, MOUNT.z + MOUNT_H - 0.35))
    beam_from = torre_reloj(B, K, summit)

    # Rayos de las luces de fiesta desde la torre, hacia todas partes (alguno baja hacia el mar).
    for i in range(10):
        az = i * 36 + 12
        el = (52, 18, 35, -8, 64, 25, 8, 44, 15, 30)[i]
        d = Vector((math.cos(math.radians(az)) * math.cos(math.radians(el)),
                    math.sin(math.radians(az)) * math.cos(math.radians(el)), math.sin(math.radians(el))))
        rayo(B, BEAMS[i % 4], beam_from, d, (4.6, 3.6, 4.2, 3.0, 5.2, 3.8, 3.4, 4.8, 3.6, 4.0)[i], 0.13)

    # --- La explanada del frente: escenario de la Fiestera, focos y muelle -----------------------------------
    escenario(B, K)
    for x, y, az, el in ((-3.0, -3.4, -150, 68), (3.6, -2.6, -20, 64), (-3.2, -0.2, 140, 60), (3.3, -0.2, 40, 66)):
        foco(B, Vector((x, y, _ground(Vector((x, y))))), az, el, BEAMS[(int(x) + int(y)) % 4])
    K.muelle(B, Vector((0.0, -R * 0.9, 0.0)), 2.6, width=1.1)
    # Camino del muelle al escenario con farolillos y una guirnalda de bombillas.
    posts = []
    for i, s in enumerate((-1, 1, -1, 1)):
        y = -R * 0.8 + (i // 2) * 1.25
        p = Vector((s * 0.85, y))
        z = _ground(p)
        top = Vector((p.x, p.y, z + 0.95))
        B.tube("wood_dark", [Vector((p.x, p.y, z - 0.1)), top], 0.045, segs=6)
        B.blob("lantern", (0.11, 0.11, 0.13), top + Vector((0, 0, 0.08)), segs=8, rings=4)
        posts.append(top)
    for s in (0, 1):
        a, b = posts[s], posts[s + 2]
        pts = [a.lerp(b, t) - Vector((0, 0, 0.18 * math.sin(math.pi * t))) for t in (i / 6 for i in range(7))]
        B.tube("wire", pts, 0.012, segs=4)
        for j, t in enumerate((0.25, 0.5, 0.75)):
            q = a.lerp(b, t) - Vector((0, 0, 0.18 * math.sin(math.pi * t) + 0.06))
            B.blob(("bulb", "stage_magenta", "nv_beam_b")[j], (0.05, 0.05, 0.06), q, segs=8, rings=4)

    # --- Tiendas de campaña y pinos nevados ---------------------------------------------------------------
    for i, (ang, r, forma) in enumerate(TIENDAS):
        p = K.polar(r, ang)
        p.z = _ground(p)
        look = (p.normalized() * 0.7 + K.FRONT * 0.6).normalized()
        if forma == "canadiense":
            canadiense(B, TENTS[i % len(TENTS)], p, look, s=1.0 + 0.12 * (i % 3))
        else:
            iglu(B, TENTS[(i + 2) % len(TENTS)], p, look, s=0.95 + 0.1 * (i % 2))
    for ang, r, h in ((100, 5.6, 1.3), (138, 4.0, 1.1), (75, 4.2, 1.2), (-172, 5.4, 1.0), (-4, 5.5, 1.1),
                      (28, 3.9, 1.0)):
        p = K.polar(r, ang)
        pino(B, Vector((p.x, p.y, _ground(p) - 0.05)), h)

    # --- Fin de año: uvas, cava, confeti y fuegos artificiales ---------------------------------------------
    uvas_cuenco(B, Vector((-0.95, -3.35)))
    racimo(B, Vector((-3.0, -3.9)), 1.0)
    cava(B, Vector((2.55, -3.75)))
    copas(B, Vector((1.0, -3.6)))
    confeti(B, rng)
    for at, rad, roles, launch in (((-3.6, 2.6, 7.6), 1.35, ("nv_beam_a", "nv_beam_c"), (-2.6, 0.6)),
                                   ((3.9, 2.2, 7.0), 1.15, ("nv_beam_b", "flash"), (2.9, 0.3)),
                                   ((0.9, 4.6, 9.0), 1.55, ("nv_beam_c", "nv_beam_d"), (1.2, 3.9))):
        fuego(B, Vector(at), rad, roles, Vector(launch), rng)

    # --- Las boias bailando ---------------------------------------------------------------------------------
    for x, y, tilt, bengala, boca, aro, bandas in BOIAS:
        p = Vector((x, y, 0.0))
        p.z = _ground(p) - 0.02
        look = ((p - Vector((STAGE.x, STAGE.y, p.z))).normalized() * 0.5 + K.FRONT).normalized()
        boia_bailona(B, K, p, 1.15, K.g_toward(look), tilt, bengala, boca, aro, bandas)
    return {"top": TOP, "height": 9.0 + 1.55 + 0.2}


# --- Terreno ---------------------------------------------------------------------------------------------
def _mount_r(th, z_rel):
    """Ruido de la montaña: radio relativo según el ángulo y la altura."""
    return 1.0 + 0.11 * math.sin(3 * th + 1.1) + 0.06 * math.sin(7 * th + 0.4 + 2.0 * z_rel) + 0.04 * math.sin(11 * th)


def montana(B, role, scale, snowline):
    """La montaña: superelipsoide en punta con ruido; con `snowline(θ)` (en altos), sólo lo de encima: la nieve."""
    bm = bmesh.new()
    c = MOUNT_H + 0.6
    B.G.superquadric(bm, (MOUNT_A * scale, MOUNT_B * scale, c * scale), 2.0, MOUNT_Q, segs=28, rings=12)
    for v in bm.verts:
        th = math.atan2(v.co.y, v.co.x)
        z_rel = max(0.0, v.co.z) / (c * scale)
        f = _mount_r(th, z_rel)
        v.co.x *= f
        v.co.y *= f
        v.co.z = max(v.co.z - 0.6, -0.6)
        if snowline is not None:
            line = snowline(th) * MOUNT_H
            if v.co.z < line:
                # Por debajo de la línea de nieve, la lámina se mete dentro de la roca.
                k = 0.8
                v.co.x *= k
                v.co.y *= k
                v.co.z = line - 0.15
    bmesh.ops.translate(bm, verts=bm.verts[:], vec=MOUNT)
    return B.mk(bm, role, sharp=55)


def _mount_z(p):
    """Alto de la montaña (sin ruido) sobre el punto p, o -inf fuera de ella."""
    dx, dy = (p.x - MOUNT.x) / MOUNT_A, (p.y - MOUNT.y) / MOUNT_B
    rho = math.hypot(dx, dy)
    if rho >= 1.0:
        return -1e9
    c = MOUNT_H + 0.6
    return MOUNT.z - 0.6 + c * (1.0 - rho ** MOUNT_Q) ** (1.0 / MOUNT_Q)


def _mount_point(ang, lat, k=1.0):
    """Punto de la ladera de la montaña: ángulo en planta (grados) y altura relativa lat (0 base … 1 cima)."""
    c = MOUNT_H + 0.6
    zr = 0.6 / c + lat * (1.0 - 0.6 / c)
    rho = (1.0 - zr ** MOUNT_Q) ** (1.0 / MOUNT_Q) * k
    th = math.radians(ang)
    f = _mount_r(th, zr)
    return Vector((MOUNT.x + MOUNT_A * rho * f * math.cos(th), MOUNT.y + MOUNT_B * rho * f * math.sin(th),
                   MOUNT.z - 0.6 + c * zr))


def _ground(p):
    """Alto aproximado del suelo en el punto p: la roca, la meseta nevada o la montaña."""
    R = RADIUS
    d = math.hypot(p.x, p.y)
    rock = (H + 0.6) * max(0.0, 1.0 - min(1.0, d / (R * 1.02)) ** 2.4) ** (1 / 2.4) - 0.6
    snow = TOP - 0.9 + 0.9 * max(0.0, 1.0 - min(1.0, d / (R * SNOW)) ** 2.4) ** (1 / 2.4)
    return max(rock, snow, _mount_z(p))


# --- La torre del reloj ----------------------------------------------------------------------------------
def torre_reloj(B, K, at):
    """Torre blanca con el reloj de las campanadas mirando al puerto (las doce menos uno) y la bola dorada."""
    w, d, h = 0.62, 0.5, 1.15
    base = Vector(at)
    K.caja(B, "nv_snow_shade", (w * 1.25, d * 1.25, 0.18), base + Vector((0, 0, 0.05)))
    K.caja(B, "nv_snow", (w, d, h * 0.5), base + Vector((0, 0, h * 0.5)))
    roof = base + Vector((0, 0, h))
    K.caja(B, "fiestera", (w * 1.12, d * 1.12, 0.08), roof)
    B.lathe("metal", [(0.0, 0.0), (0.42, 0.0), (0.34, 0.22), (0.12, 0.42), (0.0, 0.46)], tuple(roof), segs=12)
    # La bola dorada en su mástil.
    mast_top = roof + Vector((0, 0, 0.95))
    B.tube("metal", [roof + Vector((0, 0, 0.4)), mast_top], 0.035, segs=6)
    B.blob("gold", (0.2, 0.2, 0.2), mast_top - Vector((0, 0, 0.12)), segs=14, rings=8)
    # La esfera: disco que brilla, aro dorado, doce marcas y las agujas.
    n = K.FRONT
    c = base + Vector((0, -d - 0.02, h * 0.58))
    rr = 0.46
    m = MASC.facing(n, c)
    B.blob("nv_clock", (rr, rr, 0.05), (0, 0, 0), extra=m, segs=24, rings=6)
    B.torus("gold", rr, 0.05, m, nu=24, nv=6)
    for i in range(12):
        a = math.pi / 2 - 2 * math.pi * i / 12
        big = i % 3 == 0
        q = m @ Vector((0.36 * rr / 0.46 * math.cos(a), 0.36 * rr / 0.46 * math.sin(a), 0.05))
        s = 0.05 if big else 0.03
        B.blob("ink", (s, s, 0.02), (0, 0, 0), extra=MASC.facing(n, q), segs=8, rings=4)
    hub = m @ Vector((0, 0, 0.06))
    B.tube("ink", [hub, m @ Vector((0.0, 0.24, 0.07))], [0.04, 0.025], segs=5)        # horaria: las doce
    a = math.radians(96)                                                                 # minutero: un minuto antes
    B.tube("ink", [hub, m @ Vector((0.38 * math.cos(a), 0.38 * math.sin(a), 0.08))], [0.03, 0.015], segs=5)
    B.blob("gold", (0.05, 0.05, 0.03), (0, 0, 0), extra=MASC.facing(n, m @ Vector((0, 0, 0.09))), segs=8, rings=4)
    # Una campana a cada lado, bajo el tejado.
    for s in (-1, 1):
        bc = base + Vector((s * (w + 0.05), 0.0, h * 0.82))
        B.lathe("gold", [(0.0, 0.18), (0.08, 0.17), (0.11, 0.05), (0.16, -0.02), (0.0, -0.02)], tuple(bc), segs=10)
    return roof + Vector((0, 0, 0.25))


def rayo(B, role, origin, direction, length, spread):
    """Rayo de luz de fiesta: cono fino que brilla, del punto `origin` hacia `direction`."""
    m = MASC.facing(direction, origin)
    B.lathe(role, [(0.0, 0.0), (0.03, 0.0), (spread, length), (0.0, length)], (0, 0, 0), segs=8, extra=m)


def foco(B, at, az, el, role):
    """Foco de escenario en el suelo con su rayo hacia el cielo."""
    a, e = math.radians(az), math.radians(el)
    d = Vector((math.cos(a) * math.cos(e), math.sin(a) * math.cos(e), math.sin(e)))
    B.blob("metal", (0.28, 0.28, 0.12), at + Vector((0, 0, 0.05)), 2.0, 4.0, segs=10, rings=4)
    head = at + Vector((0, 0, 0.32))
    B.lathe("metal", [(0.0, -0.2), (0.12, -0.2), (0.2, 0.12), (0.17, 0.14), (0.0, 0.1)], (0, 0, 0), segs=10,
            extra=MASC.facing(d, head))
    rayo(B, role, head + d * 0.12, d, 4.6, 0.14)


# --- El escenario de la Fiestera --------------------------------------------------------------------------
def escenario(B, K):
    """Tarima redonda con el arco de bombillas y la bola de espejos: aquí baila la Fiestera."""
    c = Vector((STAGE.x, STAGE.y, 0.0))
    c.z = _ground(c)
    B.lathe("wood", [(0.0, -0.2), (1.15, -0.2), (1.2, 0.18), (1.12, 0.24), (0.0, 0.24)], tuple(c), segs=24)
    B.torus("fiestera_band", 1.17, 0.05, Matrix.Translation(c + Vector((0, 0, 0.12))), nu=24, nv=4)
    # Escalones hacia el muelle.
    for i in range(2):
        K.caja(B, "wood", (0.5, 0.16, 0.06 + 0.05 * i), c + Vector((0, -1.3 + 0.18 * i, 0.04 + 0.05 * i)))
    # El arco de bombillas por detrás.
    arc = []
    for i in range(13):
        t = math.pi * i / 12
        arc.append(c + Vector((1.05 * math.cos(t), 0.55, 0.24 + 1.9 * math.sin(t))))
    B.tube("gold", arc, 0.06, segs=6)
    bulbs = ("bulb", "stage_magenta", "nv_beam_b", "nv_beam_c")
    for i in range(1, 12):
        t = math.pi * i / 12
        q = c + Vector((1.05 * math.cos(t), 0.47, 0.24 + 1.9 * math.sin(t)))
        B.blob(bulbs[i % 4], (0.075, 0.075, 0.075), q, segs=8, rings=4)
    # La bola de espejos colgando del arco.
    top = c + Vector((0, 0.55, 2.14))
    ball = c + Vector((0, 0.3, 1.55))
    B.tube("wire", [top, ball + Vector((0, 0, 0.22))], 0.012, segs=4)
    B.blob("metal", (0.24, 0.24, 0.24), ball, segs=12, rings=8)
    for i in range(6):
        a = 2 * math.pi * i / 6
        q = ball + Vector((0.23 * math.cos(a), 0.23 * math.sin(a), 0.05 * (i % 2)))
        B.blob(bulbs[i % 4], (0.04, 0.04, 0.04), q, segs=6, rings=4)


# --- Tiendas, pinos -----------------------------------------------------------------------------------------
def _yaw_to(look):
    """Giro en Z que lleva el -Y local hacia la dirección horizontal `look`."""
    return math.atan2(look.x, -look.y)


def canadiense(B, role, at, look, s=1.0):
    """Tienda canadiense (de dos aguas) con la puerta hacia `look`, encendida por dentro de noche."""
    W, L, Ht = 0.95 * s, 1.15 * s, 0.85 * s
    m = Matrix.Translation(at - Vector((0, 0, 0.04))) @ Matrix.Rotation(_yaw_to(look), 4, "Z")
    bm = bmesh.new()
    fl, fr, ft = (bm.verts.new(m @ Vector(v)) for v in ((-W / 2, -L / 2, 0), (W / 2, -L / 2, 0), (0, -L / 2, Ht)))
    bl, br, bt = (bm.verts.new(m @ Vector(v)) for v in ((-W / 2, L / 2, 0), (W / 2, L / 2, 0), (0, L / 2, Ht)))
    for f in ((fl, bl, bt, ft), (fr, ft, bt, br), (fl, ft, fr), (bl, br, bt), (fl, fr, br, bl)):
        bm.faces.new(f)
    B.mk(bm, role, sharp=20)
    # La puerta: triángulo que brilla un poco por delante.
    bm = bmesh.new()
    vs = []
    for y in (-L / 2 - 0.012, -L / 2 - 0.03):
        vs += [bm.verts.new(m @ Vector(v)) for v in ((-W * 0.24, y, 0.02), (W * 0.24, y, 0.02), (0, y, Ht * 0.62))]
    bm.faces.new(vs[:3])
    bm.faces.new(vs[3:][::-1])
    for i in range(3):
        j = (i + 1) % 3
        bm.faces.new((vs[i], vs[3 + i], vs[3 + j], vs[j]))
    B.mk(bm, "lantern", sharp=20)
    # Los palos de la cumbrera, asomando.
    for y in (-L / 2 - 0.02, L / 2 + 0.02):
        B.tube("wood_dark", [m @ Vector((0, y, Ht - 0.05)), m @ Vector((0, y * 1.08, Ht + 0.16))], 0.025, segs=4)


def iglu(B, role, at, look, s=1.0):
    """Tienda iglú (cúpula) con la puerta en arco hacia `look`, encendida por dentro de noche."""
    a, b, c = 0.72 * s, 0.64 * s, 0.5 * s
    yaw = _yaw_to(look)
    B.blob(role, (a, b, c), at - Vector((0, 0, 0.08)), 2.0, 2.0, extra=Matrix.Rotation(yaw, 4, "Z"), segs=14, rings=8)
    rot = Matrix.Rotation(yaw, 4, "Z")
    door = at + (rot @ Vector((0, -b * 0.9, 0.14 * s)))
    B.blob("lantern", (0.2 * s, 0.05, 0.22 * s), door, extra=rot @ Matrix.Rotation(math.radians(-12), 4, "X"),
           segs=8, rings=4)
    # Las varillas cruzadas.
    for k in (-1, 1):
        pts = []
        for i in range(5):
            t = math.pi * i / 4
            v = Vector((k * 0.72 * a * math.cos(t), 0.72 * b * math.cos(t), 1.03 * c * math.sin(t)))
            pts.append(at - Vector((0, 0, 0.08)) + rot @ v)
        B.tube("wire", pts, 0.018, segs=4)


def pino(B, base, h):
    """Pino nevado: dos pisos de copa verde con su nieve encima y el tronco."""
    B.tube("wood_dark", [base, base + Vector((0, 0, h * 0.3))], 0.08 * h, segs=6)
    for i, (r, z0, z1) in enumerate(((0.62, 0.22, 0.75), (0.45, 0.6, 1.05))):
        B.lathe("nv_pine", [(0.0, z0 * h), (r * h, z0 * h), (0.0, z1 * h)], tuple(base), segs=8)
        B.lathe("nv_snow", [(0.0, (z1 - 0.18) * h), (r * 0.42 * h, (z1 - 0.2) * h), (0.0, z1 * h + 0.03)], tuple(base),
                segs=8)


# --- Uvas, cava y confeti ----------------------------------------------------------------------------------
def uva(B, at, r):
    """Una uva: esfera de pocas caras con sombreado suave (se ve redonda)."""
    bm = bmesh.new()
    B.G.superquadric(bm, (r, r, r * 1.1), 2.0, 2.0, matrix=Matrix.Translation(at), segs=8, rings=4)
    return B.mk(bm, "nv_grape", sharp=89)


def uvas_cuenco(B, xy):
    """Las doce uvas en un cuenco blanco, sobre una mesita."""
    p = Vector((xy.x, xy.y, _ground(xy)))
    B.tube("wood_dark", [p, p + Vector((0, 0, 0.45))], 0.06, segs=6)
    B.blob("wood", (0.42, 0.42, 0.04), p + Vector((0, 0, 0.47)), 2.0, 4.0, segs=12, rings=4)
    bowl = p + Vector((0, 0, 0.5))
    B.lathe("white", [(0.0, 0.0), (0.14, 0.0), (0.3, 0.12), (0.33, 0.2), (0.28, 0.2), (0.0, 0.1)], tuple(bowl), segs=12)
    for i in range(12):
        a = 2 * math.pi * i / 9 if i < 9 else 2 * math.pi * (i - 9) / 3 + 0.5
        r, z = (0.19, 0.2) if i < 9 else (0.07, 0.29)
        uva(B, bowl + Vector((r * math.cos(a), r * math.sin(a), z)), 0.075)


def racimo(B, xy, s):
    """Racimo de uvas gigante plantado en la nieve, con su rabo y una hoja."""
    p = Vector((xy.x, xy.y, _ground(xy)))
    top = p + Vector((0, 0, 1.45 * s))
    B.tube("wood_dark", [p - Vector((0, 0, 0.1)), top + Vector((0, 0.12, 0.1))], 0.05, segs=6)
    rows = ((0.36, 5, 0.0), (0.28, 4, 0.3), (0.16, 3, 0.6), (0.0, 1, 0.86))
    for j, (r, n, dz) in enumerate(rows):
        for i in range(n):
            a = 2 * math.pi * i / n + j * 0.6
            q = top + Vector((r * s * math.cos(a), r * s * math.sin(a) - 0.05 * s, -dz * s))
            uva(B, q, 0.2 * s)
    B.tube("wood_dark", [top + Vector((0, 0, 0.05)), top + Vector((0.05, 0, 0.3 * s)), top + Vector((0.2, 0, 0.42 * s))],
           0.045 * s, segs=5)
    B.blob("nv_pine", (0.32 * s, 0.2 * s, 0.03), top + Vector((-0.22 * s, 0.05, 0.25 * s)),
           extra=Matrix.Rotation(0.5, 4, "Z") @ Matrix.Rotation(-0.35, 4, "Y"), segs=10, rings=4)


def cava(B, xy):
    """Botella de cava gigante en su cubitera con hielo, descorchándose: el tapón vuela y sale la espuma."""
    p = Vector((xy.x, xy.y, _ground(xy)))
    B.lathe("metal", [(0.0, 0.0), (0.42, 0.0), (0.52, 0.62), (0.57, 0.66), (0.5, 0.66), (0.0, 0.5)], tuple(p), segs=14)
    for i in range(6):
        a = 2 * math.pi * i / 6 + 0.3
        K_ice = p + Vector((0.38 * math.cos(a), 0.38 * math.sin(a), 0.62))
        B.blob("nv_glass", (0.11, 0.11, 0.09), K_ice, 6.0, 6.0, extra=Matrix.Rotation(a, 4, "Z"), segs=8, rings=4)
    tilt = Matrix.Rotation(math.radians(-22), 4, "X") @ Matrix.Rotation(math.radians(10), 4, "Y")
    m = Matrix.Translation(p + Vector((0, 0, 0.15))) @ tilt
    B.lathe("nv_bottle", [(0.0, 0.0), (0.3, 0.0), (0.32, 0.05), (0.32, 1.0), (0.28, 1.18), (0.13, 1.42), (0.1, 1.72),
                          (0.115, 1.78), (0.0, 1.8)], (0, 0, 0), segs=14, extra=m)
    B.lathe("gold", [(0.0, 1.45), (0.135, 1.45), (0.12, 1.83), (0.0, 1.85)], (0, 0, 0), segs=12, extra=m)
    B.lathe("white", [(0.0, 0.45), (0.335, 0.45), (0.335, 0.86), (0.0, 0.86)], (0, 0, 0), segs=14, extra=m)
    B.lathe("gold", [(0.0, 0.58), (0.34, 0.58), (0.34, 0.72), (0.0, 0.72)], (0, 0, 0), segs=14, extra=m)
    # El tapón por los aires y el chorro de espuma.
    mouth = m @ Vector((0, 0, 1.86))
    axis = (m.to_3x3() @ Vector((0, 0, 1))).normalized()
    cork = mouth + axis * 1.1 + Vector((0, 0, 0.35))
    B.lathe("wood", [(0.0, 0.0), (0.1, 0.0), (0.12, 0.16), (0.0, 0.18)], (0, 0, 0), segs=8,
            extra=MASC.facing(axis, cork))
    for i in range(5):
        t = (i + 1) / 5
        q = mouth + axis * (0.9 * t) + Vector((0.0, -0.25 * t * t, 0.35 * t - 0.5 * t * t))
        r = 0.09 + 0.11 * t
        B.blob("white", (r, r, r * 0.9), q, segs=8, rings=4)
    for i in range(3):
        a = 2 * math.pi * i / 3
        B.blob("white", (0.05, 0.05, 0.05), mouth + axis * 0.5 + Vector((0.3 * math.cos(a), 0.3 * math.sin(a), 0.2)),
               segs=6, rings=4)


def copas(B, xy):
    """Torre de copas de cava (tres, dos y una), llenas."""
    p = Vector((xy.x, xy.y, _ground(xy)))
    B.blob("wood", (0.5, 0.32, 0.05), p + Vector((0, 0, 0.05)), 2.0, 4.0, segs=12, rings=4)
    s = 1.05
    prof = [(0.0, 0.0), (0.17, 0.0), (0.025, 0.05), (0.022, 0.28), (0.24, 0.36), (0.26, 0.43), (0.0, 0.4)]
    prof = [(r * s, z * s) for r, z in prof]
    hgt = 0.42 * s
    for row, n in enumerate((3, 2, 1)):
        for i in range(n):
            x = (i - (n - 1) / 2) * 0.5 * s
            q = p + Vector((x, 0.0, 0.1 + row * hgt))
            B.lathe("nv_glass", prof, tuple(q), segs=8)
            B.blob("gold", (0.22 * s, 0.22 * s, 0.025), q + Vector((0, 0, 0.41 * s)), 2.0, 4.0, segs=10, rings=4)


def confeti(B, rng):
    """Confeti de colores por la nieve de la explanada y en el aire sobre el escenario; serpentinas."""
    per = {role: bmesh.new() for role in CONFETTI}
    for i in range(80):
        role = CONFETTI[i % len(CONFETTI)]
        bm = per[role]
        if i < 52:
            # En el suelo: tumbado y con un giro cualquiera.
            r, a = rng.uniform(1.2, 5.2), math.radians(rng.uniform(-170, -10))
            xy = Vector((r * math.cos(a), r * math.sin(a) * 0.9))
            at = Vector((xy.x, xy.y, _ground(xy) + 0.015))
            rot = Matrix.Rotation(rng.uniform(0, math.pi), 4, "Z") @ Matrix.Rotation(rng.uniform(-0.25, 0.25), 4, "X")
        else:
            # En el aire, alrededor del escenario.
            a = rng.uniform(0, 2 * math.pi)
            r = rng.uniform(0.3, 2.4)
            at = Vector((STAGE.x + r * math.cos(a), STAGE.y + r * math.sin(a), TOP + rng.uniform(1.6, 3.6)))
            rot = Matrix.Rotation(rng.uniform(0, math.pi), 4, "Z") @ Matrix.Rotation(rng.uniform(0, math.pi), 4, "X")
        w, h, t = 0.09, 0.06, 0.012
        vs = [bm.verts.new(at + rot @ Vector((sx * w, sy * h, sz * t)))
              for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)]
        for f in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
            bm.faces.new([vs[k] for k in f])
    for role, bm in per.items():
        B.mk(bm, role, sharp=20)
    # Serpentinas en rizo sobre el escenario.
    for i, (dx, dy, z0, role) in enumerate(((-1.2, 0.2, 3.3, "fiestera"), (1.1, -0.1, 3.6, "fiestera_band"),
                                            (0.2, -0.9, 3.9, "firework_c"), (-0.4, 0.6, 4.2, "nv_grape"))):
        c = Vector((STAGE.x + dx, STAGE.y + dy, TOP + z0 - 1.0))
        pts = [c + Vector((0.18 * math.cos(t * 1.2), 0.18 * math.sin(t * 1.2), -0.09 * t + 0.3 * math.sin(t * 0.4 + i)))
               for t in (j * 0.7 for j in range(16))]
        B.tube(role, pts, 0.022, segs=4)


def fuego(B, C, rad, roles, launch, rng):
    """Fuego artificial: palmera de rayos con chispas en la punta, y la estela que sube del suelo."""
    B.blob(roles[0], (0.16, 0.16, 0.16), C, segs=8, rings=4)
    n = 12
    for i in range(n):
        # Direcciones repartidas por la esfera (espiral de Fibonacci).
        z = 1 - 2 * (i + 0.5) / n
        a = i * math.pi * (3 - math.sqrt(5)) + rng.uniform(-0.1, 0.1)
        d = Vector((math.sqrt(1 - z * z) * math.cos(a), math.sqrt(1 - z * z) * math.sin(a), z))
        d.z -= 0.15                       # las chispas caen un poco
        d.normalize()
        role = roles[i % 2]
        B.tube(role, [C + d * rad * 0.3, C + d * rad * 0.95], [0.055, 0.02], segs=4)
        B.blob(roles[(i + 1) % 2], (0.08, 0.08, 0.08), C + d * rad * 1.05, segs=4, rings=4)
    g = Vector((launch.x, launch.y, _ground(launch)))
    # El cohete en el suelo y la estela hasta el estallido.
    B.lathe("fiestera", [(0.0, 0.0), (0.12, 0.0), (0.12, 0.4), (0.0, 0.62)], tuple(g), segs=8)
    pts = [g.lerp(C, t) + Vector((0.25 * math.sin(math.pi * t), 0.0, 0.0)) for t in (j / 6 for j in range(1, 6))]
    B.tube("white", pts, [0.02, 0.03, 0.035, 0.04, 0.03], segs=4)


# --- Las boias bailando ---------------------------------------------------------------------------------
BOIA_DETAIL = 0.3       # las boias de la isla, con menos caras que las de comun.ligero: son muchas y se ven pequeñas


class Menos:
    """El Builder B con aún menos segmentos por pieza (para las boias de esta isla): misma forma, menos caras.

    Envuelve al Builder de los mundos (la clase base de comun.ligero) y le pasa los segmentos rebajados;
    lo demás (mk, G…) va tal cual al Builder B.
    """

    def __init__(self, B, detail):
        self._B, self._base, self._d = B, type(B).__mro__[1], detail

    def __getattr__(self, name):
        return getattr(self._B, name)

    def _n(self, v, lo):
        return min(v, max(lo, int(round(v * self._d))))

    def blob(self, role, size, at, p=2.0, q=2.0, extra=None, segs=24, rings=12):
        # El blanco de los ojos no baja de 12 × 6: con menos, su contorno de tinta se despega.
        lo = (12, 6) if role == "white" and max(size[0], size[1]) >= 0.08 else (6, 4)
        nr = self._n(rings, lo[1])
        return self._base.blob(self._B, role, size, at, p, q, extra, self._n(segs, lo[0]), nr + nr % 2)

    def tube(self, role, pts, r, segs=8, closed=False):
        if len(pts) > 8:
            keep = list(range(0, len(pts), 3))
            if not closed and keep[-1] != len(pts) - 1:
                keep.append(len(pts) - 1)
            pts = [pts[i] for i in keep]
            if isinstance(r, (list, tuple)):
                r = [r[i] for i in keep]
        return self._base.tube(self._B, role, pts, r, self._n(segs, 4), closed)

    def lathe(self, role, prof, at, segs=24, sx=1.0, sy=1.0, extra=None):
        return self._base.lathe(self._B, role, prof, at, self._n(segs, 6), sx, sy, extra)

    def torus(self, role, R, r, matrix, nu=24, nv=8):
        return self._base.torus(self._B, role, R, r, matrix, self._n(nu, 12), self._n(nv, 4))


def boia_bailona(B, K, base, k, g, tilt, bengala, boca, aro, bandas):
    """La mascota de BOIA bailando: cuerpo ladeado, brazos arriba y, si toca, una bengala en la mano."""
    before = set(bpy.data.objects)
    B = Menos(B, BOIA_DETAIL)
    # Las láminas de la cara (dientes, boca) de mascota.patch, también con menos tiras.
    patch = MASC.patch
    MASC.patch = lambda B_, role, body_, up, lo, lift, thick, nt=18, ns=4: patch(
        B_, role, body_, up, lo, lift, thick, nt=min(nt, 10), ns=min(ns, 2))
    try:
        _boia_bailona(B, K, base, k, g, bengala, boca, aro, bandas)
    finally:
        MASC.patch = patch
    # El baile: todo ladeado sobre la base, hacia un lado de la cara.
    D = MASC.mdir(g)
    m = Matrix.Translation(base) @ Matrix.Rotation(math.radians(tilt), 4, D) @ Matrix.Translation(-base)
    for o in set(bpy.data.objects) - before:
        if o.type == "MESH":
            o.data.transform(m)


def _boia_bailona(B, K, base, k, g, bengala, boca, aro, bandas):
    """La boia derecha: cuerpo, cara, gorro, aro, brazos en V y la bengala."""
    base = Vector(base)
    D = MASC.mdir(g)
    Rt = K.UP.cross(D).normalized()
    a = c = 0.40 * k
    body = MASC.Body(base + K.UP * (0.36 * k), a, c, D, Rt)
    B.blob("mascota", (a, a, c), body.C, 2.0, 2.0, segs=48, rings=24)
    MASC.face(B, body, k, boca)
    MASC.cap(B, body, k, pompom=True)
    MASC.ring_float(B, body, base, k, aro, bandas)
    # Brazos en V, con guantes blancos.
    hands = []
    for side in (-1, 1):
        p, n = body.point(side * 1.45, 0.05, -0.02 * k)
        out = (n * 0.55 + K.UP * (0.85 if side < 0 else 0.7)).normalized()
        elbow = p + out * 0.2 * k + body.right * side * 0.04 * k
        tip = elbow + (out + K.UP * 0.4).normalized() * 0.2 * k
        B.tube("mascota", [p - n * 0.04 * k, elbow, tip], [0.075 * k, 0.065 * k, 0.05 * k], segs=8)
        B.blob("white", (0.07 * k, 0.07 * k, 0.07 * k), tip + K.UP * 0.03 * k, segs=10, rings=6)
        hands.append(tip + K.UP * 0.03 * k)
    if bengala:
        h = hands[1]
        top = h + (K.UP * 0.9 + body.right * 0.3).normalized() * 0.42 * k
        B.tube("wire", [h, top], 0.012 * k, segs=4)
        B.blob("flash", (0.07 * k, 0.07 * k, 0.07 * k), top, segs=8, rings=4)
        for i in range(6):
            a6 = 2 * math.pi * i / 6
            d = Vector((math.cos(a6), math.sin(a6), 0.6 * math.sin(3 * a6))).normalized()
            B.tube("nv_beam_c", [top + d * 0.06 * k, top + d * 0.2 * k], [0.018 * k, 0.006 * k], segs=4)

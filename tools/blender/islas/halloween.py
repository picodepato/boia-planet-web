"""La Isla de Halloween (T69): el club calabaza y las boias disfrazadas. MUESTRA.

Una isla de roca morada con la cima de hierba oscura. En el centro, el club:
una calabaza grande con cara de enfado (ojos rasgados, nariz y una boca de
dientes que hace de puerta, con escalones de madera) que brilla de noche, un
rabo con zarcillo, altavoces a los lados y murciélagos. Por la isla, lápidas,
árboles secos y calabacitas encendidas a lo largo del camino del muelle. En el
agua, alrededor, seis boias con la mascota de BOIA disfrazadas: dos brujas,
dos fantasmas y dos Frankenstein, todas mirando hacia fuera.

Medidas en unidades de escena del mar 3D (la isla de /mar mide R ≈ 7,1).
"""
import math
import random

from mathutils import Matrix, Vector

ID = "halloween"
LABEL = "Isla de Halloween"
DOC = ("club calabaza con cara de enfado que brilla de noche y seis boias disfrazadas (brujas, fantasmas y "
       "Frankenstein) alrededor")
RADIUS = 7.0            # orilla de la isla en z = 0, en unidades del modelo
GRASS = 0.78            # radio de la hierba de la cima, en radios de la isla
DETAIL = 0.5            # segmentos de cada pieza respecto a los de los mundos (comun.ligero)

# Papeles nuevos de esta isla (color plano en el glTF); los demás son los del tema de arcilla.
ROLES = {
    "hw_rock": "#5B5470",          # roca morada
    "hw_rock_dark": "#433D57",
    "hw_grass": "#4F6A3A",         # hierba oscura de la cima
    "hw_pumpkin": "#F0711E",       # la calabaza del club
    "hw_pumpkin_dark": "#C4501A",  # calabacitas y sombras
    "hw_stem": "#5E7A2E",
    "hw_tree": "#3A3140",          # árboles secos
    "hw_stone": "#9C98AA",         # lápidas
    "hw_purple": "#6A4FC4",        # cinta del sombrero y aro de la bruja
    "hw_ghost": "#F4F1EA",         # sábana del fantasma
    "hw_frank": "#86B84A",         # piel de Frankenstein
    "hw_frank_dark": "#3F6E28",
}
# Papeles que brillan (emisivos): la cara de la calabaza y las calabacitas del camino.
GLOW = {
    "hw_glow": "#FFB43A",
    "hw_lantern": "#FF8A2A",
}

BOIAS = [  # (ángulo en grados, 0 = +X, -90 = frente; disfraz)
    (-122, "bruja"), (-58, "fantasma"), (-168, "frankenstein"), (-12, "frankenstein"),
    (140, "fantasma"), (40, "bruja"),
]


def build(B, K):
    """Construye la isla con el Builder B; K es el módulo comun."""
    rng = random.Random(1031)
    R = RADIUS
    H = 1.25
    K.terreno(B, "hw_rock", R * 1.02, H, segs=40, rings=12, noise=K.shore_noise(2))
    K.terreno(B, "hw_rock_dark", R * 1.12, 0.25, sink=0.8, q=2.0, segs=32, rings=6, noise=K.shore_noise(5))
    top = 1.63
    # La cima de hierba oscura: una cúpula baja que asoma sobre la roca.
    B.blob("hw_grass", (R * GRASS, R * GRASS, 0.9), Vector((0.0, 0.0, top - 0.9)), 2.0, 2.4, segs=40, rings=12)
    # Cantos de la orilla (sin tapar el muelle del frente).
    for i in range(11):
        ang = i * 360 / 11 + rng.uniform(-8, 8)
        if abs(((ang + 90 + 180) % 360) - 180) < 22:
            continue
        r = R * rng.uniform(0.93, 1.06)
        K.roca(B, "hw_rock_dark" if i % 2 else "hw_rock", K.polar(r, ang, 0.1), rng.uniform(0.45, 0.8), rng)

    # --- El club: la calabaza ---------------------------------------------------------------------------
    a, c = 2.55, 2.0
    C = Vector((0.0, 0.35, top + c * 0.86))
    pk = K.Calabaza(C, a, c, ribs=10, groove=0.08)
    pk.mesh(B, "hw_pumpkin", segs=40, rings=14)
    lift, thick = 0.025, 0.03
    # Ojos rasgados de enfado: el canto de arriba baja hacia la nariz.
    left_eye = [(-0.74, 0.56), (-0.16, 0.30), (-0.50, 0.12)]
    for poly in (left_eye, [(-az, lat) for az, lat in left_eye][::-1]):
        K.abanico(B, "hw_glow", pk, poly, lift, thick, sub=3)
    # Cejas fruncidas de piel oscura sobre los ojos.
    for s in (-1, 1):
        brow = [(s * 0.80, 0.70), (s * 0.12, 0.42), (s * 0.12, 0.36), (s * 0.80, 0.62)]
        K.abanico(B, "hw_pumpkin_dark", pk, brow if s < 0 else brow[::-1], lift, 0.06, sub=2)
    K.abanico(B, "hw_glow", pk, [(0.0, 0.16), (0.10, -0.02), (-0.10, -0.02)][::-1], lift, thick, sub=2)

    # Boca de dientes, la puerta del club.
    def tooth(t, at, w):
        return max(0.0, 1.0 - abs(t - at) / w)

    def upper(t):
        az = -0.92 + 1.84 * t
        lat = -0.16 - 0.16 * math.sin(math.pi * t) + 0.08 * abs(t - 0.5)
        lat -= 0.15 * (tooth(t, 0.30, 0.06) + tooth(t, 0.70, 0.06))
        return az, lat

    def lower(t):
        az = -0.90 + 1.80 * t
        lat = -0.22 - 0.42 * math.sin(math.pi * t) ** 0.8
        lat += 0.15 * (tooth(t, 0.18, 0.05) + tooth(t, 0.50, 0.06) + tooth(t, 0.82, 0.05))
        return az, lat

    K.parche(B, "hw_glow", pk, upper, lower, lift, thick, nt=48, ns=2)
    # Rabo con zarcillo y una hoja.
    stem0 = C + Vector((0, 0, c * (1 - pk.dimple) - 0.05))
    stem = [stem0, stem0 + Vector((0.05, 0.0, 0.45)), stem0 + Vector((0.28, -0.05, 0.85)), stem0 + Vector((0.55, -0.1, 0.95))]
    B.tube("hw_stem", stem, [0.32, 0.26, 0.2, 0.14], segs=10)
    curl = [stem0 + Vector((-0.2 - 0.35 * t + 0.12 * math.cos(9 * t), 0.15 * math.sin(9 * t), 0.15 + 0.25 * t)) for t in
            [i / 10 for i in range(11)]]
    B.tube("hw_stem", curl, 0.045, segs=5)
    B.blob("hw_stem", (0.45, 0.28, 0.05), stem0 + Vector((-0.55, 0.35, 0.12)),
           extra=Matrix.Rotation(0.5, 4, "Z") @ Matrix.Rotation(0.25, 4, "X"), segs=12, rings=6)
    # Escalones de madera hasta la boca.
    mouth_bottom = pk.point(0.0, -0.58)[0]
    for i in range(4):
        t = (i + 0.5) / 4
        y = mouth_bottom.y - 1.15 + 0.95 * t
        z = top + (mouth_bottom.z - top) * t - 0.06
        K.caja(B, "wood", (0.85, 0.2, 0.09), Vector((0.0, y, z)))
    # Altavoces a los lados de la puerta.
    for s in (-1, 1):
        p = Vector((s * 2.75, -1.25, top + 0.55))
        K.caja(B, "speaker", (0.38, 0.32, 0.6), p, ang=s * 18)
        for dz, rr in ((0.22, 0.17), (-0.2, 0.22)):
            q = p + Vector((s * 0.1, -0.33, dz))
            B.blob("metal", (rr, rr, 0.04), (0, 0, 0),
                   extra=Matrix.Translation(q) @ Matrix.Rotation(math.radians(s * 18), 4, "Z") @ Matrix.Rotation(
                       math.pi / 2, 4, "X"), segs=14, rings=4)
    # Murciélagos sobre el club.
    for at, s, yaw in (((-1.6, 0.6, 6.3), 1.0, 20), ((1.9, -0.2, 6.9), 0.85, -25), ((0.4, 1.4, 7.4), 0.7, 5)):
        K.murcielago(B, at, s, yaw)

    # --- Alrededor: camino, calabacitas, lápidas y árboles secos -------------------------------------------
    K.muelle(B, Vector((0.0, -R * 0.9, 0.0)), 2.6, width=1.1)
    for i, s in enumerate((-1, 1, -1, 1, -1, 1)):
        y = -R * 0.84 + i * 0.62
        x = s * 0.9
        z = _ground(R, H, Vector((x, y))) + 0.12
        B.blob("hw_pumpkin_dark", (0.26, 0.26, 0.2), Vector((x, y, z)), 2.0, 2.0, segs=12, rings=6)
        B.blob("hw_lantern", (0.12, 0.05, 0.08), Vector((x, y - 0.24, z + 0.02)), segs=8, rings=4)
        B.tube("hw_stem", [Vector((x, y, z + 0.18)), Vector((x + 0.03, y, z + 0.3))], 0.035, segs=5)
    for ang, r, yaw in ((-150, 4.2, 25), (-130, 4.9, 40), (-35, 4.4, -30), (-55, 5.1, -45), (160, 4.0, 70)):
        p = K.polar(r, ang)
        z = _ground(R, H, p)
        B.blob("hw_stone", (0.38, 0.12, 0.5), Vector((p.x, p.y, z + 0.32)), 2.0, 6.0,
               extra=Matrix.Rotation(math.radians(yaw), 4, "Z"), segs=12, rings=6)
        B.blob("hw_rock_dark", (0.5, 0.35, 0.08), Vector((p.x, p.y, z + 0.02)), 2.0, 2.0, segs=10, rings=4)
    for ang, r, h in ((150, 4.9, 2.6), (35, 5.0, 2.3), (95, 4.6, 2.8), (-170, 5.3, 2.0)):
        p = K.polar(r, ang)
        z = _ground(R, H, p)
        tree(B, Vector((p.x, p.y, z - 0.1)), h, rng)

    # --- En el agua: las boias disfrazadas, mirando hacia fuera ---------------------------------------------
    for ang, disfraz in BOIAS:
        p = K.polar(R * 1.24, ang)
        # Hacia fuera y hacia el frente (la cámara de /mar mira la isla desde el puerto).
        look = (p.normalized() * 0.6 + K.FRONT).normalized()
        K.boia_disfrazada(B, p, 1.45, K.g_toward(look), disfraz)
    return {"top": top, "height": C.z + c + 1.0}


def _ground(R, H, p):
    """Altura aproximada del terreno en el punto p: la roca (terreno()) o la hierba de encima."""
    d = math.hypot(p.x, p.y)
    rock = (H + 0.6) * max(0.0, 1.0 - min(1.0, d / (R * 1.02)) ** 2.4) ** (1 / 2.4) - 0.6
    grass = 1.63 - 0.9 + 0.9 * max(0.0, 1.0 - min(1.0, d / (R * GRASS)) ** 2.4) ** (1 / 2.4)
    return max(rock, grass)


def tree(B, base, h, rng):
    """Árbol seco: tronco retorcido con tres ramas que se doblan."""
    pts = [base + Vector((0.15 * math.sin(i * 1.3), 0.12 * math.cos(i * 1.7), h * i / 5)) for i in range(6)]
    B.tube("hw_tree", pts, [0.22, 0.17, 0.14, 0.11, 0.08, 0.05], segs=6)
    for i, ang in enumerate((rng.uniform(0, 120), rng.uniform(120, 240), rng.uniform(240, 360))):
        a = math.radians(ang)
        s = pts[3 + (i % 2)]
        d = Vector((math.cos(a), math.sin(a), 0.0))
        br = [s, s + d * 0.45 + Vector((0, 0, 0.35)), s + d * 0.8 + Vector((0, 0, 0.4)), s + d * 1.0 + Vector((0, 0, 0.2))]
        B.tube("hw_tree", br, [0.08, 0.06, 0.04, 0.02], segs=5)

"""La Isla del Sonido (T70): el sound system de rave y las boias bailando. MUESTRA.

Una isla de arena con la cima de hierba. Al fondo, mirando al frente (el
puerto), el sound system: dos muros de altavoces apilados (graves abajo,
medios en medio y agudos con bocina arriba), un poco girados hacia la pista,
y entre ellos la cabina del DJ con sus dos platos, la mesa y una tira de LED.
Encima, un pórtico de celosía con focos colgados y un láser que abre un
abanico de rayos hacia el cielo; a los lados, dos columnas de altavoces más
bajas y palmeras. Delante, la pista redonda con su borde de luz y las boias de
BOIA bailando encima (la mascota de mascota.py con brazos, ladeada, alguna
saltando, con gafas de sol); detrás de la cabina, la boia DJ con cascos. Las
luces (focos, láser, LED y la pista) brillan de noche.

Medidas en unidades de escena del mar 3D (la isla de /mar mide R ≈ 7).
"""
import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector

import mascota as MASC

ID = "allday"
LABEL = "Isla del Sonido"
DOC = ("sound system de rave con dos muros de altavoces, cabina de DJ, pórtico de focos y láser que brillan de "
       "noche, y boias de BOIA bailando en la pista")
RADIUS = 7.0            # orilla de la isla en z = 0, en unidades del modelo
GRASS = 0.80            # radio de la hierba de la cima, en radios de la isla
DETAIL = 0.5            # segmentos de cada pieza respecto a los de los mundos (comun.ligero)
TOP = 1.55              # cima de la hierba (z), donde se apoya todo

# Papeles nuevos de esta isla (color plano en el glTF); los demás son los del tema de arcilla.
ROLES = {
    "snd_sand": "#E6C793",         # arena de la isla
    "snd_sand_dark": "#C9A774",
    "snd_grass": "#76A944",        # hierba de la cima
    "snd_cab": "#1D1D25",          # cajas de los altavoces
    "snd_baffle": "#2C2E3A",       # frente de las cajas
    "snd_cone": "#0E0E13",         # conos
    "snd_floor": "#3A3350",        # la pista
    "snd_truss": "#B9BCC6",        # celosía de aluminio
    "snd_booth": "#26232F",        # cabina del DJ
}
# Papeles que brillan (emisivos): focos, láser, LED de la cabina y el borde de la pista.
GLOW = {
    "snd_spot": "#FFC04A",
    "snd_magenta": "#FF4FB0",
    "snd_laser": "#4BFF7A",
    "snd_cyan": "#4FE6FF",
}

# Las boias que bailan en la pista: (x, y, escala, mirada en grados respecto al frente, pose, salto, gafas, boca).
BAILE = [
    (-1.9, -1.75, 1.25, 25, "arriba", 0.0, True, "sonrisa"),
    (0.1, -2.75, 1.3, -5, "uno", 0.32, False, "habla"),
    (1.95, -1.55, 1.25, -30, "abiertos", 0.0, True, "sonrisa"),
    (-0.9, -0.3, 1.1, 15, "uno", 0.0, False, "sonrisa"),
    (0.95, -0.1, 1.1, -15, "arriba", 0.22, True, "sonrisa"),
]
UP = Vector((0.0, 0.0, 1.0))


def build(B, K):
    """Construye la isla con el Builder B; K es el módulo comun."""
    rng = random.Random(2026)
    R = RADIUS
    H = 1.15
    K.terreno(B, "snd_sand", R * 1.02, H, segs=40, rings=12, noise=K.shore_noise(3))
    K.terreno(B, "snd_sand_dark", R * 1.12, 0.22, sink=0.8, q=2.0, segs=32, rings=6, noise=K.shore_noise(7))
    # La cima de hierba: una meseta casi plana (q alto) donde cabe todo.
    B.blob("snd_grass", (R * GRASS, R * GRASS, 0.7), Vector((0.0, 0.0, TOP - 0.7)), 2.0, 5.0, segs=40, rings=12)
    for i in range(10):
        ang = i * 36 + rng.uniform(-8, 8)
        if abs(((ang + 90 + 180) % 360) - 180) < 24:
            continue
        r = R * rng.uniform(0.95, 1.06)
        K.roca(B, "rock", K.polar(r, ang, 0.1), rng.uniform(0.4, 0.75), rng)

    # --- El sound system: dos muros de altavoces y la cabina ---------------------------------------------
    for s in (-1, 1):
        muro(B, Vector((s * 2.85, 1.85, TOP)), -s * 16, cols=3)
        columna(B, Vector((s * 5.0, 0.55, TOP - 0.05)), -s * 38)
    cabina(B, Vector((0.0, 1.45, TOP)))
    porticos(B, rng)

    # --- La pista y las boias bailando -------------------------------------------------------------------
    pista(B, Vector((0.0, -1.15, TOP)), 2.75)
    for x, y, k, look, pose, salto, gafas, boca in BAILE:
        g = K.g_toward(Matrix.Rotation(math.radians(look), 3, "Z") @ K.FRONT)
        boia_bailando(B, Vector((x, y, TOP + 0.1 + salto)), k, g, pose, gafas,
                      tilt=rng.uniform(8, 14) * (1 if rng.random() < 0.5 else -1), boca=boca)
    # La boia DJ, detrás de la cabina, con cascos y un brazo arriba.
    caja(B, "snd_cab", (0.6, 0.45, 0.3), _M(Vector((0.0, 2.3, TOP + 0.3)), 0.0))
    boia_bailando(B, Vector((0.0, 2.3, TOP + 0.6)), 1.1, K.g_toward(K.FRONT), "uno", False, tilt=-6, cascos=True, boca="habla")

    # --- Alrededor: palmeras y el muelle con balizas -------------------------------------------------------
    for ang, r, h in ((140, 5.2, 3.6), (40, 5.3, 3.3), (-160, 5.0, 2.9), (-20, 5.1, 3.1)):
        p = K.polar(r, ang)
        palmera(B, Vector((p.x, p.y, _ground(R, H, p) - 0.1)), h, rng)
    K.muelle(B, Vector((0.0, -R * 0.9, 0.0)), 2.6, width=1.1)
    for i in range(3):
        for s in (-1, 1):
            y = -R * 0.86 + i * 0.75
            x = s * 0.85
            z = _ground(R, H, Vector((x, y)))
            B.tube("metal", [Vector((x, y, z - 0.1)), Vector((x, y, z + 0.45))], 0.05, segs=6)
            B.blob("snd_cyan" if i % 2 else "snd_magenta", (0.09, 0.09, 0.09), Vector((x, y, z + 0.52)), segs=8, rings=4)
    return {"top": TOP, "height": max(v.co.z for o in bpy.data.objects if o.type == "MESH" for v in o.data.vertices)}


def _ground(R, H, p):
    """Altura aproximada del terreno en el punto p: la arena (terreno()) o la meseta de hierba."""
    d = math.hypot(p.x, p.y)
    sand = (H + 0.6) * max(0.0, 1.0 - min(1.0, d / (R * 1.02)) ** 2.4) ** (1 / 2.4) - 0.6
    grass = TOP - 0.7 + 0.7 * max(0.0, 1.0 - min(1.0, d / (R * GRASS)) ** 5.0) ** (1 / 5.0)
    return max(sand, grass)


# --- Piezas sueltas --------------------------------------------------------------------------------------
def _M(at, yaw):
    """Marco local: en `at`, girado `yaw` grados en Z (el frente local es -Y)."""
    return Matrix.Translation(at) @ Matrix.Rotation(math.radians(yaw), 4, "Z")


def caja(B, role, size, M):
    """Caja de aristas vivas (12 triángulos) de semiejes size en el marco M."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=2.0)
    bmesh.ops.transform(bm, verts=bm.verts[:], matrix=M @ Matrix.Diagonal((size[0], size[1], size[2], 1.0)))
    return B.mk(bm, role, sharp=30)


def cono(B, M, r):
    """Cono de altavoz en el frente (local -Y) del marco M: aro de metal y cono hundido."""
    face = M @ Matrix.Rotation(math.pi / 2, 4, "X")      # +Z local hacia el frente (-Y)
    B.lathe("metal", [(0.80 * r, 0.0), (r, 0.045), (1.06 * r, 0.0)], (0, 0, 0), segs=16, extra=face)
    B.lathe("snd_cone", [(0.0, 0.03), (0.22 * r, 0.0), (0.82 * r, 0.035)], (0, 0, 0), segs=16, extra=face)


def altavoz(B, tipo, at, yaw, w, h, d=0.42):
    """Una caja del muro: «grave» (un cono grande), «medio» (dos conos) o «agudo» (cono y bocina)."""
    M = _M(at, yaw)
    caja(B, "snd_cab", (w, d, h), M)
    front = M @ Matrix.Translation((0.0, -d - 0.005, 0.0))
    caja(B, "snd_baffle", (w * 0.9, 0.01, h * 0.88), front)
    if tipo == "grave":
        cono(B, front @ Matrix.Translation((0.0, -0.01, 0.0)), min(w, h) * 0.78)
    elif tipo == "medio":
        for sx in (-1, 1):
            cono(B, front @ Matrix.Translation((sx * w * 0.47, -0.01, 0.0)), min(w * 0.42, h * 0.78))
    else:
        cono(B, front @ Matrix.Translation((-w * 0.45, -0.01, 0.0)), h * 0.72)
        # Bocina de agudos: una boca rectangular que se abre hacia el frente.
        bm = bmesh.new()
        back = [(-0.08, -0.05), (0.08, -0.05), (0.08, 0.05), (-0.08, 0.05)]
        mouth = [(-0.42, -0.6), (0.42, -0.6), (0.42, 0.6), (-0.42, 0.6)]
        vb = [bm.verts.new(front @ Vector((w * 0.45 + x * w, 0.0, z * h))) for x, z in back]
        vf = [bm.verts.new(front @ Vector((w * 0.45 + x * w, -0.12, z * h))) for x, z in mouth]
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new((vb[i], vb[j], vf[j], vf[i]))
        bm.faces.new(vb[::-1])
        B.mk(bm, "snd_cone", sharp=30)


def muro(B, base, yaw, cols=3):
    """Muro de altavoces: `cols` columnas de graves, dos filas de medios y agudos arriba, girado yaw."""
    w = 0.46
    rows = (("grave", 0.46), ("grave", 0.46), ("medio", 0.3), ("medio", 0.3), ("agudo", 0.22))
    M = _M(base, yaw)
    z = 0.0
    for tipo, h in rows:
        for c in range(cols):
            x = (c - (cols - 1) / 2) * (2 * w + 0.03)
            altavoz(B, tipo, M @ Vector((x, 0.0, z + h)), yaw, w, h)
        z += 2 * h + 0.03
    # Una tira naranja de BOIA encima del muro y una baliza de cada lado.
    caja(B, "mascota", (cols * (w + 0.015), 0.44, 0.06), M @ Matrix.Translation((0.0, 0.0, z + 0.06)))
    for sx in (-1, 1):
        p = M @ Vector((sx * cols * (w + 0.015) * 0.8, -0.1, z + 0.25))
        B.lathe("metal", [(0.0, -0.13), (0.13, -0.13), (0.11, 0.0), (0.0, 0.0)], p, segs=12)
        B.blob("snd_magenta" if sx < 0 else "snd_cyan", (0.12, 0.12, 0.12), p + UP * 0.05, segs=10, rings=6)
    return z


def columna(B, base, yaw):
    """Columna suelta de altavoces a un lado: dos graves, un medio y un agudo."""
    w = 0.42
    z = 0.0
    for tipo, h in (("grave", 0.42), ("grave", 0.42), ("medio", 0.28), ("agudo", 0.2)):
        altavoz(B, tipo, _M(base, yaw) @ Vector((0.0, 0.0, z + h)), yaw, w, h, d=0.38)
        z += 2 * h + 0.03


def cabina(B, at):
    """La cabina del DJ: tarima, mueble con tira de LED y BOIA, dos platos y la mesa de mezclas."""
    M = _M(at, 0.0)
    caja(B, "snd_cab", (1.5, 0.8, 0.18), M @ Matrix.Translation((0.0, 0.3, 0.18)))
    caja(B, "snd_booth", (1.3, 0.42, 0.34), M @ Matrix.Translation((0.0, 0.0, 0.7)))
    caja(B, "snd_cab", (1.38, 0.48, 0.035), M @ Matrix.Translation((0.0, 0.0, 1.07)))
    # Tiras de LED en el frente y el nombre en naranja entre ellas.
    caja(B, "snd_cyan", (1.25, 0.012, 0.04), M @ Matrix.Translation((0.0, -0.43, 0.97)))
    caja(B, "snd_magenta", (1.25, 0.012, 0.04), M @ Matrix.Translation((0.0, -0.43, 0.43)))
    letras(B, M @ Matrix.Translation((0.0, -0.43, 0.7)), 0.24)
    # Dos platos y la mesa de mezclas.
    for sx in (-1, 1):
        p = M @ Vector((sx * 0.72, 0.0, 1.105))
        B.lathe("metal", [(0.0, 0.0), (0.34, 0.0), (0.34, 0.04), (0.0, 0.04)], p, segs=16)
        B.lathe("ink", [(0.0, 0.04), (0.28, 0.04), (0.28, 0.06), (0.0, 0.06)], p, segs=16)
        B.blob("snd_spot", (0.05, 0.05, 0.02), p + UP * 0.07, segs=8, rings=4)
    caja(B, "snd_baffle", (0.26, 0.3, 0.05), M @ Matrix.Translation((0.0, 0.0, 1.15)))
    for i in range(4):
        caja(B, "snd_spot" if i % 2 else "snd_cyan", (0.025, 0.08, 0.02), M @ Matrix.Translation((-0.15 + i * 0.1, -0.05, 1.21)))


def letras(B, M, s):
    """«BOIA» en bloques: letras de cajas (pocos triángulos), en el plano XZ del marco M, mirando a -Y."""
    # Cada letra en una rejilla de 3 × 5 celdas; las celdas encendidas son cajas.
    glyphs = {
        "B": ["##.", "#.#", "##.", "#.#", "##."],
        "O": [".#.", "#.#", "#.#", "#.#", ".#."],
        "I": [".#.", ".#.", ".#.", ".#.", ".#."],
        "A": [".#.", "#.#", "###", "#.#", "#.#"],
    }
    cell = s / 2.5
    text = "BOIA"
    width = len(text) * 4 * cell - cell
    for li, ch in enumerate(text):
        for r, row in enumerate(glyphs[ch]):
            # Las celdas seguidas de una fila van en una sola caja.
            c = 0
            while c < 3:
                if row[c] != "#":
                    c += 1
                    continue
                c0 = c
                while c < 3 and row[c] == "#":
                    c += 1
                x = -width / 2 + (li * 4 + (c0 + c) / 2) * cell
                z = (2 - r) * cell
                caja(B, "mascota", ((c - c0) * cell * 0.5, 0.02, cell * 0.5), M @ Matrix.Translation((x, -0.02, z)))


def porticos(B, rng):
    """Pórtico de celosía sobre el sound system, con focos colgados y el láser en lo alto."""
    y, xs, hgt = 1.0, 4.15, 4.4
    z0 = TOP
    for s in (-1, 1):
        celosia(B, Vector((s * xs, y, z0 - 0.1)), Vector((s * xs, y, z0 + hgt)), 0.2)
        caja(B, "snd_cab", (0.35, 0.35, 0.06), _M(Vector((s * xs, y, z0 + 0.0)), 0.0))
    celosia(B, Vector((-xs - 0.2, y, z0 + hgt)), Vector((xs + 0.2, y, z0 + hgt)), 0.2)
    # Focos colgados del travesaño, apuntando a la pista.
    roles = ("snd_spot", "snd_magenta", "snd_cyan", "snd_magenta", "snd_spot", "snd_cyan")
    for i, role in enumerate(roles):
        x = -3.1 + i * 1.24
        p = Vector((x, y - 0.05, z0 + hgt - 0.35))
        aim = Vector((x * 0.25, -2.6, -2.2)).normalized()
        foco(B, p, aim, role)
    # El láser: una caja en lo alto con un abanico de rayos hacia el cielo y el frente.
    lp = Vector((0.0, y, z0 + hgt + 0.32))
    caja(B, "snd_cab", (0.32, 0.24, 0.14), _M(lp, 0.0))
    for i in range(7):
        a = math.radians(-54 + i * 18)
        d = Vector((math.sin(a), -0.55, math.cos(a) * 0.9 + 0.35)).normalized()
        start = lp + Vector((0.0, -0.25, 0.0))
        B.tube("snd_laser" if i % 2 == 0 else "snd_magenta", [start, start + d * 3.2], [0.03, 0.012], segs=6)


def celosia(B, a, b, r):
    """Tramo de celosía cuadrada de aluminio entre a y b: cuatro cordones y diagonales en zigzag."""
    a, b = Vector(a), Vector(b)
    t = (b - a).normalized()
    u = UP if abs(t.z) < 0.9 else Vector((0.0, 1.0, 0.0))
    u = (u - t * u.dot(t)).normalized()
    v = t.cross(u)
    corners = [(u + v) * r, (u - v) * r, (-u - v) * r, (-u + v) * r]
    for c in corners:
        B.tube("snd_truss", [a + c, b + c], 0.03, segs=4)
    n = max(2, int((b - a).length / (r * 2.5)))
    for side in range(2):
        c0, c1 = corners[side * 2], corners[side * 2 + 1]
        pts = [a + t * (b - a).length * i / n + (c0 if i % 2 == 0 else c1) for i in range(n + 1)]
        B.tube("snd_truss", pts, 0.018, segs=4)


def foco(B, p, aim, role):
    """Foco de escenario colgado en p, mirando hacia aim: lata de metal y lente que brilla."""
    m = Matrix.Translation(p) @ aim.to_track_quat("Z", "Y").to_matrix().to_4x4()
    B.lathe("snd_cab", [(0.0, -0.2), (0.15, -0.2), (0.17, 0.12), (0.0, 0.12)], (0, 0, 0), segs=12, extra=m)
    B.lathe(role, [(0.0, 0.12), (0.14, 0.12), (0.0, 0.16)], (0, 0, 0), segs=12, extra=m)
    B.tube("snd_truss", [p, p + UP * 0.35], 0.025, segs=4)


def pista(B, c, r):
    """La pista redonda: una tarima baja con un aro de luz en el borde y círculos de colores."""
    B.lathe("snd_floor", [(0.0, 0.1), (r, 0.1), (r + 0.06, 0.04), (r + 0.06, -0.3), (0.0, -0.3)], c, segs=40)
    B.torus("snd_magenta", r + 0.04, 0.045, Matrix.Translation(c + UP * 0.1), nu=40, nv=4)
    for rr, role in ((r * 0.62, "snd_cyan"), (r * 0.3, "snd_spot")):
        B.torus(role, rr, 0.03, Matrix.Translation(c + UP * 0.1), nu=32, nv=4)


def palmera(B, base, h, rng):
    """Palmera de tronco curvo con hojas largas caídas y cocos."""
    lean = Vector((rng.uniform(-0.5, 0.5), rng.uniform(-0.3, 0.3), 0.0))
    pts, rs = [], []
    for i in range(7):
        t = i / 6
        pts.append(base + lean * math.sin(t * math.pi / 2) + UP * h * t)
        rs.append(0.2 - 0.08 * t)
    B.tube("trunk", pts, rs, segs=8)
    top = pts[-1]
    spin = rng.uniform(0, 60)
    for i in range(7):
        hoja(B, top, math.radians(i * 360 / 7 + spin), 2.1 + 0.3 * (i % 2), 0.32)
    for i in range(2):
        a = math.radians(i * 180 + 30)
        B.blob("coconut", (0.14, 0.14, 0.14), top + Vector((0.15 * math.cos(a), 0.15 * math.sin(a), -0.14)), segs=6,
               rings=4)


def hoja(B, at, yaw, L, w, n=5):
    """Hoja de palmera: tira con nervio en V que sale de `at` hacia `yaw`, sube un poco y cae."""
    d = Vector((math.cos(yaw), math.sin(yaw), 0.0))
    side = UP.cross(d)
    bm = bmesh.new()
    rows = []
    for i in range(n + 1):
        t = i / n
        c = at + d * L * t + UP * (0.55 * t - 1.25 * t * t) * L * 0.6
        half = w * math.sin(math.pi * min(1.0, 0.15 + t)) * (1.0 - 0.6 * t)
        rows.append([bm.verts.new(c + side * half - UP * half * 0.35), bm.verts.new(c + UP * 0.02),
                     bm.verts.new(c - side * half - UP * half * 0.35)])
    for r0, r1 in zip(rows, rows[1:]):
        bm.faces.new((r0[0], r1[0], r1[1], r0[1]))
        bm.faces.new((r0[1], r1[1], r1[2], r0[2]))
    B.mk(bm, "leaf", sharp=60)


# --- Boias bailando (la mascota de BOIA, mascota.py) -----------------------------------------------
POSES = ("arriba", "uno", "abiertos")


def boia_bailando(B, base, k, g, pose, gafas, tilt=0.0, cascos=False, boca="sonrisa"):
    """La mascota de BOIA bailando: brazos con guantes, ladeada `tilt` grados hacia un lado; la cara hacia g.

    pose: «arriba» (las dos manos al cielo), «uno» (un brazo arriba, el otro al lado) o «abiertos»;
    boca: la de mascota.face («sonrisa» o «habla», cantando).
    """
    if pose not in POSES:
        raise ValueError(pose)
    before = {o.name for o in bpy.data.objects}
    D = MASC.mdir(g)
    Rt = UP.cross(D).normalized()
    a = c = 0.40 * k
    body = MASC.Body(base + UP * (0.36 * k), a, c, D, Rt)
    shell = [B.blob("mascota", (a, a, c), body.C, 2.0, 2.0, segs=48, rings=24)]
    if gafas:
        # Con gafas de sol los ojos no se ven: la cara sin ellos (las cejas y la boca, las de mascota.face).
        eye, MASC.eye = MASC.eye, lambda *a, **kw: None
        try:
            MASC.face(B, body, k, boca)
        finally:
            MASC.eye = eye
        gafas_sol(B, body, k)
    else:
        MASC.face(B, body, k, boca)
    if cascos:
        auriculares(B, body, k)
    else:
        MASC.cap(B, body, k, parts=shell)
    MASC.ring_float(B, body, base, k, "white", "mascota_gorro", parts=shell)
    MASC.outline_parts(B, shell, k)        # el trazo negro del logo (T231)
    # Brazos: del costado hacia arriba (o al lado), con un guante blanco en la punta.
    ups = {"arriba": (1.0, 1.0), "uno": (1.0, 0.1), "abiertos": (0.45, 0.45)}[pose]
    for side, up in zip((-1, 1), ups):
        p, n = body.point(side * 1.45, 0.05, -0.02 * k)
        out = body.right * side
        elbow = p + out * 0.22 * k + UP * (0.05 + 0.1 * up) * k
        hand = elbow + (out * (0.25 - 0.18 * up) + UP * (0.1 + 0.32 * up)) * k
        B.tube("mascota", [p, elbow, hand], [0.065 * k, 0.055 * k, 0.05 * k], segs=10)
        B.blob("whitewash", (0.085 * k, 0.085 * k, 0.085 * k), hand, segs=10, rings=6)
    # Ladeada: todo lo que se acaba de crear gira alrededor de la base, hacia un lado de la cara.
    if tilt:
        rot = (Matrix.Translation(base) @ Matrix.Rotation(math.radians(tilt), 4, D)
               @ Matrix.Translation(-base))
        for o in bpy.data.objects:
            if o.type == "MESH" and o.name not in before:
                o.data.transform(rot)


def gafas_sol(B, body, k):
    """Gafas de sol de tinta sobre los ojos, con puente."""
    lenses = []
    for az, lat in ((-0.30, 0.42), (0.22, 0.48)):
        p, n = body.point(az, lat, 0.045 * k)
        B.blob("ink", (0.13 * k, 0.11 * k, 0.03 * k), (0, 0, 0), extra=MASC.facing(n, p), segs=12, rings=6)
        lenses.append(p)
    B.tube("ink", [lenses[0], (lenses[0] + lenses[1]) / 2 + UP * 0.02 * k, lenses[1]], 0.018 * k, segs=4)


def auriculares(B, body, k):
    """Cascos de DJ: diadema sobre la cabeza y dos orejeras."""
    C, a, c = body.C, body.a, body.c
    arc = []
    for i in range(9):
        th = math.pi * i / 8
        arc.append(C + body.right * (math.cos(th) * (a + 0.04 * k)) + UP * (math.sin(th) * (c + 0.05 * k)))
    B.tube("snd_cab", arc, 0.035 * k, segs=6)
    for s in (-1, 1):
        p = C + body.right * s * (a + 0.04 * k)
        B.blob("snd_cab", (0.07 * k, 0.13 * k, 0.15 * k), p, segs=12, rings=6)
        B.blob("snd_magenta", (0.02 * k, 0.09 * k, 0.1 * k), p + body.right * s * 0.065 * k, segs=10, rings=4)

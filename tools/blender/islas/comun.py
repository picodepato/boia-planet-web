"""Piezas que comparten las islas de Blender del mar 3D (T69). MUESTRA.

Lo usan los módulos de isla de esta carpeta (`islas/<id>.py`) desde
export_islas_glb.py. Todo en coordenadas de Blender con el centro de la isla
en el origen, el agua en z = 0 y el frente (hacia el puerto y la cámara del
mar 3D) hacia -Y, que en glTF (y arriba) queda hacia +z: el sur de /mar.

- `Ligero`: el Builder de los mundos (mundos/arcilla/escena.py) con menos
  segmentos en cada pieza, para que una isla entera con sus boias quepa en el
  presupuesto de triángulos del móvil. Las boias de mascota.py salen con la
  misma forma y menos caras.
- `terreno`, `roca`, `muelle`: la isla, sus cantos y el muelle de tablas.
- `Calabaza`: superficie de calabaza con gajos (malla y puntos sobre ella) y
  `parche` / `abanico`: láminas pegadas a una superficie (caras de calabaza).
- `boia_disfrazada`: la mascota de BOIA (mascota.py) con disfraz: bruja,
  fantasma o Frankenstein.
"""
import math

import bmesh
from mathutils import Matrix, Vector

import mascota as MASC

UP = Vector((0.0, 0.0, 1.0))
FRONT = Vector((0.0, -1.0, 0.0))     # hacia el puerto y la cámara del mar 3D
RIGHT = Vector((1.0, 0.0, 0.0))      # derecha en pantalla mirando el frente


def ligero(Builder, detail):
    """Subclase del Builder que reparte menos segmentos (detail en (0, 1])."""

    def n(v, lo):
        return min(v, max(lo, int(round(v * detail))))

    class Ligero(Builder):
        def blob(self, role, size, at, p=2.0, q=2.0, extra=None, segs=24, rings=12):
            # El blanco de los ojos no baja de 16 × 8: con menos, su contorno de tinta se despega.
            # Anillos en número par: con impares, las láminas finas (alas de sombrero) pierden su ecuador.
            lo = (16, 8) if role == "white" and max(size[0], size[1]) >= 0.08 else (10, 6)
            nr = n(rings, lo[1])
            return super().blob(role, size, at, p, q, extra, n(segs, lo[0]), nr + nr % 2)

        def tube(self, role, pts, r, segs=8, closed=False):
            # Las polilíneas largas (contornos de ojos, bocas) con un punto de cada dos, sin perder los extremos.
            if detail < 1.0 and len(pts) > 10:
                keep = list(range(0, len(pts), 2))
                if not closed and keep[-1] != len(pts) - 1:
                    keep.append(len(pts) - 1)
                pts = [pts[i] for i in keep]
                if isinstance(r, (list, tuple)):
                    r = [r[i] for i in keep]
            return super().tube(role, pts, r, n(segs, 4), closed)

        def lathe(self, role, prof, at, segs=24, sx=1.0, sy=1.0, extra=None):
            return super().lathe(role, prof, at, n(segs, 8), sx, sy, extra)

        def torus(self, role, R, r, matrix, nu=24, nv=8):
            return super().torus(role, R, r, matrix, n(nu, 12), n(nv, 4))

    return Ligero


def polar(r, ang_deg, z=0.0):
    """Punto a distancia r del centro en el ángulo ang (grados, 0 = +X, -90 = frente)."""
    a = math.radians(ang_deg)
    return Vector((r * math.cos(a), r * math.sin(a), z))


def g_toward(direction):
    """El ángulo g de mascota.mdir que mira en esa dirección horizontal de Blender."""
    return 45.0 - math.degrees(math.atan2(direction.y, direction.x))


# --- Terreno ------------------------------------------------------------------------------------
def shore_noise(seed):
    p1, p2 = 1.3 + seed * 0.7, 4.1 + seed * 1.9
    return lambda th: 1.0 + 0.08 * math.sin(3 * th + p1) + 0.05 * math.sin(5 * th + p2)


def terreno(B, role, R, H, sink=0.6, q=2.4, segs=40, rings=12, noise=None):
    """Cúpula de tierra: orilla de radio ~R en z = 0 (irregular con `noise(θ)`) y cima a H."""
    bm = bmesh.new()
    c = H + sink
    B.G.superquadric(bm, (R, R, c), 2.0, q, segs=segs, rings=rings)
    for v in bm.verts:
        th = math.atan2(v.co.y, v.co.x)
        f = noise(th) if noise else 1.0
        v.co.x *= f
        v.co.y *= f
        v.co.z -= sink
    # Lo que queda muy por debajo del agua no se ve: se aplana (menos solape con el mar).
    for v in bm.verts:
        v.co.z = max(v.co.z, -sink)
    return B.mk(bm, role)


def roca(B, role, at, s, rng, segs=8):
    """Canto de roca achatado e irregular."""
    sx, sy, sz = s * (0.8 + 0.4 * rng.random()), s * (0.8 + 0.4 * rng.random()), s * (0.5 + 0.3 * rng.random())
    m = Matrix.Rotation(rng.random() * math.pi, 4, "Z") @ Matrix.Rotation((rng.random() - 0.5) * 0.5, 4, "X")
    return B.blob(role, (sx, sy, sz), at, 2.6, 2.2, extra=m, segs=segs, rings=max(4, segs // 2))


def caja(B, role, size, at, ang=0.0):
    """Caja de aristas suaves (superelipsoide casi cúbica)."""
    return B.blob(role, size, at, 8.0, 8.0, extra=Matrix.Rotation(math.radians(ang), 4, "Z"), segs=8, rings=4)


def muelle(B, start, length, width=1.0, z=0.28, plank="wood", post="wood_dark"):
    """Muelle de tablas desde `start` hacia el frente (-Y), con postes."""
    n = max(3, int(length / 0.42))
    for i in range(n):
        y = start.y - (i + 0.5) * length / n
        caja(B, plank, (width * 0.5, length / n * 0.42, 0.05), Vector((start.x, y, z)))
    for sx in (-1, 1):
        for y in (start.y - length * 0.15, start.y - length * 0.95):
            B.tube(post, [Vector((start.x + sx * width * 0.45, y, -0.4)), Vector((start.x + sx * width * 0.45, y, z + 0.25))],
                   0.07, segs=6)


# --- Superficies: calabaza y láminas pegadas ------------------------------------------------------
class Calabaza:
    """Calabaza con `ribs` gajos: puntos por (acimut desde la cara, latitud), como mascota.Body.

    El centro de la cara (acimut 0) cae en lo alto de un gajo; `groove` es lo que se hunde cada surco.
    """

    def __init__(self, C, a, c, face=FRONT, right=RIGHT, ribs=10, groove=0.08, dimple=0.18):
        self.C, self.a, self.c = Vector(C), a, c
        self.face, self.right = face.normalized(), right.normalized()
        self.ribs, self.groove, self.dimple = ribs, groove, dimple

    def dir_h(self, az):
        return (self.face * math.cos(az) + self.right * math.sin(az)).normalized()

    def rib(self, az):
        return 1.0 - self.groove * (1.0 - abs(math.cos(self.ribs * 0.5 * az))) ** 1.5

    def raw(self, az, lat):
        h = self.dir_h(az)
        cp, sp = math.cos(lat), math.sin(lat)
        r = self.a * self.rib(az) * cp
        z = self.c * sp
        # Hoyuelos arriba (el rabo) y abajo.
        z -= math.copysign(self.dimple * self.c * math.exp(-(cp / 0.35) ** 2), sp) if abs(sp) > 1e-6 else 0.0
        return self.C + h * r + UP * z

    def point(self, az, lat, lift=0.0):
        e = 1e-3
        p = self.raw(az, lat)
        du = self.raw(az + e, lat) - self.raw(az - e, lat)
        dv = self.raw(az, lat + e) - self.raw(az, lat - e)
        n = du.cross(dv)
        if n.length < 1e-9 or n.dot(p - self.C) < 0:
            n = -n if n.length > 1e-9 else (p - self.C)
        n.normalize()
        return p + n * lift, n

    def mesh(self, B, role, segs=40, rings=18):
        bm = bmesh.new()
        grid = []
        for j in range(1, rings):
            lat = -math.pi / 2 + math.pi * j / rings
            grid.append([bm.verts.new(self.raw(2 * math.pi * i / segs, lat)) for i in range(segs)])
        bot = bm.verts.new(self.raw(0.0, -math.pi / 2 + 1e-4))
        top = bm.verts.new(self.raw(0.0, math.pi / 2 - 1e-4))
        for j in range(len(grid) - 1):
            for i in range(segs):
                k = (i + 1) % segs
                bm.faces.new((grid[j][i], grid[j][k], grid[j + 1][k], grid[j + 1][i]))
        for i in range(segs):
            k = (i + 1) % segs
            bm.faces.new((bot, grid[0][k], grid[0][i]))
            bm.faces.new((top, grid[-1][i], grid[-1][k]))
        return B.mk(bm, role, sharp=70)


def parche(B, role, surf, upper, lower, lift, thick, nt=24, ns=2):
    """Lámina con grosor entre dos curvas (acimut, latitud) de t en [0, 1] sobre `surf` (mascota.patch)."""
    return MASC.patch(B, role, surf, upper, lower, lift, thick, nt=nt, ns=ns)


def abanico(B, role, surf, poly, lift, thick, sub=3):
    """Lámina con grosor de un polígono (acimut, latitud) en estrella desde su centroide, pegada a `surf`.

    Cada triángulo del abanico se subdivide `sub` veces para seguir la curva de la superficie.
    """
    n = len(poly)
    cen = (sum(p[0] for p in poly) / n, sum(p[1] for p in poly) / n)
    bm = bmesh.new()

    def at(A, Bp, L, s, off):
        u, w = (L - s) / sub, s / sub
        az = cen[0] + (A[0] - cen[0]) * u + (Bp[0] - cen[0]) * w
        la = cen[1] + (A[1] - cen[1]) * u + (Bp[1] - cen[1]) * w
        return bm.verts.new(surf.point(az, la, off)[0])

    for i in range(n):
        A, Bp = poly[i], poly[(i + 1) % n]
        for off in (lift, lift + thick):
            g = [[at(A, Bp, L, s, off) for s in range(L + 1)] for L in range(sub + 1)]
            for L in range(sub):
                for s in range(L + 1):
                    bm.faces.new((g[L][s], g[L + 1][s], g[L + 1][s + 1]))
                    if s < L:
                        bm.faces.new((g[L][s], g[L + 1][s + 1], g[L][s + 1]))
            if off == lift:
                low = g[sub]
            else:
                high = g[sub]
        for s in range(sub):
            bm.faces.new((low[s], low[s + 1], high[s + 1], high[s]))
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-5)
    return B.mk(bm, role, sharp=35)


# --- Boias disfrazadas (la mascota de BOIA, mascota.py) ------------------------------------------
DISFRACES = ("bruja", "fantasma", "frankenstein")


def boia_disfrazada(B, base, k, g, disfraz):
    """La mascota de BOIA flotando con un disfraz de Halloween; la cara hacia el ángulo g (mascota.mdir)."""
    if disfraz not in DISFRACES:
        raise ValueError(disfraz)
    base = Vector(base)
    D = MASC.mdir(g)
    Rt = UP.cross(D).normalized()
    a = c = 0.40 * k
    body = MASC.Body(base + UP * (0.36 * k), a, c, D, Rt)
    skin = {"bruja": "mascota", "fantasma": "hw_ghost", "frankenstein": "hw_frank"}[disfraz]
    shell = [B.blob(skin, (a, a, c), body.C, 2.0, 2.0, segs=48, rings=24)]
    MASC.face(B, body, k, "habla" if disfraz == "fantasma" else "sonrisa")
    if disfraz == "bruja":
        sombrero_bruja(B, body, k)
        escoba(B, body, base, k)
        MASC.ring_float(B, body, base, k, "hw_purple", "ink", parts=shell)
    elif disfraz == "fantasma":
        MASC.cap(B, body, k, parts=shell)
        sabana(B, body, base, k)
        brazos_fantasma(B, body, k)
        MASC.ring_float(B, body, base, k, "white", "mascota_gorro", parts=shell)
    else:
        pelo_frank(B, body, k)
        tornillos(B, body, k)
        MASC.ring_float(B, body, base, k, "white", "hw_frank_dark", parts=shell)
    MASC.outline_parts(B, shell, k)        # el trazo negro del logo (T231)


def sombrero_bruja(B, body, k):
    """Sombrero de bruja: ala ancha algo ladeada, copa en punta doblada hacia atrás y cinta morada con hebilla."""
    C, c = body.C, body.c
    tilt = Matrix.Rotation(math.radians(-10), 4, body.face) @ Matrix.Rotation(math.radians(-6), 4, body.right)
    seat = C + UP * (c * 0.80)
    n = (tilt @ UP.to_4d()).to_3d().normalized()
    B.blob("ink", (0.46 * k, 0.46 * k, 0.03 * k), (0, 0, 0), extra=Matrix.Translation(seat) @ tilt, segs=32, rings=6)
    base = seat + n * 0.02 * k
    mid = base + n * 0.38 * k
    tip = base + n * 0.58 * k - body.face * 0.22 * k - body.right * 0.12 * k
    pts, radii = [], []
    for i in range(9):
        t = i / 8
        pts.append((1 - t) ** 2 * base + 2 * (1 - t) * t * mid + t * t * tip)
        radii.append(max(0.012 * k, 0.24 * k * (1 - t) ** 1.1))
    B.tube("ink", pts, radii, segs=16)
    B.torus("hw_purple", 0.225 * k, 0.03 * k, Matrix.Translation(base + n * 0.05 * k) @ tilt, nu=24, nv=6)
    buckle = base + n * 0.05 * k + body.face * 0.235 * k
    B.blob("gold", (0.05 * k, 0.02 * k, 0.045 * k), (0, 0, 0), extra=MASC.facing(body.face, buckle), segs=8, rings=4)


def escoba(B, body, base, k):
    """La escoba apoyada en el aro, a un lado y por detrás."""
    side = body.right * 0.55 - body.face * 0.15
    foot = base + side * k + UP * 0.05 * k
    top = foot + UP * 0.95 * k + body.right * 0.25 * k
    B.tube("wood_dark", [foot, top], 0.02 * k, segs=6)
    d = (foot - top).normalized()
    B.lathe("rice", [(0.0, 0.0), (0.05 * k, 0.02 * k), (0.11 * k, 0.16 * k), (0.12 * k, 0.24 * k), (0.0, 0.25 * k)],
            (0, 0, 0), segs=10, extra=Matrix.Translation(foot - d * 0.02 * k) @ d.to_track_quat("-Z", "Y").to_matrix().to_4x4())


def sabana(B, body, base, k):
    """Falda de sábana con el bajo ondulado sobre el aro: el fantasma (con grosor, para el material de una cara)."""
    segs, waves = 28, 6
    z0, zh = body.C.z - 0.06 * k, base.z + 0.20 * k
    bm = bmesh.new()

    def ring(z, extra, wave):
        out = []
        for i in range(segs):
            th = 2 * math.pi * i / segs
            zz = z + wave * math.sin(waves * th)
            r = body.radius_at(min(zz, body.C.z)) + extra
            out.append(bm.verts.new(Vector((body.C.x + r * math.cos(th), body.C.y + r * math.sin(th), zz))))
        return out

    o0, o1 = ring(z0, 0.02 * k, 0.0), ring(zh, 0.06 * k, 0.04 * k)
    i0, i1 = ring(z0, 0.0, 0.0), ring(zh, 0.035 * k, 0.04 * k)
    for i in range(segs):
        j = (i + 1) % segs
        bm.faces.new((o0[i], o1[i], o1[j], o0[j]))
        bm.faces.new((i0[j], i1[j], i1[i], i0[i]))
        bm.faces.new((o1[i], i1[i], i1[j], o1[j]))
        bm.faces.new((o0[j], i0[j], i0[i], o0[i]))
    B.mk(bm, "hw_ghost")


def brazos_fantasma(B, body, k):
    """Dos bracitos de sábana levantados a los lados: «¡bu!»."""
    for side in (-1, 1):
        p, n = body.point(side * 1.5, 0.0, 0.02 * k)
        out = (n + UP * 0.9).normalized()
        tip = p + out * 0.22 * k
        B.tube("hw_ghost", [p - n * 0.04 * k, p + out * 0.1 * k, tip], [0.085 * k, 0.07 * k, 0.04 * k], segs=10)
        B.blob("hw_ghost", (0.055 * k, 0.055 * k, 0.055 * k), tip, segs=10, rings=6)


def pelo_frank(B, body, k):
    """Pelo negro de corte plano con flequillo en picos y la cicatriz cosida en la frente."""
    C, c = body.C, body.c
    B.blob("ink", (0.30 * k, 0.30 * k, 0.12 * k), C + UP * (c * 0.86), 5.0, 5.0, segs=20, rings=8)
    for i in range(5):
        az = -0.5 + i * 0.25
        p, n = body.point(az, 1.05)
        B.blob("ink", (0.05 * k, 0.03 * k, 0.07 * k), (0, 0, 0), extra=MASC.facing(n, p), segs=8, rings=4)
    ink_r = 0.01 * k
    B.tube("ink", MASC.curve(body, MASC.arc(-0.42, 0.30, 0.90, 0.95, 0.0, 8), 0.006 * k), ink_r, segs=5)
    for i in range(4):
        az = -0.33 + i * 0.19
        B.tube("ink", MASC.curve(body, [(az, 0.86), (az + 0.03, 1.0)], 0.006 * k), ink_r, segs=5)


def tornillos(B, body, k):
    """Los tornillos del cuello, uno a cada lado."""
    for side in (-1, 1):
        p, n = body.point(side * math.pi / 2, -0.15)
        B.tube("metal", [p - n * 0.02 * k, p + n * 0.12 * k], 0.04 * k, segs=8)
        B.blob("metal", (0.07 * k, 0.07 * k, 0.03 * k), (0, 0, 0), extra=MASC.facing(n, p + n * 0.13 * k), p=6.0, segs=8, rings=4)


# --- Murciélagos ------------------------------------------------------------------------------------
def murcielago(B, at, s, yaw):
    """Murciélago con las alas abiertas (cuerpo y dos alas planas con grosor)."""
    at = Vector(at)
    B.blob("ink", (0.12 * s, 0.1 * s, 0.14 * s), at, segs=8, rings=4)
    rot = Matrix.Rotation(math.radians(yaw), 4, "Z")
    for side in (-1, 1):
        prof = [(0.0, 0.05), (0.22, 0.18), (0.45, 0.1), (0.62, 0.2), (0.6, -0.02), (0.45, -0.08), (0.32, -0.02),
                (0.2, -0.1), (0.08, -0.05)]
        bm = bmesh.new()
        top = [bm.verts.new(at + (rot @ Vector((side * x * s, 0.0, z * s + 0.012 * s)))) for x, z in prof]
        bot = [bm.verts.new(at + (rot @ Vector((side * x * s, 0.025 * s, z * s)))) for x, z in prof]
        bm.faces.new(top if side > 0 else top[::-1])
        bm.faces.new(bot[::-1] if side > 0 else bot)
        m = len(prof)
        for i in range(m):
            j = (i + 1) % m
            f = (top[i], bot[i], bot[j], top[j])
            bm.faces.new(f if side > 0 else f[::-1])
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
        B.mk(bm, "ink", sharp=20)

"""La mascota de BOIA como boia flotante: todas las boias del juego (T39). MUESTRA.

La mascota de art/marca/boia-mascota.jpg (cuerpo redondo naranja, gorro azul
marino en punta con un agujero, ojos grandes, sonrisa ancha, contorno negro)
modelada como boya: el cuerpo es la boia, flota con la línea de agua a un
dedo de la barriga y lleva un aro flotador en la flotación. Se construye con
el Builder de los mundos (mundos/arcilla/escena.py): cada pieza nombra un
PAPEL y el tema del mundo pone el material (arcilla, acuarela o el plano del
glTF). El contorno negro del logo lo pone el estilo: la acuarela lleva su
línea; la arcilla no tiene contorno y dibuja en tinta ojos, cejas y boca.

Variantes (la misma mascota con sus detalles):
    primera     la del logo, aro blanco con bandas azul marino
    info        boia informativa: mástil con un cartel «i» y un gallardete de color (5 colores)
    whatsapp    bocadillo verde de chat con tres puntos, en un mástil
    fiestera    la Boia Fiestera: aro amarillo con bandas rosa, guirnalda de bombillas, pompón en el gorro,
                coloretes y (en el mapa) tres globos atados al aro
Boca: "sonrisa" (la del logo) o "habla" (abierta, con lengua).

Coordenadas: las del Builder (Blender), con la base de la boia en `base` (un punto
a ras de agua) y la cara hacia el ángulo g del mapa (g = 90: a cámara; g = 45:
hacia +X de Blender, la orientación de los glTF).
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

import rig

UP = Vector((0.0, 0.0, 1.0))

# Colores de marca muestreados del logo (art/marca/boia-mascota.jpg: #FE4F18 y #34288A; el naranja del wordmark
# es #EC4F24). Van como papeles nuevos en la paleta de cada tema: register().
ROLES = {
    "mascota": "#F5501E",          # cuerpo naranja
    "mascota_gorro": "#34288A",    # gorro azul marino
    "mascota_verde": "#2FB85A",    # bocadillo de la boia de WhatsApp (verde de chat, sin logo de marca)
}
INFO_COLORS = ("firework_a", "firework_b", "firework_c", "person_d", "person_e")   # gallardete de cada boia info
VARIANTS = ("primera", "info", "whatsapp", "fiestera")
MOUTHS = ("sonrisa", "habla")


def register(hex_table):
    """Añade los papeles de la mascota a la paleta (dict rol -> #hex) de un tema, sin pisar los que ya hay."""
    for role, hexcol in ROLES.items():
        hex_table.setdefault(role, hexcol)


def mdir(g):
    """Vector horizontal de Blender hacia el ángulo g del mapa (mismas cuentas que mapa.py: to_blender)."""
    c, s = math.cos(math.radians(g)), math.sin(math.radians(g))
    s2 = math.sqrt(0.5)
    return Vector((s2 * (c + s), s2 * (c - s), 0.0)).normalized()


def basis(X, Y, Z):
    return Matrix(((X.x, Y.x, Z.x, 0), (X.y, Y.y, Z.y, 0), (X.z, Y.z, Z.z, 0), (0, 0, 0, 1)))


def facing(n, p):
    """Matriz con +Z local en la dirección n y en el punto p (+Y local lo más hacia arriba posible)."""
    n = n.normalized()
    x = UP.cross(n)
    if x.length < 1e-6:
        x = Vector((1.0, 0.0, 0.0))
    x.normalize()
    y = n.cross(x).normalized()
    m = basis(x, y, n)
    m.translation = p
    return m


class Body:
    """El elipsoide del cuerpo: puntos y normales por (acimut, latitud) respecto a la cara."""

    def __init__(self, C, a, c, face, right):
        self.C, self.a, self.c, self.face, self.right = Vector(C), a, c, face, right

    def dir_h(self, az):
        return (self.face * math.cos(az) + self.right * math.sin(az)).normalized()

    def point(self, az, lat, lift=0.0):
        h = self.dir_h(az)
        cp, sp = math.cos(lat), math.sin(lat)
        p = self.C + h * (self.a * cp) + UP * (self.c * sp)
        n = (h * (cp / self.a) + UP * (sp / self.c)).normalized()
        return p + n * lift, n

    def radius_at(self, z):
        t = (z - self.C.z) / self.c
        return self.a * math.sqrt(max(0.0, 1.0 - t * t))


def patch(B, role, body, upper, lower, lift, thick, nt=18, ns=4):
    """Lámina con grosor pegada al cuerpo entre dos curvas (acimut, latitud) de t en [0, 1]: dientes, boca."""
    bm = bmesh.new()
    top, bot = [], []
    for i in range(nt + 1):
        t = i / nt
        (au, lu), (al, ll) = upper(t), lower(t)
        rt, rb = [], []
        for j in range(ns + 1):
            s = j / ns
            az, lat = au + (al - au) * s, lu + (ll - lu) * s
            rt.append(bm.verts.new(body.point(az, lat, lift + thick)[0]))
            rb.append(bm.verts.new(body.point(az, lat, lift)[0]))
        top.append(rt)
        bot.append(rb)
    for i in range(nt):
        for j in range(ns):
            bm.faces.new((top[i][j], top[i + 1][j], top[i + 1][j + 1], top[i][j + 1]))
            bm.faces.new((bot[i][j], bot[i][j + 1], bot[i + 1][j + 1], bot[i + 1][j]))
    ring_t = [top[i][0] for i in range(nt + 1)] + [top[nt][j] for j in range(1, ns + 1)] + \
        [top[i][ns] for i in range(nt - 1, -1, -1)] + [top[0][j] for j in range(ns - 1, 0, -1)]
    ring_b = [bot[i][0] for i in range(nt + 1)] + [bot[nt][j] for j in range(1, ns + 1)] + \
        [bot[i][ns] for i in range(nt - 1, -1, -1)] + [bot[0][j] for j in range(ns - 1, 0, -1)]
    n = len(ring_t)
    for k in range(n):
        bm.faces.new((ring_t[k], ring_b[k], ring_b[(k + 1) % n], ring_t[(k + 1) % n]))
    return B.mk(bm, role)


def curve(body, pts, lift):
    """Puntos del cuerpo a lo largo de una lista de (acimut, latitud)."""
    return [body.point(az, lat, lift)[0] for az, lat in pts]


def arc(a0, a1, l0, l1, bend, n=10):
    """(acimut, latitud) de a0 a a1, con la latitud de l0 a l1 más una comba `bend` (positiva: hacia abajo)."""
    return [(a0 + (a1 - a0) * i / n, l0 + (l1 - l0) * i / n - bend * math.sin(math.pi * i / n)) for i in range(n + 1)]


# --- Cara -----------------------------------------------------------------------------------
def eye(B, body, az, lat, k, look, ink_r):
    """Ojo del logo: óvalo blanco alto con contorno de tinta, pupila negra y brillo blanco."""
    p, n = body.point(az, lat)
    m = facing(n, p)
    ew, eh = 0.105 * k, 0.15 * k
    B.blob("white", (ew, eh, 0.035 * k), (0, 0, 0), extra=m @ Matrix.Translation((0, 0, 0.004 * k)), segs=24,
           rings=10)
    ring = []
    for i in range(33):
        th = 2 * math.pi * i / 32
        ring.append(m @ Vector((ew * 1.02 * math.cos(th), eh * 1.02 * math.sin(th), 0.022 * k)))
    B.tube("ink", ring[:-1], ink_r, segs=6, closed=True)
    px, py = look
    pc = m @ Vector((px * ew * 0.45, py * eh * 0.45 - 0.01 * k, 0.034 * k))
    B.blob("ink", (0.056 * k, 0.07 * k, 0.018 * k), (0, 0, 0), extra=facing(n, pc), segs=16, rings=8)
    hl = m @ Vector((px * ew * 0.45 - 0.022 * k, py * eh * 0.45 + 0.022 * k, 0.05 * k))
    B.blob("white", (0.018 * k, 0.022 * k, 0.008 * k), (0, 0, 0), extra=facing(n, hl), segs=10, rings=6)


def face(B, body, k, mouth, cheeks=False):
    ink_r = 0.012 * k
    # Ojos grandes, algo girados a la derecha de la cara (el logo mira un poco de lado) y mirando arriba.
    eye(B, body, -0.30, 0.40, k, (-0.25, 0.2), ink_r)
    eye(B, body, 0.22, 0.46, k, (-0.25, 0.2), ink_r)
    # Cejas: dos arcos de tinta sobre los ojos.
    for az, lat in ((-0.32, 0.76), (0.24, 0.83)):
        B.tube("ink", curve(body, arc(az - 0.16, az + 0.16, lat - 0.03, lat + 0.02, -0.05, 8), 0.006 * k),
               ink_r * 1.1, segs=6)
    # Boca: la sonrisa ancha del logo (dientes blancos, borde de tinta, pliegue de la mejilla derecha)
    # o, al hablar, abierta: labio de tinta, interior oscuro, dientes de arriba y lengua rosa.
    a0, a1 = -0.40, 0.52
    lift = 0.004 * k
    if mouth == "sonrisa":
        up = lambda t: (a0 + (a1 - a0) * t, 0.0 + 0.14 * t * t - 0.03 * math.sin(math.pi * t))
        lo = lambda t: (a0 + 0.04 + (a1 - a0 - 0.1) * t, 0.0 + 0.14 * t * t - 0.30 * math.sin(math.pi * t) ** 0.8)
        patch(B, "white", body, up, lo, lift, 0.014 * k)
        B.tube("ink", curve(body, [up(i / 16) for i in range(17)], lift + 0.016 * k), ink_r, segs=6)
        B.tube("ink", curve(body, [lo(i / 16) for i in range(17)], lift + 0.016 * k), ink_r * 1.3, segs=6)
    else:
        up = lambda t: (a0 + 0.06 + (a1 - a0 - 0.12) * t, 0.04 + 0.10 * t * t - 0.02 * math.sin(math.pi * t))
        lo = lambda t: (a0 + 0.08 + (a1 - a0 - 0.16) * t, 0.04 + 0.10 * t * t - 0.42 * math.sin(math.pi * t) ** 0.7)
        patch(B, "ink", body, up, lo, lift, 0.012 * k)
        mid = lambda t: (up(t)[0], up(t)[1] + (lo(t)[1] - up(t)[1]) * 0.28)
        patch(B, "white", body, up, mid, lift + 0.006 * k, 0.012 * k, ns=2)
        tu = lambda t: (a0 + 0.2 + (a1 - a0 - 0.42) * t, lo(0.2 + 0.6 * t)[1] + 0.13 * math.sin(math.pi * t) ** 0.5)
        tl = lambda t: (a0 + 0.2 + (a1 - a0 - 0.42) * t, lo(0.2 + 0.6 * t)[1] + 0.015)
        patch(B, "jelly", body, tu, tl, lift + 0.006 * k, 0.012 * k, ns=3)
        ring = [up(i / 16) for i in range(17)] + [lo(1 - i / 16) for i in range(1, 16)]
        B.tube("ink", curve(body, ring, lift + 0.018 * k), ink_r * 1.2, segs=6, closed=True)
    # Pliegue de la mejilla en la comisura derecha.
    B.tube("ink", curve(body, arc(a1 + 0.02, a1 + 0.12, 0.12, 0.24, -0.04, 6), lift + 0.006 * k), ink_r, segs=6)
    if cheeks:
        for az in (-0.62, 0.66):
            p, n = body.point(az, 0.14, 0.004 * k)
            B.blob("jelly", (0.06 * k, 0.04 * k, 0.01 * k), (0, 0, 0), extra=facing(n, p), segs=14, rings=6)


# --- Gorro -----------------------------------------------------------------------------------
def cap(B, body, k, pompom=False, parts=None):
    """Gorro azul marino en punta, ladeado a la izquierda (en pantalla), con el agujero negro cerca de la punta."""
    C, a, c = body.C, body.a, body.c
    L = -body.right                                   # izquierda en pantalla
    # La base asienta en el cuadrante de arriba a la izquierda de la cabeza, siguiendo su normal.
    lat, az_l = math.radians(52), math.radians(40)
    h = (L * math.cos(az_l) + body.face * math.sin(az_l) * 0.25).normalized()
    base = C + h * (a * math.cos(lat) * 0.78) + UP * (c * math.sin(lat) * 0.78)
    nrm = (h * (math.cos(lat) / a) + UP * (math.sin(lat) / c)).normalized()
    mid = base + nrm * (0.2 * k)
    tip = base + UP * (0.33 * k) + L * (0.27 * k) + body.face * (0.03 * k)
    n = 10
    pts, radii = [], []
    for i in range(n + 1):
        t = i / n
        p = (1 - t) ** 2 * base + 2 * (1 - t) * t * mid + t * t * tip          # Bézier: sube y se dobla
        pts.append(p)
        radii.append(max(0.012 * k, 0.215 * k * (1 - t) ** 0.8))
    g = B.tube("mascota_gorro", pts, radii, segs=24)
    if parts is not None:
        parts.append(g)
    # Agujero: disco de tinta en la cara del gorro que mira a cámara, hacia la punta.
    t = 0.62
    i = int(t * n)
    ax = (pts[i + 1] - pts[i]).normalized()
    out = (body.face - ax * body.face.dot(ax)).normalized()
    hp = pts[i] + (pts[i + 1] - pts[i]) * (t * n - i) + out * (radii[i] * 0.93)
    B.blob("ink", (0.035 * k, 0.045 * k, 0.012 * k), (0, 0, 0), extra=facing(out, hp), segs=14, rings=6)
    if pompom:
        B.blob("white", (0.07 * k, 0.07 * k, 0.065 * k), tip, segs=16, rings=8)
    return tip


# --- Aro flotador y detalles -------------------------------------------------------------------
def ring_float(B, body, base, k, role, band, n_bands=4, parts=None):
    zb = 0.10 * k
    R = body.radius_at(base.z + zb) + 0.02 * k
    r = 0.062 * k
    c = base + UP * zb
    t = B.torus(role, R, r, Matrix.Translation(c), nu=48, nv=12)
    if parts is not None:
        parts.append(t)
    for i in range(n_bands):
        th0 = 2 * math.pi * (i + 0.25) / n_bands
        pts = [c + Vector((R * math.cos(th0 + d), R * math.sin(th0 + d), 0.0)) for d in (-0.2, -0.1, 0.0, 0.1, 0.2)]
        B.tube(band, pts, r * 1.08, segs=12)
    return c, R, r


def garland(B, c, R, k):
    """Guirnalda de bombillas colgando alrededor del aro (la de la Fiestera de fiestera.py)."""
    n_b = 12
    ring_r = R + 0.07 * k
    pts = []
    for i in range(n_b * 4 + 1):
        t = i / (n_b * 4)
        th = 2 * math.pi * t
        sag = abs(math.sin(math.pi * n_b * t))
        rr = ring_r + 0.012 * k * sag
        pts.append(c + Vector((rr * math.cos(th), rr * math.sin(th), 0.05 * k - 0.05 * k * sag)))
    B.tube("wire", pts[:-1], 0.007 * k, segs=5, closed=True)
    bulbs = ("bulb", "stage_magenta", "lantern")
    for i in range(n_b):
        th = 2 * math.pi * (i + 0.5) / n_b
        q = c + Vector(((ring_r + 0.015 * k) * math.cos(th), (ring_r + 0.015 * k) * math.sin(th), -0.02 * k))
        B.blob(bulbs[i % 3], (0.032 * k, 0.032 * k, 0.04 * k), q, segs=12, rings=6)


def mast(B, body, c, R, k, height, side=1.0):
    """Mástil fino que sale del aro por detrás, a un lado; devuelve el tope."""
    d = (body.right * side * 0.8 - body.face * 0.6).normalized()
    foot = c + d * R
    top = foot + UP * height
    B.tube("wood_dark", [foot - UP * 0.02 * k, top], 0.018 * k, segs=8)
    return top


def info_sign(B, body, c, R, k, color):
    top = mast(B, body, c, R, k, 0.95 * k, side=1.0)
    n = body.face
    # cartel redondo blanco con la «i» de tinta
    sc = top + UP * 0.12 * k + n * 0.03 * k
    B.blob("white", (0.13 * k, 0.13 * k, 0.03 * k), (0, 0, 0), extra=facing(n, sc), segs=24, rings=8)
    m = facing(n, sc)
    B.blob("ink", (0.026 * k, 0.026 * k, 0.012 * k), (0, 0, 0), extra=m @ Matrix.Translation((0, 0.055 * k, 0.03 * k)),
           segs=12, rings=6)
    B.tube("ink", [m @ Vector((0, 0.015 * k, 0.03 * k)), m @ Vector((0, -0.075 * k, 0.03 * k))], 0.02 * k, segs=8)
    ring = [m @ Vector((0.13 * k * math.cos(2 * math.pi * i / 32), 0.13 * k * math.sin(2 * math.pi * i / 32), 0.02 * k))
            for i in range(32)]
    B.tube("ink", ring, 0.01 * k, segs=6, closed=True)
    # gallardete triangular de color bajo el cartel, hacia fuera
    p0 = top - UP * 0.06 * k
    out = body.right
    tri = [p0, p0 - UP * 0.16 * k, p0 - UP * 0.08 * k + out * 0.2 * k]
    bm = bmesh.new()
    t = n * 0.012 * k
    vs = [bm.verts.new(p + t) for p in tri] + [bm.verts.new(p - t) for p in tri]
    bm.faces.new(vs[:3])
    bm.faces.new(vs[3:][::-1])
    for i in range(3):
        j = (i + 1) % 3
        bm.faces.new((vs[i], vs[3 + i], vs[3 + j], vs[j]))
    B.mk(bm, color)


def chat_bubble(B, body, c, R, k):
    top = mast(B, body, c, R, k, 0.9 * k, side=1.0)
    n = body.face
    bc = top + UP * 0.14 * k + n * 0.04 * k
    m = facing(n, bc)
    B.blob("mascota_verde", (0.2 * k, 0.15 * k, 0.05 * k), (0, 0, 0), extra=m, p=2.3, q=2.0, segs=28, rings=10)
    # colita del bocadillo, hacia la boia
    tail = [m @ Vector((-0.08 * k, -0.1 * k, 0)), m @ Vector((-0.13 * k, -0.2 * k, 0)), m @ Vector((-0.02 * k, -0.12 * k, 0))]
    B.tube("mascota_verde", tail, [0.04 * k, 0.012 * k, 0.03 * k], segs=8)
    for i in (-1, 0, 1):
        B.blob("white", (0.028 * k, 0.028 * k, 0.012 * k), (0, 0, 0), extra=m @ Matrix.Translation((i * 0.085 * k, 0, 0.05 * k)),
               segs=12, rings=6)


def balloons(B, c, R, body, k):
    """Tres globos atados al aro, a la derecha (en pantalla) y un poco por detrás."""
    knot = c + body.right * R * 0.9 - body.face * R * 0.35 + UP * 0.05 * k
    for (dr, db, dz), role in (((0.30, 0.10, 0.95), "firework_a"), ((0.62, 0.28, 1.25), "firework_b"),
                               ((0.10, 0.45, 1.45), "firework_c")):
        p = knot + body.right * dr * k - body.face * db * k + UP * dz * k
        B.blob(role, (0.15 * k, 0.15 * k, 0.19 * k), p, 2.0, 2.2, segs=20, rings=12)
        B.blob("white", (0.03 * k, 0.02 * k, 0.045 * k), p + body.face * 0.12 * k - body.right * 0.06 * k + UP * 0.08 * k,
               segs=8, rings=6)
        nk = p - UP * 0.2 * k
        B.lathe(role, [(0, -0.035 * k), (0.028 * k, -0.03 * k), (0.012 * k, 0.0), (0, 0.01 * k)], tuple(nk), segs=10)
        a, b = knot, nk - UP * 0.03 * k
        w = body.right * 0.03 * k
        B.tube("wire", [a, a.lerp(b, 0.33) + w, a.lerp(b, 0.66) - w, b], 0.006 * k, segs=5)


# --- Contorno del logo -----------------------------------------------------------------------------
OUTLINE_K = 0.022          # grosor del contorno de tinta (T220), en unidades de k: el trazo negro del logo


def hull(B, obj, t):
    """Contorno de casco invertido de `obj`: una copia hinchada `t` por sus normales, con las caras al revés y en
    tinta. Con las caras traseras ocultas (el mar 3D las oculta: Lambert de una cara) sólo asoma el borde: el trazo
    negro que rodea la mascota del logo (art/marca/boia-mascota.jpg). No pasa por B.mk, que reorientaría las caras."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * t
    bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
    for f in bm.faces:
        f.smooth = True
    name = B.next_name()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(B.tema.material("ink"))
    out = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(out)
    out.parent = obj.parent
    out.matrix_parent_inverse = obj.matrix_parent_inverse.copy()
    return out


# --- La boia completa ----------------------------------------------------------------------------
def mascota(B, base, k=1.0, g=90.0, variant="primera", mouth="sonrisa", info=0, with_balloons=True, outline=False):
    """Construye la boia-mascota con la base en `base` (Vector de Blender, en el agua). Devuelve el tope.

    outline: contorno de tinta de casco invertido en cuerpo, gorro y aro (T220: el trazo negro del logo). Sólo
    para los glTF del mar 3D, que ocultan las caras traseras; el arte 2D lleva el contorno de su estilo."""
    if variant not in VARIANTS or mouth not in MOUTHS:
        raise ValueError((variant, mouth))
    base = Vector(base)
    D = mdir(g)
    Rt = UP.cross(D).normalized()          # derecha en pantalla (la cámara mira hacia -D)
    a, c = 0.40 * k, 0.40 * k
    body = Body(base + UP * (0.36 * k), a, c, D, Rt)
    shell = [B.blob("mascota", (a, a, c), body.C, 2.0, 2.0, segs=48, rings=24)]
    face(B, body, k, mouth, cheeks=(variant == "fiestera"))
    tip = cap(B, body, k, pompom=(variant == "fiestera"), parts=shell)
    if variant == "fiestera":
        rc, R, _ = ring_float(B, body, base, k, "fiestera_band", "fiestera", n_bands=6, parts=shell)
        garland(B, rc, R, k)
        if with_balloons:
            balloons(B, rc, R, body, k)
    else:
        rc, R, _ = ring_float(B, body, base, k, "white", "mascota_gorro", parts=shell)
        if variant == "info":
            info_sign(B, body, rc, R, k, INFO_COLORS[info % len(INFO_COLORS)])
        elif variant == "whatsapp":
            chat_bubble(B, body, rc, R, k)
    if outline:
        for obj in shell:
            hull(B, obj, OUTLINE_K * k)
    return tip


def bob_matrix(base, f, n, k=1.0, amp=0.03, tilt=3.0):
    """Balanceo de un fotograma f de n (bucle cerrado) alrededor de la base: sube y baja y cabecea."""
    ph = 2 * math.pi * f / n
    b = Vector(base)
    return (Matrix.Translation(b + Vector((0, 0, amp * k * math.sin(ph))))
            @ Matrix.Rotation(math.radians(tilt * math.sin(ph + 1.0)), 4, Vector((1, -1, 0)).normalized())
            @ Matrix.Rotation(math.radians(tilt * 0.7 * math.sin(ph + 2.4)), 4, Vector((1, 1, 0)).normalized())
            @ Matrix.Translation(-b))


# --- Marcador de secreto ------------------------------------------------------------------------
def secreto(B, base, k=1.0, f=0, n=4):
    """Marcador de secreto: destello dorado de cuatro puntas flotando sobre un remolino de espuma, con burbujas.
    En el bucle el destello gira 90° (simetría de cuatro puntas) y late; las burbujas suben."""
    base = Vector(base)
    ph = f / n
    # destello: estrella de cuatro puntas de cara a la cámara del juego (plano derecha-arriba de pantalla)
    D = mdir(90.0)
    Rt = UP.cross(D).normalized()
    right, _, forward = rig.camera_basis()
    upc = rig.camera_up()
    cz = base + UP * (0.62 * k + 0.05 * k * math.sin(2 * math.pi * ph))
    s = k * (1.0 + 0.12 * math.sin(2 * math.pi * ph))
    star(B, cz, right, upc, -forward, 0.30 * s, 0.07 * s, math.radians(90.0 * ph), "gold")
    B.blob("white", (0.045 * s, 0.045 * s, 0.02 * s), (0, 0, 0), extra=facing(-forward, cz - forward * 0.06 * s),
           segs=12, rings=6)
    # dos chispas pequeñas que se encienden por turnos
    for i, (dx, dy) in enumerate(((-0.32, 0.22), (0.30, -0.12))):
        on = 0.5 + 0.5 * math.cos(2 * math.pi * (ph + 0.5 * i))
        star(B, cz + right * dx * k + upc * dy * k, right, upc, -forward, (0.05 + 0.07 * on) * k, 0.018 * k, 0.0, "gold")
    # remolino de espuma en el agua y burbujas que suben en el bucle
    for i, rr in enumerate((0.26, 0.42)):
        r = rr * k * (1.0 + 0.1 * ((ph + 0.5 * i) % 1.0))
        B.torus("foam", 1.0, 0.024 * k / r, Matrix.Translation(base + UP * 0.02 * k) @ Matrix.Diagonal((r, r, r * 0.5, 1)),
                nu=40, nv=6)
    for i, (ang, rad, sz) in enumerate(((20, 0.12, 0.05), (150, 0.18, 0.04), (260, 0.1, 0.035))):
        z = ((ph + i / 3.0) % 1.0) * 0.3 * k
        p = base + (Rt * math.cos(math.radians(ang)) + D * math.sin(math.radians(ang))) * rad * k + UP * (0.03 * k + z)
        B.blob("foam", (sz * k, sz * k, sz * k * 0.9), p, segs=10, rings=6)
    return cz + UP * 0.34 * s


def star(B, c, right, upc, toward, R, r, rot, role):
    """Estrella plana de cuatro puntas con grosor, en el plano (right, upc), abombada hacia `toward`."""
    bm = bmesh.new()
    pts = []
    for i in range(8):
        th = rot + math.pi * i / 4
        rr = R if i % 2 == 0 else r
        pts.append(c + right * (rr * math.cos(th)) + upc * (rr * math.sin(th)))
    t = toward * (0.12 * R)
    front = [bm.verts.new(p + t * 0.4) for p in pts]
    back = [bm.verts.new(p - t * 0.4) for p in pts]
    cf, cb = bm.verts.new(c + t), bm.verts.new(c - t)
    for i in range(8):
        j = (i + 1) % 8
        bm.faces.new((cf, front[i], front[j]))
        bm.faces.new((cb, back[j], back[i]))
        bm.faces.new((front[i], back[i], back[j], front[j]))
    return B.mk(bm, role, sharp=30)

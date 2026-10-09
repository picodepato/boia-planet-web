"""Lectura y geometría de mapa.json. Python puro: lo usan Blender y las herramientas.

Coordenadas del mapa (u_maq): x a la derecha de la pantalla, y hacia el
espectador. Arriba del mapa es y negativa. Ver "unidades" en mapa.json.
"""
import json
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ARCILLA = os.path.dirname(HERE)
MAPA = os.path.join(ARCILLA, "mapa.json")
S2 = math.sqrt(0.5)


def load(path=MAPA):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


# --- Mapa ↔ Blender --------------------------------------------------------------
def to_blender(x, y, z=0.0):
    """Punto del mapa a coordenadas de Blender (x es 'derecha' de rig.py, y es 'hacia la cámara')."""
    return (S2 * (x + y), S2 * (x - y), z)


def from_blender(X, Y):
    return (S2 * (X + Y), S2 * (X - Y))


def dir_blender(g_deg):
    """Ejes locales (ex, ey) en Blender de una forma girada g grados en el mapa."""
    g = math.radians(g_deg)
    c, s = math.cos(g), math.sin(g)
    ex = to_blender(c, s)
    ey = to_blender(-s, c)
    return ex[:2], ey[:2]


# --- Formas ------------------------------------------------------------------------
def super_r(u, v, a, b, p):
    return abs(u / a) ** p + abs(v / b) ** p


def local(pt, isla):
    cx, cy = isla["centro"]
    g = math.radians(isla.get("giro", 0.0))
    dx, dy = pt[0] - cx, pt[1] - cy
    return dx * math.cos(g) + dy * math.sin(g), -dx * math.sin(g) + dy * math.cos(g)


def inside(pt, isla, margin=0.0):
    u, v = local(pt, isla)
    return super_r(u, v, isla["a"] + margin, isla["b"] + margin, isla.get("p", 2.0)) < 1.0


def outline(isla, n=72, margin=0.0):
    """Contorno de una isla (superelipse) en coordenadas del mapa."""
    a, b, p = isla["a"] + margin, isla["b"] + margin, isla.get("p", 2.0)
    cx, cy = isla["centro"]
    g = math.radians(isla.get("giro", 0.0))
    out = []
    for k in range(n):
        t = 2 * math.pi * k / n
        c, s = math.cos(t), math.sin(t)
        u = a * math.copysign(abs(c) ** (2 / p), c)
        v = b * math.copysign(abs(s) ** (2 / p), s)
        out.append((cx + u * math.cos(g) - v * math.sin(g), cy + u * math.sin(g) + v * math.cos(g)))
    return out


def circle(c, r, n=48):
    return [(c[0] + r * math.cos(2 * math.pi * k / n), c[1] + r * math.sin(2 * math.pi * k / n)) for k in range(n)]


def all_islands(M):
    """Todas las tierras con colisión: (zona o grupo, isla)."""
    out = []
    for z in M["zonas"]:
        for i in z.get("islas", []):
            out.append((z["id"], i))
    for c in M["costas"]:
        for k, t in enumerate(c.get("tramos", [])):
            out.append((c["id"], dict(t, id="%s_%d" % (c["id"], k), giro=0, p=4.0)))
    for s in M.get("solares_l2", []):
        out.append(("l2", dict(s["isla"], id=s["id"])))
    for s in M.get("minijuegos", []):
        out.append(("minijuegos", dict(s["isla"], id=s["id"])))
    # Las Calitas (plan 022 T237): desde que vive junto al náufrago, también es tierra para las rutas.
    for s in M.get("islas_sueltas", []):
        out.append(("islas_sueltas", dict(s["isla"], id=s["id"])))
    return out


def on_land(M, pt, margin=0.0):
    """¿Cae el punto en tierra (con un margen de agua alrededor)?"""
    L = M["limites"]
    if pt[0] <= L["x_min"] + margin or pt[0] >= L["x_max"] - margin:
        return "costa"
    for zid, isla in all_islands(M):
        if inside(pt, isla, margin):
            return "%s/%s" % (zid, isla["id"])
    return None


# --- Polilíneas ---------------------------------------------------------------------
def length(pts):
    return sum(math.dist(a, b) for a, b in zip(pts, pts[1:]))


def sample(pts, step=0.1):
    for a, b in zip(pts, pts[1:]):
        n = max(1, int(math.dist(a, b) / step))
        for k in range(n):
            t = k / n
            yield (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
    yield tuple(pts[-1])


def crossings(M, pts, margin=0.0, step=0.1):
    """Tramos de la polilínea que pisan tierra: lista de (punto, tierra)."""
    hits, last = [], None
    for p in sample(pts, step):
        land = on_land(M, p, margin)
        if land and land != last:
            hits.append((p, land))
        last = land
    return hits


def point_in_poly(pt, poly):
    x, y = pt
    inside_ = False
    for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside_ = not inside_
    return inside_


def poly_area(poly):
    return 0.5 * sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]))

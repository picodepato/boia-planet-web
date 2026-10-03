"""The coast for the hero scene (plan 007, T78). MUESTRA.

Two ridges in two depths with the feel of the Alicante coast (Serra Grossa,
Cabo de las Huertas): a near headland that drops into the sea with a rock
face toward the water and scrub on the gentle side, and a long far ridge
that fades into the haze. Displaced grids with fractal noise: a jagged
skyline of several peaks, a cliff on the sea side, coves along the shore,
no faceting (smooth normals, computed by the loader). Reads as a silhouette
with a lit edge at golden hour; it sits on the left of the frame and recedes
seaward.

Origin at the foot of the near headland at the waterline; the ridges run
seaward (+Y) and away from the harbour (-X); the sea side faces +X.
Materials: `costa` (vertex colours: rock, scrub, dry grass, wet rock).
"""
import math

import bmesh
from mathutils import Vector

import comun as K

ID = "costa"
LABEL = "Costa (sierra y cabo)"
DOC = ("the coast on the left of the frame: a near headland dropping into the sea with a rock face and scrub, "
       "and a long far ridge in the haze; displaced grids with fractal noise, smooth normals")
BUDGET_TRIS = 3000
BUDGET_KB = 45
EXPORT_NORMALS = False   # a smooth terrain: the loader's computed vertex normals are the same, 12 bytes a vertex less

# (axis start, axis end, width across, max height, nx, ny, seed)
RIDGES = [
    ((-40.0, 60.0), (-220.0, 820.0), 240.0, 95.0, 52, 13, 1.0),
    ((-480.0, 700.0), (-1350.0, 2400.0), 900.0, 240.0, 50, 11, 2.0),
]
SEA_FRACTION = 0.4      # where the crest sits across the width (sea side before it)

C_ROCK = K.hex_lin("#4e443c")
C_ROCK_DARK = K.hex_lin("#26221f")
C_WET = K.hex_lin("#1a1816")
C_SCRUB = K.hex_lin("#2a3220")
C_GRASS = K.hex_lin("#5c5238")


def across_profile(v):
    """Height factor across the ridge: a cliff on the sea side, a gentle slope inland."""
    if v < SEA_FRACTION:
        s = v / SEA_FRACTION
        return s ** 0.55                     # steep from the water, a sharp crest
    s = (v - SEA_FRACTION) / (1.0 - SEA_FRACTION)
    return (1.0 - s) ** 0.9


def ridge(bm, spec):
    (x0, y0), (x1, y1), width, hmax, nx, ny, seed = spec
    start = Vector((x0, y0, 0.0))
    a = Vector((x1 - x0, y1 - y0, 0.0))
    length = a.length
    a.normalize()
    perp = Vector((a.y, -a.x, 0.0))
    if perp.x < 0:
        perp = -perp          # the sea side is +X (toward the harbour and the camera)

    def crest(u):
        env = math.sin(math.pi * u) ** 0.45
        peaks = K.ridged((u * 12.0, seed, 0.0), 4, seed=seed)
        small = K.ridged((u * 27.0, seed + 9.0, 0.3), 2, seed=seed + 1)
        return hmax * env * (0.2 + 0.65 * peaks + 0.15 * small)

    def point(i, j, u, v):
        h = crest(u)
        p = start + a * (u * length) + perp * ((SEA_FRACTION - v) * width)
        # Coves and spurs: the shoreline wanders; the crest line too.
        p += perp * (0.1 * width * K.fbm((u * 4.0, seed, 0.5), 2, seed=seed + 2) * (1.0 - v))
        f = across_profile(v)
        z = h * f
        z += 0.5 * h * (f ** 0.6) * K.fbm((p.x / 75.0, p.y / 75.0, 0.0), 5, seed=seed + 3)
        z += 0.3 * h * (f ** 0.5) * (K.ridged((p.x / 38.0, p.y / 38.0, 0.0), 3, seed=seed + 8) - 0.5)
        z += 5.0 * (f ** 0.3) * K.fbm((p.x / 12.0, p.y / 12.0, 1.0), 2, seed=seed + 4)
        if j == 0:
            z = -6.0           # skirt under the water
        elif j == ny:
            z = max(z, 2.0)     # the land side stays above the water
        else:
            z = max(z, 0.5 + 3.0 * v)
        return (p.x, p.y, z)

    K.grid(bm, nx, ny, point)


def build():
    mat = K.pbr_material("costa", "#6f6052", roughness=0.95)
    parts = []
    for n, spec in enumerate(RIDGES):
        bm = bmesh.new()
        ridge(bm, spec)
        K.finish(bm)
        ob = K.new_object("costa_%d" % (n + 1), bm, [mat])
        nx, ny, seed, hmax = spec[4], spec[5], spec[6], spec[3]

        def colour(co, nrm, i, nx=nx, ny=ny, seed=seed, hmax=hmax):
            v = (i // (nx + 1)) / ny
            if co.z < 1.5:
                return C_WET
            steep = 1.0 - min(1.0, max(0.0, (nrm.z - 0.5) / 0.3))
            sea_face = 1.0 if v < SEA_FRACTION * 0.85 else 0.0
            rockness = max(steep, sea_face * 0.9)
            rockness = max(rockness, 0.5 + 0.5 * K.fbm((co.x / 30.0, co.y / 30.0, co.z / 30.0), 2, seed=seed + 7)
                           if co.z > 0.6 * hmax else 0.0)
            k = 0.5 + 0.5 * K.fbm((co.x / 40.0, co.y / 40.0, co.z / 40.0), 2, seed=seed + 5)
            veg = K.mix(C_SCRUB, C_GRASS, k)
            rock = K.mix(C_ROCK, C_ROCK_DARK, 0.5 + 0.5 * K.fbm((co.x / 25.0, co.y / 25.0, 2.0), 2, seed=seed + 6))
            return K.mix(veg, rock, rockness)
        K.paint(ob, colour)
        parts.append(ob)
    return {"main": parts, "lights": [], "anchor": "foot of the near headland at the waterline; ridges run seaward (+Y) and to -X"}

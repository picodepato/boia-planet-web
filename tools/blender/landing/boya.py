"""Navigation buoy for the hero scene (plan 007, T78). MUESTRA.

A real pillar buoy, not the mascot (design document section 13.5): a steel
float with a rubber fender ring, a weathered band at the waterline, a lattice
superstructure of four posts and two rings, a lantern on top. Origin at the
centre of the float at the waterline (z = 0), about 3.2 m above the water.

Materials: `boya` (vertex colours: orange float, dark cage) and `luz_boya`
(the lens, emissive). Light mesh: `luz_boya`.
"""
import math

import bmesh
from mathutils import Matrix

import comun as K

ID = "boya"
LABEL = "Boya de balizamiento"
DOC = "navigation pillar buoy: orange steel float with a fender ring, dark lattice tower and a lantern on top"
BUDGET_TRIS = 400
BUDGET_KB = 10

FLOAT_R = 1.0        # float radius (m)
FLOAT_TOP = 0.55     # deck of the float above the water
CAGE_TOP = 2.55      # top ring of the lattice
LENS_Z = (2.75, 3.05)
SEGS = 12

ORANGE = K.hex_lin("#e0661e")
RUST = K.hex_lin("#5a3524")
DARK = K.hex_lin("#23252a")
RUBBER = K.hex_lin("#141416")


def build():
    mat = K.pbr_material("boya", "#e0661e", roughness=0.6)
    mat_luz = K.pbr_material("luz_boya", K.LIGHTS["boya"], roughness=0.3, vertex_color=False,
                             emissive_hex=K.LIGHTS["boya"])
    bm = bmesh.new()
    # Float: a steel can with a shallow conical deck; skirt under the water so the hull meets it.
    K.lathe(bm, [(0.55, -1.1), (FLOAT_R, -0.6), (FLOAT_R, 0.1), (FLOAT_R, FLOAT_TOP),
                 (0.78, FLOAT_TOP + 0.08), (0.34, FLOAT_TOP + 0.3)], segments=SEGS, close=True)
    # Rubber fender ring around the float.
    K.tube(bm, [(FLOAT_R * 1.04 * math.cos(2 * math.pi * i / SEGS), FLOAT_R * 1.04 * math.sin(2 * math.pi * i / SEGS),
                 0.2) for i in range(SEGS)], 0.09, segments=3, closed=True)
    # Central column carrying the lantern.
    K.cylinder(bm, 0.2, 0.17, CAGE_TOP + 0.2 - (FLOAT_TOP + 0.3), segments=6,
               matrix=Matrix.Translation((0, 0, FLOAT_TOP + 0.3)), cap1=False, cap2=False)
    # Lattice: four raked posts and two rings.
    for i in range(4):
        a = math.pi / 4 + i * math.pi / 2
        lo = (0.72 * math.cos(a), 0.72 * math.sin(a), FLOAT_TOP)
        hi = (0.42 * math.cos(a), 0.42 * math.sin(a), CAGE_TOP)
        K.tube(bm, [lo, hi], 0.035, segments=3)
    for z, r in ((1.5, 0.57), (CAGE_TOP, 0.42)):
        K.tube(bm, [(r * math.cos(2 * math.pi * i / 8), r * math.sin(2 * math.pi * i / 8), z) for i in range(8)],
               0.03, segments=3, closed=True)
    # Lantern housing (dark) and cap.
    K.cylinder(bm, 0.24, 0.24, LENS_Z[0] - (CAGE_TOP + 0.2), segments=6,
               matrix=Matrix.Translation((0, 0, CAGE_TOP + 0.2)), cap1=False, cap2=True)
    K.lathe(bm, [(0.24, LENS_Z[1]), (0.26, LENS_Z[1] + 0.04), (0.0, LENS_Z[1] + 0.18)], segments=8, close=False)
    K.finish(bm)
    body = K.new_object("boya_cuerpo", bm, [mat], sharp_deg=50)

    def colour(co, n, i):
        r = math.hypot(co.x, co.y)
        if co.z > FLOAT_TOP + 0.31 or (r < 0.3 and co.z > FLOAT_TOP + 0.2):
            return DARK
        if 0.105 < co.z < 0.3 and r > FLOAT_R - 0.1:
            return RUBBER
        if co.z < 0.1:
            # Weathered band at the waterline, darker the deeper it goes.
            t = min(1.0, (0.1 - co.z) / 0.5)
            return K.mix(K.shade(ORANGE, 0.8), RUST, 0.4 + 0.6 * t)
        return K.mix(ORANGE, K.shade(ORANGE, 0.78), 0.5 + 0.5 * K.fbm((co.x * 3, co.y * 3, co.z * 3), 2, seed=4))

    K.paint(body, colour)

    bl = bmesh.new()
    K.cylinder(bl, 0.2, 0.2, LENS_Z[1] - LENS_Z[0], segments=8, matrix=Matrix.Translation((0, 0, LENS_Z[0])))
    luz = K.new_object("luz_boya", bl, [mat_luz], sharp_deg=50)
    return {"main": [body], "lights": [("luz_boya", luz, K.LIGHTS["boya"])], "anchor": "centre of the float at the waterline"}

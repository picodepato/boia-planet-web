"""The port for the hero scene (plan 007, T78). MUESTRA.

Two rubble-mound breakwaters with a concrete crown wall and a promenade,
each ending in a round head carrying a beacon tower (green on the left,
red on the right: leaving a port in IALA region A), a quay wall on the lee
side of the long left breakwater with a row of lamp posts and mooring
bollards (the feel of Alicante's Dique de Levante). The camera sits inside
the harbour looking out through the mouth, so the lee sides and the heads
are what shows; the armour wraps around the heads.

Origin at the centre of the harbour mouth at the waterline; the shore and
the camera are at -Y (seaward is +Y), the heads at x = +-85 m. Materials: `hormigon`
(vertex colours: stone, concrete, paint), `luz_verde`, `luz_roja`,
`luz_muelle` (emissive). Light meshes: `luz_verde`, `luz_roja`,
`luz_muelle_01`..`luz_muelle_08`.
"""
import math

import bmesh
from mathutils import Matrix, Vector

import comun as K

ID = "puerto"
LABEL = "Puerto (diques, balizas y farolas)"
DOC = ("two rubble-mound breakwaters with crown walls and promenades, round heads with a green and a red beacon "
       "tower, a quay wall with eight lamp posts and bollards on the lee of the long left breakwater")
BUDGET_TRIS = 3500
BUDGET_KB = 55

HEAD_X = 85.0
LEFT = ((-HEAD_X, 0.0), (-125.0, -300.0))     # axis of the left breakwater: head -> shore (-Y)
RIGHT = ((HEAD_X, 0.0), (112.0, -200.0))
PROMENADE_Z = 4.2
CROWN_Z = 6.6
TOWER_BASE_Z = 5.5
TOWER_TOP_Z = 14.5
LENS_Z = (15.2, 16.0)
LAMP_H = 7.5

C_ARMOUR = K.hex_lin("#5c5750")
C_CROWN = K.hex_lin("#a6a197")
C_PROM = K.hex_lin("#8f8b83")
C_QUAY = K.hex_lin("#777169")
C_WET = K.hex_lin("#3b3b39")
C_WHITE = K.hex_lin("#d8d4cc")
C_GREEN = K.hex_lin("#2f6b4a")
C_RED = K.hex_lin("#8a2a22")
C_ROOF = K.hex_lin("#2a2a2a")
C_POST = K.hex_lin("#1e2420")
C_BOLLARD = K.hex_lin("#1a1a1a")

# Cross-section (d across, z): d < 0 is the outer (sea) side, d > 0 the lee side. The armour slope,
# the crown wall, the promenade and the vertical quay wall with a break at the wet band.
SECTION = [(-24.0, -2.0), (-16.0, 0.4), (-9.5, 3.6), (-8.0, PROMENADE_Z), (-8.0, CROWN_Z),
           (-5.6, CROWN_Z), (-5.6, PROMENADE_Z), (6.5, PROMENADE_Z), (6.5, 0.6), (6.5, -2.0)]
ARMOUR_POINTS = 3   # the first points of SECTION are the rubble slope: they get the noise


def axis(bw):
    (x0, y0), (x1, y1) = bw
    a = Vector((x1 - x0, y1 - y0, 0.0))
    length = a.length
    a.normalize()
    return Vector((x0, y0, 0.0)), a, length


def outward(a, side):
    """Across vector pointing to the outer (sea) side: -X-ish for the left breakwater, +X-ish for the right."""
    perp = Vector((a.y, -a.x, 0.0))
    if (perp.x < 0) != (side < 0):
        perp = -perp
    return perp


def breakwater(bm, bw, side, segments, seed):
    start, a, length = axis(bw)
    out = outward(a, side)
    sections = []
    for i in range(segments + 1):
        u = i / segments
        base = start + a * (u * length)
        ring = []
        for k, (d, z) in enumerate(SECTION):
            # The outer (sea) side is d < 0: move along `out` by -d.
            p = base + out * (-d)
            pz = z
            if k < ARMOUR_POINTS and 0 < k:
                n = K.fbm((p.x * 0.11, p.y * 0.11, z * 0.3), 3, seed=seed)
                pz += 0.9 * n
                p += out * (0.8 * K.fbm((p.x * 0.07, p.y * 0.07, 1.0), 2, seed=seed + 1))
            ring.append((p.x, p.y, pz))
        sections.append(ring)
    verts, faces, rings = K.loft(bm, sections, closed_rings=False, cap_first=False, cap_last=True)
    return start, a, out, length


def head(bm, centre, segments=12):
    """Round rubble head: the armour profile revolved around the head centre, with the concrete block on top."""
    m = Matrix.Translation((centre.x, centre.y, 0.0))
    K.lathe(bm, [(24.0, -2.0), (17.0, 0.0), (12.5, 2.2), (9.0, 3.8), (8.0, PROMENADE_Z)], segments=segments,
            matrix=m, close=False)
    K.lathe(bm, [(8.0, PROMENADE_Z - 0.1), (5.0, PROMENADE_Z), (4.6, TOWER_BASE_Z), (0.0, TOWER_BASE_Z)],
            segments=segments, matrix=m, close=False)


def tower(bm, centre):
    m = Matrix.Translation((centre.x, centre.y, 0.0))
    K.cylinder(bm, 1.7, 1.4, TOWER_TOP_Z - TOWER_BASE_Z, segments=12, cap1=False, cap2=False,
               matrix=m @ Matrix.Translation((0, 0, TOWER_BASE_Z)))
    K.cylinder(bm, 2.3, 2.3, 0.4, segments=12, matrix=m @ Matrix.Translation((0, 0, TOWER_TOP_Z)))        # gallery
    K.tube(bm, [(centre.x + 2.15 * math.cos(2 * math.pi * i / 12), centre.y + 2.15 * math.sin(2 * math.pi * i / 12),
                 TOWER_TOP_Z + 1.4) for i in range(12)], 0.035, segments=3, closed=True)                  # railing
    for i in range(4):
        ang = 2 * math.pi * i / 4 + math.pi / 4
        K.tube(bm, [(centre.x + 2.15 * math.cos(ang), centre.y + 2.15 * math.sin(ang), TOWER_TOP_Z + 0.4),
                    (centre.x + 2.15 * math.cos(ang), centre.y + 2.15 * math.sin(ang), TOWER_TOP_Z + 1.4)],
               0.025, segments=3)
    K.cylinder(bm, 0.95, 0.95, LENS_Z[0] - (TOWER_TOP_Z + 0.4), segments=8, cap1=False, cap2=False,
               matrix=m @ Matrix.Translation((0, 0, TOWER_TOP_Z + 0.4)))                                  # lantern room
    K.lathe(bm, [(0.95, LENS_Z[1]), (1.15, LENS_Z[1] + 0.15), (0.0, LENS_Z[1] + 1.1)], segments=8, matrix=m,
            close=False)                                                                                 # roof


def lens(name, centre, color):
    bl = bmesh.new()
    K.cylinder(bl, 0.8, 0.8, LENS_Z[1] - LENS_Z[0], segments=8,
               matrix=Matrix.Translation((centre.x, centre.y, LENS_Z[0])))
    mat = K.pbr_material(name, color, roughness=0.3, vertex_color=False, emissive_hex=color)
    return K.new_object(name, bl, [mat], sharp_deg=50)


def lamp_post(bm, pos, arm_dir):
    m = Matrix.Translation(pos)
    K.cylinder(bm, 0.09, 0.06, LAMP_H, segments=6, cap1=False, matrix=m)
    tip = Vector(pos) + arm_dir * 1.4 + Vector((0, 0, LAMP_H - 0.15))
    K.tube(bm, [(pos[0], pos[1], pos[2] + LAMP_H - 0.3), tip], 0.04, segments=3)
    K.lathe(bm, [(0.06, -0.02), (0.3, 0.12), (0.1, 0.36)], segments=6, close=True,
            matrix=Matrix.Translation(tip - Vector((0, 0, 0.36))))
    return tip - Vector((0, 0, 0.36))


def bollard(bm, pos):
    K.lathe(bm, [(0.3, 0.0), (0.24, 0.65), (0.32, 0.85), (0.0, 1.05)], segments=6,
            matrix=Matrix.Translation(pos), close=False)


def build():
    mat = K.pbr_material("hormigon", "#8f8b83", roughness=0.92)
    mat_lamp = K.pbr_material("luz_muelle", K.LIGHTS["muelle"], roughness=0.3, vertex_color=False,
                              emissive_hex=K.LIGHTS["muelle"])
    parts, lights = [], []

    # Breakwaters, heads and towers.
    for bw, side, segs, seed in ((LEFT, -1, 18, 1.0), (RIGHT, 1, 10, 2.0)):
        bm = bmesh.new()
        start, a, out, length = breakwater(bm, bw, side, segs, seed)
        head(bm, start)
        tower(bm, start)
        K.finish(bm)
        ob = K.new_object("puerto_dique_%s" % ("izq" if side < 0 else "der"), bm, [mat], sharp_deg=40)
        paint = C_GREEN if side < 0 else C_RED

        def colour(co, n, i, start=start, a=a, out=out, paint=paint):
            r = math.hypot(co.x - start.x, co.y - start.y)
            if r < 2.6 and co.z > TOWER_BASE_Z + 0.1:
                if co.z > LENS_Z[1]:
                    return C_ROOF
                if co.z > TOWER_TOP_Z - 0.05:
                    return C_WHITE
                return paint
            if co.z > PROMENADE_Z + 0.3:
                return C_CROWN
            d = -(co - start).dot(out)
            if co.z >= PROMENADE_Z - 0.05:
                return C_PROM if d > -7 else C_CROWN
            if d > 2.0:
                return C_QUAY if co.z > 0.55 else C_WET
            k = 0.5 + 0.5 * K.fbm((co.x * 0.2, co.y * 0.2, co.z * 0.2), 2, seed=3)
            c = K.mix(K.shade(C_ARMOUR, 0.75), K.shade(C_ARMOUR, 1.15), k)
            return c if co.z > 0.5 else K.mix(c, C_WET, 0.7)
        K.paint(ob, colour)
        parts.append(ob)
    lights.append(("luz_verde", lens("luz_verde", Vector(LEFT[0]), K.LIGHTS["verde"]), K.LIGHTS["verde"]))
    lights.append(("luz_roja", lens("luz_roja", Vector(RIGHT[0]), K.LIGHTS["roja"]), K.LIGHTS["roja"]))

    # Lamp posts and bollards along the quay edge of the left breakwater.
    start, a, length = axis(LEFT)
    out = outward(a, -1)
    bm = bmesh.new()
    heads = []
    for k in range(8):
        u = 0.07 + 0.118 * k
        pos = start + a * (u * length) - out * 4.6 + Vector((0, 0, PROMENADE_Z))
        heads.append(lamp_post(bm, pos, -out))
    K.finish(bm)
    posts = K.new_object("puerto_farolas", bm, [mat], sharp_deg=50)
    K.paint(posts, lambda co, n, i: C_POST)
    parts.append(posts)
    for i, h in enumerate(heads):
        bl = bmesh.new()
        K.cylinder(bl, 0.16, 0.16, 0.14, segments=6, matrix=Matrix.Translation(h - Vector((0, 0, 0.12))))
        name = "luz_muelle_%02d" % (i + 1)
        lights.append((name, K.new_object(name, bl, [mat_lamp], sharp_deg=50), K.LIGHTS["muelle"]))
    bm = bmesh.new()
    for k in range(4):
        u = 0.14 + 0.24 * k
        pos = start + a * (u * length) - out * 5.9 + Vector((0, 0, PROMENADE_Z))
        bollard(bm, pos)
    K.finish(bm)
    bollards = K.new_object("puerto_norays", bm, [mat], sharp_deg=50)
    K.paint(bollards, lambda co, n, i: C_BOLLARD)
    parts.append(bollards)
    return {"main": parts, "lights": lights, "anchor": "centre of the harbour mouth at the waterline, shore at -Y, sea at +Y"}

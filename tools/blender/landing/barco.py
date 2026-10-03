"""The boat ahead of the hero camera (plan 007, T78). MUESTRA.

A 10.4 m motor-sailer with real proportions (design document section 12 and
13.6): a displacement hull with a wide transom, boot-top stripe and
antifouling, a cambered deck with a toe rail, a coachroof with dark windows,
a cockpit with its wheel, a tapered mast with spreaders, the boom with the
furled mainsail under its cover, stays, stanchions and lifelines, a pulpit
and a pushpit, two lanterns on the coachroof and the masthead light. Seen
from behind at ~100 m in the still, mostly as a silhouette against the sun.

Bow at +Y (seaward), waterline at z = 0, origin at the centre of the
waterline length (the hull is built with the bow at -Y and turned 180
degrees at the end). Materials: `barco` (vertex colours), `cristal` (window
glass), `luz_farol` (emissive). Light meshes: `luz_tope` (masthead),
`luz_farol_babor`, `luz_farol_estribor` (lanterns).
"""
import math

import bmesh
from mathutils import Matrix, Vector

import comun as K

ID = "barco"
LABEL = "Barco (motovelero de 10 m)"
DOC = ("10 m motor-sailer seen from astern: dark hull with a white boot-top, cambered deck, coachroof with "
       "windows, cockpit and wheel, mast with spreaders, boom with the furled main under its cover, stays, "
       "lifelines, two lanterns and a masthead light")
BUDGET_TRIS = 2000
BUDGET_KB = 35

LOA = 10.4
STERN_Y = 5.0
BOW_Y = STERN_Y - LOA
BEAM_HALF = 1.72
STATIONS = [0.0, 0.05, 0.12, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.88, 0.94, 0.98, 1.0]   # t: stern -> bow
MAST_Y = -0.9
MAST_TOP = 14.0
CAMBER = 0.07

C_HULL = K.hex_lin("#121c2e")
C_BOOT = K.hex_lin("#e6e2d8")
C_ANTIFOUL = K.hex_lin("#4a2a28")
C_DECK = K.hex_lin("#9a9284")
C_CABIN = K.hex_lin("#dcd7cb")
C_COCKPIT = K.hex_lin("#8c857a")
C_SPAR = K.hex_lin("#c6c6c0")
C_COVER = K.hex_lin("#1f2d48")
C_STEEL = K.hex_lin("#d0d0cc")
C_BLACK = K.hex_lin("#141414")


def t_of_y(y):
    return (STERN_Y - y) / LOA


def y_of_t(t):
    return STERN_Y - t * LOA


def sheer(t):
    """Height of the gunwale: lowest a little aft of midships, rising to the bow."""
    return 1.0 + 0.42 * t ** 3 + 0.06 * (1 - t) ** 2


def beam(t):
    """Half-width at the sheer: wide transom, fullest at 42 % from the stern, fine bow."""
    if t >= 0.42:
        return max(0.06, BEAM_HALF * max(0.0, 1 - ((t - 0.42) / 0.58) ** 2) ** 0.65)
    return BEAM_HALF * max(0.0, 1 - 0.35 * ((0.42 - t) / 0.42) ** 2) ** 0.7


def keel(t):
    return -0.08 - 0.55 * math.sin(math.pi * t) ** 0.6


def width_at(t, z):
    """Half-width of the hull section at height z (keel to sheer), a rounded-bilge shape with a little flare."""
    zs, zk, b = sheer(t), keel(t), beam(t)
    s = min(1.0, max(0.0, (z - zk) / (zs - zk)))
    return b * (1 - (1 - s) ** 2.3) ** 0.55 * (0.96 + 0.04 * s)


def section(t):
    """Ring of 15 points from the port sheer round the keel to the starboard sheer (open at the top)."""
    zs, zk = sheer(t), keel(t)
    levels = [zs, zs - 0.3, 0.34, 0.33, 0.12, 0.11, (0.11 + zk) / 2.0, zk]
    levels = [max(z, zk) for z in levels]
    y = y_of_t(t)
    half = [(width_at(t, z), y, z) for z in levels]
    port = [(-x, yy, z) for x, yy, z in half[:-1]]
    stbd = [(x, yy, z) for x, yy, z in reversed(half[:-1])]
    return port + [(0.0, y, zk)] + stbd


def deck_z(t, x):
    return sheer(t) + CAMBER * (1 - (x / max(beam(t), 0.07)) ** 2)


def build_hull(mat):
    bm = bmesh.new()
    sections = [section(t) for t in STATIONS]
    _, _, rings = K.loft(bm, sections, closed_rings=False, cap_first=True)
    # Stem: close the bow ring with a narrow n-gon.
    bm.faces.new(rings[-1])
    K.finish(bm)
    hull = K.new_object("barco_casco", bm, [mat], sharp_deg=60)

    def colour(co, n, i):
        if co.z >= 0.335:
            return C_HULL
        if co.z >= 0.115:
            return C_BOOT
        return C_ANTIFOUL
    K.paint(hull, colour)
    return hull


def build_deck(mat):
    """Deck with camber, toe rail, cockpit well with coaming, wheel pedestal."""
    bm = bmesh.new()
    rows = []
    for t in STATIONS:
        b = beam(t)
        y = y_of_t(t)
        rows.append([bm.verts.new((-b, y, sheer(t))), bm.verts.new((0.0, y, sheer(t) + CAMBER)),
                     bm.verts.new((b, y, sheer(t)))])
    for a, c in zip(rows, rows[1:]):
        bm.faces.new((a[0], a[1], c[1], c[0]))
        bm.faces.new((a[1], a[2], c[2], c[1]))
    # Toe rail along both sheers.
    for side in (-1, 1):
        pts = [(side * (beam(t) - 0.03), y_of_t(t), sheer(t) + 0.02) for t in STATIONS]
        K.tube(bm, pts, 0.04, segments=3)
    # Cockpit: coaming box with the well sunk into it.
    y0, y1 = 1.5, 3.7
    tc = t_of_y((y0 + y1) / 2)
    w = beam(tc) * 0.62
    zd = sheer(tc) + 0.02
    ret = bmesh.ops.create_cube(bm, size=1.0)
    verts = ret["verts"]
    bmesh.ops.transform(bm, matrix=Matrix.Translation((0, (y0 + y1) / 2, zd + 0.14))
                        @ Matrix.Diagonal((2 * w, y1 - y0, 0.28, 1.0)), verts=verts)
    top = max({f for v in verts for f in v.link_faces}, key=lambda f: f.calc_center_median().z)
    ins = bmesh.ops.inset_region(bm, faces=[top], thickness=0.2, depth=0.0)
    ext = bmesh.ops.extrude_face_region(bm, geom=[top])
    new_verts = [e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=new_verts, vec=(0.0, 0.0, -0.6))
    bmesh.ops.delete(bm, geom=[top], context="FACES_ONLY")
    del ins
    # Wheel pedestal and wheel (seen from astern).
    K.cylinder(bm, 0.07, 0.06, 0.95, segments=6, matrix=Matrix.Translation((0, 3.1, zd)), cap1=False)
    wheel = [(0.42 * math.cos(2 * math.pi * i / 10), 3.1, zd + 1.0 + 0.42 * math.sin(2 * math.pi * i / 10))
             for i in range(10)]
    K.tube(bm, wheel, 0.03, segments=3, closed=True)
    K.finish(bm)
    deck = K.new_object("barco_cubierta", bm, [mat], sharp_deg=50)

    def colour(co, n, i):
        if abs(co.y - 3.1) < 0.5 and co.z > zd + 0.3:
            return C_STEEL
        if y0 - 0.1 < co.y < y1 + 0.1 and abs(co.x) < w + 0.05 and co.z > zd - 0.1:
            return C_COCKPIT if co.z < zd + 0.3 else C_DECK
        return C_DECK
    K.paint(deck, colour)
    return deck


def cabin_profile(y):
    """(half-width, deck z at the side, deck z at the centre, height) of the coachroof at y."""
    t = t_of_y(y)
    w = beam(t) * 0.72 - 0.12
    h = 0.78 + 0.03 * (y - 1.3) - 0.1 * max(0.0, (-1.0 - y) / 1.8) ** 1.5
    return w, deck_z(t, w), deck_z(t, 0.0), h


def build_cabin(mat, mat_glass):
    bm = bmesh.new()
    ys = [1.3, 0.2, -1.0, -2.0, -2.9]
    sections = []
    for y in ys:
        w, zside, zc, h = cabin_profile(y)
        top = zc + h
        sections.append([(-w, y, zside - 0.02), (-w + 0.1, y, top - 0.08), (-w * 0.78, y, top),
                         (w * 0.78, y, top), (w - 0.1, y, top - 0.08), (w, y, zside - 0.02)])
    K.loft(bm, sections, closed_rings=True, cap_first=True, cap_last=True)
    # Windows: three per side, flat quads a hair outside the inclined side.
    for yc in (0.75, -0.45, -1.55):
        for side in (-1, 1):
            w, zside, zc, h = cabin_profile(yc)
            top = zc + h
            z0, z1 = zside + 0.32, zside + 0.6
            frac0 = (z0 - (zside - 0.02)) / (top - 0.08 - (zside - 0.02))
            frac1 = (z1 - (zside - 0.02)) / (top - 0.08 - (zside - 0.02))
            x0 = (w - 0.1 * frac0 + 0.015) * side
            x1 = (w - 0.1 * frac1 + 0.015) * side
            vs = [bm.verts.new((x0, yc - 0.32, z0)), bm.verts.new((x0, yc + 0.32, z0)),
                  bm.verts.new((x1, yc + 0.32, z1)), bm.verts.new((x1, yc - 0.32, z1))]
            f = bm.faces.new(vs if side > 0 else list(reversed(vs)))
            f.material_index = 1
    K.finish(bm)
    cabin = K.new_object("barco_cabina", bm, [mat, mat_glass], sharp_deg=40)
    K.paint(cabin, lambda co, n, i: C_CABIN)
    return cabin


def build_rig(mat):
    """Mast, spreaders, boom, furled main under its cover, stays."""
    bm = bmesh.new()
    _, _, zc, h = cabin_profile(MAST_Y)
    base = zc + h
    K.cylinder(bm, 0.13, 0.07, MAST_TOP - base, segments=8, matrix=Matrix.Translation((0, MAST_Y, base)),
               cap1=False, cap2=True)
    spz = 7.6
    for side in (-1, 1):
        K.tube(bm, [(0.0, MAST_Y, spz), (side * 1.65, MAST_Y, spz + 0.12)], 0.035, segments=4)
    boom_z = base + 0.75
    K.cylinder(bm, 0.1, 0.08, 3.3, segments=8, cap1=False,
               matrix=Matrix.Translation((0, MAST_Y - 0.05, boom_z)) @ Matrix.Rotation(math.radians(-90), 4, "X"))
    # Furled mainsail in its cover, lying on the boom.
    sail = [(0.0, 0.0), (0.2, 0.25), (0.3, 1.0), (0.27, 2.2), (0.16, 2.9), (0.0, 3.2)]
    K.lathe(bm, sail, segments=8, close=False,
            matrix=Matrix.Translation((0, MAST_Y + 0.05, boom_z + 0.2)) @ Matrix.Rotation(math.radians(-90), 4, "X"))
    mast_top = (0.0, MAST_Y, MAST_TOP - 0.1)
    K.tube(bm, [(0.0, BOW_Y + 0.15, sheer(0.99) + 0.05), mast_top], 0.018, segments=3)          # forestay
    K.tube(bm, [(0.0, STERN_Y - 0.1, sheer(0.0) + 0.05), mast_top], 0.018, segments=3)         # backstay
    for side in (-1, 1):
        t = t_of_y(MAST_Y)
        plate = (side * (beam(t) - 0.1), MAST_Y, sheer(t) + 0.05)
        K.tube(bm, [plate, (side * 1.65, MAST_Y, spz + 0.12), mast_top], 0.018, segments=3)    # shroud
    K.finish(bm)
    rig = K.new_object("barco_jarcia", bm, [mat], sharp_deg=50)

    def colour(co, n, i):
        if boom_z + 0.05 < co.z < boom_z + 0.6 and co.y > MAST_Y and abs(co.x) < 0.35:
            return C_COVER
        if abs(co.x) < 0.14 and abs(co.y - MAST_Y) < 0.2 or (abs(co.z - spz) < 0.2 and abs(co.y - MAST_Y) < 0.1):
            return C_SPAR
        if abs(co.z - boom_z) < 0.11 and abs(co.x) < 0.11:
            return C_SPAR
        return C_STEEL
    K.paint(rig, colour)
    return rig


def build_rails(mat):
    """Stanchions, lifelines, pulpit and pushpit."""
    bm = bmesh.new()
    ts = [0.1, 0.28, 0.46, 0.64, 0.8]
    for side in (-1, 1):
        tops = []
        for t in ts:
            p = (side * (beam(t) - 0.09), y_of_t(t), sheer(t) + 0.02)
            top = (p[0], p[1], p[2] + 0.62)
            K.tube(bm, [p, top], 0.016, segments=4)
            tops.append(top)
        K.tube(bm, tops, 0.014, segments=3)
    # Pulpit (bow) and pushpit (stern): a rail on two legs.
    for yA, yB, tA in ((BOW_Y + 1.0, BOW_Y + 0.25, 0.9), (STERN_Y - 0.2, STERN_Y - 0.9, 0.02)):
        zA = sheer(tA) + 0.02
        bA = beam(tA) - 0.1
        rail = [(-bA, yA, zA + 0.62), (-bA * 0.55, yB, zA + 0.62), (bA * 0.55, yB, zA + 0.62), (bA, yA, zA + 0.62)]
        K.tube(bm, rail, 0.016, segments=3)
        for x in (-bA, bA):
            K.tube(bm, [(x, yA, zA), (x, yA, zA + 0.62)], 0.016, segments=3)
    K.finish(bm)
    rails = K.new_object("barco_candeleros", bm, [mat], sharp_deg=50)
    K.paint(rails, lambda co, n, i: C_STEEL)
    return rails


def build_lanterns(mat, mat_luz):
    """Two lanterns on the aft corners of the coachroof, plus the masthead light (light meshes)."""
    bm = bmesh.new()
    w, zside, zc, h = cabin_profile(1.1)
    spots = {"luz_farol_babor": (-(w - 0.25), 1.1, zc + h), "luz_farol_estribor": (w - 0.25, 1.1, zc + h)}
    for pos in spots.values():
        m = Matrix.Translation(pos)
        K.lathe(bm, [(0.05, 0.0), (0.09, 0.03), (0.09, 0.09), (0.065, 0.1)], segments=8, matrix=m, close=True)
        K.lathe(bm, [(0.1, 0.28), (0.11, 0.31), (0.0, 0.41)], segments=8, matrix=m, close=False)
    K.finish(bm)
    housing = K.new_object("barco_faroles", bm, [mat], sharp_deg=50)
    K.paint(housing, lambda co, n, i: C_BLACK)
    lights = []
    for name, pos in spots.items():
        bl = bmesh.new()
        K.cylinder(bl, 0.065, 0.065, 0.18, segments=8, matrix=Matrix.Translation((pos[0], pos[1], pos[2] + 0.1)))
        lights.append((name, K.new_object(name, bl, [mat_luz], sharp_deg=50), K.LIGHTS["farol"]))
    bl = bmesh.new()
    K.cylinder(bl, 0.06, 0.05, 0.14, segments=6, matrix=Matrix.Translation((0, MAST_Y, MAST_TOP)))
    lights.append(("luz_tope", K.new_object("luz_tope", bl, [mat_luz], sharp_deg=50), K.LIGHTS["farol"]))
    return housing, lights


def build():
    mat = K.pbr_material("barco", "#9a9284", roughness=0.55)
    mat_glass = K.pbr_material("cristal", "#0b1119", roughness=0.08, vertex_color=False)
    mat_luz = K.pbr_material("luz_farol", K.LIGHTS["farol"], roughness=0.3, vertex_color=False,
                             emissive_hex=K.LIGHTS["farol"])
    parts = [build_hull(mat), build_deck(mat), build_cabin(mat, mat_glass), build_rig(mat), build_rails(mat)]
    housing, lights = build_lanterns(mat, mat_luz)
    parts.append(housing)
    turn = Matrix.Rotation(math.pi, 4, "Z")      # built bow at -Y; the hero convention is bow at +Y (seaward)
    for ob in parts + [ob for _, ob, _ in lights]:
        ob.matrix_world = turn @ ob.matrix_world
    return {"main": parts, "lights": lights, "anchor": "centre of the waterline length, bow at +Y (seaward)"}

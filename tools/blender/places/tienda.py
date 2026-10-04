"""T111: original clay Ibiza place (`tienda`): a white village above a sheltered cove.

Independent normalized asset for a later runtime hookup (T112). No map, route,
collision, merchandise, content or persistence change. Source: Z up, front
(the boat's approach) -Y, water Z=0, island centre at the origin, radius 1.

Composition (see art/places/3d/tienda/reference_notes.md):
- a horseshoe island whose sheltered cove opens to the front, with a sand beach
  at its back, ochre cliffs on its sides and a narrow mouth flanked by two
  orange BOIA buoys and a round stone defence tower;
- whitewashed cubic houses stepping up the hill behind the beach, flat roof
  terraces or terracotta hip roofs, blue/green doors and shutters, chimneys,
  and a fortified white church with bell gable, dome and stone bastion on top;
- the shop (store role kept): a white kiosk on the beach with the BOIA orange
  and white striped awning, counter, T-shirt clothesline and a TIENDA sign;
- boathouses with slipways under the right cliff, two llauts, a jetty, pines.

Colours are the game palette (`apps/web/app/mar/engine/palette.ts`) converted
from sRGB to linear so the exported base colours match the live world.
"""
import argparse
import json
import math
import sys
from pathlib import Path
import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common


def srgb(hex_color):
    """Game palette sRGB hex -> linear Blender/glTF base colour."""
    def channel(v):
        v = int(v, 16) / 255
        return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4
    return tuple(round(channel(hex_color[i:i + 2]), 4) for i in (1, 3, 5))


PALETTE = {
    'whitewash': srgb('#fbf7ef'),   # C.white: lime-washed walls
    'roofslab': srgb('#e0d2b8'),    # flat roof terraces, inside a white parapet
    'sand': srgb('#ebcf9e'),        # C.sand: cove beach
    'earth': srgb('#d69b5f'),       # C.cliff: ochre Ibiza cliffs and banks
    'rock': srgb('#6f6784'),        # C.rock: BOIA lilac shore rocks
    'scrub': srgb('#8fae4a'),       # dry garrigue on the hill
    'pine': srgb('#3f7f2e'),        # C.leafDark: Aleppo pine crowns
    'stone': srgb('#c9b58f'),       # dry-stone walls, towers, bastion
    'terracotta': srgb('#c8643a'),  # C.terracotta: tile roofs and dome
    'blue': srgb('#2f6fb0'),        # C.blueDoor
    'green': srgb('#2f9e5b'),       # C.green: shutters
    'wood': srgb('#b8763f'),        # C.wood
    'darkwood': srgb('#7c4b2b'),    # C.woodDark: boathouse doors, trunks
    'navy': srgb('#12233f'),        # C.navy: openings, window panes
    'orange': srgb('#ec4f24'),      # C.orange: BOIA brand
    'gold': srgb('#f2c230'),        # C.gold: church bell
    'lantern': (1, .67, .24),       # warm lamps (emission in common.start)
}
REFERENCES = [
    'https://www.illesbalears.travel/en/ibiza/cove-salada',
    'https://media.illesbalears.travel/rrtt-ibiza-cala-salada-img0.jpg',
    'https://media.illesbalears.travel/rrtt-ibiza-cala-salada-img1.jpg',
    'https://media.illesbalears.travel/rrtt-ibiza-cala-salada-img2.jpg',
    'https://illesbalears.travel/en/ibiza/church-santa-eularia-puig-de-missa',
    'https://media.illesbalears.travel/rrtt-ibiza-iglesia-santa-eularia-puig-de-missa-img1.jpg',
    'https://media.illesbalears.travel/rrtt-ibiza-iglesia-santa-eularia-puig-de-missa-img2.jpg',
    'https://www.illesbalears.travel/en/ibiza/discovering-the-white-island',
    'https://media.illesbalears.travel/plan-ibiza-descubriendo-la-isla-blanca-img1.jpg',
    'art/mundos/arcilla/tienda/tienda.png',
]
APPROACH = {'side': '+Z in glTF', 'outside_radius': 1, 'clear_sector_degrees': [-10, 10],
            'channel': {'from_radius': .62, 'max_height': 0},
            'note': 'The cove mouth faces the exterior front approach; nothing rises above '
                    'the water in the mouth channel. The basin is decorative and does not '
                    'change the existing collision or proximity.'}

# --- Terrain: horseshoe island around a cove that opens to the front (-Y). ---
COVE = Vector((0, -.34))      # cove centre
COVE_R = .33                  # cove radius: back of the beach water at y=-0.01
MOUTH_Y = -.60                # where the narrow mouth channel starts
MOUTH_HALF = .14              # mouth half width at MOUTH_Y, widening outwards
BEACH = .14                   # width of the flat sand behind the waterline
SEA_FLOOR = -.06
KEEP_ABOVE = -.03             # faces entirely below this are never visible
ANGLES = 64                   # terrain segments around the cove centre
MIN_BEVELLED = .014           # boxes thinner than this keep crisp edges (budget)
# Each terrain column is a ray from the cove centre. Its first rings sit at fixed
# offsets from where the ray leaves the cove water (underwater, cliff, beach/top),
# its last rings on the irregular coast contours (ochre cliff, lilac rocks at the
# waterline). Every material band therefore runs along mesh edges.
EDGE_RINGS = [-.06, -.03, -.015, 0, .015, .035, .06, .10, BEACH]
EDGE_ROLES = ['under', 'under', 'under', 'cliff', 'cliff', 'cliff', 'top', 'top']
FILL_RINGS = 7
CONTOURS = [.85, .875, .90, .92, .945, .965, .985]
CONTOUR_ROLES = ['earth', 'earth', 'rock', 'rock', 'rock', 'rock']   # lilac strip at the waterline
MIN_STEP = .003               # narrow headland tips: rings stack, never cross


def smoothstep(a, b, x):
    t = max(0., min(1., (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def lerp(a, b, t): return a + (b - a) * t


def smin(a, b, k):
    h = max(k - abs(a - b), 0) / k
    return min(a, b) - h * h * k * .25


def cove_distance(x, y):
    """Signed distance to the water of the cove (negative inside)."""
    circle = math.hypot(x - COVE.x, y - COVE.y) - COVE_R
    half = MOUTH_HALF + max(0., MOUTH_Y - y) * .2
    mouth = max(abs(x) - half, y - MOUTH_Y)
    return smin(circle, mouth, .08)


def coast(x, y):
    """Irregular outer shore factor (<=1 keeps every vertex inside the rim)."""
    a = math.atan2(y, x)
    return .962 + .038 * (.6 * math.sin(3 * a + 1.1) + .4 * math.sin(5 * a + 2.3))


def land(x, y):
    r = math.hypot(x, y) / coast(x, y)
    keep = 1 - smoothstep(.85, .985, r)       # waterline near r = .92 * coast
    hill = .24 * math.exp(-(x / .6) ** 2 - ((y - .42) / .36) ** 2)
    arms = sum(.065 * math.exp(-((x - s * .46) / .2) ** 2 - ((y + .5) / .28) ** 2) for s in (-1, 1))
    return lerp(.085, -.07, 1 - keep) + (hill + arms) * keep


def beach_weight(x, y):
    rho = math.hypot(x - COVE.x, y - COVE.y) or 1
    return smoothstep(.30, .65, (y - COVE.y) / rho)


def height(x, y):
    ground = land(x, y)
    t = cove_distance(x, y)
    cliff = SEA_FLOOR + (ground - SEA_FLOOR) * smoothstep(-.015, .05, t)
    beach = min(ground, -.05 + min(1., max(0., (t + .05) / .07)) * .075 + max(0., t - BEACH) * 1.1)
    return lerp(cliff, beach, beach_weight(x, y))


def facing(x, y, target=COVE + Vector((0, -.12))):
    """Object Z rotation whose local -Y (facade) looks at the cove."""
    d = Vector(target) - Vector((x, y))
    return math.atan2(d.y, d.x) + math.pi / 2


def contour_distance(direction, rho):
    """Distance along a ray from the cove centre to the coast contour |p| = rho*coast(p)."""
    low, high = 0., 2.
    for _ in range(48):
        mid = (low + high) / 2
        p = COVE + direction * mid
        if p.length < rho * coast(p.x, p.y):
            low = mid
        else:
            high = mid
    return low


def cove_edge(direction, limit):
    """Distance along a ray from the cove centre to where the cove water ends."""
    step = .005
    s = .2                                         # always inside the cove circle
    while s < limit:
        p = COVE + direction * s
        if cove_distance(p.x, p.y) >= 0:
            low, high = s - step, s
            for _ in range(30):
                mid = (low + high) / 2
                q = COVE + direction * mid
                low, high = (low, mid) if cove_distance(q.x, q.y) >= 0 else (mid, high)
            return high
        s += step
    return limit                                   # the mouth: water to the rim


def terrain_columns():
    """Per ray from the cove centre: ring points (cove edge offsets, fill, coast contours)."""
    columns = []
    for k in range(ANGLES):
        a = -math.pi / 2 + k * math.tau / ANGLES     # one column on the mouth axis
        direction = Vector((math.cos(a), math.sin(a)))
        contours = [contour_distance(direction, rho) for rho in CONTOURS]
        rim = contours[-1]
        edge = cove_edge(direction, rim)
        rings = [edge + offset for offset in EDGE_RINGS]
        rings += [lerp(rings[-1], contours[0], (j + 1) / (FILL_RINGS + 1)) for j in range(FILL_RINGS)]
        rings += contours
        for i in range(1, len(rings)):
            rings[i] = max(rings[i], rings[i - 1] + MIN_STEP)
        rings[-1] = rim
        for i in range(len(rings) - 2, -1, -1):
            rings[i] = min(rings[i], rings[i + 1] - MIN_STEP)
        columns.append([COVE + direction * d for d in rings])
    return columns


def band_role(band, x, y):
    """Material of the terrain band between ring `band` and `band + 1`.

    Decided per ring band (and beach sector), never per face slope, so every
    material boundary runs along mesh edges instead of zigzagging across them.
    """
    if band < len(EDGE_ROLES):
        if beach_weight(x, y) > .45:
            return 'sand'
        return 'scrub' if EDGE_ROLES[band] == 'top' else 'earth'
    outer = band - (len(EDGE_RINGS) + FILL_RINGS)
    return CONTOUR_ROLES[outer] if outer >= 0 else 'scrub'


# --- Village layout (normalized source coordinates). ---
def around(angle, distance):
    """Point at `distance` from the cove centre, `angle` degrees from +Y toward +X."""
    a = math.radians(angle)
    return (COVE.x + distance * math.sin(a), COVE.y + distance * math.cos(a))


# tag, (angle, distance), width, depth, height, roof, accent, windows, chimney, annex
HOUSES = [
    ('house_beach_left', (-49, .585), .135, .11, .095, 'flat', 'blue', 2, True, -1),
    ('house_beach_mid', (-27, .575), .125, .105, .10, 'tile', 'green', 2, False, 0),
    ('house_beach_right', (41, .585), .13, .105, .10, 'flat', 'green', 2, True, 1),
    ('house_point_right', (62, .60), .12, .10, .09, 'tile', 'blue', 1, False, 0),
    ('house_mid_left', (-37, .725), .14, .11, .105, 'tile', 'green', 2, True, 0),
    ('house_mid_centre_left', (-15, .715), .13, .11, .11, 'flat', 'blue', 2, False, -1),
    ('house_mid_centre_right', (13, .72), .14, .11, .105, 'flat', 'green', 2, True, 0),
    ('house_mid_right', (34, .725), .13, .105, .10, 'tile', 'blue', 2, False, -1),
    ('house_top_left', (-30, .885), .13, .11, .10, 'flat', 'green', 1, True, 0),
    ('house_top_right', (18, .86), .135, .11, .105, 'tile', 'blue', 2, True, 0),
]
CHURCH = around(-5, .875)
SHOP = around(12, .45)
# Casas payesas on the back of the hill, porch (porxo) toward the back shore.
BACK_FARMS = [((-.33, .56), -2.5), ((.40, .52), 2.5)]
PINES = [(-.66, -.30, 1.1), (-.56, -.52, .9), (-.70, -.06, 1.0), (-.50, -.20, .8),
         (.64, -.28, 1.05), (.52, -.50, .85), (.72, -.06, .95),
         (-.62, .30, 1.0), (.64, .30, 1.0), (-.16, .74, .95), (.12, .76, .9),
         (-.56, .50, .85), (.60, .42, .85), (-.72, .14, .8), (.74, .12, .85)]
STAIRS = [(-.035, .125), (-.06, .37)]   # whitewashed stepped lane from the beach to the church
CYPRESSES = [(-.22, .54), (.10, .62)]
BOATHOUSES = [-14, 4, 22]      # angles (degrees from +X) under the right cliff of the cove
JETTY_X = -.075
BUOYS = [(-.209, -.906), (.209, -.906)]   # mouth edges, just outside the clear sector
TOWER = (-.39, -.70)
SHORE_ROCKS = [(-114, .035), (-66, .03), (-152, .03), (-24, .028), (166, .03), (19, .03), (47, .028), (128, .03)]


def build(gray=False):
    root, mats = common.start('tienda', PALETTE)
    if gray:
        gm = bpy.data.materials.new('graybox_review')
        gm.diffuse_color = (.5, .5, .5, 1)

    def finish(o, name, role):
        o.name = name
        o.parent = root
        o.data.materials.append(gm if gray else mats[role])
        return o

    def soften(o, width, segments=1):
        if width:
            m = o.modifiers.new('soft_clay_edges', 'BEVEL')
            m.width = width
            m.segments = segments
            m.limit_method = 'ANGLE'
            o.modifiers.new('weighted_corner_normals', 'WEIGHTED_NORMAL')
        return o

    def box(name, p, size, role, bevel=.006, rz=0.):
        bpy.ops.mesh.primitive_cube_add(size=1, location=p, rotation=(0, 0, rz))
        o = bpy.context.object
        o.scale = size
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        finish(o, name, role)
        # Thin trims, shutters and stripes stay crisp: a bevel there is invisible at game distance.
        return soften(o, bevel if min(size) >= MIN_BEVELLED else 0)

    def blob(name, p, size, role, seg=10, rings=5, rot=(0, 0, 0)):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=1, location=p, rotation=rot)
        o = bpy.context.object
        o.scale = size
        finish(o, name, role)
        for poly in o.data.polygons:
            poly.use_smooth = True
        return o

    def tube(name, a, b, r, role, n=8, r2=None, smooth=True, caps=True):
        a, b = Vector(a), Vector(b)
        v = b - a
        bpy.ops.mesh.primitive_cone_add(vertices=n, radius1=r, radius2=r if r2 is None else r2,
                                        depth=v.length, location=(a + b) * .5,
                                        end_fill_type='NGON' if caps else 'NOTHING')
        o = bpy.context.object
        o.rotation_euler = v.to_track_quat('Z', 'Y').to_euler()
        finish(o, name, role)
        if smooth:
            for poly in o.data.polygons:
                poly.use_smooth = abs(poly.normal.z) < .5
        return o

    def mesh_object(name, verts, faces, role, smooth=False):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata([tuple(v) for v in verts], [], faces)
        mesh.validate()
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(mesh)
        bm.free()
        o = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(o)
        finish(o, name, role)
        for poly in mesh.polygons:
            poly.use_smooth = smooth
        return o

    def frame(x, y, rz):
        c, s = math.cos(rz), math.sin(rz)
        return lambda lx, ly: (x + c * lx - s * ly, y + s * lx + c * ly)

    def ground_under(P, w, d):
        pts = [P(sx * w / 2, sy * d / 2) for sx in (-1, 0, 1) for sy in (-1, 0, 1)]
        heights = [height(*q) for q in pts]
        return min(heights), max(heights)

    # ---------------------------------------------------------------- terrain
    def terrain():
        rings = terrain_columns()
        count = len(rings[0])
        verts = []
        for k in range(ANGLES):
            for i, p in enumerate(rings[k]):
                z = SEA_FLOOR - .01 if i == count - 1 else height(p.x, p.y)
                verts.append((p.x, p.y, z))
        index = lambda k, i: (k % ANGLES) * count + i
        faces, roles = [], []
        for k in range(ANGLES):
            for i in range(count - 1):
                quad = (index(k, i), index(k, i + 1), index(k + 1, i + 1), index(k + 1, i))
                zs = [verts[q][2] for q in quad]
                if max(zs) <= KEEP_ABOVE:
                    continue
                faces.append(quad)
                cx = sum(verts[q][0] for q in quad) / 4
                cy = sum(verts[q][1] for q in quad) / 4
                roles.append(band_role(i, cx, cy))
        used = sorted({q for f in faces for q in f})
        remap = {old: new for new, old in enumerate(used)}
        mesh = bpy.data.meshes.new('Ibiza_cove_terrain')
        mesh.from_pydata([verts[i] for i in used], [], [tuple(remap[q] for q in f) for f in faces])
        mesh.validate()
        o = bpy.data.objects.new('Ibiza_cove_terrain', mesh)
        bpy.context.collection.objects.link(o)
        o.parent = root
        order = ['scrub', 'earth', 'sand', 'rock']
        for role in order:
            mesh.materials.append(gm if gray else mats[role])
        for poly, role in zip(mesh.polygons, roles):
            poly.material_index = order.index(role)
            poly.use_smooth = True
        return o

    terrain()

    # ----------------------------------------------------------------- houses
    def window(tag, P, lx, z, depth, accent, rz, open_pane=True, back=False):
        y = depth / 2 + .002 if back else -depth / 2 - .002
        if open_pane and not back:
            box(tag + '_frame', (*P(lx, y + .001), z), (.033, .006, .034), accent, 0, rz)
            box(tag + '_pane', (*P(lx, y - .002), z), (.021, .006, .024), 'navy', 0, rz)
        else:
            box(tag + '_shutters', (*P(lx, y), z), (.026, .008, .03), accent, .002, rz)

    def hip_roof(name, P, w, d, z, rz, rise=.045, over=.014):
        hw, hd = w / 2 + over, d / 2 + over
        base = [(-hw, -hd), (hw, -hd), (hw, hd), (-hw, hd)]
        verts = [(*P(*q), z) for q in base]
        if hw >= hd:
            ridge = [(-(hw - hd), 0), (hw - hd, 0)]
            faces = [(0, 1, 5, 4), (1, 2, 5), (2, 3, 4, 5), (3, 0, 4), (3, 2, 1, 0)]
        else:
            ridge = [(0, -(hd - hw)), (0, hd - hw)]
            faces = [(0, 1, 4), (1, 2, 5, 4), (2, 3, 5), (3, 0, 4, 5), (3, 2, 1, 0)]
        verts += [(*P(*q), z + rise) for q in ridge]
        return mesh_object(name, verts, faces, 'terracotta')

    def roof_cap(tag, P, w, d, top, rz, kind):
        if kind == 'flat':
            box(tag + '_roof_terrace', (*P(0, 0), top + .0015), (w - .024, d - .024, .01), 'roofslab', 0, rz)
        else:
            hip_roof(tag + '_tile_roof', P, w, d, top - .004, rz)

    def chimney(tag, P, lx, ly, top, rz):
        box(tag + '_chimney', (*P(lx, ly), top + .022), (.022, .022, .05), 'whitewash', .003, rz)
        box(tag + '_chimney_cap', (*P(lx, ly), top + .05), (.032, .032, .007), 'whitewash', .002, rz)

    def house(tag, x, y, w, d, h, roof, accent, windows, has_chimney, annex, rz=None):
        rz = facing(x, y) if rz is None else rz
        P = frame(x, y, rz)
        low, high = ground_under(P, w, d)
        bottom, top = low - .03, high + h
        if gray:
            box(tag + '_mass', (*P(0, 0), (bottom + top) / 2), (w, d, top - bottom), 'whitewash', 0, rz)
            return
        box(tag + '_whitewashed_walls', (*P(0, 0), (bottom + top) / 2), (w, d, top - bottom), 'whitewash', .007, rz)
        floor = max(height(*P(-w * .2, -d / 2)), height(*P(w * .2, -d / 2)), bottom + .03)
        box(tag + '_door', (*P(-w * .2, -d / 2 - .002), floor + .03), (.032, .012, .06), accent, .003, rz)
        box(tag + '_lintel', (*P(-w * .2, -d / 2 - .004), floor + .066), (.042, .008, .008), 'whitewash', .002, rz)
        window(tag + '_window_low', P, w * .22, floor + .036, d, accent, rz, open_pane=False)
        upper = min(floor + .1, top - .028)        # frames stay clear of roofs and parapets
        if upper > floor + .075 and windows > 1:
            window(tag + '_window_up_l', P, -w * .2, upper, d, accent, rz)
            window(tag + '_window_up_r', P, w * .22, upper, d, accent, rz)
        elif upper > floor + .075:
            window(tag + '_window_up', P, w * .05, upper, d, accent, rz)
        roof_cap(tag, P, w, d, top, rz, roof)
        # A shuttered window on the back wall too, where it clears the uphill ground.
        if top - .045 - height(*P(-w * .15, d / 2 + .01)) > .03:
            window(tag + '_window_back', P, -w * .15, top - .045, d, accent, rz, open_pane=False, back=True)
        if has_chimney:
            chimney(tag, P, w * .3 * (1 if annex <= 0 else -1), d * .2, top, rz)
        if annex:
            aw, ad = w * .55, d * .8
            ax = annex * (w / 2 + aw / 2 - .01)
            A = lambda lx, ly: P(ax + lx, d * .1 + ly)
            alow, ahigh = ground_under(A, aw, ad)
            atop = min(top - .03, ahigh + h * .6)
            box(tag + '_annex_walls', (*A(0, 0), (alow - .03 + atop) / 2), (aw, ad, atop - alow + .03), 'whitewash', .006, rz)
            box(tag + '_annex_roof', (*A(0, 0), atop + .0015), (aw - .02, ad - .02, .01), 'roofslab', 0, rz)
            wz = max(height(*A(0, -ad / 2)), alow) + .035
            if wz + .015 < atop - .006:
                window(tag + '_annex_window', A, 0, wz, ad, accent, rz, open_pane=False)

    for tag, (angle, distance), w, d, h, roof, accent, windows, has_chimney, annex in HOUSES:
        house(tag, *around(angle, distance), w, d, h, roof, accent, windows, has_chimney, annex)

    # Casas payesas on the back slope, with a sabina-beam porxo, seen from behind.
    for i, ((x, y), rz) in enumerate(BACK_FARMS):
        tag = 'casa_payesa_%d' % i
        P = frame(x, y, rz)
        w, d, h = .15, .11, .085
        low, high = ground_under(P, w, d)
        top = high + h
        if gray:
            box(tag + '_mass', (*P(0, 0), (low - .03 + top) / 2), (w, d, top - low + .03), 'whitewash', 0, rz)
            continue
        box(tag + '_whitewashed_walls', (*P(0, 0), (low - .03 + top) / 2), (w, d, top - low + .03), 'whitewash', .007, rz)
        box(tag + '_roof_terrace', (*P(0, 0), top + .0015), (w - .024, d - .024, .01), 'roofslab', 0, rz)
        floor = height(*P(0, -d / 2 - .04))
        for sx in (-1, 1):
            box(tag + '_porxo_pillar_%d' % sx, (*P(sx * .055, -d / 2 - .045), (floor - .02 + top - .02) / 2),
                (.016, .016, top - floor), 'whitewash', .003, rz)
        box(tag + '_porxo_beam', (*P(0, -d / 2 - .045), top - .022), (.13, .018, .012), 'darkwood', .002, rz)
        for k in range(3):
            box(tag + '_porxo_rafter_%d' % k, (*P((k - 1) * .045, -d / 2 - .022), top - .012),
                (.008, .06, .007), 'darkwood', 0, rz)
        box(tag + '_door', (*P(0, -d / 2 - .002), floor + .03), (.03, .012, .06), 'green', .003, rz)
        window(tag + '_window', P, .045, floor + .04, d, 'green', rz, open_pane=False)
        chimney(tag, P, -.045, .02, top, rz)

    # ----------------------------------------------------------------- church
    def church():
        x, y = CHURCH
        rz = facing(x, y)
        P = frame(x, y, rz)
        w, d, h = .17, .21, .13
        low, high = ground_under(P, w, d)
        top = high + h
        if gray:
            box('church_mass', (*P(0, 0), (low + top) / 2), (w, d, top - low + .03), 'whitewash', 0, rz)
            return
        box('church_nave', (*P(0, 0), (low - .03 + top) / 2), (w, d, top - low + .03), 'whitewash', .008, rz)
        box('church_roof_terrace', (*P(0, .02), top + .0015), (w - .024, d - .06, .01), 'roofslab', 0, rz)
        # Bell gable (espadanya) over the facade, with an open arch, bell and cross.
        fy = -d / 2 + .02
        box('church_bell_gable', (*P(-.02, fy), top + .045), (.085, .03, .1), 'whitewash', .006, rz)
        box('church_bell_opening', (*P(-.02, fy - .012), top + .05), (.034, .012, .04), 'navy', .002, rz)
        tube('church_bell_opening_arch', P(-.02, fy - .018) + (top + .07,), P(-.02, fy - .006) + (top + .07,),
             .017, 'navy', 10)
        tube('church_bell', P(-.02, fy - .019) + (top + .036,), P(-.02, fy - .019) + (top + .062,), .013,
             'gold', 10, r2=.004)
        box('church_cross_post', (*P(-.02, fy), top + .113), (.005, .005, .04), 'navy', 0, rz)
        box('church_cross_bar', (*P(-.02, fy), top + .118), (.022, .005, .005), 'navy', 0, rz)
        # Arched porch (porxo) in front of the main door.
        floor = height(*P(0, -d / 2 - .03))
        box('church_porch', (*P(.01, -d / 2 - .03), (floor - .02 + floor + .085) / 2), (.15, .06, .105), 'whitewash', .006, rz)
        box('church_porch_roof', (*P(.01, -d / 2 - .03), floor + .087), (.13, .045, .006), 'roofslab', 0, rz)
        for k in range(3):
            lx = .01 + (k - 1) * .045
            box('church_porch_arch_%d' % k, (*P(lx, -d / 2 - .061), floor + .027), (.028, .006, .05), 'navy', .002, rz)
            tube('church_porch_arch_top_%d' % k, P(lx, -d / 2 - .064) + (floor + .052,),
                 P(lx, -d / 2 - .058) + (floor + .052,), .014, 'navy', 10)
        # Dome on a drum with a small lantern, at the back of the nave.
        dome = P(.01, d / 2 - .065)
        tube('church_dome_drum', dome + (top - .01,), dome + (top + .03,), .052, 'whitewash', 16, caps=False)
        blob('church_dome', dome + (top + .03,), (.055, .055, .045), 'terracotta', 16, 8)
        tube('church_lantern', dome + (top + .07,), dome + (top + .092,), .014, 'whitewash', 8, caps=False)
        blob('church_lantern_cap', dome + (top + .092,), (.016, .016, .012), 'whitewash', 8, 4)
        # Fortified round bastion and a sentry turret (Puig de Missa analogue).
        bastion = P(w / 2 + .035, .02)
        bl, bh = ground_under(frame(*bastion, rz), .12, .12)
        tube('church_stone_bastion', bastion + (bl - .03,), bastion + (top - .035,), .068, 'stone', 24, r2=.064)
        tube('church_bastion_rim', bastion + (top - .036,), bastion + (top - .028,), .066, 'whitewash', 24)
        turret = P(-w / 2 + .012, d / 2 - .012)
        tube('church_turret', turret + (top - .02,), turret + (top + .045,), .016, 'whitewash', 12)
        blob('church_turret_cap', turret + (top + .045,), (.017, .017, .018), 'whitewash', 12, 5)
        for k, lx in enumerate([-.05, .045]):
            window('church_window_%d' % k, P, lx, top - .035, d, 'navy', rz, open_pane=False)

    church()

    # ------------------------------------------------------------------- shop
    def shop():
        x, y = SHOP
        rz = 0.
        P = frame(x, y, rz)
        w, d, h = .2, .12, .11
        low, high = ground_under(P, w, d)
        floor = height(*P(0, -d / 2))
        top = floor + h
        if gray:
            box('shop_mass', (*P(0, 0), (low - .03 + top) / 2), (w, d, top - low + .03), 'whitewash', 0, rz)
            box('shop_awning_mass', (*P(0, -d / 2 - .04), floor + .075), (w, .08, .015), 'orange', 0, rz)
            return
        box('shop_whitewashed_kiosk', (*P(0, 0), (low - .03 + top) / 2), (w, d, top - low + .03), 'whitewash', .008, rz)
        box('shop_roof_terrace', (*P(0, 0), top + .0015), (w - .024, d - .024, .01), 'roofslab', 0, rz)
        box('shop_open_front', (*P(0, -d / 2 - .002), floor + .045), (.15, .01, .05), 'navy', .003, rz)
        box('shop_counter', (*P(0, -d / 2 - .02), floor + .02), (.165, .035, .042), 'wood', .004, rz)
        for k, (lx, role) in enumerate([(-.055, 'orange'), (-.018, 'blue'), (.02, 'whitewash'), (.056, 'orange')]):
            box('shop_folded_tees_%d' % k, (*P(lx, -d / 2 - .022), floor + .047), (.026, .02, .012), role, .002, rz)
        # BOIA orange/white striped awning, sloping out over the counter.
        stripes = 8
        for k in range(stripes):
            lx = -w / 2 + (k + .5) * w / stripes
            o = box('shop_awning_stripe_%d' % k, (*P(lx, -d / 2 - .045), floor + .088), (w / stripes + .0005, .095, .006),
                    'orange' if k % 2 == 0 else 'whitewash', .0015, rz)
            o.rotation_euler = (-.38, 0, rz)
            box('shop_awning_valance_%d' % k, (*P(lx, -d / 2 - .089), floor + .062), (w / stripes + .0005, .006, .02),
                'whitewash' if k % 2 == 0 else 'orange', .0015, rz)
        for sx in (-1, 1):
            tube('shop_awning_post_%d' % sx, P(sx * (w / 2 - .006), -d / 2 - .088) + (height(*P(sx * .1, -.15)) - .02,),
                 P(sx * (w / 2 - .006), -d / 2 - .088) + (floor + .07,), .0035, 'darkwood', 6)
        for k, lx in enumerate([-.07, .07]):
            blob('shop_lantern_%d' % k, P(lx, -d / 2 - .03) + (floor + .066,), (.009, .009, .011), 'lantern', 8, 4)
        # Flag on the roof: BOIA orange, readable from the sea.
        tube('shop_flag_pole', P(w / 2 - .03, d / 2 - .03) + (top,), P(w / 2 - .03, d / 2 - .03) + (top + .1,), .003, 'navy', 6)
        box('shop_flag', (*P(w / 2 - .005, d / 2 - .03), top + .085), (.045, .004, .028), 'orange', .002, rz)
        # Clothesline (tendedero) with T-shirts on the sand, left of the kiosk.
        a, b = P(-.3, -.05), P(-.215, -.07)
        za, zb = height(*a), height(*b)
        tube('tee_line_post_left', a + (za - .02,), a + (za + .085,), .0035, 'darkwood', 6)
        tube('tee_line_post_right', b + (zb - .02,), b + (zb + .085,), .0035, 'darkwood', 6)
        tube('tee_line_rope', a + (za + .08,), b + (zb + .08,), .0012, 'navy', 4, smooth=False)
        line_rz = math.atan2(b[1] - a[1], b[0] - a[0])
        for k, role in enumerate(['orange', 'blue', 'whitewash', 'orange']):
            f = (k + .6) / 4.2
            p = (lerp(a[0], b[0], f), lerp(a[1], b[1], f))
            z = lerp(za, zb, f) + .08 - .006 * math.sin(math.pi * f)
            box('tee_%d_body' % k, (*p, z - .018), (.019, .004, .028), role, .0015, line_rz)
            box('tee_%d_sleeves' % k, (*p, z - .007), (.033, .004, .009), role, .0015, line_rz)
        # TIENDA sign on two posts, right of the kiosk, facing the approach.
        s = P(.16, -.08)
        zs = height(*s)
        for sx in (-1, 1):
            q = (s[0] + sx * .06, s[1])
            tube('shop_sign_post_%d' % sx, q + (zs - .02,), q + (zs + .07,), .004, 'darkwood', 6)
        box('shop_sign_board', (s[0], s[1] - .004, zs + .058), (.15, .008, .042), 'whitewash', .003)
        bpy.ops.object.text_add(location=(s[0], s[1] - .0085, zs + .049), rotation=(math.pi / 2, 0, 0))
        text = bpy.context.object
        text.data.body = 'TIENDA'
        text.data.align_x = 'CENTER'
        text.data.size = .03
        text.data.extrude = 0
        text.data.resolution_u = 2
        bpy.ops.object.convert(target='MESH')
        finish(bpy.context.object, 'shop_sign_TIENDA', 'orange')
        # A palm behind the kiosk (as in the 2D store art).
        palm('shop_palm', P(.135, .085), 1.0)

    # ------------------------------------------------------------ vegetation
    def palm(tag, at, scale):
        x, y = at
        z = height(x, y)
        top = z + .23 * scale
        tube(tag + '_bowed_base', (x, y, z - .02), (x + .012, y + .004, z + .12 * scale), .009, 'darkwood', 8)
        tube(tag + '_stem', (x + .012, y + .004, z + .12 * scale), (x + .03, y + .01, top), .007, 'darkwood', 8)
        for j in range(6):
            angle = j * math.tau / 6 + .3
            vertices = []
            for s in range(5):
                u = s / 4
                dd = .11 * u * scale
                wd = .022 * math.sin(math.pi * u) + .002
                zz = top + .025 * math.sin(math.pi * u) - .05 * u * u
                for side in (-1, 1):
                    vertices.append((x + .03 + math.cos(angle) * dd + math.sin(angle) * wd * side,
                                     y + .01 + math.sin(angle) * dd - math.cos(angle) * wd * side, zz))
            o = mesh_object('%s_frond_%d' % (tag, j), vertices, [(k * 2, k * 2 + 1, k * 2 + 3, k * 2 + 2) for k in range(4)],
                            'pine', smooth=True)
            m = o.modifiers.new('leaf_thickness', 'SOLIDIFY')
            m.thickness = .003

    shop()

    def pine(tag, x, y, scale):
        z = height(x, y)
        lean = (.012 * math.sin(x * 9), .012 * math.cos(y * 7))
        top = (x + lean[0] * scale, y + lean[1] * scale, z + .12 * scale)
        tube(tag + '_trunk', (x, y, z - .02), top, .008 * scale, 'darkwood', 5, r2=.005 * scale, caps=False)
        if gray:
            blob(tag + '_crown', top, (.055 * scale, .05 * scale, .03 * scale), 'pine', 8, 5)
            return
        blob(tag + '_crown', (top[0], top[1], top[2] + .012 * scale), (.058 * scale, .052 * scale, .032 * scale), 'pine', 9, 5)
        if scale >= .95:
            side = (top[0] - .035 * scale, top[1] + .01 * scale, top[2] - .022 * scale)
            blob(tag + '_lower_crown', side, (.036 * scale, .034 * scale, .022 * scale), 'pine', 8, 4)

    for i, (x, y, s) in enumerate(PINES):
        pine('aleppo_pine_%d' % i, x, y, s)
    for i, (x, y) in enumerate(CYPRESSES):
        z = height(x, y)
        blob('cypress_%d' % i, (x, y, z + .06), (.017, .017, .07), 'pine', 8, 5)

    if gray:
        return root

    # -------------------------------------------- dry-stone wall behind the beach
    def arc_wall(name, a0, a1, distance, steps):
        verts, faces = [], []
        for s in range(steps + 1):
            a = lerp(a0, a1, s / steps)
            inner, outer = around(a, distance - .008), around(a, distance + .008)
            g = height(*around(a, distance))
            low = min(height(*inner), height(*outer)) - .025
            for p in (inner, outer):
                verts += [(p[0], p[1], low), (p[0], p[1], g + .022)]
        for s in range(steps):
            i, j = 4 * s, 4 * (s + 1)
            faces += [(i, i + 1, j + 1, j), (i + 2, j + 2, j + 3, i + 3), (i + 1, i + 3, j + 3, j + 1)]
        faces += [(0, 2, 3, 1), (4 * steps, 4 * steps + 1, 4 * steps + 3, 4 * steps + 2)]
        o = mesh_object(name, verts, faces, 'stone')
        return soften(o, .003)

    arc_wall('dry_stone_wall_left', -72, -12, .487, 10)
    arc_wall('dry_stone_wall_right', 30, 70, .487, 7)

    # Whitewashed stepped lane (Dalt Vila style) from the beach up to the church porch.
    (x0, y0), (x1, y1) = STAIRS
    steps = 8
    run = math.hypot(x1 - x0, y1 - y0)
    lane = math.atan2(y1 - y0, x1 - x0) - math.pi / 2
    for k in range(steps):
        f = (k + .5) / steps
        x, y = lerp(x0, x1, f), lerp(y0, y1, f)
        g = max(height(x, y + .015), height(x, y - .015))
        box('lane_step_%d' % k, (x, y, g - .012), (.046, run / steps + .003, .036), 'roofslab', 0, lane)
    for side in (-1, 1):
        ox, oy = math.cos(lane) * side * .029, math.sin(lane) * side * .029
        a = Vector((x0 + ox, y0 + oy, height(x0, y0) + .012))
        b = Vector((x1 + ox, y1 + oy, height(x1, y1) + .012))
        bpy.ops.mesh.primitive_cube_add(size=1, location=(a + b) / 2)
        o = bpy.context.object
        o.scale = (.012, (b - a).length + .02, .03)
        o.rotation_euler = (b - a).to_track_quat('Y', 'Z').to_euler()
        finish(o, 'lane_parapet_%d' % side, 'whitewash')

    # ----------------------------------------------- boathouses and slipways
    for i, angle in enumerate(BOATHOUSES):
        a = math.radians(angle)
        direction = Vector((math.cos(a), math.sin(a)))
        front = COVE + direction * (COVE_R + .01)
        centre = COVE + direction * (COVE_R + .052)
        rz = math.atan2(-direction.y, -direction.x) + math.pi / 2   # door faces the cove centre
        P = frame(centre.x, centre.y, rz)
        top = .072 + .006 * (i % 2)
        box('boathouse_%d_walls' % i, (centre.x, centre.y, (top - .03) / 2), (.07, .085, top + .03), 'stone' if i != 1 else 'whitewash', .005, rz)
        box('boathouse_%d_roof' % i, (centre.x, centre.y, top + .004), (.078, .092, .01), 'darkwood', .002, rz)
        box('boathouse_%d_door' % i, (*P(0, -.0435), .03), (.046, .006, .05), 'darkwood' if i != 1 else 'blue', .002, rz)
        box('boathouse_%d_shelf' % i, (*P(0, -.062), -.008), (.07, .04, .022), 'stone', .004, rz)
        for sx in (-1, 1):
            q0, q1 = P(sx * .014, -.04), P(sx * .014, -.11)
            tube('boathouse_%d_rail_%d' % (i, sx), q0 + (.006,), q1 + (-.025,), .0035, 'wood', 4, smooth=False)

    # ------------------------------------------------------------ llauts
    def llaut(tag, at, rz, z, tilt=0.):
        P = frame(at[0], at[1], rz)
        rot = (tilt, 0, rz)
        blob(tag + '_hull', (*P(0, 0), z), (.03, .085, .026), 'whitewash', 14, 6, rot)
        blob(tag + '_gunwale_band', (*P(0, 0), z + .017), (.0315, .087, .006), 'blue', 12, 3, rot)
        blob(tag + '_deck', (*P(0, 0), z + .022), (.024, .072, .006), 'wood', 10, 3, rot)
        tube(tag + '_mast', P(0, -.025) + (z + .02,), P(0, -.025) + (z + .15,), .0025, 'darkwood', 5, caps=False)
        tube(tag + '_lateen_yard', P(0, -.075) + (z + .05,), P(0, .03) + (z + .17,), .0018, 'darkwood', 4, smooth=False)

    jetty_start = (JETTY_X, -.02)
    jetty_end = (JETTY_X, -.27)
    llaut('llaut_moored', (JETTY_X + .06, -.20), 0, .004)
    a = math.radians(BOATHOUSES[1])
    hauled = COVE + Vector((math.cos(a), math.sin(a))) * (COVE_R - .045)
    llaut('llaut_on_slipway', tuple(hauled), math.atan2(-math.sin(a), -math.cos(a)) + math.pi / 2, .012, -.12)

    # ------------------------------------------------------------- jetty
    length = jetty_start[1] - jetty_end[1]
    mid = (JETTY_X, (jetty_start[1] + jetty_end[1]) / 2)
    box('jetty_deck', (*mid, .028), (.05, length, .012), 'wood', .003)
    for k in range(7):
        y = jetty_start[1] - (k + .5) * length / 7
        box('jetty_plank_gap_%d' % k, (JETTY_X, y, .0345), (.046, .003, .002), 'darkwood', 0)
    for k in range(3):
        y = jetty_start[1] - .03 - k * (length - .045) / 2
        for sx in (-1, 1):
            tube('jetty_post_%d_%d' % (k, sx), (JETTY_X + sx * .027, y, -.05), (JETTY_X + sx * .027, y, .042), .0045, 'darkwood', 6)

    # ------------------------------------------------------------- lamps
    def lamp(tag, x, y, z=None):
        z = height(x, y) if z is None else z
        tube(tag + '_post', (x, y, z - .015), (x, y, z + .085), .0035, 'navy', 5, caps=False)
        blob(tag + '_lantern', (x, y, z + .093), (.009, .009, .012), 'lantern', 6, 4)
        tube(tag + '_lantern_cap', (x, y, z + .101), (x, y, z + .11), .012, 'navy', 6, r2=.002)

    lamp('jetty_end_lamp', JETTY_X - .02, jetty_end[1] + .012, .034)
    lamp('beach_lamp_left', *around(-40, .476))
    lamp('beach_lamp_right', *around(52, .476))

    # ---------------------------------------------- beach parasols (Ibiza white)
    for i, (angle, distance) in enumerate([(-56, .405), (-43, .405)]):
        x, y = around(angle, distance)
        z = height(x, y)
        tube('parasol_%d_pole' % i, (x, y, z - .015), (x, y, z + .075), .0025, 'darkwood', 6)
        bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=.04, radius2=.004, depth=.022, location=(x, y, z + .08))
        o = finish(bpy.context.object, 'parasol_%d_canopy' % i, 'whitewash')
        for poly in o.data.polygons:
            poly.use_smooth = True

    # ------------------------------------- defence tower on the left headland
    x, y = TOWER
    low, high = ground_under(frame(x, y, 0), .09, .09)
    tube('defence_tower_body', (x, y, low - .03), (x, y, high + .15), .046, 'stone', 16, r2=.04, caps=False)
    tube('defence_tower_parapet', (x, y, high + .15), (x, y, high + .172), .044, 'stone', 16)
    tube('defence_tower_band', (x, y, high + .147), (x, y, high + .154), .0445, 'whitewash', 16, caps=False)
    box('defence_tower_machicolation', (x + .03, y - .03, high + .14), (.03, .03, .03), 'stone', .003, math.pi / 4)
    box('defence_tower_door', (x + .028, y - .028, high + .085), (.014, .006, .024), 'darkwood', .001, math.pi / 4)
    box('defence_tower_slit', (x - .012, y - .04, high + .118), (.008, .006, .022), 'navy', 0, -.3)

    # ------------------------------------------------- buoys and shore rocks
    for i, (x, y) in enumerate(BUOYS):
        tube('boia_buoy_%d_body' % i, (x, y, -.01), (x, y, .028), .021, 'orange', 10, r2=.016, caps=False)
        tube('boia_buoy_%d_band' % i, (x, y, .02), (x, y, .03), .0165, 'whitewash', 10, caps=False)
        tube('boia_buoy_%d_top' % i, (x, y, .03), (x, y, .055), .014, 'orange', 10, r2=.002)
    for i, (angle, r) in enumerate(SHORE_ROCKS):
        a = math.radians(angle)
        x, y = math.cos(a), math.sin(a)
        f = .925 * coast(x, y)
        blob('shore_rock_%d' % i, (x * f, y * f, .0), (r, r * .85, r * .7), 'rock', 7, 4, (0, 0, a * 3))
    return root


# ----------------------------------------------------------------- evidence
def evidence(root, directory, camera, gray=False):
    directory = Path(directory).resolve()
    common.render_preview(root, directory, gray, camera, target_height=.16, ortho_scale=2.35)
    scene = bpy.context.scene
    cam = scene.camera
    sun = next(o for o in scene.objects if o.type == 'LIGHT')
    background = scene.world.node_tree.nodes['Background'].inputs['Color']
    settings = json.loads(Path(camera).read_text(encoding='utf-8'))

    def shot(name, location, target, ortho=None, lens=None):
        cam.location = location
        cam.rotation_euler = (Vector(target) - Vector(location)).to_track_quat('-Z', 'Y').to_euler()
        if ortho:
            cam.data.type = 'ORTHO'
            cam.data.ortho_scale = ortho
        else:
            cam.data.type = 'PERSP'
            cam.data.sensor_fit = 'VERTICAL'
            cam.data.sensor_height = 32
            cam.data.lens = lens or cam.data.sensor_height / (2 * math.tan(math.radians(settings['fov_vertical_degrees']) / 2))
        scene.render.filepath = str(directory / name)
        bpy.ops.render.render(write_still=True)

    def day(on=True):
        sun.data.energy = 2.4 if on else .35
        background.default_value = (.5, .67, .8, 1) if on else (.08, .11, .2, 1)

    day()
    if gray:
        shot('graybox-distance', settings['location_blender'], settings['target_blender'])
    # Same game camera law at a closer exterior approach (1.05 radii).
    near = Vector(settings['location_blender']) + Vector((0, .65, 0))
    near_target = Vector(settings['target_blender']) + Vector((0, .65, 0))
    for time in (['day'] if gray else ['day', 'night']):
        day(time == 'day')
        shot(('graybox' if gray else 'distance') + '-near-' + time, near, near_target)
    day()
    views = [('front', (0, -4, 1.6)), ('back', (0, 4, 1.6)), ('left', (-4, 0, 1.6)),
             ('right', (4, 0, 1.6)), ('top', (0, -.001, 5)), ('oblique', (2.3, -3.8, 2.5))]
    for name, p in views:
        shot(('graybox-' if gray else 'view-') + name, p, (0, 0, .16), ortho=2.35)
    if gray:
        return
    day(False)
    shot('view-oblique-night', (2.3, -3.8, 2.5), (0, 0, .16), ortho=2.35)
    day()
    # Close-ups: the shop and beach, the boathouses, the church.
    shot('close-shop', (.35, -1.05, .55), (.03, .02, .08), ortho=.62)
    shot('close-boathouses', (-.35, -.95, .45), (.3, -.4, .04), ortho=.55)
    shot('close-church', (.5, -.6, .95), (-.06, .5, .38), ortho=.55)
    shot('close-tower-mouth', (.2, -1.6, .45), (-.12, -.72, .06), ortho=.75)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--preview')
    parser.add_argument('--graybox', action='store_true')
    parser.add_argument('--fresh-evidence', action='store_true')
    parser.add_argument('--distance-camera', default='node_modules/t111-preview/distance-camera.json')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    if args.fresh_evidence:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(common.REPO / 'art/places/3d/tienda/tienda.glb'))
        root = bpy.data.objects['place_tienda']
    else:
        root = build(args.graybox)
        if not args.graybox:
            common.export('tienda', root, 'tools/blender/places/tienda.py', REFERENCES, APPROACH,
                          license_note='Original BOIA geometry and game palette colours. Official Illes Balears '
                                       'tourism photographs were inspected as visual references only; no '
                                       'image, texture or other external media is redistributed.')
    if args.preview:
        evidence(root, args.preview, args.distance_camera, args.graybox)

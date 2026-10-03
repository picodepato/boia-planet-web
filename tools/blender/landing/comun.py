"""Shared helpers for the landing hero props (plan 007, T78). MUESTRA.

The hero scene of the landing (docs/propuestas/2026-10-03-landing-scroll.md,
section 12) is realistic set dressing seen against the light: the coast, the
port with its beacons and lamps, a motor-sailer ahead of the camera and a
navigation buoy. Every prop is a module `tools/blender/landing/<id>.py` built
by export_landing_glb.py; this module holds what they share:

- Units: metres. Water at z = 0. Seaward (the direction the hero camera looks
  into) is +Y in Blender, which the glTF export (y up) turns into -z: the
  direction a three.js camera looks by default, so a prop placed ahead of the
  camera faces away from it like the islands of tools/blender/islas/ face
  toward it. X is right on screen (looking +Y with Z up).
- Materials: PBR (Principled BSDF) with a vertex colour attribute as base
  colour, so a prop needs very few materials (the brief caps them at four);
  lights are separate meshes with an emissive material (`luz_*`) so three.js
  can attach sprite halos to them by node name.
- Geometry: bmesh helpers (loft, lathe, box, cylinder, terrain grids), smooth
  shading with sharp edges marked by angle, and fBm noise from
  mathutils.noise, deterministic by construction (no random module).
- Palette: the hex values of section 3 of the design document, the targets
  the live scene and the stills share.
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector, noise

# --- Palette (design document section 3) --------------------------------------
# Scene grades: zenith, sky, horizon haze, deep water, water near the horizon, sun path, key light.
GRADES = {
    "golden": {"zenith": "#1e2250", "sky": "#6a4a78", "horizon": "#e49a6a", "haze": "#d8a08a",
               "water_deep": "#0a1a33", "water_far": "#2a3f66", "path": "#ffc98a", "key": "#ffd9a0"},
    "dusk": {"zenith": "#0b0e2c", "sky": "#2c2650", "horizon": "#8a5a62", "haze": "#6a4a5c",
             "water_deep": "#07122a", "water_far": "#1b2a4d", "path": "#d8a07a", "key": "#d8a07a"},
    "night": {"zenith": "#02030a", "sky": "#070b22", "horizon": "#141a3a", "haze": "#11183a",
              "water_deep": "#040a18", "water_far": "#0d1a36", "path": "#9fb0e8", "key": "#c8d4ff"},
}
# Lights in the scene (section 3.1).
LIGHTS = {
    "verde": "#3cff8a",      # beacon, left (starboard hand leaving the port, IALA A)
    "roja": "#ff3b2a",       # beacon, right
    "muelle": "#ffd9a0",     # quay bulbs
    "farol": "#ffd9a0",      # the boat's lanterns and masthead light
    "boya": "#ffe8b0",       # the buoy's light
}

UP = Vector((0.0, 0.0, 1.0))
SEAWARD = Vector((0.0, 1.0, 0.0))


# --- Colour --------------------------------------------------------------------
def hex_lin(h, alpha=1.0):
    """'#rrggbb' (sRGB) -> linear RGBA tuple, as Blender wants it."""
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (alpha,)


def hex_srgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def mix(a, b, t):
    """Mix two RGB(A) tuples."""
    n = min(len(a), len(b))
    return tuple(a[i] * (1.0 - t) + b[i] * t for i in range(n))


def shade(c, k):
    """Scale an RGB(A) colour's RGB by k (alpha kept)."""
    out = tuple(min(1.0, x * k) for x in c[:3])
    return out + tuple(c[3:])


# --- Materials -----------------------------------------------------------------
def pbr_material(name, base_hex, roughness=0.8, metallic=0.0, vertex_color=True, emissive_hex=None,
                 emission_strength=1.0):
    """Principled material for glTF: base colour from the vertex colour attribute (or flat), PBR values.

    `emissive_hex` makes a light material: emission colour and strength (strength 1 so the GLB's
    emissiveFactor is the colour itself; three.js scales it with emissiveIntensity). The base colour
    of a light material is its emissive colour too, so it reads coloured when unlit.
    """
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    b.inputs["Base Color"].default_value = hex_lin(base_hex)
    b.inputs["Roughness"].default_value = roughness
    b.inputs["Metallic"].default_value = metallic
    if vertex_color and not emissive_hex:
        ca = nt.nodes.new("ShaderNodeVertexColor")
        ca.layer_name = "Col"
        nt.links.new(ca.outputs["Color"], b.inputs["Base Color"])
    if emissive_hex:
        b.inputs["Emission Color"].default_value = hex_lin(emissive_hex)
        b.inputs["Emission Strength"].default_value = emission_strength
    nt.links.new(b.outputs["BSDF"], out.inputs["Surface"])
    return m


# --- Noise ---------------------------------------------------------------------
def fbm(p, octaves=4, lacunarity=2.0, gain=0.5, seed=0.0):
    """Fractal Brownian motion in [-1, 1] from mathutils.noise (deterministic; `seed` offsets the field)."""
    v = Vector(p) + Vector((seed * 17.31, seed * 7.77, seed * 3.19))
    amp, freq, total, norm = 1.0, 1.0, 0.0, 0.0
    for _ in range(octaves):
        total += amp * noise.noise(v * freq)
        norm += amp
        amp *= gain
        freq *= lacunarity
    return total / norm


def ridged(p, octaves=4, seed=0.0):
    """Ridged multifractal in [0, 1]: sharp crests, good for rock skylines."""
    v = Vector(p) + Vector((seed * 11.7, seed * 5.3, seed * 2.9))
    amp, freq, total, norm = 1.0, 1.0, 0.0, 0.0
    for _ in range(octaves):
        n = 1.0 - abs(noise.noise(v * freq))
        total += amp * n * n
        norm += amp
        amp *= 0.55
        freq *= 2.1
    return total / norm


def hash01(*args):
    """Deterministic pseudo-random in [0, 1) from a few numbers (for scattering without `random`)."""
    x = 0.0
    for i, a in enumerate(args):
        x += math.sin(a * 12.9898 + i * 78.233) * 43758.5453
    return x - math.floor(x)


# --- bmesh geometry --------------------------------------------------------------
def new_object(name, bm, materials=(), smooth=True, sharp_deg=None):
    """Mesh object from a bmesh; faces smooth, edges sharper than `sharp_deg` marked sharp (split normals)."""
    me = bpy.data.meshes.new(name)
    if sharp_deg is not None:
        mark_sharp(bm, sharp_deg)
    bm.to_mesh(me)
    bm.free()
    for m in materials:
        me.materials.append(m)
    if smooth:
        me.shade_smooth()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def mark_sharp(bm, deg):
    """Edges whose faces meet at more than `deg` degrees are sharp (Blender 4.1+ splits normals there)."""
    lim = math.radians(deg)
    bm.normal_update()
    for e in bm.edges:
        if len(e.link_faces) == 2:
            if e.calc_face_angle(0.0) > lim:
                e.smooth = False
        elif len(e.link_faces) == 1:
            e.smooth = True


def set_material(faces, index):
    for f in faces:
        f.material_index = index


def transform(bm, verts, matrix):
    bmesh.ops.transform(bm, matrix=matrix, verts=list(verts))


def place(at=(0, 0, 0), rot_z=0.0, rot=None, scale=1.0):
    """Matrix: scale, then rotate (about Z in degrees, or a full Euler in degrees), then translate."""
    s = Matrix.Scale(scale, 4) if isinstance(scale, (int, float)) else Matrix.Diagonal(tuple(scale) + (1.0,))
    if rot is not None:
        r = Matrix.Rotation(math.radians(rot[2]), 4, "Z") @ Matrix.Rotation(math.radians(rot[1]), 4, "Y") \
            @ Matrix.Rotation(math.radians(rot[0]), 4, "X")
    else:
        r = Matrix.Rotation(math.radians(rot_z), 4, "Z")
    return Matrix.Translation(Vector(at)) @ r @ s


def box(bm, size, matrix=Matrix.Identity(4), mat=0):
    """Axis-aligned box of `size` (sx, sy, sz) centred at its base (z from 0 to sz), then `matrix`."""
    sx, sy, sz = size
    ret = bmesh.ops.create_cube(bm, size=1.0)
    verts = ret["verts"]
    bmesh.ops.transform(bm, matrix=matrix @ Matrix.Translation((0, 0, sz / 2.0)) @ Matrix.Diagonal((sx, sy, sz, 1.0)),
                        verts=verts)
    faces = {f for v in verts for f in v.link_faces}
    set_material(faces, mat)
    return verts, faces


def cylinder(bm, r1, r2, h, segments=8, matrix=Matrix.Identity(4), cap1=True, cap2=True, mat=0):
    """Cone/cylinder along +Z from z = 0 (radius r1) to z = h (radius r2), then `matrix`."""
    ret = bmesh.ops.create_cone(bm, cap_ends=False, cap_tris=False, segments=segments, radius1=r1, radius2=r2,
                                depth=h)
    verts = ret["verts"]
    bmesh.ops.transform(bm, matrix=Matrix.Translation((0, 0, h / 2.0)), verts=verts)
    faces = {f for v in verts for f in v.link_faces}
    # Caps as n-gons (cheap: one face each, the exporter fans them).
    lo = [v for v in verts if v.co.z < h * 0.5]
    hi = [v for v in verts if v.co.z >= h * 0.5]
    if cap1 and r1 > 1e-6:
        faces.add(bm.faces.new(sorted(lo, key=lambda v: -math.atan2(v.co.y, v.co.x))))
    if cap2 and r2 > 1e-6:
        faces.add(bm.faces.new(sorted(hi, key=lambda v: math.atan2(v.co.y, v.co.x))))
    bmesh.ops.recalc_face_normals(bm, faces=list(faces))
    bmesh.ops.transform(bm, matrix=matrix, verts=verts)
    set_material(faces, mat)
    return verts, faces


def lathe(bm, profile, segments=12, matrix=Matrix.Identity(4), mat=0, close=True):
    """Revolve a profile [(r, z), ...] (r >= 0, from bottom to top) around Z; r = 0 ends make poles."""
    rings = []
    for r, z in profile:
        if r <= 1e-6:
            rings.append([bm.verts.new((0.0, 0.0, z))])
        else:
            rings.append([bm.verts.new((r * math.cos(2 * math.pi * i / segments),
                                        r * math.sin(2 * math.pi * i / segments), z)) for i in range(segments)])
    faces = set()
    for a, b in zip(rings, rings[1:]):
        faces |= _skin(bm, a, b, segments)
    if close:
        if len(rings[0]) > 1:
            faces.add(bm.faces.new(list(reversed(rings[0]))))
        if len(rings[-1]) > 1:
            faces.add(bm.faces.new(rings[-1]))
    verts = [v for r in rings for v in r]
    bmesh.ops.recalc_face_normals(bm, faces=list(faces))
    bmesh.ops.transform(bm, matrix=matrix, verts=verts)
    set_material(faces, mat)
    return verts, faces


def _skin(bm, a, b, n):
    faces = set()
    if len(a) == 1 and len(b) == 1:
        return faces
    if len(a) == 1:
        for i in range(n):
            faces.add(bm.faces.new((a[0], b[i], b[(i + 1) % n])))
    elif len(b) == 1:
        for i in range(n):
            faces.add(bm.faces.new((a[i], a[(i + 1) % n], b[0])))
    else:
        for i in range(n):
            faces.add(bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i])))
    return faces


def loft(bm, sections, closed_rings=True, cap_first=False, cap_last=False, matrix=Matrix.Identity(4), mat=0):
    """Skin consecutive rings of 3D points (same count each); open rings (closed_rings=False) make a strip."""
    rings = [[bm.verts.new(p) for p in sec] for sec in sections]
    n = len(sections[0])
    faces = set()
    for a, b in zip(rings, rings[1:]):
        m = n if closed_rings else n - 1
        for i in range(m):
            faces.add(bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i])))
    if cap_first:
        faces.add(bm.faces.new(list(reversed(rings[0]))))
    if cap_last:
        faces.add(bm.faces.new(rings[-1]))
    verts = [v for r in rings for v in r]
    bmesh.ops.recalc_face_normals(bm, faces=list(faces))
    bmesh.ops.transform(bm, matrix=matrix, verts=verts)
    set_material(faces, mat)
    return verts, faces, rings


def grid(bm, nx, ny, fn, mat=0):
    """nx × ny quads; fn(i, j, u, v) -> (x, y, z) for the (nx+1)(ny+1) vertices, u, v in [0, 1]."""
    rows = []
    for j in range(ny + 1):
        row = []
        for i in range(nx + 1):
            row.append(bm.verts.new(fn(i, j, i / nx, j / ny)))
        rows.append(row)
    faces = set()
    for j in range(ny):
        for i in range(nx):
            faces.add(bm.faces.new((rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i])))
    bmesh.ops.recalc_face_normals(bm, faces=list(faces))
    set_material(faces, mat)
    return rows, faces


def tube(bm, points, r, segments=4, matrix=Matrix.Identity(4), mat=0, closed=False):
    """Thin tube along a polyline (rails, stays, cables): `segments` sides, open ends."""
    pts = [Vector(p) for p in points]
    sections = []
    for k, p in enumerate(pts):
        if closed:
            d = (pts[(k + 1) % len(pts)] - pts[k - 1]).normalized()
        else:
            a = pts[max(k - 1, 0)]
            b = pts[min(k + 1, len(pts) - 1)]
            d = (b - a).normalized()
        side = d.cross(UP)
        if side.length < 1e-4:
            side = d.cross(Vector((1.0, 0.0, 0.0)))
        side.normalize()
        up = side.cross(d).normalized()
        ring = [p + (side * math.cos(2 * math.pi * i / segments) + up * math.sin(2 * math.pi * i / segments)) * r
                for i in range(segments)]
        sections.append(ring)
    if closed:
        sections.append(sections[0])
    verts, faces, _ = loft(bm, sections, closed_rings=True, matrix=matrix, mat=mat)
    if closed:
        # merge the duplicated first ring
        bmesh.ops.remove_doubles(bm, verts=verts, dist=1e-5)
    return verts, faces


def finish(bm):
    """Remove doubles and recalc normals on the whole bmesh (call once before new_object)."""
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])


# --- Vertex colours -----------------------------------------------------------------
def paint(ob, fn):
    """Vertex colour attribute 'Col' (byte, per point) from fn(co, normal, index) -> linear RGB(A).

    The index is the vertex's order of creation in the bmesh (grid(): j * (nx + 1) + i)."""
    me = ob.data
    ca = me.color_attributes.get("Col") or me.color_attributes.new("Col", "BYTE_COLOR", "POINT")
    for i, v in enumerate(me.vertices):
        c = fn(v.co, v.normal, i)
        if len(c) == 3:
            c = tuple(c) + (1.0,)
        ca.data[i].color_srgb = tuple(min(1.0, max(0.0, x)) for x in lin_to_srgb(c))
    me.color_attributes.active_color = ca
    me.color_attributes.render_color_index = me.color_attributes.find("Col")


def lin_to_srgb(c):
    out = []
    for x in c[:3]:
        out.append(x * 12.92 if x <= 0.0031308 else 1.055 * (x ** (1.0 / 2.4)) - 0.055)
    return tuple(out) + tuple(c[3:])


def paint_by_material(ob, colors):
    """Vertex colour from a per-material-slot colour table {slot: linear RGBA} (flat colour per slot)."""
    me = ob.data
    ca = me.color_attributes.get("Col") or me.color_attributes.new("Col", "BYTE_COLOR", "POINT")
    per_vertex = {}
    for p in me.polygons:
        c = colors.get(p.material_index)
        if c is None:
            continue
        for vi in p.vertices:
            per_vertex.setdefault(vi, c)
    for vi, c in per_vertex.items():
        ca.data[vi].color_srgb = tuple(min(1.0, max(0.0, x)) for x in lin_to_srgb(c))


# --- Measuring --------------------------------------------------------------------
def triangles(ob):
    """Evaluated triangles of a mesh object (modifiers applied as the exporter applies them)."""
    dg = bpy.context.evaluated_depsgraph_get()
    me = ob.evaluated_get(dg).to_mesh()
    try:
        return sum(len(p.vertices) - 2 for p in me.polygons)
    finally:
        ob.evaluated_get(dg).to_mesh_clear()


def bounds(objects):
    """World AABB of several objects: (min Vector, max Vector)."""
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for ob in objects:
        for c in ob.bound_box:
            w = ob.matrix_world @ Vector(c)
            lo = Vector((min(lo.x, w.x), min(lo.y, w.y), min(lo.z, w.z)))
            hi = Vector((max(hi.x, w.x), max(hi.y, w.y), max(hi.z, w.z)))
    return lo, hi


def join(objects, name):
    """Join mesh objects into one (materials merged by name); returns the joined object."""
    objects = [o for o in objects if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    if len(objects) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.data.name = name
    return ob


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    world = bpy.data.worlds.new("world")
    world.use_nodes = True
    scene.world = world
    return scene

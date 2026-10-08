"""Recursos del mundo, con la cámara del barco (rig.py) y el estilo elegido.

Cada función `render_<recurso>(S, out_dir, stats)` construye su escena desde
cero, renderiza sus PNG en `out_dir` y devuelve el cuerpo de su manifiesto
(render.py le añade id, versión, generador y estilo). Todo es procedural y con
semillas fijas: dos corridas dan los mismos bytes.

Coordenadas de diseño: `G(sx, sy, z)` pone un punto del suelo en unidades del
mundo relativas a la pantalla: +sx hacia la derecha de la pantalla, +sy hacia
el espectador (abajo en pantalla), z altura. Un paso de 1 en sx mide
`pixels_per_unit` px en la imagen; uno de 1 en sy mide la mitad (2:1).
"""
import math
import os
import random

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

import rig

WORLD_VERSION = "0.1.0"
PPU = rig.pixels_per_unit()           # misma densidad que el barco: una sola escala para todo el arte
FIT_MARGIN_PX = 12
FIT_STEP_PX = 16

RIGHT, TOWARD, _FORWARD = rig.camera_basis()
UP = Vector((0.0, 0.0, 1.0))
FACE_TOWARD_DEG = math.degrees(math.atan2(TOWARD.y, TOWARD.x))   # giro para que +X local mire a la cámara


def G(sx, sy, z=0.0):
    return RIGHT * sx + TOWARD * sy + UP * z


# --- Materiales y objetos ----------------------------------------------------
class Kit:
    """Materiales del estilo por rol (con caché) y alta de objetos con contorno."""

    def __init__(self, S, outline_scale=1.0):
        self.S = S
        self.outline_scale = outline_scale
        self.outline = S.outline_material()
        self.cache = {}

    def toon(self, role, hexcol=None):
        key = ("toon", role, hexcol)
        if key not in self.cache:
            self.cache[key] = self.S.toon(role, hexcol or self.S.PALETTE[role])
        return self.cache[key]

    def flat(self, role, alpha=1.0):
        key = ("flat", role, alpha)
        if key not in self.cache:
            self.cache[key] = self.S.flat_material(role + "_flat", self.S.PALETTE[role], alpha)
        return self.cache[key]

    def obj(self, name, bm, mats, parent=None, outline=True, thickness=0.0, smooth=True, recalc=True):
        mats = [self.toon(m) if isinstance(m, str) else m for m in mats]
        return self.S.link_object(name, bm, mats, parent, self.outline, outline=outline, thickness=thickness,
                                  outline_scale=self.outline_scale, smooth=smooth, recalc=recalc)


def holdout_plane(size=400.0, z=0.0):
    """Plano de agua invisible: recorta todo lo que queda bajo z=0 y deja el alfa a 0 (el agua la pone el motor)."""
    mat = bpy.data.materials.new("water_holdout")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    h = nt.nodes.new("ShaderNodeHoldout")
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(h.outputs["Holdout"], out.inputs["Surface"])
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=size / 2.0)
    bmesh.ops.translate(bm, verts=bm.verts[:], vec=(0.0, 0.0, z))
    me = bpy.data.meshes.new("water_holdout")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    obj = bpy.data.objects.new("water_holdout", me)
    obj["no_bounds"] = True
    bpy.context.scene.collection.objects.link(obj)
    return obj


def face_up(bm, verts, mat_index=0):
    """Cara con la normal hacia arriba (terreno y anillos: nunca hay voladizos)."""
    f = bm.faces.new(verts)
    f.normal_update()
    if f.normal.z < 0:
        f.normal_flip()
    f.material_index = mat_index
    return f


def cylinder_between(bm, p0, p1, r, segments=8, r_top=None):
    p0, p1 = Vector(p0), Vector(p1)
    axis = p1 - p0
    rot = axis.to_track_quat("Z", "Y").to_matrix().to_4x4()
    mat = Matrix.Translation((p0 + p1) / 2) @ rot
    ret = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments,
                                radius1=r, radius2=r if r_top is None else r_top,
                                depth=axis.length, matrix=mat)
    return ret["verts"]


def box(bm, center, size, rot_z_deg=0.0, mat_index=0):
    """Caja alineada con la pantalla (x = derecha, y = hacia la cámara) salvo `rot_z_deg`."""
    m = (Matrix.Translation(Vector(center)) @ Matrix.Rotation(math.radians(FACE_TOWARD_DEG + 90.0 + rot_z_deg), 4, "Z")
         @ Matrix.Diagonal((size[0], size[1], size[2], 1.0)))
    ret = bmesh.ops.create_cube(bm, size=1.0, matrix=m)
    for f in {f for v in ret["verts"] for f in v.link_faces}:
        f.material_index = mat_index
    return ret["verts"]


def set_faces(verts, mat_index):
    for f in {f for v in verts for f in v.link_faces}:
        f.material_index = mat_index


# --- Piezas -------------------------------------------------------------------
def palm(kit, base, height, lean, seed, name="palm"):
    """Palmera: tronco curvo en 5 tramos, 7 hojas que caen y 3 cocos."""
    rng = random.Random(seed)
    base = Vector(base)
    lean = Vector((lean[0], lean[1], 0.0))
    pts = [base + lean * ((i / 5) ** 1.6) + UP * (height * i / 5) for i in range(6)]
    bm = bmesh.new()
    for i in range(5):
        cylinder_between(bm, pts[i], pts[i + 1], 0.075 * (1 - 0.3 * i / 5), 6, 0.075 * (1 - 0.3 * (i + 1) / 5))
    kit.obj(name + "_trunk", bm, ["trunk"])
    top = pts[-1]
    bm = bmesh.new()
    n = 7
    a0 = rng.uniform(0, 2 * math.pi)
    for k in range(n):
        a = a0 + 2 * math.pi * k / n + rng.uniform(-0.2, 0.2)
        d = Vector((math.cos(a), math.sin(a), 0.0))
        side = Vector((-d.y, d.x, 0.0))
        length = 0.66 * rng.uniform(0.85, 1.1)
        droop = rng.uniform(0.28, 0.42)
        rows = []
        for i in range(6):
            t = i / 5
            c = top + d * (length * t) + UP * (0.14 * t - droop * t * t)
            w = 0.14 * math.sin(math.pi * min(t, 0.96)) + 0.015
            rows.append([c - side * w, c + UP * 0.035 * (1 - t), c + side * w])
        rows = [[bm.verts.new(p) for p in r] for r in rows]
        for r0, r1 in zip(rows, rows[1:]):
            bm.faces.new((r0[0], r1[0], r1[1], r0[1]))
            bm.faces.new((r0[1], r1[1], r1[2], r0[2]))
    kit.obj(name + "_leaves", bm, ["foliage"], thickness=0.014)
    bm = bmesh.new()
    for k in range(3):
        a = a0 + 2 * math.pi * k / 3 + 0.5
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.05,
                                   matrix=Matrix.Translation(top + Vector((math.cos(a) * 0.06, math.sin(a) * 0.06, -0.06))))
    kit.obj(name + "_coconuts", bm, ["wood"])
    return top


def pine(kit, base, height, lean, seed, name="pine"):
    """Pino piñonero: tronco inclinado y copa en parasol de 3 o 4 masas."""
    rng = random.Random(seed)
    base = Vector(base)
    lean = Vector((lean[0], lean[1], 0.0))
    pts = [base + lean * ((i / 4) ** 1.3) + UP * (height * i / 4) for i in range(5)]
    bm = bmesh.new()
    for i in range(4):
        cylinder_between(bm, pts[i], pts[i + 1], 0.07 * (1 - 0.25 * i / 4), 6, 0.07 * (1 - 0.25 * (i + 1) / 4))
    kit.obj(name + "_trunk", bm, ["trunk"])
    top = pts[-1]
    bm = bmesh.new()
    for k in range(rng.choice((3, 4))):
        a = rng.uniform(0, 2 * math.pi)
        rr = rng.uniform(0.15, 0.32)
        r = rng.uniform(0.34, 0.48)
        c = top + Vector((math.cos(a) * rr, math.sin(a) * rr, rng.uniform(-0.04, 0.08)))
        bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0,
                                   matrix=Matrix.Translation(c) @ Matrix.Diagonal((r, r, r * 0.42, 1.0)))
    kit.obj(name + "_crown", bm, ["foliage"])
    return top


def bush(kit, base, size, seed, name="bush", role="foliage_dark"):
    rng = random.Random(seed)
    bm = bmesh.new()
    for k in range(3):
        a = 2 * math.pi * k / 3 + rng.uniform(-0.4, 0.4)
        r = size * rng.uniform(0.55, 0.8)
        c = Vector(base) + Vector((math.cos(a) * size * 0.5, math.sin(a) * size * 0.5, r * 0.45))
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0,
                                   matrix=Matrix.Translation(c) @ Matrix.Diagonal((r, r, r * 0.75, 1.0)))
    kit.obj(name, bm, [role])


def rock(kit, center, rx, ry, h, seed, name="rock", sink=0.12):
    """Roca facetada: icosfera deformada, base plana y cara superior más clara."""
    rng = random.Random(seed)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
    rot = rng.uniform(0, 2 * math.pi)
    for v in bm.verts:
        j = 1.0 + rng.uniform(-0.16, 0.16)
        x, y, z = v.co.x * j, v.co.y * j, max(v.co.z * j, -0.35)
        x, y = x * math.cos(rot) - y * math.sin(rot), x * math.sin(rot) + y * math.cos(rot)
        v.co = Vector(center) + RIGHT * (x * rx) + TOWARD * (y * ry) + UP * ((z + 0.35) / 1.35 * h - sink)
    bm.normal_update()
    for f in bm.faces:
        f.material_index = 1 if f.normal.z > 0.72 else 0
    kit.obj(name, bm, ["rock", "rock_light"], smooth=False)


def ring(kit, center_s, radius_fn, bands, n=72, name="ring"):
    """Anillos planos sobre el agua alrededor de una silueta radial.

    `radius_fn(theta)` en unidades de pantalla-suelo (sx, sy); `bands`: lista de
    (desde, hasta, rol, alfa, z) en distancia radial desde la silueta.
    """
    cx, cy = center_s
    for k, (d0, d1, role, alpha, z) in enumerate(bands):
        bm = bmesh.new()
        inner, outer = [], []
        for j in range(n):
            t = 2 * math.pi * j / n
            r = radius_fn(t)
            c, s = math.cos(t), math.sin(t)
            inner.append(bm.verts.new(G(cx + c * (r + d0), cy + s * (r + d0), z)))
            outer.append(bm.verts.new(G(cx + c * (r + d1), cy + s * (r + d1), z)))
        for j in range(n):
            face_up(bm, (inner[j], inner[(j + 1) % n], outer[(j + 1) % n], outer[j]))
        kit.obj("%s_%d_%s" % (name, k, role), bm, [kit.flat(role, alpha)], outline=False, recalc=False)


def shore_fn(radius, harmonics):
    def f(t):
        return radius * (1.0 + sum(a * math.cos(k * t + ph) for k, a, ph in harmonics))
    return f


def island_terrain(kit, shore, beach, plateau, hill, n=96, name="terrain"):
    """Isla por anillos polares: meseta de hierba con colina, acantilado bajo, playa y talud bajo el agua.

    shore(t), beach(t): radio de la orilla y ancho de playa (unidades de pantalla-suelo).
    hill(sx, sy): altura añadida sobre la meseta.
    """
    roles = ["grass", "cliff", "sand"]
    fr = [0.12, 0.26, 0.4, 0.54, 0.68, 0.8, 0.9, 1.0]
    bm = bmesh.new()
    rings = []
    for j in range(n):
        t = 2 * math.pi * j / n
        c, s = math.cos(t), math.sin(t)
        r = shore(t)
        rg = r - beach(t)
        prof = [(f * rg, None, 0) for f in fr]                # hierba (z por la colina)
        prof += [(rg + 0.07, 0.10, 1), ((rg + 0.07 + r) / 2, 0.05, 2), (r, 0.0, 2), (r + 0.4, -0.18, 2)]
        row = []
        for rad, z, _ in prof:
            sx, sy = c * rad, s * rad
            zz = plateau + hill(sx, sy) if z is None else z
            row.append(bm.verts.new(G(sx, sy, zz)))
        rings.append(row)
    seg_role = [0] * (len(fr) - 1) + [1, 2, 2, 2]
    center = bm.verts.new(G(0.0, 0.0, plateau + hill(0.0, 0.0)))
    for j in range(n):
        a, b = rings[j], rings[(j + 1) % n]
        face_up(bm, (center, a[0], b[0]), 0)
        for i in range(len(a) - 1):
            face_up(bm, (a[i], b[i], b[i + 1], a[i + 1]), seg_role[i])
    return kit.obj(name, bm, roles, recalc=False)


def terrain_height(shore, beach, plateau, hill, sx, sy):
    """Altura aproximada del terreno en (sx, sy): para apoyar piezas en la meseta."""
    t = math.atan2(sy, sx)
    rho = math.hypot(sx, sy)
    rg = shore(t) - beach(t)
    if rho <= rg:
        return plateau + hill(sx, sy)
    return 0.05


def pier(kit, shore, t, beach_w, length=1.25, width=0.4, deck_z=0.17, name="pier"):
    """Muelle decorativo hacia fuera de la orilla en el ángulo t. Devuelve el extremo a ras de agua."""
    r = shore(t)
    d = Vector((math.cos(t), math.sin(t)))
    side = Vector((-d.y, d.x))
    bm = bmesh.new()
    start, end = r - beach_w * 0.55, r + length
    n = 11
    step = (end - start) / n
    for i in range(n):
        m = start + step * (i + 0.5)
        c = G(d.x * m, d.y * m, deck_z)
        ang = math.degrees(math.atan2((RIGHT * d.x + TOWARD * d.y).y, (RIGHT * d.x + TOWARD * d.y).x))
        m4 = (Matrix.Translation(c) @ Matrix.Rotation(math.radians(ang), 4, "Z")
              @ Matrix.Diagonal((step * 0.86, width, 0.05, 1.0)))
        bmesh.ops.create_cube(bm, size=1.0, matrix=m4)
    kit.obj(name + "_deck", bm, ["wood_light"])
    bm = bmesh.new()
    for m in (r + 0.25, r + 0.7, end - 0.06):
        for sgn in (-1, 1):
            p = Vector((d.x * m + side.x * sgn * width * 0.5, d.y * m + side.y * sgn * width * 0.5))
            cylinder_between(bm, G(p.x, p.y, -0.3), G(p.x, p.y, deck_z + 0.08), 0.035, 6)
    kit.obj(name + "_posts", bm, ["wood"])
    return G(d.x * end, d.y * end, 0.0), G(d.x * end, d.y * end, deck_z)


def stage(kit, base, name="stage"):
    """Escenario de muestra de BOIA mirando a la cámara. Devuelve anclajes (cartel, frente, techo)."""
    b = Vector(base)
    L = lambda x, y, z: b + RIGHT * x + TOWARD * y + UP * z   # noqa: E731
    bm = bmesh.new()
    box(bm, L(0, 0, 0.0), (1.7, 1.0, 0.36))                               # tarima (hundida 0,18)
    kit.obj(name + "_deck", bm, ["wood_light"])
    bm = bmesh.new()
    box(bm, L(0, -0.46, 0.68), (1.7, 0.08, 1.0))                          # fondo
    for x in (-0.8, 0.8):
        cylinder_between(bm, L(x, 0.44, 0.18), L(x, 0.44, 1.36), 0.04, 6)  # postes delanteros
    cylinder_between(bm, L(-0.86, 0.44, 1.34), L(0.86, 0.44, 1.34), 0.035, 6)
    kit.obj(name + "_frame", bm, ["stage"])
    bm = bmesh.new()                    # techo naranja sólo sobre la mitad de atrás: desde 30° no tapa el cartel
    v = [bm.verts.new(p) for p in (L(-0.95, -0.02, 1.44), L(0.95, -0.02, 1.44), L(0.95, -0.62, 1.38), L(-0.95, -0.62, 1.38))]
    bm.faces.new(v)
    kit.obj(name + "_roof", bm, ["orange"], thickness=0.07)
    bm = bmesh.new()                                                     # hueco del cartel (lo pone el motor)
    box(bm, L(0, -0.41, 0.78), (1.2, 0.02, 0.76))
    kit.obj(name + "_poster", bm, [kit.toon("canvas")], outline=False)
    bm = bmesh.new()
    for x in (-1.0, 1.0):
        box(bm, L(x, 0.3, 0.3), (0.3, 0.3, 0.6))
    kit.obj(name + "_speakers", bm, ["speaker"])
    bm = bmesh.new()                                                     # banderines
    for x in (-0.7, 0.7):
        cylinder_between(bm, L(x, -0.55, 0.1), L(x, -0.55, 2.0), 0.025, 6)
    kit.obj(name + "_poles", bm, ["stage"])
    for k, x in enumerate((-0.7, 0.7)):
        bm = bmesh.new()
        v = [bm.verts.new(p) for p in (L(x, -0.55, 1.98), L(x + 0.42 * (1 if x > 0 else -1), -0.55, 1.86), L(x, -0.55, 1.74))]
        bm.faces.new(v)
        kit.obj("%s_flag_%d" % (name, k), bm, ["orange" if k == 0 else "navy"], thickness=0.015)
    return {"cartel": L(0, -0.39, 0.78), "escenario": L(0, 0.5, 0.18), "banderin": L(0.7, -0.55, 2.0)}


# --- Encuadre y render --------------------------------------------------------
def art_points(ppu):
    """Todos los vértices visibles (con modificadores), en px relativos al origen del mundo."""
    dg = bpy.context.evaluated_depsgraph_get()
    up = rig.camera_up()
    chunks = []
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or obj.hide_render or obj.get("no_bounds"):
            continue
        ev = obj.evaluated_get(dg)
        me = ev.to_mesh()
        co = np.empty(len(me.vertices) * 3)
        me.vertices.foreach_get("co", co)
        ev.to_mesh_clear()
        co = co.reshape(-1, 3)
        mw = np.array(ev.matrix_world)
        w = co @ mw[:3, :3].T + mw[:3, 3]
        w = w[w[:, 2] > -0.01]                     # lo que queda bajo el agua lo recorta el plano
        if len(w):
            chunks.append(np.stack([w @ np.array(RIGHT) * ppu, -(w @ np.array(up)) * ppu], axis=1))
    return np.concatenate(chunks)


def fit_canvas(ppu, margin=FIT_MARGIN_PX, step=FIT_STEP_PX):
    """Lienzo mínimo (múltiplo de `step`) que contiene todo el arte con `margin` px libres; pivote entero."""
    pts = art_points(ppu)
    x0, y0 = pts.min(axis=0)
    x1, y1 = pts.max(axis=0)
    w = int(math.ceil((x1 - x0 + 2 * margin) / step) * step)
    h = int(math.ceil((y1 - y0 + 2 * margin) / step) * step)
    px = float(round(-x0 + (w - (x1 - x0)) / 2.0))
    py = float(round(-y0 + (h - (y1 - y0)) / 2.0))
    return w, h, (px, py), (float(y0), float(y1))


def setup(width, height, pivot_px, ppu=None, origin=(0.0, 0.0, 0.0), transparent=True):
    scene = bpy.context.scene
    rig.setup_render(scene, transparent=transparent, width=width, height=height)
    for obj in [o for o in scene.objects if o.type in ("CAMERA", "LIGHT")]:
        bpy.data.objects.remove(obj)
    cam = rig.add_camera(scene, width=width, height=height, pivot_px=pivot_px, ppu=ppu, origin=origin)
    rig.add_sun(scene)
    bpy.context.view_layer.update()                 # matrices al día antes de proyectar anclajes
    return scene, cam


def px(scene, cam, p):
    x, y = rig.project_px(scene, cam, p)
    return [round(x, 2), round(y, 2)]


def render_to(scene, path, stats):
    import time
    os.makedirs(os.path.dirname(path), exist_ok=True)
    scene.render.filepath = path
    t0 = time.perf_counter()
    bpy.ops.render.render(write_still=True)
    stats.append({"file": path, "seconds": round(time.perf_counter() - t0, 3), "bytes": os.path.getsize(path)})


def circle_hint(pivot, radius_units, ppu):
    return {"shape": "circle", "center_px": list(pivot), "radius_px": round(radius_units * ppu, 2),
            "radius_units": round(radius_units, 4)}


def polygon_px(scene, cam, pts_world, n_max=32):
    step = max(1, int(math.ceil(len(pts_world) / float(n_max))))
    return [px(scene, cam, p) for p in pts_world[::step]]


# --- Islas ----------------------------------------------------------------------
ISLANDS = {
    "isla-evento": {
        "seed": 11, "radius": 4.4, "plateau": 0.34, "layout": 0.9,
        "harmonics": [(2, 0.07, 0.4), (3, 0.06, 1.9), (4, 0.035, 0.7), (5, 0.025, 2.6), (7, 0.012, 1.1)],
        "beach": (0.55, 0.3, math.radians(80)),          # ancho medio, variación, ángulo más ancho (hacia la cámara)
        "hills": [(-1.9, -1.3, 0.55, 1.5), (-2.6, 0.6, 0.25, 1.0)],
        "stage": (1.0, -1.5),
        "pier": math.radians(62),
        "palms": [(-3.2, -0.8, 1.35), (-2.2, -2.6, 1.55), (2.9, 0.3, 1.25), (3.2, -1.3, 1.45), (-0.6, 2.4, 1.2),
                  (1.6, 1.9, 1.35), (-3.0, 1.4, 1.1)],
        "bushes": [(-1.4, 0.3, 0.3), (0.2, 0.9, 0.24), (2.3, -2.5, 0.28), (-0.9, -2.9, 0.26), (3.4, 1.4, 0.22)],
        "rocks": [(4.9, -1.4, 0.38), (-4.6, 2.2, 0.32), (-1.8, 4.3, 0.3)],
        "proximity_factor": 1.8,
    },
    "isla-pequena": {
        "seed": 23, "radius": 2.05, "plateau": 0.24, "layout": 1.0,
        "harmonics": [(2, 0.09, 1.3), (3, 0.07, 0.2), (5, 0.03, 2.2)],
        "beach": (0.5, 0.2, math.radians(100)),
        "hills": [(-0.4, -0.5, 0.18, 0.8)],
        "stage": None,
        "pier": None,
        "palms": [(-0.5, -0.6, 1.25), (0.35, -0.2, 1.05)],
        "bushes": [(0.7, 0.5, 0.22), (-0.9, 0.3, 0.2)],
        "rocks": [(2.0, 0.6, 0.26), (-1.7, 1.1, 0.2)],
        "proximity_factor": 2.2,
    },
}


def build_island(kit, spec):
    rng = random.Random(spec["seed"])
    shore = shore_fn(spec["radius"], [(k, a, ph) for k, a, ph in spec["harmonics"]])
    bw, bv, bt = spec["beach"]
    beach = lambda t: bw + bv * math.cos(t - bt)   # noqa: E731
    k_ = spec["layout"]                              # escala de las posiciones del diseño (no de los tamaños)
    hills = [(x * k_, y * k_, a, sg * k_) for x, y, a, sg in spec["hills"]]

    def hill(sx, sy):
        return sum(a * math.exp(-((sx - hx) ** 2 + (sy - hy) ** 2) / (s * s)) for hx, hy, a, s in hills)

    plateau = spec["plateau"]
    holdout_plane()
    island_terrain(kit, shore, beach, plateau, hill)
    ring(kit, (0.0, 0.0), shore, [(-0.03, 0.1, "foam", 1.0, 0.006), (0.1, 0.55, "shallow", kit.S.SHALLOW_ALPHA, 0.004)])
    anchors = {}
    zat = lambda sx, sy: terrain_height(shore, beach, plateau, hill, sx, sy)   # noqa: E731
    if spec["stage"]:
        sx, sy = spec["stage"][0] * k_, spec["stage"][1] * k_
        anchors.update(stage(kit, G(sx, sy, zat(sx, sy))))
    if spec["pier"] is not None:
        t = spec["pier"]
        water_end, deck_end = pier(kit, shore, t, beach(t))
        anchors["muelle"] = water_end
    lay = lambda items: [(x * k_, y * k_, v) for x, y, v in items]   # noqa: E731
    for k, (sx, sy, hgt) in enumerate(lay(spec["palms"])):
        lean = (rng.uniform(-0.25, 0.25), rng.uniform(-0.25, 0.25))
        palm(kit, G(sx, sy, zat(sx, sy) - 0.03), hgt, RIGHT.xy * lean[0] + TOWARD.xy * lean[1] + (RIGHT.xy * sx + TOWARD.xy * sy).normalized() * 0.18,
             spec["seed"] * 100 + k, name="palm_%d" % k)
    for k, (sx, sy, size) in enumerate(lay(spec["bushes"])):
        bush(kit, G(sx, sy, zat(sx, sy) - 0.02), size, spec["seed"] * 200 + k, name="bush_%d" % k)
    for k, (sx, sy, size) in enumerate(lay(spec["rocks"])):
        rock(kit, G(sx, sy, 0.0), size, size * 0.9, size * 1.1, spec["seed"] * 300 + k, name="rock_%d" % k)
    return shore, anchors


def render_island(S, rid, out_dir, stats, ppu=PPU, outline_scale=1.0, file_name="base.png"):
    spec = ISLANDS[rid]
    rig.reset_scene()
    kit = Kit(S, outline_scale)
    shore, anchors_w = build_island(kit, spec)
    w, h, pivot, (ytop, _) = fit_canvas(ppu)
    scene, cam = setup(w, h, pivot, ppu=ppu)
    render_to(scene, os.path.join(out_dir, file_name), stats)
    ts = [2 * math.pi * j / 32 for j in range(32)]
    poly_w = [G(math.cos(t) * shore(t), math.sin(t) * shore(t)) for t in ts]
    mean_r = sum(shore(2 * math.pi * j / 360) for j in range(360)) / 360.0
    anchors = {"pivot": list(pivot)}
    for k, p in anchors_w.items():
        anchors[k] = px(scene, cam, p)
    anchors["rotulo"] = [pivot[0], round(pivot[1] + ytop - 4.0, 2)]
    return {
        "scene": scene, "cam": cam, "width": w, "height": h, "pivot": pivot, "anchors": anchors,
        "footprint": polygon_px(scene, cam, poly_w), "mean_radius": mean_r, "spec": spec,
    }


ISLAND_ANCHOR_DOC = {
    "pivot": "centro de la isla a ras de agua; origen de la huella y de la proximidad",
    "rotulo": "encima del punto más alto del arte: nombre o aviso de la isla",
    "cartel": "centro del hueco crema del escenario: ahí el motor superpone el cartel del evento",
    "escenario": "borde delantero de la tarima",
    "banderin": "tope del mástil derecho del escenario",
    "muelle": "extremo del muelle decorativo a ras de agua (§9: el puerto nunca es obligatorio)",
}


def island_manifest(r, ppu=PPU):
    spec = r["spec"]
    anchors = r["anchors"]
    return {
        "kind": "sprite",
        "category": "isla",
        "image": {"width": r["width"], "height": r["height"], "format": "png", "mode": "RGBA", "transparent_border_px": 4},
        "pivot_px": list(r["pivot"]),
        "anchors": anchors,
        "anchors_doc": {k: ISLAND_ANCHOR_DOC[k] for k in anchors},
        "anchors_on_art": [k for k in ("pivot", "cartel") if k in anchors],
        "footprint": {"shape": "polygon", "points_px": r["footprint"],
                      "doc": "orilla a ras de agua (sin la espuma), en px de la imagen, sentido horario en pantalla"},
        "hitbox_hint": circle_hint(r["pivot"], r["mean_radius"], ppu),
        "proximity_hint": circle_hint(r["pivot"], r["mean_radius"] * spec["proximity_factor"], ppu),
        "images": [{"file": "base.png", "frame": 0}],
    }


# --- Boia tutorial ------------------------------------------------------------------
BUOY_FRAMES = 12
BUOY_FPS = 8
BUOY_K = 1.0              # escala de la mascota (la de la primera boia del mundo de arcilla)


def build_mascot_buoy():
    """La boia del tutorial es la mascota de BOIA (T231, mascota.py): la del logo, con su gorro, su aro y el trazo
    negro del logo alrededor (outline), en la arcilla del mundo principal. Devuelve la raíz que se balancea."""
    import mascota as MASC
    import mundo_arcilla as ARC
    holdout_plane()
    root = bpy.data.objects.new("buoy_bob", None)
    bpy.context.scene.collection.objects.link(root)
    B = ARC.escena.Builder(ARC.TemaJuego(), ARC.temas.A, ARC.M, root)
    with B.zona("mascota"), B.pieza("boia_tutorial"):
        tip = MASC.mascota(B, (0.0, 0.0, 0.0), k=BUOY_K, g=90.0, variant="primera", mouth="sonrisa", outline=True)
    bpy.context.view_layer.update()

    def empty(name, loc):
        e = bpy.data.objects.new(name, None)
        bpy.context.scene.collection.objects.link(e)
        e.parent = root
        e.location = loc
        return e

    anchors = {"tope": empty("a_tope", tip), "bocadillo": empty("a_bocadillo", tip + Vector((0.0, 0.0, 0.2)))}
    return root, anchors


def render_buoy(S, out_dir, stats):
    rig.reset_scene()
    kit = Kit(S)
    root, anchors_obj = build_mascot_buoy()
    ring(kit, (0.0, 0.0), lambda t: 0.48, [(0.0, 0.08, "foam", 1.0, 0.006), (0.08, 0.3, "shallow", kit.S.SHALLOW_ALPHA, 0.004)],
         n=48, name="buoy_ring")
    scene, cam = setup(rig.RESOLUTION, rig.RESOLUTION, rig.PIVOT_PX)
    import mascota as MASC
    images = []
    for k in range(BUOY_FRAMES):
        root.matrix_world = MASC.bob_matrix(Vector((0.0, 0.0, 0.0)), k, BUOY_FRAMES, BUOY_K)
        bpy.context.view_layer.update()
        name = "idle_%d.png" % k
        render_to(scene, os.path.join(out_dir, name), stats)
        anc = {"pivot": list(rig.PIVOT_PX)}
        for n, e in anchors_obj.items():
            anc[n] = px(scene, cam, e.matrix_world.translation)
        images.append({"file": name, "frame": k, "animation": "idle", "anchors": anc})
    ts = [2 * math.pi * j / 24 for j in range(24)]
    R = 0.45 * BUOY_K                          # el aro flotador a ras de agua
    return {
        "kind": "sprite",
        "category": "boia",
        "image": {"width": rig.RESOLUTION, "height": rig.RESOLUTION, "format": "png", "mode": "RGBA", "transparent_border_px": 4},
        "pivot_px": list(rig.PIVOT_PX),
        "anchors": images[0]["anchors"],
        "anchors_doc": {
            "pivot": "centro del aro flotador a ras de agua; fijo en todos los fotogramas",
            "tope": "punta del gorro de la mascota",
            "bocadillo": "donde nace el bocadillo del diálogo del tutorial",
        },
        "anchors_on_art": ["pivot", "tope"],
        "footprint": {"shape": "polygon", "points_px": [px(scene, cam, G(math.cos(t) * R, math.sin(t) * R)) for t in ts],
                      "doc": "aro flotador a ras de agua, en px de la imagen"},
        "hitbox_hint": circle_hint(rig.PIVOT_PX, R, PPU),
        "proximity_hint": circle_hint(rig.PIVOT_PX, 2.6, PPU),
        "animations": {"idle": {"frames": BUOY_FRAMES, "fps": BUOY_FPS, "loop": True}},
        "images": images,
    }


# --- Rocas ------------------------------------------------------------------------
ROCKS = {
    "roca-a": {"seed": 5, "parts": [(0.0, 0.0, 0.62, 0.55, 0.72)]},
    "roca-b": {"seed": 9, "parts": [(0.0, -0.05, 0.62, 0.55, 0.9), (0.72, 0.35, 0.36, 0.34, 0.5), (-0.62, 0.42, 0.3, 0.28, 0.36)]},
}


def render_rock(S, rid, out_dir, stats):
    spec = ROCKS[rid]
    rig.reset_scene()
    kit = Kit(S)
    holdout_plane()
    wl = []
    for k, (sx, sy, rx, ry, h) in enumerate(spec["parts"]):
        rock(kit, G(sx, sy, 0.0), rx, ry, h, spec["seed"] * 10 + k, name="rock_%d" % k)
    # Huella: cruce con el agua de cada pieza (vértices en coordenadas del mundo), como función radial.
    for obj in [o for o in bpy.context.scene.objects if o.name.startswith("rock_")]:
        me = obj.data
        for e in me.edges:
            a, b = me.vertices[e.vertices[0]].co, me.vertices[e.vertices[1]].co
            if (a.z > 0) != (b.z > 0):
                t = a.z / (a.z - b.z)
                p = a + (b - a) * t
                wl.append((p.dot(RIGHT), p.dot(TOWARD)))
    n = 48
    radial = []
    for j in range(n):
        t = 2 * math.pi * j / n
        best = 0.0
        for x, y in wl:
            ang = math.atan2(y, x)
            d = abs((ang - t + math.pi) % (2 * math.pi) - math.pi)
            if d < math.pi / n * 1.6:
                best = max(best, math.hypot(x, y))
        radial.append(best)
    radial = [max(radial[(j + d) % n] for d in range(-2, 3)) for j in range(n)]          # cierra huecos entre piezas
    radial = [sum(radial[(j + d) % n] for d in range(-2, 3)) / 5.0 for j in range(n)]    # y suaviza
    fn = lambda t: radial[int(round(t / (2 * math.pi) * n)) % n]   # noqa: E731
    ring(kit, (0.0, 0.0), fn, [(-0.02, 0.07, "foam", 1.0, 0.006), (0.07, 0.3, "shallow", S.SHALLOW_ALPHA, 0.004)], n=n, name="rock_ring")
    w, h, pivot, (ytop, _) = fit_canvas(PPU)
    scene, cam = setup(w, h, pivot)
    render_to(scene, os.path.join(out_dir, "base.png"), stats)
    poly = [px(scene, cam, G(math.cos(2 * math.pi * j / n) * radial[j], math.sin(2 * math.pi * j / n) * radial[j])) for j in range(0, n, 2)]
    mean_r = sum(radial) / n
    return {
        "kind": "sprite",
        "category": "roca",
        "image": {"width": w, "height": h, "format": "png", "mode": "RGBA", "transparent_border_px": 4},
        "pivot_px": list(pivot),
        "anchors": {"pivot": list(pivot), "rotulo": [pivot[0], round(pivot[1] + ytop - 4.0, 2)]},
        "anchors_doc": {"pivot": "centro de la roca a ras de agua", "rotulo": "encima del punto más alto"},
        "anchors_on_art": ["pivot"],
        "footprint": {"shape": "polygon", "points_px": poly, "doc": "cruce de la roca con el agua, en px de la imagen"},
        "hitbox_hint": circle_hint(pivot, mean_r, PPU),
        "images": [{"file": "base.png", "frame": 0}],
    }


# --- Costas laterales -------------------------------------------------------------
COAST_TILE_W = 448
COAST_TILE_H = 512
COAST_SHORE_PX = 320           # la orilla media cae a esta distancia del borde de tierra
COAST = {
    "izquierda": {"land": -1, "seed": 31,
                  "shore": [(1, 0.26, 0.3), (2, 0.14, 2.1), (3, 0.08, 4.0), (5, 0.04, 1.2)],
                  "beach": [(1, 0.18, 1.7), (2, 0.1, 0.4)]},
    "derecha": {"land": 1, "seed": 47,
                "shore": [(1, 0.24, 2.4), (2, 0.16, 0.9), (4, 0.07, 3.1), (5, 0.04, 0.2)],
                "beach": [(1, 0.2, 5.0), (3, 0.08, 2.2)]},
}


def build_coast(kit, spec, L):
    """Franja de costa periódica en sy con periodo L; se construye en [-L, 2L] y se encuadra el tramo del medio."""
    # w: distancia desde la orilla media hacia el agua (negativa tierra adentro); u = -w.
    sgn = spec["land"]                              # -1: tierra a la izquierda
    per = lambda sy, harm: sum(a * math.sin(2 * math.pi * k * sy / L + ph) for k, a, ph in harm)   # noqa: E731
    u_shore = lambda sy: per(sy, spec["shore"])     # noqa: E731  (w de la orilla; positivo = entra en el agua)
    bwidth = lambda sy: 0.62 + per(sy, spec["beach"])   # noqa: E731
    plateau = 0.4
    u_far = COAST_SHORE_PX / PPU + 1.5              # tierra más allá del borde de la imagen
    rows = 288
    bm = bmesh.new()
    grid = []
    for i in range(rows + 1):
        sy = -L + 3 * L * i / rows
        us = u_shore(sy)
        ug = us - bwidth(sy)
        prof = [(-u_far, plateau), (ug - 1.2, plateau), (ug - 0.4, plateau), (ug, plateau), (ug + 0.07, 0.1),
                ((ug + 0.07 + us) / 2, 0.05), (us, 0.0), (us + 0.4, -0.18)]    # (w, z) de tierra a agua
        grid.append([bm.verts.new(G(_sx(sgn, w), sy, z)) for w, z in prof])
    seg_role = [0, 0, 0, 1, 2, 2, 2]
    for i in range(rows):
        a, b = grid[i], grid[i + 1]
        for k in range(len(a) - 1):
            face_up(bm, (a[k], a[k + 1], b[k + 1], b[k]), seg_role[k])
    kit.obj("coast_terrain", bm, ["grass", "cliff", "sand"], recalc=False)
    # Espuma y agua somera: tiras que siguen la orilla.
    for k, (d0, d1, role, alpha, z) in enumerate([(-0.03, 0.1, "foam", 1.0, 0.006), (0.1, 0.55, "shallow", kit.S.SHALLOW_ALPHA, 0.004)]):
        bm = bmesh.new()
        prev = None
        for i in range(rows + 1):
            sy = -L + 3 * L * i / rows
            us = u_shore(sy)
            cur = (bm.verts.new(G(_sx(sgn, us + d0), sy, z)), bm.verts.new(G(_sx(sgn, us + d1), sy, z)))
            if prev:
                face_up(bm, (prev[0], prev[1], cur[1], cur[0]))
            prev = cur
        kit.obj("coast_%s" % role, bm, [kit.flat(role, alpha)], outline=False, recalc=False)
    # Decoración periódica: cada pieza en sy, sy - L y sy + L.
    rng = random.Random(spec["seed"])
    u_edge = COAST_SHORE_PX / PPU
    items = []
    for j in range(6):
        sy = L * (j + rng.uniform(0.1, 0.9)) / 6
        kind = "pine" if j % 3 != 2 else "bush"
        u_min = -u_shore(sy) + bwidth(sy) + 0.45
        u = rng.uniform(u_min, u_edge - 0.95) if u_edge - 0.95 > u_min else u_min
        items.append((kind, u, sy, rng.uniform(1.0, 1.5), rng.randrange(1 << 30)))
    for j in range(2):
        sy = L * (j * 0.5 + rng.uniform(0.1, 0.4))
        items.append(("rock", -u_shore(sy) + 0.12, sy, rng.uniform(0.18, 0.26), rng.randrange(1 << 30)))
    for rep in (-1, 0, 1):
        for n, (kind, u, sy, size, seed) in enumerate(items):
            y = sy + rep * L
            nm = "%s_%d_%d" % (kind, n, rep + 1)
            if kind == "pine":
                pine(kit, G(_sx(sgn, -u), y, plateau - 0.03), size, (-sgn * 0.14 * RIGHT.x, -sgn * 0.14 * RIGHT.y), seed, name=nm)
            elif kind == "bush":
                bush(kit, G(_sx(sgn, -u), y, plateau - 0.02), 0.3, seed, name=nm)
            else:
                rock(kit, G(_sx(sgn, -u), y, 0.0), size, size * 0.85, size, seed, name=nm)
    return u_shore, plateau


def _sx(sgn, w):
    """w: distancia desde la orilla media hacia el agua; sgn -1 = tierra a la izquierda (agua hacia +sx)."""
    return -sgn * w


def render_coast(S, out_dir, stats):
    L = COAST_TILE_H / (PPU * math.sin(math.radians(rig.CAMERA_ELEVATION_DEG)))
    variants = {}
    images = []
    for name, spec in COAST.items():
        rig.reset_scene()
        kit = Kit(S)
        holdout_plane()
        u_shore, plateau = build_coast(kit, spec, L)
        land_left = spec["land"] < 0
        pivot = (float(COAST_SHORE_PX if land_left else COAST_TILE_W - COAST_SHORE_PX), 0.0)
        scene, cam = setup(COAST_TILE_W, COAST_TILE_H, pivot)
        render_to(scene, os.path.join(out_dir, name + ".png"), stats)
        img = bpy.data.images.load(os.path.join(out_dir, name + ".png"))
        pxs = np.array(img.pixels[:]).reshape(COAST_TILE_H, COAST_TILE_W, 4)
        col = 0 if land_left else COAST_TILE_W - 1
        vals, counts = np.unique(np.round(pxs[:, col, :3] * 255).astype(int), axis=0, return_counts=True)
        fill = vals[int(np.argmax(counts))]
        bpy.data.images.remove(img)
        # Orilla en px de la imagen, muestreada a lo largo de un periodo.
        ws = [u_shore(L * i / 256.0) for i in range(256)]
        xs = [round(pivot[0] + _sx(spec["land"], w) * PPU, 2) for w in ws]
        foam = 0.1 * PPU
        variants[name] = {
            "file": name + ".png",
            "land_side": "left" if land_left else "right",
            "shore_x_px": {"mean": round(sum(xs) / len(xs), 2), "min": min(xs), "max": max(xs)},
            "collision_x_px": round(max(xs) + foam, 2) if land_left else round(min(xs) - foam, 2),
            "outer_fill": "#%02X%02X%02X" % tuple(int(v) for v in fill),
        }
        images.append({"file": name + ".png", "frame": 0, "variant": name})
    return {
        "kind": "tile",
        "category": "costa",
        "image": {"width": COAST_TILE_W, "height": COAST_TILE_H, "format": "png", "mode": "RGBA", "transparent_border_px": 0},
        "tile": {
            "axis": "y", "period_px": COAST_TILE_H, "period_units": round(L, 4),
            "doc": "se repite en vertical sin costura; el lado de tierra llega opaco al borde y más allá se "
                   "rellena con outer_fill; el lado del agua es transparente. collision_x_px: donde tiene que "
                   "pararse el casco (orilla más saliente + espuma).",
            "variants": variants,
        },
        "anchors_doc": {},
        "images": images,
    }


# --- Planeta de la entrada ----------------------------------------------------------
PLANET_R = 25.0                 # radio del globo; la isla de evento (≈5) cabe en su polo
GLOBE_PX = 1024
GLOBE_DISC_PX = 896
BAND_W, BAND_H = 2048, 768
BAND_POLE_PX = (1024.0, 300.0)
BAND_PPU = PPU / 2.0
MARK_PPU = PPU / 2.0
CLOUDS = [(-0.62, 0.32, 1.25, 1), (0.55, 0.52, 1.0, 2), (0.7, -0.18, 1.35, 3), (-0.35, -0.45, 1.15, 4),
          (0.12, -0.72, 0.95, 5), (-0.8, -0.12, 0.9, 6), (0.35, 0.1, 0.8, 7)]


def build_planet(kit):
    S = kit.S
    center = Vector((0.0, 0.0, -PLANET_R))           # el polo norte es el origen del mundo: ahí va la isla
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=6, radius=PLANET_R, matrix=Matrix.Translation(center))

    def mask(nt):
        tc = nt.nodes.new("ShaderNodeTexCoord")
        sub = nt.nodes.new("ShaderNodeVectorMath")
        sub.operation = "SUBTRACT"
        sub.inputs[1].default_value = center
        nt.links.new(tc.outputs["Object"], sub.inputs[0])
        sc = nt.nodes.new("ShaderNodeVectorMath")
        sc.operation = "SCALE"
        sc.inputs["Scale"].default_value = 1.0 / PLANET_R
        nt.links.new(sub.outputs["Vector"], sc.inputs[0])
        off = nt.nodes.new("ShaderNodeVectorMath")
        off.operation = "ADD"
        off.inputs[1].default_value = (3.7, 1.3, -2.1)
        nt.links.new(sc.outputs["Vector"], off.inputs[0])
        noise = nt.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 1.6
        noise.inputs["Detail"].default_value = 3.0
        noise.inputs["Roughness"].default_value = 0.55
        nt.links.new(off.outputs["Vector"], noise.inputs["Vector"])
        land = nt.nodes.new("ShaderNodeMath")
        land.operation = "GREATER_THAN"
        land.inputs[1].default_value = 0.57
        nt.links.new(noise.outputs["Fac"], land.inputs[0])
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(sc.outputs["Vector"], sep.inputs[0])
        cap = nt.nodes.new("ShaderNodeMath")
        cap.operation = "LESS_THAN"
        cap.inputs[1].default_value = 0.8               # sin tierra alrededor del polo: allí sólo está la isla de evento
        nt.links.new(sep.outputs["Z"], cap.inputs[0])
        both = nt.nodes.new("ShaderNodeMath")
        both.operation = "MULTIPLY"
        nt.links.new(land.outputs["Value"], both.inputs[0])
        nt.links.new(cap.outputs["Value"], both.inputs[1])
        return both.outputs["Value"]

    mat = S.masked_material("globe", S.PALETTE["ocean"], S.PALETTE["land"], mask)
    globe = kit.obj("globe", bm, [mat])
    # Nubes: se colocan por su posición en el disco (u, v en [-1, 1]); nunca sobre el polo.
    up = rig.camera_up()
    clouds = []
    rng = random.Random(3)
    for k, (u, v, size, seed) in enumerate(CLOUDS):
        wv = math.sqrt(max(0.0, 1 - u * u - v * v))
        n = (RIGHT * u + up * v - _FORWARD * wv).normalized()
        p = center + n * (PLANET_R + 1.3)
        t1 = n.cross(UP)
        t1 = t1.normalized() if t1.length > 1e-6 else RIGHT.copy()
        t2 = n.cross(t1).normalized()
        bm = bmesh.new()
        for j in range(5):
            a = (j - 2) * 0.9 * size + rng.uniform(-0.2, 0.2)
            r = size * (1.25 - 0.18 * abs(j - 2)) * rng.uniform(0.85, 1.1)
            c = p + t1 * a + t2 * rng.uniform(-0.3, 0.3) * size + n * r * 0.2
            m = Matrix.Translation(c) @ n.to_track_quat("Z", "Y").to_matrix().to_4x4() @ Matrix.Diagonal((r, r, r * 0.55, 1.0))
            bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0, matrix=m)
        clouds.append(kit.obj("cloud_%d" % k, bm, [kit.toon("cloud")]))
    return globe, clouds, center


def _set_outline(objs, width):
    for o in objs:
        mod = o.modifiers.get("outline")
        if mod:
            mod.thickness = width


def render_planet(S, out_dir, stats):
    layers = []
    images = []
    # Globo, nubes y banda de mar: la misma escena con tres encuadres.
    rig.reset_scene()
    kit = Kit(S)
    globe, clouds, center = build_planet(kit)
    globe_ppu = GLOBE_DISC_PX / (2 * PLANET_R)
    scene, cam = setup(GLOBE_PX, GLOBE_PX, (GLOBE_PX / 2.0, GLOBE_PX / 2.0), ppu=globe_ppu, origin=center)
    out_w = 2.4 / globe_ppu                         # contorno de ≈2,4 px a cualquier escala
    _set_outline([globe] + clouds, out_w)
    pole = px(scene, cam, (0.0, 0.0, 0.0))
    for c in clouds:
        c.hide_render = True
    render_to(scene, os.path.join(out_dir, "globo.png"), stats)
    for c in clouds:
        c.hide_render = False
    hold = bpy.data.materials.new("globe_holdout")
    hold.use_nodes = True
    hold.node_tree.nodes.clear()
    hn = hold.node_tree.nodes.new("ShaderNodeHoldout")
    ho = hold.node_tree.nodes.new("ShaderNodeOutputMaterial")
    hold.node_tree.links.new(hn.outputs["Holdout"], ho.inputs["Surface"])
    saved = list(globe.data.materials)
    for i in range(len(saved)):
        globe.data.materials[i] = hold
    render_to(scene, os.path.join(out_dir, "nubes.png"), stats)
    for i, m in enumerate(saved):
        globe.data.materials[i] = m
    common = {"width": GLOBE_PX, "height": GLOBE_PX, "pixels_per_unit": round(globe_ppu, 4), "transparent_border_px": 4}
    g_anchors = {"centro": [GLOBE_PX / 2.0, GLOBE_PX / 2.0], "polo": pole}
    layers.append(dict(id="globo", file="globo.png", order=0, radius_px=GLOBE_DISC_PX / 2.0, anchors=g_anchors,
                       anchors_on_art=["centro", "polo"], **common))
    layers.append(dict(id="nubes", file="nubes.png", order=1, anchors=dict(g_anchors), anchors_on_art=[],
                       clear_around={"anchor": "polo", "radius_px": 40.0}, **common))
    # Banda de mar: el mismo globo de cerca, centrado en el polo; arriba se ve la curvatura.
    for c in clouds:
        c.hide_render = True
    scene, cam = setup(BAND_W, BAND_H, BAND_POLE_PX, ppu=BAND_PPU)
    _set_outline([globe], 2.4 / BAND_PPU)
    render_to(scene, os.path.join(out_dir, "banda-mar.png"), stats)
    up = rig.camera_up()
    limb = center + up * PLANET_R                   # en ortográfica, el borde más alto del disco
    band_anchors = {"polo": [BAND_POLE_PX[0], BAND_POLE_PX[1]], "horizonte": px(scene, cam, limb)}
    layers.append(dict(id="banda-mar", file="banda-mar.png", order=2, width=BAND_W, height=BAND_H, transparent_border_px=0,
                       pixels_per_unit=round(BAND_PPU, 4), anchors=band_anchors, anchors_on_art=["polo"]))
    # Isla: la isla de evento a media escala, con contorno más grueso para leerse pequeña.
    r = render_island(S, "isla-evento", out_dir, stats, ppu=MARK_PPU, outline_scale=2.0, file_name="isla.png")
    layers.append(dict(id="isla", file="isla.png", order=3, width=r["width"], height=r["height"], transparent_border_px=4,
                       pixels_per_unit=round(MARK_PPU, 4), anchors={"pivot": list(r["pivot"])}, anchors_on_art=["pivot"],
                       matches="isla-evento", place_on={"globo": "polo", "banda-mar": "polo"}))
    for layer in layers:
        images.append({"file": layer["file"], "frame": 0, "layer": layer["id"]})
    return {
        "kind": "layers",
        "category": "planeta",
        "layers": layers,
        "layers_doc": (
            "Capas 2D de la entrada (v14 §4.4), renderizadas con la cámara del juego (30°, 45°). El globo tiene "
            "el polo norte en el origen del mundo: ahí se apoya la isla de evento, que desde 30° se ve 2:1 como en "
            "el juego. `isla` se coloca con su pivot sobre el ancla `polo` de `globo` o de `banda-mar`, escalada "
            "por pixels_per_unit de la capa destino / pixels_per_unit de `isla`; a pixels_per_unit del juego "
            "(la del barco) se sustituye por el sprite de isla-evento. `nubes` comparte lienzo con `globo`. "
            "`banda-mar` es el mismo globo de cerca: la curvatura arriba cede al mar plano."
        ),
        "anchors_doc": {
            "centro": "centro del disco del globo",
            "polo": "punto del globo (o de la banda) donde se apoya la isla de evento",
            "horizonte": "punto más alto del borde del planeta en la banda",
            "pivot": "pivote de la isla (el mismo punto que el pivot de isla-evento)",
        },
        "images": images,
    }

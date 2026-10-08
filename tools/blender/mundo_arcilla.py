"""Mundo de arcilla (B05): el arte de juego de cada lugar del mapa compartido. MUESTRA.

Las piezas salen de mundos/arcilla (escena.py, piezas.py, zonas/*.py) con el tema
de arcilla de mundos/temas.py, a la hora «día» (la luz del estudio del barco
B05). Cada zona se construye una vez en su propia escena y cada pieza del
manifiesto es un subconjunto de sus objetos (por nombre «<zona>__<pieza>__<n>» y
distancia en el mapa). Lo que no está en la maqueta se construye aquí con las
mismas piezas: la Isla del Faro y la del Cañón (D-20), las losas de costa y sus
esquinas, y los fotogramas de los cocodrilos, del delfín y del remolino.

Todas las boias son la mascota de BOIA (T39, mascota.py) pintada con el tema del
mundo: la Boia Fiestera (pidiendo ayuda y a bordo, slot TRIPULANTE) y, en los
extras de lugares.json, `boias` (la primera, la de WhatsApp y las cinco
informativas, con reposo y habla) y `secreto` (el marcador de los secretos).
El mundo de acuarela reutiliza estas mismas piezas (mundo_acuarela.py).

Ver mundos_arte.py para el contrato y tools/blender/lugares.json para los ids.
"""
import importlib.util
import math
import os
import random
import sys

import bpy
from mathutils import Matrix, Vector

import lugares as LG
import mascota as MASC
import mundos_arte as MA
import world

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
ARC = os.path.join(REPO, "mundos", "arcilla")
for _p in (os.path.join(REPO, "mundos"), ARC, os.path.join(ARC, "herramientas")):
    if _p not in sys.path:
        sys.path.insert(0, _p)
import mapa as MAPA  # noqa: E402
import piezas as P  # noqa: E402
import temas  # noqa: E402

MASC.register(temas.Arcilla.HEX)          # papeles de la mascota de BOIA (naranja, gorro azul marino, verde de chat)


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


escena = _load("arcilla_escena", os.path.join(ARC, "escena.py"))

# Reproducibilidad. En las superelipses casi cuadradas (exponentes 5–8), recalc_face_normals elige hacia qué
# lado mira cada grupo de caras con una cuenta que queda al filo (la cara más lejana del centro tiene la normal
# casi perpendicular al radio): de una sesión de Blender a otra el grupo sale del revés, cambian las normales y
# los bordes vivos, y con ellos algunos píxeles (±1). Builder.mk se sustituye por una copia que, después de
# recalc, orienta cada grupo de caras conexas por el signo de su volumen (estable) y, si es plano, por su
# normal media. Se hace aquí para no tocar mundos/arcilla/escena.py: la maqueta sigue igual.
def orient_groups(bm):
    parent = {f.index: f.index for f in bm.faces}

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    bm.faces.ensure_lookup_table()
    for e in bm.edges:
        lf = e.link_faces
        if len(lf) == 2:
            a, b = find(lf[0].index), find(lf[1].index)
            if a != b:
                parent[max(a, b)] = min(a, b)
    groups = {}
    for f in bm.faces:
        groups.setdefault(find(f.index), []).append(f)
    flip = []
    for faces in groups.values():
        area = sum(f.calc_area() for f in faces) or 1.0
        c = sum((f.calc_center_median() * f.calc_area() for f in faces), Vector()) / area
        vol = sum((f.calc_center_median() - c).dot(f.normal) * f.calc_area() for f in faces)
        if abs(vol) < 1e-9 * area:
            nsum = sum((f.normal * f.calc_area() for f in faces), Vector())
            vol = nsum.z if abs(nsum.z) > 1e-9 else (nsum.x + nsum.y)
        if vol < 0:
            flip += faces
    if flip:
        import bmesh
        bmesh.ops.reverse_faces(bm, faces=flip)


def canonical(bm):
    """Triangula por la diagonal más corta, orienta y ordena vértices y caras por posición: el mismo mallado
    sale igual en cualquier sesión aunque bmesh cree las caras en otro orden o empezando por otro vértice
    (create_uvsphere lo hace), y el render no depende de qué diagonal elige Blender para cada cuadrilátero."""
    import bmesh
    bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method="SHORT_EDGE", ngon_method="BEAUTY")
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.faces.index_update()
    orient_groups(bm)
    bm.verts.index_update()
    order = sorted(bm.verts, key=lambda v: (round(v.co.x, 6), round(v.co.y, 6), round(v.co.z, 6), v.index))
    rank = {v.index: r for r, v in enumerate(order)}
    bm.verts.sort(key=lambda v: rank[v.index])          # sort() sólo acepta claves numéricas
    bm.verts.index_update()
    bm.faces.index_update()
    order = sorted(bm.faces, key=lambda f: (sorted(v.index for v in f.verts), f.index))
    rank = {f.index: r for r, f in enumerate(order)}
    bm.faces.sort(key=lambda f: rank[f.index])
    bm.faces.index_update()
    bm.normal_update()


def _mk_det(self, bm, role, sharp=40, smooth=True):
    canonical(bm)
    for f in bm.faces:
        f.smooth = smooth
    lim = math.radians(sharp)
    for e in bm.edges:
        e.smooth = not (len(e.link_faces) == 2 and e.calc_face_angle(0.0) > lim)
    name = self.next_name()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(self.tema.material(role))
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = self.root
    self.tema.decorate(obj, role)
    return obj


escena.Builder.mk = _mk_det

ID, STYLE, SHIP = "arcilla", "arcilla", "B05"
HORA = "dia"
M = MAPA.load()
CAT = LG.load_catalog()
ENTRY = LG.by_id(CAT)
Z = {z["id"]: z for z in M["zonas"]}
C = M["circuito"]
MJ = {m["id"]: m for m in M["minijuegos"]}
COSTA = {c["id"]: c for c in M["costas"]}
UP = Vector((0, 0, 1))
PPU = MA.PPU

# Losas de costa. La esquina de abajo a la izquierda cubre x ∈ [-20,12; -8,70] e y ∈ [14,75; 32,35] del
# mapa; las losas se alinean con sus bordes: la de la costa oeste (y la este) empieza en y = 14,75 - L_OESTE
# y se repite cada L_OESTE; la del paseo empieza en x = -8,70 y se repite cada L_SUR.
TILE_W, TILE_H = 640, 768                     # costas laterales
SUR_W, SUR_H = 768, 288                       # paseo (borde de abajo)
L_OESTE = TILE_H * 2.0 / PPU                  # periodo en y (u_maq): el agua se ve a la mitad en vertical
L_SUR = SUR_W / PPU                           # periodo en x
SUR_PIVOT = (0.0, 96.0)                       # (x0, 27,8) cae aquí: 96 px de agua sobre la orilla (farolas)
X_SUR = -L_SUR                                # fase del paseo: una losa empieza en x = -8,70
ESQ_W, ESQ_H = 1008, 768
ESQ_PIVOT_X = 452.0                           # (-15, 27,8) en la esquina oeste; la este es su espejo
ESQ_PIVOT_Y = ESQ_H - (SUR_H - SUR_PIVOT[1])  # el borde de abajo coincide con el de la losa del paseo
Y_ESQ = 27.8 - ESQ_PIVOT_Y / (PPU * 0.5)      # borde de arriba de la esquina en el mapa (14,75)
Y_OESTE = Y_ESQ - L_OESTE                     # fase de las costas laterales
TILE_PIVOT_X = 441.0                          # la línea x = ∓15 de mapa.json cae aquí (borde de tierra en ∓20)


# --- Escenas ------------------------------------------------------------------------
def new_context(group):
    """Escena nueva para un grupo: `zona:<id>[@variante]`, `vacio`, `aire` (sin agua), `minijuego:<id>`, `costa:<id>`."""
    tema = TemaJuego()
    scene = tema.setup(256, 256)
    scene.render.film_transparent = True
    ctx = MA.Ctx(scene, group)
    root = bpy.data.objects.new("mundo_root", None)
    scene.collection.objects.link(root)
    ctx.tema, ctx.root = tema, root
    ctx.B = escena.Builder(tema, temas.A, M, root)
    kind, _, arg = group.partition(":")
    if kind != "aire":
        world.holdout_plane()
    GROUPS[kind](ctx, arg)
    return ctx


class TemaJuego(temas.Arcilla):
    """El tema de arcilla sin dispersión subsuperficial. La pasada de SSS de Eevee no es determinista: dos renders
    de la misma escena difieren en ±1 en algunos píxeles (sobre todo en la espuma). Sin ella el arte sale igual
    byte a byte; la diferencia de aspecto es de unos 4 niveles de media y no se aprecia a escala de juego."""

    def make(self, role):
        mat = super().make(role)
        for n in mat.node_tree.nodes:
            if n.type == "BSDF_PRINCIPLED":
                n.inputs["Subsurface Weight"].default_value = 0.0
        return mat


def set_light(ctx):
    ctx.tema.hora(ctx.scene, ctx.B, HORA)
    ctx.scene.render.film_transparent = True


def g_zona(ctx, arg):
    zid, _, var = arg.partition("@")
    B = ctx.B
    B.variante = var or "venta"
    with B.zona(zid):
        escena.load_zone(zid).build(B, Z[zid], M)
    if zid == "puerto":
        # El paseo de la maqueta ocupa todo el borde de abajo: aquí sólo su tramo central, bajo el puerto.
        # El resto lo ponen las losas de costa_sur.
        s = next(i for i in Z["puerto"]["islas"] if i["id"] == "paseo")
        with B.zona("arte"), B.pieza("paseo"):
            B.land(0.0, s["centro"][1], PASEO_A, s["b"], s["alto"], -0.2, g=0, p=8.0, q=6.0, role=s["rol"])
            # las losas del paseo (como en sur()) y dos casitas detrás del muelle
            B.blob("stone", (PASEO_A - 0.25, 0.42, 0.06), B.at(0.0, 28.45, B.gz(0.0, 28.45) + 0.01), 8.0, 4.0,
                   extra=B.rz(0), segs=96, rings=8)
            for x, y, w, lit in ((-5.2, 30.2, 0.5, False), (5.3, 30.0, 0.55, True)):
                PUERTO_Z.casita(B, x, y, w, 0.45, 0.5, lit=lit)


PASEO_A = 6.4


def g_vacio(ctx, arg):
    pass


GROUPS = {"zona": g_zona, "vacio": g_vacio, "aire": g_vacio}


# --- Selección --------------------------------------------------------------------
def center(o):
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    return sum(pts, Vector()) / 8.0


def pick(ctx, zid, pieces=None, near=None, r=None, zmax=None, skip_roles=()):
    out = []
    for o in ctx.scene.objects:
        if o.type != "MESH":
            continue
        s = o.name.split("__")
        if len(s) < 3 or s[0] != zid or (pieces and s[1] not in pieces):
            continue
        if skip_roles and o.data.materials and o.data.materials[0].name.split(".")[0] in skip_roles:
            continue
        if near is not None or zmax is not None:
            c = center(o)
            if near is not None and math.dist(MA.from_b(c), near) > r:
                continue
            if zmax is not None and c.z > zmax:
                continue
        out.append(o)
    return out


def role_of(o):
    return o.data.materials[0].name.split(".")[0] if o.data.materials else ""


def outline(isla, n=40):
    return [MA.to_b(x, y, 0.0) for x, y in MAPA.outline(isla, n)]


def circle(c, r, n=24):
    return [MA.to_b(c[0] + r * math.cos(2 * math.pi * k / n), c[1] + r * math.sin(2 * math.pi * k / n), 0.0)
            for k in range(n)]


def lugar(zid, lid):
    return next(lg["pos"] for lg in Z[zid]["lugares"] if lg["id"] == lid)


def isla(zid, iid="isla"):
    return next(i for i in Z[zid]["islas"] if i["id"] == iid)


def prox(zid, obj):
    return next(p["radio"] for p in Z[zid].get("proximidad", []) if p["objeto"] == obj)


def ground(ctx, x, y, dz=0.0):
    return ctx.B.on(x, y, dz)


def top_point(objs, xy):
    pts = MA.world_points(objs, clip=True)
    return MA.to_b(xy[0], xy[1], float(pts[:, 2].max()) + 0.05)


def lugares_anchors(zid, near=None, r=None, skip=()):
    def f(ctx):
        out = {}
        for lg in Z[zid]["lugares"]:
            if lg["id"] in skip or (near and math.dist(lg["pos"], near) > r):
                continue
            out[lg["id"]] = ground(ctx, *lg["pos"])
        return out
    return f


def static(fn, file=None):
    """Una sola imagen; sin nombre, la pieza la llama <id>.png."""
    return [{"file": file, "frame": 0, "setup": fn}]


# --- Piezas de lugar ------------------------------------------------------------------
def part(pid, role, collision, group, map_pos, images, **kw):
    for im in images:
        if im["file"] is None:
            im["file"] = pid + ".png"
    d = dict(id=pid, role=role, collision=collision, group=group, map_pos=map_pos, images=images)
    d.update(kw)
    return d


def island_part(zid, pid=None, images=None, prox_obj="isla", **kw):
    s = isla(zid)
    return part(pid or zid, "isla", "bloquear", "zona:" + zid, tuple(s["centro"]),
                images or static(lambda ctx: pick(ctx, zid)),
                anchors=lugares_anchors(zid), rotulo=True, footprint=lambda ctx: outline(s),
                prox_units=prox(zid, prox_obj), **kw)


def place(pid, parts, name=None, shared=False):
    e = ENTRY[pid]
    pos = LG.point(LG.resolve(M, e["pos"]))
    for p in parts:
        if p.get("map_pos") is not None:
            p["offset_units"] = [round(p["map_pos"][0] - pos[0], 4), round(p["map_pos"][1] - pos[1], 4)]
    pl = {"ref": e["ref"], "pos": pos, "event_island": bool(e.get("isla_evento")),
          "name": name, "shared_name": bool(e.get("isla_evento")) or shared,
          "catalog": "tools/blender/lugares.json"}
    if e.get("instancias"):
        pl["instances"] = LG.instances(M, e)
    return {"id": pid, "category": e["categoria"], "place": pl, "parts": parts}


# --- Puerto ---------------------------------------------------------------------------
def p_puerto():
    zid, g = "puerto", "zona:puerto"
    esc = {i["id"]: i for i in Z[zid]["islas"]}
    paseo = dict(esc["paseo"], a=PASEO_A, p=8.0)
    bx, by = lugar(zid, "boia")
    wx, wy = lugar(zid, "whatsapp")
    sx, sy = lugar(zid, "salida")

    def base(ctx):
        return (pick(ctx, zid, {"muelle", "caseta", "norays", "redes", "guardamuelle"})
                + pick(ctx, zid, {"farolas"}, near=(0.0, 28.25), r=7.0)
                + pick(ctx, zid, {"gaviotas"}, zmax=1.0) + pick(ctx, "arte", {"paseo"}))

    def muelle(ctx):
        return {"caseta": ground(ctx, *lugar(zid, "caseta")), "muelle": MA.to_b(-1.85, 25.45, 0.24)}

    parts = [
        part("puerto", "puerto", "bloquear", g, (0.0, 30.6), static(base), anchors=muelle, rotulo=True,
             footprint=lambda ctx: outline(paseo), doc="paseo central, muelle, caseta y norays; a los lados siguen "
             "las losas de costa_sur"),
    ]
    for side, iid in ((-1, "escollera_oeste"), (1, "escollera_este")):
        s = esc[iid]
        parts.append(part(iid, "isla", "bloquear", g, tuple(s["centro"]),
                          static(lambda ctx, c=s["centro"]: pick(ctx, zid, {"escolleras"}, near=c, r=3.4)),
                          footprint=lambda ctx, s=s: outline(dict(s, p=2.0))))
    for pid, pos in (("baliza_verde", (-2.6, 22.4)), ("baliza_roja", (2.6, 22.4))):
        parts.append(part(pid, "objeto", "bloquear", g, pos,
                          static(lambda ctx, pos=pos: pick(ctx, zid, {"balizas"}, near=pos, r=0.6)),
                          footprint=lambda ctx, pos=pos: circle(pos, 0.22), anchors=lambda ctx, pos=pos: {
                              "luz": MA.to_b(pos[0], pos[1], 1.05)}))
    parts += [
        part("anillo", "spawn", "ninguna", g, (sx, sy), static(lambda ctx: pick(ctx, zid, {"anillo"})),
             doc="anillo de salida (SPAWN/RESPAWN): el barco aparece en su centro"),
        part("boia", "personaje", "bloquear", g, (bx, by), static(lambda ctx: pick(ctx, zid, {"boia"})),
             footprint=lambda ctx: circle((bx, by), 0.55), prox_units=prox(zid, "boia"),
             anchors=lambda ctx: {"tope": MA.to_b(bx, by, 0.56 * 1.9)}),
        part("bocadillo", "decoracion", "ninguna", g, (bx + 0.55, by), static(lambda ctx: pick(ctx, zid, {"bocadillo"})),
             doc="bocadillo de arcilla que flota sobre la boia de la entrada; el pivote es el punto del agua bajo él"),
        part("whatsapp", "personaje", "bloquear", g, (wx, wy), static(lambda ctx: pick(ctx, zid, {"whatsapp"})),
             footprint=lambda ctx: circle((wx, wy), 0.32), prox_units=prox(zid, "whatsapp"),
             anchors=lambda ctx: {"tope": MA.to_b(wx, wy, 0.95)}),
    ]
    return place("puerto", parts, name=Z[zid]["propuesta_nombre"])


# --- Islas -----------------------------------------------------------------------------
def p_isla(zid):
    return place(zid, [island_part(zid)], name=Z[zid]["propuesta_nombre"])


def p_allday():
    zid = "allday"
    imgs = [{"file": "venta.png", "frame": 0, "variant": "venta", "group": "zona:allday",
             "setup": lambda ctx: pick(ctx, zid)},
            {"file": "recuerdo.png", "frame": 0, "variant": "recuerdo", "group": "zona:allday@recuerdo",
             "setup": lambda ctx: pick(ctx, zid)}]
    pa = island_part(zid, images=imgs, doc="variantes del evento (REQ-COM-005): «venta» con taquilla abierta y "
                     "«recuerdo» con la taquilla cerrada")
    return place(zid, [pa], name=Z[zid]["nombre"])


# --- Encuentro de la Boia Fiestera ---------------------------------------------------------
# El corro de fiestera.py (ángulo desde ella en el mapa, radio, k): los cuatro cocodrilos miran hacia ella.
CORRO = ((168, 1.65, 1.15), (238, 1.55, 1.05), (305, 1.7, 1.1), (28, 1.95, 1.0))
CROC_SUB = -0.035
DIVE_FRAMES = 6
IDLE_FRAMES = 4


def croc_frame(ctx, key, x, y, g, k, sub, extra_ripple=None, bubbles=0, seed=0, zone="fiestera"):
    B = ctx.B
    root = MA.fresh(ctx, key)
    B.root, B.rng = root, random.Random(seed)
    with B.zona(zone), B.pieza("cocodrilo"):
        B.rng = random.Random(seed)
        P.croc(B, x, y, g=g, k=k, sub=sub)
        if extra_ripple:
            P.ripple(B, x, y, extra_ripple, 1, t=0.022)
        if bubbles:
            P.bubbles(B, x, y, n=bubbles, spread=0.3 * k)
    B.root = ctx.root
    return MA.fresh_collect(ctx, key, root)


def croc_images(key, x, y, g, k, zone="fiestera"):
    imgs = []
    for f in range(IDLE_FRAMES):
        sub = CROC_SUB + 0.014 * math.sin(2 * math.pi * f / IDLE_FRAMES)
        imgs.append({"file": "%s_idle_%d.png" % (key, f), "frame": f, "animation": "idle",
                     "setup": lambda ctx, sub=sub: croc_frame(ctx, key, x, y, g, k, sub, zone=zone)})
    for f in range(DIVE_FRAMES):
        t = f / (DIVE_FRAMES - 1)
        sub = CROC_SUB + 0.32 * t ** 1.8
        imgs.append({"file": "%s_sumergirse_%d.png" % (key, f), "frame": f, "animation": "sumergirse",
                     "setup": lambda ctx, sub=sub, t=t, f=f: croc_frame(
                         ctx, key, x, y, g, k, sub, extra_ripple=(0.35 + 0.5 * t) * k if f else None,
                         bubbles=int(round(8 * t)), seed=31 * f + 7, zone=zone)})
    return imgs


CROC_ANIMS = {"idle": {"frames": IDLE_FRAMES, "fps": 6, "loop": True},
              "sumergirse": {"frames": DIVE_FRAMES, "fps": 10, "loop": False},
              "emerger": {"frames": DIVE_FRAMES, "fps": 10, "loop": False, "reverse_of": "sumergirse"}}


# --- La mascota de BOIA: todas las boias (T39) ------------------------------------------------
# Mundos cuyas boias llevan el contorno de tinta del logo como casco invertido (T231, mascota.outline_parts); la
# acuarela ya dibuja la línea de su estilo.
OUTLINE_THEMES = ("arcilla",)


def mascot_frame(ctx, key, pos, k, variant, mouth, f, n, info=0, balloons=True, water=True, motion=None):
    """Construye la boia-mascota (mascota.py) para un fotograma: en `pos` del mapa (o en el origen si None),
    con el balanceo del fotograma f de n (o `motion(base)`, una matriz) y, si `water`, su onda de flotación
    quieta en el agua. Guarda la punta del gorro en ctx.data[key + '_tip']. Devuelve las mallas."""
    B = ctx.B
    base = MA.to_b(pos[0], pos[1], 0.0) if pos else Vector((0.0, 0.0, 0.0))
    root = MA.fresh(ctx, key)
    B.root = root
    with B.zona("mascota"), B.pieza(key):
        tip = MASC.mascota(B, base, k=k, g=90.0, variant=variant, mouth=mouth, info=info, with_balloons=balloons,
                           outline=B.tema.id in OUTLINE_THEMES)
    B.root = ctx.root
    objs = MA.fresh_collect(ctx, key, root)
    m = motion(base) if motion else MASC.bob_matrix(base, f, n, k)
    root.matrix_world = m
    ctx.data[key + "_tip"] = m @ tip
    if water:
        wroot = MA.fresh(ctx, key + "_agua")
        B.root = wroot
        with B.zona("mascota"), B.pieza(key + "_agua"):
            R = 0.46 * k
            for i in range(2):
                rr = R * (1 + 0.35 * i) * (1.0 + 0.06 * math.sin(2 * math.pi * f / n + i))
                B.torus("foam", 1.0, 0.022 * k / rr, Matrix.Translation(base + Vector((0, 0, 0.025))) @
                        Matrix.Diagonal((rr, rr, rr * 0.5, 1)), nu=40, nv=6)
        B.root = ctx.root
        objs += MA.fresh_collect(ctx, key + "_agua", wroot)
    bpy.context.view_layer.update()
    return [o for o in objs if o.type == "MESH"]


IDLE_N, TALK_N = 6, 2
MASCOT_ANIMS = {"idle": {"frames": IDLE_N, "fps": 6, "loop": True},
                "habla": {"frames": TALK_N, "fps": 6, "loop": True}}


def mascot_images(key, pos, k, variant, info=0):
    """Reposo (balanceo, sonrisa del logo) y habla (boca abierta, en dos fases del balanceo)."""
    imgs = [{"file": "%s_idle_%d.png" % (key, f), "frame": f, "animation": "idle",
             "setup": lambda ctx, f=f: mascot_frame(ctx, key, pos, k, variant, "sonrisa", f, IDLE_N, info=info)}
            for f in range(IDLE_N)]
    imgs += [{"file": "%s_habla_%d.png" % (key, h), "frame": h, "animation": "habla",
              "setup": lambda ctx, h=h: mascot_frame(ctx, key, pos, k, variant, "habla", h * IDLE_N // TALK_N, IDLE_N,
                                                     info=info)}
             for h in range(TALK_N)]
    return imgs


def mascot_top(key, pos):
    def f(ctx):
        objs = [o for o in ctx.fresh[key] if o.type == "MESH"]
        return {"tope": top_point(objs, pos or (0.0, 0.0))}
    return f


BOIAS_K = {"primera": 1.0, "whatsapp": 0.8, "info": 0.85}


def p_boias(place_fn):
    """Las boias con la mascota (extras de lugares.json): la primera y la de WhatsApp en su sitio del puerto y las
    cinco informativas sin sitio todavía (T45 las pone en la ruta; su pivote es el punto del agua bajo ellas)."""
    zid = "puerto"
    bp, wp = tuple(lugar(zid, "boia")), tuple(lugar(zid, "whatsapp"))
    g = "vacio"
    parts = [part("primera", "personaje", "bloquear", g, bp, mascot_images("primera", bp, BOIAS_K["primera"], "primera"),
                  animations=MASCOT_ANIMS, footprint=lambda ctx: circle(bp, 0.55), prox_units=prox(zid, "boia"),
                  anchors=mascot_top("primera", bp),
                  doc="la primera boia (la de la entrada): la mascota de BOIA tal cual, con su aro flotador; reposo "
                      "y habla para sus bocadillos"),
             part("whatsapp", "personaje", "bloquear", g, wp,
                  mascot_images("whatsapp", wp, BOIAS_K["whatsapp"], "whatsapp"),
                  animations=MASCOT_ANIMS, footprint=lambda ctx: circle(wp, 0.42), prox_units=prox(zid, "whatsapp"),
                  anchors=mascot_top("whatsapp", wp),
                  doc="la boia de WhatsApp: la mascota con un bocadillo verde de chat en un mástil (sin logo de marca)")]
    for i in range(5):
        key = "info_%d" % (i + 1)
        parts.append(part(key, "personaje", "bloquear", g, None,
                          mascot_images(key, None, BOIAS_K["info"], "info", info=i),
                          animations=MASCOT_ANIMS, footprint=lambda ctx: circle((0.0, 0.0), 0.47), prox_units=2.4,
                          anchors=mascot_top(key, None),
                          doc="boia informativa %d de 5 (O12): la mascota con un cartel «i» y un gallardete de color "
                              "propio; sin sitio en mapa.json todavía, el motor la pone en la ruta (T45)" % (i + 1)))
    return place_fn("boias", parts, "Las boias")


SECRET_N = 4
SECRET_POS = tuple(LG.point(LG.resolve(M, ENTRY["secreto"]["pos"])))


def secret_frame(ctx, f):
    B = ctx.B
    root = MA.fresh(ctx, "secreto")
    B.root = root
    with B.zona("secreto"), B.pieza("secreto"):
        ctx.data["destello"] = MASC.secreto(B, MA.to_b(SECRET_POS[0], SECRET_POS[1], 0.0), k=1.0, f=f, n=SECRET_N)
    B.root = ctx.root
    return [o for o in MA.fresh_collect(ctx, "secreto", root) if o.type == "MESH"]


def p_secreto(place_fn):
    pos = SECRET_POS
    pa = part("secreto", "objeto", "ninguna", "vacio", pos,
              [{"file": "secreto_brillo_%d.png" % f, "frame": f, "animation": "brillo",
                "setup": lambda ctx, f=f: secret_frame(ctx, f)} for f in range(SECRET_N)],
              animations={"brillo": {"frames": SECRET_N, "fps": 6, "loop": True}},
              footprint=lambda ctx: circle(pos, 0.3), prox_units=1.2,
              anchors=lambda ctx: {"tope": ctx.data["destello"]},
              doc="marcador de secreto: destello dorado sobre un remolino de espuma con burbujas; el mismo en cada "
                  "punto de mapa.json/secretos (instances). Pequeño a propósito: se ve si se mira")
    return place_fn("secreto", [pa], "Secreto")


# La Boia Fiestera a bordo (slot TRIPULANTE): la mascota fiestera a escala del barco, sin globos, bailando y cantando.
def tripulante_setup(f, n):
    def dance(base):
        ph = 2 * math.pi * f / n
        return (Matrix.Translation((0, 0, 0.035 * abs(math.sin(ph))))
                @ Matrix.Rotation(math.radians(9.0 * math.sin(ph)), 4, "Z")
                @ Matrix.Rotation(math.radians(5.0 * math.sin(ph + 0.8)), 4, MA.RIGHT))

    def setup(ctx):
        return mascot_frame(ctx, "tripulante", None, TRIP_K, "fiestera", "habla" if f % 2 else "sonrisa", f, n,
                            balloons=False, water=False, motion=dance)
    return setup


TRIP_K = 0.42
TRIP_FRAMES = 6
FIESTERA_K = 1.4


def tripulante_part(ship_id, sprites):
    return part("tripulante", "tripulante", "ninguna", "aire", None,
                [{"file": "tripulante_baile_%d.png" % f, "frame": f, "animation": "baile",
                  "setup": tripulante_setup(f, TRIP_FRAMES)} for f in range(TRIP_FRAMES)],
                animations={"baile": {"frames": TRIP_FRAMES, "fps": 8, "loop": True}}, no_water=True,
                anchors=lambda ctx: {"tope": top_point([o for o in ctx.fresh["tripulante"] if o.type == "MESH"],
                                                       (0.0, 0.0))},
                attach={"ship": ship_id, "sprites": sprites, "anchor": "slot_passenger",
                        "doc": "slot TRIPULANTE (REQ-AVE-007): el pivote va sobre slot_passenger de la dirección "
                               "que se dibuja, por encima del barco (sus imágenes base, sin la pasajera _p)"},
                doc="la Boia Fiestera a bordo (la mascota de BOIA con sus detalles de fiesta), a escala del barco %s, "
                    "mirando a cámara, bailando y cantando" % ship_id)


def fiestera_part(zid, g, fx, fy, n_pide=6):
    """La Boia Fiestera pidiendo ayuda: la mascota con sus detalles de fiesta y sus globos, balanceándose y hablando
    (boca abierta salvo en dos fotogramas), con las ondas de la zona alrededor."""
    def pide(f):
        def setup(ctx):
            objs = mascot_frame(ctx, "fiestera", (fx, fy), FIESTERA_K, "fiestera",
                                "sonrisa" if f % 3 == 2 else "habla", f, n_pide, water=False)
            return objs + pick(ctx, zid, {"ondas"}, near=(fx, fy), r=1.0)
        return setup

    return part("fiestera", "personaje", "bloquear", g, (fx, fy),
                [{"file": "fiestera_pide_%d.png" % f, "frame": f, "animation": "pide", "setup": pide(f)}
                 for f in range(n_pide)],
                animations={"pide": {"frames": n_pide, "fps": 6, "loop": True}},
                footprint=lambda ctx: circle((fx, fy), 0.48), prox_units=prox(zid, "rescate"),
                anchors=lambda ctx: {"tope": MA.to_b(fx, fy, ctx.data["fiestera_tip"].z + 0.1)},
                doc="la Boia Fiestera (la mascota de BOIA con aro de fiesta, guirnalda, pompón y globos) pidiendo "
                    "ayuda; al rescatarla pasa al slot TRIPULANTE (pieza tripulante)")


def p_fiestera():
    zid, g = "fiestera", "zona:fiestera"
    fx, fy = lugar(zid, "fiestera")
    parts = [fiestera_part(zid, g, fx, fy)]
    parts.append(part("posidonia", "decoracion", "ninguna", g, (fx, fy),
                      static(lambda ctx: pick(ctx, zid, {"posidonia"}, near=(fx, fy), r=3.2)),
                      doc="matas de posidonia flotante alrededor del corro; va debajo de los cocodrilos"))
    for i, (x, y, s) in enumerate(((fx - 2.7, fy - 1.3, 0.38), (fx + 2.6, fy - 1.9, 0.32), (fx + 2.2, fy + 1.9, 0.28))):
        parts.append(part("roca_%d" % (i + 1), "obstaculo", "rebote", g, (x, y),
                          static(lambda ctx, c=(x, y): pick(ctx, zid, {"rocas"}, near=c, r=0.9)),
                          footprint=lambda ctx, c=(x, y), s=s: circle(c, s * 1.05)))
    for i, (ang, rad, k) in enumerate(CORRO):
        cx = fx + rad * math.cos(math.radians(ang))
        cy = fy + rad * math.sin(math.radians(ang))
        key = "cocodrilo_%d" % (i + 1)
        parts.append(part(key, "personaje", "ralentizar", "vacio", (cx, cy), croc_images(key, cx, cy, ang + 180.0, k),
                          animations=CROC_ANIMS, footprint=lambda ctx, c=(cx, cy), k=k: circle(c, 0.45 * k),
                          doc="ralentiza 60 %% durante 2 s; se sumerge (uno cada 0,4 s) cuando el barco entra a %.1f u "
                              "de la Fiestera (zonas/fiestera/proximidad/cocodrilos) y emerge al alejarse"
                              % prox(zid, "cocodrilos")))
    parts.append(tripulante_part(SHIP, "art/barco/estilos/arcilla/manifest.json"))
    return place("fiestera", parts, name=Z[zid]["propuesta_nombre"])


# --- Mar vivo --------------------------------------------------------------------------------
def p_naufrago():
    zid = "marvivo"
    s = isla(zid, "banco_naufrago")
    pa = part("naufrago", "isla", "bloquear", "zona:marvivo", tuple(s["centro"]),
              static(lambda ctx: pick(ctx, zid, {"naufrago", "balsa"})),
              anchors=lambda ctx: {"naufrago": ground(ctx, *lugar(zid, "naufrago"))}, rotulo=True,
              footprint=lambda ctx: outline(s), prox_units=prox(zid, "naufrago"),
              doc="banco de arena con el náufrago, su palmera, el SOS y la balsa varada")
    return place("naufrago", [pa], name=piece_name(zid, "naufrago"))


def piece_name(zid, pid):
    return next(p["nombre"] for p in Z[zid]["piezas"] if p["id"] == pid)


def p_restos():
    zid = "marvivo"
    R = Z[zid]["restos"]
    imgs = []
    for i, v in enumerate("abc"):
        pos = tuple(R[i])
        imgs.append({"file": "restos_%s.png" % v, "frame": 0, "variant": v, "origin": pos,
                     "setup": lambda ctx, pos=pos: pick(ctx, zid, {"restos"}, near=pos, r=0.75)
                     + pick(ctx, zid, {"gaviotas"}, near=pos, r=0.6)})
    pa = part("restos", "recogible", "recoger", "zona:marvivo", tuple(R[0]), imgs,
              footprint=lambda ctx: circle(R[0], 0.45),
              doc="grupo de restos flotantes; tres variantes para repartir por las posiciones de zonas/marvivo/restos")
    return place("restos", [pa], name=piece_name(zid, "restos"))


def p_cofres():
    zid = "marvivo"
    pos = tuple(lugar(zid, "cofre_1"))
    pa = part("cofre", "recogible", "recoger", "zona:marvivo", pos,
              static(lambda ctx: pick(ctx, zid, {"cofres"}, near=pos, r=1.0)),
              footprint=lambda ctx: circle(pos, 0.3), prox_units=prox(zid, "cofre_1"),
              anchors=lambda ctx: {"tapa": MA.to_b(pos[0], pos[1], 0.3)})
    return place("cofres", [pa], name=piece_name(zid, "cofres"))


def p_botellas():
    zid = "marvivo"
    pos = tuple(lugar(zid, "botella_1"))
    pa = part("botella", "objeto", "disparador", "zona:marvivo", pos,
              static(lambda ctx: pick(ctx, zid, {"botellas"}, near=pos, r=0.4)),
              footprint=lambda ctx: circle(pos, 0.22), prox_units=prox(zid, "botella_1"),
              doc="botella con mensaje (REQ-IDE-040): la misma para las de muestra y las que escriben los visitantes")
    return place("botellas", [pa], name=piece_name(zid, "botellas"))


def p_delfin():
    zid = "marvivo"
    pos = tuple(lugar(zid, "delfin"))
    n = 8
    D = P.mdir(-125.0)

    def salto(f):
        def setup(ctx):
            objs = pick(ctx, zid, {"delfin"}, near=pos, r=0.95, skip_roles=("lumi",))
            body = [o for o in objs if role_of(o) != "foam"]
            e = MA.rig_objects(ctx, "delfin", body, MA.to_b(pos[0], pos[1], 0.0))
            t = f / (n - 1)
            e.matrix_world = Matrix.Translation(MA.to_b(pos[0], pos[1], -0.75 * (1.0 - math.sin(math.pi * t)))
                                                + D * (0.7 * (t - 0.5)))
            return objs
        return setup

    pa = part("delfin", "personaje", "ninguna", "zona:marvivo", pos,
              [{"file": "delfin_salto_%d.png" % f, "frame": f, "animation": "salto", "setup": salto(f)}
               for f in range(n)],
              animations={"salto": {"frames": n, "fps": 10, "loop": False}}, prox_units=prox(zid, "delfin"),
              doc="salto del delfín hacia arriba del mapa: sale, hace el arco y se sumerge; el motor lo repite 3 veces")
    return place("delfin", [pa], name=piece_name(zid, "delfin"))


def p_remolino():
    zid = "marvivo"
    pos = tuple(lugar(zid, "remolino"))
    n = 8

    def giro(f):
        def setup(ctx):
            objs = pick(ctx, zid, {"remolino"})
            e = MA.rig_objects(ctx, "remolino", objs, MA.to_b(pos[0], pos[1], 0.0))
            e.matrix_world = Matrix.Translation(MA.to_b(pos[0], pos[1], 0.0)) @ Matrix.Rotation(
                math.radians(360.0 * f / n / 3.0), 4, "Z")
            return objs
        return setup

    pa = part("remolino", "remolino", "ninguna", "zona:marvivo", pos,
              [{"file": "remolino_giro_%d.png" % f, "frame": f, "animation": "giro", "setup": giro(f)} for f in range(n)],
              animations={"giro": {"frames": n, "fps": 8, "loop": True}}, prox_units=prox(zid, "remolino"),
              doc="la espiral gira 120° en el bucle (tiene simetría de 3 vueltas): se ve continua")
    return place("remolino", [pa], name=piece_name(zid, "remolino"))


# --- Circuito ---------------------------------------------------------------------------------
CIRC = _load("arcilla_zona_circuito", os.path.join(ARC, "zonas", "circuito.py"))


def ramas():
    WS, WA = C["ancho_segura"], C["ancho_atajo"]
    return {"comun": (CIRC.catmull(C["comun"]), WS), "segura": (CIRC.catmull(C["segura"]), WS),
            "atajo": (CIRC.catmull(C["atajo"]), WA), "final": (CIRC.catmull(C["final"]), WS)}


def gate(pid, pos, rama, pieces, extra_r=0.6):
    pts, w = ramas()[rama]
    p = Vector(pos)
    t = CIRC.tangent_at(p, pts)
    n = CIRC.left(t)
    a, b = p + n * (w / 2), p - n * (w / 2)
    hh = 0.72 + 0.16 * w if pid in ("salida", "meta") else (0.95 if rama != "atajo" else 0.78)

    def anchors(ctx):
        return {"pie_a": MA.to_b(a.x, a.y, 0.0), "pie_b": MA.to_b(b.x, b.y, 0.0), "arco": MA.to_b(p.x, p.y, hh)}

    return part(pid, "puerta", "disparador", "zona:circuito", (p.x, p.y),
                static(lambda ctx: pick(ctx, "circuito", pieces, near=(p.x, p.y), r=w / 2 + extra_r)),
                anchors=anchors, doc="arco sobre el carril: el paso se cuenta al cruzar el segmento pie_a–pie_b")


def cartel_pos():
    """La misma búsqueda de zonas/circuito.py: el hueco de agua más cercano a cartel_atajo, a la izquierda del atajo."""
    R = ramas()
    cx, cy = C["cartel_atajo"]
    best = None
    for i in range(-30, 31):
        for j in range(-40, 41):
            q = Vector((cx + i * 0.06, cy - 0.6 + j * 0.06))
            ds = CIRC.dist_poly(q, R["segura"][0]) - R["segura"][1] / 2
            da = CIRC.dist_poly(q, R["atajo"][0]) - R["atajo"][1] / 2
            dc = CIRC.dist_poly(q, R["comun"][0]) - R["comun"][1] / 2
            if min(ds, da, dc) < 0.18:
                continue
            pa = min(R["atajo"][0], key=lambda r: (r - q).length)
            if q.x >= pa.x:
                continue
            d = (q - Vector((cx, cy))).length
            if best is None or d < best[0]:
                best = (d, q)
    q = best[1] if best else Vector((cx - 0.9, cy - 1.0))
    return (q.x, q.y)


def lane_buoy(ctx, key, role):
    B = ctx.B
    root = MA.fresh(ctx, key)
    B.root = root
    with B.zona("circuito"), B.pieza("carril"):
        P.lane_buoy(B, 0.0, 0.0, role=role, k=0.95, light=False)
        B.blob("bulb", (0.036, 0.036, 0.042), B.at(0.0, 0.0, 0.19 * 0.95), segs=10, rings=6)
    B.root = ctx.root
    return MA.fresh_collect(ctx, key, root)


def p_circuito():
    zid, g = "circuito", "zona:circuito"
    cps = {c["id"]: c for c in C["checkpoints"]}
    obst = {o["id"]: o for o in C["obstaculos"]}
    parts = [gate("salida", C["salida"], "comun", {"salida"})]
    for cid, rama in (("CP1", "comun"), ("CP-S", "segura"), ("CP-A", "atajo"), ("CP2", "final")):
        parts.append(gate(cid.lower(), cps[cid]["pos"], rama, {"checkpoints"}))
    parts.append(gate("meta", C["meta"], "final", {"meta"}, extra_r=0.9))
    sem = (C["salida"][0] + 2.35, C["salida"][1] - 0.35)
    parts.append(part("semaforo", "decoracion", "ninguna", g, sem, static(lambda ctx: pick(ctx, zid, {"semaforo"})),
                      anchors=lambda ctx: {"luces": MA.to_b(sem[0], sem[1], 1.05 + 0.24)},
                      doc="semáforo de salida; va en la playa este, junto al arco de salida"))
    cq = cartel_pos()
    parts.append(part("cartel", "obstaculo", "bloquear", g, cq, static(lambda ctx: pick(ctx, zid, {"cartel"})),
                      footprint=lambda ctx: circle(cq, 0.38), doc="cartel «ATAJO →» sobre tres rocas, a la izquierda "
                      "de la entrada del atajo"))
    for iid in ("dents", "freu"):
        s = isla(zid, iid)
        parts.append(part(iid, "isla", "bloquear", g, tuple(s["centro"]),
                          static(lambda ctx, iid=iid: pick(ctx, zid, {iid})), footprint=lambda ctx, s=s: outline(s),
                          rotulo=True))
    for oid, coll in (("roca", "rebote"), ("medusa", "ralentizar")):
        o = obst[oid]
        parts.append(part(oid, "obstaculo", coll, g, tuple(o["pos"]), static(lambda ctx, oid=oid: pick(ctx, zid, {oid})),
                          footprint=lambda ctx, o=o: circle(o["pos"], o["radio"]), doc=o["comportamiento"]))
    o = obst["cocodrilo"]
    x, y = o["pos"]
    kc = o["radio"] / 0.62
    imgs = []
    for v, gg in (("derecha", 0.0), ("izquierda", 180.0)):
        imgs.append({"file": "cocodrilo_%s.png" % v, "frame": 0, "variant": v,
                     "setup": lambda ctx, gg=gg, v=v: croc_frame(ctx, "cocodrilo_" + v, x, y, gg, kc, CROC_SUB,
                                                                 zone="circuito")})
    parts.append(part("cocodrilo", "obstaculo", "ralentizar", "vacio", (x, y), imgs,
                      footprint=lambda ctx: circle((x, y), o["radio"]),
                      doc="cocodrilo móvil: va y viene entre circuito/obstaculos/cocodrilo/vaiven mirando hacia donde "
                          "nada (variantes derecha e izquierda); " + o["comportamiento"]))
    parts.append(part("boia_carril", "decoracion", "bloquear", "vacio", None,
                      [{"file": "boia_carril_%s.png" % v, "frame": 0, "variant": v,
                        "setup": lambda ctx, v=v, r=r: lane_buoy(ctx, "carril_" + v, r)}
                       for v, r in (("a", "lane_a"), ("b", "lane_b"))],
                      footprint=lambda ctx: circle((0.0, 0.0), 0.11),
                      doc="boia de carril: alternar a y b a los dos lados del eje de cada rama, cada 1,0 u (0,7 en el "
                          "atajo), sin ponerlas en los pies de los arcos ni junto a los obstáculos (zonas/circuito.py)"))
    return place("circuito", parts, name=Z[zid]["propuesta_nombre"])


# --- Minijuegos ---------------------------------------------------------------------------------
PUERTO_Z = _load("arcilla_zona_puerto", os.path.join(ARC, "zonas", "puerto.py"))
COSTAS_Z = _load("arcilla_zona_costas", os.path.join(ARC, "zonas", "costas.py"))


def cap(B, s, role="grass", k=0.62, dz=0.0):
    """Tapa de tierra plana sobre una isla de roca, para poder poner cosas encima. Devuelve su altura."""
    cx, cy = s["centro"]
    top = B.gz(cx, cy)
    B.land(cx, cy, s["a"] * k, s["b"] * k, 0.1, top - 0.06 + dz, g=s.get("giro", 0.0), p=2.6, q=3.0, role=role,
           segs=48, rings=12)
    return top + 0.04 + dz


def g_faro(ctx):
    B = ctx.B
    s = MJ["faro"]["isla"]
    cx, cy = s["centro"]
    with B.zona("faro"):
        with B.pieza("isla"):
            B.isla(s)
            z0 = cap(B, s, "grass")
        with B.pieza("rocas"):
            for ang, rr, sz in ((200, 1.05, 0.34), (250, 1.0, 0.26), (20, 1.1, 0.3), (95, 1.08, 0.22), (140, 1.12, 0.28)):
                u, v = s["a"] * rr * math.cos(math.radians(ang)), s["b"] * rr * math.sin(math.radians(ang))
                gg = math.radians(s["giro"])
                P.rock(B, cx + u * math.cos(gg) - v * math.sin(gg), cy + u * math.sin(gg) + v * math.cos(gg), sz, z=0.0)
        base = B.at(cx - 0.15, cy - 0.1, z0 - 0.05)
        H, R0, R1, n = 1.7, 0.3, 0.2, 6
        with B.pieza("torre"):
            for i in range(n):
                z0i, z1i = H * i / n, H * (i + 1) / n
                r0, r1 = R0 + (R1 - R0) * i / n, R0 + (R1 - R0) * (i + 1) / n
                B.lathe("white" if i % 2 == 0 else "red", [(0, z0i), (r0, z0i), (r1, z1i), (0, z1i)], tuple(base), segs=32)
            B.lathe("stone", [(0, -0.05), (R0 + 0.08, -0.05), (R0 + 0.06, 0.12), (0, 0.12)], tuple(base), segs=32)
            D = P.mdir(90.0)
            Rt = D.cross(UP).normalized()
            B.blob("blue_door", (0.1, 0.03, 0.17), base + D * (R0 - 0.01) + Vector((0, 0, 0.17)), 4.0, 3.0,
                   extra=P.basis(Rt, D, UP), segs=14, rings=8)
            for zz in (0.75, 1.25):
                r = R0 + (R1 - R0) * zz / H
                B.blob("glass", (0.05, 0.02, 0.07), base + D * r + Vector((0, 0, zz)), 4.0, 4.0,
                       extra=P.basis(Rt, D, UP), segs=12, rings=6)
        top = base + Vector((0, 0, H))
        with B.pieza("linterna"):
            B.lathe("iron", [(0, 0), (R1 + 0.12, 0), (R1 + 0.12, 0.04), (0, 0.04)], tuple(top), segs=32)
            B.torus("iron", R1 + 0.1, 0.015, P.T(*(top + Vector((0, 0, 0.16)))), nu=32, nv=6)
            for i in range(8):
                a = math.radians(i * 45)
                q = top + Vector(((R1 + 0.1) * math.cos(a), (R1 + 0.1) * math.sin(a), 0.0))
                B.tube("iron", [q, q + Vector((0, 0, 0.16))], 0.01, segs=5)
            B.lathe("glass", [(0, 0.04), (0.15, 0.04), (0.15, 0.34), (0, 0.34)], tuple(top), segs=24)
            B.blob("bulb", (0.1, 0.1, 0.11), top + Vector((0, 0, 0.19)), segs=16, rings=10)
            B.lathe("red", [(0, 0.34), (0.2, 0.34), (0.03, 0.56), (0, 0.58)], tuple(top), segs=24)
            B.blob("iron", (0.04, 0.04, 0.04), top + Vector((0, 0, 0.62)), segs=10, rings=6)
        ctx.data["linterna"] = top + Vector((0, 0, 0.19))
        with B.pieza("casita"):
            PUERTO_Z.casita(B, cx + 0.75, cy + 0.2, 0.34, 0.3, 0.36, g=60.0, lit=False)
        with B.pieza("vegetacion"):
            P.bush(B, cx - 0.8, cy + 0.25, 0.18)
            P.bush(B, cx + 0.3, cy + 0.55, 0.14, role="pine")
            P.pine(B, cx - 0.75, cy - 0.45, height=0.9, k=0.6)


# El Puig Campana en el arte 2D del lugar `canon` (T231): la misma montaña que la isla 3D (islas/puigcampana.py,
# T221), con su cresta, la muesca de la Portà y sus laderas, a escala de la isla del mapa. Del modelo 3D (frente a
# -Y de Blender) al mapa (frente hacia el espectador, +y): x por CANON_SX, y por CANON_SY y el alto por CANON_SZ.
CANON_SX, CANON_SY, CANON_SZ = 0.2, 0.16, 0.2
CANON_MOUNT = (0.0, -0.22)          # dónde cae el centro de la planta de la montaña, respecto al centro de la isla
CANON_NOTCH_T = 0.32              # hasta dónde baja la muesca de la Portà por la ladera (0 cresta … 1 pie)
CANON_ROCK = "smoke"                # la caliza clara de la montaña (un papel del tema que ya existe: vale en la acuarela)
CANON_HOUSES = ((-0.8, 0.16, 0.11, 0.09, 0.14, 100.0), (-0.62, 0.36, 0.1, 0.08, 0.12, 80.0),
                (-0.96, 0.38, 0.09, 0.08, 0.11, 95.0), (-0.7, -0.02, 0.08, 0.07, 0.2, 90.0))
# Finestrat: (dx, dy, semiancho, semifondo, alto, g) casitas encaladas; la última, alta, es el campanario.


def canon_house(B, x, y, w, d, h, g):
    """Casita encalada de Finestrat con tejado de teja y puerta azul, a la escala del arte del mapa."""
    base = B.on(x, y, -0.02)
    m = B.rz(g)
    B.blob("whitewash", (w, d, h * 0.5), base + Vector((0, 0, h * 0.5)), 6.0, 7.0, extra=m, segs=16, rings=8)
    B.blob("roof_tile", (w + 0.015, d + 0.015, 0.03), base + Vector((0, 0, h + 0.01)), 5.0, 2.0, extra=m, segs=16,
           rings=6)
    D = P.mdir(g)
    Rt = D.cross(UP).normalized()
    B.blob("blue_door", (0.025, 0.008, 0.04), base + D * (d * 0.98) + Vector((0, 0, 0.04)), 4.0, 3.0,
           extra=P.basis(Rt, D, UP), segs=10, rings=6)


def canon_mountain(B, cx, cy, z0):
    """La montaña del Puig Campana (islas/puigcampana.py) como malla del mapa, con la base en z0 (bajo la tapa)."""
    import bmesh
    from islas import puigcampana as PC
    mx, my = cx + CANON_MOUNT[0], cy + CANON_MOUNT[1]

    def to_map(q):
        return B.at(mx + (q.x - PC.MOUNT_C.x) * CANON_SX, my - (q.y - PC.MOUNT_C.y) * CANON_SY,
                    z0 + (q.z - PC.BASE_Z) * CANON_SZ)

    # La Portà, sólo arriba: la cresta sin la muesca (recta de una pared a la otra) da la ladera, y la muesca se
    # hunde únicamente en el último CANON_NOTCH_T de la ladera; con la cresta del 3D tal cual, la muesca bajaría
    # por toda la cara como una canal y, a este tamaño, no se leería como la Portà.
    (u0, h0), (u1, h1) = PC.RIDGE[6], PC.RIDGE[11]

    def point(u, t):
        q = PC.mount_point(u, t)
        if u0 < u < u1:
            fill = h0 + (h1 - h0) * (u - u0) / (u1 - u0)
            dip = max(0.0, fill - PC.ridge_h(u))
            z = PC.BASE_Z + (fill - PC.BASE_Z) * PC.slope(t) + PC.bump(u, t) - dip * max(0.0, 1.0 - abs(t) / CANON_NOTCH_T)
            q = Vector((q.x, q.y, z))
        return q

    us = sorted({x for x, _ in PC.RIDGE} | {-PC.MOUNT_A + 2 * PC.MOUNT_A * i / 26 for i in range(27)})
    walls = [(PC.RIDGE[7][0], PC.RIDGE[8][0]), (PC.RIDGE[9][0], PC.RIDGE[10][0])]
    us = [u for u in us if not any(lo < u < hi for lo, hi in walls)]
    ts = sorted({-1.0 + 2.0 * j / 20 for j in range(21)} | {-0.05, -0.15, -0.25, 0.05, 0.15})
    bm = bmesh.new()
    grid = [[bm.verts.new(to_map(point(u, t))) for t in ts] for u in us]
    for i in range(len(us) - 1):
        for j in range(len(ts) - 1):
            bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
    bottom = bm.verts.new(to_map(Vector((PC.MOUNT_C.x, PC.MOUNT_C.y, PC.BASE_Z - 0.3))))
    for e in [e for e in bm.edges if len(e.link_faces) == 1]:
        bm.faces.new((e.verts[0], e.verts[1], bottom))
    B.mk(bm, CANON_ROCK, sharp=30)
    # Peñascos y matas por la falda; la roca pelada queda arriba.
    for u, t, sz in ((-3.6, -0.6, 0.11), (-1.8, -0.72, 0.09), (0.7, -0.74, 0.1), (2.9, -0.62, 0.11), (4.3, -0.5, 0.08),
                     (1.4, -0.45, 0.07)):
        q = to_map(PC.mount_point(u, t))
        B.blob("rock", (sz, sz * 0.85, sz * 0.7), q, 2.0, 2.0, extra=P.rot("Z", 37 * u), segs=12, rings=6)
    for u, t in ((-4.4, -0.82), (-2.7, -0.86), (-0.5, -0.86), (2.1, -0.84), (3.8, -0.8), (-1.3, -0.62), (3.3, -0.66)):
        q = to_map(PC.mount_point(u, t))
        B.blob("pine", (0.07, 0.06, 0.045), q + Vector((0, 0, 0.01)), 2.0, 2.0, segs=10, rings=5)
    return to_map(PC.mount_point(-0.5, 0.0))


def g_canon(ctx):
    """El Puig Campana (decisión 15, T231): la montaña de caliza con la muesca de la Portà, Finestrat blanco a
    sus pies, pinos y, al frente, el cañón del minijuego apuntando al mar con su bandera."""
    B = ctx.B
    s = MJ["canon"]["isla"]
    cx, cy = s["centro"]
    with B.zona("canon"):
        with B.pieza("isla"):
            B.isla(s)
            z0 = cap(B, s, "grass", k=0.72)
        with B.pieza("rocas"):
            gg = math.radians(s["giro"])
            for ang, rr, sz in ((180, 1.05, 0.28), (230, 1.02, 0.22), (320, 1.08, 0.24), (60, 1.1, 0.2)):
                u, v = s["a"] * rr * math.cos(math.radians(ang)), s["b"] * rr * math.sin(math.radians(ang))
                P.rock(B, cx + u * math.cos(gg) - v * math.sin(gg), cy + u * math.sin(gg) + v * math.cos(gg), sz, z=0.0)
        with B.pieza("montana"):
            ctx.data["cima"] = canon_mountain(B, cx, cy, z0 - 0.05)
        with B.pieza("finestrat"):
            for dx, dy, w, d, h, g in CANON_HOUSES:
                canon_house(B, cx + dx, cy + dy, w, d, h, g)
        C0 = B.at(cx + 0.38, cy + 0.6, z0 - 0.04)
        with B.pieza("canon"):
            B.blob("stone", (0.3, 0.24, 0.04), C0 + Vector((0, 0, 0.02)), 6.0, 2.0, extra=B.rz(20), segs=24, rings=6)
            gdir = 25.0                         # apunta al mar, a la derecha y hacia cámara
            D = P.mdir(gdir)
            Rt = D.cross(UP).normalized()
            piv = C0 + Vector((0, 0, 0.2))
            m = P.T(*piv) @ P.basis(Rt, D, UP) @ P.rot("X", -78)       # el eje +Z del torno apunta a D, algo alzado
            prof = [(0, -0.26), (0.1, -0.26), (0.11, -0.2), (0.085, -0.16), (0.075, 0.2), (0.085, 0.24), (0.07, 0.26),
                    (0.05, 0.26), (0, 0.24)]
            B.lathe("iron", prof, (0, 0, 0), segs=20, extra=m)
            B.blob("iron", (0.06, 0.06, 0.06), (0, 0, 0), extra=m @ P.T(0, 0, -0.3), segs=10, rings=6)
            ctx.data["boca"] = m @ Vector((0, 0, 0.27))
            for side in (-1, 1):
                w = piv + Rt * side * 0.13 - Vector((0, 0, 0.08))
                B.torus("wood_dark", 0.085, 0.022, P.T(*w) @ P.basis(D, UP, Rt), nu=20, nv=6)
                B.blob("stage_wood", (0.16, 0.025, 0.07), w + Vector((0, 0, 0.04)), 4.0, 3.0,
                       extra=P.basis(D, -Rt, UP), segs=12, rings=6)
            for dx, dy, dz in ((0, 0, 0), (0.1, 0, 0), (0.05, 0.085, 0), (0.05, 0.03, 0.08)):
                q = C0 + Rt * (-0.3 + dx) - D * (0.05 - dy) + Vector((0, 0, 0.06 + dz))
                B.blob("iron", (0.05, 0.05, 0.05), q, segs=12, rings=8)
        with B.pieza("bandera"):
            P.flag(B, C0 - P.mdir(gdir) * 0.4 + P.mdir(gdir + 90) * 0.1, 0.9, 0.7, role="lane_a", g=0)
        with B.pieza("vegetacion"):
            for x, y, h in ((0.95, 0.35, 1.1), (1.15, 0.0, 0.9), (-1.2, 0.05, 1.0), (-0.35, 0.62, 0.85)):
                P.pine(B, cx + x, cy + y, height=h, k=0.4)
            P.bush(B, cx + 0.05, cy + 0.72, 0.1, role="pine")
            P.bush(B, cx + 0.8, cy + 0.62, 0.09, role="pine")


def p_minijuego(mid, builder):
    s = MJ[mid]["isla"]

    def anchors(ctx):
        key = "linterna" if mid == "faro" else "boca"
        return {key: ctx.data[key]}

    pa = part(mid, "isla", "bloquear", "minijuego:" + mid, tuple(s["centro"]),
              static(lambda ctx: pick(ctx, mid)), anchors=anchors, rotulo=True, footprint=lambda ctx: outline(s),
              prox_units=MJ[mid]["proximidad"],
              doc="isla del minijuego (start_minigame %s, D-20)" % mid)
    return place(mid, [pa], name=MJ[mid]["nombre"])


GROUPS["minijuego"] = lambda ctx, arg: {"faro": g_faro, "canon": g_canon}[arg](ctx)


# --- Costas ---------------------------------------------------------------------------------------
# Dos tramos de acantilado (o de playa) por periodo, con los parámetros de dos tramos de mapa.json.
TRAMOS_O = ({"dx": 0.1, "a": 2.8, "b": 4.5, "alto": 1.3}, {"dx": -0.1, "a": 3.0, "b": 4.6, "alto": 1.5})
TRAMOS_E = ({"dx": 0.0, "a": 2.6, "b": 4.5, "alto": 0.85}, {"dx": 0.2, "a": 3.0, "b": 4.6, "alto": 1.0})


def oeste(B, y0, reps, y_max=None, sgn=-1):
    """Acantilados de arenisca periódicos (cada L_OESTE) en x ≈ -17,4; sgn=+1 da el espejo al este (no se usa)."""
    cx0 = -17.4
    per = []
    rng = random.Random(501)
    for j, t in enumerate(TRAMOS_O):
        cy = (j + 0.5) * L_OESTE / 2
        items = {"rocas": [], "pinos": [], "matas": []}
        for i in range(7):
            items["rocas"].append((rng.uniform(-t["b"] * 0.85, t["b"] * 0.85), rng.uniform(0.0, 0.18),
                                   rng.uniform(0.14, 0.26), i % 3 == 0))
        for i in range(3):
            items["pinos"].append(((i - 1) * t["b"] * 0.55 + rng.uniform(-0.3, 0.3), rng.uniform(-0.5, 0.5),
                                   rng.uniform(1.0, 1.3), rng.uniform(0.75, 0.95)))
        for i in range(2):
            items["matas"].append((rng.uniform(-t["b"] * 0.6, t["b"] * 0.6), rng.uniform(0.3, 0.8), rng.uniform(0.14, 0.22)))
        per.append((cy, t, items))
    ys = [y0 + r * L_OESTE for r in reps]
    with B.pieza("acantilados"):
        for yb in ys:
            for cy, t, _ in per:
                if y_max is not None and yb + cy > y_max:
                    continue
                cx, y = cx0 + t["dx"], yb + cy
                a, b, alto = t["a"], t["b"], t["alto"]
                B.land(cx + 0.12, y, a + 0.18, b + 0.1, 0.55, -0.25, g=0, p=4.0, q=5.0, role="cliff_dark", segs=64, rings=16)
                B.land(cx, y, a, b, alto + 0.2, -0.2, g=0, p=4.0, q=7.0, role="cliff", segs=72, rings=24)
                B.land(cx - 0.3, y + 0.2, a - 0.45, b - 0.5, 0.2, alto - 0.12, g=0, p=4.0, q=4.0, role="cliff_dark", segs=56, rings=12)
                B.land(cx - 0.9, y + 0.1, a - 0.9, b - 0.9, 0.14, alto + 0.02, g=0, p=3.0, q=3.0, role="grass", segs=56, rings=12)
    with B.pieza("rocas"):
        for yb in ys:
            for cy, t, it in per:
                if y_max is not None and yb + cy > y_max:
                    continue
                for n, (dy, dx, s, rip) in enumerate(it["rocas"]):
                    B.rng = random.Random(9100 + 97 * n + int(cy * 10))
                    y = yb + cy + dy
                    x = COSTAS_Z.cara_x(B, y, 0.05, -12.5, cx0) + dx
                    P.rock(B, x, y, s, z=-s * 0.2)
                    if rip:
                        P.ripple(B, x, y, s + 0.1, 1, t=0.015)
    with B.pieza("pinos"):
        for yb in ys:
            for cy, t, it in per:
                if y_max is not None and yb + cy > y_max:
                    continue
                cx = cx0 + t["dx"]
                for n, (dy, dx, hh, k) in enumerate(it["pinos"]):
                    B.rng = random.Random(9200 + 97 * n + int(cy * 10))
                    P.pine(B, cx - 0.5 + dx, yb + cy + dy, height=hh, k=k)
                for n, (dy, dx, s) in enumerate(it["matas"]):
                    B.rng = random.Random(9300 + 97 * n + int(cy * 10))
                    P.bush(B, cx + dx, yb + cy + dy, s, role="pine")


def este(B, y0, reps, y_max=None):
    """Playa larga periódica en x ≈ +17,4: arena baja, dunas con barrón, sombrillas, palmeras y pinos."""
    cx0 = 17.4
    rng = random.Random(733)
    roles = ("lane_a", "stripe", "red", "firework_b", "pea")
    per = []
    for j, t in enumerate(TRAMOS_E):
        cy = (j + 0.5) * L_OESTE / 2
        it = {"dunas": [(k - 0.5) * t["b"] * 0.9 + rng.uniform(-0.3, 0.3) for k in range(2)],
              "sombrillas": [(rng.uniform(-3.4, 3.4), rng.uniform(-0.1, 0.25), roles[(2 * j + k) % 5], rng.uniform(0.9, 1.1))
                             for k in range(2)],
              "palmeras": [(rng.uniform(-3.6, 3.6), rng.uniform(1.45, 1.7))],
              "pinos": [(rng.uniform(-3.8, 3.8), rng.uniform(1.05, 1.25), rng.uniform(0.8, 0.95)) for _ in range(2)],
              "barron": [(rng.uniform(-4.0, 4.0), rng.uniform(0.9, 2.0), [rng.uniform(0, 40) for _ in range(6)],
                          [rng.uniform(0.14, 0.22) for _ in range(6)]) for _ in range(6)]}
        per.append((cy, t, it))
    ys = [y0 + r * L_OESTE for r in reps]

    def rows():
        for yb in ys:
            for cy, t, it in per:
                if y_max is None or yb + cy <= y_max:
                    yield yb + cy, t, it

    with B.pieza("playa"):
        for y, t, it in rows():
            B.land(cx0 + t["dx"], y, t["a"], t["b"], t["alto"] + 0.2, -0.2, g=0, p=4.0, q=2.2, role="sand", segs=72, rings=20)
        for y, t, it in rows():
            for dy in it["dunas"]:
                B.land(cx0 + t["dx"] + 0.9, y + dy, 1.1, 1.4, 0.3, t["alto"] - 0.12, g=0, p=2.2, q=2.0, role="sand",
                       segs=40, rings=12)
    with B.pieza("dunas"):
        for y, t, it in rows():
            for dy, dx, angs, hs in it["barron"]:
                base = B.on(cx0 - 1.2 + dx, y + dy, -0.02)
                for k in range(6):
                    a = math.radians(k * 60 + angs[k])
                    d = Vector((math.cos(a), math.sin(a), 0))
                    B.tube("pea" if k % 2 else "grass", [base, base + d * 0.04 + Vector((0, 0, hs[k] * 0.6)),
                                                          base + d * 0.1 + Vector((0, 0, hs[k]))], [0.018, 0.013, 0.005], segs=5)
    with B.pieza("sombrillas"):
        for y, t, it in rows():
            for dy, dx, role, k in it["sombrillas"]:
                x = COSTAS_Z.cara_x(B, y + dy, 0.12, 12.5, 18.0) + 0.45 + dx
                COSTAS_Z.sombrilla(B, x, y + dy, role, k=k)
                COSTAS_Z.toalla(B, x - 0.05, y + dy + 0.45, roles[(roles.index(role) + 2) % 5], g=90.0)
    with B.pieza("palmeras"):
        for y, t, it in rows():
            for n, (dy, hh) in enumerate(it["palmeras"]):
                B.rng = random.Random(9400 + 97 * n + int(t["a"] * 100))
                P.palm(B, 16.3, y + dy, lean=(-0.28, 0.05), height=hh, leaves=7)
    with B.pieza("pinos"):
        for y, t, it in rows():
            for n, (dy, hh, k) in enumerate(it["pinos"]):
                B.rng = random.Random(9500 + 97 * n + int(t["a"] * 100))
                P.pine(B, 17.1, y + dy, height=hh, k=k)


def back_strip(B, x0, x1, y0, y1, alto, role):
    """Tierra de fondo continua detrás de la costa: garantiza que el borde de tierra de la losa es opaco."""
    B.land((x0 + x1) / 2, (y0 + y1) / 2, abs(x1 - x0) / 2, abs(y1 - y0) / 2, alto, -0.2, g=0, p=8.0, q=4.0, role=role,
           segs=64, rings=16)


def sur(B, x0, reps, land=None, items_in=None):
    """El paseo del puerto, periódico en x (cada L_SUR): losas, casitas encaladas, farolas y norays.
    `land` (x0, x1) acota la tierra y `items_in` (x0, x1) las piezas (esquinas)."""
    s = next(i for i in Z["puerto"]["islas"] if i["id"] == "paseo")
    yc, b = s["centro"][1], s["b"]
    xs = [x0 + r * L_SUR for r in reps]
    lo, hi = land or (min(xs) - L_SUR, max(xs) + 2 * L_SUR)
    x_min, x_max = items_in or (-1e9, 1e9)
    with B.pieza("paseo"):
        B.land((lo + hi) / 2, yc + 1.2, (hi - lo) / 2, b + 1.2, s["alto"], -0.2, g=0, p=8.0, q=6.0, role=s["rol"],
               segs=64, rings=24)
        B.blob("stone", ((hi - lo) / 2, 0.42, 0.06), B.at((lo + hi) / 2, 28.45, B.gz((lo + hi) / 2, 28.45) + 0.01),
               8.0, 4.0, extra=B.rz(0), segs=96, rings=8)
    items = [("casita", 1.9, 29.95, 0.6, 0.55, True), ("casita", 5.9, 30.2, 0.5, 0.5, False), ("farola", 3.9, 28.25),
             ("noray", 0.7, 27.98), ("noray", 7.3, 27.98), ("palmera", 7.9, 29.6)]
    with B.pieza("casitas"):
        for xb in xs:
            for n, it in enumerate(items):
                B.rng = random.Random(9600 + 97 * n)      # la misma pieza en cada periodo
                x = xb + it[1]
                if not x_min <= x <= x_max:
                    continue
                if it[0] == "casita":
                    PUERTO_Z.casita(B, x, it[2], it[3], 0.45, it[4], lit=it[5])
                elif it[0] == "farola":
                    P.lamp(B, x, it[2], 0.95)
                elif it[0] == "noray":
                    P.bollard(B, x, it[2])
                else:
                    P.palm(B, x, it[2], lean=(0.1, -0.2), height=1.35, leaves=6)


def shore_y(ctx, x, y_from=25.5, y_to=34.0, z=0.0):
    y = y_from
    while y < y_to and ctx.B.gz(x, y) < z:
        y += 0.02
    return y


def g_costa(ctx, arg):
    B = ctx.B
    if arg == "oeste":
        with B.zona("costa_oeste"):
            oeste(B, Y_OESTE, range(-2, 3))
            with B.pieza("fondo"):
                back_strip(B, -34.0, -19.0, Y_OESTE - 2.2 * L_OESTE, Y_OESTE + 3.2 * L_OESTE, 1.05, "grass")
    elif arg == "este":
        with B.zona("costa_este"):
            este(B, Y_OESTE, range(-2, 3))
            with B.pieza("fondo"):
                back_strip(B, 19.2, 34.0, Y_OESTE - 2.2 * L_OESTE, Y_OESTE + 3.2 * L_OESTE, 0.95, "sand")
    elif arg == "sur":
        with B.zona("costa_sur"):
            sur(B, X_SUR, range(-2, 3))
    elif arg in ("esquina_oeste", "esquina_este"):
        # Primero la costa lateral (sus rocas buscan la cara del acantilado) y después el paseo, que acaba bajo ella.
        sgn = -1 if arg == "esquina_oeste" else 1
        with B.zona("costa_oeste" if sgn < 0 else "costa_este"):
            if sgn < 0:
                oeste(B, Y_OESTE, range(0, 2), y_max=29.0)
                with B.pieza("fondo"):
                    back_strip(B, -34.0, -19.0, Y_OESTE, 40.0, 1.05, "grass")
            else:
                este(B, Y_OESTE, range(0, 2), y_max=29.0)
                with B.pieza("fondo"):
                    back_strip(B, 19.2, 34.0, Y_OESTE, 40.0, 0.95, "sand")
        with B.zona("costa_sur"):
            if sgn < 0:
                sur(B, X_SUR, range(-2, 2), land=(-15.6, 17.4), items_in=(-14.0, 20.0))
            else:
                sur(B, X_SUR, range(0, 3), land=(-8.7, 15.6), items_in=(-20.0, 14.0))


GROUPS["costa"] = g_costa


def all_meshes(ctx):
    return [o for o in ctx.scene.objects if o.type == "MESH" and not o.get("no_bounds")]


TILES = {}


def tile_part(pid, arg, land, axis, canvas, period, line_point, shore_fn, doc):
    tile = {"axis": axis, "land": land, "canvas": canvas, "period_units": period, "line_point": line_point,
            "shore": shore_fn, "map_line": {"doc": doc}, "doc": TILE_DOC}
    TILES[pid] = tile
    return part(pid, "losa", "bloquear", "costa:" + arg, line_point, static(all_meshes), tile=tile)


TILE_DOC = ("se repite sin costura a lo largo de `axis` cada period_px (period_units en el mapa); el lado de tierra "
            "llega opaco al borde y más allá se rellena con outer_fill; el lado del agua es transparente. shore_px: "
            "la orilla (tierra a ras de agua) en ese eje; collision_px: donde tiene que pararse el casco (lo sólido más "
            "saliente: orilla, rocas); map_line.px: la línea de la costa de mapa.json en ese eje")


def p_costa_lateral(pid):
    west = pid == "costa_oeste"
    x_line = -15.0 if west else 15.0
    pivot_x = TILE_PIVOT_X if west else TILE_W - TILE_PIVOT_X

    def shore(ctx):
        out = []
        for i in range(96):
            y = Y_OESTE + L_OESTE * i / 96.0
            x = COSTAS_Z.cara_x(ctx.B, y, 0.0, -12.0 if west else 12.0, -22.0 if west else 22.0, step=0.01)
            out.append(MA.to_b(x, y, 0.0))
        return out

    pa = tile_part(pid, "oeste" if west else "este", "left" if west else "right", "y",
                   (TILE_W, TILE_H, (pivot_x, 0.0)), L_OESTE, (x_line, Y_OESTE), shore,
                   "x = %d de mapa.json (costas/%s/linea); la fila 0 es y = %.4f + n·period_units" % (x_line, pid, Y_OESTE))
    return place(pid, [pa], name=COSTA[pid]["nombre"])


def p_costa_sur():
    def shore(ctx):
        return [MA.to_b(X_SUR + L_SUR * i / 96.0, shore_y(ctx, X_SUR + L_SUR * i / 96.0), 0.0) for i in range(96)]

    parts = [tile_part("costa_sur", "sur", "bottom", "x", (SUR_W, SUR_H, SUR_PIVOT), L_SUR, (X_SUR, 27.8), shore,
                       "y = 27,8 de mapa.json (costas/costa_sur/linea); la columna 0 es x = %.4f + n·period_units" % X_SUR)]
    for sgn, pid in ((-1, "esquina_oeste"), (1, "esquina_este")):
        corner = {"land": ["left" if sgn < 0 else "right", "bottom"], "fills": {},
                  "map_point": [15.0 * sgn, 27.8],
                  "covers_map": {"x": sorted([round(15.0 * sgn - sgn * ESQ_PIVOT_X / PPU, 4),
                                              round(15.0 * sgn + sgn * (ESQ_W - ESQ_PIVOT_X) / PPU, 4)]),
                                 "y": [round(Y_ESQ, 4), round(27.8 + (ESQ_H - ESQ_PIVOT_Y) / (PPU * 0.5), 4)]},
                  "doc": "une la costa lateral con el paseo: su borde de arriba es el de una losa lateral (y = %.4f) y "
                         "el de dentro el de una losa del paseo; el pivote es map_point" % Y_ESQ}
        piv = (ESQ_PIVOT_X if sgn < 0 else ESQ_W - ESQ_PIVOT_X, ESQ_PIVOT_Y)
        pa = part(pid, "esquina", "bloquear", "costa:" + pid, (15.0 * sgn, 27.8), static(all_meshes),
                  corner=corner, canvas=(ESQ_W, ESQ_H, piv))
        parts.append(pa)
    return place("costa_sur", parts, name=COSTA["costa_sur"]["nombre"])


def _fills_for_corners(places):
    """Las esquinas funden hacia los mismos colores que las losas (se renderizan después)."""
    for pl in places:
        for p in pl["parts"]:
            if p.get("corner"):
                lat = "costa_oeste" if p["id"] == "esquina_oeste" else "costa_este"
                p["corner"]["fills"] = _LazyFills(lat, p["corner"]["land"][0])


class _LazyFills(dict):
    def __init__(self, lateral, side):
        super().__init__()
        self.lateral, self.side = lateral, side

    def get(self, k, default=None):
        t = TILES["costa_sur"] if k == "bottom" else TILES[self.lateral]
        return tuple(int(t["outer_fill"][i:i + 2], 16) for i in (1, 3, 5))

    def __getitem__(self, k):
        t = TILES["costa_sur"] if k == "bottom" else TILES[self.lateral]
        return t["outer_fill"]


# --- Catálogo ------------------------------------------------------------------------------------
def places():
    out = [p_puerto(), p_isla("cala"), p_fiestera(), p_allday(), p_isla("fotos"), p_isla("tienda"), p_isla("ultima"),
           p_naufrago(), p_restos(), p_cofres(), p_botellas(), p_delfin(), p_remolino(), p_circuito(),
           p_minijuego("faro", g_faro), p_minijuego("canon", g_canon),
           p_costa_lateral("costa_oeste"), p_costa_lateral("costa_este"), p_costa_sur()]
    _fills_for_corners(out)
    shared = lambda pid, parts, name: place(pid, parts, name=name, shared=True)
    return out + [p_boias(shared), p_secreto(shared)]


BASE_SCRIPTS = ["tools/blender/rig.py", "tools/blender/world.py", "tools/blender/lugares.py", "tools/blender/lugares.json",
                "tools/blender/mundos_arte.py", "tools/blender/mundo_arcilla.py", "tools/blender/render.py",
                "tools/blender/styles/05_arcilla_maqueta.py", "mundos/temas.py", "mundos/arcilla/escena.py",
                "mundos/arcilla/piezas.py", "mundos/arcilla/herramientas/mapa.py", "mundos/arcilla/mapa.json"]
ZONE_FILES = {"puerto": ["puerto"], "cala": ["cala"], "fiestera": ["fiestera"], "allday": ["allday"],
              "fotos": ["fotos"], "tienda": ["tienda"], "ultima": ["ultima"], "circuito": ["circuito"],
              "faro": ["puerto"], "canon": [], "costa_oeste": ["costas"], "costa_este": ["costas"],
              "costa_sur": ["costas", "puerto"], "boias": [], "secreto": []}
MASCOT_PLACES = ("boias", "secreto", "fiestera")      # la mascota de BOIA (T39): tools/blender/mascota.py
PLACE_SCRIPTS = {"canon": ["tools/blender/islas/puigcampana.py"]}   # el Puig Campana (T231): la montaña del 3D


def scripts(place):
    zs = ZONE_FILES.get(place["id"], ["marvivo"])
    extra = ["tools/blender/mascota.py"] if place["id"] in MASCOT_PLACES else []
    return BASE_SCRIPTS + ["mundos/arcilla/zonas/%s.py" % z for z in zs] + extra + PLACE_SCRIPTS.get(place["id"], [])


ANCHOR_DOC = {
    "pivot": "punto del mapa a ras de agua que da map_pos: centro de la isla u objeto; fijo en todas las imágenes",
    "rotulo": "encima del punto más alto del arte: nombre o aviso del lugar",
    "tope": "encima de la cabeza o la punta: bocadillos y reacciones",
    "muelle": "punta del muelle a ras de cubierta: donde se amarra",
    "luz": "luz de la baliza",
    "pie_a": "pie izquierdo del arco a ras de agua (mirando en el sentido de la carrera)",
    "pie_b": "pie derecho del arco a ras de agua",
    "arco": "clave del arco",
    "luces": "cabeza del semáforo: luces de la cuenta atrás",
    "linterna": "linterna del faro: origen del haz del minijuego",
    "boca": "boca del cañón: origen de los disparos del minijuego",
    "tapa": "tapa del cofre: de aquí salen las monedas",
    "naufrago": "el náufrago, de pie en el banco: origen de su bocadillo",
}


def anchor_doc(place, name):
    if name in ANCHOR_DOC:
        return ANCHOR_DOC[name]
    for z in M["zonas"]:
        for lg in z.get("lugares", []):
            if lg["id"] == name and (place["id"] == z["id"] or place["place"]["ref"].startswith("zonas/" + z["id"])):
                return lg["nombre"]
    return name

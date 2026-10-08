"""Los 8 barcos de estilo (tools/blender/styles/NN_*.py) como modelos glTF para el mar 3D (/mar).

Mismo `build_ship()` que da los sprites del 2D (ship_styles.py): misma geometría,
mismas piezas y los colores de cada hoja. Lo que no viaja a glTF (arcilla con
subsuperficie, tramados, rampas toon, postprocesos) se aplana a un color por
material: el color base del Principled, el de la emisión o el tono iluminado de
la rampa. Los contornos de casco invertido se quitan (en el mar 3D no hacen
falta). Proa a +X y flotación en y = 0, como en Blender.

Cada barco sale en sus skins (T39, ship_skins.skins_for): <id>.glb (base),
<id>-noche.glb y <id>-fiesta.glb; el manifiesto las lista en `skins`. Además,
las boias con la mascota de BOIA (mascota.py: boia-mascota, boia-info,
boia-whatsapp y boia-fiestera) y el marcador de secreto (secreto.glb), con un
color plano por papel (la paleta del tema de arcilla).

    /Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/export_barcos_glb.py
    ... -- --only arcilla acuarela
    ... -- --no-boias
    ... -- --solo-boias                 # sólo las boias (T220: la mascota con el contorno del logo)

Salida: art/barco/3d/*.glb y art/barco/3d/manifest.json (muestra).
"""
import argparse
import json
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import rig  # noqa: E402
import ship_skins  # noqa: E402
import ship_styles  # noqa: E402

# Tope de triángulos por barco: en el móvil el barco se ve pequeño. muestra
MAX_TRIS = 12000

OUT = os.path.join(os.path.dirname(os.path.dirname(HERE)), "art", "barco", "3d")


def _ramp_color(node):
    """Tono iluminado de una rampa: el de su tramo claro (toon) o su media."""
    return tuple(node.color_ramp.evaluate(0.7))


def _color_from_socket(sock, seen):
    """Primer color que se puede leer subiendo por un enlace."""
    if not sock.is_linked:
        v = getattr(sock, "default_value", None)
        try:
            return tuple(v)[:4] if v is not None and len(v) >= 3 else None
        except TypeError:
            return None
    node = sock.links[0].from_node
    return _color_from_node(node, seen)


def _color_from_node(node, seen):
    if node in seen:
        return None
    seen.add(node)
    t = node.bl_idname
    if t == "ShaderNodeRGB":
        return tuple(node.outputs[0].default_value)
    if t == "ShaderNodeValToRGB":
        return _ramp_color(node)
    for name in ("Base Color", "Color", "Color1", "A", "Color2", "B", "Emission Color"):
        s = node.inputs.get(name)
        if s is not None and s.type == "RGBA":
            c = _color_from_socket(s, seen)
            if c:
                return c
    for s in node.inputs:
        if s.type in ("RGBA", "SHADER"):
            c = _color_from_socket(s, seen)
            if c:
                return c
    return None


def _hex_lin(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (1.0,)


def _hex_of(v):
    if isinstance(v, str) and v.startswith("#") and len(v) == 7:
        return v
    if isinstance(v, dict):
        return _hex_of(v.get("hex") or v.get("color") or v.get("base"))
    if isinstance(v, (tuple, list)) and v and isinstance(v[0], str):
        return _hex_of(v[0])
    return None


def palette_of(mod):
    """Colores con nombre del script de estilo: sus diccionarios de hex (C, PAL, COLORS…)."""
    pal = {}
    for k, v in vars(mod).items():
        if k.startswith("_") or not isinstance(v, dict):
            continue
        for name, val in v.items():
            h = _hex_of(val)
            if isinstance(name, str) and h:
                pal.setdefault(name.lower(), h)
    for k, v in vars(mod).items():
        h = _hex_of(v)
        if k.isupper() and h:
            pal.setdefault(k.lower(), h)
    # Pixel art: cada material son índices (sombra, medio, luz) de una paleta fija.
    table, mats = getattr(mod, "PALETTE", None), getattr(mod, "MATS", None)
    if isinstance(table, list) and isinstance(mats, dict):
        for name, idx in mats.items():
            if isinstance(idx, tuple) and len(idx) == 3:
                pal[name.lower()] = table[idx[1]]
    # Boceto a lápiz: grafito sobre papel; cada pieza es un gris (oscuridad o valor plano).
    dark, flat = getattr(mod, "DARK", None), getattr(mod, "FLAT", None)
    if isinstance(dark, dict):
        for name, d in dark.items():
            pal[name.lower()] = _gray(0.95 - d * 0.7)
    if isinstance(flat, dict):
        for name, v in flat.items():
            pal[name.lower()] = _gray(v)
    return pal


def _gray(v):
    """Gris de papel (un pelo cálido) con luminosidad v (0..1, sRGB)."""
    v = max(0.0, min(1.0, v))
    r, g, b = (min(255, round(v * 255 * k)) for k in (1.0, 0.985, 0.955))
    return "#%02X%02X%02X" % (r, g, b)


def from_palette(pal, mat_name):
    """El color de la hoja para un material: por su nombre (sin sufijos .001, _mat…)."""
    base = mat_name.split(".")[0].lower()
    cands = [base, base.replace("_mat", ""), base.replace("mat_", ""), base.split("_")[0]]
    for c in cands:
        if c in pal:
            return pal[c]
    return None


def flatten(mat):
    """(color lineal, emisivo) de un material de estilo, leyendo su árbol de nodos."""
    if not mat.use_nodes or not mat.node_tree:
        return tuple(mat.diffuse_color), False
    nt = mat.node_tree
    out = next((n for n in nt.nodes if n.bl_idname == "ShaderNodeOutputMaterial" and n.is_active_output), None)
    out = out or next((n for n in nt.nodes if n.bl_idname == "ShaderNodeOutputMaterial"), None)
    emissive = any(n.bl_idname == "ShaderNodeEmission" for n in nt.nodes) and not any(
        n.bl_idname in ("ShaderNodeBsdfPrincipled", "ShaderNodeBsdfDiffuse") for n in nt.nodes
    )
    color = None
    if out and out.inputs["Surface"].is_linked:
        color = _color_from_node(out.inputs["Surface"].links[0].from_node, set())
    if color is None:
        color = tuple(mat.diffuse_color)
    return tuple(color[:3]) + (1.0,), emissive


def simple_material(name, color, emissive):
    m = bpy.data.materials.new(name + "_gltf")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    o = nt.nodes.new("ShaderNodeOutputMaterial")
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    b.inputs["Base Color"].default_value = color
    b.inputs["Roughness"].default_value = 0.8
    b.inputs["Metallic"].default_value = 0.0
    if emissive:
        b.inputs["Emission Color"].default_value = color
        b.inputs["Emission Strength"].default_value = 1.0
    nt.links.new(b.outputs["BSDF"], o.inputs["Surface"])
    return m


def is_outline(obj, mat):
    """Contorno de casco invertido: un material 'outline' o de caras traseras."""
    n = (mat.name if mat else "").lower()
    return "outline" in n or "contorno" in n


def glb_name(sid, skin):
    return sid + (".glb" if skin == "base" else "-%s.glb" % skin)


def export(sid, skin="base"):
    rig.reset_scene()
    mod = ship_styles.load(sid)
    ship_skins.apply(sid, mod, skin)
    built = mod.build_ship()
    # Unos estudios devuelven (raíz, piezas); otros, sólo la raíz.
    root = built[0] if isinstance(built, tuple) else built
    # Mallas en orden fijo (como los sprites): el .glb sale igual byte a byte en cada corrida.
    ship_styles.canonical_order(bpy.context.scene)
    # Los modificadores de contorno (Solidify con normales invertidas) fuera.
    for obj in [o for o in bpy.data.objects if o.type == "MESH"]:
        for mod_ in list(obj.modifiers):
            if mod_.type == "SOLIDIFY" and mod_.use_flip_normals:
                obj.modifiers.remove(mod_)
    cache = {}
    pal = palette_of(mod)
    unmatched = set()
    tris = 0
    for obj in [o for o in bpy.data.objects if o.type == "MESH"]:
        slots = obj.material_slots
        if slots and all(s.material and is_outline(obj, s.material) for s in slots):
            bpy.data.objects.remove(obj)
            continue
        for s in slots:
            if not s.material:
                continue
            key = s.material.name
            if key not in cache:
                color, emissive = flatten(s.material)
                h = from_palette(pal, key)
                if h:
                    color = _hex_lin(h)
                else:
                    unmatched.add(key)
                tint = ship_skins.tint_for(sid, skin, key)          # lápiz: el tinte de la skin sobre su gris
                if tint:
                    color = tuple(a * b for a, b in zip(color[:3], _hex_lin(tint)[:3])) + (1.0,)
                cache[key] = simple_material(key, color, emissive)
            s.material = cache[key]
    ship_skins.apply(sid, mod, "base")
    # Mallas densas (superelipsoides, tornos) a dieta si el barco pasa del tope.
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    total = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
    if total > MAX_TRIS:
        ratio = MAX_TRIS / total
        for o in meshes:
            if len(o.data.polygons) > 300:
                d = o.modifiers.new("dieta", "DECIMATE")
                d.ratio = max(0.2, ratio)
    # Sólo la jerarquía del barco (sin luces ni cámara).
    bpy.ops.object.select_all(action="DESELECT")
    for o in bpy.data.objects:
        top = o
        while top.parent:
            top = top.parent
        if top == root and o.type in ("MESH", "EMPTY", "CURVE"):
            o.select_set(True)
            if o.type == "MESH":
                ev = o.evaluated_get(bpy.context.evaluated_depsgraph_get())
                tris += sum(len(p.vertices) - 2 for p in ev.data.polygons)
    name = glb_name(sid, skin)
    path = write_glb(name)
    print("[glb] %s: %d triángulos aprox., %d kB; sin hoja: %s"
          % (name, tris, os.path.getsize(path) // 1024, ", ".join(sorted(unmatched)) or "-"))
    return name


def write_glb(name):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_texcoords=False,
        export_normals=True,
        export_materials="EXPORT",
        export_lights=False,
        export_cameras=False,
    )
    return path


def ship_entry(sid, files):
    return {"id": sid, "file": files["base"], "barco": ship_styles.BY_ID[sid]["barco"],
            "label": ship_styles.BY_ID[sid]["label"], "slot": ship_styles.BY_ID[sid]["slot"], "skins": files}


# --- Las boias con la mascota de BOIA y el marcador de secreto (T39) ---------------------------------
# Mismas piezas que el arte 2D (mascota.py, con el Builder de los mundos); cada papel, un color plano (la paleta del
# tema de arcilla, la de los mundos por defecto). Cara a +X y flotación en y = 0. Desde T220 llevan el contorno de
# tinta del logo (casco invertido: el mar 3D oculta las caras traseras y sólo asoma el borde).
BOIAS = [("boia-mascota", "primera", "la primera boia: la mascota de BOIA tal cual"),
         ("boia-info", "info", "boia informativa (cartel «i» y gallardete; el color del gallardete lo puede cambiar /mar)"),
         ("boia-whatsapp", "whatsapp", "boia de WhatsApp: la mascota con el bocadillo verde de chat"),
         ("boia-fiestera", "fiestera", "la Boia Fiestera: aro de fiesta, guirnalda, pompón y globos")]


def _flat_theme():
    import mundo_arcilla as ARC          # rutas de mundos/, Builder con malla canónica y papeles de la mascota
    T = ARC.temas

    class Plano(T.Tema):
        def make(self, role):
            if role in T.Arcilla.GLOW:
                return simple_material(role, _hex_lin(T.Arcilla.GLOW[role][0]), True)
            return simple_material(role, _hex_lin(T.Arcilla.HEX[role]), False)
    return ARC, Plano()


def export_boia(name, variant=None):
    """Una boia con la mascota (variant) o el marcador de secreto (variant None) como glTF."""
    import mascota as MASC
    rig.reset_scene()
    ARC, tema = _flat_theme()
    root = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(root)
    B = ARC.escena.Builder(tema, ARC.temas.A, ARC.M, root)
    with B.zona("mascota"), B.pieza(name):
        if variant:
            MASC.mascota(B, (0.0, 0.0, 0.0), k=1.0, g=45.0, variant=variant, mouth="sonrisa", outline=True)
        else:
            MASC.secreto(B, (0.0, 0.0, 0.0), k=1.0, f=0)
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    total = sum(len(p.vertices) - 2 for o in meshes for p in o.data.polygons)
    bpy.ops.object.select_all(action="DESELECT")
    for o in [root] + meshes:
        o.select_set(True)
    path = write_glb(name + ".glb")
    print("[glb] %s: %d triángulos, %d kB" % (name, total, os.path.getsize(path) // 1024))
    return name + ".glb"


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*", help="sólo estos barcos (ids de estilo)")
    ap.add_argument("--no-boias", action="store_true", help="sin las boias ni el secreto")
    ap.add_argument("--solo-boias", action="store_true", help="sólo las boias y el secreto; los barcos quedan como están")
    a = ap.parse_args(argv)
    done = []
    for sid in ([] if a.solo_boias else (a.only or ship_styles.IDS)):
        files = {skin: export(sid, skin) for skin in ship_skins.skins_for(sid)}
        done.append(ship_entry(sid, files))
    man = os.path.join(OUT, "manifest.json")
    prev, prev_doc = {}, {}
    if os.path.exists(man):
        with open(man, encoding="utf-8") as f:
            prev_doc = json.load(f)
            prev = {s["id"]: s for s in prev_doc.get("barcos", [])}
    for d in done:
        prev[d["id"]] = d
    boias = prev_doc.get("boias", [])
    secretos = prev_doc.get("secretos", [])
    if not a.no_boias:
        boias = [{"id": name, "file": export_boia(name, variant), "variant": variant, "doc": doc}
                 for name, variant, doc in BOIAS]
        secretos = [{"id": "secreto", "file": export_boia("secreto"), "doc": "marcador de secreto: destello dorado "
                     "sobre un remolino de espuma (el mismo en cada punto de mapa.json/secretos)"}]
    with open(man, "w", encoding="utf-8") as f:
        json.dump({
            "status": "muestra",
            "nota": "Generado por tools/blender/export_barcos_glb.py desde los scripts de estilo (barcos, con sus "
                    "skins: ship_skins.py) y desde tools/blender/mascota.py (boias y secreto). No editar.",
            "unidades": "Blender: proa (o cara) a +X, flotación en y = 0 (glTF, y arriba); 1 unidad = 1 u del mapa",
            "barcos": [prev[k] for k in ship_styles.IDS if k in prev],
            "boias": boias,
            "secretos": secretos,
        }, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()

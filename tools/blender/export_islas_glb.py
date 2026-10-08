"""Las islas de Blender del mar 3D (/mar) como glTF (T69). MUESTRA.

Cada isla es un módulo de tools/blender/islas/<isla>.py cuyo `ID` es el id del
lugar en el mundo (casi siempre el mismo nombre, p. ej. `halloween`; el Puig
Campana es `puigcampana.py` con `ID = "canon"`, la isla del Cañón, T221) y que
construye la isla entera con el Builder
de los mundos (mundos/arcilla/escena.py) y la mascota de BOIA (mascota.py):
mismo estilo que las boias y los barcos de export_barcos_glb.py, un color
plano por papel (la paleta del tema de arcilla más los papeles de la isla) y
los papeles de GLOW emisivos (brillan de noche en /mar).

Contrato de un módulo de isla (ver islas/halloween.py):
    ID, LABEL, DOC        id del lugar, nombre y una frase para el manifiesto
    RADIUS                radio de la orilla en z = 0 (unidades del modelo)
    DETAIL                segmentos por pieza respecto a los mundos (0..1]
    ROLES, GLOW           papeles nuevos: {rol: "#hex"} planos y emisivos
    build(B, K) -> dict   construye con el Builder B (K = islas/comun.py);
                          devuelve {"top": cima del terreno, "height": alto total}
Frente de la isla (hacia el puerto y la cámara de /mar) a -Y de Blender, que en
glTF (y arriba) queda a +z; el agua en z = 0; centro en el origen.

Todas las mallas se juntan en una (una llamada de dibujo por material) y la
isla entera tiene que caber en MAX_TRIS triángulos.

    blender -b -P tools/blender/export_islas_glb.py                    # todas
    blender -b -P tools/blender/export_islas_glb.py -- --only halloween
    ... -- --only halloween --preview /tmp/islas   # además, PNG de día y de noche

`--only` admite el nombre del módulo o su `ID`. Salida: art/islas/3d/<ID>.glb
y art/islas/3d/manifest.json (lo lee /mar y lo valida tools/blender/check.py).
Sale con 1 si una isla se pasa del presupuesto.
"""
import argparse
import importlib
import json
import math
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import export_barcos_glb as EB  # noqa: E402  (materiales planos: simple_material, _hex_lin)
import rig  # noqa: E402
from islas import comun as K  # noqa: E402

# Tope de triángulos por isla: una isla entera con sus boias, en el móvil, cerca del barco (los barcos: 12000,
# export_barcos_glb.MAX_TRIS). Sólo se carga la de las islas cercanas. muestra
MAX_TRIS = 30000

ISLAS_DIR = os.path.join(HERE, "islas")
OUT = os.path.join(os.path.dirname(os.path.dirname(HERE)), "art", "islas", "3d")
NOT_ISLANDS = {"__init__", "comun"}


def island_ids():
    """Los módulos de isla de tools/blender/islas/ (todos menos comun)."""
    return sorted(f[:-3] for f in os.listdir(ISLAS_DIR) if f.endswith(".py") and f[:-3] not in NOT_ISLANDS)


def load_island(name):
    return importlib.import_module("islas.%s" % name)


def place_id(mod, name):
    """El id del lugar del mundo de un módulo de isla: su `ID` (si no lo declara, el nombre del módulo)."""
    return getattr(mod, "ID", name)


def flat_theme(mod):
    """Tema de un color plano por papel: los de la isla, la mascota y el tema de arcilla."""
    import mundo_arcilla as ARC
    T = ARC.temas
    extra, glow = dict(getattr(mod, "ROLES", {})), dict(getattr(mod, "GLOW", {}))

    class Plano(T.Tema):
        def make(self, role):
            if role in glow:
                return EB.simple_material(role, EB._hex_lin(glow[role]), True)
            if role in extra:
                return EB.simple_material(role, EB._hex_lin(extra[role]), False)
            if role in T.Arcilla.GLOW:
                return EB.simple_material(role, EB._hex_lin(T.Arcilla.GLOW[role][0]), True)
            return EB.simple_material(role, EB._hex_lin(T.Arcilla.HEX[role]), False)
    return ARC, Plano()


def build(name):
    """Construye la isla del módulo `name` en una escena vacía; devuelve (raíz, malla única, módulo, info)."""
    mod = load_island(name)
    iid = place_id(mod, name)
    rig.reset_scene()
    ARC, tema = flat_theme(mod)
    root = bpy.data.objects.new(iid, None)
    bpy.context.scene.collection.objects.link(root)
    Ligero = K.ligero(ARC.escena.Builder, getattr(mod, "DETAIL", 0.5))
    B = Ligero(tema, ARC.temas.A, ARC.M, root)
    with B.zona("isla_" + iid), B.pieza(iid):
        info = mod.build(B, K) or {}
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    mesh = bpy.context.view_layer.objects.active
    mesh.name = iid + "_isla"
    mesh.data.name = iid + "_isla"
    return root, mesh, mod, info


def triangles(mesh):
    return sum(len(p.vertices) - 2 for p in mesh.data.polygons)


def triangles_by_material(mesh):
    """{material: triángulos}, de más a menos (para ver qué pesa: --detalle)."""
    out = {}
    for p in mesh.data.polygons:
        name = mesh.data.materials[p.material_index].name.replace("_gltf", "")
        out[name] = out.get(name, 0) + len(p.vertices) - 2
    return dict(sorted(out.items(), key=lambda kv: -kv[1]))


def write_glb(root, mesh, iid):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, iid + ".glb")
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    mesh.select_set(True)
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


def preview(iid, mod, info, out_dir):
    """PNG de la isla de día y de noche (sólo para mirarla: no va al repo)."""
    scene = bpy.context.scene
    rig.setup_render(scene, transparent=False, width=1200, height=800)
    R = mod.RADIUS
    bpy.ops.mesh.primitive_plane_add(size=R * 8, location=(0, 0, 0.0))
    sea = bpy.context.active_object
    sea.data.materials.append(EB.simple_material("mar", EB._hex_lin("#1A7AA6"), False))
    cam_d = bpy.data.cameras.new("cam")
    cam_d.lens = 38
    cam = bpy.data.objects.new("cam", cam_d)
    scene.collection.objects.link(cam)
    cam.location = Vector((R * 0.9, -R * 2.6, R * 1.5))
    look = Vector((0.0, 0.0, info.get("top", 1.0) + 0.8))
    cam.rotation_euler = (look - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    sun_d = bpy.data.lights.new("sol", type="SUN")
    sun = bpy.data.objects.new("sol", sun_d)
    scene.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(-30))
    bg = scene.world.node_tree.nodes.get("Background")
    glows = [m for m in bpy.data.materials if m.node_tree and m.node_tree.nodes.get("Principled BSDF")
             and m.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value > 0]
    paths = []
    for hora, sun_e, sky, k_glow in (("dia", 3.5, (0.62, 0.78, 1.0), 1.0), ("noche", 0.25, (0.04, 0.05, 0.14), 6.0)):
        sun_d.energy = sun_e
        bg.inputs["Color"].default_value = sky + (1.0,)
        bg.inputs["Strength"].default_value = 0.8
        for m in glows:
            m.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = k_glow
        os.makedirs(out_dir, exist_ok=True)
        scene.render.filepath = os.path.join(out_dir, "%s-%s.png" % (iid, hora))
        bpy.ops.render.render(write_still=True)
        paths.append(scene.render.filepath)
    print("[preview] %s" % ", ".join(paths))


def manifest_entry(iid, mod, info, tris, path):
    return {
        "id": iid,
        "file": iid + ".glb",
        "label": mod.LABEL,
        "radius": mod.RADIUS,
        "top": round(float(info.get("top", 0.0)), 3),
        "height": round(float(info.get("height", 0.0)), 3),
        "tris": tris,
        "kb": os.path.getsize(path) // 1024,
        "doc": mod.DOC,
    }


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*", help="sólo estas islas (módulos de tools/blender/islas/ o sus ID de lugar)")
    ap.add_argument("--preview", help="carpeta (fuera del repo) para los PNG de día y de noche")
    ap.add_argument("--detalle", action="store_true", help="triángulos por material de cada isla")
    a = ap.parse_args(argv)
    names = island_ids()
    by_place = {place_id(load_island(n), n): n for n in names}
    ids = [by_place.get(x, x) for x in a.only] if a.only else names
    unknown = sorted(set(ids) - set(names))
    if unknown:
        print("[islas] sin módulo en tools/blender/islas/: %s" % ", ".join(unknown))
        sys.exit(1)
    man = os.path.join(OUT, "manifest.json")
    prev = {}
    if os.path.exists(man):
        with open(man, encoding="utf-8") as f:
            prev = {e["id"]: e for e in json.load(f).get("islas", [])}
    over = []
    for name in ids:
        root, mesh, mod, info = build(name)
        iid = place_id(mod, name)
        tris = triangles(mesh)
        if a.detalle:
            print("[tris] %s: %s" % (iid, ", ".join("%s %d" % kv for kv in triangles_by_material(mesh).items())))
        if tris > MAX_TRIS:
            over.append("%s: %d triángulos > %d" % (iid, tris, MAX_TRIS))
            continue
        path = write_glb(root, mesh, iid)
        prev[iid] = manifest_entry(iid, mod, info, tris, path)
        print("[glb] %s.glb: %d triángulos, %d materiales, %d kB"
              % (iid, tris, len(mesh.data.materials), os.path.getsize(path) // 1024))
        if a.preview:
            preview(iid, mod, info, a.preview)
    with open(man, "w", encoding="utf-8") as f:
        json.dump({
            "status": "muestra",
            "nota": "Generado por tools/blender/export_islas_glb.py desde tools/blender/islas/<id>.py. No editar.",
            "unidades": "Blender: frente (hacia el puerto) a -Y, que en glTF (y arriba) es +z; agua en y = 0; "
                        "centro en el origen; /mar escala la isla por su radio de lugar / radius",
            "max_tris": MAX_TRIS,
            "islas": [prev[k] for k in sorted(prev)],
        }, f, ensure_ascii=False, indent=1)
        f.write("\n")
    if over:
        print("[islas] se pasan del presupuesto: %s" % "; ".join(over))
        sys.exit(1)


if __name__ == "__main__":
    main()

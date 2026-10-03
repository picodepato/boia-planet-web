"""The props of the landing hero scene as glTF (plan 007, T78). MUESTRA.

Each prop is a module of this folder (`costa`, `puerto`, `barco`, `boya`) with

    ID, LABEL, DOC            id, name and one sentence for the manifest
    BUDGET_TRIS, BUDGET_KB    the budget of design document section 12 for it
    build() -> dict           {"main": [mesh objects], "lights": [(node name, mesh object, "#hex")],
                               "anchor": where the origin is}

Everything in `main` is joined into one mesh `<id>` (one draw call per material; the materials
keep their names); every light is its own small mesh named `luz_*` under the same root, with an
emissive material, so three.js can find it by node name and attach a sprite halo. Units are metres,
water at z = 0 in Blender (y = 0 in glTF), seaward at +Y in Blender (-z in glTF, where a three.js camera
looks by default), see comun.py. Object transforms are baked into the meshes before the export.

    blender -b -P tools/blender/landing/export_landing_glb.py                      # all
    blender -b -P tools/blender/landing/export_landing_glb.py -- --only barco boya
    blender -b -P tools/blender/landing/export_landing_glb.py -- --preview /tmp/x  # also a PNG turntable of each

Output: art/landing/3d/<id>.glb and art/landing/3d/manifest.json (validated by tools/blender/check.py,
read by T79's loader). Exit 1 if a prop passes its triangle budget or the total passes the caps
(TOTAL_TRIS, TOTAL_KB). No Draco (/mar has no decoder), no textures: vertex colours.
"""
import argparse
import importlib
import json
import math
import os
import struct
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(1, os.path.dirname(HERE))   # tools/blender: rig.py for the previews
import comun as K  # noqa: E402
import escena  # noqa: E402

# Caps of design document section 12 (plan 007, T77): the total over every prop. muestra
TOTAL_TRIS = 12000
TOTAL_KB = 220
PROPS = ["costa", "puerto", "barco", "boya"]
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(HERE))), "art", "landing", "3d")


def load_prop(pid):
    return importlib.import_module(pid)


def build(pid):
    """Build a prop in an empty scene; returns (root, main mesh, light meshes, module, info)."""
    mod = load_prop(pid)
    K.reset_scene()
    info = mod.build()
    root = bpy.data.objects.new(pid, None)
    bpy.context.scene.collection.objects.link(root)
    main = K.join(info["main"], pid)
    main.parent = root
    lights = []
    for name, ob, color in info["lights"]:
        ob.name = name
        ob.data.name = name
        lights.append((name, ob, color))
    bpy.ops.object.select_all(action="DESELECT")
    for ob in [main] + [ob for _, ob, _ in lights]:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = main
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for ob in [main] + [ob for _, ob, _ in lights]:
        ob.parent = root
    return root, main, lights, mod, info


def glb_size_check(path):
    with open(path, "rb") as f:
        data = f.read()
    clen = struct.unpack_from("<II", data, 12)[0]
    doc = json.loads(data[20:20 + clen])
    return len(data), doc


def write_glb(root, main, lights, pid, mod):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, pid + ".glb")
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    main.select_set(True)
    for _, ob, _ in lights:
        ob.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_texcoords=False,
        export_normals=getattr(mod, "EXPORT_NORMALS", True),
        export_vertex_color="ACTIVE",
        export_all_vertex_colors=False,
        export_materials="EXPORT",
        export_lights=False,
        export_cameras=False,
        export_extras=False,
        export_animations=False,
        export_skins=False,
        export_morph=False,
    )
    return path


def gltf_xyz(v):
    """Blender (x, y, z) -> glTF (x, y up, z): glTF -z is Blender +Y (seaward)."""
    return [round(v.x, 3) + 0.0, round(v.z, 3) + 0.0, round(-v.y, 3) + 0.0]


def manifest_entry(pid, mod, info, main, lights, path):
    lo, hi = K.bounds([main] + [ob for _, ob, _ in lights])
    tris = K.triangles(main) + sum(K.triangles(ob) for _, ob, _ in lights)
    size, doc = glb_size_check(path)
    mats = [m["name"] for m in doc.get("materials", [])]
    return {
        "id": pid,
        "file": pid + ".glb",
        "label": mod.LABEL,
        "doc": mod.DOC,
        "anchor": info.get("anchor", "origin"),
        "scale": 1.0,
        "height": round(hi.z, 3),
        "bounds": {"min": gltf_xyz(Vector((lo.x, hi.y, lo.z))), "max": gltf_xyz(Vector((hi.x, lo.y, hi.z)))},
        "tris": tris,
        "budget_tris": mod.BUDGET_TRIS,
        "kb": math.ceil(size / 1024),
        "budget_kb": mod.BUDGET_KB,
        "materials": mats,
        "normals": "exported" if getattr(mod, "EXPORT_NORMALS", True) else "computed by the loader (smooth)",
        "lights": [{"node": name, "color": color, "position": gltf_xyz(ob.matrix_world.translation
                                                                       + (Vector(ob.bound_box[0]) + Vector(ob.bound_box[6])) / 2)}
                   for name, ob, color in lights],
    }


def preview(pid, main, lights, out_dir, height):
    """Three PNG views of the prop on a dark studio (only to look at it: not committed)."""
    import rig
    scene = bpy.context.scene
    rig.setup_render(scene, transparent=False, width=900, height=600)
    scene.render.engine = "BLENDER_EEVEE"
    lo, hi = K.bounds([main])
    size = max(hi - lo)
    centre = (lo + hi) / 2
    sun_d = bpy.data.lights.new("sol", type="SUN")
    sun_d.energy = 3.0
    sun = bpy.data.objects.new("sol", sun_d)
    scene.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(55), math.radians(15), math.radians(-35))
    bg = scene.world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.08, 0.09, 0.12, 1.0)
    bg.inputs["Strength"].default_value = 1.0
    cam_d = bpy.data.cameras.new("cam")
    cam_d.lens = 40
    cam_d.clip_end = 100000.0
    cam = bpy.data.objects.new("cam", cam_d)
    scene.collection.objects.link(cam)
    scene.camera = cam
    os.makedirs(out_dir, exist_ok=True)
    for tag, az in (("frente", -25), ("lado", 65), ("atras", 155)):
        a = math.radians(az)
        cam.location = centre + Vector((math.sin(a), -math.cos(a), 0.45)) * size * 1.5
        cam.rotation_euler = (centre - cam.location).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = os.path.join(out_dir, "%s-%s.png" % (pid, tag))
        bpy.ops.render.render(write_still=True)
    print("[preview] %s" % out_dir)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*", help="only these props (%s)" % ", ".join(PROPS))
    ap.add_argument("--preview", help="folder (outside the repo) for PNG views of each prop")
    a = ap.parse_args(argv)
    ids = a.only or PROPS
    unknown = sorted(set(ids) - set(PROPS))
    if unknown:
        print("[landing] not a prop module: %s" % ", ".join(unknown))
        sys.exit(1)
    man = os.path.join(OUT, "manifest.json")
    prev = {}
    if os.path.exists(man):
        with open(man, encoding="utf-8") as f:
            prev = {e["id"]: e for e in json.load(f).get("props", [])}
    over = []
    for pid in ids:
        root, main_ob, lights, mod, info = build(pid)
        path = write_glb(root, main_ob, lights, pid, mod)
        entry = manifest_entry(pid, mod, info, main_ob, lights, path)
        prev[pid] = entry
        print("[glb] %s.glb: %d triangles (budget %d), %d materials %s, %d lights, %d kB (budget %d)"
              % (pid, entry["tris"], mod.BUDGET_TRIS, len(entry["materials"]), entry["materials"],
                 len(lights), entry["kb"], mod.BUDGET_KB))
        if entry["tris"] > mod.BUDGET_TRIS:
            over.append("%s: %d triangles > %d" % (pid, entry["tris"], mod.BUDGET_TRIS))
        if len(entry["materials"]) > 4:
            over.append("%s: %d materials > 4" % (pid, len(entry["materials"])))
        if a.preview:
            preview(pid, main_ob, lights, a.preview, entry["height"])
    entries = [prev[k] for k in PROPS if k in prev]
    total_tris = sum(e["tris"] for e in entries)
    total_kb = sum(e["kb"] for e in entries)
    if total_tris > TOTAL_TRIS:
        over.append("total %d triangles > %d" % (total_tris, TOTAL_TRIS))
    if total_kb > TOTAL_KB:
        over.append("total %d kB > %d" % (total_kb, TOTAL_KB))
    with open(man, "w", encoding="utf-8") as f:
        json.dump({
            "status": "muestra",
            "nota": "Generated by tools/blender/landing/export_landing_glb.py from tools/blender/landing/<id>.py. "
                    "Do not edit.",
            "unidades": "metres; glTF y up, -z seaward (Blender +Y: the direction the hero camera looks, where a "
                        "three.js camera looks by default); water at y = 0; each prop's origin is its `anchor`; "
                        "`lights` are the emissive meshes (node names luz_*) for sprite halos; `bounds` in glTF "
                        "axes; `escena` is the layout of the stills (escena.py) in the same axes",
            "escena": escena.layout_gltf(),
            "max_tris": TOTAL_TRIS,
            "max_kb": TOTAL_KB,
            "total_tris": total_tris,
            "total_kb": total_kb,
            "props": entries,
        }, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print("[landing] total %d/%d triangles, %d/%d kB" % (total_tris, TOTAL_TRIS, total_kb, TOTAL_KB))
    if over:
        print("[landing] over budget: %s" % "; ".join(over))
        sys.exit(1)


if __name__ == "__main__":
    main()

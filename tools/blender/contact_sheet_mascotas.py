"""Vistas de las mascotas de Blender (plan 015, T175) para la hoja de contacto. MUESTRA.

Construye cada mascota con export_mascotas_glb.build (las mismas mallas que
van al GLB) y la fotografía sobre el agua o la cubierta desde cuatro ángulos
(frente, derecha, espalda, izquierda) y como la ve la cámara del barco (por
detrás y arriba). No va al repo: con `--capturas` y `--hoja` compone la hoja
con las capturas del e2e (RECORD_T175 en apps/web/e2e/tienda.spec.ts).

    Blender -b -P tools/blender/contact_sheet_mascotas.py -- --out /tmp/mascotas-vistas [--size 600] [--only canoncito] [--capturas DIR --hoja /tmp/hoja.png]
"""
import argparse
import math
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import export_barcos_glb as EB  # noqa: E402
import export_mascotas_glb as EM  # noqa: E402
import rig  # noqa: E402

SEA = "#1A7AA6"
DECK = "#D9A258"
# (nombre, acimut en grados desde el frente (+X) hacia la derecha (-Y), elevación, distancia en largos del modelo)
VIEWS = [
    ("frente", 0, 20, 1.35),
    ("derecha", 90, 20, 1.35),
    ("espalda", 180, 20, 1.35),
    ("izquierda", 270, 20, 1.35),
    ("desde-la-camara", 205, 32, 1.6),
]


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--size", type=int, default=600)
    ap.add_argument("--only", nargs="*", help="sólo estas mascotas (ids)")
    ap.add_argument("--views", nargs="*", help="sólo estas vistas (nombres de VIEWS)")
    ap.add_argument("--capturas", help="carpeta con las capturas del e2e (RECORD_T175) para la hoja")
    ap.add_argument("--hoja", help="PNG de la hoja de contacto (vistas + capturas)")
    a = ap.parse_args(argv)
    os.makedirs(a.out, exist_ok=True)
    mods = EM.modules()
    views = []
    for mid in a.only or sorted(mods):
        mod = mods[mid]
        root, parts, info = EM.build(mod)
        length = info.get("length", 1.0)
        height = info.get("height", 0.5)
        scene = bpy.context.scene
        rig.setup_render(scene, transparent=False, width=a.size, height=a.size)
        floor = DECK if mid == "canoncito" else SEA
        bpy.ops.mesh.primitive_plane_add(size=length * 10, location=(0, 0, 0.0))
        plane = bpy.context.active_object
        plane.data.materials.append(EB.simple_material("suelo", EB._hex_lin(floor), False))
        cam_d = bpy.data.cameras.new("cam")
        cam_d.lens = 40
        cam = bpy.data.objects.new("cam", cam_d)
        scene.collection.objects.link(cam)
        scene.camera = cam
        sun_d = bpy.data.lights.new("sol", type="SUN")
        sun_d.energy = 3.5
        sun = bpy.data.objects.new("sol", sun_d)
        scene.collection.objects.link(sun)
        sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(-30))
        bg = scene.world.node_tree.nodes.get("Background")
        bg.inputs["Color"].default_value = (0.62, 0.78, 1.0, 1.0)
        bg.inputs["Strength"].default_value = 0.8
        for name, az, el, dist in VIEWS:
            if a.views and name not in a.views:
                continue
            d = dist * length
            az_r, el_r = math.radians(az), math.radians(el)
            cam.location = Vector((math.cos(az_r) * d * math.cos(el_r), -math.sin(az_r) * d * math.cos(el_r), d * math.sin(el_r)))
            look = Vector((0.0, 0.0, height * 0.45))
            cam.rotation_euler = (look - cam.location).to_track_quat("-Z", "Y").to_euler()
            scene.render.filepath = os.path.join(a.out, "%s-%s.png" % (mid, name))
            bpy.ops.render.render(write_still=True)
            print("[vista] %s" % scene.render.filepath)
            views.append(scene.render.filepath)
    if a.hoja:
        import contact_sheet_faro as CF
        CF.hoja(views, a.capturas, a.hoja, a.size)


if __name__ == "__main__":
    main()

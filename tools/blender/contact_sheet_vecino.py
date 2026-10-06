"""Vistas del Vecino Quejica (plan 015, T174) para la hoja de contacto. MUESTRA.

Construye el enemigo con export_enemigos_glb.build (la misma malla que va al
GLB) y lo fotografía sobre el agua desde cuatro ángulos (frente, derecha,
espalda, izquierda), desde arriba como lo ve la cámara alta del castillo y
desde abajo y atrás como lo ve la cámara del Cañón. No va al repo: con
`--capturas` y `--hoja` compone la hoja con las capturas del e2e
(RECORD_T174 en apps/web/e2e/mar-vecino.spec.ts).

    Blender -b -P tools/blender/contact_sheet_vecino.py -- --out /tmp/vecino-vistas [--size 700] [--capturas DIR --hoja /tmp/hoja.png]
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
import export_enemigos_glb as EE  # noqa: E402
import rig  # noqa: E402

SEA = "#1A7AA6"
# (nombre, acimut en grados desde el frente (+X) hacia la derecha (-Y), elevación, distancia en largos del modelo)
VIEWS = [
    ("frente", 0, 22, 1.55),
    ("derecha", 90, 22, 1.55),
    ("espalda", 180, 22, 1.55),
    ("izquierda", 270, 22, 1.55),
    ("desde-arriba", 60, 72, 1.7),
    ("desde-el-canon", 215, 14, 2.1),
    ("cara", 330, 8, 0.72),
]


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--size", type=int, default=700)
    ap.add_argument("--capturas", help="carpeta con las capturas del e2e (RECORD_T174) para la hoja")
    ap.add_argument("--hoja", help="PNG de la hoja de contacto (vistas + capturas)")
    ap.add_argument("--only", default="vecino", help="módulo de tools/blender/enemigos/")
    ap.add_argument("--views", nargs="*", help="sólo estas vistas (nombres de VIEWS), para mirar un detalle")
    a = ap.parse_args(argv)
    os.makedirs(a.out, exist_ok=True)

    root, mesh, mod, info = EE.build(a.only)
    length = info.get("length", 2.6)
    height = info.get("height", 2.0)
    scene = bpy.context.scene
    rig.setup_render(scene, transparent=False, width=a.size, height=a.size)
    bpy.ops.mesh.primitive_plane_add(size=length * 10, location=(0, 0, 0.0))
    sea = bpy.context.active_object
    sea.data.materials.append(EB.simple_material("mar", EB._hex_lin(SEA), False))
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
    views = []
    for name, az, el, dist in VIEWS:
        if a.views and name not in a.views:
            continue
        d = dist * length
        az_r, el_r = math.radians(az), math.radians(el)
        # Acimut 0 = el frente (+X de Blender); crece hacia -Y (la derecha mirando al frente).
        cam.location = Vector((math.cos(az_r) * d * math.cos(el_r), -math.sin(az_r) * d * math.cos(el_r), d * math.sin(el_r)))
        look = Vector((0.0, 0.0, height * (0.25 if el > 50 else 0.62 if name == "cara" else 0.45)))
        cam.rotation_euler = (look - cam.location).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = os.path.join(a.out, "%s-%s.png" % (a.only, name))
        bpy.ops.render.render(write_still=True)
        print("[vista] %s" % scene.render.filepath)
        views.append(scene.render.filepath)
    if a.hoja:
        import contact_sheet_faro as CF
        CF.hoja(views, a.capturas, a.hoja, a.size)


if __name__ == "__main__":
    main()

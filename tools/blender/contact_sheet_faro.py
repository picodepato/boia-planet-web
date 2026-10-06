"""Vistas del Faro de Tabarca (plan 014, T166) para la hoja de contacto. MUESTRA.

Construye la isla `faro` con export_islas_glb.build (la misma malla que va al
GLB) y la fotografía sobre el agua desde cuatro ángulos (frente, derecha,
espalda, izquierda; la primera también de noche) y desde el agua, a lo lejos,
como la ve el barco al llegar. No va al repo: la hoja la compone
tools/blender/contact_sheet_faro_sheet.py con las capturas del e2e.

    Blender -b -P tools/blender/contact_sheet_faro.py -- --out /tmp/faro-vistas [--size 900] [--capturas DIR --hoja /tmp/hoja.png]
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
import export_islas_glb as EI  # noqa: E402
import rig  # noqa: E402

SEA = "#1A7AA6"
# (nombre, acimut en grados desde el frente (-Y) hacia la derecha, elevación, distancia en radios, hora)
VIEWS = [
    ("frente", 0, 24, 2.9, "dia"),
    ("derecha", 90, 24, 2.9, "dia"),
    ("espalda", 180, 24, 2.9, "dia"),
    ("izquierda", 270, 24, 2.9, "dia"),
    ("frente-noche", 0, 24, 2.9, "noche"),
    ("desde-el-barco", 35, 6, 5.2, "dia"),
]
HORAS = {"dia": (3.5, (0.62, 0.78, 1.0), 1.0), "noche": (0.25, (0.04, 0.05, 0.14), 6.0)}


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--size", type=int, default=900)
    ap.add_argument("--capturas", help="carpeta con las capturas del e2e (RECORD_T166) para la hoja")
    ap.add_argument("--hoja", help="PNG de la hoja de contacto (vistas + capturas)")
    a = ap.parse_args(argv)
    os.makedirs(a.out, exist_ok=True)

    root, mesh, mod, info = EI.build("faro")
    R = mod.RADIUS
    height = info["height"]
    scene = bpy.context.scene
    rig.setup_render(scene, transparent=False, width=a.size, height=a.size)
    bpy.ops.mesh.primitive_plane_add(size=R * 14, location=(0, 0, 0.0))
    sea = bpy.context.active_object
    sea.data.materials.append(EB.simple_material("mar", EB._hex_lin(SEA), False))
    cam_d = bpy.data.cameras.new("cam")
    cam_d.lens = 38
    cam = bpy.data.objects.new("cam", cam_d)
    scene.collection.objects.link(cam)
    scene.camera = cam
    sun_d = bpy.data.lights.new("sol", type="SUN")
    sun = bpy.data.objects.new("sol", sun_d)
    scene.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(-30))
    bg = scene.world.node_tree.nodes.get("Background")
    bg.inputs["Strength"].default_value = 0.8
    glows = [m for m in bpy.data.materials if m.node_tree and m.node_tree.nodes.get("Principled BSDF")
             and m.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value > 0]
    views = []
    for name, az, el, dist, hora in VIEWS:
        d = dist * R
        az_r, el_r = math.radians(az), math.radians(el)
        # Acimut 0 = el frente (-Y de Blender); crece hacia +X (la derecha mirando el frente).
        cam.location = Vector((math.sin(az_r) * d * math.cos(el_r), -math.cos(az_r) * d * math.cos(el_r), d * math.sin(el_r)))
        look = Vector((0.0, 0.0, height * (0.42 if el > 10 else 0.5)))
        cam.rotation_euler = (look - cam.location).to_track_quat("-Z", "Y").to_euler()
        sun_e, sky, k_glow = HORAS[hora]
        sun_d.energy = sun_e
        bg.inputs["Color"].default_value = sky + (1.0,)
        for m in glows:
            m.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = k_glow
        scene.render.filepath = os.path.join(a.out, "faro-%s.png" % name)
        bpy.ops.render.render(write_still=True)
        print("[vista] %s" % scene.render.filepath)
        views.append(scene.render.filepath)
    if a.hoja:
        hoja(views, a.capturas, a.hoja, a.size)


def hoja(views, capturas_dir, out, size):
    """La hoja de contacto: arriba las vistas de Blender; abajo las capturas del e2e (RECORD_T166), si las hay."""
    import glob

    import contact_sheet as CS

    tiles = [CS.load_rgba(p) for p in views]
    caps = []
    if capturas_dir and os.path.isdir(capturas_dir):
        for p in sorted(glob.glob(os.path.join(capturas_dir, "*.png"))):
            img = CS.load_rgba(p)
            h, w = img.shape[:2]
            caps.append(CS.scaled(img, size / float(max(h, w))))
    cols = max(3, len(tiles) // 2 + len(tiles) % 2)
    gap = 12
    rows_top = (len(tiles) + cols - 1) // cols
    rows_cap = (len(caps) + cols - 1) // cols if caps else 0
    W = cols * size + (cols + 1) * gap
    Hh = (rows_top + rows_cap) * (size + gap) + gap
    sheet = CS.panel(W, Hh)
    for i, t in enumerate(tiles):
        CS.over(sheet, t, gap + (i % cols) * (size + gap), gap + (i // cols) * (size + gap))
    for i, c in enumerate(caps):
        x = gap + (i % cols) * (size + gap) + (size - c.shape[1]) // 2
        y = gap + (rows_top + i // cols) * (size + gap) + (size - c.shape[0]) // 2
        CS.over(sheet, c, x, y)
    CS.write_png(out, sheet)
    print("[hoja] %s (%d vistas, %d capturas)" % (out, len(tiles), len(caps)))


if __name__ == "__main__":
    main()

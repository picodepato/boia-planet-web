"""Los enemigos de Blender del mar 3D (/mar) como glTF (plan 015, T174). MUESTRA.

Cada enemigo es un módulo de tools/blender/enemigos/<id>.py (el id es el del
boss o enemigo en `@boia/engine/survivors`, p. ej. `vecino`) que construye
el modelo entero con el Builder de los mundos (mundos/arcilla/escena.py),
como las islas de export_islas_glb.py: mismo estilo que las boias y los
barcos, un color plano por papel (la paleta del tema de arcilla más los
papeles del módulo) y los papeles de GLOW emisivos.

Contrato de un módulo de enemigo (ver enemigos/vecino.py):
    ID, LABEL, DOC        id del enemigo, nombre y una frase para el manifiesto
    RADIUS                el radio de choque del enemigo en unidades del modelo
                          (/mar escala el modelo por su radio de escena / RADIUS)
    DETAIL                segmentos por pieza respecto a los mundos (0..1]
    ROLES, GLOW           papeles nuevos: {rol: "#hex"} planos y emisivos
    build(B, K) -> dict   construye con el Builder B (K = islas/comun.py);
                          devuelve {"length": largo total, "height": alto total}
Frente del enemigo (rumbo 0 del motor) a +X de Blender, que en glTF (y arriba)
sigue siendo +x; el agua en z = 0; centro en el origen.

Todas las mallas se juntan en una (una llamada de dibujo por material; /mar
la aplana a una sola geometría con el color en los vértices, como las piezas
hechas a mano) y el enemigo entero tiene que caber en MAX_TRIS triángulos:
en el castillo va instanciado y en `baja` tiene que salir barato.

    blender -b -P tools/blender/export_enemigos_glb.py                    # todos
    blender -b -P tools/blender/export_enemigos_glb.py -- --only vecino
    ... -- --only vecino --preview /tmp/enemigos   # además, PNG de día y de noche

Salida: art/enemigos/3d/<id>.glb y art/enemigos/3d/manifest.json (lo lee /mar
y lo valida tools/blender/check.py). Sale con 1 si un enemigo se pasa del
presupuesto.
"""
import argparse
import importlib
import json
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import export_islas_glb as EI  # noqa: E402  (tema plano, previsualización, triángulos)
import rig  # noqa: E402
from islas import comun as K  # noqa: E402

# Tope de triángulos por enemigo: un boss cerca del barco en el móvil, y hasta cuatro a la vez en el castillo
# (las islas: 30000; los barcos: 12000). muestra
MAX_TRIS = 9000

ENEMIGOS_DIR = os.path.join(HERE, "enemigos")
OUT = os.path.join(os.path.dirname(os.path.dirname(HERE)), "art", "enemigos", "3d")
NOT_ENEMIES = {"__init__"}


def enemy_ids():
    """Los módulos de enemigo de tools/blender/enemigos/."""
    return sorted(f[:-3] for f in os.listdir(ENEMIGOS_DIR) if f.endswith(".py") and f[:-3] not in NOT_ENEMIES)


def load_enemy(eid):
    return importlib.import_module("enemigos.%s" % eid)


def build(eid):
    """Construye el enemigo en una escena vacía; devuelve (raíz, malla única, módulo, medidas)."""
    mod = load_enemy(eid)
    rig.reset_scene()
    ARC, tema = EI.flat_theme(mod)
    root = bpy.data.objects.new(eid, None)
    bpy.context.scene.collection.objects.link(root)
    Ligero = K.ligero(ARC.escena.Builder, getattr(mod, "DETAIL", 0.5))
    B = Ligero(tema, ARC.temas.A, ARC.M, root)
    with B.zona("enemigo_" + eid), B.pieza(eid):
        info = mod.build(B, K) or {}
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    mesh = bpy.context.view_layer.objects.active
    mesh.name = eid + "_enemigo"
    mesh.data.name = eid + "_enemigo"
    return root, mesh, mod, info


def write_glb(root, mesh, eid):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, eid + ".glb")
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


def manifest_entry(eid, mod, info, tris, path):
    return {
        "id": eid,
        "file": eid + ".glb",
        "label": mod.LABEL,
        "radius": mod.RADIUS,
        "length": round(float(info.get("length", 0.0)), 3),
        "height": round(float(info.get("height", 0.0)), 3),
        "tris": tris,
        "kb": os.path.getsize(path) // 1024,
        "doc": mod.DOC,
    }


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*", help="sólo estos enemigos (módulos de tools/blender/enemigos/)")
    ap.add_argument("--preview", help="carpeta (fuera del repo) para los PNG de día y de noche")
    ap.add_argument("--detalle", action="store_true", help="triángulos por material de cada enemigo")
    a = ap.parse_args(argv)
    ids = a.only or enemy_ids()
    unknown = sorted(set(ids) - set(enemy_ids()))
    if unknown:
        print("[enemigos] sin módulo en tools/blender/enemigos/: %s" % ", ".join(unknown))
        sys.exit(1)
    man = os.path.join(OUT, "manifest.json")
    prev = {}
    if os.path.exists(man):
        with open(man, encoding="utf-8") as f:
            prev = {e["id"]: e for e in json.load(f).get("enemigos", [])}
    over = []
    for eid in ids:
        root, mesh, mod, info = build(eid)
        tris = EI.triangles(mesh)
        if a.detalle:
            print("[tris] %s: %s" % (eid, ", ".join("%s %d" % kv for kv in EI.triangles_by_material(mesh).items())))
        if tris > MAX_TRIS:
            over.append("%s: %d triángulos > %d" % (eid, tris, MAX_TRIS))
            continue
        path = write_glb(root, mesh, eid)
        prev[eid] = manifest_entry(eid, mod, info, tris, path)
        print("[glb] %s.glb: %d triángulos, %d materiales, %d kB"
              % (eid, tris, len(mesh.data.materials), os.path.getsize(path) // 1024))
        if a.preview:
            # La previsualización de las islas mira a `top`: aquí, a media altura del modelo.
            EI.preview(eid, mod, {"top": info.get("height", 1.0) * 0.4}, a.preview)
    with open(man, "w", encoding="utf-8") as f:
        json.dump({
            "status": "muestra",
            "nota": "Generado por tools/blender/export_enemigos_glb.py desde tools/blender/enemigos/<id>.py. No editar.",
            "unidades": "Blender: frente (rumbo 0) a +X, que en glTF (y arriba) sigue siendo +x; agua en y = 0; "
                        "centro en el origen; /mar escala el modelo por su radio de escena / radius",
            "max_tris": MAX_TRIS,
            "enemigos": [prev[k] for k in sorted(prev)],
        }, f, ensure_ascii=False, indent=1)
        f.write("\n")
    if over:
        print("[enemigos] se pasan del presupuesto: %s" % "; ".join(over))
        sys.exit(1)


if __name__ == "__main__":
    main()

"""Las mascotas de Blender del barco del mar 3D (/mar) como glTF (plan 015, T175). MUESTRA.

Cada mascota es un módulo de tools/blender/mascotas/<modulo>.py (su `ID` es el
`MascotKind` de `apps/web/lib/barco/dressing.ts`, p. ej. `canoncito` o
`tortuga-turbo`) que construye el modelo con el Builder de los mundos
(mundos/arcilla/escena.py), como los enemigos de export_enemigos_glb.py: mismo
estilo que las boias y los barcos, un color plano por papel.

A diferencia de los enemigos, una mascota se anima: va en **piezas** (PARTS),
cada una un nodo del glTF con su malla y su pivote (la traslación del nodo).
El motor aplana cada pieza a una geometría con el color en los vértices y la
mueve sólo con transformaciones (`apps/web/app/mar/engine/mascot-models.ts`).

Contrato de un módulo de mascota (ver mascotas/canoncito.py):
    ID, LABEL, DOC        id de la mascota, nombre y una frase para el manifiesto
    PARTS                 {pieza: (x, y, z)} pivote de cada pieza (Blender), en orden
    DETAIL                segmentos por pieza respecto a los mundos (0..1]
    ROLES, GLOW           papeles nuevos: {rol: "#hex"} planos y emisivos
    build(B, K) -> dict   construye con el Builder B (K = islas/comun.py) cada pieza
                          dentro de `with B.pieza(<pieza>)`; devuelve
                          {"length": largo total, "height": alto total}
Frente de la mascota (+x del motor: la proa en cubierta, hacia donde nada en el
agua) a +X de Blender, que en glTF (y arriba) sigue siendo +x; el suelo (la
cubierta o la línea de flotación) en z = 0; unidades de la escena de /mar.

Las mallas de cada pieza se juntan en una (una llamada de dibujo por pieza y
material) y la mascota entera tiene que caber en MAX_TRIS triángulos: va
siempre con el barco, también en `baja`.

    blender -b -P tools/blender/export_mascotas_glb.py                    # todas
    blender -b -P tools/blender/export_mascotas_glb.py -- --only canoncito
    ... -- --only canoncito --detalle               # triángulos por material y pieza

Salida: art/mascotas/3d/<id>.glb y art/mascotas/3d/manifest.json (lo lee /mar
y lo valida tools/blender/check.py). Sale con 1 si una mascota se pasa del
presupuesto.
"""
import argparse
import importlib
import json
import os
import sys

import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import export_islas_glb as EI  # noqa: E402  (tema plano, previsualización, triángulos)
import rig  # noqa: E402
from islas import comun as K  # noqa: E402

# Tope de triángulos por mascota: va siempre pegada al barco, también en el móvil en `baja`
# (el minikraken de a mano ronda los 1 500; los enemigos, 9 000). muestra
MAX_TRIS = 4500

MASCOTAS_DIR = os.path.join(HERE, "mascotas")
OUT = os.path.join(os.path.dirname(os.path.dirname(HERE)), "art", "mascotas", "3d")
NOT_MASCOTS = {"__init__"}


def modules():
    """{id: módulo} de las mascotas de tools/blender/mascotas/ (el id es el `ID` del módulo)."""
    out = {}
    for f in sorted(os.listdir(MASCOTAS_DIR)):
        if not f.endswith(".py") or f[:-3] in NOT_MASCOTS:
            continue
        mod = importlib.import_module("mascotas.%s" % f[:-3])
        out[mod.ID] = mod
    return out


def build(mod):
    """Construye la mascota en una escena vacía; devuelve (raíz, [mallas por pieza], medidas)."""
    rig.reset_scene()
    ARC, tema = EI.flat_theme(mod)
    root = bpy.data.objects.new(mod.ID, None)
    bpy.context.scene.collection.objects.link(root)
    Ligero = K.ligero(ARC.escena.Builder, getattr(mod, "DETAIL", 0.5))
    B = Ligero(tema, ARC.temas.A, ARC.M, root)
    zona = "mascota_" + mod.ID
    with B.zona(zona):
        info = mod.build(B, K) or {}
    parts = []
    for name, pivot in mod.PARTS.items():
        prefix = "%s__%s__" % (zona, name)
        meshes = [o for o in bpy.data.objects if o.type == "MESH" and o.name.startswith(prefix)]
        if not meshes:
            raise ValueError("%s: la pieza %r no tiene mallas (construye dentro de B.pieza(%r))" % (mod.ID, name, name))
        bpy.ops.object.select_all(action="DESELECT")
        for o in meshes:
            o.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]
        bpy.ops.object.join()
        mesh = bpy.context.view_layer.objects.active
        # El pivote: la malla queda en coordenadas de la pieza y el nodo lleva la traslación.
        piv = Vector(pivot)
        mesh.data.transform(Matrix.Translation(-piv))
        mesh.location = piv
        mesh.parent = root
        mesh.matrix_parent_inverse = Matrix.Identity(4)
        mesh.name = name
        mesh.data.name = "%s_%s" % (mod.ID, name)
        parts.append(mesh)
    stray = [o for o in bpy.data.objects if o.type == "MESH" and o not in parts]
    if stray:
        raise ValueError("%s: mallas fuera de las piezas: %s" % (mod.ID, [o.name for o in stray]))
    return root, parts, info


def write_glb(root, parts, mid):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, mid + ".glb")
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for m in parts:
        m.select_set(True)
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


def gltf_pivot(p):
    """Un punto de Blender (z arriba) en glTF (y arriba): (x, z, -y)."""
    return [round(float(p[0]), 4) + 0.0, round(float(p[2]), 4) + 0.0, round(-float(p[1]), 4) + 0.0]


def manifest_entry(mod, parts, info, tris, path):
    return {
        "id": mod.ID,
        "file": mod.ID + ".glb",
        "label": mod.LABEL,
        "length": round(float(info.get("length", 0.0)), 3),
        "height": round(float(info.get("height", 0.0)), 3),
        "parts": [{"name": m.name, "pivot": gltf_pivot(mod.PARTS[m.name]), "tris": EI.triangles(m)} for m in parts],
        "tris": tris,
        "kb": os.path.getsize(path) // 1024,
        "doc": mod.DOC,
    }


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*", help="sólo estas mascotas (ids: `ID` de los módulos de tools/blender/mascotas/)")
    ap.add_argument("--detalle", action="store_true", help="triángulos por material de cada pieza")
    a = ap.parse_args(argv)
    mods = modules()
    ids = a.only or sorted(mods)
    unknown = sorted(set(ids) - set(mods))
    if unknown:
        print("[mascotas] sin módulo en tools/blender/mascotas/: %s" % ", ".join(unknown))
        sys.exit(1)
    man = os.path.join(OUT, "manifest.json")
    prev = {}
    if os.path.exists(man):
        with open(man, encoding="utf-8") as f:
            prev = {e["id"]: e for e in json.load(f).get("mascotas", [])}
    over = []
    for mid in ids:
        mod = mods[mid]
        root, parts, info = build(mod)
        tris = sum(EI.triangles(m) for m in parts)
        if a.detalle:
            for m in parts:
                print("[tris] %s/%s: %s" % (mid, m.name, ", ".join("%s %d" % kv for kv in EI.triangles_by_material(m).items())))
        if tris > MAX_TRIS:
            over.append("%s: %d triángulos > %d" % (mid, tris, MAX_TRIS))
            continue
        path = write_glb(root, parts, mid)
        prev[mid] = manifest_entry(mod, parts, info, tris, path)
        mats = set()
        for m in parts:
            mats.update(x.name for x in m.data.materials)
        print("[glb] %s.glb: %d piezas, %d triángulos, %d materiales, %d kB"
              % (mid, len(parts), tris, len(mats), os.path.getsize(path) // 1024))
    with open(man, "w", encoding="utf-8", newline="\n") as f:
        json.dump({
            "status": "muestra",
            "nota": "Generado por tools/blender/export_mascotas_glb.py desde tools/blender/mascotas/<modulo>.py. No editar.",
            "unidades": "Blender: frente (+x del motor) a +X, que en glTF (y arriba) sigue siendo +x; suelo en y = 0; "
                        "centro en el origen; unidades de la escena de /mar; cada pieza es un nodo con su pivote "
                        "(traslación) y el motor la mueve",
            "max_tris": MAX_TRIS,
            "mascotas": [prev[k] for k in sorted(prev)],
        }, f, ensure_ascii=False, indent=1)
        f.write("\n")
    if over:
        print("[mascotas] se pasan del presupuesto: %s" % "; ".join(over))
        sys.exit(1)


if __name__ == "__main__":
    main()

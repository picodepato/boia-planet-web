"""Blender clean-process bounds/material/name/animation verification of an exported place."""
import argparse
import json
import math
from pathlib import Path
import sys
import bpy


def snapshot():
    deps=bpy.context.evaluated_depsgraph_get(); vertices=[]; triangles=0; collapsed=0
    materials={}
    for obj in bpy.context.scene.objects:
        if obj.type!='MESH': continue
        evaluated=obj.evaluated_get(deps); mesh=evaluated.to_mesh()
        mesh.calc_loop_triangles()
        triangles+=len(mesh.loop_triangles)
        world=[evaluated.matrix_world @ v.co for v in mesh.vertices]
        vertices.extend(world)
        collapsed+=sum((world[t.vertices[1]]-world[t.vertices[0]]).cross(world[t.vertices[2]]-world[t.vertices[0]]).length*.5<=1e-12 for t in mesh.loop_triangles)
        for mat in mesh.materials:
            shader=mat.node_tree.nodes.get('Principled BSDF')
            assert shader, 'missing PBR shader'
            emission=shader.inputs['Emission Color'].default_value
            strength=shader.inputs['Emission Strength'].default_value
            materials[mat.name]={'color':list(shader.inputs['Base Color'].default_value),
                'roughness':shader.inputs['Roughness'].default_value,
                'metallic':shader.inputs['Metallic'].default_value,
                'emission':[v*strength for v in emission[:3]]}
        evaluated.to_mesh_clear()
    assert vertices, 'empty geometry'
    assert all(math.isfinite(x) for v in vertices for x in v), 'nonfinite geometry'
    return {'triangles':triangles,'collapsed_triangles':collapsed,
        'bounds':{'min':[min(v[i] for v in vertices) for i in range(3)],
                  'max':[max(v[i] for v in vertices) for i in range(3)],
                  'radial':max(math.hypot(v.x,v.y) for v in vertices)}, 'materials':materials}

parser=argparse.ArgumentParser(); parser.add_argument('--manifest',required=True); parser.add_argument('--output',required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
path=Path(args.manifest); manifest=json.loads(path.read_text(encoding='utf-8'))
bpy.ops.wm.open_mainfile(filepath=str(path.parent/manifest['source']))
authored=snapshot()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(path.parent/manifest['file']))
nodes={o.name:o for o in bpy.context.scene.objects}
assert manifest['static_node'] in nodes and 'place_'+manifest['id'] in nodes, 'semantic root/static names lost'
deps=bpy.context.evaluated_depsgraph_get(); vertices=[]; triangles=0
for obj in bpy.context.scene.objects:
    if obj.type!='MESH': continue
    evaluated=obj.evaluated_get(deps); mesh=evaluated.to_mesh()
    triangles+=sum(len(p.vertices)-2 for p in mesh.polygons)
    vertices.extend(evaluated.matrix_world @ v.co for v in mesh.vertices)
    evaluated.to_mesh_clear()
minimum=[min(v[i] for v in vertices) for i in range(3)]
maximum=[max(v[i] for v in vertices) for i in range(3)]
radial=max(math.hypot(v.x,v.y) for v in vertices)
assert all(math.isfinite(x) for v in vertices for x in v), 'nonfinite bounds'
assert radial<=1.001 and triangles<=12000 and triangles==manifest['tris'], 'budget mismatch'
assert all(abs(a-b)<.00001 for a,b in zip(minimum,manifest['bounds']['min'])), 'min bounds mismatch'
assert all(abs(a-b)<.00001 for a,b in zip(maximum,manifest['bounds']['max'])), 'max bounds mismatch'
materials=sorted({m.name for o in nodes.values() if o.type=='MESH' for m in o.data.materials})
assert materials, 'missing materials'
imported=snapshot()
assert imported['collapsed_triangles']==0, 'collapsed export triangles'
assert authored['triangles']-authored['collapsed_triangles']==imported['triangles'], 'authored/export triangle mismatch'
assert set(authored['materials'])==set(imported['materials']), 'material names differ'
for name,expected in authored['materials'].items():
    for field,value in expected.items():
        actual=imported['materials'][name][field]
        expected_values=value if isinstance(value,list) else [value]
        actual_values=actual if isinstance(actual,list) else [actual]
        assert all(abs(a-b)<1e-5 for a,b in zip(expected_values,actual_values)), 'PBR material mismatch: '+name+'/'+field
for field in ['min','max']:
    assert all(abs(a-b)<1e-5 for a,b in zip(authored['bounds'][field],imported['bounds'][field])), 'authored/import bounds differ'
for motion in manifest['motion']:
    assert motion['node'] in nodes, 'moving assembly lost'
    assert any(motion['clip'] in a.name for a in bpy.data.actions), 'exported action lost'
result={'blender':bpy.app.version_string,'triangles':triangles,'bounds':{'min':minimum,'max':maximum,'radial':radial},
        'materials':materials,'nodes':sorted(nodes),'actions':[a.name for a in bpy.data.actions],
        'authored':authored,'imported':imported,'pass':True}
out=Path(args.output); out.parent.mkdir(parents=True,exist_ok=True); out.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print('[fresh-import] PASS',triangles,'triangles',len(materials),'materials')

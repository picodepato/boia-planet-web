"""Blender clean-process bounds/material/name/animation verification of an exported place."""
import argparse
import json
import math
from pathlib import Path
import sys
import bpy
from mathutils import Vector


def motion_snapshot(motion, imported=False):
    v=motion['validation']; node=bpy.data.objects[motion['node']]
    scene=bpy.context.scene; scene.render.fps=v['fps']
    assert node.animation_data and node.animation_data.action, 'moving action inactive'
    action=node.animation_data.action
    assert motion['clip'] in action.name, 'wrong active clip'
    first,last=action.frame_range
    assert abs((last-first)/24-motion['duration'])<1e-5, 'action duration differs'
    samples=[]
    for frame in v['sample_frames']:
        scene.frame_set(int(first+frame-v['first_frame']))
        deps=bpy.context.evaluated_depsgraph_get(); points=[]; hands={}
        for obj in node.children_recursive:
            if obj.type!='MESH': continue
            evaluated=obj.evaluated_get(deps); mesh=evaluated.to_mesh()
            world=[evaluated.matrix_world @ p.co for p in mesh.vertices]
            points.extend(world)
            if obj.name in [c['node'] for c in v['contacts']]: hands[obj.name]=world
            evaluated.to_mesh_clear()
        contacts=[]
        for c in v['contacts']:
            hand=bpy.data.objects[c['node']]; actual=hand.matrix_world.translation
            expected=node.matrix_world @ Vector(c['local'])
            assert (actual-expected).length<1e-5, 'hand/local contact differs'
            bottom=v['pole']['bottom']; top=v['pole']['top']
            distance=math.hypot(actual.x-bottom[0],actual.y-bottom[1])
            assert abs(distance-v['pole']['radius'])<=c['radius'], 'hand detached'
            assert bottom[2]<actual.z<top[2], 'hand outside pole span'
            assert min(abs(math.hypot(p.x-bottom[0],p.y-bottom[1])-v['pole']['radius']) for p in hands[c['node']])<.008, 'visible hand misses pole'
            contacts.append(list(actual))
        minimum=[min(p[i] for p in points) for i in range(3)]
        maximum=[max(p[i] for p in points) for i in range(3)]
        assert minimum[2]>=v['stage_top'] and maximum[2]<=v['support_bottom'], 'stage/support collision'
        assert max(math.hypot(p.x,p.y) for p in points)<=1.001, 'motion radius exceeded'
        samples.append({'frame':frame,'pivot':list(node.matrix_world.translation),
                        'min':minimum,'max':maximum,'contacts':contacts})
    assert max(s['pivot'][2] for s in samples)-min(s['pivot'][2] for s in samples)>=v['min_vertical_travel'], 'no motion'
    assert math.dist(samples[0]['pivot'],samples[-1]['pivot'])<1e-5, 'open loop'
    scene.frame_set(int(first+motion['static_frame']-v['first_frame']))
    return {'action':action.name,'action_frame_range':[first,last],'samples':samples}


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
authored_motion=[motion_snapshot(m) for m in manifest['motion'] if 'validation' in m]
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
imported_motion=[motion_snapshot(m,True) for m in manifest['motion'] if 'validation' in m]
for expected,actual in zip(authored_motion,imported_motion):
    for a,b in zip(expected['samples'],actual['samples']):
        for field in ['pivot','min','max']:
            assert all(abs(x-y)<1e-5 for x,y in zip(a[field],b[field])), 'motion phase differs: '+field
        for ca,cb in zip(a['contacts'],b['contacts']):
            assert math.dist(ca,cb)<1e-5, 'imported hand phase differs'
result={'blender':bpy.app.version_string,'triangles':triangles,'bounds':{'min':minimum,'max':maximum,'radial':radial},
        'materials':materials,'nodes':sorted(nodes),'actions':[a.name for a in bpy.data.actions],
        'authored':authored,'imported':imported,'authored_motion':authored_motion,
        'imported_motion':imported_motion,'pass':True}
out=Path(args.output); out.parent.mkdir(parents=True,exist_ok=True); out.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print('[fresh-import] PASS',triangles,'triangles',len(materials),'materials')

"""BOIA sample: Santa Bárbara / Benacantil / Postiguet, procedural editable model.

Blender 5.2.2+: blender -b -P tools/blender/decor/santa_barbara.py -- --preview node_modules/t101-preview
Scene units equal /mar units; Blender Z up, -Y faces the port (+Z in glTF).
Everything is inside the existing radius-13 solid circle, sea level Z=0.
No textures or external assets. Named components remain editable in the .blend.
"""
import argparse
import json
import math
import os
import sys
from pathlib import Path

import bpy
from mathutils import Vector

REPO = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO / 'tools/blender'))
import export_barcos_glb as EB
import rig

OUT = REPO / 'art/decor/3d'
MAX_TRIS = 15000
MAX_BYTES = 600000
COLORS = {'rock': '#ad8970', 'shadow': '#886657', 'stone': '#decaa3',
          'sand': '#edd49a', 'paving': '#eee2cb', 'green': '#75835c',
          'orange': '#f26a1b', 'glow': '#ffcc77'}


def build():
    rig.reset_scene()
    mats = {key: EB.simple_material(key, EB._hex_lin(color), key == 'glow')
            for key, color in COLORS.items()}

    def mesh(name, verts, faces, role):
        data = bpy.data.meshes.new(name)
        data.from_pydata(verts, [], faces)
        data.update()
        obj = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(obj)
        data.materials.append(mats[role])
        return obj

    def box(name, p, size, role='stone', angle=0):
        bpy.ops.mesh.primitive_cube_add(size=1, location=p)
        obj = bpy.context.object
        obj.name = name
        obj.scale = size
        obj.rotation_euler.z = angle
        obj.data.materials.append(mats[role])
        return obj

    def slab(name, points, bottom, top, role):
        n = len(points)
        verts = [(x, y, bottom) for x, y in points] + [(x, y, top) for x, y in points]
        faces = [tuple(reversed(range(n))), tuple(range(n, n * 2))]
        faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
        return mesh(name, verts, faces, role)

    # Elliptical shore keeps the original circular collision footprint. Warm beach at the port side.
    ring = [(12.1 * math.cos(i * math.tau / 32), 11.2 * math.sin(i * math.tau / 32)) for i in range(32)]
    slab('island_shore', ring, -0.35, 0.45, 'rock')
    slab('Postiguet_golden_beach', [(-8,-7),(-6,-9.2),(-2,-10.7),(3,-10.5),(7,-8.7),(9,-6.2),(7,-5.6),(2,-7),(-3,-7.2)], .46, .57, 'sand')
    slab('Postiguet_prom_enade', [(-8,-6.8),(-3,-7),(2,-6.8),(7,-5.4),(7.2,-5.9),(2,-7.3),(-3,-7.5),(-8,-7.3)], .58,.68,'paving')
    # Asymmetric sheer seaward face, rising to Macho at the west end; layered rock, not a cone.
    outlines = [
        (0.5,[(-10,-4),(-7,-6),(-2,-6),(5,-4),(9,0),(6,6),(-4,8),(-9,4)]),
        (5,[(-9,-3),(-6,-5),(-1,-5),(5,-3),(7,0),(5,5),(-4,6),(-8,3)]),
        (10,[(-7,-2),(-5,-3.8),(-1,-3.2),(3,-1),(4,2),(2,4),(-4,4.8),(-7,2)]),
        (14,[(-6,-1),(-4,-2.4),(-1,-1.8),(1,0),(1,2),(-2,3),(-5,2.8),(-6,1)]),
    ]
    verts = [(x,y,z) for z, pts in outlines for x,y in pts]
    faces = []
    for level in range(3):
        for i in range(8):
            a, b = level*8+i, level*8+(i+1)%8
            c, d = (level+1)*8+(i+1)%8, (level+1)*8+i
            faces += [(a,b,c),(a,c,d)]
    faces += [tuple(range(24,32))]
    rock = mesh('Benacantil_sheer_face',verts,faces,'rock')
    rock.data.materials.append(mats['shadow'])
    for p in rock.data.polygons:
        if p.index % 5 == 0: p.material_index = 1
    # Broad low bastions on three levels: Santa Bárbara's silhouette has no fairy-tale round towers.
    for name, pts, z in [
        ('lower_bastion',[(-1,-4.5),(5,-3),(6,0),(3,1),(-1,0)],6.4),
        ('middle_bastion',[(-6,-3),(-2,-3),(1,-1),(0,2),(-5,3)],10.7),
        ('Macho_citadel',[(-6,-1),(-4,-2.3),(-1,-1.7),(1,0),(0,2),(-4,2.6),(-6,1)],14.25),
    ]:
        slab(name+'_terrace',pts,z,z+.55,'stone')
        for i,(x,y) in enumerate(pts):
            nx,ny=pts[(i+1)%len(pts)]
            length=math.hypot(nx-x,ny-y)
            box(name+'_rampart_'+str(i),((x+nx)/2,(y+ny)/2,z+.9),(length,.38,.85),angle=math.atan2(ny-y,nx-x))
    box('castle_long_hall',(-3,.35,15.6),(3.8,1.8,2.1))
    box('square_watchtower',(-5.1,.3,16.6),(1.5,1.5,3.1))
    for i in range(4):
        box('lit_hall_window_'+str(i),(-4.4+i*.9,-.57,15.6),(.24,.04,.45),'glow')
    box('watchtower_light',(-5.1,-.47,16.8),(.3,.03,.6),'glow')
    box('BOIA_flagpole',(-4.6,1,17.8),(.08,.08,2.7),'shadow')
    box('BOIA_flag',(-4.05,1,18.7),(1.1,.05,.55),'orange')
    # Whitewashed houses at the foot and palms along the Postiguet promenade.
    for i in range(5):
        box('old_town_house_'+str(i),(-8+i*1.35,-4.8,.9+(i%2)*.2),(1.05,1,1+(i%2)*.4),'paving')
        box('old_town_roof_'+str(i),(-8+i*1.35,-4.8,1.45+(i%2)*.4),(1.15,1.1,.18),'orange')
    for i in range(6):
        x,y=-6+i*2.2,-6.8+max(0,i-3)*.55
        box('palm_trunk_'+str(i),(x,y,1.45),(.13,.13,1.65),'shadow')
        for a in range(5):
            angle=a*math.tau/5
            box('palm_frond_%s_%s'%(i,a),(x+math.cos(angle)*.37,y+math.sin(angle)*.37,2.3),(.95,.2,.12),'green',angle)
    for i in range(4):
        x,y=-3+i*2.1,-8.9+i*.2
        box('beach_umbrella_pole_'+str(i),(x,y,.95),(.06,.06,.8),'shadow')
        bpy.ops.mesh.primitive_cone_add(vertices=8,radius1=.58,radius2=.1,depth=.22,location=(x,y,1.4))
        bpy.context.object.name='Postiguet_parasol_'+str(i)
        bpy.context.object.data.materials.append(mats['orange' if i%2 else 'paving'])


def export():
    OUT.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'santa-barbara.blend'), compress=False)
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for obj in meshes: obj.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0]
    bpy.ops.object.join()
    obj=bpy.context.object
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    obj.name='Santa_Barbara_Postiguet'
    tris=sum(len(p.vertices)-2 for p in obj.data.polygons)
    path=OUT/'santa-barbara.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,
                             export_texcoords=False,export_normals=True,export_lights=False,export_cameras=False)
    if tris>MAX_TRIS or path.stat().st_size>MAX_BYTES: raise ValueError('decor budget exceeded')
    manifest={'kind':'decor-glb','version':1,'id':'santa-barbara','file':path.name,'source':'santa-barbara.blend',
              'generator':'tools/blender/decor/santa_barbara.py','blender':bpy.app.version_string,
              'license':'muestra interna','tris':tris,'bytes':path.stat().st_size,'max_tris':MAX_TRIS,'max_bytes':MAX_BYTES,
              'radius':13,'units':'mar scene units; Y up; front +Z; water Y=0','materials':list(COLORS),
              'references':['https://www.turismoalicante.es/es/alicante/castillo/castillo-de-santa-barbara-en-alicante',
                            'https://www.turismoalicante.es/es/alicante/playa/playa-del-postiguet-en-alicante']}
    (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    print('[decor]',tris,'triangles,',path.stat().st_size,'bytes')


def preview(directory):
    directory = str((REPO / directory).resolve())
    scene=bpy.context.scene
    scene.render.engine='BLENDER_EEVEE'
    scene.render.resolution_x=1100
    scene.render.resolution_y=800
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.view_settings.view_transform='Standard'
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.02))
    bpy.context.object.data.materials.append(EB.simple_material('sea',EB._hex_lin('#228cac'),False))
    bpy.ops.object.camera_add(location=(27,-46,32))
    camera=bpy.context.object
    camera.data.type='ORTHO'
    camera.data.ortho_scale=39
    camera.rotation_euler=(Vector((0,0,7))-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.camera=camera
    bpy.ops.object.light_add(type='SUN',location=(0,0,40))
    sun=bpy.context.object
    sun.rotation_euler=(.5,-.4,-.6)
    bg=scene.world.node_tree.nodes.get('Background')
    Path(directory).mkdir(parents=True,exist_ok=True)
    for time,energy,color in [('day',3,(.55,.75,1,1)),('night',.2,(.035,.055,.12,1))]:
        sun.data.energy=energy
        bg.inputs['Color'].default_value=color
        bg.inputs['Strength'].default_value=.5
        scene.render.filepath=str(Path(directory)/('santa-barbara-'+time+'.png'))
        bpy.ops.render.render(write_still=True)


if __name__=='__main__':
    ap=argparse.ArgumentParser()
    ap.add_argument('--preview')
    args=ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    build()
    export()
    if args.preview: preview(args.preview)

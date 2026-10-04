"""Independent normalized BOIA place assets; no live island registry changes."""
import json
import math
from pathlib import Path
import bpy
import struct
from mathutils import Vector

REPO = Path(__file__).resolve().parents[3]
MAX_TRIS = 12000
MAX_BYTES = 600000


def start(place_id, palette):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for group in (bpy.data.meshes, bpy.data.materials, bpy.data.actions):
        for item in list(group):
            if item.users == 0: group.remove(item)
    bpy.context.scene.unit_settings.system = 'METRIC'
    root = bpy.data.objects.new('place_' + place_id, None)
    bpy.context.collection.objects.link(root)
    mats = {}
    for name, color in palette.items():
        mat = bpy.data.materials.new(name)
        mat.diffuse_color = (*color, 1)
        mat.use_nodes = True
        shader = mat.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value = (*color, 1)
        shader.inputs['Roughness'].default_value = .78
        if name == 'lantern':
            shader.inputs['Emission Color'].default_value = (*color, 1)
            shader.inputs['Emission Strength'].default_value = .6
        mats[name] = mat
    return root, mats


def export(place_id, root, source, references, approach, motion=None, license_note=None):
    """Static batching preserves separate semantic animated assemblies when provided.

    motion: [{node, clip, duration, static_frame}], rigid node transforms only.
    Source children inside a named moving assembly are never joined into static.
    """
    out = REPO / 'art/places/3d' / place_id
    out.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.render.fps = 24
    # Process-local preferences: keep backups/thumbnails inside the workspace only.
    bpy.context.preferences.filepaths.save_version = 0
    bpy.context.preferences.filepaths.file_preview_type = 'NONE'
    bpy.ops.wm.save_as_mainfile(filepath=str(out / (place_id + '.blend')), compress=False)
    moving = {m['node'] for m in motion or []}
    meshes = [o for o in root.children_recursive if o.type == 'MESH']
    static = []
    for obj in meshes:
        p = obj
        while p and p.name not in moving: p = p.parent
        if p is None: static.append(obj)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in static:
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        for mod in list(obj.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
    if static:
        bpy.context.view_layer.objects.active = static[0]
        bpy.ops.object.join()
        bpy.context.object.name = 'static_' + place_id
    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for obj in root.children_recursive: obj.select_set(True)
    path = out / (place_id + '.glb')
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
        export_yup=True, export_apply=True, export_normals=True, export_texcoords=False,
        export_lights=False, export_cameras=False, export_animations=bool(motion))
    removed = clean_collapsed_triangles(path)
    print('[place-export] removed', removed, 'collapsed tessellation triangles; editable modifiers retained')
    tris = 0
    deps = bpy.context.evaluated_depsgraph_get()
    bounds = []
    for obj in root.children_recursive:
        if obj.type != 'MESH': continue
        evaluated = obj.evaluated_get(deps)
        mesh = evaluated.to_mesh()
        tris += sum(len(p.vertices)-2 for p in mesh.polygons)
        bounds.extend(obj.matrix_world @ v.co for v in mesh.vertices)
        evaluated.to_mesh_clear()
    minimum = [min(p[i] for p in bounds) for i in range(3)]
    maximum = [max(p[i] for p in bounds) for i in range(3)]
    radial = max(math.hypot(p.x, p.y) for p in bounds)
    tris -= removed
    if tris > MAX_TRIS or path.stat().st_size > MAX_BYTES or radial > 1.001:
        raise ValueError('place triangle/byte/normalized radius budget exceeded')
    manifest = {'kind':'place-glb','version':1,'id':place_id,'file':path.name,
        'source':place_id+'.blend','generator':source,'blender':bpy.app.version_string,
        'units':'normalized radius 1; glTF Y up; front +Z; water Y=0',
        'radius':1,'scale_rule':'current scene collision radius / radius',
        'max_tris':MAX_TRIS,'max_bytes':MAX_BYTES,'tris':tris,'bytes':path.stat().st_size,
        'bounds':{'min':[round(v,6) for v in minimum], 'max':[round(v,6) for v in maximum],
                  'coordinate_system':'Blender Z up; front -Y','radial':round(radial,6)},
        'height':round(maximum[2],6),'static_node':'static_'+place_id,
        'motion':motion or [],'approach':approach,'references':references,
        'license':license_note or 'original BOIA sample; external photographs used only as visual references'}
    (out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    print('[place]', place_id, tris, 'triangles', path.stat().st_size, 'bytes; radius', radial)
    return out


def clean_collapsed_triangles(path):
    """Export-stage topology filter preserving authored split/weighted normals.

    Bevel-clamped corners can triangulate to zero-area faces in glTF. Filtering
    those indices here is reproducible source processing, not a manual asset edit.
    Vertex/normal buffers and visible triangles are untouched; unused buffer
    padding is retained to preserve offsets for animation and other accessors.
    """
    data=path.read_bytes()
    json_size=struct.unpack_from('<I',data,12)[0]
    doc=json.loads(data[20:20+json_size])
    binary_start=20+json_size+8
    binary=bytearray(data[binary_start:])
    removed=0
    for mesh in doc['meshes']:
        for primitive in mesh['primitives']:
            pa=doc['accessors'][primitive['attributes']['POSITION']]
            pv=doc['bufferViews'][pa['bufferView']]
            ps=pv.get('byteOffset',0)+pa.get('byteOffset',0)
            positions=[Vector(struct.unpack_from('<fff',binary,ps+i*pv.get('byteStride',12))) for i in range(pa['count'])]
            ia=doc['accessors'][primitive['indices']]; iv=doc['bufferViews'][ia['bufferView']]
            fmt='<'+{5121:'B',5123:'H',5125:'I'}[ia['componentType']]
            step=struct.calcsize(fmt); start=iv.get('byteOffset',0)+ia.get('byteOffset',0)
            indices=[struct.unpack_from(fmt,binary,start+i*step)[0] for i in range(ia['count'])]
            valid=[]
            for i in range(0,len(indices),3):
                a,b,c=(positions[j] for j in indices[i:i+3])
                if (b-a).cross(c-a).length*.5<=1e-12: removed+=1
                else: valid.extend(indices[i:i+3])
            for i,index in enumerate(valid): struct.pack_into(fmt,binary,start+i*step,index)
            ia['count']=len(valid)
            if valid: ia['min']=[min(valid)]; ia['max']=[max(valid)]
    encoded=json.dumps(doc,separators=(',',':')).encode('utf-8')
    encoded+=b' '*((-len(encoded))%4)
    result=struct.pack('<III',0x46546c67,2,12+8+len(encoded)+8+len(binary))
    result+=struct.pack('<II',len(encoded),0x4e4f534a)+encoded
    result+=struct.pack('<II',len(binary),0x004e4942)+binary
    path.write_bytes(result)
    return removed


def render_preview(root, directory, gray=False, distance_camera=None, target_height=.1, ortho_scale=2.7):
    directory = Path(directory).resolve()
    directory.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 1000
    scene.render.resolution_y = 750
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.exposure = 0
    scene.world = bpy.data.worlds.new('place_preview_world')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get('Background')
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,0))
    sea = bpy.context.object
    sea.name = 'preview_sea'
    mat = bpy.data.materials.new('preview_sea_material')
    mat.diffuse_color = (.026,.22,.32,1)
    mat.use_nodes = True
    mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = mat.diffuse_color
    mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .88
    sea.data.materials.append(mat)
    bpy.ops.object.camera_add(location=(2.3,-3.8,2.5))
    cam = bpy.context.object
    cam.name = 'harbor_hero'
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = ortho_scale
    cam.rotation_euler = (Vector((0,0,target_height))-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.camera = cam
    bpy.ops.object.light_add(type='SUN')
    sun=bpy.context.object
    sun.rotation_euler=(.4,-.5,-.45)
    if gray:
        graymat = bpy.data.materials.new('graybox_review')
        graymat.diffuse_color = (.5,.5,.5,1)
        for obj in root.children_recursive:
            if obj.type=='MESH': obj.data.materials.clear(); obj.data.materials.append(graymat)
    for time,energy,color in [('day',2.4,(.5,.67,.8,1)),('night',.35,(.08,.11,.2,1))]:
        sun.data.energy=energy
        bg.inputs['Color'].default_value=color
        bg.inputs['Strength'].default_value=.55
        scene.render.filepath=str(directory/('graybox' if gray else 'hero-'+time))
        bpy.ops.render.render(write_still=True)
        if gray: break
    if gray: return
    # Explicit vertical sensor fit matches Three.js vertical FOV, regardless of aspect.
    settings=json.loads(Path(distance_camera).read_text(encoding='utf-8'))
    cam.data.type='PERSP'
    cam.data.sensor_fit='VERTICAL'
    cam.data.sensor_height=32
    cam.data.lens=cam.data.sensor_height/(2*math.tan(math.radians(settings['fov_vertical_degrees'])/2))
    cam.location=settings['location_blender']
    cam.rotation_euler=(Vector(settings['target_blender'])-cam.location).to_track_quat('-Z','Y').to_euler()
    for time,energy,color in [('day',2.4,(.5,.67,.8,1)),('night',.35,(.08,.11,.2,1))]:
        sun.data.energy=energy
        bg.inputs['Color'].default_value=color
        scene.render.filepath=str(directory/('distance-'+time))
        bpy.ops.render.render(write_still=True)
    (directory/'preview-settings.json').write_text(json.dumps(settings,indent=2)+'\n',encoding='utf-8')

"""Independent place GLB/schema validator, standard library only. Does not register live assets."""
import argparse
import json
import math
from pathlib import Path
import struct
import sys
import hashlib

HERE=Path(__file__).resolve().parent
REPO=HERE.parents[2]
sys.path.insert(0,str(HERE.parent))
import check as asset_check


def read_accessor(doc, binary, index):
    acc = doc['accessors'][index]
    if acc.get('sparse'): raise ValueError('sparse accessor outside place contract')
    view = doc['bufferViews'][acc['bufferView']]
    count = {'SCALAR':1, 'VEC3':3, 'VEC4':4}[acc['type']]
    kind = {5121:'B', 5123:'H', 5125:'I', 5126:'f'}[acc['componentType']]
    fmt = '<' + kind * count
    size = struct.calcsize(fmt)
    offset = acc.get('byteOffset', 0)
    stride = view.get('byteStride', size)
    if stride < size or offset + (acc['count']-1)*stride + size > view['byteLength']:
        raise ValueError('accessor exceeds buffer view')
    start = view.get('byteOffset', 0) + offset
    return [struct.unpack_from(fmt, binary, start+i*stride) for i in range(acc['count'])]


def node_worlds(doc, overrides=None):
    """World transforms of meshes reachable from the default glTF scene."""
    identity = [[float(i == j) for j in range(4)] for i in range(4)]
    def visit(index, parent, ancestors):
        if index in ancestors: raise ValueError('cyclic node hierarchy')
        node = dict(doc['nodes'][index]); node.update((overrides or {}).get(index, {}))
        if 'matrix' in node:
            local = [[node['matrix'][c*4+r] for c in range(4)] for r in range(4)]
        else:
            x,y,z,w = node.get('rotation', [0,0,0,1])
            s = node.get('scale', [1,1,1]); t = node.get('translation', [0,0,0])
            local = [[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w),t[0]],
                     [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w),t[1]],
                     [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y),t[2]], [0,0,0,1]]
            for r in range(3):
                for c in range(3): local[r][c] *= s[c]
        world = [[sum(parent[r][k]*local[k][c] for k in range(4)) for c in range(4)] for r in range(4)]
        yield index, world
        for child in node.get('children', []): yield from visit(child, world, ancestors | {index})
    for node in doc['scenes'][doc.get('scene', 0)]['nodes']:
        yield from visit(node, identity, set())


def mesh_instances(doc, overrides=None):
    for index, matrix in node_worlds(doc, overrides):
        if 'mesh' in doc['nodes'][index]: yield doc['nodes'][index]['mesh'], matrix


def sample_clip(doc, binary, clip, time):
    """Independent glTF transform sampling; our rigid export uses LINEAR/STEP."""
    pose = {}
    for channel in clip.get('channels', []):
        sampler = clip['samplers'][channel['sampler']]
        times = [v[0] for v in read_accessor(doc, binary, sampler['input'])]
        values = read_accessor(doc, binary, sampler['output'])
        if sampler.get('interpolation', 'LINEAR') not in ['LINEAR', 'STEP']:
            raise ValueError('unsupported motion interpolation')
        k = next((i for i in range(len(times)-1) if time <= times[i+1]), len(times)-2)
        k = max(0, k)
        u = max(0, min(1, (time-times[k])/(times[k+1]-times[k]))) if len(times)>1 else 0
        if sampler.get('interpolation') == 'STEP': u = 0
        value = tuple(a+(b-a)*u for a,b in zip(values[k],values[min(k+1,len(values)-1)]))
        if channel['target']['path'] == 'rotation':
            # Our authored motion has no rotation. Reject it rather than approximate slerp.
            raise ValueError('pole contract permits translation only')
        pose.setdefault(channel['target']['node'], {})[channel['target']['path']] = value
    return pose


def blender_point(point): return (point[0], -point[2], point[1])
def gltf_point(point): return (point[0], point[2], -point[1])


def motion_errors(doc, binary, motion):
    errors=[]; v=motion.get('validation')
    if not v: return ['motion validation metadata missing']
    nodes=doc['nodes']; names={n.get('name'):i for i,n in enumerate(nodes)}
    clip=next((c for c in doc.get('animations',[]) if c.get('name')==motion['clip']),None)
    index=names.get(motion['node'])
    if clip is None or index is None: return errors
    if any(c['target']['node']!=index or c['target']['path']!='translation' for c in clip['channels']):
        return ['motion channel target mismatch']
    if not v['first_frame']<=motion['static_frame']<=v['last_frame']: errors.append('static frame outside clip')
    if abs((v['last_frame']-v['first_frame'])/v['fps']-motion['duration'])>1e-6: errors.append('authored frame duration mismatch')
    inputs=[read_accessor(doc,binary,s['input']) for s in clip['samplers']]
    if any(not math.isfinite(x) for s in clip['samplers'] for value in read_accessor(doc,binary,s['output']) for x in value):
        return ['non finite animation']
    start=min(t[0] for values in inputs for t in values); end=max(t[0] for values in inputs for t in values)
    if any(not math.isfinite(t[0]) for values in inputs for t in values): errors.append('non finite animation')
    for values in inputs:
        if any(a[0]>=b[0] for a,b in zip(values,values[1:])): errors.append('non increasing animation times')
    phases=[start+(end-start)*i/96 for i in range(97)]
    positions=[]; moving_points=[]
    def descendants(i):
        return {i}.union(*(descendants(c) for c in nodes[i].get('children',[])))
    moving=descendants(index)
    # Static batching removes the semantic pole object. Locate its actual two
    # circumference rings in world geometry, tying metadata to exported support.
    static_points=[]
    default_worlds=dict(node_worlds(doc))
    for ni in default_worlds:
        if ni in moving or 'mesh' not in nodes[ni]: continue
        for p in doc['meshes'][nodes[ni]['mesh']]['primitives']:
            static_points.extend(blender_point(world_point(default_worlds[ni],point)) for point in read_accessor(doc,binary,p['attributes']['POSITION']))
    for endpoint in [v['pole']['bottom'],v['pole']['top']]:
        ring=[p for p in static_points if abs(p[2]-endpoint[2])<1e-5 and abs(math.hypot(p[0]-endpoint[0],p[1]-endpoint[1])-v['pole']['radius'])<1e-5]
        if len(ring)<16: errors.append('declared pole does not match static geometry')
    for contact in v['contacts']:
        ci=names.get(contact['node'])
        if ci not in moving or ci is None or 'mesh' not in nodes[ci]: errors.append('visible hand contact node missing')
    if errors: return errors
    for time in phases:
        pose=sample_clip(doc,binary,clip,time); worlds=dict(node_worlds(doc,pose))
        positions.append(blender_point(world_point(worlds[index],(0,0,0))))
        for contact in v['contacts']:
            ci=names[contact['node']]
            expected=blender_point(world_point(worlds[index],gltf_point(contact['local'])))
            actual=blender_point(world_point(worlds[ci],(0,0,0)))
            if math.dist(expected,actual)>1e-5: errors.append('hand/local contact mismatch')
            radial=math.hypot(actual[0]-v['pole']['bottom'][0],actual[1]-v['pole']['bottom'][1])
            if abs(radial-v['pole']['radius'])>contact['radius'] or not v['pole']['bottom'][2]<actual[2]<v['pole']['top'][2]:
                errors.append('hand detached from pole')
            # Validate actual visible mitten geometry, not just a metadata point.
            hand=[]
            for p in doc['meshes'][nodes[ci]['mesh']]['primitives']:
                hand.extend(blender_point(world_point(worlds[ci],pnt)) for pnt in read_accessor(doc,binary,p['attributes']['POSITION']))
            if min(abs(math.hypot(p[0]-v['pole']['bottom'][0],p[1]-v['pole']['bottom'][1])-v['pole']['radius']) for p in hand)>.008:
                errors.append('hand geometry misses pole')
        phase=[]
        for ni in moving:
            if 'mesh' not in nodes[ni]: continue
            for p in doc['meshes'][nodes[ni]['mesh']]['primitives']:
                phase.extend(blender_point(world_point(worlds[ni],pnt)) for pnt in read_accessor(doc,binary,p['attributes']['POSITION']))
        moving_points.extend(phase)
        if any(math.hypot(p[0],p[1])>1.001 for p in phase): errors.append('animated normalized radius exceeded')
        if min(p[2] for p in phase)<v['stage_top'] or max(p[2] for p in phase)>v['support_bottom']:
            errors.append('mascot intersects stage/support')
    if math.dist(positions[0],v['pivot'])>1e-5: errors.append('motion pivot mismatch')
    static_time=start+(motion['static_frame']-v['first_frame'])/v['fps']
    static_pose=dict(node_worlds(doc,sample_clip(doc,binary,clip,static_time)))
    default_pose=dict(node_worlds(doc))
    if math.dist(world_point(static_pose[index],(0,0,0)),world_point(default_pose[index],(0,0,0)))>1e-5:
        errors.append('default pose differs from reduced motion frame')
    if max(p[2] for p in positions)-min(p[2] for p in positions)<v['min_vertical_travel']: errors.append('motion has no vertical travel')
    if any(math.dist(p[:2],positions[0][:2])>1e-5 for p in positions): errors.append('motion leaves pole axis')
    if math.dist(positions[0],positions[-1])>1e-5: errors.append('motion loop open')
    # One-sided seam velocities must be close to zero (normalized units/second).
    if max(math.dist(positions[0],positions[1]),math.dist(positions[-1],positions[-2]))*24>.015:
        errors.append('motion loop seam velocity discontinuity')
    for axis in range(3):
        if abs(min(p[axis] for p in moving_points)-v['moving_bounds']['min'][axis])>1e-5 or abs(max(p[axis] for p in moving_points)-v['moving_bounds']['max'][axis])>1e-5:
            errors.append('animated bounds mismatch')
    return sorted(set(errors))


def world_point(matrix, point):
    return tuple(sum(matrix[r][c]*point[c] for c in range(3)) + matrix[r][3] for r in range(3))


def area(a, b, c):
    u = [b[i]-a[i] for i in range(3)]; v = [c[i]-a[i] for i in range(3)]
    cross = [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
    return math.sqrt(sum(x*x for x in cross)) * .5


def read_glb(path):
    data=Path(path).read_bytes()
    magic,version,total=struct.unpack_from('<III',data)
    if magic!=0x46546c67 or version!=2 or total!=len(data): raise ValueError('invalid GLB header')
    pos=12; doc=None; binary=None
    while pos<len(data):
        size,kind=struct.unpack_from('<II',data,pos); pos+=8
        chunk=data[pos:pos+size]; pos+=size
        if len(chunk)!=size: raise ValueError('truncated GLB chunk')
        if kind==0x4e4f534a: doc=json.loads(chunk)
        if kind==0x004e4942: binary=chunk
    if doc is None or binary is None: raise ValueError('missing GLB chunks')
    return doc,binary


def verify(directory):
    directory=Path(directory)
    man=json.loads((directory/'manifest.json').read_text(encoding='utf-8'))
    schema=json.loads((HERE/'place3d.schema.json').read_text(encoding='utf-8'))
    errors=asset_check.validate(man,schema,schema)
    def finite_metadata(value):
        if isinstance(value,dict): return all(finite_metadata(v) for v in value.values())
        if isinstance(value,list): return all(finite_metadata(v) for v in value)
        return not isinstance(value,(int,float)) or math.isfinite(value)
    if not finite_metadata(man): errors.append('non finite manifest value')
    if errors: return errors
    pid=man['id']
    if (man['file']!=pid+'.glb' or man['source']!=pid+'.blend'
        or man['static_node']!='static_'+pid or man['generator']!='tools/blender/places/'+pid+'.py'):
        errors.append('identity/file mismatch')
    if not (directory/man['source']).is_file(): errors.append('editable blend missing')
    if not (REPO/man['generator']).is_file(): errors.append('source generator missing')
    glb=directory/man['file']; doc,binary=read_glb(glb)
    if glb.stat().st_size!=man['bytes'] or glb.stat().st_size>600000: errors.append('byte budget/count mismatch')
    nodes=doc.get('nodes',[]); names={n.get('name') for n in nodes}
    if man['static_node'] not in names or 'place_'+pid not in names: errors.append('semantic static/root node missing')
    clips={a.get('name'):a for a in doc.get('animations',[])}
    declared={m['clip'] for m in man['motion']}
    if set(clips)!=declared: errors.append('named animation clip mismatch')
    for motion in man['motion']:
        if motion['node'] not in names: errors.append('motion node missing')
        clip=clips.get(motion['clip'],{})
        if not clip.get('channels'): errors.append('motion clip has no exported channels')
        times=[]
        for sampler in clip.get('samplers',[]):
            accessor=doc['accessors'][sampler['input']]
            times.extend(accessor.get('min',[])+accessor.get('max',[]))
        if times and abs(max(times)-min(times)-motion['duration'])>.05: errors.append('motion duration mismatch')
        if pid=='fotos' or 'validation' in motion: errors.extend(motion_errors(doc,binary,motion))
    tris=0; points=[]
    for mesh_index, matrix in mesh_instances(doc):
        mesh = doc['meshes'][mesh_index]
        for p in mesh['primitives']:
            if p.get('mode',4)!=4: errors.append('non triangle primitive')
            vertices=[world_point(matrix, v) for v in read_accessor(doc,binary,p['attributes']['POSITION'])]
            if not all(math.isfinite(v) for point in vertices for v in point): errors.append('non finite vertex')
            indices=[v[0] for v in read_accessor(doc,binary,p['indices'])] if 'indices' in p else list(range(len(vertices)))
            tris+=len(indices)//3
            if len(indices)%3: errors.append('incomplete triangle')
            if any(i<0 or i>=len(vertices) for i in indices):
                errors.append('triangle index out of range'); continue
            if any(area(*(vertices[j] for j in indices[i:i+3]))<=1e-12 for i in range(0,len(indices)-2,3)):
                errors.append('degenerate triangle')
            # glTF Y-up -> authored Blender Z-up. Only referenced vertices count.
            points.extend((vertices[j][0],-vertices[j][2],vertices[j][1]) for j in indices)
            if not 0<=p.get('material',-1)<len(doc.get('materials',[])): errors.append('missing material')
    if points:
        minimum=[min(v[i] for v in points) for i in range(3)]
        maximum=[max(v[i] for v in points) for i in range(3)]
        radial=max(math.hypot(v[0],v[1]) for v in points)
        if any(abs(a-b)>1e-5 for a,b in zip(minimum+maximum,man['bounds']['min']+man['bounds']['max'])):
            errors.append('transformed bounds mismatch')
        if radial>1.001 or abs(radial-man['bounds']['radial'])>1e-5: errors.append('normalized radius mismatch')
        if abs(maximum[2]-man['height'])>1e-5: errors.append('height mismatch')
        # Optional open-water approach (T111 cove mouth): within the clear sector,
        # from `from_radius` outwards, no exported geometry rises above max_height.
        channel=man['approach'].get('channel')
        if channel:
            low,high=man['approach']['clear_sector_degrees']
            if any(math.hypot(x,y)>=channel['from_radius'] and low<=math.degrees(math.atan2(x,-y))<=high
                   and z>channel['max_height']+1e-6 for x,y,z in points):
                errors.append('approach channel obstructed')
    else: errors.append('empty placed geometry')
    if tris!=man['tris'] or tris>12000: errors.append('triangle budget/count mismatch')
    if not man['motion'] and len(doc.get('meshes',[]))!=1: errors.append('static place must be batched to one mesh')
    if doc.get('images') or doc.get('textures'): errors.append('place contract excludes image textures/external media')
    for n in nodes:
        if not all(math.isfinite(v) for field in ['translation','rotation','scale','matrix'] for v in n.get(field,[])):
            errors.append('non finite node transform')
    print('[place-check]',pid,tris,'triangles',glb.stat().st_size,'bytes',len(clips),'clips')
    return errors


def geometry_signature(path):
    """Static world geometry, winding, normals and material appearance, independent of buffer order.

    This is not an animation equivalence check; future motion needs sampled poses.
    """
    doc,binary=read_glb(path)
    triangles=[]
    for mesh_index,matrix in mesh_instances(doc):
        mesh=doc['meshes'][mesh_index]
        for p in mesh['primitives']:
            vertices=[world_point(matrix,v) for v in read_accessor(doc,binary,p['attributes']['POSITION'])]
            normals=read_accessor(doc,binary,p['attributes']['NORMAL'])
            indices=[v[0] for v in read_accessor(doc,binary,p['indices'])]
            role=json.dumps(doc['materials'][p['material']],sort_keys=True)
            for i in range(0,len(indices),3):
                points=tuple(tuple(round(v,6) for v in vertices[j]+normals[j]) for j in indices[i:i+3])
                triangles.append((role,min(points[k:]+points[:k] for k in range(3))))
    return hashlib.sha256(json.dumps(sorted(triangles),separators=(',',':')).encode()).hexdigest()


if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('directory',nargs='?',default=str(REPO/'art/places/3d/cala'))
    args=parser.parse_args()
    try: errors=verify(args.directory)
    except (ValueError,KeyError,IndexError,struct.error,OSError) as exc: errors=[str(exc)]
    for error in errors: print('FAIL',error)
    sys.exit(1 if errors else 0)

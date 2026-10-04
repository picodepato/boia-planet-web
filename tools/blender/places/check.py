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
    count = {'SCALAR':1, 'VEC3':3}[acc['type']]
    kind = {5121:'B', 5123:'H', 5125:'I', 5126:'f'}[acc['componentType']]
    fmt = '<' + kind * count
    size = struct.calcsize(fmt)
    offset = acc.get('byteOffset', 0)
    stride = view.get('byteStride', size)
    if stride < size or offset + (acc['count']-1)*stride + size > view['byteLength']:
        raise ValueError('accessor exceeds buffer view')
    start = view.get('byteOffset', 0) + offset
    return [struct.unpack_from(fmt, binary, start+i*stride) for i in range(acc['count'])]


def mesh_instances(doc):
    """World transforms of meshes reachable from the default glTF scene."""
    identity = [[float(i == j) for j in range(4)] for i in range(4)]
    def visit(index, parent, ancestors):
        if index in ancestors: raise ValueError('cyclic node hierarchy')
        node = doc['nodes'][index]
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
        if 'mesh' in node: yield node['mesh'], world
        for child in node.get('children', []): yield from visit(child, world, ancestors | {index})
    for node in doc['scenes'][doc.get('scene', 0)]['nodes']:
        yield from visit(node, identity, set())


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

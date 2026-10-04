"""Polished clay Alicante marina: independent normalized asset for future runtime hookup."""
import argparse
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

sys.path.insert(0,str(Path(__file__).resolve().parent))
import common

PALETTE={'chalk':(.86,.82,.69),'white':(.94,.92,.85),'blue':(.09,.28,.43),
 'stone':(.57,.48,.37),'sand':(.7,.6,.43),'wood':(.32,.17,.08),'leaf':(.18,.36,.16),
 'orange':(.93,.25,.045),'navy':(.025,.045,.1),'lantern':(1,.67,.24)}
REFERENCES=['https://nuevo.puertoalicante.com/puerto-ciudad/espacios-publicos/',
 'https://www.puertoalicante.com/wp-content/uploads/2024/03/ocio-marina.jpg']
PIERS=[-.43,0,.43]
BERTHS=[(-.57,-.30),(-.28,-.25),(-.14,-.30),(.15,-.28),(.29,-.32),(.57,-.26)]
PALMS=[(-.65,.33),(.64,.33),(-.46,.59),(.46,.59)]


def build(gray=False):
    root,mats=common.start('cala',PALETTE)
    def finish(o,name,role):
        o.name=name; o.parent=root; o.data.materials.append(mats[role]); return o
    def box(name,p,size,role,bevel=.012):
        bpy.ops.mesh.primitive_cube_add(size=1,location=p)
        o=bpy.context.object; o.scale=size
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        finish(o,name,role)
        if bevel:
            m=o.modifiers.new('soft_clay_edges','BEVEL'); m.width=bevel; m.segments=2
            m=o.modifiers.new('weighted_corner_normals','WEIGHTED_NORMAL')
        return o
    def blob(name,p,size,role,seg=12,rings=6):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,radius=1,location=p)
        o=bpy.context.object; o.scale=size; finish(o,name,role)
        for poly in o.data.polygons: poly.use_smooth=True
        return o
    def tube(name,a,b,r,role,n=8):
        a,b=Vector(a),Vector(b); v=b-a
        bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=v.length,location=(a+b)*.5)
        o=bpy.context.object; o.rotation_euler=v.to_track_quat('Z','Y').to_euler()
        return finish(o,name,role)
    def slab(name,points,bottom,top,role):
        n=len(points)
        mesh=bpy.data.meshes.new(name)
        mesh.from_pydata([(x,y,bottom) for x,y in points]+[(x,y,top) for x,y in points],[],
          [tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)])
        o=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(o); finish(o,name,role)
        mod=o.modifiers.new('soft_quay_edges','BEVEL'); mod.width=.008; mod.segments=2
        return o
    # Back shore is a circular cap; U-shaped front quays explain the open marina basin.
    points=[(.93*math.cos(i*math.pi/24),.93*math.sin(i*math.pi/24)) for i in range(25)]
    slab('Alicante_land_cap',points,-.055,.045,'sand')
    box('connected_promenade',(0,.08,.072),(1.75,.22,.10),'chalk')
    for sign in [-1,1]:
        box('outer_quay_'+str(sign),(sign*.77,-.21,.046),(.16,.52,.105),'stone')
        box('quay_walkway_'+str(sign),(sign*.77,-.21,.102),(.145,.51,.022),'chalk',.005)
    # A low white/blue marina facade, stepped volumes, parapets, recessed doors and pergola.
    box('marina_white_facade',(0,.42,.225),(.88,.29,.34),'white',.022)
    box('blue_upper_story',(0,.42,.37),(.38,.30,.16),'blue',.014)
    box('main_parapet',(0,.42,.468),(.42,.34,.035),'white',.008)
    for sign in [-1,1]:
        box('side_roof_'+str(sign),(sign*.32,.42,.402),(.30,.33,.04),'chalk',.007)
    if gray:
        for i,x in enumerate(PIERS): box('gray_pier_'+str(i),(x,-.26,.052),(.065,.60,.08),'wood',0)
        for i,(x,y) in enumerate(BERTHS): blob('gray_hull_'+str(i),(x,y,.022),(.052,.135,.035),'white',16,6)
        for i,(x,y) in enumerate(PALMS):
            tube('gray_palm_stem_'+str(i),(x,y,.045),(x,y,.48),.015,'wood')
            blob('gray_palm_crown_'+str(i),(x,y,.48),(.17,.17,.03),'leaf')
        return root
    for i in range(7):
        x=(i-3)*.113
        box('recessed_shopfront_'+str(i),(x,.264,.2),(.076,.012,.15),'navy',.008)
        box('window_sill_'+str(i),(x,.251,.129),(.085,.022,.013),'chalk',.003)
        box('shopfront_head_'+str(i),(x,.251,.273),(.089,.022,.015),'chalk',.004)
    for i in [-1,0,1]:
        box('upper_glazing_'+str(i),(i*.105,.262,.365),(.071,.014,.072),'navy',.008)
    # Visible rounded doorway and BOIA orange canopy connect the public terrace.
    box('marina_terrace',(0,.186,.125),(.69,.12,.026),'stone',.006)
    for x in [-.31,.31]: tube('canopy_support_'+str(x),(x,.176,.13),(x,.176,.3),.012,'white')
    box('BOIA_canopy',(0,.185,.303),(.72,.16,.022),'orange',.008)
    for i in range(8):
        box('promenade_paving_'+str(i),(-.70+i*.20,.027,.128),(.008,.18,.003),'stone',0)
    for x in [-.64,.61]:
        box('bench_seat_'+str(x),(x,.085,.158),(.15,.043,.025),'wood',.005)
        box('bench_back_'+str(x),(x,.112,.195),(.15,.016,.077),'wood',.004)
        for dx in [-.05,.05]: box('bench_leg_'+str(x)+str(dx),(x+dx,.085,.13),(.014,.03,.04),'navy',.003)
    # Four palms use bowed stems and curved leaves, not flat cross-shaped foliage.
    for i,(x,y) in enumerate(PALMS):
        blob('palm_planter_'+str(i),(x,y,.067),(.085,.085,.04),'stone',12,4)
        top=.48+(i%2)*.045
        tube('palm_bowed_base_'+str(i),(x,y,.07),(x+.013,y,.27),.015,'wood',10)
        tube('palm_stem_'+str(i),(x+.013,y,.27),(x+.04,y,top),.012,'wood',10)
        for j in range(6):
            angle=j*math.tau/6+i*.4
            vertices=[]
            for s in range(6):
                u=s/5; d=.17*u; w=.035*math.sin(math.pi*u)+.003
                z=top+.045*math.sin(math.pi*u)-.075*u*u
                for side in [-1,1]: vertices.append((x+.04+math.cos(angle)*d+math.sin(angle)*w*side,y+math.sin(angle)*d-math.cos(angle)*w*side,z))
            mesh=bpy.data.meshes.new('palm_leaf'); mesh.from_pydata(vertices,[],[(k*2,k*2+1,k*2+3,k*2+2) for k in range(5)])
            o=bpy.data.objects.new('palm_frond_%d_%d'%(i,j),mesh); bpy.context.collection.objects.link(o); finish(o,o.name,'leaf')
            mod=o.modifiers.new('leaf_thickness','SOLIDIFY'); mod.thickness=.002
    # Connected piers and modest moored yachts with visible ropes and mast rigging.
    for i,x in enumerate(PIERS):
        box('connected_finger_pier_'+str(i),(x,-.26,.052),(.065,.60,.08),'wood',.006)
        for k in range(6): box('pier_plank_%d_%d'%(i,k),(x,-.03-k*.096,.097),(.056,.003,.002),'chalk',0)
    for i,(x,y) in enumerate(BERTHS):
        blob('yacht_hull_'+str(i),(x,y,.022),(.052,.135,.035),'white',16,6)
        blob('yacht_deck_'+str(i),(x,y,.048),(.045,.117,.012),'chalk',12,4)
        box('yacht_cabin_'+str(i),(x,y+.015,.075),(.060,.072,.046),'white',.008)
        box('yacht_window_'+str(i),(x,y-.024,.081),(.045,.008,.016),'blue',.003)
        box('yacht_cockpit_'+str(i),(x,y+.073,.056),(.055,.030,.015),'wood',.004)
        if i%2==0:
            tube('mast_'+str(i),(x,y-.014,.054),(x,y-.014,.34),.0035,'chalk')
            tube('mast_stay_'+str(i),(x,y-.108,.054),(x,y-.014,.31),.0014,'navy',4)
            tube('mast_backstay_'+str(i),(x,y+.102,.054),(x,y-.014,.31),.0014,'navy',4)
            tube('furled_boom_'+str(i),(x,y-.014,.17),(x,y+.072,.17),.005,'chalk')
        dock=min(PIERS,key=lambda d:abs(d-x))
        for off in [-.08,.08]: tube('mooring_rope_%d_%s'%(i,off),(x,y+off,.052),(dock,y+off,.104),.0018,'navy',4)
    for i,(x,y) in enumerate([(-.76,-.42),(.76,-.42),(-.66,.02),(.66,.02)]):
        tube('bollard_'+str(i),(x,y,.12),(x,y,.16),.010,'navy')
        tube('bollard_cap_'+str(i),(x-.016,y,.157),(x+.016,y,.157),.006,'navy')
    for i,x in enumerate([-.71,.71]):
        tube('promenade_lamp_'+str(i),(x,.2,.12),(x,.2,.36),.008,'navy')
        blob('lantern_'+str(i),(x,.2,.37),(.022,.022,.025),'lantern',10,4)
        blob('lantern_cap_'+str(i),(x,.2,.39),(.030,.030,.009),'navy',10,4)
    return root


if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--preview'); parser.add_argument('--graybox',action='store_true')
    parser.add_argument('--distance-camera',default='node_modules/t107-preview/distance-camera.json')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    root=build(args.graybox)
    if not args.graybox:
        common.export('cala',root,'tools/blender/places/cala.py',REFERENCES,
          {'side':'+Z in glTF','outside_radius':1,'clear_sector_degrees':[-25,25],
           'note':'Exterior approach only; visual marina basin does not change existing collision.'})
    if args.preview: common.render_preview(root,args.preview,args.graybox,args.distance_camera)

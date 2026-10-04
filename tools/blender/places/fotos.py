"""T110: original clay Benidorm skyline and a dressed, playful BOIA stage act.

No runtime registration. All media are geometry/material colors. Rebuild at 24 fps.
"""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common

PALETTE = {'sand': (.72,.59,.40), 'chalk': (.86,.82,.69), 'white': (.94,.92,.85),
 'gold': (.76,.51,.21), 'glass': (.10,.29,.36), 'navy': (.025,.035,.08),
 'orange': (.95,.23,.035), 'hat': (.10,.055,.39), 'vest': (.24,.075,.35),
 'pink': (.94,.12,.39), 'cyan': (.08,.72,.76), 'lantern': (1,.65,.23)}
REFERENCES = ['art/marca/boia-mascota.jpg', 'tools/blender/mascota.py',
 'https://www.visitbenidorm.es/', 'https://www.intemposkyresort.es/']
MOTION = [{'node': 'boia_pole_slide', 'clip': 'boia-pole-dance', 'duration': 4,
 'static_frame': 1, 'validation': {
  'coordinate_system': 'Blender Z up; local contacts relative to moving node',
  'fps': 24, 'first_frame': 1, 'last_frame': 97,
  'pivot': [0,-.33,.42], 'pole': {'bottom': [0,-.33,.15], 'top': [0,-.33,1.03], 'radius': .014},
  'contacts': [{'node': 'boia_hand_high', 'local': [0,-.024,.105], 'radius': .018},
               {'node': 'boia_hand_low', 'local': [0,.024,.005], 'radius': .018}],
  'sample_frames': list(range(1,98,6)), 'min_vertical_travel': .16,
  'stage_top': .15, 'support_bottom': 1.03,
  'moving_bounds': {'min': [-.358,-.516,.215], 'max': [.018,-.232,.842]},
  'note': 'Rigid vertical cosine slide; hands enclose pole surface. No rotation, camera or media access.'}}]


def build():
    root, mats = common.start('fotos', PALETTE)
    for role in ['pink','cyan']:
        shader=mats[role].node_tree.nodes.get('Principled BSDF')
        shader.inputs['Emission Color'].default_value=(*PALETTE[role],1)
        shader.inputs['Emission Strength'].default_value=.35
    parent=root
    def finish(o,name,role):
        o.name=name; o.parent=parent; o.data.materials.append(mats[role]); return o
    def box(name,p,size,role,bevel=.008):
        bpy.ops.mesh.primitive_cube_add(size=1,location=p)
        o=bpy.context.object; o.scale=size
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        finish(o,name,role)
        if bevel:
            m=o.modifiers.new('soft_clay_edges','BEVEL'); m.width=bevel; m.segments=1
            o.modifiers.new('weighted_corner_normals','WEIGHTED_NORMAL')
        return o
    def blob(name,p,size,role,seg=16,rings=8):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,radius=1,location=p)
        o=bpy.context.object; o.scale=size; finish(o,name,role)
        for poly in o.data.polygons: poly.use_smooth=True
        return o
    def tube(name,a,b,r,role,n=10):
        a,b=Vector(a),Vector(b); v=b-a
        bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=v.length,location=(a+b)*.5)
        o=bpy.context.object; o.rotation_euler=v.to_track_quat('Z','Y').to_euler()
        return finish(o,name,role)
    def torus(name,p,major,minor,role):
        bpy.ops.mesh.primitive_torus_add(major_segments=24,minor_segments=8,major_radius=major,minor_radius=minor,location=p)
        o=finish(bpy.context.object,name,role)
        for poly in o.data.polygons: poly.use_smooth=True
        return o
    def text(name,words,p,size,role):
        bpy.ops.object.text_add(location=p,rotation=(math.pi/2,0,0))
        o=bpy.context.object; o.data.body=words; o.data.align_x='CENTER'; o.data.size=size
        o.data.extrude=.001; o.data.bevel_depth=0; o.data.resolution_u=2
        bpy.ops.object.convert(target='MESH'); return finish(bpy.context.object,name,role)
    # Rounded island remains within the existing normalized footprint.
    tube('Benidorm_clay_island',(0,0,-.045),(0,0,.045),.94,'sand',64)
    tube('pale_promenade',(0,0,.045),(0,0,.064),.88,'chalk',64)
    # Intempo twin shafts, large open gap and inverted diamond near crown.
    for sign in [-1,1]:
        x=-.32+sign*.135
        box('Intempo_tower_'+str(sign),(x,.47,.685),(.115,.16,1.24),'gold',.012)
        box('Intempo_glazing_'+str(sign),(x,.383,.67),(.068,.012,1.17),'glass',.003)
        for z in [.2,.35,.5,.65,.8,.95,1.1,1.25]:
            box('Intempo_floor_'+str(sign)+str(z),(x,.371,z),(.105,.014,.009),'chalk',.002)
        box('Intempo_crown_'+str(sign),(x,.47,1.323),(.135,.18,.04),'chalk')
    # Profile extrusion: actual negative space below diamond, no connecting wall.
    profile=[(-.47,1.30),(-.17,1.30),(-.20,1.19),(-.32,1.045),(-.44,1.19)]
    verts=[(x,y,z) for y in [.37,.57] for x,z in profile]; n=len(profile)
    mesh=bpy.data.meshes.new('Intempo_diamond'); mesh.from_pydata(verts,[],
      [tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)])
    o=bpy.data.objects.new('Intempo_inverted_diamond',mesh); bpy.context.collection.objects.link(o); finish(o,o.name,'gold')
    # Bali analogue plus staggered slender towers: a skyline, not a row of equal blocks.
    for i,(x,y,h,w,role) in enumerate([(.20,.51,1.10,.18,'white'),(.46,.46,.81,.14,'chalk'),
          (.66,.32,.63,.12,'white'),(-.69,.31,.66,.13,'chalk'),(.04,.70,.76,.12,'white')]):
        box('skyline_shaft_'+str(i),(x,y,.064+h/2),(w,.14,h),role)
        box('skyline_blue_inset_'+str(i),(x,y-.076,.064+h/2),(w*.59,.013,h*.89),'glass',.003)
        for k in range(1,7):
            box('skyline_balcony_%d_%d'%(i,k),(x,y-.086,.064+h*k/7),(w+.018,.032,.016),role,.003)
        box('skyline_step_crown_'+str(i),(x-.018,y,.064+h+.027),(w*.75,.13,.054),role)
    tube('Bali_roof_mast',(.20,.51,1.19),(.20,.51,1.31),.007,'gold')
    # Open-front club, circular raised stage and structurally supported pole.
    box('club_low_back_wall',(0,.04,.22),(1.10,.10,.31),'vest',.018)
    box('club_wall_pink_trim',(0,-.018,.36),(1.12,.018,.023),'pink',.003)
    tube('club_stage_base',(0,-.33,.064),(0,-.33,.128),.40,'navy',48)
    tube('club_stage_top',(0,-.33,.128),(0,-.33,.15),.405,'vest',48)
    torus('stage_pink_rim',(0,-.33,.135),.393,.008,'pink')
    for x in [-.49,.49]:
        box('truss_foot_'+str(x),(x,-.23,.085),(.11,.14,.04),'navy')
        tube('truss_column_'+str(x),(x,-.23,.09),(x,-.23,1.045),.016,'navy')
        tube('truss_brace_'+str(x),(x,-.23,.87),(x*.73,-.23,1.035),.008,'gold')
    box('supported_overhead_truss',(0,-.23,1.047),(1.03,.045,.035),'navy')
    tube('pole_top_reach',(0,-.23,1.03),(0,-.33,1.03),.019,'gold')
    tube('stage_pole',(0,-.33,.15),(0,-.33,1.03),.014,'chalk',16)
    tube('pole_floor_flange',(0,-.33,.15),(0,-.33,.165),.043,'gold',16)
    for i,x in enumerate([-.38,-.19,.19,.38]):
        blob('stage_lamp_'+str(i),(x,-.26,1.009),(.035,.033,.027),'cyan' if i%2 else 'pink',12,6)
    text('BOIA_CLUB_sign','BOIA CLUB',(0,-.067,.318),.098,'white')
    for sign in [-1,1]:
        x=sign*.55
        box('screen_frame_'+str(sign),(x,-.025,.57),(.30,.055,.30),'navy',.014)
        box('screen_panel_'+str(sign),(x,-.057,.57),(.266,.014,.264),'cyan',.008)
        for i in range(5):
            h=[.055,.12,.18,.105,.07][i]
            box('screen_equalizer_%s_%d'%(sign,i),(x+(i-2)*.043,-.068,.49+h/2),(.021,.006,h),'pink',.002)
        tube('screen_pedestal_'+str(sign),(x,-.025,.064),(x,-.025,.42),.014,'navy')
        # Decorative, deliberately oversized photo cameras: lens, finder, shutter, strap.
        x=sign*.65; y=-.49
        box('photo_camera_body_'+str(sign),(x,y,.25),(.23,.09,.155),'gold',.018)
        tube('photo_camera_lens_'+str(sign),(x,y-.045,.25),(x,y-.10,.25),.062,'navy',16)
        tube('photo_camera_lens_glass_'+str(sign),(x,y-.101,.25),(x,y-.105,.25),.042,'cyan',16)
        box('photo_camera_finder_'+str(sign),(x-.035,y,.339),(.082,.07,.036),'navy')
        blob('camera_shutter_'+str(sign),(x+.07,y,.333),(.018,.018,.01),'pink',12,4)
        tube('camera_mount_'+str(sign),(x,y,.064),(x,y,.17),.018,'navy')
        for dx in [-.075,.075]: tube('camera_tripod_'+str(sign)+str(dx),(x,y,.17),(x+dx,y+.05,.067),.007,'navy')
    # BOIA group local coordinates: pivot sits on pole, body stays to its left.
    mover=bpy.data.objects.new('boia_pole_slide',None); bpy.context.collection.objects.link(mover); mover.parent=root
    parent=mover
    blob('boia_orange_body',(-.19,0,0),(.14,.118,.15),'orange',24,12)
    torus('boia_buoy_float',(-.19,0,-.075),.144,.021,'white')
    for x in [-.325,-.055]: box('float_navy_band_'+str(x),(x,0,-.075),(.024,.049,.036),'hat',.005)
    # A large purple vest and visible shorts deliberately read as clothes at distance.
    for x in [-.268,-.113]:
        blob('club_vest_panel_'+str(x),(x,-.082,-.005),(.062,.042,.083),'vest',16,8)
    box('club_shorts',(-.19,0,-.127),(.19,.136,.065),'hat',.025)
    for x in [-.245,-.13]:
        blob('club_shoe_'+str(x),(x,-.01,-.183),(.053,.073,.025),'navy',12,6)
        box('gold_short_hem_'+str(x),(x,-.059,-.148),(.063,.016,.012),'gold',.003)
    for x in [-.265,-.115]:
        for z in [-.025,.01,.045]: blob('vest_sequin_'+str(x)+str(z),(x,-.122,z),(.007,.005,.008),'gold',8,4)
    blob('bow_tie_left',(-.213,-.119,.029),(.026,.012,.016),'pink',12,6)
    blob('bow_tie_right',(-.168,-.119,.029),(.026,.012,.016),'pink',12,6)
    blob('bow_tie_knot',(-.19,-.127,.029),(.012,.009,.013),'gold',10,4)
    for x,z in [(-.24,.075),(-.146,.091)]:
        blob('boia_eye_white_'+str(x),(x,-.103,z),(.031,.016,.041),'white',16,8)
        blob('boia_eye_pupil_'+str(x),(x+.005,-.119,z),(.015,.009,.023),'navy',12,6)
        blob('boia_eye_glint_'+str(x),(x,-.127,z+.009),(.006,.004,.008),'white',8,4)
        tube('boia_brow_'+str(x),(x-.022,-.101,z+.045),(x+.021,-.101,z+.051),.005,'navy',8)
    # Sculpted crescent smile, rather than a flat neutral mouth.
    for i in range(10):
        a=i/10; b=(i+1)/10
        def smile(t): return (-.25+.12*t,-.119,.018-.025*math.sin(math.pi*t))
        tube('boia_smile_'+str(i),smile(a),smile(b),.006,'white',8)
    # Slanted navy cap with a sculpted eyelet, preserving the brand silhouette.
    bpy.ops.mesh.primitive_cone_add(vertices=20,radius1=.077,radius2=.019,depth=.095,location=(-.245,.005,.177))
    cap=finish(bpy.context.object,'boia_slanted_cap','hat'); cap.rotation_euler[1]=-.35
    hole=torus('boia_cap_eyelet',(-.261,-.052,.19),.016,.007,'hat'); hole.rotation_euler[0]=math.pi/2
    # Two mitten hands attached to bent arms; contact is a visible mesh origin.
    for name,end,start,elbow in [('high',(0,-.024,.105),(-.075,-.023,.025),(-.031,-.047,.045)),
                                ('low',(0,.024,.005),(-.075,.056,-.025),(-.028,.065,-.037))]:
        tube('boia_arm_'+name+'_upper',start,elbow,.015,'orange')
        tube('boia_arm_'+name+'_lower',elbow,end,.014,'orange')
        blob('boia_hand_'+name,end,(.018,.018,.023),'white',16,8)
    scene=bpy.context.scene; scene.render.fps=24; scene.frame_start=1; scene.frame_end=97
    # Sample an analytic cosine every authored frame: zero speed at both turns/seam.
    for frame in range(1,98):
        mover.location=(0,-.33,.42+.085*(1-math.cos(math.tau*(frame-1)/96)))
        mover.keyframe_insert(data_path='location',frame=frame)
    mover.animation_data.action.name='boia-pole-dance'
    envelope=[]
    for frame in range(1,98):
        scene.frame_set(frame); deps=bpy.context.evaluated_depsgraph_get()
        for obj in mover.children_recursive:
            if obj.type!='MESH': continue
            evaluated=obj.evaluated_get(deps); mesh=evaluated.to_mesh()
            envelope.extend(evaluated.matrix_world @ v.co for v in mesh.vertices); evaluated.to_mesh_clear()
    MOTION[0]['validation']['moving_bounds']={key:[round(fn(p[i] for p in envelope),6) for i in range(3)] for key,fn in [('min',min),('max',max)]}
    scene.frame_set(1)
    return root


def evidence(root,directory,camera):
    directory=Path(directory).resolve()
    common.render_preview(root,directory,False,camera,target_height=.55,ortho_scale=3.1)
    scene=bpy.context.scene; cam=scene.camera; cam.data.type='ORTHO'; cam.data.ortho_scale=2.35
    sun=next(o for o in scene.objects if o.type=='LIGHT'); sun.data.energy=2.4
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.5,.67,.8,1)
    # Same real camera/FOV at a closer exterior approach (1.05 radii). The usual
    # 1.7-radius framing clips the tallest tower; retain both as honest evidence.
    settings=json.loads(Path(camera).read_text(encoding='utf-8'))
    cam.location=Vector(settings['location_blender'])+Vector((0,.65,0))
    cam.rotation_euler=(Vector(settings['target_blender'])+Vector((0,.65,0))-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.type='PERSP'
    scene.render.filepath=str(directory/'distance-near-day'); bpy.ops.render.render(write_still=True)
    sun.data.energy=.35
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.08,.11,.2,1)
    scene.render.filepath=str(directory/'distance-near-night'); bpy.ops.render.render(write_still=True)
    sun.data.energy=2.4
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.5,.67,.8,1)
    cam.data.type='ORTHO'
    for name,p in [('front',(0,-4,1.6)),('back',(0,4,1.6)),('left',(-4,0,1.6)),
                   ('right',(4,0,1.6)),('top',(0,0,5)),('oblique',(2.3,-3.8,2.5))]:
        cam.location=p; cam.rotation_euler=(Vector((0,0,.55))-cam.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(Path(directory)/('view-'+name)); bpy.ops.render.render(write_still=True)
    cam.data.ortho_scale=.87; cam.location=(.65,-2.4,1.10)
    cam.rotation_euler=(Vector((-.15,-.33,.56))-cam.location).to_track_quat('-Z','Y').to_euler()
    for frame in [1,13,25,37,49,61,73,85,97]:
        scene.frame_set(frame); scene.render.filepath=str(Path(directory)/('motion-%03d'%frame)); bpy.ops.render.render(write_still=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--preview')
    parser.add_argument('--fresh-evidence',action='store_true')
    parser.add_argument('--distance-camera',default='node_modules/t110-preview/distance-camera.json')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if args.fresh_evidence:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(common.REPO/'art/places/3d/fotos/fotos.glb'))
        root=bpy.data.objects['place_fotos']; bpy.context.scene.render.fps=24
        bpy.context.scene.frame_set(1)
    else:
        root=build()
        common.export('fotos',root,'tools/blender/places/fotos.py',REFERENCES,
          {'side':'+Z in glTF','outside_radius':1,'clear_sector_degrees':[-25,25],
           'note':'Decorative club inside original footprint; no collision or route enlargement proposed.'},motion=MOTION,
          license_note='Original BOIA geometry; local BOIA reference image inspected. Primary reference pages consulted; primary photographs could not be visually inspected. No redistributed images or textures.')
    if args.preview: evidence(root,args.preview,args.distance_camera)

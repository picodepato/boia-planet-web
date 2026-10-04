"""Meaningful contract regression: corrupt artifacts must not pass the independent gate."""
import importlib.util
import json
from pathlib import Path
import shutil
import struct
import tempfile
import unittest

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('place_checker',HERE/'check.py')
checker=importlib.util.module_from_spec(spec); spec.loader.exec_module(checker)


class PlaceContractTest(unittest.TestCase):
    place_id='cala'
    def setUp(self):
        scratch=checker.REPO/'node_modules/t107-preview/tests'
        scratch.mkdir(parents=True,exist_ok=True)
        self.tmp=tempfile.TemporaryDirectory(dir=scratch)
        self.directory=Path(self.tmp.name)/self.place_id
        shutil.copytree(checker.REPO/'art/places/3d'/self.place_id,self.directory)
        self.path=self.directory/'manifest.json'
        self.man=json.loads(self.path.read_text(encoding='utf-8'))

    def tearDown(self): self.tmp.cleanup()
    def save(self): self.path.write_text(json.dumps(self.man),encoding='utf-8')
    def alter_glb(self, change):
        path=self.directory/(self.place_id+'.glb')
        doc,binary=checker.read_glb(path); binary=bytearray(binary)
        change(doc,binary)
        encoded=json.dumps(doc,separators=(',',':')).encode()
        encoded+=b' '*((-len(encoded))%4)
        path.write_bytes(struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binary))
            +struct.pack('<II',len(encoded),0x4e4f534a)+encoded
            +struct.pack('<II',len(binary),0x004e4942)+binary)
        self.man['bytes']=path.stat().st_size; self.save()
    def test_exported_asset_passes(self): self.assertEqual(checker.verify(self.directory),[])
    def test_incorrect_geometry_count_rejected(self):
        self.man['tris']-=1; self.save()
        self.assertIn('triangle budget/count mismatch',checker.verify(self.directory))
    def test_over_budget_rejected(self):
        self.man['bytes']=600001; self.save()
        self.assertTrue(checker.verify(self.directory))
    def test_wrong_identity_rejected(self):
        self.man['source']='fotos.blend'; self.save()
        self.assertIn('identity/file mismatch',checker.verify(self.directory))
    def test_unexported_motion_rejected(self):
        self.man['motion']=[{'node':'club_dancer','clip':'boia-pole-dance','duration':4,'static_frame':1}]; self.save()
        failures=checker.verify(self.directory)
        self.assertIn('named animation clip mismatch',failures)
        self.assertIn('motion node missing',failures)
    def test_false_bounds_rejected(self):
        self.man['bounds']['max'][0]+=.1; self.save()
        self.assertIn('transformed bounds mismatch',checker.verify(self.directory))
    def test_nonfinite_metadata_rejected(self):
        self.man['bounds']['min'][0]=float('nan'); self.save()
        self.assertIn('non finite manifest value',checker.verify(self.directory))
    def test_translated_mesh_rejected(self):
        def change(doc,binary):
            next(n for n in doc['nodes'] if 'mesh' in n)['translation']=[.2,0,0]
        self.alter_glb(change)
        self.assertIn('normalized radius mismatch',checker.verify(self.directory))
    def test_collapsed_triangle_rejected(self):
        def change(doc,binary):
            primitive=doc['meshes'][0]['primitives'][0]
            acc=doc['accessors'][primitive['indices']]; view=doc['bufferViews'][acc['bufferView']]
            offset=view.get('byteOffset',0)+acc.get('byteOffset',0)
            fmt='<'+{5121:'B',5123:'H',5125:'I'}[acc['componentType']]
            first=struct.unpack_from(fmt,binary,offset)[0]
            struct.pack_into(fmt,binary,offset+struct.calcsize(fmt),first)
        self.alter_glb(change)
        self.assertIn('degenerate triangle',checker.verify(self.directory))
    def test_invalid_index_rejected(self):
        def change(doc,binary):
            primitive=doc['meshes'][0]['primitives'][0]
            acc=doc['accessors'][primitive['indices']]; view=doc['bufferViews'][acc['bufferView']]
            offset=view.get('byteOffset',0)+acc.get('byteOffset',0)
            fmt='<'+{5121:'B',5123:'H',5125:'I'}[acc['componentType']]
            struct.pack_into(fmt,binary,offset,doc['accessors'][primitive['attributes']['POSITION']]['count'])
        self.alter_glb(change)
        self.assertIn('triangle index out of range',checker.verify(self.directory))
    def test_signature_detects_material_change(self):
        path=self.directory/'cala.glb'; before=checker.geometry_signature(path)
        self.alter_glb(lambda doc,binary: doc['materials'][0]['pbrMetallicRoughness'].update(roughnessFactor=.1))
        self.assertNotEqual(before,checker.geometry_signature(path))


class FotosMotionTest(unittest.TestCase):
    place_id='fotos'
    setUp=PlaceContractTest.setUp
    tearDown=PlaceContractTest.tearDown
    save=PlaceContractTest.save
    alter_glb=PlaceContractTest.alter_glb

    def test_fotos_passes(self): self.assertEqual(checker.verify(self.directory),[])
    def test_static_frame_outside_clip(self):
        self.man['motion'][0]['static_frame']=98; self.save()
        self.assertIn('static frame outside clip',checker.verify(self.directory))
    def test_wrong_channel_target(self):
        self.alter_glb(lambda d,b: d['animations'][0]['channels'][0]['target'].update(node=next(i for i,n in enumerate(d['nodes']) if n['name']=='static_fotos')))
        self.assertIn('motion channel target mismatch',checker.verify(self.directory))
    def test_wrong_reduced_pose(self):
        self.man['motion'][0]['static_frame']=49; self.save()
        self.assertIn('default pose differs from reduced motion frame',checker.verify(self.directory))
    def alter_positions(self,transform):
        def change(d,b):
            a=d['accessors'][d['animations'][0]['samplers'][0]['output']]; view=d['bufferViews'][a['bufferView']]
            offset=view.get('byteOffset',0)+a.get('byteOffset',0); stride=view.get('byteStride',12)
            values=[struct.unpack_from('<fff',b,offset+i*stride) for i in range(a['count'])]
            for i,p in enumerate(values): struct.pack_into('<fff',b,offset+i*stride,*transform(i,p,values))
        self.alter_glb(change)
    def test_no_vertical_travel(self):
        self.alter_positions(lambda i,p,v:v[0])
        self.assertIn('motion has no vertical travel',checker.verify(self.directory))
    def test_nonfinite_animation_output(self):
        self.alter_positions(lambda i,p,v:(float('nan') if i==12 else p[0],p[1],p[2]))
        self.assertIn('non finite animation',checker.verify(self.directory))
    def test_open_loop(self):
        self.alter_positions(lambda i,p,v:(p[0],p[1]+(.02 if i==len(v)-1 else 0),p[2]))
        self.assertIn('motion loop open',checker.verify(self.directory))
    def test_detached_hand_geometry(self):
        def change(d,b):
            node=next(n for n in d['nodes'] if n['name']=='boia_hand_high'); node['translation'][0]+=.08
        self.alter_glb(change)
        self.assertIn('hand detached from pole',checker.verify(self.directory))
    def test_outside_pole_span(self):
        self.man['motion'][0]['validation']['pole']['top'][2]=.5; self.save()
        self.assertIn('declared pole does not match static geometry',checker.verify(self.directory))
    def test_false_pole_radius(self):
        self.man['motion'][0]['validation']['pole']['radius']+=.006; self.save()
        self.assertIn('declared pole does not match static geometry',checker.verify(self.directory))
    def test_animated_radius_exceeded(self):
        self.alter_positions(lambda i,p,v:(p[0]+(1.2 if i==len(v)//2 else 0),p[1],p[2]))
        self.assertIn('animated normalized radius exceeded',checker.verify(self.directory))
    def test_wrong_envelope(self):
        self.man['motion'][0]['validation']['moving_bounds']['max'][2]+=.1; self.save()
        self.assertIn('animated bounds mismatch',checker.verify(self.directory))


class TiendaCoveTest(unittest.TestCase):
    """T111 Ibiza: static batch plus the open cove-mouth approach channel."""
    place_id='tienda'
    setUp=PlaceContractTest.setUp
    tearDown=PlaceContractTest.tearDown
    save=PlaceContractTest.save
    alter_glb=PlaceContractTest.alter_glb

    def test_tienda_passes(self): self.assertEqual(checker.verify(self.directory),[])
    def test_static_place_is_one_batched_mesh(self):
        doc,_=checker.read_glb(self.directory/'tienda.glb')
        self.assertEqual(len(doc['meshes']),1)
        self.assertEqual(self.man['motion'],[])
    def test_widened_channel_hits_the_headlands(self):
        self.man['approach']['clear_sector_degrees']=[-60,60]; self.save()
        self.assertIn('approach channel obstructed',checker.verify(self.directory))
    def test_channel_reaching_into_the_cove_hits_the_moored_boat(self):
        self.man['approach']['channel']['from_radius']=.1; self.save()
        self.assertIn('approach channel obstructed',checker.verify(self.directory))
    def test_channel_is_optional(self):
        del self.man['approach']['channel']; self.save()
        self.assertEqual(checker.verify(self.directory),[])
    def test_unknown_channel_field_rejected(self):
        self.man['approach']['channel']['width']=.3; self.save()
        self.assertTrue(checker.verify(self.directory))


if __name__=='__main__': unittest.main()

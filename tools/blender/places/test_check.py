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
    def setUp(self):
        scratch=checker.REPO/'node_modules/t107-preview/tests'
        scratch.mkdir(parents=True,exist_ok=True)
        self.tmp=tempfile.TemporaryDirectory(dir=scratch)
        self.directory=Path(self.tmp.name)/'cala'
        shutil.copytree(checker.REPO/'art/places/3d/cala',self.directory)
        self.path=self.directory/'manifest.json'
        self.man=json.loads(self.path.read_text(encoding='utf-8'))

    def tearDown(self): self.tmp.cleanup()
    def save(self): self.path.write_text(json.dumps(self.man),encoding='utf-8')
    def alter_glb(self, change):
        path=self.directory/'cala.glb'
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


if __name__=='__main__': unittest.main()

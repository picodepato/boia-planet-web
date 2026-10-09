import { LOCAL_PHOTO_PREFIX } from '@boia/contracts/photo-ref';
import { Group, Mesh, MeshBasicMaterial, BoxGeometry } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { libraryAsset } from '../../../lib/admin/objects';
import { fitModel, imageBoard, mountObjectArt } from './object-art-view';
import {
  type ObjectArtDeps,
  artFormatOf,
  artBox,
  hasUploadedArt,
  objectArtSource,
  resolveObjectArt,
} from './object-art';

/**
 * El archivo subido de un objeto nuevo en el mar 3D (T241): de dónde sale
 * (IndexedDB → URL de objeto, Storage → su URL) y el respaldo si no está.
 */

const localRef = `${LOCAL_PHOTO_PREFIX}objeto-20261009-original-glb`;
const imageRef = `${LOCAL_PHOTO_PREFIX}objeto-20261009-512`;

function fakeDeps(files: Record<string, Blob>): ObjectArtDeps & { revoked: string[] } {
  const revoked: string[] = [];
  return {
    revoked,
    getBlob: async (ref) => files[ref] ?? null,
    createUrl: (b) => `blob:fake/${b.size}`,
    revokeUrl: (u) => revoked.push(u),
  };
}

describe('objectArtSource', () => {
  it('distingue biblioteca, archivo local y URL', () => {
    expect(objectArtSource(libraryAsset('boia').ref)).toEqual({ kind: 'library' });
    expect(objectArtSource(localRef)).toEqual({ kind: 'local', ref: localRef });
    const url = 'https://x.supabase.co/storage/v1/object/public/a/b.glb';
    expect(objectArtSource(url)).toEqual({ kind: 'remote', url });
    expect(hasUploadedArt(libraryAsset('isla').ref)).toBe(false);
    expect(hasUploadedArt(undefined)).toBe(false);
    expect(hasUploadedArt(imageRef)).toBe(true);
  });
});

describe('artFormatOf', () => {
  it('por tipo o por nombre', () => {
    expect(artFormatOf('model/gltf-binary', '')).toBe('model');
    expect(artFormatOf('image/webp', '')).toBe('image');
    expect(artFormatOf('', localRef)).toBe('model');
    expect(artFormatOf('', '/a/b.PNG?x=1')).toBe('image');
    expect(artFormatOf('', 'objeto-1-512')).toBeNull();
  });
});

describe('resolveObjectArt', () => {
  it('un archivo local da una URL de objeto que se suelta una vez', async () => {
    const deps = fakeDeps({ [localRef]: new Blob([new Uint8Array(8)]) });
    const r = await resolveObjectArt(localRef, deps);
    expect(r).toMatchObject({ status: 'ready', format: 'model', url: 'blob:fake/8' });
    if (r.status !== 'ready') throw new Error('ready');
    r.release();
    r.release();
    expect(deps.revoked).toEqual(['blob:fake/8']);
  });

  it('una imagen local sin pista en el nombre se reconoce por su tipo o sus bytes', async () => {
    const webp = new Blob([new Uint8Array(4)], { type: 'image/webp' });
    expect(await resolveObjectArt(imageRef, fakeDeps({ [imageRef]: webp }))).toMatchObject({
      status: 'ready',
      format: 'image',
    });
    const png = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])]);
    expect(await resolveObjectArt(imageRef, fakeDeps({ [imageRef]: png }))).toMatchObject({
      status: 'ready',
      format: 'image',
    });
    const glb = new Blob([new TextEncoder().encode('glTF')]);
    expect(await resolveObjectArt(imageRef, fakeDeps({ [imageRef]: glb }))).toMatchObject({
      format: 'model',
    });
  });

  it('una URL remota se pide tal cual, sin URL de objeto', async () => {
    const deps = fakeDeps({});
    const getBlob = vi.spyOn(deps, 'getBlob');
    const url = 'https://x.supabase.co/storage/v1/object/public/objetos/faro.glb';
    const r = await resolveObjectArt(url, deps);
    expect(r).toMatchObject({ status: 'ready', format: 'model', url });
    const img = await resolveObjectArt('https://cdn.test/objetos/cartel.webp', deps);
    expect(img).toMatchObject({ status: 'ready', format: 'image' });
    expect(getBlob).not.toHaveBeenCalled();
  });

  it('sin archivo, ilegible o de la biblioteca: respaldo con su motivo', async () => {
    expect(await resolveObjectArt(localRef, fakeDeps({}))).toEqual({
      status: 'fallback',
      reason: 'missing',
    });
    const broken: ObjectArtDeps = {
      ...fakeDeps({}),
      getBlob: () => Promise.reject(new Error('idb')),
    };
    expect(await resolveObjectArt(localRef, broken)).toMatchObject({ reason: 'missing' });
    const junk = fakeDeps({ [imageRef]: new Blob([new Uint8Array([1, 2, 3, 4])]) });
    expect(await resolveObjectArt(imageRef, junk)).toMatchObject({ reason: 'unsupported' });
    expect(await resolveObjectArt(libraryAsset('cofre').ref, fakeDeps({}))).toMatchObject({
      reason: 'library',
    });
  });
});

describe('el arte en la escena', () => {
  it('artBox: el diámetro de la huella, con mínimo y escala; el alto, acotado', () => {
    expect(artBox(3)).toEqual({ span: 6, height: 3 });
    expect(artBox(0.5)).toEqual({ span: 2.5, height: 2.5 });
    expect(artBox(3, 2)).toEqual({ span: 12, height: 6 });
    // Una isla grande no se vuelve una torre.
    expect(artBox(7.5).height).toBe(6);
  });

  it('fitModel: cabe en la caja, centrado y apoyado en el agua', () => {
    const m = new Group();
    m.add(new Mesh(new BoxGeometry(10, 4, 2)));
    m.position.set(5, 20, 0);
    fitModel(m, { span: 5, height: 5 });
    m.updateMatrixWorld(true);
    const mesh = m.children[0] as Mesh;
    mesh.geometry.computeBoundingBox();
    expect(m.scale.x).toBeCloseTo(0.5);
    // Base a -0.1 (un poco hundido), centrado en x.
    expect(m.position.y + mesh.geometry.boundingBox!.min.y * m.scale.y).toBeCloseTo(-0.1);
    expect(m.position.x).toBeCloseTo(0);
    // Uno alto lo acota el alto de la caja.
    const tall = new Group();
    tall.add(new Mesh(new BoxGeometry(1, 10, 1)));
    fitModel(tall, { span: 5, height: 2 });
    expect(tall.scale.y).toBeCloseTo(0.2);
  });

  it('imageBoard: conserva la proporción', () => {
    const box = { span: 6, height: 4 };
    expect(imageBoard({ image: { width: 200, height: 100 } }, box)).toEqual({
      width: 6,
      height: 3,
    });
    expect(imageBoard({ image: { width: 100, height: 200 } }, box)).toEqual({
      width: 2,
      height: 4,
    });
  });

  it('mountObjectArt: si el archivo no está, se queda el respaldo', async () => {
    const slot = new Group();
    const fallback = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    slot.add(fallback);
    const out = await mountObjectArt(
      slot,
      fallback,
      localRef,
      { span: 4, height: 4 },
      fakeDeps({}),
      () => true,
    );
    expect(out.state).toBe('fallback');
    expect(slot.children).toEqual([fallback]);
  });

  it('mountObjectArt: si el archivo no carga, se queda el respaldo y se suelta la URL', async () => {
    const slot = new Group();
    const fallback = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    slot.add(fallback);
    const deps = fakeDeps({ [localRef]: new Blob([new TextEncoder().encode('glTFroto')]) });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = await mountObjectArt(
      slot,
      fallback,
      localRef,
      { span: 4, height: 4 },
      deps,
      () => true,
    );
    warn.mockRestore();
    expect(out.state).toBe('fallback');
    expect(slot.children).toEqual([fallback]);
    expect(deps.revoked).toHaveLength(1);
  });
});

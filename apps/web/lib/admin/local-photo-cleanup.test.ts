import { MemoryStorage, SAMPLE_PHOTOS, createLocalRepository } from '@boia/store';
import { WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { createAdminActions } from './actions';
import { pruneLocalPhotos } from './local-photo-cleanup';
import { type LocalPhotoStore, localPhotoKeysIn, orphanPhotoKeys } from './local-photo-orphans';

const NOW = '2026-10-09T10:00:00.000Z';

/** Un «IndexedDB» de pruebas: las claves de los blobs, sin navegador. */
function fakeBlobs(keys: string[]) {
  const set = new Set(keys);
  const store: LocalPhotoStore = {
    keys: async () => [...set],
    remove: async (ks) => {
      for (const k of ks) set.delete(k);
    },
  };
  return { store, keys: () => [...set].sort() };
}

function setup(blobs: ReturnType<typeof fakeBlobs>) {
  const repo = createLocalRepository({
    storage: new MemoryStorage(),
    now: () => new Date(NOW),
    watch: false,
  });
  const actions = createAdminActions({
    repo,
    registry: WORLD_REGISTRY,
    now: () => new Date(NOW),
    localPhotos: blobs.store,
  });
  return { repo, actions };
}

const base = SAMPLE_PHOTOS[0]!;

describe('referencias a archivos locales', () => {
  it('encuentra las claves a cualquier profundidad y no toca las URL https', () => {
    const keys = localPhotoKeysIn({
      src: 'local-photo:foto-a',
      nested: [{ poster: 'local-photo:foto-b' }, 'https://ejemplo.test/x.jpg'],
    });
    expect([...keys].sort()).toEqual(['foto-a', 'foto-b']);
  });

  it('una clave guardada sólo es huérfana si nada la referencia', () => {
    expect(orphanPhotoKeys(['a', 'b', 'c'], new Set(['b']))).toEqual(['a', 'c']);
  });
});

describe('borrar una foto local libera su blob', () => {
  it('en la papelera el blob sigue (recuperable); la purga lo borra', async () => {
    const blobs = fakeBlobs(['foto-a', 'foto-b']);
    const { repo, actions } = setup(blobs);
    const photo = await repo.admin.upsert(
      'photos',
      { ...base, id: 'foto-prueba-a', src: 'local-photo:foto-a' },
      { reason: 'prueba' },
    );
    await repo.admin.upsert(
      'photos',
      { ...base, id: 'foto-prueba-b', src: 'local-photo:foto-b' },
      { reason: 'prueba' },
    );

    await actions.trashItem('photos', photo.id, photo.alt, 'prueba');
    expect(blobs.keys()).toContain('foto-a');

    await actions.purgeItem('photos', photo.id, photo.alt);
    expect(blobs.keys()).toEqual(['foto-b']);
  });
});

describe('limpieza de huérfanos al abrir el Admin', () => {
  it('quita sólo los blobs que nada referencia (ni contenido, ni borrador, ni papelera)', async () => {
    const blobs = fakeBlobs(['foto-viva', 'foto-papelera', 'foto-huerfana']);
    const { repo, actions } = setup(blobs);
    await repo.admin.upsert(
      'photos',
      { ...base, id: 'foto-prueba-viva', src: 'local-photo:foto-viva' },
      { reason: 'prueba' },
    );
    const trashed = await repo.admin.upsert(
      'photos',
      { ...base, id: 'foto-prueba-papelera', src: 'local-photo:foto-papelera' },
      { reason: 'prueba' },
    );
    await actions.trashItem('photos', trashed.id, trashed.alt, 'prueba');

    const removed = await pruneLocalPhotos(repo, blobs.store);

    expect(removed).toEqual(['foto-huerfana']);
    expect(blobs.keys()).toEqual(['foto-papelera', 'foto-viva']);
  });
});

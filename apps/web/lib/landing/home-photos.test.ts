import { SAMPLE_ALBUMS, SAMPLE_PHOTOS } from '@boia/store';
import { describe, expect, it } from 'vitest';
import { resolveHome } from './resolve';
import { SAMPLE_CONTENT } from './sample-content';

/**
 * Plan 029 T277: la home enseña al menos 7 fotos, las 4 reales primero
 * (derechos aprobados por Álvaro el 2026-10-13), ninguna de muestra entre
 * ellas y ningún clip (REQ-COM-032).
 */
const REAL = ['galeria-1', 'galeria-2', 'galeria-3', 'galeria-4'];
const NOW = new Date('2026-10-13T12:00:00+02:00');

function homePhotosOf(content: typeof SAMPLE_CONTENT) {
  const view = resolveHome(content, NOW);
  const block = [...view.main, ...view.footer].find((b) => b.type === 'photos');
  return block?.type === 'photos' ? block.photos : [];
}

describe('fotos de la home (T277)', () => {
  it('hay al menos 7, las 4 reales primero y en su orden', () => {
    const photos = homePhotosOf(SAMPLE_CONTENT);
    expect(photos.length).toBeGreaterThanOrEqual(7);
    expect(photos.slice(0, 4).map((p) => p.id)).toEqual(REAL);
  });

  it('las 4 reales no son de muestra: su álbum no lleva la marca', () => {
    const albums = new Map(SAMPLE_ALBUMS.map((a) => [a.id, a]));
    for (const id of REAL) {
      const photo = SAMPLE_PHOTOS.find((p) => p.id === id)!;
      expect(photo.selection).toBe(true);
      expect(albums.get(photo.albumId)?.sample ?? false).toBe(false);
    }
  });

  it('las reales van primero aunque el contenido las traiga detrás', () => {
    const reversed = { ...SAMPLE_CONTENT, photos: [...SAMPLE_CONTENT.photos].reverse() };
    const ids = homePhotosOf(reversed).map((p) => p.id);
    expect(new Set(ids.slice(0, 4))).toEqual(new Set(REAL));
  });

  it('la home no lleva clips, ni aunque se marquen como selección', () => {
    expect(SAMPLE_CONTENT.photos.some((p) => p.kind === 'video')).toBe(true);
    expect(homePhotosOf(SAMPLE_CONTENT).some((p) => p.kind === 'video')).toBe(false);
    const withClips = {
      ...SAMPLE_CONTENT,
      photos: SAMPLE_CONTENT.photos.map((p) => (p.kind === 'video' ? { ...p, selection: true } : p)),
    };
    expect(homePhotosOf(withClips).some((p) => p.kind === 'video')).toBe(false);
  });
});

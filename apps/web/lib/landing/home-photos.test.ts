import { existsSync } from 'node:fs';
import { HOME_PHOTOS_LIMIT, REAL_ALBUM_ID, SAMPLE_ALBUMS, SAMPLE_PHOTOS } from '@boia/store';
import { describe, expect, it } from 'vitest';
import { resolveHome } from './resolve';
import { SAMPLE_CONTENT } from './sample-content';

/**
 * Plan 048 T328: la portada enseña la selección real de Álvaro, en su orden:
 * las 7 fotos nuevas y detrás 2 clips (9 piezas, `HOME_PHOTOS_LIMIT`). Nada
 * de muestra: todo vive en el álbum real. Los clips se permiten en la home
 * (el collage pinta su póster y sólo baja el vídeo en pantalla, REQ-COM-032).
 */
const NOW = new Date('2026-10-24T12:00:00+02:00');

/** La selección por defecto, en el orden del contenido. */
const SELECTION = SAMPLE_PHOTOS.filter((p) => p.selection).map((p) => p.id);

function homePhotosOf(content: typeof SAMPLE_CONTENT) {
  const view = resolveHome(content, NOW);
  const block = [...view.main, ...view.footer].find((b) => b.type === 'photos');
  return block?.type === 'photos' ? block.photos : [];
}

describe('portada por defecto (T328)', () => {
  it('9 piezas: la selección, en su orden, 7 fotos y detrás 2 clips', () => {
    const photos = homePhotosOf(SAMPLE_CONTENT);
    expect(HOME_PHOTOS_LIMIT).toBe(9);
    expect(photos).toHaveLength(HOME_PHOTOS_LIMIT);
    expect(photos.map((p) => p.id)).toEqual(SELECTION.slice(0, HOME_PHOTOS_LIMIT));
    expect(photos.map((p) => p.kind ?? 'image')).toEqual([
      ...Array<string>(7).fill('image'),
      'video',
      'video',
    ]);
    expect(photos.slice(7).map((p) => p.id)).toEqual(['clip-20260530-231216', 'clip-img-0561']);
  });

  it('lo que no está en la selección sale sólo en la galería', () => {
    const home = new Set(homePhotosOf(SAMPLE_CONTENT).map((p) => p.id));
    for (const id of ['clip-img-0564', 'galeria-1', 'galeria-2']) {
      expect(SAMPLE_PHOTOS.some((p) => p.id === id)).toBe(true);
      expect(home.has(id)).toBe(false);
    }
  });

  it('todo es real: un solo álbum, sin la marca de muestra', () => {
    expect(SAMPLE_ALBUMS.map((a) => a.id)).toEqual([REAL_ALBUM_ID]);
    expect(SAMPLE_ALBUMS[0]!.sample ?? false).toBe(false);
    for (const p of SAMPLE_PHOTOS) {
      expect(p.albumId).toBe(REAL_ALBUM_ID);
      expect(p.src).toMatch(/^\/contenido\/galeria\//);
      expect(existsSync(new URL(`../../public${p.src}`, import.meta.url))).toBe(true);
    }
  });

  it('los clips llevan póster y entran en la portada si se marcan', () => {
    const clips = SAMPLE_PHOTOS.filter((p) => p.kind === 'video');
    expect(clips).toHaveLength(3);
    for (const c of clips) expect(c.poster).toMatch(/^\/contenido\/galeria\/.+\.webp$/);
    // Un clip marcado delante de todo sale el primero.
    const last = clips.at(-1)!;
    const first = {
      ...SAMPLE_CONTENT,
      photos: [
        { ...last, selection: true },
        ...SAMPLE_CONTENT.photos.filter((p) => p.id !== last.id),
      ],
    };
    const ids = homePhotosOf(first).map((p) => p.id);
    expect(ids[0]).toBe(last.id);
    expect(ids).toHaveLength(HOME_PHOTOS_LIMIT);
  });

  it('la home no pasa del tope aunque se marque todo', () => {
    const all = {
      ...SAMPLE_CONTENT,
      photos: SAMPLE_CONTENT.photos.map((p) => ({ ...p, selection: true })),
    };
    expect(homePhotosOf(all)).toHaveLength(HOME_PHOTOS_LIMIT);
  });
});

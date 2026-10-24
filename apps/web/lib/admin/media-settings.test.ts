import type { HomeContent, Photo } from '@boia/contracts';
import { HOME_PHOTOS_LIMIT } from '@boia/store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { photoGalleries } from '../landing/eventos';
import { resolveHome } from '../landing/resolve';
import { SAMPLE_CONTENT } from '../landing/sample-content';
import { localMediaControls, sharedMediaControls, storageObjectOf } from './media-admin';
import {
  LOCAL_MEDIA_SETTINGS_KEY,
  type MediaSetting,
  applyMediaSettings,
  mediaSettingsFromRows,
  movePiece,
  patchLocalMediaSetting,
  readLocalMediaSettings,
  setLocalMediaOrder,
  withMediaSettings,
} from './media-settings';
import { mergeSharedPhotos, sharedPhotosFromRows } from './shared-photos';

/**
 * Plan 048 T329: los ajustes del Admin (portada, orden, borrada) puestos en
 * las piezas del código y en las subidas a Supabase, en la portada (las
 * marcadas, en su orden, hasta `HOME_PHOTOS_LIMIT`) y en la galería (sin las
 * borradas, en su orden). REQ-ADM-044.
 */
const NOW = new Date('2026-10-24T12:00:00+02:00');
const settings = (entries: Record<string, MediaSetting>) => new Map(Object.entries(entries));

const homeIds = (content: HomeContent) => {
  const view = resolveHome(content, NOW);
  const block = [...view.main, ...view.footer].find((b) => b.type === 'photos');
  return block?.type === 'photos' ? block.photos.map((p) => p.id) : [];
};

const galleryIds = (content: HomeContent) =>
  photoGalleries(
    { events: content.events, albums: content.albums ?? [], photos: content.photos },
    [],
  ).flatMap((g) => g.sections.flatMap((s) => s.photos.map((p) => p.id)));

/** Una foto subida a la isla de un evento de la muestra, como la lee la web de Supabase. */
const event = SAMPLE_CONTENT.events.find((e) => e.state !== 'draft')!;
const UPLOADED = 'foto-subida-1';
const shared = sharedPhotosFromRows(
  [
    {
      id: `album-${event.id}`,
      event_id: event.id,
      island_id: 'halloween',
      title: event.name,
      event_date: null,
      event_finished: false,
    },
  ],
  [
    {
      id: UPLOADED,
      album_id: `album-${event.id}`,
      url: 'https://x.supabase.co/storage/v1/object/public/event-photos/e/1.webp',
      alt: 'Subida',
      width: 1600,
      height: 900,
      created_at: '2026-10-24T10:00:00Z',
    },
  ],
);
const withUpload: HomeContent = mergeSharedPhotos(SAMPLE_CONTENT, shared);
const DEFAULT_HOME = homeIds(SAMPLE_CONTENT);
const CODE = SAMPLE_CONTENT.photos.map((p) => p.id);

describe('applyMediaSettings', () => {
  it('sin ajustes, todo como en el código', () => {
    expect(applyMediaSettings(SAMPLE_CONTENT.photos, new Map())).toEqual(SAMPLE_CONTENT.photos);
    expect(homeIds(withMediaSettings(SAMPLE_CONTENT, new Map()))).toEqual(DEFAULT_HOME);
  });

  it('borrada: fuera; ordenadas primero, el resto detrás en su orden; portada del ajuste', () => {
    const photos: Photo[] = ['a', 'b', 'c', 'd'].map((id) => ({
      id,
      albumId: 'x',
      alt: id,
      width: 4,
      height: 3,
      selection: id === 'a',
    }));
    const out = applyMediaSettings(
      photos,
      settings({
        a: { onHome: false },
        b: { hidden: true },
        c: { sort: 1 },
        d: { sort: 0, onHome: true },
      }),
    );
    expect(out.map((p) => [p.id, p.selection])).toEqual([
      ['d', true],
      ['c', false],
      ['a', false],
    ]);
  });

  it('las filas de Supabase dan los ajustes', () => {
    const m = mediaSettingsFromRows([{ piece_id: 'a', on_home: null, sort: 3, hidden: true }]);
    expect(m.get('a')).toEqual({ onHome: null, sort: 3, hidden: true });
  });
});

describe('la portada con los ajustes', () => {
  it('una pieza del código fuera de la portada y otra dentro, en el orden del Admin', () => {
    const out = DEFAULT_HOME[0]!;
    const extra = CODE.find((id) => !DEFAULT_HOME.includes(id))!;
    const order = [extra, ...CODE.filter((id) => id !== extra)];
    const home = (id: string) =>
      id === out ? { onHome: false } : id === extra ? { onHome: true } : {};
    const s = settings(Object.fromEntries(order.map((id, sort) => [id, { sort, ...home(id) }])));
    const ids = homeIds(withMediaSettings(SAMPLE_CONTENT, s));
    expect(ids[0]).toBe(extra);
    expect(ids).not.toContain(out);
    expect(ids).toEqual([extra, ...DEFAULT_HOME.filter((id) => id !== out)]);
  });

  it('una pieza subida entra en la portada si se marca, en su puesto', () => {
    expect(homeIds(withUpload)).not.toContain(UPLOADED);
    const s = settings({ [UPLOADED]: { onHome: true, sort: 0 } });
    const ids = homeIds(withMediaSettings(withUpload, s));
    expect(ids[0]).toBe(UPLOADED);
    expect(ids).toHaveLength(HOME_PHOTOS_LIMIT);
  });

  it('no pasa del tope aunque se marque todo; una borrada no sale aunque estuviera marcada', () => {
    const all = settings(Object.fromEntries(CODE.map((id) => [id, { onHome: true }])));
    expect(homeIds(withMediaSettings(SAMPLE_CONTENT, all))).toHaveLength(HOME_PHOTOS_LIMIT);
    const hidden = settings({ [DEFAULT_HOME[1]!]: { hidden: true } });
    expect(homeIds(withMediaSettings(SAMPLE_CONTENT, hidden))).not.toContain(DEFAULT_HOME[1]);
  });
});

describe('la galería con los ajustes', () => {
  it('sin las borradas (del código y subidas) y en el orden del Admin', () => {
    const before = galleryIds(withUpload);
    expect(before).toContain(UPLOADED);
    const hiddenCode = CODE[2]!;
    const s = settings({
      [hiddenCode]: { hidden: true },
      [UPLOADED]: { hidden: true },
      [CODE[4]!]: { sort: 0 },
      [CODE[0]!]: { sort: 1 },
    });
    const after = galleryIds(withMediaSettings(withUpload, s));
    expect(after).not.toContain(hiddenCode);
    expect(after).not.toContain(UPLOADED);
    const code = after.filter((id) => CODE.includes(id));
    expect(code.slice(0, 2)).toEqual([CODE[4], CODE[0]]);
    expect(code).toHaveLength(CODE.length - 1);
  });
});

describe('mover', () => {
  it('sube y baja una pieza; en el borde no se mueve', () => {
    expect(movePiece(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(movePiece(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b']);
    expect(movePiece(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c']);
    expect(movePiece(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c']);
  });
});

describe('la demo: ajustes en este navegador', () => {
  afterEach(() => vi.unstubAllGlobals());

  function fakeStorage() {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    });
    return data;
  }

  it('portada, orden y borrar: una del código se oculta; una añadida va a la papelera', async () => {
    const data = fakeStorage();
    const removed: string[] = [];
    const c = localMediaControls(new Set(['code-a']), async (id) => {
      removed.push(id);
    });
    await c.setHome('code-a', true);
    await c.order(['code-b', 'code-a']);
    const piece = (id: string) => ({
      photo: { id, albumId: 'x', alt: id, width: 4, height: 3, selection: false },
      uploaded: false,
    });
    await c.remove(piece('code-a'));
    await c.remove(piece('local-1'));
    expect(removed).toEqual(['local-1']);
    expect(readLocalMediaSettings().get('code-a')).toEqual({ onHome: true, sort: 1, hidden: true });
    expect(readLocalMediaSettings().get('code-b')).toEqual({ onHome: null, sort: 0, hidden: false });
    expect(JSON.parse(data.get(LOCAL_MEDIA_SETTINGS_KEY)!)).toHaveProperty('code-a');
  });

  it('un documento roto se lee como vacío', () => {
    const data = fakeStorage();
    data.set(LOCAL_MEDIA_SETTINGS_KEY, '{roto');
    expect(readLocalMediaSettings().size).toBe(0);
    patchLocalMediaSetting('x', { hidden: true });
    setLocalMediaOrder(['x']);
    expect(readLocalMediaSettings().get('x')).toEqual({ onHome: null, sort: 0, hidden: true });
  });
});

describe('con cuentas: las RPC del Admin', () => {
  const url = 'https://x.supabase.co/storage/v1/object/public/event-clips/e/1.mp4';
  const poster = 'https://x.supabase.co/storage/v1/object/public/event-photos/e/1-poster.webp';

  function fakeClient(result: unknown = null) {
    const calls: [string, unknown][] = [];
    const removed: [string, string[]][] = [];
    const sb = {
      rpc: (name: string, args: unknown) => {
        calls.push([name, args]);
        return Promise.resolve({ data: result, error: null });
      },
      storage: {
        from: (bucket: string) => ({
          remove: (paths: string[]) => {
            removed.push([bucket, paths]);
            return Promise.resolve({ data: [], error: null });
          },
        }),
      },
    };
    return { sb: sb as never, calls, removed };
  }

  const piece = (id: string, uploaded: boolean) => ({
    photo: { id, albumId: 'x', alt: id, width: 4, height: 3, selection: false },
    uploaded,
  });

  it('portada y orden van a sus RPC', async () => {
    const { sb, calls } = fakeClient();
    const c = sharedMediaControls(sb);
    await c.setHome('a', true);
    await c.order(['b', 'a']);
    expect(calls).toEqual([
      ['admin_media_set_home', { p_piece: 'a', p_on_home: true }],
      ['admin_media_order', { p_pieces: ['b', 'a'] }],
    ]);
  });

  it('borrar una del código la oculta; una subida borra su fila y sus archivos', async () => {
    const code = fakeClient();
    await sharedMediaControls(code.sb).remove(piece('galeria-1', false));
    expect(code.calls).toEqual([['admin_media_hide', { p_piece: 'galeria-1' }]]);
    expect(code.removed).toEqual([]);

    const up = fakeClient({ deleted: true, url, poster_url: poster });
    await sharedMediaControls(up.sb).remove(piece('clip-1', true));
    expect(up.calls).toEqual([['admin_media_delete', { p_piece: 'clip-1' }]]);
    expect(up.removed).toEqual([
      ['event-clips', ['e/1.mp4']],
      ['event-photos', ['e/1-poster.webp']],
    ]);
  });

  it('un error de la RPC se lanza', async () => {
    const sb = {
      rpc: () => Promise.resolve({ data: null, error: { message: 'forbidden' } }),
    } as never;
    await expect(sharedMediaControls(sb).setHome('a', true)).rejects.toMatchObject({
      message: 'forbidden',
    });
  });

  it('sólo se quitan archivos de los buckets de la Galería', () => {
    expect(storageObjectOf(url)).toEqual({ bucket: 'event-clips', path: 'e/1.mp4' });
    expect(storageObjectOf('https://x/storage/v1/object/public/otro/a.webp')).toBeNull();
    expect(storageObjectOf('/contenido/galeria/a.webp')).toBeNull();
    expect(storageObjectOf(null)).toBeNull();
  });
});

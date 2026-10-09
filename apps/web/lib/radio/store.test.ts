import { existsSync, readFileSync, statSync } from 'node:fs';
import { RadioCatalogError, firstRadioSong, radioCatalogProblems } from '@boia/contracts';
import { describe, expect, it } from 'vitest';
import { readRadioCatalog, radioSongUrl } from './catalog';
import data from './muestra.json' with { type: 'json' };
import { SAMPLE_RADIO_CATALOG, sampleRadioCatalog } from './muestra';
import { createLocalRadioStore, memoryRadioKV } from './store';
import { checkSongFile, isMp3, songFileProblem, titleFromFileName } from './upload';

const mp3 = (n = 64) => new Blob([new Uint8Array([0x49, 0x44, 0x33, ...new Array(n).fill(0)])]);

function setup() {
  const kv = memoryRadioKV();
  let n = 0;
  const store = createLocalRadioStore(kv, { stamp: () => `t${++n}` });
  return { kv, store };
}

const upload = (title: string, genreId = 'house') => ({
  title,
  artist: 'Ana Marea',
  genreId,
  durationSeconds: 31.5,
  file: mp3(),
});

async function rejects(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (err) {
    return err instanceof RadioCatalogError ? err.code : String(err);
  }
  return 'ok';
}

describe('radio local (D-20): CRUD del catálogo', () => {
  it('la primera vez parte de la muestra y la guarda', async () => {
    const { kv, store } = setup();
    expect(await kv.getCatalog()).toBeNull();
    const c = await store.catalog();
    expect(c).toEqual(sampleRadioCatalog());
    expect(await kv.getCatalog()).toEqual(c);
  });

  it('subir: la canción va al final con su archivo en el navegador', async () => {
    const { kv, store } = setup();
    const before = await store.catalog();
    const c = await store.addSong(upload('Mi canción'));
    const added = c.songs.find((s) => s.title === 'Mi canción')!;
    expect(added).toMatchObject({
      id: 'cancion-t1',
      src: 'local-radio:cancion-t1',
      order: before.songs.length,
      first: false,
      genreId: 'house',
      durationSeconds: 31.5,
    });
    expect(kv.files.has('cancion-t1')).toBe(true);
    expect(await store.catalog()).toEqual(c);
    expect(await radioSongUrl(added, async () => kv)).toMatch(/^blob:/);
  });

  it('editar, reordenar, marcar la primera y borrar (con su archivo)', async () => {
    const { kv, store } = setup();
    await store.addSong(upload('Uno'));
    let c = await store.updateSong('cancion-t1', { title: 'Uno bis', artist: 'Otro' });
    expect(c.songs.find((s) => s.id === 'cancion-t1')).toMatchObject({
      title: 'Uno bis',
      artist: 'Otro',
    });
    c = await store.moveSong('cancion-t1', 0);
    expect(c.songs.find((s) => s.id === 'cancion-t1')?.order).toBe(0);
    c = await store.setFirst('cancion-t1');
    expect(firstRadioSong(c)?.id).toBe('cancion-t1');
    expect(c.songs.filter((s) => s.first)).toHaveLength(1);
    c = await store.removeSong('cancion-t1');
    expect(c.songs.some((s) => s.id === 'cancion-t1')).toBe(false);
    expect(kv.files.has('cancion-t1')).toBe(false);
    // La primera pasa a la de arriba.
    expect(firstRadioSong(c)?.id).toBe(c.songs.find((s) => s.order === 0)?.id);
    expect(radioCatalogProblems(c)).toEqual([]);
  });

  it('exactamente una primera tras cualquier cambio, también subiendo una «primera»', async () => {
    const { store } = setup();
    let c = await store.addSong({ ...upload('Nueva primera'), first: true });
    expect(c.songs.filter((s) => s.first).map((s) => s.id)).toEqual(['cancion-t1']);
    for (const s of c.songs.slice(0, 3)) c = await store.removeSong(s.id);
    expect(c.songs.filter((s) => s.first)).toHaveLength(1);
  });

  it('géneros: crear, renombrar (sus canciones lo siguen) y borrar (bloqueado si tiene canciones)', async () => {
    const { store } = setup();
    let c = await store.addGenre('Cumbia');
    expect(c.genres.find((g) => g.id === 'cumbia')?.name).toBe('Cumbia');
    expect(await rejects(store.addGenre('cumbia'))).toBe('genre_exists');
    c = await store.renameGenre('techno', 'Techno de barco');
    const techno = c.songs.filter((s) => s.genreId === 'techno');
    expect(techno.length).toBeGreaterThan(0);
    expect(c.genres.find((g) => g.id === 'techno')?.name).toBe('Techno de barco');
    expect(await rejects(store.deleteGenre('techno'))).toBe('genre_in_use');
    c = await store.deleteGenre('cumbia');
    expect(c.genres.some((g) => g.id === 'cumbia')).toBe(false);
    expect(await rejects(store.addSong(upload('x', 'cumbia')))).toBe('unknown_genre');
  });

  it('cambios a la vez se aplican uno detrás de otro', async () => {
    const { store } = setup();
    await Promise.all([store.addGenre('Uno'), store.addGenre('Dos'), store.addGenre('Tres')]);
    const names = (await store.catalog()).genres.map((g) => g.name);
    expect(names).toEqual(expect.arrayContaining(['Uno', 'Dos', 'Tres']));
  });

  it('un catálogo guardado que no vale vuelve a la muestra', async () => {
    const { kv, store } = setup();
    await kv.putCatalog({ genres: [], songs: [{ id: 'x' }] } as never);
    expect(await store.catalog()).toEqual(sampleRadioCatalog());
  });
});

describe('radio: el catálogo que lee el reproductor', () => {
  it('modo local: el de este navegador', async () => {
    const kv = memoryRadioKV();
    const store = createLocalRadioStore(kv);
    await store.addGenre('Cumbia');
    const c = await readRadioCatalog({
      supabase: false,
      readShared: () => Promise.reject(new Error('no')),
      localKV: async () => kv,
    });
    expect(c.source).toBe('local');
    expect(c.genres.some((g) => g.id === 'cumbia')).toBe(true);
  });

  it('con cuentas: las tablas; vacías o con error, la muestra', async () => {
    const shared = { genres: [{ id: 'pop', name: 'Pop' }], songs: [] };
    const deps = (read: () => Promise<typeof shared>) => ({
      supabase: true,
      readShared: read,
      localKV: () => Promise.reject(new Error('no')),
    });
    expect((await readRadioCatalog(deps(async () => shared))).source).toBe('muestra');
    const one = {
      ...shared,
      songs: [
        {
          id: 'a',
          title: 'A',
          artist: 'B',
          genreId: 'pop',
          durationSeconds: 3,
          src: 'https://x.supabase.co/storage/v1/object/public/radio-songs/a.mp3',
          order: 0,
          first: true,
        },
      ],
    };
    expect(await readRadioCatalog(deps(async () => one as never))).toMatchObject({
      source: 'shared',
      songs: one.songs,
    });
    const warn = console.warn;
    console.warn = () => undefined;
    try {
      expect((await readRadioCatalog(deps(() => Promise.reject(new Error('400'))))).source).toBe(
        'muestra',
      );
    } finally {
      console.warn = warn;
    }
  });
});

describe('radio: la muestra (art/radio/generar.py)', () => {
  const pub = (src: string) => new URL(`../../public${src}`, import.meta.url);

  it('vale, con una sola primera, y cada canción tiene su MP3', () => {
    expect(radioCatalogProblems(SAMPLE_RADIO_CATALOG)).toEqual([]);
    expect(SAMPLE_RADIO_CATALOG.songs).toHaveLength(data.songs.length);
    expect(SAMPLE_RADIO_CATALOG.songs.filter((s) => s.first)).toHaveLength(1);
    for (const s of SAMPLE_RADIO_CATALOG.songs) {
      expect(existsSync(pub(s.src)), s.src).toBe(true);
      expect(isMp3(new Uint8Array(readFileSync(pub(s.src)).subarray(0, 4))), s.src).toBe(true);
    }
  });

  it('todos los géneros de muestra tienen canciones y el total cabe en 3 MB', () => {
    const used = new Set(SAMPLE_RADIO_CATALOG.songs.map((s) => s.genreId));
    expect([...used].sort()).toEqual(SAMPLE_RADIO_CATALOG.genres.map((g) => g.id).sort());
    const total = SAMPLE_RADIO_CATALOG.songs.reduce((n, s) => n + statSync(pub(s.src)).size, 0);
    expect(total).toBe(data.totalBytes);
    expect(total).toBeLessThanOrEqual(3_000_000);
  });
});

describe('radio: el MP3 que se sube', () => {
  it('por sus bytes: ID3 o cabecera de trama; otra cosa no', () => {
    expect(isMp3(new Uint8Array([0x49, 0x44, 0x33, 4]))).toBe(true);
    expect(isMp3(new Uint8Array([0xff, 0xfb, 0x90, 0x44]))).toBe(true);
    expect(isMp3(new Uint8Array([0x52, 0x49, 0x46, 0x46]))).toBe(false); // WAV
    expect(songFileProblem(new Uint8Array([0x66, 0x4c, 0x61, 0x43]))).toBe('type');
  });

  it('lee la duración; sin duración o demasiado larga no vale', async () => {
    expect(await checkSongFile(mp3(), async () => 183.456)).toBe(183.46);
    expect(await checkSongFile(mp3(), async () => null).catch((e: Error) => e.message)).toBe(
      'audio',
    );
    expect(await checkSongFile(mp3(), async () => 99_999).catch((e: Error) => e.message)).toBe(
      'long',
    );
  });

  it('propone el título del nombre del archivo', () => {
    expect(titleFromFileName('02 - Mi canción.mp3')).toBe('Mi canción');
    expect(titleFromFileName('ola_de_noche.mp3')).toBe('ola de noche');
  });
});

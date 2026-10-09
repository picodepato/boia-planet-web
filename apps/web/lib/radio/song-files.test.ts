import { describe, expect, it } from 'vitest';
import { missingSongFiles } from './song-files';
import { publicFilePresent, createSharedRadioStore } from './shared-store';
import { createLocalRadioStore, memoryRadioKV } from './store';
import { SAMPLE_RADIO_CATALOG, sampleRadioCatalog } from './muestra';

const mp3 = () => new Blob([new Uint8Array([0x49, 0x44, 0x33, 0, 0, 0])]);

describe('radio admin: canciones sin archivo (plan 023 T257)', () => {
  it('local: una canción cuyo MP3 falta en IndexedDB se marca; la muestra cuenta como presente', async () => {
    const kv = memoryRadioKV();
    const store = createLocalRadioStore(kv, { stamp: () => 'a1' });
    let c = await store.addSong({
      title: 'Borrada a mano',
      artist: 'Brisa FM',
      genreId: 'house',
      durationSeconds: 20,
      file: mp3(),
    });
    const added = c.songs.find((s) => s.id === 'cancion-a1')!;
    kv.files.delete('cancion-a1');
    c = await store.catalog();
    const missing = await missingSongFiles(c.songs, (s) => store.songFilePresent(s));
    expect([...missing]).toEqual([added.id]);
    expect(await store.songFilePresent(c.songs[0]!)).toBe(true);
  });

  it('local: quitar una canción cuyo archivo ya no está no falla y la saca del catálogo', async () => {
    const kv = memoryRadioKV();
    const store = createLocalRadioStore(kv, { stamp: () => 'b2' });
    await store.addSong({
      title: 'Sin archivo',
      artist: 'Brisa FM',
      genreId: 'house',
      durationSeconds: 20,
      file: mp3(),
    });
    kv.files.delete('cancion-b2');
    const c = await store.removeSong('cancion-b2');
    expect(c.songs.some((s) => s.id === 'cancion-b2')).toBe(false);
    expect(c).toEqual(await store.catalog());
  });

  it('con cuentas: un HEAD a la URL pública; 404 o 400 es ausente, error de red o 200 es presente', async () => {
    const url = 'https://x.supabase.co/storage/v1/object/public/radio-songs/cancion-q.mp3';
    const fetchWith = (status: number) => async () => new Response(null, { status });
    expect(await publicFilePresent(url, fetchWith(200) as typeof fetch)).toBe(true);
    expect(await publicFilePresent(url, fetchWith(404) as typeof fetch)).toBe(false);
    expect(await publicFilePresent(url, fetchWith(400) as typeof fetch)).toBe(false);
    expect(
      await publicFilePresent(url, (async () => {
        throw new TypeError('network');
      }) as typeof fetch),
    ).toBe(true);
    expect(await publicFilePresent('/radio/muestra/muestra-001.mp3')).toBe(true);
  });

  it('con cuentas: la canción sin archivo se marca y quitarla no falla aunque el objeto ya no esté', async () => {
    const song = sampleRadioCatalog().songs[0]!;
    const row = {
      id: 'cancion-q',
      title: 'Borrada en Supabase',
      artist: 'Brisa FM',
      genre_id: song.genreId,
      duration_seconds: 20,
      url: 'https://x.supabase.co/storage/v1/object/public/radio-songs/cancion-q.mp3',
      position: 0,
      is_first: true,
    };
    const removed: string[] = [];
    const songRows: Record<string, unknown>[] = [{ ...row }];
    const client = {
      from: (table: string) => {
        const rows = table === 'radio_genres' ? [] : songRows;
        const chain = {
          select: () => chain,
          order: () => chain,
          eq: () => chain,
          then: (ok: (v: unknown) => unknown) =>
            Promise.resolve({ data: rows, error: null }).then(ok),
          delete: () => ({
            eq: (col: string, value: unknown) => {
              const at = rows.findIndex((r) => r[col] === value);
              if (at >= 0) rows.splice(at, 1);
              return Promise.resolve({ data: null, error: null });
            },
          }),
        };
        return chain;
      },
      storage: {
        from: () => ({
          remove: async (paths: string[]) => {
            removed.push(...paths);
            // Supabase no encuentra el objeto: error, pero la canción igual se quita.
            return { data: null, error: { message: 'Object not found' } };
          },
        }),
      },
      rpc: async () => ({ data: null, error: null }),
    };
    const store = createSharedRadioStore(
      client as never,
      () => 'x',
      async (url) => !url.includes('cancion-q'),
    );
    const c = await store.catalog();
    const missing = await missingSongFiles(c.songs, (s) => store.songFilePresent(s));
    expect([...missing]).toEqual(['cancion-q']);
    const after = await store.removeSong('cancion-q');
    expect(removed).toEqual(['cancion-q.mp3']);
    expect(after.songs.some((s) => s.id === 'cancion-q')).toBe(false);
  });

  it('las respuestas se guardan: no se vuelve a preguntar por la misma canción', async () => {
    const songs = SAMPLE_RADIO_CATALOG.songs.slice(0, 3);
    const memo = new Map<string, boolean>();
    let asked = 0;
    const present = async () => {
      asked += 1;
      return false;
    };
    const first = await missingSongFiles(songs, present, memo);
    const again = await missingSongFiles(songs, present, memo);
    expect(first.size).toBe(3);
    expect([...again]).toEqual([...first]);
    expect(asked).toBe(3);
  });
});

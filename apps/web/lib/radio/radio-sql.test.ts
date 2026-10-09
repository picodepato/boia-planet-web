import { readFileSync } from 'node:fs';
import { RADIO_LIMITS, RadioCatalogError } from '@boia/contracts';
import { describe, expect, it } from 'vitest';
import { SAMPLE_RADIO_CATALOG } from './muestra';
import { bucketPathOf, createSharedRadioStore, radioCatalogFromRows } from './shared-store';
import { RADIO_SONG_BUCKET, SONG_UPLOAD_LIMITS } from './upload';

/**
 * La migración de la radio (plan 022 T246), leída como texto: lo que esta
 * máquina puede comprobar sin PostgreSQL (no está aplicada a ningún
 * proyecto). Y el almacén con cuentas contra un cliente falso.
 */
const read = (path: string) =>
  readFileSync(new URL(`../../../../${path}`, import.meta.url), 'utf8');
const FILE = '20261009100100_radio.sql';
const SQL = read(`supabase/migrations/${FILE}`);
const TYPES = read('packages/db/src/database.types.ts');

describe('migración de la radio', () => {
  it('siembra los géneros de muestra del catálogo', () => {
    for (const g of SAMPLE_RADIO_CATALOG.genres) expect(SQL).toContain(`('${g.id}', '${g.name}')`);
  });

  it('una sola primera: índice único parcial, la primera por defecto, la de arriba al borrar y comprobación diferida', () => {
    expect(SQL).toContain(
      'create unique index radio_songs_one_first on public.radio_songs (is_first) where is_first;',
    );
    expect(SQL).toMatch(/before insert on public\.radio_songs[\s\S]*radio_song_default_first/);
    expect(SQL).toMatch(/after delete on public\.radio_songs[\s\S]*radio_song_promote_first/);
    expect(SQL).toMatch(
      /create constraint trigger radio_songs_check_first[\s\S]*initially deferred/,
    );
  });

  it('borrar un género con canciones lo impide la clave ajena', () => {
    expect(SQL).toContain('references public.radio_genres (id) on delete restrict');
  });

  it('los topes son los del contrato y el bucket los de la subida', () => {
    expect(SQL).toContain(`between 1 and ${RADIO_LIMITS.genreName}`);
    expect(SQL).toContain(`between 1 and ${RADIO_LIMITS.title}`);
    expect(SQL).toContain(`duration_seconds <= ${RADIO_LIMITS.maxSeconds}`);
    expect(SQL).toContain(
      `values ('${RADIO_SONG_BUCKET}', '${RADIO_SONG_BUCKET}', true, ${SONG_UPLOAD_LIMITS.maxBytes}, array['${SONG_UPLOAD_LIMITS.types.join("', '")}'])`,
    );
    expect(SQL).toContain(`/storage/v1/object/public/${RADIO_SONG_BUCKET}/`);
  });

  it('lectura pública, escritura del equipo; anon nunca escribe; las RPC piden admin', () => {
    expect(SQL).toContain('grant select on public.radio_songs to anon, authenticated;');
    expect(SQL).not.toMatch(/grant (insert|update|delete)[^;]* to [^;]*anon/);
    for (const op of ['insert', 'update', 'delete']) {
      for (const table of ['radio_genres', 'radio_songs']) {
        expect(SQL).toMatch(
          new RegExp(
            `create policy ${table}_staff_${op} on public\\.${table} for ${op} to authenticated`,
          ),
        );
      }
    }
    for (const fn of ['radio_set_first', 'radio_reorder']) {
      const body = SQL.slice(SQL.indexOf(`create function public.${fn}(`));
      expect(body.slice(0, 400)).toContain("if not private.has_staff_role('admin') then");
    }
    // La primera y la posición no se escriben directamente.
    expect(SQL).toContain('update (title, artist, genre_id), delete on public.radio_songs');
    expect(SQL).toContain("if to_regclass('storage.buckets') is null then");
  });

  it('es la última migración y los tipos tienen las tablas y las RPC', () => {
    expect(FILE > '20261008200200_member_party_trash.sql').toBe(true);
    for (const name of [
      'radio_genres: {',
      'radio_songs: {',
      'radio_set_first: {',
      'radio_reorder: {',
    ]) {
      expect(TYPES).toContain(name);
    }
  });
});

/** Un cliente de Supabase falso: guarda lo que se le pide y responde lo justo. */
function fakeClient(opts: { deleteError?: unknown } = {}) {
  const genres = [{ id: 'techno', name: 'Techno' }];
  const songs: Record<string, unknown>[] = [];
  const calls: string[] = [];
  const result = (data: unknown, error: unknown = null) => Promise.resolve({ data, error });
  const query = (table: string) => {
    const rows = table === 'radio_genres' ? genres : songs;
    const chain = {
      select: () => chain,
      order: () => chain,
      eq: () => chain,
      then: (ok: (v: unknown) => unknown) => result(rows).then(ok),
      insert: (row: Record<string, unknown>) => {
        calls.push(`insert ${table}`);
        if (table === 'radio_songs') songs.push({ ...row, is_first: songs.length === 0 });
        else genres.push(row as (typeof genres)[number]);
        return result(null);
      },
      update: (patch: Record<string, unknown>) => ({
        eq: (col: string, value: unknown) => {
          calls.push(`update ${table}`);
          for (const r of rows as Record<string, unknown>[]) {
            if (r[col] === value) Object.assign(r, patch);
          }
          return result(null);
        },
      }),
      delete: () => ({
        eq: () => (calls.push(`delete ${table}`), result(null, opts.deleteError ?? null)),
      }),
    };
    return chain;
  };
  const storage = {
    from: (bucket: string) => ({
      upload: (path: string) => (calls.push(`upload ${bucket}/${path}`), result({ path })),
      getPublicUrl: (path: string) => ({
        data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/${bucket}/${path}` },
      }),
      remove: (paths: string[]) => (calls.push(`remove ${paths.join(',')}`), result(null)),
    }),
  };
  const rpc = (fn: string, args: unknown) => (
    calls.push(`rpc ${fn} ${JSON.stringify(args)}`),
    result(null)
  );
  return { client: { from: query, storage, rpc } as never, calls, songs };
}

describe('radio con cuentas (cliente falso)', () => {
  it('subir: archivo al bucket, fila y, si se pide, la primera por RPC', async () => {
    const { client, calls, songs } = fakeClient();
    const store = createSharedRadioStore(client, () => 'x1');
    const c = await store.addSong({
      title: 'Ola',
      artist: 'Brisa FM',
      genreId: 'techno',
      durationSeconds: 12.5,
      file: new Blob([]),
      first: true,
    });
    expect(calls).toEqual([
      `upload ${RADIO_SONG_BUCKET}/cancion-x1.mp3`,
      'insert radio_songs',
      'rpc radio_set_first {"p_song":"cancion-x1"}',
    ]);
    expect(songs[0]).toMatchObject({ position: 0, genre_id: 'techno' });
    expect(c.songs[0]).toMatchObject({ id: 'cancion-x1', first: true, durationSeconds: 12.5 });
  });

  it('plan 023 T246: crear un género, subirle una canción y renombrarlo (mismo id)', async () => {
    const { client, calls, songs } = fakeClient();
    let n = 0;
    const store = createSharedRadioStore(client, () => `y${++n}`);
    let c = await store.addGenre('Cumbia');
    expect(c.genres.map((g) => g.id)).toEqual(['techno', 'cumbia']);
    c = await store.addSong({
      title: 'Ola',
      artist: 'Brisa FM',
      genreId: 'cumbia',
      durationSeconds: 20,
      file: new Blob([]),
    });
    expect(songs[0]).toMatchObject({ genre_id: 'cumbia' });
    c = await store.renameGenre('cumbia', 'Cumbia del puerto');
    expect(c.genres.find((g) => g.id === 'cumbia')?.name).toBe('Cumbia del puerto');
    expect(c.songs.map((s) => s.genreId)).toEqual(['cumbia']);
    expect(calls).toContain('insert radio_genres');
    expect(calls).toContain('update radio_genres');
    const err = await store.addGenre('techno').catch((e: unknown) => e);
    expect((err as RadioCatalogError).code).toBe('genre_exists');
  });

  it('un género con canciones: la base lo rechaza (23503) y se dice `genre_in_use`', async () => {
    const { client } = fakeClient({ deleteError: { code: '23503', message: 'fk' } });
    const store = createSharedRadioStore(client);
    const err = await store.deleteGenre('techno').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RadioCatalogError);
    expect((err as RadioCatalogError).code).toBe('genre_in_use');
  });

  it('las filas que no valen se saltan; el camino del archivo sale de su URL', () => {
    const c = radioCatalogFromRows(
      [{ id: 'techno', name: 'Techno' }],
      [
        {
          id: 'a',
          title: 'A',
          artist: 'B',
          genre_id: 'techno',
          duration_seconds: '30.00',
          url: 'https://x.supabase.co/storage/v1/object/public/radio-songs/a.mp3',
          position: 0,
          is_first: true,
        },
        {
          id: 'b',
          title: '',
          artist: 'B',
          genre_id: 'techno',
          duration_seconds: 1,
          url: 'x',
          position: 1,
          is_first: false,
        },
      ],
    );
    expect(c.songs.map((s) => s.id)).toEqual(['a']);
    expect(c.songs[0]?.durationSeconds).toBe(30);
    expect(bucketPathOf(c.songs[0]!.src)).toBe('a.mp3');
  });
});

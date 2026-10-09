import {
  type RadioCatalog,
  type RadioGenre,
  RadioCatalogError,
  type RadioSong,
  addRadioGenre,
  deleteRadioGenre,
  moveRadioSong,
  radioGenreSchema,
  radioSongSchema,
  renameRadioGenre,
  sortedRadioSongs,
  updateRadioSong,
} from '@boia/contracts';
import type { BoiaSupabase } from '../supabase/browser';
import type { RadioAdminStore } from './store';
import { radioStamp } from './store';
import { RADIO_SONG_BUCKET, radioSongPath } from './upload';

/**
 * La radio con cuentas (plan 022 T246, migración 20261009100100_radio.sql):
 * las tablas `radio_genres` y `radio_songs` (lectura pública) y el bucket
 * público `radio-songs`. Escribe sólo el equipo (admin u owner con segundo
 * factor). La primera canción y el orden cambian con las RPC
 * `radio_set_first` y `radio_reorder`; la base garantiza que haya
 * exactamente una primera.
 */

export interface RadioGenreRow {
  id: string;
  name: string;
}

export interface RadioSongRow {
  id: string;
  title: string;
  artist: string;
  genre_id: string;
  duration_seconds: number | string;
  url: string;
  position: number;
  is_first: boolean;
}

/** Las filas como catálogo (las que no valen se saltan). */
export function radioCatalogFromRows(
  genreRows: readonly RadioGenreRow[],
  songRows: readonly RadioSongRow[],
): RadioCatalog {
  const genres = genreRows.flatMap((r): RadioGenre[] => {
    const g = radioGenreSchema.safeParse({ id: r.id, name: r.name });
    return g.success ? [g.data] : [];
  });
  const known = new Set(genres.map((g) => g.id));
  const songs = songRows.flatMap((r): RadioSong[] => {
    const s = radioSongSchema.safeParse({
      id: r.id,
      title: r.title,
      artist: r.artist,
      genreId: r.genre_id,
      durationSeconds: Number(r.duration_seconds),
      src: r.url,
      order: r.position,
      first: r.is_first,
    });
    return s.success && known.has(s.data.genreId) ? [s.data] : [];
  });
  return { genres, songs: sortedRadioSongs({ genres, songs }) };
}

type RadioClient = Pick<BoiaSupabase, 'from' | 'storage' | 'rpc'>;

/** El error de PostgREST como error de la radio cuando se sabe cuál es. */
function translate(error: unknown): Error {
  const e = (error && typeof error === 'object' ? error : {}) as {
    code?: string;
    message?: string;
  };
  if (e.code === '23503') return new RadioCatalogError('genre_in_use');
  if (e.code === '23505') return new RadioCatalogError('genre_exists');
  if (e.message?.includes('first_count')) return new RadioCatalogError('first_count');
  if (e.message?.includes('unknown_song')) return new RadioCatalogError('unknown_song');
  if (error instanceof Error) return error;
  return new Error(e.message ?? String(error));
}

async function must<T>(call: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await call;
  if (error) throw translate(error);
  return data;
}

/** El camino de un archivo dentro del bucket a partir de su URL pública. */
export function bucketPathOf(url: string): string | null {
  const marker = `/storage/v1/object/public/${RADIO_SONG_BUCKET}/`;
  const at = url.indexOf(marker);
  return at < 0 ? null : url.slice(at + marker.length);
}

/** Lee el catálogo de Supabase (sin sesión también: es público). */
export async function readSharedRadioCatalog(sb: Pick<RadioClient, 'from'>): Promise<RadioCatalog> {
  const [genres, songs] = await Promise.all([
    must(sb.from('radio_genres').select('id, name').order('created_at').order('id')),
    must(
      sb
        .from('radio_songs')
        .select('id, title, artist, genre_id, duration_seconds, url, position, is_first')
        .order('position')
        .order('id'),
    ),
  ]);
  return radioCatalogFromRows(genres ?? [], songs ?? []);
}

export function createSharedRadioStore(
  sb: RadioClient,
  stamp: () => string = () => radioStamp(),
): RadioAdminStore {
  const catalog = () => readSharedRadioCatalog(sb);
  return {
    kind: 'shared',
    catalog,
    async addSong(input) {
      const current = await catalog();
      if (!current.genres.some((g) => g.id === input.genreId)) {
        throw new RadioCatalogError('unknown_genre');
      }
      const id = `cancion-${stamp()}`;
      const path = radioSongPath(id);
      const bucket = sb.storage.from(RADIO_SONG_BUCKET);
      await must(
        bucket.upload(path, input.file, {
          contentType: 'audio/mpeg',
          upsert: false,
          cacheControl: '31536000',
        }),
      );
      const url = bucket.getPublicUrl(path).data.publicUrl;
      const row = radioSongSchema.parse({
        id,
        title: input.title,
        artist: input.artist,
        genreId: input.genreId,
        durationSeconds: input.durationSeconds,
        src: url,
        order: current.songs.length,
        first: false,
      });
      try {
        await must(
          sb.from('radio_songs').insert({
            id,
            title: row.title,
            artist: row.artist,
            genre_id: row.genreId,
            duration_seconds: row.durationSeconds,
            url,
            position: current.songs.reduce((m, s) => Math.max(m, s.order + 1), 0),
          }),
        );
      } catch (err) {
        await bucket.remove([path]).catch(() => undefined);
        throw err;
      }
      if (input.first) await must(sb.rpc('radio_set_first', { p_song: id }));
      return catalog();
    },
    async updateSong(id, patch) {
      const next = updateRadioSong(await catalog(), id, patch);
      const song = next.songs.find((s) => s.id === id)!;
      await must(
        sb
          .from('radio_songs')
          .update({ title: song.title, artist: song.artist, genre_id: song.genreId })
          .eq('id', id),
      );
      return catalog();
    },
    async removeSong(id) {
      const song = (await catalog()).songs.find((s) => s.id === id);
      if (!song) throw new RadioCatalogError('unknown_song');
      await must(sb.from('radio_songs').delete().eq('id', id));
      const path = bucketPathOf(song.src);
      if (path) {
        const { error } = await sb.storage.from(RADIO_SONG_BUCKET).remove([path]);
        if (error) console.warn('[boia] radio: archivo sin borrar', path, error);
      }
      return catalog();
    },
    async moveSong(id, to) {
      const next = moveRadioSong(await catalog(), id, to);
      await must(sb.rpc('radio_reorder', { p_ids: sortedRadioSongs(next).map((s) => s.id) }));
      return catalog();
    },
    async setFirst(id) {
      await must(sb.rpc('radio_set_first', { p_song: id }));
      return catalog();
    },
    async addGenre(name) {
      const current = await catalog();
      const next = addRadioGenre(current, name);
      const added = next.genres.find((g) => !current.genres.some((c) => c.id === g.id))!;
      await must(sb.from('radio_genres').insert({ id: added.id, name: added.name }));
      return catalog();
    },
    async renameGenre(id, name) {
      const next = renameRadioGenre(await catalog(), id, name);
      const genre = next.genres.find((g) => g.id === id)!;
      await must(sb.from('radio_genres').update({ name: genre.name }).eq('id', id));
      return catalog();
    },
    async deleteGenre(id) {
      deleteRadioGenre(await catalog(), id);
      await must(sb.from('radio_genres').delete().eq('id', id));
      return catalog();
    },
  };
}

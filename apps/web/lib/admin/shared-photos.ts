import {
  type Album,
  type BoiaEvent,
  type HomeContent,
  type Photo,
  albumSchema,
  photoSchema,
} from '@boia/contracts';
import type { BoiaRepository } from '@boia/store';
import { isSupabaseConfigured } from '../supabase/config';

/**
 * Las fotos de las islas con cuentas (plan 017 T189, decisión 4): el Admin
 * las sube al bucket `event-photos` y las apunta en `event_albums` y
 * `event_photos` (lectura pública). La web las suma al contenido de este
 * navegador: el álbum del evento, sus fotos y, si el Admin lo marcó pasado,
 * el evento como finalizado en su isla. En modo local no hay nada que sumar.
 */

export interface SharedAlbumRow {
  id: string;
  event_id: string;
  island_id: string;
  title: string;
  event_date: string | null;
  event_finished: boolean;
}

export interface SharedPhotoRow {
  id: string;
  album_id: string;
  url: string;
  alt: string;
  width: number;
  height: number;
  created_at: string;
}

export interface SharedPhotos {
  albums: Album[];
  photos: Photo[];
  /** Evento → isla de los que el Admin marcó como pasados. */
  finished: Map<string, string>;
}

export const NO_SHARED_PHOTOS: SharedPhotos = { albums: [], photos: [], finished: new Map() };

/** Las filas de Supabase como álbumes y fotos del contenido (las que no valen se saltan). */
export function sharedPhotosFromRows(
  albumRows: readonly SharedAlbumRow[],
  photoRows: readonly SharedPhotoRow[],
): SharedPhotos {
  const albums: Album[] = [];
  const finished = new Map<string, string>();
  for (const r of albumRows) {
    const a = albumSchema.safeParse({
      id: r.id,
      title: r.title,
      eventId: r.event_id,
      islandId: r.island_id,
      ...(r.event_date ? { date: new Date(r.event_date).toISOString() } : {}),
    });
    if (!a.success) continue;
    albums.push(a.data);
    if (r.event_finished) finished.set(r.event_id, r.island_id);
  }
  const known = new Set(albums.map((a) => a.id));
  const photos = [...photoRows]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .flatMap((r) => {
      if (!known.has(r.album_id)) return [];
      const p = photoSchema.safeParse({
        id: r.id,
        albumId: r.album_id,
        alt: r.alt,
        src: r.url,
        width: r.width,
        height: r.height,
      });
      return p.success ? [p.data] : [];
    });
  return { albums, photos, finished };
}

const byId = <T extends { id: string }>(base: readonly T[], extra: readonly T[]): T[] => {
  const ids = new Set(extra.map((x) => x.id));
  return [...base.filter((x) => !ids.has(x.id)), ...extra];
};

/** El contenido con lo compartido encima: álbumes y fotos por id; los eventos pasados, finalizados. */
export function mergeSharedPhotos<
  C extends {
    events: readonly BoiaEvent[];
    albums?: readonly Album[] | undefined;
    photos: readonly Photo[];
  },
>(content: C, shared: SharedPhotos): C & { albums: Album[]; photos: Photo[]; events: BoiaEvent[] } {
  const albums = byId(content.albums ?? [], shared.albums);
  const photos = byId(content.photos, shared.photos);
  const events = content.events.map((e) => {
    const island = shared.finished.get(e.id);
    if (island === undefined || e.state === 'draft') return e;
    return { ...e, state: 'finished' as const, stateSource: 'manual' as const, islandId: island };
  });
  return { ...content, albums, photos, events };
}

/** Lee lo compartido de Supabase (sin sesión: es público). Sin Supabase o con error, nada. */
export async function readSharedPhotos(): Promise<SharedPhotos> {
  if (typeof window === 'undefined' || !isSupabaseConfigured()) return NO_SHARED_PHOTOS;
  try {
    const { browserSupabase } = await import('../supabase/browser');
    const sb = browserSupabase();
    if (!sb) return NO_SHARED_PHOTOS;
    const [albums, photos] = await Promise.all([
      sb.from('event_albums').select('id, event_id, island_id, title, event_date, event_finished'),
      sb.from('event_photos').select('id, album_id, url, alt, width, height, created_at'),
    ]);
    if (albums.error || photos.error) throw albums.error ?? photos.error;
    return sharedPhotosFromRows(albums.data ?? [], photos.data ?? []);
  } catch (err) {
    console.warn('[boia] fotos de las islas sin leer', err);
    return NO_SHARED_PHOTOS;
  }
}

/** El contenido de este navegador con las fotos compartidas (con cuentas). */
export async function homeWithSharedPhotos(repo: BoiaRepository): Promise<HomeContent> {
  const [home, shared] = await Promise.all([repo.content.home(), readSharedPhotos()]);
  return shared === NO_SHARED_PHOTOS ? home : mergeSharedPhotos(home, shared);
}

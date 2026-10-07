import { type BoiaEvent, eventAlbumId } from '@boia/contracts';
import type { BoiaSupabase } from '../supabase/browser';
import type { AdminActions, UploadedPhoto } from './actions';
import {
  EVENT_PHOTO_BUCKET,
  type PhotoCodec,
  type PhotoOutputType,
  type PhotoUploadProblem,
  photoAlt,
  photoUploadProblem,
  resizePhoto,
  uploadStamp,
  eventPhotoPath,
} from './photo-upload';

/**
 * Subir las fotos de una isla desde el Admin (plan 017 T189, decisión 4):
 * cada archivo se comprueba y se copia a WebP (`photo-upload.ts`) y luego se
 * guarda donde toca. Modo local: el archivo en este navegador y la foto en
 * el repositorio local (`addIslandPhotos`). Con cuentas: el bucket
 * `event-photos` y las tablas `event_albums` y `event_photos`, para todos.
 */

/** Un archivo que no vale, con su nombre para decírselo al Admin. */
export class PhotoUploadError extends Error {
  constructor(
    readonly problem: PhotoUploadProblem,
    readonly fileName: string,
  ) {
    super(problem);
  }
}

export interface PreparedPhoto {
  /** Id de la foto y clave del archivo: `foto-<evento>-<marca>`. */
  id: string;
  stamp: string;
  blob: Blob;
  type: PhotoOutputType;
  width: number;
  height: number;
  alt: string;
}

/** Id de foto válido en el repositorio y en la tabla (letras, números, - y _). */
export function photoId(eventId: string, stamp: string): string {
  return `foto-${eventId.replace(/[^A-Za-z0-9_-]/g, '-')}-${stamp}`.slice(0, 160);
}

/** Comprueba todos los archivos (el primero que no vale para todo) y hace sus copias. */
export async function preparePhotos(
  files: readonly File[],
  eventId: string,
  altBase: string,
  codec?: PhotoCodec,
): Promise<PreparedPhoto[]> {
  for (const f of files) {
    const problem = photoUploadProblem(new Uint8Array(await f.arrayBuffer()));
    if (problem) throw new PhotoUploadError(problem, f.name);
  }
  const out: PreparedPhoto[] = [];
  for (const [i, f] of files.entries()) {
    const copy = await resizePhoto(f, codec);
    const stamp = `${uploadStamp()}${i}`;
    out.push({
      id: photoId(eventId, stamp),
      stamp,
      ...copy,
      alt: photoAlt(altBase, i, files.length),
    });
  }
  return out;
}

export interface SaveIslandPhotos {
  islandId: string;
  event: BoiaEvent;
  photos: readonly PreparedPhoto[];
  markPast: boolean;
}

/** Modo local: cada archivo a IndexedDB y las fotos, el álbum y el evento al repositorio. */
export async function saveLocalIslandPhotos(
  actions: Pick<AdminActions, 'addIslandPhotos'>,
  input: SaveIslandPhotos,
  put: (key: string, blob: Blob) => Promise<string>,
): Promise<void> {
  const uploaded: UploadedPhoto[] = [];
  for (const p of input.photos) {
    uploaded.push({
      id: p.id,
      src: await put(p.id, p.blob),
      alt: p.alt,
      width: p.width,
      height: p.height,
    });
  }
  await actions.addIslandPhotos({
    islandId: input.islandId,
    eventId: input.event.id,
    photos: uploaded,
    markPast: input.markPast,
  });
}

/** Lo mínimo del cliente de Supabase que usa la subida (las pruebas pasan uno falso). */
type SharedClient = Pick<BoiaSupabase, 'from' | 'storage'>;

async function must<T>(call: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await call;
  if (error)
    throw error instanceof Error
      ? error
      : new Error(String((error as { message?: string }).message ?? error));
  return data;
}

/**
 * Con cuentas: sube cada copia al bucket y apunta el álbum del evento (uno
 * por evento: se actualiza si ya estaba) y sus fotos. Lo lee todo el mundo.
 */
export async function saveSharedIslandPhotos(
  sb: SharedClient,
  input: SaveIslandPhotos,
): Promise<void> {
  const { event, islandId } = input;
  const had = (await must(sb.from('event_albums').select('id').eq('event_id', event.id))) ?? [];
  const albumId = had[0]?.id ?? eventAlbumId(event.id);
  const rows = [];
  for (const p of input.photos) {
    const path = eventPhotoPath(event.slug, p.stamp, p.type);
    await must(
      sb.storage
        .from(EVENT_PHOTO_BUCKET)
        .upload(path, p.blob, { contentType: p.type, upsert: false, cacheControl: '31536000' }),
    );
    const url = sb.storage.from(EVENT_PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
    rows.push({ id: p.id, album_id: albumId, url, alt: p.alt, width: p.width, height: p.height });
  }
  const album = {
    island_id: islandId,
    title: event.name,
    event_date: event.startsAt,
    ...(input.markPast ? { event_finished: true } : {}),
  };
  if (had.length > 0) {
    await must(sb.from('event_albums').update(album).eq('id', albumId));
  } else {
    await must(
      sb.from('event_albums').insert({
        ...album,
        id: albumId,
        event_id: event.id,
        event_finished: input.markPast,
      }),
    );
  }
  await must(sb.from('event_photos').insert(rows));
}

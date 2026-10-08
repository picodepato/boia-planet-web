import { type BoiaEvent, eventAlbumId } from '@boia/contracts';
import type { BoiaSupabase } from '../supabase/browser';
import type { AdminActions, UploadedPhoto } from './actions';
import {
  type ClipProbe,
  EVENT_CLIP_BUCKET,
  EVENT_PHOTO_BUCKET,
  type PhotoCodec,
  type PhotoOutputType,
  type PhotoUploadProblem,
  type ResizedPhoto,
  browserClipProbe,
  clipInfoProblem,
  clipUploadProblem,
  eventClipPath,
  isMp4,
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

interface PreparedBase {
  /** Id de la foto y clave del archivo: `foto-<evento>-<marca>`. */
  id: string;
  stamp: string;
  blob: Blob;
  width: number;
  height: number;
  alt: string;
}

/** Una foto: su copia WebP o JPEG. */
export interface PreparedImage extends PreparedBase {
  kind?: 'image';
  type: PhotoOutputType;
}

/** Un clip (T216): el mp4 tal cual y su póster, un fotograma copiado como las fotos. */
export interface PreparedClip extends PreparedBase {
  kind: 'video';
  type: 'video/mp4';
  poster: ResizedPhoto;
}

export type PreparedPhoto = PreparedImage | PreparedClip;

/** Id de foto válido en el repositorio y en la tabla (letras, números, - y _). */
export function photoId(eventId: string, stamp: string): string {
  return `foto-${eventId.replace(/[^A-Za-z0-9_-]/g, '-')}-${stamp}`.slice(0, 160);
}

/**
 * Comprueba todos los archivos (el primero que no vale para todo) y hace sus
 * copias. Un mp4 es un clip (T216): se abre para saber su tamaño y duración
 * y sacar el póster; el archivo se guarda tal cual.
 */
export async function preparePhotos(
  files: readonly File[],
  eventId: string,
  altBase: string,
  codec?: PhotoCodec,
  probe: ClipProbe = browserClipProbe(),
): Promise<PreparedPhoto[]> {
  const clips = new Map<File, Awaited<ReturnType<ClipProbe>>>();
  for (const f of files) {
    const bytes = new Uint8Array(await f.arrayBuffer());
    if (isMp4(bytes)) {
      const early = clipUploadProblem(bytes);
      if (early) throw new PhotoUploadError(early, f.name);
      const info = await probe(f).catch(() => null);
      const problem = clipInfoProblem(info);
      if (problem) throw new PhotoUploadError(problem, f.name);
      clips.set(f, info);
      continue;
    }
    const problem = photoUploadProblem(bytes);
    if (problem) throw new PhotoUploadError(problem, f.name);
  }
  const out: PreparedPhoto[] = [];
  for (const [i, f] of files.entries()) {
    const stamp = `${uploadStamp()}${i}`;
    const base = { id: photoId(eventId, stamp), stamp, alt: photoAlt(altBase, i, files.length) };
    const clip = clips.get(f);
    if (clip) {
      const poster = await resizePhoto(clip.frame, codec);
      out.push({
        ...base,
        kind: 'video',
        blob: f.type === 'video/mp4' ? f : new Blob([f], { type: 'video/mp4' }),
        type: 'video/mp4',
        width: clip.width,
        height: clip.height,
        poster,
      });
      continue;
    }
    out.push({ ...base, kind: 'image', ...(await resizePhoto(f, codec)) } satisfies PreparedImage);
  }
  return out;
}

/** La clave del póster de un clip en este navegador. */
export const posterKey = (photoId: string) => `${photoId}-poster`;

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
      ...(p.kind === 'video'
        ? { kind: 'video' as const, poster: await put(posterKey(p.id), p.poster.blob) }
        : {}),
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
  const upload = async (bucket: string, path: string, blob: Blob, contentType: string) => {
    await must(
      sb.storage
        .from(bucket)
        .upload(path, blob, { contentType, upsert: false, cacheControl: '31536000' }),
    );
    return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  };
  for (const p of input.photos) {
    const row = { id: p.id, album_id: albumId, alt: p.alt, width: p.width, height: p.height };
    if (p.kind === 'video') {
      // El clip a su bucket; su póster, con las fotos (T216).
      const url = await upload(
        EVENT_CLIP_BUCKET,
        eventClipPath(event.slug, p.stamp),
        p.blob,
        'video/mp4',
      );
      const posterUrl = await upload(
        EVENT_PHOTO_BUCKET,
        eventPhotoPath(event.slug, `${p.stamp}-poster`, p.poster.type),
        p.poster.blob,
        p.poster.type,
      );
      rows.push({ ...row, url, kind: 'video' as const, poster_url: posterUrl });
      continue;
    }
    const url = await upload(
      EVENT_PHOTO_BUCKET,
      eventPhotoPath(event.slug, p.stamp, p.type),
      p.blob,
      p.type,
    );
    rows.push({ ...row, url });
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

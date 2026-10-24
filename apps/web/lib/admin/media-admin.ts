import type { Photo } from '@boia/contracts';
import type { BoiaSupabase } from '../supabase/browser';
import { EVENT_CLIP_BUCKET, EVENT_PHOTO_BUCKET } from './photo-upload';
import { patchLocalMediaSetting, setLocalMediaOrder } from './media-settings';

/**
 * Lo que hace el Admin con cada pieza de la Galería (plan 048 T329): ponerla
 * o quitarla de la portada, ordenarlas y borrarla. Con cuentas va a Supabase
 * con las RPC `admin_media_*` (admin con segundo factor); en la demo, a este
 * navegador. Borrar una pieza subida la borra de verdad (fila y archivo); una
 * del código se oculta (el archivo sigue en el repo).
 */

/** Una pieza en la lista del Admin. */
export interface MediaPiece {
  photo: Photo;
  /** Subida a Supabase (`event_photos`): se borra de verdad. */
  uploaded: boolean;
}

export interface MediaControls {
  setHome(id: string, onHome: boolean): Promise<void>;
  /** El orden entero, de la primera a la última. */
  order(ids: readonly string[]): Promise<void>;
  remove(piece: MediaPiece): Promise<void>;
}

/** Bucket y ruta de un archivo público de Supabase Storage de las fotos o los clips. */
export function storageObjectOf(url: string | null | undefined): {
  bucket: string;
  path: string;
} | null {
  if (!url) return null;
  const m = /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/.exec(url);
  if (!m) return null;
  const [, bucket, path] = m;
  if (bucket !== EVENT_PHOTO_BUCKET && bucket !== EVENT_CLIP_BUCKET) return null;
  return { bucket: bucket!, path: decodeURIComponent(path!) };
}

type SharedClient = Pick<BoiaSupabase, 'rpc' | 'storage'>;

async function check<T>(call: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await call;
  if (error) throw error;
  return data;
}

/** Con cuentas: las RPC del Admin y, al borrar una subida, sus archivos del bucket. */
export function sharedMediaControls(sb: SharedClient): MediaControls {
  return {
    async setHome(id, onHome) {
      await check(sb.rpc('admin_media_set_home', { p_piece: id, p_on_home: onHome }));
    },
    async order(ids) {
      await check(sb.rpc('admin_media_order', { p_pieces: [...ids] }));
    },
    async remove(piece) {
      if (!piece.uploaded) {
        await check(sb.rpc('admin_media_hide', { p_piece: piece.photo.id }));
        return;
      }
      const res = (await check(sb.rpc('admin_media_delete', { p_piece: piece.photo.id }))) as {
        url?: string | null;
        poster_url?: string | null;
      } | null;
      // Los archivos de la fila borrada (el clip y su póster), cada uno de su bucket.
      const files = [res?.url, res?.poster_url]
        .map(storageObjectOf)
        .filter((o): o is { bucket: string; path: string } => o !== null);
      for (const bucket of new Set(files.map((f) => f.bucket))) {
        const paths = files.filter((f) => f.bucket === bucket).map((f) => f.path);
        await check(sb.storage.from(bucket).remove(paths));
      }
    },
  };
}

/**
 * La demo: los ajustes en este navegador. Borrar una pieza del código la
 * oculta; una añadida en este navegador va a la papelera del Admin
 * (`removeFromRepo`), como el resto de la demo.
 */
export function localMediaControls(
  codeIds: ReadonlySet<string>,
  removeFromRepo: (id: string) => Promise<void>,
): MediaControls {
  return {
    async setHome(id, onHome) {
      patchLocalMediaSetting(id, { onHome });
    },
    async order(ids) {
      setLocalMediaOrder(ids);
    },
    async remove(piece) {
      const id = piece.photo.id;
      if (codeIds.has(id)) patchLocalMediaSetting(id, { hidden: true });
      else await removeFromRepo(id);
    },
  };
}

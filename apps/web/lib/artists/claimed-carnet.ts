import type { BoiaSupabase } from '../supabase/browser';
import { CONTENT_ARTIST_CARNET_PREFIX } from './entries';

/**
 * El Carnet que el repositorio construye de una ficha (`/carnet/artista-<id>`)
 * cuando la ficha ya está reclamada (plan 031 T295/T296): manda al Carnet de
 * verdad, como «Ver carnet» en /artistas. Sin cuentas (modo local) no hay
 * uniones y se queda como siempre.
 */

/** `artista-alba-fitz` → `alba-fitz`; null si no es el Carnet de una ficha. */
export function contentProfileIdOf(carnetId: string | null): string | null {
  if (!carnetId?.startsWith(CONTENT_ARTIST_CARNET_PREFIX)) return null;
  const id = carnetId.slice(CONTENT_ARTIST_CARNET_PREFIX.length);
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id) ? id : null;
}

/** El id de cuenta del Carnet unido a esa ficha, o null (sin unir, o sin la columna). */
export async function claimedCarnetUserId(
  sb: BoiaSupabase,
  profileId: string,
): Promise<string | null> {
  const { data, error } = await sb
    .from('carnets')
    .select('user_id')
    .eq('artist_profile_id', profileId)
    .maybeSingle();
  if (error || !data) return null;
  return data.user_id;
}

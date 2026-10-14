import type { ArtistClaimRequest } from '@boia/db/rpc';
import type { MessageKey } from '../i18n';
import type { BoiaSupabase } from '../supabase/browser';

/**
 * «¿Eres uno de estos artistas?» (plan 031 T297, la vía 2): quien crea su
 * Carnet con el enlace general de artistas elige su ficha de /artistas y eso
 * deja una SOLICITUD que revisa el Admin; nunca une por sí sola (el enlace
 * general lo comparte cualquiera). Lo que habla con el servidor
 * (migración 20261015100400) y lo que se decide sin él.
 *
 * Sin cuentas (modo local, D-20) no hay solicitudes: el selector no sale.
 */

/** Una ficha que se puede pedir: su id y su nombre. */
export interface PickableProfile {
  id: string;
  name: string;
}

/** Sin tildes ni mayúsculas, para buscar por nombre. */
export function foldName(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * Las fichas sin reclamar que casan con lo buscado, de la A a la Z. Sin
 * búsqueda, todas.
 */
export function unclaimedProfiles(
  artists: readonly PickableProfile[],
  claimed: ReadonlySet<string>,
  query = '',
): PickableProfile[] {
  const q = foldName(query);
  return artists
    .filter((a) => !claimed.has(a.id) && (!q || foldName(a.name).includes(q)))
    .map((a) => ({ id: a.id, name: a.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

/** Los rechazos del servidor al pedir, en palabras para el artista. */
const REQUEST_REJECTION: Partial<Record<string, MessageKey>> = {
  profile_claimed: 'carnet.request.errorClaimed',
  profile_requested: 'carnet.request.errorRequested',
  request_pending: 'carnet.request.errorPending',
  already_joined: 'carnet.request.errorJoined',
};

export function requestErrorKey(reason: string | null): MessageKey {
  return (reason && REQUEST_REJECTION[reason]) || 'carnet.request.errorGeneric';
}

/** Las fichas ya unidas a un Carnet (columna pública). Sin la columna, ninguna. */
export async function claimedProfileIds(sb: BoiaSupabase): Promise<Set<string>> {
  const { data, error } = await sb
    .from('carnets')
    .select('artist_profile_id')
    .not('artist_profile_id', 'is', null)
    .limit(1000);
  if (error || !data) return new Set();
  return new Set(data.flatMap((r) => (r.artist_profile_id ? [r.artist_profile_id] : [])));
}

export type RequestOutcome =
  | { kind: 'sent'; request: ArtistClaimRequest }
  /** El servidor dijo que no: `reason` es su rechazo. */
  | { kind: 'rejected'; reason: string }
  | { kind: 'offline' };

/** Pide la ficha para el Carnet de la sesión (queda pendiente; no une). */
export async function requestProfile(
  sb: BoiaSupabase,
  profile: PickableProfile,
): Promise<RequestOutcome> {
  const { data, error } = await sb.rpc('request_artist_profile', {
    p_profile: profile.id,
    p_name: profile.name,
  });
  if (error) return error.code ? { kind: 'rejected', reason: error.message } : { kind: 'offline' };
  return { kind: 'sent', request: data as unknown as ArtistClaimRequest };
}

/**
 * La solicitud pendiente propia, null si no hay; `undefined` si no se pudo
 * saber (sin red, o una base sin la migración 20261015100400).
 */
export async function myRequest(sb: BoiaSupabase): Promise<ArtistClaimRequest | null | undefined> {
  const { data, error } = await sb.rpc('my_artist_claim_request');
  if (error) return undefined;
  return (data as unknown as ArtistClaimRequest | null) ?? null;
}

/** Retira la solicitud pendiente propia. */
export async function cancelRequest(sb: BoiaSupabase): Promise<boolean> {
  const { error } = await sb.rpc('cancel_artist_claim_request');
  return !error;
}

/**
 * ¿Sale «¿Eres uno de estos artistas?» tras crear el Carnet? Sólo si se creó
 * con el enlace general (había código) y el servidor lo dio por bueno (el
 * Carnet es de artista), y no venía del enlace personal para reclamar una
 * ficha (ése ya une solo, T296).
 */
export function showsArtistPicker(p: {
  artistCode: boolean;
  personalClaim: boolean;
  isArtist: boolean;
}): boolean {
  return p.artistCode && !p.personalClaim && p.isArtist;
}

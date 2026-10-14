import type { ArtistClaimInfo, ArtistClaimResult } from '@boia/db/rpc';
import type { BoiaSupabase } from '../supabase/browser';
import { clearClaim, pendingClaim } from './artist-claim';

/**
 * Lo que habla con el servidor del enlace para reclamar una ficha (plan 031
 * T296). Se carga a demanda: desde la página del enlace y desde la sesión,
 * sólo cuando hay un código pendiente.
 */

export type ClaimOutcome =
  | { kind: 'joined'; name: string; profileId: string }
  /** El servidor dijo que no (código que no vale, Carnet ya unido…): `reason` es su rechazo. */
  | { kind: 'rejected'; reason: string }
  /** No se pudo preguntar (red): el código sigue pendiente. */
  | { kind: 'offline' };

/** ¿Vale este código? ¿De qué ficha es? Sin red, null. */
export async function claimInfo(sb: BoiaSupabase, code: string): Promise<ArtistClaimInfo | null> {
  const { data, error } = await sb.rpc('artist_claim_info', { p_code: code });
  if (error) return error.code ? { valid: false } : null;
  return (data as unknown as ArtistClaimInfo | null) ?? { valid: false };
}

/** Une el Carnet de la sesión a la ficha del código y lo gasta. */
export async function redeemClaim(sb: BoiaSupabase, code: string): Promise<ClaimOutcome> {
  const { data, error } = await sb.rpc('claim_artist_profile', { p_code: code });
  if (error) {
    // Sin código de PostgreSQL, la llamada no llegó: se puede intentar otra vez.
    return error.code ? { kind: 'rejected', reason: error.message } : { kind: 'offline' };
  }
  const res = data as unknown as ArtistClaimResult;
  return { kind: 'joined', name: res.profile_name, profileId: res.artist_profile_id };
}

let inFlight: Promise<ClaimOutcome | null> | null = null;

/**
 * Lo pendiente de esta pestaña, con la sesión ya con Carnet: se reclama una
 * vez. Con respuesta del servidor (sí o no), el código se olvida; sin red,
 * se queda para la próxima vez que se lea la cuenta.
 */
export function redeemPendingClaim(sb: BoiaSupabase): Promise<ClaimOutcome | null> {
  inFlight ??= (async () => {
    const pending = pendingClaim();
    if (!pending) return null;
    const outcome = await redeemClaim(sb, pending.code);
    if (outcome.kind !== 'offline') clearClaim();
    return outcome;
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

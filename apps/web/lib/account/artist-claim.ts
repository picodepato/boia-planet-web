/**
 * El enlace personal para reclamar una ficha de artista (plan 031 T296, la
 * vía 1): `/artista/reclamar/<código>`. El Admin lo crea para una ficha sin
 * reclamar; el servidor sólo guarda el hash del código.
 *
 * La página del enlace pregunta si el código vale y de qué ficha es, y lo
 * recuerda en la pestaña (sessionStorage) con el nombre de la ficha. Al
 * crear el Carnet o al entrar con uno que ya existe, la sesión
 * (`session.ts`, `refreshAccount`) llama a `redeemPendingClaim`: el servidor
 * comprueba el código, une el Carnet a la ficha y lo gasta.
 *
 * Este archivo es pequeño a propósito: `session.ts` sólo trae
 * `pendingClaimCode`; lo demás viaja en el trozo de la página del enlace o se
 * carga a demanda.
 */

export const ARTIST_CLAIM_PATH = '/artista/reclamar';
export const ARTIST_CLAIM_KEY = 'boia:reclamar-artista';
/** Lo que se acepta como código: letras, cifras y guiones, hasta 64. */
const CODE = /^[A-Za-z0-9-]{1,64}$/;

/** El enlace para reclamar con ese código, en este sitio. */
export function claimLinkHref(code: string, origin = ''): string {
  return `${origin}${ARTIST_CLAIM_PATH}/${encodeURIComponent(code)}`;
}

/** El código limpio, o null si no parece un código. */
export function cleanClaimCode(raw: string | null | undefined): string | null {
  let code = (raw ?? '').trim();
  try {
    code = decodeURIComponent(code);
  } catch {
    // ya venía decodificado
  }
  return CODE.test(code) ? code : null;
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Lo pendiente de reclamar en esta pestaña: el código y el nombre de la ficha. */
export interface PendingClaim {
  code: string;
  name: string;
}

/** Recuerda el código (y el nombre de la ficha) hasta que haya Carnet. */
export function rememberClaim(code: string, name: string): boolean {
  const clean = cleanClaimCode(code);
  if (!clean) return false;
  try {
    storage()?.setItem(ARTIST_CLAIM_KEY, JSON.stringify({ code: clean, name }));
    return true;
  } catch {
    return false;
  }
}

/** Lo pendiente de reclamar, o null. */
export function pendingClaim(): PendingClaim | null {
  try {
    const raw = storage()?.getItem(ARTIST_CLAIM_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<PendingClaim>;
    const code = cleanClaimCode(v.code);
    return code ? { code, name: typeof v.name === 'string' ? v.name : '' } : null;
  } catch {
    return null;
  }
}

/** Sólo el código pendiente (lo que mira la sesión), o null. */
export function pendingClaimCode(): string | null {
  return pendingClaim()?.code ?? null;
}

/** Ya se usó (o no valía): se olvida. */
export function clearClaim(): void {
  try {
    storage()?.removeItem(ARTIST_CLAIM_KEY);
  } catch {
    // nada que olvidar
  }
}

/**
 * El texto listo para mandar por WhatsApp con el enlace (muestra). Lo arma
 * quien llama con su plantilla de i18n; aquí, el enlace de wa.me con ese texto.
 */
export function whatsappHref(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

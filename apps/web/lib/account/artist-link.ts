/**
 * El enlace de artistas (plan 016 T186, Hernán 2026-10-06): un único enlace
 * `/artista/<código>` que el Admin rota. Quien crea su Carnet después de
 * abrirlo es artista: con cuentas lo comprueba el servidor (`save_profile`
 * con `p_artist_code`, el código guardado con hash); en modo local (D-20)
 * cualquier código marca el Carnet de este navegador (sólo demo).
 *
 * El código se recuerda en la pestaña (sessionStorage) hasta que se crea el
 * Carnet; sin almacenamiento, se pierde y el alta es de socio normal.
 */

export const ARTIST_LINK_PATH = '/artista';
const KEY = 'boia:enlace-artista';
/** Lo que se acepta como código: letras, cifras y guiones, hasta 64. */
const CODE = /^[A-Za-z0-9-]{1,64}$/;

/** El enlace de artistas con ese código, en este sitio. */
export function artistLinkHref(code: string, origin = ''): string {
  return `${origin}${ARTIST_LINK_PATH}/${encodeURIComponent(code)}`;
}

/** El código limpio, o null si no parece un código. */
export function cleanArtistCode(raw: string | null | undefined): string | null {
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

/** Recuerda el código del enlace hasta que se cree el Carnet. */
export function rememberArtistCode(raw: string | null | undefined): boolean {
  const code = cleanArtistCode(raw);
  if (!code) return false;
  try {
    storage()?.setItem(KEY, code);
    return true;
  } catch {
    return false;
  }
}

/** El código pendiente de este alta, o null. */
export function pendingArtistCode(): string | null {
  try {
    return cleanArtistCode(storage()?.getItem(KEY));
  } catch {
    return null;
  }
}

/** Ya se usó (o ya hay Carnet): se olvida. */
export function clearArtistCode(): void {
  try {
    storage()?.removeItem(KEY);
  } catch {
    // nada que olvidar
  }
}

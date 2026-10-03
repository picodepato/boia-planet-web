/**
 * El QR de una fiesta (plan 008, decisión 9): una URL fija
 * `/sello?e=<fiesta>&c=<código>`. Vale cualquier dominio (la de prueba, la
 * definitiva, localhost): lo que cuenta es la ruta y los dos parámetros.
 */

export const SELLO_PATH = '/sello';

export interface SelloCode {
  /** Slug de la fiesta. */
  event: string;
  /** Código secreto del QR (lo comprueba `claim_stamp`). */
  code: string;
}

const EVENT_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CODE_RE = /^[A-Za-z0-9]{6,32}$/;

/** Lee `e` y `c` de unos parámetros; null si no tienen la forma de un sello. */
export function selloFromParams(params: URLSearchParams): SelloCode | null {
  const event = params.get('e')?.trim() ?? '';
  const code = params.get('c')?.trim() ?? '';
  if (!EVENT_RE.test(event) || event.length > 80 || !CODE_RE.test(code)) return null;
  return { event, code };
}

/** ¿Es `text` (lo que dice un QR) la URL de un sello de BOIA? */
export function parseSelloUrl(text: string): SelloCode | null {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.pathname.replace(/\/+$/, '') !== SELLO_PATH) return null;
  return selloFromParams(url.searchParams);
}

/** La URL del QR de una fiesta. */
export function selloUrl(origin: string, sello: SelloCode): string {
  const u = new URL(SELLO_PATH, origin);
  u.searchParams.set('e', sello.event);
  u.searchParams.set('c', sello.code);
  return u.toString();
}

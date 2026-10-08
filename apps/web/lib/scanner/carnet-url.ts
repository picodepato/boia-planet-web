/**
 * Los QR de la puerta (plan 019 T218, decisión 11):
 *
 * - El QR de cada Carnet lleva la URL de su Carnet público,
 *   `/carnet/<id>` (`carnetPath`): con la cámara del móvil abre el Carnet, y
 *   el lector de la puerta saca de ahí de quién es.
 * - El QR de alta abre «Crear carnet» directamente: `/carnet?crear=1`.
 *
 * Vale cualquier dominio (la de prueba, la definitiva, localhost): lo que
 * cuenta es la ruta.
 */

export const CARNET_PATH = '/carnet';
/** `?crear=1` en /carnet: empieza el alta del Carnet (el QR de alta). */
export const CREATE_PARAM = 'crear';

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * El id del Carnet que lleva un QR (o lo que se pegó a mano en la puerta): la
 * URL de un Carnet público o, a mano, el id tal cual (un UUID). null si no es
 * un Carnet de BOIA (otro QR, el de un sello, el de alta…).
 */
export function parseCarnetQr(text: string): string | null {
  const raw = text.trim();
  if (UUID_RE.test(raw)) return raw.toLowerCase();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const m = /^\/carnet\/([^/]+)\/?$/.exec(url.pathname);
  if (!m) return null;
  let id: string;
  try {
    id = decodeURIComponent(m[1]!);
  } catch {
    return null;
  }
  return ID_RE.test(id) ? id : null;
}

/** La URL del QR de alta: «Crear carnet» directamente. */
export function signupUrl(origin: string): string {
  const u = new URL(CARNET_PATH, origin);
  u.searchParams.set(CREATE_PARAM, '1');
  return u.toString();
}

/** ¿Pide esta búsqueda (`location.search`) empezar el alta? */
export function wantsCreate(search: string): boolean {
  return new URLSearchParams(search).get(CREATE_PARAM) === '1';
}

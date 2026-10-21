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

/**
 * `?volver=<ruta>` en /carnet (plan 034 T311): adónde se vuelve al terminar el
 * alta (la lista o la compra de la que se vino).
 */
export const RETURN_PARAM = 'volver';
/** `?abrir=<id>` al volver: abre otra vez la lista (o la compra) de esa fiesta. */
export const OPEN_PARAM = 'abrir';

/**
 * La URL del QR de alta: «Crear carnet» directamente. Con `back` (una ruta
 * de esta web, de `returnHere`), al terminar el alta se vuelve allí.
 */
export function signupUrl(origin: string, back?: string): string {
  const u = new URL(CARNET_PATH, origin);
  u.searchParams.set(CREATE_PARAM, '1');
  if (back) u.searchParams.set(RETURN_PARAM, back);
  return u.toString();
}

/**
 * La ruta de vuelta a esta página con la lista (o la compra) de `eventId`
 * abierta: la ruta y la búsqueda de ahora, con `?abrir=<id>`.
 */
export function returnHere(loc: { pathname: string; search: string }, eventId: string): string {
  const params = new URLSearchParams(loc.search);
  params.set(OPEN_PARAM, eventId);
  return `${loc.pathname}?${params.toString()}`;
}

/**
 * La ruta de `?volver=` si es de esta web («/…», nunca «//otro» ni una URL
 * entera): null si no hay o no vale.
 */
export function returnPath(search: string): string | null {
  const back = new URLSearchParams(search).get(RETURN_PARAM);
  if (!back?.startsWith('/')) return null;
  // Se resuelve contra un origen inventado: «//otro» o «/\otro» cambian de origen.
  const base = 'http://boia.invalid';
  let u: URL;
  try {
    u = new URL(back, base);
  } catch {
    return null;
  }
  return u.origin === base ? `${u.pathname}${u.search}${u.hash}` : null;
}

/** ¿Pide esta búsqueda (`location.search`) empezar el alta? */
export function wantsCreate(search: string): boolean {
  return new URLSearchParams(search).get(CREATE_PARAM) === '1';
}

/**
 * El enlace de la puerta (plan 034 T307): un enlace secreto por fiesta, sin
 * caducidad y revocable, que abre el lector de la puerta sin cuenta
 * (`/puerta/<código>`). Con cuentas, el código sólo existe en el enlace (la
 * base guarda su hash: 20261021100100_door_links.sql). Sin Supabase (D-20),
 * los enlaces viven en este navegador (`localDoorLinks`).
 */

export const DOOR_LINK_PATH = '/puerta';
/** Donde guarda la versión de prueba los enlaces de este navegador. */
export const DOOR_LINKS_KEY = 'boia.puerta.enlaces.v1';

const TOKEN_RE = /^[0-9a-f]{64}$/;

/** El código tal cual sale de la URL, o null si no tiene forma de código. */
export function cleanDoorToken(raw: string): string | null {
  let text = raw;
  try {
    text = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const token = text.trim().toLowerCase();
  return TOKEN_RE.test(token) ? token : null;
}

/** La URL que se comparte. */
export function doorLinkUrl(origin: string, token: string): string {
  return new URL(`${DOOR_LINK_PATH}/${token}`, origin).toString();
}

/** Un código nuevo: 32 bytes al azar, en hexadecimal. */
export function newDoorToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface LocalDoorLink {
  token: string;
  /** El id del evento (en local, la fiesta se elige por id). */
  eventId: string;
  createdAt: string;
}

type KeyValue = Pick<Storage, 'getItem' | 'setItem'>;

/** El localStorage de esta pestaña, o null (privado, bloqueado, servidor). */
export function browserStorage(): KeyValue | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Los enlaces de la versión de prueba, en este navegador: uno vivo por
 * fiesta; crear otro sustituye al anterior; revocar lo borra.
 */
export function localDoorLinks(storage: KeyValue | null) {
  const read = (): LocalDoorLink[] => {
    try {
      const raw = storage?.getItem(DOOR_LINKS_KEY);
      const list: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(list)
        ? list.filter(
            (l): l is LocalDoorLink =>
              !!l &&
              typeof l === 'object' &&
              typeof (l as LocalDoorLink).token === 'string' &&
              typeof (l as LocalDoorLink).eventId === 'string' &&
              typeof (l as LocalDoorLink).createdAt === 'string',
          )
        : [];
    } catch {
      return [];
    }
  };
  const write = (list: LocalDoorLink[]) => {
    try {
      storage?.setItem(DOOR_LINKS_KEY, JSON.stringify(list));
    } catch {
      // sin almacenamiento: el enlace no dura más que esta página
    }
  };
  return {
    list: read,
    find: (token: string): LocalDoorLink | null =>
      read().find((l) => l.token === cleanDoorToken(token)) ?? null,
    create: (eventId: string, now = new Date()): LocalDoorLink => {
      const link = { token: newDoorToken(), eventId, createdAt: now.toISOString() };
      write([...read().filter((l) => l.eventId !== eventId), link]);
      return link;
    },
    revoke: (eventId: string): boolean => {
      const list = read();
      const kept = list.filter((l) => l.eventId !== eventId);
      write(kept);
      return kept.length !== list.length;
    },
  };
}

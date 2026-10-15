/**
 * De quién es lo del invitado de este navegador (plan 032 T300).
 *
 * El problema: si una sesión se acaba sin «Cerrar sesión» (caduca, se borra
 * desde otro sitio), el dispositivo no se pone de cero (`reset-device.ts`
 * sólo corre al cerrar sesión a mano) y lo del invitado sigue ahí. Antes, la
 * siguiente cuenta que entraba en el dispositivo se lo quedaba: el progreso,
 * el Carnet y el apodo de otra persona pasaban a una cuenta ajena.
 *
 * La regla: lo del invitado de un dispositivo pasa sólo a la primera cuenta
 * que entra en él (desde la última vez que se puso de cero). Esa cuenta queda
 * apuntada aquí (`GUEST_OWNER_KEY`) aunque el invitado aún no tuviera nada:
 * lo que se juegue después en el dispositivo es, casi seguro, de esa misma
 * persona con la sesión caducada. Al volver a entrar la misma cuenta, se
 * fusiona como siempre (las reglas de `merge_guest`: ids estables, fusionar
 * dos veces no duplica). Si entra otra cuenta, no se fusiona nada ni se
 * propone el apodo del Carnet del invitado: empieza con lo suyo.
 *
 * La marca empieza por `boia.` y no es una preferencia: «Cerrar sesión» y
 * borrar la cuenta la quitan con todo lo demás, y la siguiente cuenta vuelve
 * a ser la primera. Las copias de cada cuenta (`boia.cuenta.<id>`) ya iban
 * atadas a su cuenta (sólo se leen con su sesión).
 */
import type { StorageLike } from '@boia/store';

/** La cuenta que se quedó con lo del invitado de este navegador. */
export const GUEST_OWNER_KEY = 'boia.invitado.cuenta';

function safeStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** La cuenta dueña de lo del invitado; null si ninguna ha entrado aún. */
export function guestOwner(storage: StorageLike | null = safeStorage()): string | null {
  try {
    const v = storage?.getItem(GUEST_OWNER_KEY);
    return v && v.trim() ? v : null;
  } catch {
    return null;
  }
}

/** Puede `accountId` quedarse con lo del invitado: nadie lo tiene, o es suyo. */
export function mayTakeGuest(
  accountId: string,
  storage: StorageLike | null = safeStorage(),
): boolean {
  const owner = guestOwner(storage);
  return owner === null || owner === accountId;
}

/**
 * Apunta a `accountId` como dueña si aún no hay ninguna. Devuelve si lo del
 * invitado es suyo (la primera en entrar, o ya lo era). Sin almacenamiento
 * (modo privado) no se puede recordar: se trata como la primera vez.
 */
export function claimGuest(
  accountId: string,
  storage: StorageLike | null = safeStorage(),
): boolean {
  const owner = guestOwner(storage);
  if (owner !== null) return owner === accountId;
  try {
    storage?.setItem(GUEST_OWNER_KEY, accountId);
  } catch {
    // Almacenamiento lleno o bloqueado: no se recuerda.
  }
  return true;
}

/**
 * Lo del invitado que pasa a la cuenta que acaba de entrar: `load()` sólo si
 * es suyo (y la apunta); si no, nada y `load` ni se llama.
 */
export async function guestPayloadFor<T>(
  accountId: string,
  load: () => Promise<T>,
  empty: T,
  storage: StorageLike | null = safeStorage(),
): Promise<T> {
  return claimGuest(accountId, storage) ? load() : empty;
}

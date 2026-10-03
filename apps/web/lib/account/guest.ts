/**
 * El invitado de este navegador visto desde la cuenta: lo que se fusiona al
 * entrar (decisión 4) y el «empezar de cero» al salir o borrar la cuenta.
 */
import type { MergePayload } from '@boia/db/rpc';
import { STORE_KEY, localDocAccess, snapshotOf } from '@boia/store';
import { guestRepository } from '../repo';
import type { AccountPrefill } from './gate';
import { type GuestState, mergePayloadFrom, recordsFromStoreDoc } from './merge';

function readStoreDoc(): string | null {
  try {
    return window.localStorage.getItem(STORE_KEY);
  } catch {
    return null;
  }
}

/**
 * Lo del invitado, leído de su repositorio local (no del de la partida, que
 * con sesión ya es el de la cuenta, T90).
 */
export async function guestState(): Promise<GuestState | null> {
  const repo = guestRepository();
  const me = await repo.identity.current();
  if (!me) return null;
  const [ledger, equipped, discounts, purchases] = await Promise.all([
    repo.progress.ledger(),
    repo.progress.equipped(),
    repo.progress.discounts(),
    repo.purchases.list(),
  ]);
  return {
    userId: me.id,
    ledger,
    equipped,
    discounts,
    purchases,
    records: recordsFromStoreDoc(readStoreDoc(), me.id),
    snapshot: guestSnapshot(me.id),
  };
}

/**
 * El resto del documento del invitado (descubrimientos, misiones, ajustes…)
 * con la forma de `save_snapshot` (T90): la cuenta se lo queda si aún no
 * tenía copia.
 */
function guestSnapshot(userId: string): Record<string, unknown> | null {
  const access = localDocAccess(guestRepository());
  return access ? { ...access.view((d) => snapshotOf(d, userId)) } : null;
}

/** La entrada de `merge_guest` del invitado de este navegador ({} si no hay nada). */
export async function guestMergePayload(): Promise<MergePayload> {
  const guest = await guestState();
  return guest ? mergePayloadFrom(guest) : {};
}

/** Apodo y avatar del Carnet de este navegador, para el paso de la cuenta nueva. */
export async function guestPrefill(): Promise<AccountPrefill> {
  const carnet = await guestRepository().carnet.mine();
  return carnet
    ? { nickname: carnet.nickname, avatarKey: carnet.avatarKey, avatarImage: carnet.avatarImage }
    : {};
}

/**
 * Este navegador vuelve a ser un invitado nuevo (al cerrar sesión o borrar
 * la cuenta): lo de antes ya está en la cuenta, o se ha borrado.
 */
export async function resetLocalGuest(): Promise<void> {
  await guestRepository().identity.reset();
}

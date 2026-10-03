/**
 * El invitado de este navegador visto desde la cuenta: lo que se fusiona al
 * entrar (decisión 4) y el «empezar de cero» al salir o borrar la cuenta.
 */
import type { MergePayload } from '@boia/db/rpc';
import { STORE_KEY } from '@boia/store';
import { gameRepository } from '../repo';
import type { AccountPrefill } from './gate';
import { type GuestState, mergePayloadFrom, recordsFromStoreDoc } from './merge';

function readStoreDoc(): string | null {
  try {
    return window.localStorage.getItem(STORE_KEY);
  } catch {
    return null;
  }
}

/** Lo del invitado que tiene valor, leído del repositorio local. */
export async function guestState(): Promise<GuestState | null> {
  const repo = gameRepository();
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
  };
}

/** La entrada de `merge_guest` del invitado de este navegador ({} si no hay nada). */
export async function guestMergePayload(): Promise<MergePayload> {
  const guest = await guestState();
  return guest ? mergePayloadFrom(guest) : {};
}

/** Apodo y avatar del Carnet de este navegador, para el paso de la cuenta nueva. */
export async function guestPrefill(): Promise<AccountPrefill> {
  const carnet = await gameRepository().carnet.mine();
  return carnet
    ? { nickname: carnet.nickname, avatarKey: carnet.avatarKey, avatarImage: carnet.avatarImage }
    : {};
}

/**
 * Este navegador vuelve a ser un invitado nuevo (al cerrar sesión o borrar
 * la cuenta): lo de antes ya está en la cuenta, o se ha borrado.
 */
export async function resetLocalGuest(): Promise<void> {
  await gameRepository().identity.reset();
}

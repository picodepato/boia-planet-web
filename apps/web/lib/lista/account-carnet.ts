import type { AccountState } from '../account/session';

/**
 * El Carnet que cuenta para la lista (T312). Con cuentas, sólo el de la
 * cuenta que ve el servidor (`public.carnets` de la sesión, `member`): un
 * Carnet de este navegador (el invitado, de antes de las cuentas) no apunta
 * a nadie, y la RPC lo rechazaría (`not_member` / `carnet_required`). Sin
 * Supabase (la demo, D-20), el de este navegador.
 *
 * Sin React ni red: lo prueban las unitarias.
 */
export function listNickname(
  accounts: boolean,
  account: Pick<AccountState, 'status' | 'profile'>,
  local: { nickname: string } | null,
): string | null {
  if (!accounts) return local?.nickname ?? null;
  return account.status === 'member' ? (account.profile?.nickname ?? null) : null;
}

/**
 * Qué enseña el diálogo cuando la base dice que falta la cuenta o su Carnet:
 * el aviso con «Sacarme el Carnet» o, si ya se vino de sacárselo para esta
 * fiesta (`returned`), el error que lo explica, sin volver a mandar al alta
 * (así no hay vuelta en redondo).
 */
export function missingCarnetStep(returned: boolean): 'notice' | 'missing' {
  return returned ? 'missing' : 'notice';
}

/** Clave (sessionStorage) de la fiesta de la que se fue a sacarse el Carnet. */
export const CARNET_TRIP_KEY = 'boia.lista.alta';

type TripStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function session(): TripStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Antes de ir al alta del Carnet desde la lista de `eventId`. */
export function markCarnetTrip(eventId: string, store: TripStorage | null = session()): void {
  try {
    store?.setItem(CARNET_TRIP_KEY, eventId);
  } catch {
    // sin almacenamiento: sólo se pierde el aviso de vuelta
  }
}

/** ¿Se vuelve del alta para `eventId`? Una sola vez: se borra al leerlo. */
export function takeCarnetTrip(eventId: string, store: TripStorage | null = session()): boolean {
  try {
    if (store?.getItem(CARNET_TRIP_KEY) !== eventId) return false;
    store.removeItem(CARNET_TRIP_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Lo que se espera a saber si hay sesión antes de enseñar la lista. */
const ACCOUNT_WAIT_MS = 8000;

/** El apodo del Carnet que cuenta para la lista, en este navegador. */
export async function currentListNickname(accounts: boolean): Promise<string | null> {
  if (!accounts) {
    const { gameRepository } = await import('../repo');
    return listNickname(
      false,
      { status: 'local', profile: null },
      await gameRepository().carnet.mine(),
    );
  }
  const { accountReady, accountSnapshot } = await import('../account/session');
  await Promise.race([accountReady(), new Promise((r) => setTimeout(r, ACCOUNT_WAIT_MS))]);
  return listNickname(true, accountSnapshot(), null);
}

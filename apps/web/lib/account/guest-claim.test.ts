import type { MergePayload } from '@boia/db/rpc';
import { describe, expect, it, vi } from 'vitest';
import {
  GUEST_OWNER_KEY,
  claimGuest,
  guestOwner,
  guestPayloadFor,
  mayTakeGuest,
} from './guest-claim';
import { type DeviceStorage, isDevicePreferenceKey, wipeDeviceStorage } from './reset-device';

/** Un localStorage en memoria que se puede recorrer. */
function memoryStorage(): DeviceStorage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
  };
}

const A = 'cuenta-a';
const B = 'cuenta-b';
const GUEST: MergePayload = { rewards: [{ action: 'achievement', ref: 'primera-boia' }] };

/**
 * Lo que hace la hoja de acceso al entrar (`afterVerify`): lo del invitado
 * sólo si es de esta cuenta; `load` cuenta las veces que se leyó.
 */
async function signIn(storage: DeviceStorage, account: string) {
  const load = vi.fn(async (): Promise<MergePayload> => GUEST);
  const payload = await guestPayloadFor<MergePayload>(account, load, {}, storage);
  return { payload, loaded: load.mock.calls.length };
}

describe('lo del invitado, de una sola cuenta (T300)', () => {
  it('la primera cuenta que entra se lo queda y la apunta', async () => {
    const storage = memoryStorage();
    expect(guestOwner(storage)).toBeNull();
    const first = await signIn(storage, A);
    expect(first).toEqual({ payload: GUEST, loaded: 1 });
    expect(guestOwner(storage)).toBe(A);
  });

  it('la sesión caduca (sin «Cerrar sesión») y entra otra cuenta: no se fusiona nada', async () => {
    const storage = memoryStorage();
    await signIn(storage, A);
    // Caduca: no corre resetDevice; lo del invitado y la marca siguen ahí.
    const other = await signIn(storage, B);
    expect(other).toEqual({ payload: {}, loaded: 0 });
    expect(mayTakeGuest(B, storage)).toBe(false);
    expect(guestOwner(storage)).toBe(A);
  });

  it('la misma cuenta vuelve a entrar tras caducar: se fusiona como siempre', async () => {
    const storage = memoryStorage();
    await signIn(storage, A);
    expect(await signIn(storage, A)).toEqual({ payload: GUEST, loaded: 1 });
  });

  it('se apunta aunque el invitado no tuviera nada: lo jugado después tampoco va a otra', async () => {
    const storage = memoryStorage();
    expect(await guestPayloadFor(A, async () => ({}), {}, storage)).toEqual({});
    expect(claimGuest(B, storage)).toBe(false);
  });

  it('«Cerrar sesión» quita la marca: la siguiente cuenta vuelve a ser la primera', async () => {
    const storage = memoryStorage();
    await signIn(storage, A);
    expect(isDevicePreferenceKey(GUEST_OWNER_KEY)).toBe(false);
    expect(wipeDeviceStorage(storage)).toContain(GUEST_OWNER_KEY);
    expect(await signIn(storage, B)).toEqual({ payload: GUEST, loaded: 1 });
    expect(guestOwner(storage)).toBe(B);
  });

  it('sin almacenamiento (modo privado) se trata como la primera vez', async () => {
    expect(claimGuest(A, null)).toBe(true);
    expect(mayTakeGuest(B, null)).toBe(true);
  });
});

import {
  createLocalGuestList,
  createLocalRepository,
  HALLOWEEN_EVENT_ID,
  HALLOWEEN_LIST_CLOSES_AT,
  MemoryStorage,
} from '@boia/store';
import { describe, expect, it } from 'vitest';
import { supabaseGuestList } from '../guestlist';
import { esLista } from '../i18n/es-lista';
import { signupStart } from '../scanner/carnet-url';
import type { BoiaSupabase } from '../supabase/browser';
import { listNickname, markCarnetTrip, missingCarnetStep, takeCarnetTrip } from './account-carnet';
import { stateFor } from './guest-list-dialog';

/**
 * T312: con cuentas, Álvaro tenía un Carnet sólo en este navegador (el del
 * invitado, de antes de las cuentas). La lista lo usaba para el apodo, la
 * base rechazaba (`carnet_required` / `not_member`), el aviso mandaba a
 * /carnet y /carnet, viendo ese Carnet, volvía a la lista: vuelta sin fin.
 */

const LOCAL = { nickname: 'juan magan' };
const status = {
  event: 'halloween',
  enabled: true,
  cap: 100,
  closesAt: HALLOWEEN_LIST_CLOSES_AT,
  open: true,
  pastClosing: false,
  closed: false,
  full: false,
  mine: null,
};

function rejectingSb(error: { code?: string; message: string }): BoiaSupabase {
  return {
    rpc: async () => ({ data: null, error }),
  } as unknown as BoiaSupabase;
}

class Store {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

describe('T312: el Carnet que cuenta para la lista', () => {
  it('con cuentas, el Carnet de este navegador no cuenta: sólo el de la cuenta (member)', () => {
    expect(listNickname(true, { status: 'guest', profile: null }, LOCAL)).toBeNull();
    expect(listNickname(true, { status: 'incomplete', profile: null }, LOCAL)).toBeNull();
    expect(listNickname(true, { status: 'loading', profile: null }, LOCAL)).toBeNull();
    expect(
      listNickname(
        true,
        {
          status: 'member',
          profile: {
            nickname: 'Pepa',
            memberNumber: 1,
            memberSince: '2026-10-01',
            avatarKey: null,
            isArtist: false,
          },
        },
        LOCAL,
      ),
    ).toBe('Pepa');
    // La demo (sin Supabase): el de este navegador, como siempre.
    expect(listNickname(false, { status: 'local', profile: null }, LOCAL)).toBe('juan magan');
    expect(listNickname(false, { status: 'local', profile: null }, null)).toBeNull();
  });

  it('sin Carnet de cuenta, el diálogo enseña el aviso (no el formulario con el apodo local)', () => {
    const nickname = listNickname(true, { status: 'guest', profile: null }, LOCAL);
    expect(stateFor(status, nickname)).toEqual({ kind: 'carnet', step: 'notice' });
  });

  it('la base rechaza (carnet_required o sin sesión): aviso la primera vez, error al volver', async () => {
    for (const error of [
      { message: 'carnet_required' },
      { message: 'not_member' },
      { code: '42501', message: 'permission denied for function guest_list_join' },
    ]) {
      const r = await supabaseGuestList(rejectingSb(error)).join('halloween', 'juan magan');
      expect(r.kind).toBe('rejected');
      expect(missingCarnetStep(false)).toBe('notice');
      expect(missingCarnetStep(true)).toBe('missing');
    }
    expect(stateFor(status, null, false, true)).toEqual({ kind: 'carnet', step: 'missing' });
    expect(esLista['lista.carnet.missing']).toMatch(/Carnet/);
  });

  it('/carnet?crear=1 sólo vuelve con el Carnet de la cuenta; si no, empieza el alta', () => {
    // El bug: invitado (o sesión sin Carnet) con Carnet local → antes volvía.
    expect(signupStart(true, 'guest', true)).toBe('signup');
    expect(signupStart(true, 'incomplete', true)).toBe('signup');
    expect(signupStart(true, 'loading', true)).toBe('wait');
    expect(signupStart(true, 'member', false)).toBe('back');
    // La demo, como antes.
    expect(signupStart(false, 'local', true)).toBe('back');
    expect(signupStart(false, 'local', false)).toBe('signup');
  });

  it('el viaje al alta se marca por fiesta y se lee una sola vez', () => {
    const s = new Store();
    expect(takeCarnetTrip(HALLOWEEN_EVENT_ID, s)).toBe(false);
    markCarnetTrip(HALLOWEEN_EVENT_ID, s);
    expect(takeCarnetTrip('otra', s)).toBe(false);
    expect(takeCarnetTrip(HALLOWEEN_EVENT_ID, s)).toBe(true);
    expect(takeCarnetTrip(HALLOWEEN_EVENT_ID, s)).toBe(false);
    expect(takeCarnetTrip(HALLOWEEN_EVENT_ID, null)).toBe(false);
  });

  it('la vuelta entera ya no da vueltas: aviso → alta → de vuelta sin Carnet, error', () => {
    const s = new Store();
    // 1. Abre la lista: Carnet local, sin cuenta → aviso, no formulario.
    const first = stateFor(status, listNickname(true, { status: 'guest', profile: null }, LOCAL));
    expect(first).toEqual({ kind: 'carnet', step: 'notice' });
    // 2. «Sacarme el Carnet»: marca el viaje; /carnet no rebota (empieza el alta).
    markCarnetTrip(HALLOWEEN_EVENT_ID, s);
    expect(signupStart(true, 'guest', true)).toBe('signup');
    // 3. Si de algún modo vuelve sin Carnet de cuenta: el error, no el aviso otra vez.
    const returned = takeCarnetTrip(HALLOWEEN_EVENT_ID, s);
    expect(stateFor(status, null, false, returned)).toEqual({ kind: 'carnet', step: 'missing' });
    // 4. Y otra vez que abra la lista, otra vez el aviso (lo decide él, no un bucle).
    expect(stateFor(status, null, false, takeCarnetTrip(HALLOWEEN_EVENT_ID, s))).toEqual({
      kind: 'carnet',
      step: 'notice',
    });
  });

  it('la demo (sin Supabase) sigue igual: con Carnet local se apunta', async () => {
    const repo = createLocalRepository({ storage: null, watch: false });
    await repo.carnet.create({ nickname: 'Grumete Demo' });
    const carnet = await repo.carnet.mine();
    const nickname = listNickname(false, { status: 'local', profile: null }, carnet);
    expect(nickname).toBe('Grumete Demo');
    const gl = createLocalGuestList({
      repo,
      storage: new MemoryStorage(),
      now: () => new Date('2026-10-21T12:00:00+02:00'),
    });
    const settings = { enabled: true, cap: 100, closesAt: HALLOWEEN_LIST_CLOSES_AT, open: true };
    await gl.admin.updateSettings(HALLOWEEN_EVENT_ID, settings);
    expect(stateFor(await gl.status(HALLOWEEN_EVENT_ID), nickname).kind).toBe('join');
    expect((await gl.join(HALLOWEEN_EVENT_ID, nickname!)).kind).toBe('created');
  });
});

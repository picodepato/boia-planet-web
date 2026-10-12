/**
 * Crear el Carnet en los dos modos (plan 029 T276):
 *
 * - sin las variables de Supabase (producción hoy) se crea en el navegador
 *   sin pedir nada: la puerta deja pasar al momento y no abre la hoja;
 * - con ellas, `requireAccount('carnet')` espera mientras no haya cuenta
 *   verificada con su Carnet: un código mal escrito no la abre, uno bueno
 *   deja la cuenta «a medias» (sin Carnet) y sólo al crear el Carnet y cerrar
 *   la hoja sigue. Después, un miembro pasa al momento.
 *
 * El cliente de Supabase es uno de mentira (sólo lo que usa la sesión).
 */
import { CARNET_QUESTIONS } from '@boia/contracts';
import { MemoryStorage, createLocalRepository } from '@boia/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  gateSnapshot,
  registerGateHost,
  requireAccount,
  resetGateForTests,
  settleGate,
  subscribeGate,
} from '../../account/gate';
import {
  accountSnapshot,
  createProfile,
  resetAccountForTests,
  sendCode,
  verifyCode,
} from '../../account/session';
import { draftFrom, initialDraft, saveCarnetContinuation } from './carnet-editor';

const fake = vi.hoisted(() => {
  const UID = '0f0f0f0f-1111-2222-3333-444444444444';
  const EMAIL = 'grumete@example.test';
  const GOOD = '123456';
  let session: { user: { id: string; email: string } } | null = null;
  let carnet: Record<string, unknown> | null = null;
  const sent: string[] = [];
  const result = (data: unknown) => Promise.resolve({ data, error: null });
  const query = (table: string) => {
    const q = {
      select: () => q,
      eq: () => q,
      order: () => (table === 'consents' ? Object.assign(result([]), q) : q),
      maybeSingle: () => result(carnet),
    };
    return q;
  };
  const client = {
    auth: {
      onAuthStateChange: (cb: (e: string, s: unknown) => void) => {
        cb('INITIAL_SESSION', session);
        return { data: { subscription: { unsubscribe: () => undefined } } };
      },
      getSession: () => result({ session }),
      signInWithOtp: ({ email }: { email: string }) => {
        sent.push(email);
        return Promise.resolve({ data: {}, error: null });
      },
      verifyOtp: ({ email, token }: { email: string; token: string }) => {
        if (email !== EMAIL || token !== GOOD || !sent.includes(email)) {
          return Promise.resolve({
            data: { session: null },
            error: { status: 403, code: 'otp_expired', message: 'Token has expired or is invalid' },
          });
        }
        session = { user: { id: UID, email } };
        return result({ session });
      },
    },
    from: (table: string) => query(table),
    rpc: (name: string, args: Record<string, unknown>) => {
      if (name !== 'save_profile' || !session) {
        return Promise.resolve({ data: null, error: { message: 'unexpected' } });
      }
      carnet = {
        nickname: args.p_nickname,
        member_number: 7,
        member_since: '2026-10-13T00:00:00.000Z',
        avatar_key: args.p_avatar_key ?? null,
        is_artist: false,
      };
      return result({ ok: true });
    },
  };
  return {
    UID,
    EMAIL,
    GOOD,
    client,
    sent,
    reset() {
      session = null;
      carnet = null;
      sent.length = 0;
    },
  };
});

vi.mock('../../supabase/browser', () => ({ browserSupabase: () => fake.client }));

const URL_OK = 'https://abcdefghijklmnopqrst.supabase.co';
/** Deja correr las promesas y los setTimeout(0) de la sesión. */
const settle = () => new Promise((r) => setTimeout(r, 10));

afterEach(() => {
  vi.unstubAllEnvs();
  resetGateForTests();
  resetAccountForTests();
  fake.reset();
});

describe('crear el Carnet sin variables de Supabase', () => {
  it('se crea en el navegador y la hoja del email no se abre', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    resetAccountForTests();
    const opened = vi.fn();
    const off = subscribeGate(opened);
    const repo = createLocalRepository({ storage: new MemoryStorage(), watch: false });

    // Lo mismo que hace el formulario del Carnet al guardar.
    expect(await requireAccount('carnet', { prefill: { nickname: 'Grumete' } })).toBe(true);
    const view = await saveCarnetContinuation(
      repo,
      null,
      { ...draftFrom(null), nickname: 'Grumete' },
      CARNET_QUESTIONS,
    );

    expect(view).toMatchObject({ nickname: 'Grumete' });
    expect((await repo.carnet.mine())?.nickname).toBe('Grumete');
    expect(accountSnapshot().status).toBe('local');
    expect(gateSnapshot()).toBeNull();
    expect(opened).not.toHaveBeenCalled();
    expect(fake.sent).toEqual([]);
    off();
  });
});

describe('crear el Carnet con variables de Supabase', () => {
  // La sesión sólo arranca en un navegador (`typeof window`).
  beforeEach(() => {
    vi.stubGlobal('window', { sessionStorage: new MemoryStorage() });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requireAccount espera hasta que el código se verifica y el Carnet existe', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', URL_OK);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'sb_publishable_prueba');
    resetAccountForTests();
    const offHost = registerGateHost();

    let answer: boolean | undefined;
    const waiting = requireAccount('carnet', { prefill: { nickname: 'Grumete' } }).then((ok) => {
      answer = ok;
      return ok;
    });
    await vi.waitFor(() => expect(gateSnapshot()?.reason).toBe('carnet'));
    expect(accountSnapshot().status).toBe('guest');

    // Pide el código; uno mal escrito no abre nada.
    await sendCode(` ${fake.EMAIL} `);
    expect(fake.sent).toEqual([fake.EMAIL]);
    await expect(verifyCode(fake.EMAIL, '000000')).rejects.toMatchObject({ status: 403 });
    await settle();
    expect(answer).toBeUndefined();
    expect(accountSnapshot().userId).toBeNull();

    // El bueno abre la sesión, pero sin Carnet la cuenta está a medias.
    await verifyCode(fake.EMAIL, fake.GOOD);
    expect(accountSnapshot()).toMatchObject({ userId: fake.UID, email: fake.EMAIL });
    await settle();
    expect(answer).toBeUndefined();
    expect(gateSnapshot()?.reason).toBe('carnet');

    // El paso del apodo crea el Carnet; la hoja termina y el alta sigue.
    await createProfile({ nickname: 'Grumete', avatarKey: null, avatarImage: null, news: false });
    expect(accountSnapshot()).toMatchObject({
      status: 'member',
      profile: { nickname: 'Grumete', memberNumber: 7 },
    });
    settleGate(true);
    expect(await waiting).toBe(true);

    // Ya con cuenta y Carnet, guardar no vuelve a pedir nada.
    expect(await requireAccount('carnet')).toBe(true);
    expect(gateSnapshot()).toBeNull();
    offHost();
  });

  it('una cuenta verificada sin Carnet también espera a la hoja', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', URL_OK);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'sb_publishable_prueba');
    resetAccountForTests({ status: 'incomplete', userId: fake.UID });
    const offHost = registerGateHost();
    const waiting = requireAccount('carnet');
    await vi.waitFor(() => expect(gateSnapshot()?.reason).toBe('carnet'));
    settleGate(false);
    expect(await waiting).toBe(false);
    offHost();
  });
});

describe('las preguntas después del alta', () => {
  it('empiezan con el apodo de la cuenta, no con el campo vacío', () => {
    expect(initialDraft(null, { nickname: 'Grumete' })).toMatchObject({
      isNew: true,
      nickname: 'Grumete',
    });
    expect(initialDraft(null, null).nickname).toBe('');
  });
});

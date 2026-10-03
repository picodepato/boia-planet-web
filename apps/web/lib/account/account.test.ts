import { afterEach, describe, expect, it, vi } from 'vitest';
import { es } from '../i18n/es';
import { OTP_EXPIRY_MS } from './config';
import { authProblem, looksLikeEmail, nicknameVerdict, rpcReason } from './errors';
import {
  ACCOUNT_REASONS,
  gateSnapshot,
  registerGateHost,
  requireAccount,
  resetGateForTests,
  settleGate,
} from './gate';
import { accountSnapshot, resetAccountForTests } from './session';

const URL_OK = 'https://abcdefghijklmnopqrst.supabase.co';

afterEach(() => {
  vi.unstubAllEnvs();
  resetGateForTests();
  resetAccountForTests();
});

describe('la puerta de la cuenta (decisión 1)', () => {
  it('en modo local deja pasar al momento y no abre nada', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    resetAccountForTests();
    expect(accountSnapshot().status).toBe('local');
    for (const reason of ACCOUNT_REASONS) expect(await requireAccount(reason)).toBe(true);
    expect(gateSnapshot()).toBeNull();
  });

  it('con Supabase, un miembro pasa; un invitado espera a la hoja', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', URL_OK);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'sb_publishable_prueba');

    resetAccountForTests({ status: 'member' });
    expect(await requireAccount('skin')).toBe(true);

    resetAccountForTests({ status: 'guest' });
    // Sin hoja montada no se abre (y no se queda esperando).
    expect(await requireAccount('carnet')).toBe(false);

    const off = registerGateHost();
    const waiting = requireAccount('stamp', { event: 'Halloween' });
    await vi.waitFor(() => expect(gateSnapshot()).not.toBeNull());
    expect(gateSnapshot()).toMatchObject({ reason: 'stamp', event: 'Halloween' });
    settleGate(true);
    expect(await waiting).toBe(true);
    expect(gateSnapshot()).toBeNull();

    // Una segunda petición cancela la que estaba abierta.
    const first = requireAccount('carnet');
    await vi.waitFor(() => expect(gateSnapshot()?.reason).toBe('carnet'));
    const second = requireAccount('ranking');
    expect(await first).toBe(false);
    await vi.waitFor(() => expect(gateSnapshot()?.reason).toBe('ranking'));
    settleGate(false);
    expect(await second).toBe(false);
    off();
  });

  it('cada motivo tiene su título y su «por qué»', () => {
    for (const reason of ACCOUNT_REASONS) {
      expect(es[`auth.title.${reason}`]).toBeTruthy();
      expect(es[`auth.why.${reason}`]).toBeTruthy();
    }
  });
});

describe('errores de la hoja de acceso', () => {
  const sent = 1_000_000;

  it('código mal escrito o caducado, por el tiempo desde el envío', () => {
    const e = { status: 403, code: 'otp_expired', message: 'Token has expired or is invalid' };
    expect(authProblem(e, sent, sent + 5_000)).toBe('wrong');
    expect(authProblem(e, sent, sent + OTP_EXPIRY_MS + 1)).toBe('expired');
  });

  it('demasiados intentos, email no válido, sin red', () => {
    expect(authProblem({ status: 429, code: 'over_email_send_rate_limit' })).toBe('tooMany');
    expect(authProblem({ status: 400, code: 'email_address_invalid' })).toBe('invalidEmail');
    expect(authProblem({ name: 'AuthRetryableFetchError', status: 0 })).toBe('network');
    expect(authProblem(new Error('raro'))).toBe('unknown');
  });

  it('el apodo: libre, ocupado, filtro (sin decir qué palabra) o longitud', () => {
    expect(nicknameVerdict('ok')).toBe('free');
    expect(nicknameVerdict('nickname_taken')).toBe('taken');
    expect(nicknameVerdict('text_offensive')).toBe('blocked');
    expect(nicknameVerdict('text_link')).toBe('blocked');
    expect(nicknameVerdict('nickname_invalid')).toBe('invalid');
    expect(nicknameVerdict('privacy_required')).toBeNull();
    expect(rpcReason({ message: 'nickname_taken' })).toBe('nickname_taken');
    expect(rpcReason({ message: 'Algo en frase' })).toBeNull();
  });

  it('el email se valida al enviar', () => {
    expect(looksLikeEmail('grumete@example.test')).toBe(true);
    expect(looksLikeEmail(' a.b@c.es ')).toBe(true);
    expect(looksLikeEmail('grumete@example')).toBe(false);
    expect(looksLikeEmail('sin-arroba.com')).toBe(false);
  });
});

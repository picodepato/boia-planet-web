import { beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({
  level: { currentLevel: 'aal2', nextLevel: 'aal2' } as { currentLevel: string; nextLevel: string },
  updateError: null as { code?: string; message: string } | null,
  resetError: null as { code?: string; status?: number; message: string } | null,
  updateUser: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  setSession: vi.fn(),
}));

vi.mock('../account/session', () => ({
  accountClient: async () => ({
    auth: {
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({ data: fake.level, error: null }),
      },
      updateUser: async (attrs: unknown) => {
        fake.updateUser(attrs);
        return { error: fake.updateError };
      },
      resetPasswordForEmail: async (...args: unknown[]) => {
        fake.resetPasswordForEmail(...args);
        return { error: fake.resetError };
      },
      setSession: async (tokens: unknown) => {
        fake.setSession(tokens);
        return { error: null };
      },
    },
  }),
}));

import {
  AdminPasswordNeedsAal2,
  AdminPasswordRejected,
  changeAdminPassword,
  passwordChangeFailure,
  requestPasswordRecovery,
  setPasswordAfterRecovery,
  startRecoverySession,
} from '../account/admin-auth';
import {
  MIN_PASSWORD_LENGTH,
  parseRecoveryLink,
  passwordProblem,
  runPasswordChange,
} from './password-change';

// Contraseñas de juguete, sólo de estas pruebas.
const GOOD = 'x'.repeat(MIN_PASSWORD_LENGTH);

beforeEach(() => {
  fake.level = { currentLevel: 'aal2', nextLevel: 'aal2' };
  fake.updateError = null;
  fake.resetError = null;
  fake.updateUser.mockClear();
  fake.resetPasswordForEmail.mockClear();
  fake.setSession.mockClear();
});

describe('formulario de cambiar la contraseña (plan 029 T283)', () => {
  it('valida vacía, corta y distinta; una buena pasa', () => {
    expect(passwordProblem('', '')).toBe('empty');
    expect(
      passwordProblem('x'.repeat(MIN_PASSWORD_LENGTH - 1), 'x'.repeat(MIN_PASSWORD_LENGTH - 1)),
    ).toBe('short');
    expect(passwordProblem(GOOD, `${GOOD}y`)).toBe('mismatch');
    expect(passwordProblem(GOOD, GOOD)).toBeNull();
  });

  it('si no valida, no llama a Supabase', async () => {
    const change = vi.fn();
    const deps = { change, classify: passwordChangeFailure };
    expect(await runPasswordChange('corta', 'corta', deps)).toBe('short');
    expect(await runPasswordChange(GOOD, 'otra cosa larga', deps)).toBe('mismatch');
    expect(change).not.toHaveBeenCalled();
  });

  it('con la sesión completa (aal2) cambia la contraseña', async () => {
    const deps = { change: changeAdminPassword, classify: passwordChangeFailure };
    expect(await runPasswordChange(GOOD, GOOD, deps)).toBe('ok');
    expect(fake.updateUser).toHaveBeenCalledWith({ password: GOOD });
  });

  it('sin aal2 no llama a updateUser y pide entrar con el TOTP', async () => {
    fake.level = { currentLevel: 'aal1', nextLevel: 'aal2' };
    await expect(changeAdminPassword(GOOD)).rejects.toBeInstanceOf(AdminPasswordNeedsAal2);
    // aunque la cuenta no tenga TOTP, el cambio desde dentro pide aal2
    fake.level = { currentLevel: 'aal1', nextLevel: 'aal1' };
    const deps = { change: changeAdminPassword, classify: passwordChangeFailure };
    expect(await runPasswordChange(GOOD, GOOD, deps)).toBe('needsAal2');
    expect(fake.updateUser).not.toHaveBeenCalled();
  });

  it('explica el rechazo de Supabase: débil, igual o aal2 exigido por el servidor', async () => {
    const deps = { change: changeAdminPassword, classify: passwordChangeFailure };
    fake.updateError = { code: 'weak_password', message: 'weak' };
    expect(await runPasswordChange(GOOD, GOOD, deps)).toBe('weak');
    fake.updateError = { code: 'same_password', message: 'same' };
    expect(await runPasswordChange(GOOD, GOOD, deps)).toBe('same');
    fake.updateError = { code: 'insufficient_aal', message: 'aal' };
    expect(await runPasswordChange(GOOD, GOOD, deps)).toBe('needsAal2');
    fake.updateError = { code: 'boom', message: 'boom' };
    expect(await runPasswordChange(GOOD, GOOD, deps)).toBe('error');
    expect(passwordChangeFailure(new AdminPasswordRejected('other'))).toBe('error');
  });
});

describe('recuperar la contraseña (plan 029 T283)', () => {
  it('pide el enlace al email con la redirección a /admin/recuperar', async () => {
    await requestPasswordRecovery(' admin@example.test ', 'https://host.test/admin/recuperar');
    expect(fake.resetPasswordForEmail).toHaveBeenCalledWith('admin@example.test', {
      redirectTo: 'https://host.test/admin/recuperar',
    });
  });

  it('no delata si la cuenta existe: ni «no existe» ni el límite de 60 s se notan', async () => {
    const to = 'https://host.test/admin/recuperar';
    fake.resetError = { code: 'user_not_found', status: 404, message: 'x' };
    await expect(requestPasswordRecovery('a@example.test', to)).resolves.toBeUndefined();
    fake.resetError = { code: 'over_email_send_rate_limit', status: 429, message: 'x' };
    await expect(requestPasswordRecovery('a@example.test', to)).resolves.toBeUndefined();
    fake.resetError = { status: 429, message: 'For security purposes…' };
    await expect(requestPasswordRecovery('a@example.test', to)).resolves.toBeUndefined();
    // un fallo de red sí se dice (igual para todas las direcciones)
    fake.resetError = { status: 0, message: 'Failed to fetch' };
    await expect(requestPasswordRecovery('a@example.test', to)).rejects.toBeTruthy();
  });

  it('lee la sesión del enlace, su error o nada', () => {
    expect(
      parseRecoveryLink('#access_token=a1&refresh_token=r1&expires_in=3600&type=recovery'),
    ).toEqual({
      kind: 'session',
      accessToken: 'a1',
      refreshToken: 'r1',
    });
    expect(parseRecoveryLink('#error=access_denied&error_code=otp_expired')).toEqual({
      kind: 'error',
      code: 'otp_expired',
    });
    // un enlace que no es de recuperación no abre sesión
    expect(parseRecoveryLink('#access_token=a1&refresh_token=r1&type=magiclink').kind).toBe('none');
    expect(parseRecoveryLink('').kind).toBe('none');
  });

  it('abre la sesión del enlace', async () => {
    await startRecoverySession('a1', 'r1');
    expect(fake.setSession).toHaveBeenCalledWith({ access_token: 'a1', refresh_token: 'r1' });
  });

  it('tras el enlace: sin TOTP basta; con TOTP hay que verificarlo antes', async () => {
    fake.level = { currentLevel: 'aal1', nextLevel: 'aal1' };
    await setPasswordAfterRecovery(GOOD);
    expect(fake.updateUser).toHaveBeenCalledTimes(1);

    fake.updateUser.mockClear();
    fake.level = { currentLevel: 'aal1', nextLevel: 'aal2' };
    await expect(setPasswordAfterRecovery(GOOD)).rejects.toBeInstanceOf(AdminPasswordNeedsAal2);
    expect(fake.updateUser).not.toHaveBeenCalled();

    fake.level = { currentLevel: 'aal2', nextLevel: 'aal2' };
    await setPasswordAfterRecovery(GOOD);
    expect(fake.updateUser).toHaveBeenCalledTimes(1);
  });
});

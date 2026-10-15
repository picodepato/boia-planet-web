/**
 * La contraseña del Admin con cuentas (plan 029 T283) contra el proyecto de
 * desarrollo, con una cuenta de usar y tirar (contraseña aleatoria, TOTP
 * calculado aquí, enlace de recuperación sacado con `generateLink`: no se
 * manda ningún correo):
 *
 * - con la contraseña sola (aal1) Supabase no deja cambiarla si hay TOTP;
 *   con el TOTP (aal2) sí, la vieja deja de valer y las otras sesiones caen;
 * - el enlace de recuperación vuelve a `/admin/recuperar` con la sesión en el
 *   fragmento (`type=recovery`); esa sesión es aal1, así que con TOTP hay que
 *   verificarlo antes de poner la contraseña nueva; usado una vez, ya no vale;
 * - pedir el enlace para un email sin cuenta no da error (no se delata).
 */
import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { context } from './context.ts';
import { anonClient, testEmail, totp, type Client, type TestUser } from './testkit.ts';

const ctx = context();
let admin: TestUser;
let factorId: string;
let secret: string;
let password = '';
/** El último código TOTP usado: Supabase no acepta el mismo dos veces. */
let lastCode = '';

const newPassword = () => randomBytes(18).toString('base64url');

async function passwordSession(pw: string): Promise<Client> {
  const c = anonClient(ctx.env);
  const { error } = await c.auth.signInWithPassword({ email: admin.email, password: pw });
  expect(error).toBeNull();
  return c;
}

/** Un código TOTP que no se haya usado ya (si toca, espera a la ventana siguiente). */
async function freshCode(): Promise<string> {
  let code = totp(secret);
  if (code === lastCode) {
    await new Promise((r) => setTimeout(r, 30_000 - (Date.now() % 30_000) + 500));
    code = totp(secret);
  }
  lastCode = code;
  return code;
}

async function toAal2(c: Client): Promise<void> {
  const { error } = await c.auth.mfa.challengeAndVerify({ factorId, code: await freshCode() });
  expect(error).toBeNull();
}

beforeAll(async () => {
  admin = await ctx.user('t283-admin');
  await ctx.service.from('staff_roles').insert({ user_id: admin.id, role: 'admin' });
  password = newPassword();
  const set = await ctx.service.auth.admin.updateUserById(admin.id, { password });
  expect(set.error).toBeNull();
  const c = await passwordSession(password);
  const en = await c.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'boia-test-t283' });
  expect(en.error).toBeNull();
  factorId = en.data!.id;
  secret = en.data!.totp.secret;
  await toAal2(c);
});

afterAll(async () => {
  await ctx.cleanup();
});

describe('cambiar la contraseña en «Seguridad»', () => {
  it('con aal1 (sólo contraseña) Supabase la rechaza: insufficient_aal', async () => {
    const c = await passwordSession(password);
    const aal = await c.auth.mfa.getAuthenticatorAssuranceLevel();
    expect(aal.data).toMatchObject({ currentLevel: 'aal1', nextLevel: 'aal2' });
    const { error } = await c.auth.updateUser({ password: newPassword() });
    expect(error?.code).toBe('insufficient_aal');
    // la de antes sigue valiendo
    await passwordSession(password);
  });

  it('con aal2 cambia; la vieja ya no entra y las otras sesiones caen', async () => {
    const other = await passwordSession(password);
    const otherRefresh = (await other.auth.getSession()).data.session!.refresh_token;
    const c = await passwordSession(password);
    await toAal2(c);
    const next = newPassword();
    expect((await c.auth.updateUser({ password: next })).error).toBeNull();
    // la misma otra vez: same_password (la pantalla lo explica)
    expect((await c.auth.updateUser({ password: next })).error?.code).toBe('same_password');
    const old = await anonClient(ctx.env).auth.signInWithPassword({ email: admin.email, password });
    expect(old.error?.code).toBe('invalid_credentials');
    password = next;
    await passwordSession(password);
    const refreshed = await anonClient(ctx.env).auth.refreshSession({
      refresh_token: otherRefresh,
    });
    expect(refreshed.error).not.toBeNull();
  });
});

describe('«He olvidado la contraseña»', () => {
  async function recoveryFragment(): Promise<{ link: string; hash: URLSearchParams }> {
    const { data, error } = await ctx.service.auth.admin.generateLink({
      type: 'recovery',
      email: admin.email,
      options: { redirectTo: 'http://localhost:3000/admin/recuperar' },
    });
    expect(error).toBeNull();
    const link = data.properties!.action_link;
    const res = await fetch(link, { redirect: 'manual' });
    const location = res.headers.get('location') ?? '';
    return { link, hash: new URLSearchParams(location.split('#')[1] ?? '') };
  }

  it('el enlace abre una sesión aal1; con TOTP primero el código y luego la contraseña', async () => {
    const { link, hash } = await recoveryFragment();
    expect(hash.get('type')).toBe('recovery');
    const c = anonClient(ctx.env);
    const set = await c.auth.setSession({
      access_token: hash.get('access_token')!,
      refresh_token: hash.get('refresh_token')!,
    });
    expect(set.error).toBeNull();
    const aal = await c.auth.mfa.getAuthenticatorAssuranceLevel();
    expect(aal.data).toMatchObject({ currentLevel: 'aal1', nextLevel: 'aal2' });
    const next = newPassword();
    expect((await c.auth.updateUser({ password: next })).error?.code).toBe('insufficient_aal');
    await toAal2(c);
    expect((await c.auth.updateUser({ password: next })).error).toBeNull();
    password = next;
    await passwordSession(password);

    // el mismo enlace otra vez: caducado. El error puede venir en el fragmento o
    // en la query según la versión de Auth; se lee de los dos y, si falta, el
    // fallo dice qué contestó Auth (estado y Location) en lugar de un `null`.
    const again = await fetch(link, { redirect: 'manual' });
    const where = again.headers.get('location') ?? '';
    const seen = `Auth contestó ${again.status} con Location «${where.slice(0, 200)}»`;
    const [beforeHash, afterHash = ''] = where.split('#');
    const frag = new URLSearchParams(afterHash);
    const query = new URLSearchParams((beforeHash ?? '').split('?')[1] ?? '');
    expect(frag.get('access_token') ?? query.get('access_token'), seen).toBeNull();
    expect(frag.get('error_code') ?? query.get('error_code'), seen).toBe('otp_expired');
  });

  it('para un email sin cuenta no hay error (la pantalla dice lo mismo)', async () => {
    const { error } = await anonClient(ctx.env).auth.resetPasswordForEmail(
      testEmail('t283-nadie'),
      { redirectTo: 'http://localhost:3000/admin/recuperar' },
    );
    expect(error).toBeNull();
  });
});

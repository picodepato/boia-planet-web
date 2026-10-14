import { randomBytes } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import type { Session } from '@supabase/supabase-js';
import { MIN_PASSWORD_LENGTH } from '../lib/admin/password-change';
import { t } from '../lib/i18n';
import { SUPABASE_AUTH_STORAGE_KEY } from '../lib/supabase/config';
import {
  E2E_SUPABASE,
  anonClient,
  createMember,
  deleteMembers,
  serviceClient,
  testEmail,
  totp,
  type TestMember,
} from './supabase';

/**
 * La contraseña del Admin con cuentas (plan 029 T283), en el navegador y
 * contra el proyecto de desarrollo, con una cuenta admin de usar y tirar
 * (contraseña aleatoria, TOTP calculado aquí, enlace de recuperación sacado
 * con `generateLink`: no se manda ningún correo):
 *
 * - Seguridad → «Cambiar contraseña» con la sesión completa (aal2): valida,
 *   cambia, y la vieja deja de entrar (con aal1 Supabase la rechaza:
 *   `admin-password.supabase.ts`);
 * - «He olvidado la contraseña» dice lo mismo para un email sin cuenta;
 * - `/admin/recuperar` con el enlace: quita la sesión de la URL, pide el TOTP,
 *   pone la contraseña nueva, cierra la sesión; el mismo enlace otra vez no
 *   vale.
 *
 * Sólo con E2E_SUPABASE=1, en escritorio.
 */
test.skip(!E2E_SUPABASE, 'sólo con E2E_SUPABASE=1');
test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: 'serial', timeout: 180_000 });

let admin: TestMember;
let password = '';
let factorId = '';
let secret = '';
let lastCode = '';

const newPassword = () => randomBytes(18).toString('base64url');

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

async function canSignIn(pw: string): Promise<boolean> {
  const { error } = await anonClient().auth.signInWithPassword({
    email: admin.email,
    password: pw,
  });
  return !error;
}

/** Sesión completa (contraseña + TOTP) hecha fuera del navegador. */
async function aal2Session(): Promise<Session> {
  const c = anonClient();
  const r = await c.auth.signInWithPassword({ email: admin.email, password });
  expect(r.error).toBeNull();
  const v = await c.auth.mfa.challengeAndVerify({ factorId, code: await freshCode() });
  expect(v.error).toBeNull();
  return (await c.auth.getSession()).data.session!;
}

async function storedSession(page: Page): Promise<string | null> {
  return page.evaluate((key) => window.localStorage.getItem(key), SUPABASE_AUTH_STORAGE_KEY);
}

test.beforeAll(async () => {
  admin = await createMember('t283-admin');
  const service = serviceClient();
  expect(
    (await service.from('staff_roles').insert({ user_id: admin.id, role: 'admin' })).error,
  ).toBeNull();
  password = newPassword();
  expect((await service.auth.admin.updateUserById(admin.id, { password })).error).toBeNull();
  const c = anonClient();
  expect((await c.auth.signInWithPassword({ email: admin.email, password })).error).toBeNull();
  const en = await c.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'boia-e2e-t283' });
  expect(en.error).toBeNull();
  factorId = en.data!.id;
  secret = en.data!.totp.secret;
  const v = await c.auth.mfa.challengeAndVerify({ factorId, code: await freshCode() });
  expect(v.error).toBeNull();
});

test.afterAll(async () => {
  if (admin) await deleteMembers([admin]);
});

test('Seguridad: cambiar la contraseña con la sesión completa', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'una cuenta de verdad: sólo en escritorio');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const session = await aal2Session();
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [
    SUPABASE_AUTH_STORAGE_KEY,
    JSON.stringify(session),
  ] as const);
  await page.goto('/admin');
  await expect(page.getByTestId('admin')).toHaveAttribute('data-admin', 'real', {
    timeout: 30_000,
  });
  await page.getByTestId('admin-nav-seguridad').click();
  const form = page.getByTestId('admin-cambiar-password');
  await expect(form).toBeVisible();

  const save = form.getByTestId('admin-password-guardar');
  await form.getByTestId('admin-password-nueva').fill('corta');
  await form.getByTestId('admin-password-repetir').fill('corta');
  await save.click();
  await expect(form.getByTestId('admin-password-error')).toHaveText(
    t('admin.real.password.short', { min: MIN_PASSWORD_LENGTH }),
  );
  const next = newPassword();
  await form.getByTestId('admin-password-nueva').fill(next);
  await form.getByTestId('admin-password-repetir').fill(`${next}x`);
  await save.click();
  await expect(form.getByTestId('admin-password-error')).toHaveText(
    t('admin.real.password.mismatch'),
  );

  await form.getByTestId('admin-password-repetir').fill(next);
  await save.click();
  await expect(form.getByTestId('admin-password-hecho')).toHaveText(t('admin.real.password.done'), {
    timeout: 20_000,
  });
  await expect(form.getByTestId('admin-password-nueva')).toHaveValue('');
  expect(await canSignIn(password)).toBe(false);
  expect(await canSignIn(next)).toBe(true);
  password = next;
  expect(page.url()).not.toContain(next);
  expect(errors).toEqual([]);
});

test('«He olvidado la contraseña»: un email sin cuenta recibe el mismo aviso', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'sólo en escritorio');
  await page.goto('/admin');
  await page.getByTestId('admin-login-olvide').click();
  await expect(page.getByRole('heading', { name: t('admin.real.forgot.title') })).toBeVisible();
  // Lo que no es un email no sale (lo para el propio campo).
  await page.getByTestId('admin-olvide-email').fill('no-es-un-email');
  await page.getByTestId('admin-olvide-enviar').click();
  await expect(page.getByTestId('admin-olvide-enviado')).toHaveCount(0);
  const nobody = testEmail('t283-nadie');
  await page.getByTestId('admin-olvide-email').fill(nobody);
  await page.getByTestId('admin-olvide-enviar').click();
  await expect(page.getByTestId('admin-olvide-enviado')).toHaveText(
    t('admin.real.forgot.sent', { email: nobody }),
  );
});

test('/admin/recuperar: el enlace, el TOTP, la contraseña nueva; el enlace no vale dos veces', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'una cuenta de verdad: sólo en escritorio');
  const errors: string[] = [];
  const logs: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => logs.push(m.text()));
  const { data, error } = await serviceClient().auth.admin.generateLink({
    type: 'recovery',
    email: admin.email,
    options: { redirectTo: 'http://localhost:3000/admin/recuperar' },
  });
  expect(error).toBeNull();
  // Lo que hace el navegador al abrir el enlace del correo: Supabase lo
  // verifica y redirige con la sesión en el fragmento.
  const res = await fetch(data.properties!.action_link, { redirect: 'manual' });
  const fragment = (res.headers.get('location') ?? '').split('#')[1] ?? '';
  const tokens = new URLSearchParams(fragment);
  expect(tokens.get('type')).toBe('recovery');
  const accessToken = tokens.get('access_token')!;

  await page.goto(`/admin/recuperar#${fragment}`);
  await expect(page.getByTestId('admin-recuperar-totp')).toBeVisible({ timeout: 30_000 });
  // La sesión ya no está en la barra de direcciones.
  expect(page.url()).not.toContain('#');
  expect(page.url()).not.toContain(accessToken);
  await page.getByTestId('admin-recuperar-totp').fill(await freshCode());
  await page.getByTestId('admin-recuperar-totp-seguir').click();

  const next = newPassword();
  await page.getByTestId('admin-password-nueva').fill(next);
  await page.getByTestId('admin-password-repetir').fill(next);
  await page.getByTestId('admin-password-guardar').click();
  await expect(page.getByTestId('admin-recuperar-hecho')).toHaveText(t('admin.real.recover.done'), {
    timeout: 20_000,
  });
  // La sesión del enlace se cierra.
  expect(await storedSession(page)).toBeNull();
  await expect(page.getByTestId('admin-recuperar-ir')).toHaveAttribute('href', '/admin');
  expect(await canSignIn(password)).toBe(false);
  expect(await canSignIn(next)).toBe(true);
  password = next;

  // El mismo enlace otra vez: no vale. (about:blank antes: cambiar sólo el
  // fragmento no recarga la página.)
  await page.goto('about:blank');
  await page.goto(`/admin/recuperar#${fragment}`);
  await expect(page.getByTestId('admin-recuperar-invalido')).toBeVisible({ timeout: 30_000 });
  expect(page.url()).not.toContain(accessToken);
  expect(await storedSession(page)).toBeNull();
  // Un enlace caducado (lo que Supabase manda si ya se usó).
  await page.goto('about:blank');
  await page.goto('/admin/recuperar#error=access_denied&error_code=otp_expired');
  await expect(page.getByTestId('admin-recuperar-invalido')).toBeVisible();

  // Ningún token en la consola.
  expect(logs.join('\n')).not.toContain(accessToken);
  expect(logs.join('\n')).not.toContain(tokens.get('refresh_token')!);
  expect(errors).toEqual([]);
});

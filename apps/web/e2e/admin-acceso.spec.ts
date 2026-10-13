import { randomBytes } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { t } from '../lib/i18n';
import {
  E2E_SUPABASE,
  createMember,
  deleteMembers,
  serviceClient,
  type TestMember,
} from './supabase';

/**
 * Entrar al Admin de la demo con el Carnet 000 (plan 017 T193, decisión 9),
 * en modo local: sin sesión, /admin pide el número y la contraseña; un
 * número o una contraseña equivocados no entran; dentro, «Salir del Admin»
 * vuelve a la puerta. La contraseña de verdad no está en el repositorio: el
 * caso «entra» la lee de ADMIN_DEMO_PASSWORD (sólo en la terminal) y sin
 * ella se salta. Corre en móvil 360×640 y en escritorio.
 *
 * Con cuentas (`E2E_SUPABASE=1`, plan 029 T278) la puerta es otra: el Admin
 * escribe el email de su cuenta (la del Carnet 000) y su contraseña, y
 * después va el TOTP. La base ya no da ese email a quien escribe «000».
 */

// Sin la sesión que ponen las demás e2e (playwright.config.ts).
test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ timeout: 90_000 });

const PASSWORD = process.env.ADMIN_DEMO_PASSWORD;

test('sin sesión, /admin pide el Carnet 000; lo equivocado no entra', async ({ page }) => {
  test.skip(E2E_SUPABASE, 'con cuentas la puerta es la de abajo');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/admin');
  await expect(page.getByTestId('admin-login')).toBeVisible();
  await expect(page.getByTestId('admin')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: t('admin.demoLogin.title') })).toBeVisible();

  const enter = page.getByTestId('admin-login-carnet-entrar');
  await expect(enter).toBeDisabled();
  await page.getByTestId('admin-login-carnet').fill('000');
  await page.getByTestId('admin-login-password').fill('no-es-la-contraseña');
  await enter.click();
  await expect(page.getByTestId('admin-login-error')).toHaveText(t('admin.demoLogin.wrong'));
  await expect(page.getByTestId('admin')).toHaveCount(0);

  // Otro número, aunque la contraseña fuera buena, tampoco.
  await page.getByTestId('admin-login-carnet').fill('001');
  await page.getByTestId('admin-login-password').fill(PASSWORD ?? 'otra');
  await enter.click();
  await expect(page.getByTestId('admin-login-error')).toHaveText(t('admin.demoLogin.wrong'));
  await expect(page.getByTestId('admin')).toHaveCount(0);
  // La contraseña nunca va a la URL.
  expect(page.url()).not.toContain('password');
  expect(errors).toEqual([]);
});

test('Carnet 000 y la contraseña entran; recargar sigue dentro; salir vuelve a la puerta', async ({
  page,
}) => {
  test.skip(E2E_SUPABASE, 'con cuentas la puerta es la de abajo');
  test.skip(!PASSWORD, 'sin ADMIN_DEMO_PASSWORD en la terminal');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/admin');
  await page.getByTestId('admin-login-carnet').fill('000');
  await page.getByTestId('admin-login-password').fill(PASSWORD!);
  await page.getByTestId('admin-login-carnet-entrar').click();
  await expect(page.getByTestId('admin')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('admin')).toHaveAttribute('data-admin', 'demo');
  await expect(page.getByTestId('admin-aviso')).toBeVisible();

  await page.reload();
  await expect(page.getByTestId('admin')).toBeVisible();

  await page.getByTestId('admin-salir').click();
  await expect(page.getByTestId('admin-login')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('admin-login')).toBeVisible();
  await expect(page.getByTestId('admin')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test.describe('con cuentas: email y contraseña de la cuenta del Admin', () => {
  test.skip(!E2E_SUPABASE, 'sólo con E2E_SUPABASE=1');
  const created: TestMember[] = [];

  test.afterAll(async () => {
    await deleteMembers(created);
  });

  test('la contraseña equivocada no entra; la buena lleva al TOTP', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'una cuenta de verdad: sólo en escritorio');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const admin = await createMember('t278-admin');
    created.push(admin);
    const service = serviceClient();
    const role = await service.from('staff_roles').insert({ user_id: admin.id, role: 'admin' });
    expect(role.error).toBeNull();
    const password = randomBytes(18).toString('base64url');
    const set = await service.auth.admin.updateUserById(admin.id, { password });
    expect(set.error).toBeNull();

    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: t('admin.real.carnet.title') })).toBeVisible();
    const enter = page.getByTestId('admin-login-carnet-entrar');
    await expect(enter).toBeDisabled();
    await page.getByTestId('admin-login-carnet-email').fill(admin.email);
    await page.getByTestId('admin-login-password').fill('no-es-la-contraseña');
    await enter.click();
    await expect(page.getByTestId('admin-login-error')).toHaveText(t('admin.real.carnet.wrong'));
    await expect(page.getByTestId('admin')).toHaveCount(0);

    await page.getByTestId('admin-login-password').fill(password);
    await enter.click();
    // Con la contraseña sola (aal1) no se entra: primero el TOTP.
    await expect(page.getByTestId('admin-totp-codigo')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('admin')).toHaveCount(0);
    expect(page.url()).not.toContain('password');
    expect(errors).toEqual([]);
  });
});

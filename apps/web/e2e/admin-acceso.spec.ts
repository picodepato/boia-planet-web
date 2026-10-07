import { expect, test } from '@playwright/test';
import { t } from '../lib/i18n';

/**
 * Entrar al Admin de la demo con el Carnet 000 (plan 017 T193, decisión 9),
 * en modo local: sin sesión, /admin pide el número y la contraseña; un
 * número o una contraseña equivocados no entran; dentro, «Salir del Admin»
 * vuelve a la puerta. La contraseña de verdad no está en el repositorio: el
 * caso «entra» la lee de ADMIN_DEMO_PASSWORD (sólo en la terminal) y sin
 * ella se salta. Corre en móvil 360×640 y en escritorio.
 */

// Sin la sesión que ponen las demás e2e (playwright.config.ts).
test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ timeout: 90_000 });

const PASSWORD = process.env.ADMIN_DEMO_PASSWORD;

test('sin sesión, /admin pide el Carnet 000; lo equivocado no entra', async ({ page }) => {
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

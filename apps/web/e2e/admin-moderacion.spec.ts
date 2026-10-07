import { SAMPLE_BOTTLES, SAMPLE_CREW, moderatedNickname } from '@boia/store';
import { expect, test, type Page } from '@playwright/test';
import { t } from '../lib/i18n';

/**
 * Plan 017 T191 (REQ-ADM-031, decisión 5) en el Admin de la demo, sin
 * servidor (D-20): ocultar un Carnet público y volver a mostrarlo, retirar
 * y devolver su apodo, y devolver al mar una botella retirada. Lo público
 * (la página del Carnet) lo refleja. Con cuentas, lo mismo va por las RPC de
 * 20261007100200_moderation.sql (admin-real.spec.ts con E2E_SUPABASE=1 y
 * packages/db/src/supabase/moderation.supabase.ts).
 */

test.describe.configure({ timeout: 120_000 });

const member = SAMPLE_CREW[0]!;
const bottle = SAMPLE_BOTTLES[0]!;

async function moderation(page: Page) {
  await page.goto('/admin#moderacion');
  await expect(page.getByTestId('admin-seccion-moderacion')).toBeVisible();
  const row = page.getByTestId(`carnet-mod-${member.userId}`);
  await expect(row).toBeVisible();
  return row;
}

async function act(page: Page, action: string, reason = 'Moderación de prueba (e2e)') {
  const row = page.getByTestId(`carnet-mod-${member.userId}`);
  await row.getByTestId(`carnet-mod-motivo-${member.userId}`).fill(reason);
  await row.getByTestId(`carnet-mod-${action}-${member.userId}`).click();
}

test('ocultar un Carnet lo quita de la web y mostrarlo lo devuelve', async ({ page }) => {
  await page.goto(`/carnet/${member.userId}`);
  await expect(page.getByTestId('carnet-apodo')).toHaveText(member.nickname);

  const row = await moderation(page);
  await expect(row).toHaveAttribute('data-oculto', 'no');
  await act(page, 'hide');
  await expect(page.getByTestId(`carnet-mod-${member.userId}`)).toHaveAttribute(
    'data-oculto',
    'si',
  );

  await page.goto(`/carnet/${member.userId}`);
  await expect(page.getByRole('heading', { name: t('carnet.notFound.title') })).toBeVisible();
  await expect(page.getByTestId('carnet-apodo')).toHaveCount(0);

  await moderation(page);
  await act(page, 'show');
  await expect(page.getByTestId(`carnet-mod-${member.userId}`)).toHaveAttribute(
    'data-oculto',
    'no',
  );
  await page.goto(`/carnet/${member.userId}`);
  await expect(page.getByTestId('carnet-apodo')).toHaveText(member.nickname);

  // Queda en la auditoría.
  await page.goto('/admin#auditoria');
  await expect(page.getByTestId('admin-seccion-auditoria')).toContainText(
    'Moderación de prueba (e2e)',
  );
});

test('retirar el apodo de un Carnet y devolverlo', async ({ page }) => {
  await moderation(page);
  await act(page, 'hide_nickname');
  await expect(page.getByTestId(`carnet-mod-${member.userId}`)).toHaveAttribute(
    'data-apodo',
    'retirado',
  );
  await page.goto(`/carnet/${member.userId}`);
  await expect(page.getByTestId('carnet-apodo')).toHaveText(moderatedNickname(member.userId));

  await moderation(page);
  await act(page, 'restore_nickname');
  await expect(page.getByTestId(`carnet-mod-${member.userId}`)).toHaveAttribute(
    'data-apodo',
    'visible',
  );
  await page.goto(`/carnet/${member.userId}`);
  await expect(page.getByTestId('carnet-apodo')).toHaveText(member.nickname);
});

test('una botella retirada vuelve al mar', async ({ page }) => {
  await moderation(page);
  const row = page.getByTestId(`botella-${bottle.id}`);
  await expect(row).toHaveAttribute('data-estado', 'active');
  await row.getByTestId(`botella-motivo-${bottle.id}`).fill('Spam de prueba');
  await row.getByTestId(`botella-retirar-${bottle.id}`).click();
  const removed = page.getByTestId(`botella-${bottle.id}`);
  await expect(removed).toHaveAttribute('data-estado', 'removed');
  await removed.getByTestId(`botella-devolver-${bottle.id}`).click();
  await expect(page.getByTestId(`botella-${bottle.id}`)).toHaveAttribute('data-estado', 'active');
});

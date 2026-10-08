import { EVENT_STATE_BEHAVIOR } from '@boia/contracts';
import { SAMPLE_EVENTS } from '@boia/store';
import { expect, test, type Page } from '@playwright/test';
import { es } from '../lib/i18n/es';

/**
 * Admin de la reunión del 2026-10-08 (plan 019 T223, decisión 17), en modo
 * local: la papelera de 30 días deshace lo cambiado y recupera lo borrado
 * (editar y borrar un evento, y volver a tenerlo como estaba); la analítica
 * de visitas se enciende y apaga en Integraciones; «Usuarios de
 * administración» explica el límite de 3 con acceso completo.
 */

test.describe.configure({ timeout: 120_000 });

const event = SAMPLE_EVENTS.find((e) => EVENT_STATE_BEHAVIOR[e.state].purchasable)!;
const RENAMED = `${event.name} cambiado e2e`;

async function section(page: Page, id: string) {
  await page.getByTestId(`admin-nav-${id}`).click();
  await expect(page.getByTestId(`admin-seccion-${id}`)).toBeVisible();
}

test('editar y borrar un evento; la papelera devuelve las dos cosas', async ({ page }) => {
  await page.goto('/admin');
  await section(page, 'eventos');

  // Editar: otro nombre.
  await page.getByTestId(`evento-editar-${event.id}`).click();
  const form = page.getByTestId('evento-form');
  await form.getByTestId('evento-nombre').fill(RENAMED);
  await form.getByTestId('evento-guardar').click();
  await expect(page.getByTestId(`evento-${event.id}`)).toContainText(RENAMED);

  // Borrar (con su nombre de ahora).
  await page.getByTestId(`borrar-events-${event.id}`).click();
  const panel = page.getByTestId('borrar-panel');
  await panel.getByTestId('borrar-nombre').fill(RENAMED);
  await panel.getByTestId('borrar-confirmar').click();
  await expect(page.getByTestId(`evento-${event.id}`)).toHaveCount(0);

  // La papelera: recuperar lo borrado…
  await section(page, 'papelera');
  await expect(page.getByTestId('admin-seccion-papelera')).toContainText(
    es['admin.gestion.trash.lead'].replace('{days}', '30'),
  );
  const deleted = page.getByTestId(`papelera-events-${event.id}`);
  await expect(deleted).toContainText(RENAMED);
  await deleted.getByTestId(`papelera-recuperar-${event.id}`).click();
  await expect(deleted).toHaveCount(0);

  // …y deshacer el cambio de nombre.
  const edit = page.locator(`[data-testid="papelera-cambio-events-${event.id}"][data-kind="edit"]`);
  await expect(edit).toHaveCount(1);
  await expect(edit).toContainText(event.name);
  await edit.getByTestId('papelera-deshacer').click();
  await expect(
    page
      .getByTestId('admin-seccion-papelera')
      .getByTestId('admin-ok')
      .filter({ hasText: es['admin.gestion.trash.undone'] }),
  ).toHaveCount(1);

  // El evento vuelve, como estaba.
  await section(page, 'eventos');
  const row = page.getByTestId(`evento-${event.id}`);
  await expect(row).toContainText(event.name);
  await expect(row).not.toContainText(RENAMED);
});

test('la analítica se enciende y se apaga; el límite de acceso completo se explica', async ({
  page,
}) => {
  const posthog: string[] = [];
  page.on('request', (r) => {
    if (/posthog\.com/.test(r.url())) posthog.push(r.url());
  });
  await page.goto('/admin');
  await section(page, 'usuarios');
  await expect(page.getByTestId('usuarios-limite')).toContainText(
    es['admin.gestion.users.limit'].replace('{limit}', '3'),
  );

  await section(page, 'integraciones');
  const state = page.getByTestId('analitica-estado');
  await expect(state).toHaveAttribute('data-on', '0');
  await page.getByTestId('analitica-interruptor').check();
  await expect(state).toHaveAttribute('data-on', '1');
  await page.reload();
  await section(page, 'integraciones');
  await expect(page.getByTestId('analitica-estado')).toHaveAttribute('data-on', '1');
  await page.getByTestId('analitica-interruptor').uncheck();
  await expect(page.getByTestId('analitica-estado')).toHaveAttribute('data-on', '0');

  // Apagada, la landing no manda nada a PostHog.
  await page.goto('/?intro=0');
  await expect(page.locator('main')).toHaveAttribute('data-contenido', 'repositorio');
  expect(posthog).toEqual([]);
});

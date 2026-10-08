import { CALITAS_PLACE_ID } from '@boia/world';
import { type Page, expect, test } from '@playwright/test';
import { SAMPLE_COMMENTS } from '../lib/calitas/sample';
import { t } from '../lib/i18n';
import { mar, marSheet, openMar, sheetIs, steerTo } from './mar-helpers';

/**
 * Las Calitas (plan 019 T222, decisión 16) en modo local (D-20): la isla de
 * los comentarios. Se llega a ella, se despliega su ficha y se comenta,
 * se responde y se vota; un insulto no pasa. El Admin de la demo oculta un
 * comentario y desaparece de la isla (con su respuesta); mostrarlo lo
 * devuelve. Con cuentas, lo mismo va por las RPC de 20261008100500_calitas.sql
 * (packages/db/src/supabase/calitas.supabase.ts).
 */
test.describe.configure({ timeout: 180_000 });

const top = SAMPLE_COMMENTS.find((c) => c.parentId === null)!;
const reply = SAMPLE_COMMENTS.find((c) => c.parentId === top.id)!;
const other = SAMPLE_COMMENTS.find((c) => c.parentId === null && c.id !== top.id)!;

const comment = (page: Page, id: string) => page.getByTestId(`calitas-comentario-${id}`);

/** Llega a Las Calitas y despliega su ficha con los comentarios. */
async function openCalitas(page: Page): Promise<string[]> {
  const errors = await openMar(page, `?cerca=${CALITAS_PLACE_ID}`);
  await steerTo(page, CALITAS_PLACE_ID, sheetIs(page, 'info'), { ms: 90_000 });
  const sheet = marSheet(page);
  await expect(sheet).toHaveAttribute('data-lugar', CALITAS_PLACE_ID);
  await expect(sheet.getByRole('heading', { name: 'Las Calitas' })).toBeVisible();
  await expect(sheet).toContainText(t('calitas.intro'));
  await sheet.getByTestId('calitas-abrir').click();
  await expect(sheet).toHaveAttribute('data-expandida', 'si');
  await expect(page.getByTestId('calitas')).toHaveAttribute('data-modo', 'local');
  await expect(page.getByTestId('calitas-lista')).toBeVisible();
  return errors;
}

test('Las Calitas: comentar, responder y votar; un insulto no pasa', async ({ page }) => {
  const errors = await openCalitas(page);
  await expect(page.getByTestId('calitas')).toContainText(t('calitas.localNote'));
  // Los de muestra, con su respuesta.
  await expect(comment(page, top.id)).toContainText(top.body);
  await expect(comment(page, reply.id)).toContainText(reply.body);

  // Un insulto, deletreado, no se publica.
  const form = page.getByTestId('calitas-nuevo');
  await page.getByTestId('calitas-nuevo-texto').fill('eres un g-i-l-i-p-o-l-l-a-s');
  await page.getByTestId('calitas-nuevo-publicar').click();
  await expect(page.getByTestId('calitas-nuevo-error')).toHaveAttribute('data-error', 'offensive');
  await expect(form).toContainText(t('calitas.error.offensive'));
  await expect(page.locator('[data-testid^="calitas-comentario-"][data-mio="si"]')).toHaveCount(0);

  // Un comentario normal, sí: sale el primero (recientes) y es mío.
  const text = 'Qué buena cala para charlar (e2e)';
  await page.getByTestId('calitas-nuevo-texto').fill(text);
  await page.getByTestId('calitas-nuevo-publicar').click();
  const mine = page.locator('[data-testid^="calitas-comentario-"][data-mio="si"]');
  await expect(mine).toHaveCount(1);
  await expect(mine).toContainText(text);
  await expect(mine).toContainText(t('calitas.author.you'));
  await expect(page.getByTestId('calitas-nuevo-texto')).toHaveValue('');
  // El propio no se vota.
  await expect(mine.locator('[data-testid^="calitas-arriba-"]')).toBeDisabled();

  // Responder a otro comentario de muestra.
  await page.getByTestId(`calitas-responder-${other.id}`).click();
  const answer = 'Me apunto a eso (e2e)';
  await page.getByTestId(`calitas-respuesta-${other.id}-texto`).fill(answer);
  await page.getByTestId(`calitas-respuesta-${other.id}-publicar`).click();
  await expect(mine).toHaveCount(2);
  const answered = page
    .getByTestId(`calitas-comentario-${other.id}`)
    .locator('xpath=ancestor::li[1]')
    .locator('.calitas-replies');
  await expect(answered).toContainText(answer);
  // Nada se sale de la ficha por los lados (también con respuestas y el formulario abierto).
  await page.getByTestId(`calitas-responder-${top.id}`).click();
  expect(
    await marSheet(page).evaluate((el) => el.scrollWidth - el.clientWidth),
  ).toBeLessThanOrEqual(1);
  await page.getByTestId(`calitas-responder-${top.id}`).click();

  // Votar a favor, cambiar a en contra y quitarlo.
  const voted = comment(page, top.id);
  await expect(voted).toHaveAttribute('data-puntos', String(top.score));
  await page.getByTestId(`calitas-arriba-${top.id}`).click();
  await expect(voted).toHaveAttribute('data-voto', '1');
  await expect(voted).toHaveAttribute('data-puntos', String(top.score + 1));
  await page.getByTestId(`calitas-abajo-${top.id}`).click();
  await expect(voted).toHaveAttribute('data-voto', '-1');
  await expect(voted).toHaveAttribute('data-puntos', String(top.score - 1));
  await page.getByTestId(`calitas-abajo-${top.id}`).click();
  await expect(voted).toHaveAttribute('data-voto', '0');
  await page.getByTestId(`calitas-arriba-${top.id}`).click();
  await expect(voted).toHaveAttribute('data-voto', '1');

  // Al volver, sigue todo (en este navegador).
  await page.reload();
  await openCalitas(page);
  await expect(page.locator('[data-testid^="calitas-comentario-"][data-mio="si"]')).toHaveCount(2);
  await expect(comment(page, top.id)).toHaveAttribute('data-voto', '1');
  expect(errors).toEqual([]);
});

test('el Admin oculta un comentario y desaparece de Las Calitas', async ({ page }) => {
  await openCalitas(page);
  await expect(comment(page, top.id)).toBeVisible();
  await expect(comment(page, reply.id)).toBeVisible();

  await page.goto('/admin#moderacion');
  await expect(page.getByTestId('admin-seccion-moderacion')).toBeVisible();
  const row = page.getByTestId(`calitas-mod-${top.id}`);
  await expect(row).toHaveAttribute('data-oculto', 'no');
  await row.getByTestId(`calitas-mod-motivo-${top.id}`).fill('Moderación de prueba (e2e)');
  await row.getByTestId(`calitas-mod-ocultar-${top.id}`).click();
  await expect(page.getByTestId(`calitas-mod-${top.id}`)).toHaveAttribute('data-oculto', 'si');

  await openCalitas(page);
  await expect(comment(page, other.id)).toBeVisible();
  await expect(comment(page, top.id)).toHaveCount(0);
  await expect(comment(page, reply.id)).toHaveCount(0);

  // Mostrarlo lo devuelve, con su respuesta.
  await page.goto('/admin#moderacion');
  await page.getByTestId(`calitas-mod-mostrar-${top.id}`).click();
  await expect(page.getByTestId(`calitas-mod-${top.id}`)).toHaveAttribute('data-oculto', 'no');
  await openCalitas(page);
  await expect(comment(page, top.id)).toBeVisible();
  await expect(comment(page, reply.id)).toBeVisible();
  await expect(mar(page)).toHaveAttribute('data-barco', /\d/);
});

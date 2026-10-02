import { expect, test, type Page } from '@playwright/test';
import { CARNET_QUESTIONS } from '@boia/contracts';

/**
 * Mi Carnet y botellas (T22), sin servidor: todo vive en este navegador
 * (D-20). Crea un apodo, rellena el Carnet, echa una botella, recarga y la
 * encuentra junto al barco; lee una botella de muestra y abre el Carnet de
 * quien la escribió. Corre en móvil 360×640 y en escritorio.
 */

async function gameRunning(page: Page) {
  await expect(page.getByTestId('hud')).toContainText(/\d+ fps/, { timeout: 30_000 });
}

const nearby = (page: Page) => page.locator('[data-testid^="botella-cerca-"]');

test('Carnet → botella → recargar y encontrarla → leer una de muestra → VER SU CARNET', async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const nickname = `Prueba ${info.project.name}`;
  const answers = CARNET_QUESTIONS.slice(0, 2).map((q, i) => ({ q, text: `Respuesta ${i + 1}` }));
  const message = `Hola desde ${info.project.name}: nos vemos en el All Day.`;

  await page.goto('/juego');
  await gameRunning(page);

  // Mi Carnet: sin Carnet, la invitación; el alta enseña las 5 preguntas textuales.
  await page.getByTestId('menu-ancla').click();
  const menu = page.getByTestId('menu');
  await menu.getByTestId('menu-carnet').click();
  await menu.getByTestId('carnet-crear').click();
  for (const q of CARNET_QUESTIONS) {
    await expect(menu.getByText(q.prompt, { exact: true })).toBeVisible();
  }
  await menu.getByTestId('carnet-apodo-input').fill(nickname);
  for (const a of answers) await menu.getByTestId(`carnet-pregunta-${a.q.id}`).fill(a.text);
  await menu.getByTestId('carnet-guardar').click();

  // Se ve como lo ven los demás.
  const mine = menu.getByTestId('carnet-mio');
  await expect(mine.getByTestId('carnet-apodo')).toHaveText(nickname);
  await expect(mine.getByText('Miembro de BOIA desde', { exact: false })).toBeVisible();
  for (const a of answers) {
    await expect(mine.getByText(a.q.prompt, { exact: true })).toBeVisible();
    await expect(mine.getByText(a.text, { exact: true })).toBeVisible();
  }
  await expect(menu.getByTestId('carnet-editar')).toBeVisible();
  // Versión de prueba: se dice que todo queda en este navegador (REQ-IDE-051).
  await expect(mine.getByTestId('carnet-aviso-local')).toContainText('este navegador');

  // Echa su botella junto al barco.
  await mine.getByRole('button', { name: 'Echar una botella' }).click();
  const sheet = page.getByTestId('botella');
  await expect(sheet.getByTestId('botella-aviso-local')).toContainText('sólo la ves tú');
  await sheet.getByTestId('botella-texto').fill(message);
  await sheet.getByTestId('botella-echar').click();
  await expect(sheet).toBeHidden();
  await expect(nearby(page).filter({ hasText: 'Tu botella' })).toBeVisible({ timeout: 10_000 });

  // Recarga: el barco sigue donde estaba (T44) y la botella sigue en el mar, a su lado.
  await page.reload();
  await gameRunning(page);
  const own = nearby(page).filter({ hasText: 'Tu botella' });
  await expect(own).toBeVisible({ timeout: 10_000 });
  await own.click();
  await expect(page.getByTestId('botella-mensaje')).toHaveText(message);
  await page.getByTestId('botella').getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByTestId('botella')).toBeHidden();

  // Una botella de muestra flota cerca de la salida: se lee y se abre el Carnet de su autor.
  const seeded = nearby(page).filter({ hasText: /^🍾 Botella de / });
  await expect(seeded).toBeVisible();
  const author = (await seeded.textContent())!.replace(/^🍾 Botella de /, '').trim();
  await seeded.click();
  const read = page.getByTestId('botella-leida');
  await expect(read).toBeVisible();
  await expect(read.getByText(`Botella de ${author}`)).toBeVisible();
  await read.getByTestId('botella-ver-carnet').click();
  const other = page.getByTestId('carnet-ajeno');
  await expect(other.getByTestId('carnet-apodo')).toHaveText(author);
  await expect(other.getByTestId('carnet-respuestas')).toBeVisible();
  await other.getByRole('button', { name: 'Cerrar' }).click();
  await page.getByTestId('botella').getByRole('button', { name: 'Cerrar' }).click();

  // Leerla no la quita: sigue en el mar (ya leída).
  await expect(seeded).toBeVisible();
  await expect(seeded).toHaveClass(/is-read/);

  // El Carnet a pantalla completa es el mismo.
  await page.goto('/carnet');
  const pagina = page.getByTestId('carnet-pagina');
  await expect(pagina.getByTestId('carnet-apodo')).toHaveText(nickname);
  await expect(pagina.getByTestId('carnet-aviso-local')).toContainText('este navegador');
});

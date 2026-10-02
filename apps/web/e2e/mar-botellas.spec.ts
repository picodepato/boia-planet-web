import { BOTTLE_MESSAGE_MAX } from '@boia/contracts';
import { SAMPLE_BOTTLES, SAMPLE_CREW } from '@boia/store';
import { expect, test, type Page } from '@playwright/test';
import { SAMPLE_CIRCUIT_MS } from '../lib/mundo/ranking-circuit';
import { t } from '../lib/i18n';

/**
 * Botellas y Ranking en el mar 3D (T56, REQ-IDE-040…044, REQ-IDE-053): las
 * botellas de muestra flotan en el mar; con un Carnet (creado ahí mismo) se
 * echa una de hasta 140 caracteres, que sigue junto al barco al recargar
 * (sólo la ve quien la escribió: todo vive en este navegador, D-20); y el
 * ranking local se abre desde el Menú con sus tres pestañas.
 */

test.describe.configure({ timeout: 120_000 });

async function openMar(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/mar');
  await expect(page.getByTestId('mar-canvas')).toBeVisible();
  await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 30_000 });
  return errors;
}

/** Ids de las botellas que el motor tiene en el agua. */
async function bottlesInSea(page: Page): Promise<string[]> {
  const v = await page.getByTestId('mar-canvas').getAttribute('data-bottles');
  return (v ?? '').split(' ').filter(Boolean);
}

async function openMenuEntry(page: Page, testId: string) {
  await page.getByTestId('mar-logros').click();
  await page.getByTestId('mar-menu').getByTestId(testId).click();
}

const nearby = (page: Page) => page.locator('[data-testid^="mar-botella-cerca-"]');

test('botellas: las de muestra flotan; con Carnet se echa una de 140 y sigue al recargar', async ({
  page,
}, info) => {
  const errors = await openMar(page);

  // Las de muestra flotan en el mar y una se encuentra nada más zarpar.
  await expect
    .poll(() => bottlesInSea(page), { timeout: 10_000 })
    .toEqual(expect.arrayContaining(SAMPLE_BOTTLES.map((b) => b.id)));
  const seeded = page.locator('[data-testid^="mar-botella-cerca-botella-muestra-"]').first();
  await expect(seeded).toBeVisible({ timeout: 10_000 });
  const seededId = (await seeded.getAttribute('data-testid'))!.replace('mar-botella-cerca-', '');
  const sample = SAMPLE_BOTTLES.find((b) => b.id === seededId)!;
  const author = SAMPLE_CREW.find((c) => c.userId === sample.userId)!;
  await expect(seeded).toHaveText(t('mar.botella.deCerca', { name: author.nickname }));
  await seeded.click();
  const panel = page.getByTestId('mar-botella');
  await expect(panel.getByTestId('botella-leida')).toBeVisible();
  await expect(panel.getByTestId('botella-mensaje')).toHaveText(sample.message);
  await panel.getByTestId('mar-botella-cerrar').click();
  await expect(panel).toBeHidden();

  // Mi botella: sin Carnet no se puede; «Crear mi Carnet» lleva a Mi Carnet
  // dentro del mundo (T55) y, creado, de vuelta a la botella sin salir del mar.
  await openMenuEntry(page, 'mar-mi-botella');
  await expect(panel.getByTestId('botella-sin-carnet')).toBeVisible();
  await panel.getByTestId('botella-sin-carnet').getByRole('button').click();
  const carnet = page.getByTestId('mar-carnet');
  await expect(panel).toBeHidden();
  await carnet.getByTestId('carnet-crear').click();
  await carnet.getByTestId('carnet-apodo-input').fill(`Marinera ${info.project.name}`);
  await carnet.getByTestId('carnet-guardar').click();
  await expect(carnet.getByTestId('carnet-mio')).toBeVisible();
  await carnet.getByRole('button', { name: t('juego.carnet.echarUnaBotella') }).click();
  await expect(carnet).toBeHidden();
  await expect(page).toHaveURL(/\/mar/);

  // 140 caracteres como mucho.
  const text = panel.getByTestId('botella-texto');
  await expect(text).toBeVisible();
  const message =
    `Botella de prueba desde el mar 3D (${info.project.name}): nos vemos en el All Day. `
      .padEnd(BOTTLE_MESSAGE_MAX + 10, 'o')
      .slice(0, BOTTLE_MESSAGE_MAX);
  await text.fill(`${message}!`);
  await expect(panel.getByTestId('botella-echar')).toBeDisabled();
  await text.fill(message);
  await expect(panel.getByTestId('botella-echar')).toBeEnabled();
  await panel.getByTestId('botella-echar').click();
  await expect(panel).toBeHidden();

  // Flota junto al barco: «Tu botella».
  const own = nearby(page).filter({ hasText: t('mar.botella.tuyaCerca') });
  await expect(own).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => bottlesInSea(page)).toHaveLength(SAMPLE_BOTTLES.length + 1);
  const ownId = (await own.getAttribute('data-testid'))!.replace('mar-botella-cerca-', '');

  // Recarga: el barco sigue donde estaba y la botella también, para quien la escribió.
  await page.reload();
  await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 30_000 });
  await expect.poll(() => bottlesInSea(page), { timeout: 10_000 }).toContain(ownId);
  const again = page.getByTestId(`mar-botella-cerca-${ownId}`);
  await expect(again).toBeVisible({ timeout: 10_000 });
  await again.click();
  await expect(panel.getByTestId('botella-mensaje')).toHaveText(message);
  await panel.getByTestId('mar-botella-cerrar').click();

  // En el Menú, «Mi botella» ya es la suya: editarla o retirarla.
  await openMenuEntry(page, 'mar-mi-botella');
  await expect(panel.getByTestId('botella-mia')).toBeVisible();
  await expect(panel.getByTestId('botella-mensaje')).toHaveText(message);
  await panel.getByTestId('mar-botella-cerrar').click();

  // Mi Carnet (T55) la enseña y lleva a ella: «Editar o retirar».
  await page.getByTestId('mar-enlace-carnet').click();
  const carnetSheet = page.getByTestId('mar-carnet');
  await expect(carnetSheet.getByTestId('carnet-botella')).toContainText(message);
  await carnetSheet.getByRole('button', { name: t('juego.carnet.editarORetirar') }).click();
  await expect(carnetSheet).toBeHidden();
  await expect(panel.getByTestId('botella-mia')).toBeVisible();
  expect(errors).toEqual([]);
});

test('ranking: se abre desde el Menú con De siempre, Temporada y Circuito y los miembros de muestra', async ({
  page,
}) => {
  const errors = await openMar(page);
  await openMenuEntry(page, 'mar-ranking-abrir');
  const panel = page.getByTestId('mar-ranking');
  const ranking = panel.getByTestId('ranking');
  await expect(ranking.getByTestId('ranking-rotulo')).toHaveText(t('ranking.localLabel'));
  const tabs = {
    siempre: ranking.getByTestId('ranking-tab-siempre'),
    temporada: ranking.getByTestId('ranking-tab-temporada'),
    circuito: ranking.getByTestId('ranking-tab-circuito'),
  };
  await expect(tabs.siempre).toHaveText(t('ranking.tab.allTime'));
  await expect(tabs.temporada).toContainText(t('ranking.tab.season', { world: '' }).trim());
  await expect(tabs.circuito).toHaveText(t('ranking.tab.circuit'));
  const rows = ranking.getByTestId('ranking-lista').locator('tbody tr');

  // De siempre: el visitante entre todos los miembros de muestra.
  await expect(tabs.siempre).toHaveAttribute('aria-pressed', 'true');
  await expect(rows).toHaveCount(SAMPLE_CREW.length + 1);
  for (const c of SAMPLE_CREW) {
    await expect(ranking.getByTestId(`ranking-fila-${c.userId}`)).toContainText(c.nickname);
  }
  await expect(ranking.getByTestId('ranking-fila-mia')).toHaveAttribute('aria-current', 'true');

  // Temporada: el mundo que se juega.
  await tabs.temporada.click();
  await expect(tabs.temporada).toHaveAttribute('aria-pressed', 'true');
  await expect(ranking.getByTestId('ranking-lista')).toHaveAttribute('data-scope', 'season');
  await expect(ranking.getByTestId('ranking-fila-mia')).toBeVisible();

  // Circuito: los tiempos de muestra y el visitante, sin vuelta todavía, al final.
  await tabs.circuito.click();
  await expect(tabs.circuito).toHaveAttribute('aria-pressed', 'true');
  await expect(ranking.getByTestId('ranking-lista')).toHaveAttribute('data-scope', 'circuit');
  const timed = SAMPLE_CREW.filter((c) => SAMPLE_CIRCUIT_MS[c.userId] !== undefined);
  await expect(rows).toHaveCount(timed.length + 1);
  for (const c of timed) {
    await expect(ranking.getByTestId(`ranking-fila-${c.userId}`)).toContainText(c.nickname);
  }
  await expect(rows.last()).toHaveAttribute('data-testid', 'ranking-fila-mia');
  await expect(rows.last()).toContainText(t('lib.ranking.sinVuelta'));

  // La fila propia abre Mi Carnet dentro del mundo (T55), sin salir del mar.
  await ranking.getByTestId('ranking-fila-mia').getByRole('link').click();
  await expect(panel).toBeHidden();
  await expect(page.getByTestId('mar-carnet')).toBeVisible();
  await expect(page).toHaveURL(/\/mar/);
  expect(errors).toEqual([]);
});

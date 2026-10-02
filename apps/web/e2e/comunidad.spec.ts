import { SAMPLE_CREW } from '@boia/store';
import { INFO_BOIES, WORLD_REGISTRY } from '@boia/world';
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * T45 en el navegador, sin servidor (D-20): el ranking local enseña al
 * visitante entre los miembros de muestra (REQ-IDE-053); un Carnet público se
 * reporta y el Admin lo modera (REQ-ADM-040, O9); una boia informativa habla
 * y cuenta «n de 6» (O12); y una isla ya visitada ofrece «Explorar la isla»
 * (REQ-AVE-013). Los datos salen de la muestra y del mapa, nada a mano.
 *
 * Con RECORD_T45=1 deja en docs/informes/img/ p004-t45-ranking.png y
 * p004-t45-boia-info.png (sólo en el proyecto móvil).
 */

test.describe.configure({ timeout: 120_000 });

const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../docs/informes/img',
);
const recording = () => test.info().project.name === 'mobile' && !!process.env.RECORD_T45;

async function snap(page: Page, name: string) {
  if (!recording()) return;
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, name) });
}

const world = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId);
const member = [...SAMPLE_CREW].sort((a, b) => b.showcase.points - a.showcase.points)[0]!;
const answered = SAMPLE_CREW.find((c) => Object.keys(c.answers).length > 0)!;
const [questionId, answer] = Object.entries(answered.answers)[0]!;

async function sailFrom(page: Page, near: string) {
  await page.goto(`/juego?cerca=${near}`);
  await expect(page.getByTestId('juego')).toHaveAttribute('data-barco', /\d/, { timeout: 30_000 });
  await page
    .locator('canvas:visible')
    .first()
    .focus()
    .catch(() => {});
}

async function sailNorthUntil(page: Page, until: () => Promise<void>) {
  await page.keyboard.down('ArrowUp');
  try {
    await until();
  } finally {
    await page.keyboard.up('ArrowUp');
  }
}

test('el ranking local enseña al visitante entre los miembros de muestra', async ({ page }) => {
  await page.goto('/juego?menu=ranking');
  const menu = page.getByTestId('menu');
  const ranking = menu.getByTestId('ranking');
  await expect(ranking.getByTestId('ranking-rotulo')).toHaveText('Ranking local de este navegador');
  const mine = ranking.getByTestId('ranking-fila-mia');
  await expect(mine).toBeVisible();
  await expect(mine).toHaveAttribute('aria-current', 'true');
  await expect(mine).toContainText('Tú');
  const rows = ranking.getByTestId('ranking-lista').locator('tbody tr');
  await expect(rows).toHaveCount(SAMPLE_CREW.length + 1);
  // El miembro con más puntos va primero; el visitante sin puntos, al final.
  await expect(rows.first()).toContainText(member.nickname);
  await expect(mine).toHaveAttribute('data-puesto', String(SAMPLE_CREW.length + 1));
  await expect(ranking.getByTestId('ranking-mi-puesto')).toHaveText(
    `Vas ${SAMPLE_CREW.length + 1}.º con 0 puntos.`,
  );
  await page.waitForTimeout(300);
  await snap(page, 'p004-t45-ranking.png');

  // La temporada es el mundo que se juega.
  await ranking.getByTestId('ranking-tab-temporada').click();
  await expect(ranking.getByTestId('ranking-tab-temporada')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(ranking.getByTestId('ranking-tab-temporada')).toContainText(world.theme.name);
  await expect(ranking.getByTestId('ranking-fila-mia')).toBeVisible();

  // Cada fila abre su Carnet.
  await ranking.getByTestId(`ranking-fila-${member.userId}`).getByRole('link').click();
  await expect(page).toHaveURL(new RegExp(`/carnet/${member.userId}`));
  await expect(page.getByTestId('carnet-apodo')).toHaveText(member.nickname);
});

test('reportar un Carnet y ocultar su respuesta desde el Admin', async ({ page }) => {
  await page.goto(`/carnet/${answered.userId}`);
  const card = page.getByTestId('carnet');
  await expect(card.getByText(answer, { exact: true })).toBeVisible();
  await page.getByTestId('carnet-reportar').click();
  await page.getByTestId('carnet-reporte-motivo').fill('Respuesta ofensiva (e2e)');
  await page.getByTestId('carnet-reporte-enviar').click();
  await expect(page.getByTestId('carnet-reporte-hecho')).toHaveText(
    'Gracias. El equipo de BOIA lo revisará.',
  );

  // Moderación: el Carnet reportado, con su motivo; se oculta la respuesta.
  await page.goto('/admin#moderacion');
  const row = page.getByTestId(`carnet-reportado-${answered.userId}`);
  await expect(row).toBeVisible();
  await expect(row).toHaveAttribute('data-abiertos', '1');
  await expect(row).toContainText('Respuesta ofensiva (e2e)');
  await row.getByTestId(`carnet-ocultar-${answered.userId}-${questionId}`).click();
  const done = page.getByTestId(`carnet-reportado-${answered.userId}`);
  await expect(done).toHaveAttribute('data-abiertos', '0');
  await expect(done).toContainText('respuesta retirada');

  // Queda en la auditoría.
  await page.getByTestId('admin-nav-auditoria').click();
  await expect(page.getByTestId('admin-seccion-auditoria')).toContainText('Moderación de Carnets');

  // El Carnet sigue, sin esa respuesta.
  await page.goto(`/carnet/${answered.userId}`);
  await expect(card.getByText('Respuesta retirada por moderación.')).toBeVisible();
  await expect(card.getByText(answer, { exact: true })).toBeHidden();
  await expect(page.getByTestId('carnet-apodo')).toHaveText(answered.nickname);
});

test('una boia informativa habla y cuenta para las seis', async ({ page }) => {
  const boia = INFO_BOIES[0]!;
  await sailFrom(page, boia.id);
  const notice = page.getByTestId('aviso').filter({ hasText: 'Boia encontrada' });
  await sailNorthUntil(page, () =>
    expect(page.getByTestId('bocadillo-cerrar')).toBeAttached({ timeout: 20_000 }),
  );
  await expect(notice).toContainText('de 6', { timeout: 10_000 });
  if (recording()) {
    // Para la foto: un poco atrás, así el barco no tapa la boia.
    await page.keyboard.down('ArrowDown');
    await page.waitForTimeout(900);
    await page.keyboard.up('ArrowDown');
    await page.waitForTimeout(700);
  }
  await snap(page, 'p004-t45-boia-info.png');
});

test('una isla ya visitada ofrece «Explorar la isla»', async ({ page }) => {
  const island = world.config.objects.find(
    (o) =>
      o.identity.category === 'isla' &&
      o.behaviors.some((b) => b.type === 'content' && b.params.target === 'info'),
  )!;
  await sailFrom(page, island.identity.id);
  const panel = page.getByTestId('panel-isla');
  await sailNorthUntil(page, () => expect(panel).toBeVisible({ timeout: 20_000 }));
  await expect(panel).toHaveAttribute('data-visita', 'primera');
  await expect(panel.getByTestId('isla-explorar')).toHaveCount(0);

  // Otra visita: el panel sale recogido con el acceso directo.
  await sailFrom(page, island.identity.id);
  await sailNorthUntil(page, () => expect(panel).toBeVisible({ timeout: 20_000 }));
  await expect(panel).toHaveAttribute('data-visita', 'otra');
  await panel.getByTestId('isla-explorar').click();
  await expect(panel.getByTestId('isla-explorar')).toHaveCount(0);
  await expect(panel.getByTestId('ver-fotos-isla')).toBeVisible();
});

import { SAMPLE_ACHIEVEMENTS } from '@boia/store';
import { WORLD_REGISTRY } from '@boia/world';
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACHIEVEMENT_READY_BODY } from '../lib/mundo/achievements';
import { REWARD_MS } from '../lib/logros/model';

/**
 * Logros que se reclaman (T37, D-22 punto 5), en el mar 3D: al
 * completar uno sale el aviso «¡Logro completado! Reclama tu premio» y el
 * icono de logros lleva un número; en el panel, «Reclamar» sube el saldo una
 * sola vez y, tras recargar, sigue reclamado. En /mar el icono no pisa ni el
 * minimapa ni «Entradas». Móvil y escritorio.
 *
 * Con LOGROS_SHOTS=1 guarda además las capturas del informe a 390×844 en
 * docs/informes/img/ (p003-t37-*.png).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.resolve(HERE, '../../../docs/informes/img');

const world = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config;
// La boia del tutorial: al llegar habla y cuenta para «Primera boia».
const talkingBoia = world.objects.find(
  (o) =>
    o.identity.category === 'boia' &&
    o.behaviors.some((b) => b.type === 'dialogue') &&
    o.behaviors.some((b) => b.type === 'achievement'),
)!;
const firstBuoy = SAMPLE_ACHIEVEMENTS.find(
  (a) => a.trigger === 'find_buoy' && (a.triggerParams as { count?: number }).count === 1,
)!;

async function openMar(page: Page, query = '') {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`/mar${query}`);
  await expect(page.getByTestId('mar-canvas')).toBeVisible();
  await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 30_000 });
  return errors;
}

/** Rumbo norte hasta que salga el aviso del logro. */
async function sailUntilAchievement(page: Page, notice: Locator) {
  await page.keyboard.down('ArrowUp');
  try {
    await expect(notice).toContainText(ACHIEVEMENT_READY_BODY, { timeout: 20_000 });
  } finally {
    await page.keyboard.up('ArrowUp');
  }
}

const apart = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;

async function expectOnTop(el: Locator) {
  await expect(el).toBeInViewport({ ratio: 1 });
  const onTop = await el.evaluate((node) => {
    const r = node.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && node.contains(hit);
  });
  expect(onTop, 'nada tapa el icono').toBe(true);
}

/** El icono de logros de /mar no pisa el minimapa ni «Entradas», y nada lo tapa. */
async function expectIconClear(page: Page) {
  const icon = (await page.getByTestId('mar-logros').boundingBox())!;
  const map = (await page.getByTestId('mar-minimapa').boundingBox())!;
  const tickets = (await page.getByTestId('mar-entradas').boundingBox())!;
  expect(apart(icon, map), 'el icono y el minimapa no se pisan').toBe(true);
  expect(apart(icon, tickets), 'el icono y «Entradas» no se pisan').toBe(true);
  await expectOnTop(page.getByTestId('mar-logros'));
}

async function shot(page: Page, info: TestInfo, name: string) {
  if (!process.env.LOGROS_SHOTS || info.project.name !== 'mobile') return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `p003-t37-${name}.png`) });
}

async function claimOnce(page: Page, panel: Locator, points: () => Promise<number>) {
  const row = panel.getByTestId(`logro-${firstBuoy.id}`);
  await expect(row).toHaveAttribute('data-estado', 'ready');
  await expect(row).toContainText(firstBuoy.title);
  const before = await points();
  const claim = panel.getByTestId(`logro-reclamar-${firstBuoy.id}`);
  await claim.click();
  // La animación del premio: los puntos suben contando hasta el premio.
  const reward = page.getByTestId('logro-premio');
  await expect(reward).toBeVisible();
  await expect(reward.getByTestId('logro-premio-puntos')).toHaveText(`+${firstBuoy.points} ★`);
  await expect.poll(points).toBe(before + firstBuoy.points);
  await expect(row).toHaveAttribute('data-estado', 'claimed');
  await expect(claim).toHaveCount(0);
  await expect(reward).toHaveCount(0, { timeout: 6000 });
  // Una sola vez: pasado un rato, el saldo sigue igual.
  await page.waitForTimeout(500);
  expect(await points()).toBe(before + firstBuoy.points);
  return before + firstBuoy.points;
}

test.describe.configure({ timeout: 120_000 });

test('/mar: el icono de logros no pisa el minimapa ni «Entradas»', async ({ page }) => {
  const errors = await openMar(page);
  await expectIconClear(page);
  await expect(page.getByTestId('mar-logros-contador')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test.describe('/mar en un móvil de 390×844', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('el icono de logros tampoco pisa nada', async ({ page }) => {
    const errors = await openMar(page);
    await expectIconClear(page);
    expect(errors).toEqual([]);
  });
});

test('/mar: completar un logro, su número en el icono, «Reclamar» una vez y recargar', async ({
  page,
}) => {
  const errors = await openMar(page, `?cerca=${talkingBoia.identity.id}`);
  const icon = page.getByTestId('mar-logros');
  const badge = page.getByTestId('mar-logros-contador');
  await expect(badge).toHaveCount(0);

  const notice = page.locator('[data-testid="mar-aviso"][data-kind="achievement"]');
  await sailUntilAchievement(page, notice);
  await expect(notice).toContainText(firstBuoy.title);
  await expect(badge).toBeVisible();
  const ready = Number(await icon.getAttribute('data-por-reclamar'));
  expect(ready).toBeGreaterThanOrEqual(1);
  await expect(badge).toHaveText(String(ready));
  await expect(icon).toHaveAttribute('aria-label', /por reclamar/);

  // Tocar el aviso lleva al panel; si se va antes (dura su tiempo de lectura), el icono.
  const viaNotice = await notice.click({ timeout: 3000 }).then(
    () => true,
    () => false,
  );
  if (!viaNotice) await icon.click();
  const panel = page.getByTestId('mar-logros-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId('logros-cabecera')).toContainText(
    `${ready} de ${SAMPLE_ACHIEVEMENTS.length} logros`,
  );
  const points = async () =>
    Number(await panel.getByTestId('logros-puntos').getAttribute('data-value'));
  const after = await claimOnce(page, panel, points);
  await expect(icon).toHaveAttribute('data-por-reclamar', String(ready - 1));
  if (ready === 1) await expect(badge).toHaveCount(0);

  // Cerrar y recargar: sigue reclamado, sin nada que reclamar de ese logro.
  await page.getByTestId('mar-logros-cerrar').click();
  await expect(panel).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 30_000 });
  await icon.click();
  await expect(panel.getByTestId(`logro-${firstBuoy.id}`)).toHaveAttribute(
    'data-estado',
    'claimed',
  );
  await expect(panel.getByTestId(`logro-reclamar-${firstBuoy.id}`)).toHaveCount(0);
  expect(await points()).toBe(after);
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  expect(errors).toEqual([]);
});

test.describe('capturas del informe (390×844)', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('la animación de «Reclamar» en /mar', async ({ page }, info) => {
    test.skip(!process.env.LOGROS_SHOTS || info.project.name !== 'mobile', 'sólo con LOGROS_SHOTS');
    await openMar(page, `?cerca=${talkingBoia.identity.id}`);
    await sailUntilAchievement(
      page,
      page.locator('[data-testid="mar-aviso"][data-kind="achievement"]'),
    );
    await shot(page, info, 'aviso-mar');
    await page.getByTestId('mar-logros').click();
    const panel = page.getByTestId('mar-logros-panel');
    await shot(page, info, 'logros-mar');
    // Una captura del mar en 3D tarda más que la animación en la máquina de
    // pruebas: sólo aquí, el cierre solo del premio espera más.
    await page.evaluate((ms) => {
      const original = window.setTimeout.bind(window);
      window.setTimeout = ((fn: TimerHandler, delay?: number, ...rest: unknown[]) =>
        original(fn, delay === ms ? ms * 20 : delay, ...rest)) as typeof window.setTimeout;
    }, REWARD_MS);
    await panel.getByTestId(`logro-reclamar-${firstBuoy.id}`).click();
    await expect(page.getByTestId('logro-premio')).toBeVisible();
    await page.waitForTimeout(700);
    await shot(page, info, 'reclamar');
  });
});

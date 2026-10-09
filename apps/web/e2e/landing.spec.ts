import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { ONLINE_EVENT } from './online-event';
import { PAST_INTRO } from './hero-helpers';

/**
 * Chunks JS que sólo usa el juego (el mar 3D, /mar) y no la landing, sacados del
 * manifiesto del build que acaba de levantar el webServer.
 */
function gameOnlyChunks(): string[] {
  const manifest = JSON.parse(
    readFileSync(new URL('../.next/app-build-manifest.json', import.meta.url), 'utf8'),
  ) as { pages: Record<string, string[]> };
  const landing = new Set(
    Object.entries(manifest.pages)
      .filter(([route]) => route.startsWith('/(landing)/') || route === '/layout')
      .flatMap(([, files]) => files),
  );
  return (manifest.pages['/mar/page'] ?? []).filter((f) => !landing.has(f));
}

async function captured(
  page: Page,
): Promise<Array<{ event: string; properties: Record<string, unknown> }>> {
  return page.evaluate(() => window.__boiaAnalytics ?? []);
}

// Estas pruebas son de la landing, no de la entrada (esa está en intro.spec.ts):
// se abre con un parámetro, que entra directo sin cinemática (D-21).
const LANDING = '/?intro=0';

const hero = (page: Page) => page.locator('.hero');
// El botón del hero: sólo «Zarpar» (/mar); «Entradas» está en la cabecera
// (decisión 4 de 2026-10-08), que sale al dejar el hero.
const exploreCta = (page: Page) => hero(page).getByTestId('cta-3d');
const headerTickets = (page: Page) =>
  page.locator('.site-header').getByRole('link', { name: 'Entradas', exact: true });
async function openFromHeader(page: Page) {
  // Past the hero and the presentation: the header is in (plan 022 T238).
  await page.evaluate(
    (screens) => window.scrollTo({ top: innerHeight * screens, behavior: 'instant' }),
    PAST_INTRO,
  );
  await expect(page.locator('.site-header__inner')).toBeVisible();
  // The header is fixed: clicking it scrolls nothing; Playwright waits for its slide-in.
  await headerTickets(page).click();
}
const ticketsPanel = (page: Page) => page.getByRole('dialog', { name: 'Elige tu evento' });

test('el hero lleva sólo «Zarpar», sin scroll; sin «Entradas» (decisión 4)', async ({
  page,
}, info) => {
  await page.goto(LANDING);
  const vp = page.viewportSize()!;
  if (info.project.name === 'mobile') expect(vp).toEqual({ width: 360, height: 640 });

  const el = exploreCta(page);
  await expect(el).toBeVisible();
  const box = (await el.boundingBox())!;
  expect(box.y, 'Zarpar empieza dentro de la pantalla').toBeGreaterThanOrEqual(0);
  expect(box.y + box.height, 'Zarpar acaba sobre el pliegue').toBeLessThanOrEqual(vp.height);
  expect(box.height, 'Zarpar alto mínimo').toBeGreaterThanOrEqual(56);
  // D-07: centred in the hero.
  expect(Math.abs(box.x + box.width / 2 - vp.width / 2)).toBeLessThanOrEqual(2);
  await expect(hero(page).getByRole('link', { name: 'Entradas', exact: true })).toHaveCount(0);
  await expect(hero(page).locator('[data-tickets-open]')).toHaveCount(0);

  // La vista de la landing cuenta al pasar el hero con el scroll (plan 007).
  expect((await captured(page)).map((e) => e.event)).not.toContain('landing_view');
  await page.evaluate(() => window.scrollTo({ top: innerHeight * 1.2, behavior: 'instant' }));
  await expect
    .poll(async () => (await captured(page)).filter((e) => e.event === 'landing_view'))
    .toEqual([expect.objectContaining({ properties: expect.objectContaining({ intro: 'none' }) })]);
});

test('Consigue descuentos aparece justo debajo de Zarpar y queda estático con movimiento reducido', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(LANDING);
  const zarpar = hero(page).getByRole('link', { name: 'Zarpar', exact: true });
  const discount = hero(page).locator('.hero__discount-hint');
  await expect(zarpar).toBeVisible();
  await expect(discount).toHaveText('Consigue descuentos');
  // Decision 4: in yellow (the --yellow token of landing.css).
  const yellow = /--yellow:\s*(#[0-9a-f]{6})/i.exec(
    readFileSync(new URL('../app/(landing)/landing.css', import.meta.url), 'utf8'),
  )![1]!;
  const rgb = [1, 3, 5].map((i) => parseInt(yellow.slice(i, i + 2), 16)).join(', ');
  await expect(discount).toHaveCSS('color', `rgb(${rgb})`);
  await expect(discount).toBeVisible();
  await expect(discount).toBeInViewport();
  await expect(zarpar.locator('xpath=following-sibling::p[1]')).toHaveText('Consigue descuentos');
  const buttonBox = (await zarpar.boundingBox())!;
  const lineBox = (await discount.boundingBox())!;
  const scrollHintBox = (await hero(page).locator('.hero__hint').boundingBox())!;
  expect(lineBox.y + lineBox.height).toBeLessThan(scrollHintBox.y);
  const gap = lineBox.y - (buttonBox.y + buttonBox.height);
  expect(gap).toBeGreaterThanOrEqual(4);
  expect(gap).toBeLessThanOrEqual(12);
  expect(
    Math.abs(lineBox.x + lineBox.width / 2 - (buttonBox.x + buttonBox.width / 2)),
  ).toBeLessThanOrEqual(1);
  await expect(discount).toHaveCSS('animation-name', 'none');
  await expect(discount).toHaveCSS('background-image', 'none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(discount).toHaveCSS('animation-name', 'hero-discount-glint');
});

test('el panel de Tickets abre sin WebGL y con el bundle del juego bloqueado', async ({ page }) => {
  // La compra de prueba (T25) carga al pulsar el checkout y el repositorio,
  // que el juego también usa: esos chunks son compartidos, no del juego. Se
  // averiguan comprando una vez en otra pestaña, sin bloquear nada.
  const probe = await page.context().newPage();
  const loadedByBuy = new Set<string>();
  probe.on('request', (r) => loadedByBuy.add(new URL(r.url()).pathname));
  await probe.goto(LANDING);
  await openFromHeader(probe);
  await ticketsPanel(probe).getByTestId(`comprar-${ONLINE_EVENT.id}`).click();
  // Sin Carnet, la compra lo pide (plan 019).
  await expect(probe.getByTestId('checkout-carnet-requerido')).toBeVisible({ timeout: 20_000 });
  await probe.close();

  const gameChunks = gameOnlyChunks().filter((c) => !loadedByBuy.has(`/_next/${c}`));
  expect(gameChunks.length, 'el build tiene chunks propios del juego').toBeGreaterThan(0);
  expect(gameChunks.some((c) => c.includes('app/mar/page'))).toBe(true);

  // Sin WebGL.
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (/webgl/i.test(type)) return null;
      return (original as (...a: unknown[]) => unknown).call(this, type, ...rest);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });

  // Bundle del juego y su ruta, bloqueados. El arte (/api/art) no: la landing
  // lo usa para la ilustración ligera del hero (T03).
  const blocked: string[] = [];
  await page.route(
    (url) =>
      gameChunks.some((c) => url.pathname.endsWith(c.replace(/^static\//, ''))) ||
      url.pathname.startsWith('/mar'),
    (route) => {
      blocked.push(route.request().url());
      return route.abort('blockedbyclient');
    },
  );
  // La ticketera de muestra no sale a internet.
  await page
    .context()
    .route('https://example.com/**', (r) =>
      r.fulfill({ contentType: 'text/html', body: '<title>sandbox</title>' }),
    );

  await page.goto(LANDING);
  await openFromHeader(page);

  const panel = ticketsPanel(page);
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'Elige tu evento' })).toBeFocused();
  // El evento con checkout online (Halloween y SONIDO van a taquilla, T199).
  const buy = panel.getByTestId(`comprar-${ONLINE_EVENT.id}`);
  await expect(buy).toBeVisible();
  expect(new URL(page.url()).hash).toBe('#tickets');

  // Comprar abre aquí la compra de prueba (D-20), sin el juego, y queda medido.
  await buy.click();
  const checkout = page.getByTestId('checkout');
  // Sin Carnet, la compra lo pide (plan 019), también sin el juego.
  await expect(checkout.getByTestId('checkout-carnet-requerido')).toBeVisible({ timeout: 20_000 });
  await expect(checkout.getByTestId('checkout-prueba')).toBeVisible();
  // Escape cierra sólo el checkout: el panel sigue abierto.
  await page.keyboard.press('Escape');
  await expect(checkout).toBeHidden();
  await expect(panel).toBeVisible();

  const names = (await captured(page)).map((e) => e.event);
  expect(names).toEqual(expect.arrayContaining(['tickets_panel_open', 'ticket_click_out']));
  expect(names).not.toContain('purchase_confirmed');

  // Escape cierra, quita el #tickets y devuelve el foco al botón.
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  expect(new URL(page.url()).hash).toBe('');
  await expect(headerTickets(page)).toBeFocused();

  // La landing ni siquiera pidió la ruta del juego.
  expect(blocked.filter((u) => new URL(u).pathname.startsWith('/mar'))).toEqual([]);
});

test('el enlace /#tickets abre el panel directamente', async ({ page }) => {
  await page.goto('/#tickets');
  await expect(ticketsPanel(page)).toBeVisible();
  const opened = (await captured(page)).find((e) => e.event === 'tickets_panel_open');
  expect(opened?.properties.source).toBe('deep_link');
  await ticketsPanel(page).getByRole('link', { name: 'Cerrar' }).click();
  await expect(ticketsPanel(page)).toBeHidden();
});

test.describe('sin JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('Tickets sigue abriendo el panel con enlaces de compra', async ({ page }) => {
    await page.goto(LANDING);
    await headerTickets(page).click();
    await expect(ticketsPanel(page)).toBeVisible();
    await expect(
      ticketsPanel(page)
        .getByRole('link', { name: /comprar entradas/i })
        .first(),
    ).toBeVisible();
  });
});

test('axe: sin violaciones en / (y con el panel abierto)', async ({ page }) => {
  await page.goto(LANDING);
  // Deja terminar las animaciones de entrada (fundido de artistas): con la
  // escena del mundo cargando de fondo y las pruebas en paralelo, 600 ms fijos
  // no siempre bastaban. Las animaciones infinitas (pulso del CTA) no cuentan.
  await page.waitForTimeout(600);
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
  );

  // Ninguna violación, de ningún impacto (plan 007 T81; antes sólo serias y críticas).
  const violations = async () => {
    const results = await new AxeBuilder({ page }).analyze();
    return results.violations.map(
      (v) => `${v.impact} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
    );
  };

  expect(await violations()).toEqual([]);

  await openFromHeader(page);
  await expect(ticketsPanel(page)).toBeVisible();
  await page.waitForTimeout(300);
  expect(await violations()).toEqual([]);
});

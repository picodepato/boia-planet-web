import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * Chunks JS que sólo usa el juego (/juego) y no la landing, sacados del
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
  return (manifest.pages['/juego/page'] ?? []).filter((f) => !landing.has(f));
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
// El botón principal del hero: el mundo 3D (/mar), con Tickets al lado (T57).
const exploreCta = (page: Page) => hero(page).getByTestId('cta-3d');
const heroTickets = (page: Page) => hero(page).getByRole('link', { name: 'Tickets', exact: true });
const ticketsPanel = (page: Page) => page.getByRole('dialog', { name: 'Elige tu evento' });

test('CTA Explorar y Tickets se ven sin scroll', async ({ page }, info) => {
  await page.goto(LANDING);
  const vp = page.viewportSize()!;
  if (info.project.name === 'mobile') expect(vp).toEqual({ width: 360, height: 640 });

  for (const [name, el, minHeight] of [
    ['Explorar', exploreCta(page), 56],
    ['Tickets', heroTickets(page), 44],
  ] as const) {
    await expect(el, name).toBeVisible();
    const box = (await el.boundingBox())!;
    expect(box.y, `${name} empieza dentro de la pantalla`).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height, `${name} acaba sobre el pliegue`).toBeLessThanOrEqual(vp.height);
    expect(box.height, `${name} alto mínimo`).toBeGreaterThanOrEqual(minHeight);
  }

  // D-07: ancho completo (menos márgenes) hasta 480 px de viewport.
  if (vp.width <= 480) {
    const box = (await exploreCta(page).boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(vp.width - 2 * 16 - 2);
  }

  const events = await captured(page);
  expect(events.map((e) => e.event)).toContain('landing_view');
});

test('el panel de Tickets abre sin WebGL y con el bundle del juego bloqueado', async ({ page }) => {
  // La compra de prueba (T25) carga al pulsar el checkout y el repositorio,
  // que el juego también usa: esos chunks son compartidos, no del juego. Se
  // averiguan comprando una vez en otra pestaña, sin bloquear nada.
  const probe = await page.context().newPage();
  const loadedByBuy = new Set<string>();
  probe.on('request', (r) => loadedByBuy.add(new URL(r.url()).pathname));
  await probe.goto(LANDING);
  await heroTickets(probe).click();
  await ticketsPanel(probe)
    .getByRole('button', { name: /comprar entradas/i })
    .first()
    .click();
  await expect(probe.getByTestId('checkout-confirmar')).toBeVisible({ timeout: 20_000 });
  await probe.close();

  const gameChunks = gameOnlyChunks().filter((c) => !loadedByBuy.has(`/_next/${c}`));
  expect(gameChunks.length, 'el build tiene chunks propios del juego').toBeGreaterThan(0);
  expect(gameChunks.some((c) => c.includes('app/juego/page'))).toBe(true);

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
      url.pathname.startsWith('/juego'),
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
  await heroTickets(page).click();

  const panel = ticketsPanel(page);
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'Elige tu evento' })).toBeFocused();
  const buy = panel.getByRole('button', { name: /comprar entradas/i }).first();
  await expect(buy).toBeVisible();
  expect(new URL(page.url()).hash).toBe('#tickets');

  // Comprar abre aquí la compra de prueba (D-20), sin el juego, y queda medido.
  await buy.click();
  const checkout = page.getByTestId('checkout');
  await expect(checkout.getByTestId('checkout-confirmar')).toBeVisible({ timeout: 20_000 });
  await expect(checkout.getByTestId('checkout-prueba')).toBeVisible();
  // Escape cierra sólo el checkout: el panel sigue abierto.
  await page.keyboard.press('Escape');
  await expect(checkout).toBeHidden();
  await expect(panel).toBeVisible();

  const names = (await captured(page)).map((e) => e.event);
  expect(names).toEqual(
    expect.arrayContaining(['landing_view', 'tickets_panel_open', 'ticket_click_out']),
  );
  expect(names).not.toContain('purchase_confirmed');

  // Escape cierra, quita el #tickets y devuelve el foco al botón.
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  expect(new URL(page.url()).hash).toBe('');
  await expect(heroTickets(page)).toBeFocused();

  // La landing ni siquiera pidió la ruta del juego.
  expect(blocked.filter((u) => new URL(u).pathname.startsWith('/juego'))).toEqual([]);
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
    await heroTickets(page).click();
    await expect(ticketsPanel(page)).toBeVisible();
    await expect(
      ticketsPanel(page)
        .getByRole('link', { name: /comprar entradas/i })
        .first(),
    ).toBeVisible();
  });
});

test('axe: sin violaciones serias ni críticas en / (y con el panel abierto)', async ({ page }) => {
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

  const serious = async () => {
    const results = await new AxeBuilder({ page }).analyze();
    return results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.impact} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
  };

  expect(await serious()).toEqual([]);

  await heroTickets(page).click();
  await expect(ticketsPanel(page)).toBeVisible();
  await page.waitForTimeout(300);
  expect(await serious()).toEqual([]);
});

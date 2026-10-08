import { DEFAULT_PLANET_INTRO } from '@boia/engine/intro';
import { WORLD_REGISTRY } from '@boia/world';
import { expect, test, type Page, type Route } from '@playwright/test';
import { marWorld } from '../app/mar/engine/compact';
import { ZARPAR_HREF } from '../lib/intro/zarpar';
import { ONLINE_EVENT } from './online-event';
import { createCarnetInCheckout } from './carnet-seed';

/**
 * Entrada 3D con el planeta de /mar (T57, T64; plan 007 T79; D-19, D-21,
 * D-24; REQ-ENT-001…020, ENT 01–03). La entrada depende sólo de la URL (D-21):
 * `/` a secas reproduce la aparición en cada carga completa, también con
 * etiquetas de campaña o de compartir; una URL que apunta a algo concreto
 * nace en reposo, sin aparición. En reposo están «Zarpar» (sólo él desde la
 * decisión 4 de 2026-10-08: «Entradas» va en la cabecera, al dejar el hero) y la
 * pista del scroll (plan 007: sin «Saltar animación» ni avance automático);
 * «Zarpar» se zambulle en el puerto del planeta y acaba en /mar con la
 * bienvenida de la boia abierta (T64). Sin escena (movimiento reducido, sin
 * WebGL, una escena que no llega) se ve la versión estática. El estado se lee
 * de `window.__boiaIntro` (diagnóstico público de la entrada).
 */

/** Las islas del mundo activo de /mar, de la fuente: las mismas que lleva el planeta. */
const marIslands = marWorld(WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config)
  .objects.filter(
    (o) =>
      o.identity.active && (o.identity.category === 'isla' || o.identity.category === 'naufrago'),
  )
  .map((o) => o.identity.id)
  .sort();

type Diag = NonNullable<Window['__boiaIntro']>;

const diag = (page: Page) => page.evaluate(() => window.__boiaIntro ?? null);
const phaseIs = (page: Page, phase: string, timeout = 20_000) =>
  page.waitForFunction((p) => window.__boiaIntro?.phase === p, phase, { timeout });

/** The rest: the page is shown (no `data-intro`). */
async function waitRest(page: Page, timeout = 20_000): Promise<Diag> {
  await phaseIs(page, 'paused', timeout);
  await expect(page.locator('html')).not.toHaveAttribute('data-intro', /.*/);
  return (await diag(page))!;
}

/** The static version: no scene, T78's still (plan 007). */
async function waitStatic(page: Page, timeout = 20_000): Promise<Diag> {
  await page.waitForFunction(() => window.__boiaIntro?.fallback === true, null, { timeout });
  await expect(page.locator('html')).toHaveAttribute('data-hero', 'still');
  await expect(page.locator('.hero__still-img').first()).toBeVisible();
  return waitRest(page);
}

const hero = (page: Page) => page.locator('.hero');
const worldCta = (page: Page) => page.getByTestId('cta-3d');
const headerTickets = (page: Page) =>
  page.locator('.site-header').getByRole('link', { name: 'Entradas', exact: true });
const ticketsPanel = (page: Page) => page.getByRole('dialog', { name: 'Elige tu evento' });
const canvases = (page: Page) => page.locator('.hero__scene canvas');
const title = (page: Page) => page.locator('.hero__wordmark');
const enterButton = (page: Page) => hero(page).getByRole('link', { name: 'Zarpar', exact: true });
const title3d = (page: Page) => page.locator('.intro-title3d');
/** Píxeles con tinta en el canvas del título 3D. */
const titleInk = (page: Page) =>
  title3d(page).evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]! > 0) n++;
    return n;
  });
const titlePose = async (page: Page) => (await diag(page))!.title.pose;
const opacity = (page: Page, sel: string) =>
  page.locator(sel).evaluate((el) => Number(getComputedStyle(el).opacity));

async function landingViews(page: Page) {
  return page.evaluate(() =>
    (window.__boiaAnalytics ?? [])
      .filter((e) => e.event === 'landing_view')
      .map((e) => e.properties.intro),
  );
}

async function exploreSources(page: Page) {
  return page.evaluate(() =>
    (window.__boiaAnalytics ?? [])
      .filter((e) => e.event === 'explore_start')
      .map((e) => e.properties.source),
  );
}

/** Marca la pestaña: si sigue ahí al final, no hubo recarga (navegación de la app). */
const markNoReload = (page: Page) =>
  page.evaluate(() => ((window as Window & { __sinRecarga?: boolean }).__sinRecarga = true));
const noReload = (page: Page) =>
  page.evaluate(() => !!(window as Window & { __sinRecarga?: boolean }).__sinRecarga);

/**
 * Tras «Zarpar» (T64): en /mar, sin pasar por la landing, con la bienvenida
 * de la boia de la entrada abierta y la entrada recogida.
 */
async function inTheGame(page: Page): Promise<Diag> {
  await expect(page).toHaveURL(/\/mar$/, { timeout: 30_000 });
  await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 45_000 });
  const welcome = page.getByTestId('mar-bienvenida');
  await expect(welcome).toBeVisible();
  await expect(welcome.getByTestId('mar-bienvenida-boia')).toBeVisible();
  await expect(page.locator('html')).not.toHaveAttribute('data-intro', /.*/);
  await expect(page.locator('.hero')).toHaveCount(0);
  const d = (await diag(page))!;
  // Llegó zarpando y la entrada se recogió al dejar la landing.
  expect(d.history.slice(-2)).toEqual(['landed', 'destroyed']);
  expect(d.exit).toBe('game');
  expect(d.cover, 'el velo del mar cubría la vista al salir').toBe(1);
  // Se entró a explorar desde la entrada; la landing no se llegó a ver.
  expect(await exploreSources(page)).toEqual(['intro']);
  expect(await landingViews(page)).toEqual([]);
  return d;
}

/** El elemento que recibe un toque en el centro de `el` es `el` o algo suyo (ENT 02). */
async function receivesTaps(page: Page, testId: 'cta-3d') {
  const el = worldCta(page);
  const box = (await el.boundingBox())!;
  const href = await el.getAttribute('href');
  const hit = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.closest('a')?.getAttribute('href') ?? null,
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  );
  expect(hit, `${testId} recibe el toque`).toBe(href);
}

/** El hero tiene un solo botón: «Zarpar» (el mar 3D; decisión 4 de 2026-10-08). */
async function oneHeroButton(page: Page) {
  const actions = hero(page).locator('.hero__actions a');
  await expect(actions).toHaveCount(1);
  expect(await actions.evaluateAll((as) => as.map((a) => a.getAttribute('href')))).toEqual([
    ZARPAR_HREF,
  ]);
  await expect(worldCta(page)).toBeVisible();
  await expect(hero(page).getByRole('link', { name: 'Entradas', exact: true })).toHaveCount(0);
  await expect(hero(page).locator('a[href="/juego"]')).toHaveCount(0);
}

/** Una escena, como mucho un canvas (REQ-ENT-013, 014). */
async function oneScene(page: Page) {
  const d = (await diag(page))!;
  expect(d.scenesCreated).toBe(1);
  expect(d.worldsAlive).toBe(1);
  await expect(canvases(page)).toHaveCount(1);
  return d;
}

/** Sirve los chunks JS; al de la escena (three.js y el planeta) le hace `withScene`. */
async function onSceneChunk(page: Page, withScene: (route: Route, body: string) => Promise<void>) {
  const hits: string[] = [];
  await page.route(/\/_next\/static\/chunks\/.*\.js$/, async (route) => {
    const res = await route.fetch();
    const body = await res.text();
    if (body.includes('boia-intro-scene')) {
      hits.push(route.request().url());
      return withScene(route, body);
    }
    return route.fulfill({ response: res, body });
  });
  return hits;
}

test('`/`: el planeta de /mar, luego «BOIA» y «Zarpar»; al pulsar, se zambulle y entra en /mar con la bienvenida (ENT 01, 02; T64)', async ({
  page,
}, info) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-entry', 'intro');

  // Acto 1: el planeta aparece. Sólo hay una acción, y no es obligatoria.
  await phaseIs(page, 'appearing');
  // Lo que se puede pulsar en pantalla durante la aparición, leído de una vez con la fase.
  const during = await page.evaluate(() => ({
    phase: window.__boiaIntro?.phase,
    actions: [...document.querySelectorAll<HTMLElement>('a, button, input, select')]
      .filter((el) => {
        const s = getComputedStyle(el);
        const b = el.getBoundingClientRect();
        return (
          s.visibility !== 'hidden' &&
          s.display !== 'none' &&
          b.width > 1 &&
          b.height > 1 &&
          b.bottom > 0 &&
          b.top < window.innerHeight
        );
      })
      .map((el) => el.innerText.trim()),
  }));
  expect(during.phase).toBe('appearing');
  expect(during.actions).toEqual(['Zarpar']);
  await expect(canvases(page)).toHaveCount(1);
  await expect(canvases(page)).toHaveAttribute('data-scene', 'boia-intro-scene');

  // Acto 2, el reposo: «BOIA» y el botón, con el foco; no avanza solo.
  await phaseIs(page, 'paused');
  await expect(title(page)).toHaveText('BOIA');
  await expect(enterButton(page)).toBeVisible();
  await expect(enterButton(page)).toBeFocused();
  await expect(page.locator('.hero__hint')).toBeVisible();
  // Título 3D (T27): la hoja llega después del planeta y las letras se mueven solas.
  await expect(title(page)).toHaveAttribute('data-title', '3d', { timeout: 10_000 });
  await page.waitForTimeout(1500);
  expect((await diag(page))!.phase).toBe('paused');
  expect(await opacity(page, '.hero__wordmark')).toBe(1);
  await expect(title3d(page)).toBeVisible();
  expect(await titleInk(page), 'las letras tienen tinta').toBeGreaterThan(2000);
  const t = (await diag(page))!.title;
  expect(t.requestedMs!, 'la hoja se pide con el planeta ya listo').toBeGreaterThan(0);
  const pose = await titlePose(page);
  await page.waitForTimeout(400);
  expect(await titlePose(page), 'las letras se mueven en reposo').not.toBe(pose);
  // El planeta es el de /mar: el mundo activo, con exactamente sus islas (T64).
  const ready = (await diag(page))!;
  expect(ready.world).toBe(WORLD_REGISTRY.defaultId);
  expect([...ready.islandIds!].sort()).toEqual(marIslands);
  expect(ready.islands).toBe(marIslands.length);
  expect(ready.outcome).toBe('played');

  // Acto 3: Enter (el botón tiene el foco) → «Zarpar»: la zambullida y el juego.
  await markNoReload(page);
  await page.keyboard.press('Enter');
  const d = await inTheGame(page);
  expect(await noReload(page), 'de la entrada al mar sin recargar la página').toBe(true);
  expect(d.history).toEqual(['waiting', 'appearing', 'paused', 'landing', 'landed', 'destroyed']);
  expect(d.enteredBy).toBe('button');
  expect(d.cameraMoves, 'la cámara se movió').toBeGreaterThan(0);
  // La cámara baja hacia el planeta sin retroceder: el radio sólo crece.
  expect(d.landingRadius.length).toBeGreaterThan(2);
  expect(d.landingRadius.every((r, i) => i === 0 || r >= d.landingRadius[i - 1]!)).toBe(true);
  // Se zambulle de verdad: al final el planeta es mucho mayor que la vista.
  const vp = page.viewportSize()!;
  expect(d.landingRadius.at(-1)! * 2).toBeGreaterThan(Math.max(vp.width, vp.height));
  // Corta: los tiempos de la configuración, con el reloj del navegador.
  expect(d.appearedMs).toBeGreaterThanOrEqual(DEFAULT_PLANET_INTRO.appear.durationMs);
  expect(d.playedMs).toBeGreaterThanOrEqual(DEFAULT_PLANET_INTRO.landing.durationMs);
  info.annotations.push({
    type: 'medida',
    description: `escena lista a ${d.sceneReadyMs?.toFixed(0)} ms del montaje, aparición ${d.appearedMs?.toFixed(0)} ms, zarpar ${d.playedMs?.toFixed(0)} ms, fotograma más largo ${d.longestFrameMs.toFixed(0)} ms · ${d.renderer}`,
  });

  // La bienvenida se cierra con su botón y el mar queda a mano.
  await page.getByTestId('mar-bienvenida-navegar').click();
  await expect(page.getByTestId('mar-bienvenida')).toHaveCount(0);
  await expect(page.getByTestId('mar-entradas')).toBeVisible();

  // Atrás: la landing, en reposo, sin repetir la entrada (D-21).
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await page.waitForFunction(
    () => window.__boiaIntro?.mode === 'direct' && window.__boiaIntro.phase === 'paused',
  );
  expect((await diag(page))!.history).toEqual(['paused']);
  await oneHeroButton(page);
});

test('enlaces compartidos (`?si=`, `?utm_source=`, `?ref=`) también reproducen la entrada (T57)', async ({
  page,
}) => {
  test.setTimeout(90_000);
  for (const search of ['?si=abc', '?utm_source=ig', '?ref=whatsapp&utm_medium=social']) {
    await page.goto(`/${search}`);
    await expect(page.locator('html'), search).toHaveAttribute('data-entry', 'intro');
    await phaseIs(page, 'paused');
    expect((await diag(page))!.history, search).toEqual(['waiting', 'appearing', 'paused']);
    await expect(enterButton(page)).toBeVisible();
  }
  await enterButton(page).click();
  await inTheGame(page);
});

test('una escena lenta (más que el antiguo plazo de 2 s) no se salta la entrada (T57)', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const DELAY = 4000;
  const hits = await onSceneChunk(page, async (route, body) => {
    await new Promise((r) => setTimeout(r, DELAY));
    await route
      .fulfill({ status: 200, contentType: 'application/javascript', body })
      .catch(() => {});
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-entry', 'intro');
  // Mientras tanto: «Cargando», con «Zarpar» a mano.
  await expect(page.locator('.intro-loading')).toBeVisible();
  await expect(page.locator('.intro-loading')).toContainText('Cargando');
  await expect(enterButton(page)).toBeVisible();
  await page.waitForTimeout(2600);
  expect((await diag(page))!.phase, 'sigue esperando a la escena').toBe('waiting');
  await expect(page.locator('html')).toHaveAttribute('data-intro', 'play');

  await phaseIs(page, 'paused', 30_000);
  expect(hits.length, 'se retrasó el bundle de la escena').toBeGreaterThan(0);
  const d = (await diag(page))!;
  expect(d.history).toEqual(['waiting', 'appearing', 'paused']);
  expect(d.sceneReadyMs!).toBeGreaterThan(DELAY - 500);
  expect(d.budgetLeftMs!).toBeGreaterThan(0);
  await enterButton(page).click();
  await inTheGame(page);
});

test('una escena que no llega en el plazo: «Cargando» y luego la versión estática (REQ-ENT-007)', async ({
  page,
}) => {
  test.setTimeout(60_000);
  // El bundle de la escena no llega nunca.
  await onSceneChunk(page, () => new Promise(() => {}));
  await page.goto('/');
  await expect(page.locator('.intro-loading')).toBeVisible();
  const d = await waitStatic(page, DEFAULT_PLANET_INTRO.loadBudgetMs + 15_000);
  expect(d.outcome).toBe('none');
  expect(d.history).not.toContain('appearing');
  await oneHeroButton(page);
});

test('abierta en segundo plano: la entrada espera y se ve al mirar la pestaña (T57)', async ({
  page,
}) => {
  test.setTimeout(60_000);
  // La pestaña nace oculta (abrir en segundo plano) hasta que la prueba la muestra.
  await page.addInitScript(() => {
    const w = window as Window & { __hidden?: boolean };
    w.__hidden = true;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => !!w.__hidden });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (w.__hidden ? 'hidden' : 'visible'),
    });
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-entry', 'intro');
  await page.waitForFunction(() => window.__boiaIntro?.sceneStatus === 'ready', null, {
    timeout: 30_000,
  });
  await page.waitForTimeout(1000);
  let d = (await diag(page))!;
  // Nada se ha consumido sin mirar: ni el tope del arranque ni el plazo de la escena.
  expect(d.phase).toBe('appearing');
  expect(d.framesRendered).toBe(0);
  expect(d.budgetLeftMs).toBe(DEFAULT_PLANET_INTRO.loadBudgetMs);
  expect(await page.evaluate(() => window.__boiaEntry?.timer)).toBe(0);
  await expect(page.locator('html')).toHaveAttribute('data-intro', 'play');

  await page.evaluate(() => {
    (window as Window & { __hidden?: boolean }).__hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await phaseIs(page, 'paused');
  d = (await diag(page))!;
  expect(d.history).toEqual(['waiting', 'appearing', 'paused']);
  expect(d.appearedMs!).toBeGreaterThanOrEqual(DEFAULT_PLANET_INTRO.appear.durationMs);
});

test('un scroll durante la aparición la adelanta al reposo y la escena sigue el scroll (plan 007)', async ({
  page,
}) => {
  await page.goto('/');
  await phaseIs(page, 'appearing');
  await page.evaluate(() => window.scrollTo({ top: innerHeight * 0.4, behavior: 'instant' }));
  const d = await waitRest(page, 5000);
  expect(d.outcome).toBe('skipped');
  expect(d.history).toEqual(['waiting', 'appearing', 'paused']);
  await page.waitForFunction(() => window.__boiaIntro!.scroll.phase === 'dive');
  await oneScene(page);
});

test('botón pulsado dos veces: un solo «Zarpar», una sola escena, un solo viaje (ENT 03)', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await phaseIs(page, 'paused');
  await page.evaluate(() => {
    const b = document.querySelector<HTMLElement>('[data-zarpar="hero"]');
    b?.click();
    b?.click();
  });
  await page.keyboard.press('Enter');
  const d = await inTheGame(page);
  expect(d.history.filter((p) => p === 'landing')).toHaveLength(1);
  expect(d.landingRadius.every((r, i) => i === 0 || r >= d.landingRadius[i - 1]!)).toBe(true);
  expect(d.scenesCreated).toBe(1);
  // La escena de la entrada se fue con la landing: en /mar no queda su canvas.
  expect(d.worldsAlive).toBe(0);
  await expect(page.locator('canvas[data-scene="boia-intro-scene"]')).toHaveCount(0);
});

test('Escape cinco veces en reposo: nada cambia, una escena, el botón (REQ-ENT-008, ENT 03)', async ({
  page,
}) => {
  await page.goto('/');
  await phaseIs(page, 'paused');
  for (let i = 0; i < 5; i++) await page.keyboard.press('Escape');
  const d = await waitRest(page, 2000);
  expect(d.outcome).toBe('played');
  expect(d.history).toEqual(['waiting', 'appearing', 'paused']);
  await oneScene(page);
  expect(new URL(page.url()).pathname).toBe('/');
  await oneHeroButton(page);
  await receivesTaps(page, 'cta-3d');
  // El planeta en reposo, entero en la vista.
  const pose = (await diag(page))!.pose!;
  expect(pose.y - pose.radius).toBeGreaterThan(0);
  expect(pose.y + pose.radius).toBeLessThan(page.viewportSize()!.height);
});

test('Escape durante «Zarpar» no lo corta: una zambullida, una escena, al juego', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await phaseIs(page, 'paused');
  await enterButton(page).click();
  await phaseIs(page, 'landing');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  const d = await inTheGame(page);
  expect(d.history.filter((p) => p === 'landing')).toHaveLength(1);
  expect(d.scenesCreated).toBe(1);
});

test('pestaña oculta: la aparición acaba en el reposo; «Zarpar», en el juego (REQ-ENT-014)', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const hide = (hidden: boolean) =>
    page.evaluate((h) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => (h ? 'hidden' : 'visible'),
      });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
  await page.goto('/');
  await phaseIs(page, 'appearing');
  await hide(true);
  await phaseIs(page, 'paused', 2000);
  await hide(false);
  await page.waitForTimeout(500);
  expect((await diag(page))!.phase).toBe('paused');

  await enterButton(page).click();
  await phaseIs(page, 'landing');
  await hide(true);
  await page.waitForFunction(() => window.__boiaIntro?.exit === 'game', null, { timeout: 2000 });
  await hide(false);

  const d = await inTheGame(page);
  expect(d.playedMs).toBeNull();
});

test('Atrás en reposo: no repite la entrada ni duplica la escena (ENT 03)', async ({ page }) => {
  await page.goto('/');
  await phaseIs(page, 'paused');
  await page.goto('/legal/privacidad');
  await page.goBack();
  // Vuelta desde la caché del navegador (el reposo sigue) o carga nueva de `/`
  // (la entrada vuelve a empezar y acaba en reposo, D-21).
  await phaseIs(page, 'paused');
  const d = (await diag(page))!;
  expect(d.history).not.toContain('landing');
  expect(d.worldsAlive).toBeLessThanOrEqual(1);
  expect(await canvases(page).count()).toBeLessThanOrEqual(1);
});

test.describe('movimiento reducido', () => {
  test.use({ reducedMotion: 'reduce' });

  test('la versión estática: sin escena, «BOIA» plano; al pulsar, fundido al velo y al juego (REQ-ENT-010)', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-entry', 'reduced');
    const d0 = await waitStatic(page);
    expect(d0.history).toEqual(['paused']);
    expect(d0.scenesCreated).toBe(0);
    await expect(canvases(page)).toHaveCount(0);
    await expect(title(page)).toHaveText('BOIA');
    await expect(title(page)).not.toHaveAttribute('data-title', '3d');
    await expect(enterButton(page)).toBeVisible();
    await enterButton(page).click();
    const d = await inTheGame(page);
    expect(d.mode).toBe('reduced');
    expect(d.history).not.toContain('appearing');
    expect(d.framesRendered).toBeGreaterThan(0);
    expect(d.cameraMoves).toBe(0);
  });

  test('una URL directa también es la versión estática', async ({ page }) => {
    await page.goto('/?intro=0');
    await expect(page.locator('html')).toHaveAttribute('data-entry', 'direct');
    const d = await waitStatic(page);
    expect(d.scenesCreated).toBe(0);
  });
});

test('motor bloqueado: la versión estática y Tickets funcionando (REQ-ENT-017, 038)', async ({
  page,
}) => {
  const blocked = await onSceneChunk(page, (route) => route.abort('blockedbyclient'));
  await page
    .context()
    .route('https://example.com/**', (r) =>
      r.fulfill({ contentType: 'text/html', body: '<title>sandbox</title>' }),
    );

  await page.goto('/');
  const d = await waitStatic(page, 6000);
  expect(blocked.length, 'se bloqueó el bundle de la escena').toBeGreaterThan(0);
  expect(d.sceneStatus).toBe('failed');
  expect(d.worldsAlive).toBe(0);
  await expect(canvases(page)).toHaveCount(0);
  await oneHeroButton(page);

  // «Entradas», en la cabecera al dejar el hero.
  await page.evaluate(() => window.scrollTo({ top: innerHeight * 1.6, behavior: 'instant' }));
  await expect(page.locator('.site-header__inner')).toBeVisible();
  await headerTickets(page).click();
  await expect(ticketsPanel(page)).toBeVisible();
  // El evento con checkout online (Halloween y SONIDO van a taquilla, T199).
  const buy = ticketsPanel(page).getByTestId(`comprar-${ONLINE_EVENT.id}`);
  await expect(buy).toBeVisible();
  // Sin escena, la compra de prueba (D-20) se abre igual.
  await buy.click();
  // Sin Carnet, la compra lo pide (plan 019): se crea aquí mismo y sigue.
  await createCarnetInCheckout(page.getByTestId('checkout'));
});

test('sin WebGL: la versión estática enseguida, sin canvas', async ({ page }) => {
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
  await page.goto('/');
  const d = await waitStatic(page, 10_000);
  expect(d.outcome).toBe('none');
  expect(d.sceneStatus).toBe('failed');
  await expect(canvases(page)).toHaveCount(0);
  await oneHeroButton(page);
});

test('cada carga completa de `/` reproduce la entrada, aunque ya se viera (D-21, REQ-ENT-009)', async ({
  page,
}) => {
  test.setTimeout(60_000);
  // La marca de «ya la vio» de antes de D-21 ya no cuenta.
  await page.addInitScript(() => localStorage.setItem('boia.intro.v2', 'seen'));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-entry', 'intro');
  await waitRest(page);

  // Recarga: otra vez la entrada entera.
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-entry', 'intro');
  await phaseIs(page, 'paused');
  expect((await diag(page))!.history).toEqual(['waiting', 'appearing', 'paused']);
});

test('una URL que apunta a algo nace en reposo; «Ver la introducción» la repite (REQ-ENT-009, 011)', async ({
  page,
  browser,
}, info) => {
  // Enlace directo a Tickets: directo al panel.
  const fresh = await browser.newContext({ baseURL: info.project.use.baseURL ?? '' });
  const other = await fresh.newPage();
  await other.goto('/#tickets');
  await expect(other.locator('html')).toHaveAttribute('data-entry', 'direct');
  await expect(ticketsPanel(other)).toBeVisible();
  expect((await diag(other))!.history).not.toContain('appearing');
  await fresh.close();

  // `?intro=0`: en reposo, sin aparición.
  await page.goto('/?intro=0');
  await expect(page.locator('html')).toHaveAttribute('data-entry', 'direct');
  const d = await waitRest(page);
  expect(d.history).toEqual(['paused']);
  await oneHeroButton(page);

  // Un parámetro de la web: directa.
  await page.goto('/?menu=carnet');
  await expect(page.locator('html')).toHaveAttribute('data-entry', 'direct');
  expect((await waitRest(page)).history).toEqual(['paused']);

  // Pedirla desde el pie la vuelve a reproducir.
  await page.getByRole('link', { name: 'Ver la introducción' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-entry', 'intro');
  await phaseIs(page, 'paused');
  expect((await diag(page))!.history).toEqual(['waiting', 'appearing', 'paused']);
});

test('volver a `/` navegando dentro de la web no repite la entrada (D-21)', async ({ page }) => {
  test.setTimeout(60_000);
  const backHomeWithoutIntro = async () => {
    await page.evaluate(
      () => ((window as Window & { __sinRecarga?: boolean }).__sinRecarga = true),
    );
    // «Volver» de la página legal: un enlace de Next, sin recarga.
    await page
      .getByRole('link', { name: /volver/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/$/);
    await page.waitForFunction(
      () => window.__boiaIntro?.mode === 'direct' && window.__boiaIntro.phase === 'paused',
    );
    expect(
      await page.evaluate(() => (window as Window & { __sinRecarga?: boolean }).__sinRecarga),
      'sin recarga',
    ).toBe(true);
    await expect(page.locator('html')).not.toHaveAttribute('data-intro', /.*/);
    expect((await diag(page))!.history).toEqual(['paused']);
    await oneHeroButton(page);
  };

  // `/` con su entrada → una página de la web → vuelta a `/`.
  await page.goto('/');
  await waitRest(page);
  await page.evaluate(() => ((window as Window & { __sinRecarga?: boolean }).__sinRecarga = true));
  await page
    .locator('.site-footer')
    .getByRole('link', { name: /privacidad/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/legal\/privacidad$/);
  await backHomeWithoutIntro();

  // Carga completa de otra página (sin entrada) → vuelta a `/`.
  await page.goto('/legal/privacidad');
  await backHomeWithoutIntro();
});

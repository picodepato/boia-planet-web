import { DEFAULT_PLANET_INTRO } from '@boia/engine/intro';
import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * Entrada 3D con el planeta de /mar (T57; D-19, D-21; REQ-ENT-001…020, ENT
 * 01–03). La entrada depende sólo de la URL (D-21): `/` a secas la reproduce
 * en cada carga completa, también con etiquetas de campaña o de compartir;
 * una URL que apunta a algo concreto entra directa. El estado se lee de
 * `window.__boiaIntro` (diagnóstico público de la entrada).
 */

type Diag = NonNullable<Window['__boiaIntro']>;

const diag = (page: Page) => page.evaluate(() => window.__boiaIntro ?? null);
const phaseIs = (page: Page, phase: string, timeout = 20_000) =>
  page.waitForFunction((p) => window.__boiaIntro?.phase === p, phase, { timeout });

async function waitLanded(page: Page, timeout = 20_000): Promise<Diag> {
  await phaseIs(page, 'landed', timeout);
  await expect(page.locator('html')).not.toHaveAttribute('data-intro', /.*/);
  return (await diag(page))!;
}

const hero = (page: Page) => page.locator('.hero');
const worldCta = (page: Page) => page.getByTestId('cta-3d');
const heroTickets = (page: Page) => hero(page).getByRole('link', { name: 'Tickets', exact: true });
const ticketsPanel = (page: Page) => page.getByRole('dialog', { name: 'Elige tu evento' });
const canvases = (page: Page) => page.locator('.hero__scene canvas');
const title = (page: Page) => page.locator('.intro-overlay__title');
const enterButton = (page: Page) => page.getByRole('button', { name: 'Zarpar' });
const ticketsOnly = (page: Page) =>
  page.getByRole('link', { name: 'Solo quiero ver las entradas' });
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

/** El elemento que recibe un toque en el centro de `el` es `el` o algo suyo (ENT 02). */
async function receivesTaps(page: Page, testId: 'cta-3d' | 'tickets') {
  const el = testId === 'cta-3d' ? worldCta(page) : heroTickets(page);
  const box = (await el.boundingBox())!;
  const href = await el.getAttribute('href');
  const hit = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.closest('a')?.getAttribute('href') ?? null,
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  );
  expect(hit, `${testId} recibe el toque`).toBe(href);
}

/** El hero tiene exactamente dos botones: el mundo 3D y Tickets (T57). */
async function twoHeroButtons(page: Page) {
  const actions = hero(page).locator('.hero__actions a');
  await expect(actions).toHaveCount(2);
  expect(await actions.evaluateAll((as) => as.map((a) => a.getAttribute('href')))).toEqual([
    '/mar',
    '#tickets',
  ]);
  await expect(worldCta(page)).toBeVisible();
  await expect(heroTickets(page)).toBeVisible();
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

test('`/`: el planeta, luego «BOIA» y «Zarpar»; al pulsar, baja al hero con dos botones (ENT 01, 02)', async ({
  page,
}, info) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-entry', 'intro');

  // Acto 1: el planeta aparece. Sólo hay dos acciones, y ninguna obligatoria.
  await phaseIs(page, 'appearing');
  // Lo que se puede pulsar durante la aparición, leído de una vez con la fase.
  const during = await page.evaluate(() => ({
    phase: window.__boiaIntro?.phase,
    actions: [...document.querySelectorAll<HTMLElement>('a, button, input, select')]
      .filter((el) => {
        const s = getComputedStyle(el);
        const b = el.getBoundingClientRect();
        return s.visibility !== 'hidden' && s.display !== 'none' && b.width > 0 && b.height > 0;
      })
      .map((el) => el.innerText.trim()),
  }));
  expect(during.phase).toBe('appearing');
  expect(during.actions).toEqual(['Solo quiero ver las entradas', 'Saltar animación']);
  await expect(canvases(page)).toHaveCount(1);
  await expect(canvases(page)).toHaveAttribute('data-scene', 'boia-intro-scene');

  // Acto 2: «BOIA» y el botón, con el foco; la pausa no avanza sola.
  await phaseIs(page, 'paused');
  await expect(title(page)).toHaveText('BOIA');
  await expect(enterButton(page)).toBeVisible();
  await expect(enterButton(page)).toBeFocused();
  // Título 3D (T27): la hoja llega después del planeta y las letras se mueven solas.
  await expect(title(page)).toHaveAttribute('data-title', '3d', { timeout: 10_000 });
  await page.waitForTimeout(1500);
  expect((await diag(page))!.phase).toBe('paused');
  expect(await opacity(page, '.intro-overlay__title')).toBe(1);
  await expect(title3d(page)).toBeVisible();
  expect(await titleInk(page), 'las letras tienen tinta').toBeGreaterThan(2000);
  const t = (await diag(page))!.title;
  expect(t.requestedMs!, 'la hoja se pide con el planeta ya listo').toBeGreaterThan(0);
  const pose = await titlePose(page);
  await page.waitForTimeout(400);
  expect(await titlePose(page), 'las letras se mueven en reposo').not.toBe(pose);
  await expect(ticketsOnly(page)).toBeVisible();
  // El planeta es el de /mar: el mundo activo, con sus islas.
  const ready = (await diag(page))!;
  expect(ready.world).toBe('arcilla');
  expect(ready.islands).toBeGreaterThan(3);

  // Acto 3: Enter (el botón tiene el foco) → «Zarpar».
  await page.keyboard.press('Enter');
  const d = await waitLanded(page);
  expect(d.history).toEqual(['waiting', 'appearing', 'paused', 'landing', 'landed']);
  expect(d.outcome).toBe('played');
  expect(d.enteredBy).toBe('button');
  expect(d.cameraMoves, 'la cámara se movió').toBeGreaterThan(0);
  // La cámara baja hacia el planeta sin retroceder: el radio sólo crece.
  expect(d.landingRadius.length).toBeGreaterThan(2);
  expect(d.landingRadius.every((r, i) => i === 0 || r >= d.landingRadius[i - 1]!)).toBe(true);
  // Corta: los tiempos de la configuración, con el reloj del navegador.
  expect(d.appearedMs).toBeGreaterThanOrEqual(DEFAULT_PLANET_INTRO.appear.durationMs);
  expect(d.playedMs).toBeGreaterThanOrEqual(DEFAULT_PLANET_INTRO.landing.durationMs);
  info.annotations.push({
    type: 'medida',
    description: `escena lista a ${d.sceneReadyMs?.toFixed(0)} ms del montaje, aparición ${d.appearedMs?.toFixed(0)} ms, zarpar ${d.playedMs?.toFixed(0)} ms, fotograma más largo ${d.longestFrameMs.toFixed(0)} ms · ${d.renderer}`,
  });

  // La landing sobre el planeta responde ya: dos botones, una escena.
  await oneScene(page);
  await expect(page.locator('.intro-overlay')).toHaveCount(0);
  await twoHeroButtons(page);
  await receivesTaps(page, 'cta-3d');
  await receivesTaps(page, 'tickets');
  expect(await landingViews(page)).toEqual(['played']);
  // El horizonte del planeta queda detrás del hero, girando.
  const top = d.pose!.y - d.pose!.radius;
  expect(top).toBeGreaterThan(0);
  expect(top).toBeLessThan(page.viewportSize()!.height);

  await heroTickets(page).click();
  await expect(ticketsPanel(page)).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/');
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
  const d = await waitLanded(page);
  expect(d.outcome).toBe('played');
  await twoHeroButtons(page);
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
  // Mientras tanto: «Cargando», con Tickets y «Saltar» a mano.
  await expect(page.locator('.intro-loading')).toBeVisible();
  await expect(page.locator('.intro-loading')).toContainText('Cargando');
  await expect(ticketsOnly(page)).toBeVisible();
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
  expect((await waitLanded(page)).outcome).toBe('played');
});

test('una escena que no llega en el plazo: «Cargando» y luego la landing ligera (REQ-ENT-007)', async ({
  page,
}) => {
  test.setTimeout(60_000);
  // El bundle de la escena no llega nunca.
  await onSceneChunk(page, () => new Promise(() => {}));
  await page.goto('/');
  await expect(page.locator('.intro-loading')).toBeVisible();
  const d = await waitLanded(page, DEFAULT_PLANET_INTRO.loadBudgetMs + 15_000);
  expect(d.outcome).toBe('none');
  expect(d.history).not.toContain('appearing');
  await expect(page.locator('.hero__planet')).toBeVisible();
  await twoHeroButtons(page);
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

test('«Solo quiero ver las entradas» lleva a Tickets sin el botón ni la animación (REQ-ENT-002)', async ({
  page,
}) => {
  await page.goto('/');
  await phaseIs(page, 'appearing');
  await ticketsOnly(page).click();
  await expect(ticketsPanel(page)).toBeVisible();
  const d = await waitLanded(page, 3000);
  expect(d.outcome).toBe('skipped');
  expect(d.history).not.toContain('landing');
  expect(new URL(page.url()).pathname).toBe('/');
  expect(await landingViews(page)).toEqual(['skipped']);
});

test('botón pulsado dos veces: un solo «Zarpar», una sola escena (ENT 03)', async ({ page }) => {
  await page.goto('/');
  await phaseIs(page, 'paused');
  await page.evaluate(() => {
    const b = document.querySelector<HTMLButtonElement>('[data-intro-enter]');
    b?.click();
    b?.click();
  });
  await page.keyboard.press('Enter');
  const d = await waitLanded(page);
  expect(d.outcome).toBe('played');
  expect(d.history.filter((p) => p === 'landing')).toHaveLength(1);
  expect(d.landingRadius.every((r, i) => i === 0 || r >= d.landingRadius[i - 1]!)).toBe(true);
  await oneScene(page);
  expect(await landingViews(page)).toEqual(['played']);
});

test('«Saltar» cinco veces y Escape en la pausa: la misma landing (REQ-ENT-008, ENT 03)', async ({
  page,
}) => {
  await page.goto('/');
  await phaseIs(page, 'paused');
  await page.evaluate(() => {
    const skip = document.querySelector<HTMLButtonElement>('.intro-overlay__skip');
    for (let i = 0; i < 5; i++) skip?.click();
  });
  await page.keyboard.press('Escape');
  const d = await waitLanded(page, 2000);
  expect(d.outcome).toBe('skipped');
  expect(d.history).not.toContain('landing');
  await oneScene(page);
  expect(new URL(page.url()).pathname).toBe('/');
  expect(await landingViews(page)).toEqual(['skipped']);
  await receivesTaps(page, 'tickets');
  await receivesTaps(page, 'cta-3d');
});

test('«Saltar» durante «Zarpar»: termina una vez, sin duplicar la escena', async ({ page }) => {
  await page.goto('/');
  await phaseIs(page, 'paused');
  await enterButton(page).click();
  await phaseIs(page, 'landing');
  await page.evaluate(() => {
    const skip = document.querySelector<HTMLButtonElement>('.intro-overlay__skip');
    skip?.click();
    skip?.click();
  });
  const d = await waitLanded(page, 2000);
  expect(d.outcome).toBe('skipped');
  await oneScene(page);
});

test('pestaña oculta: la aparición acaba en la pausa; «Zarpar», en la landing (REQ-ENT-014)', async ({
  page,
}) => {
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
  const d = await waitLanded(page, 2000);
  expect(d.outcome).toBe('played');
  expect(d.playedMs).toBeNull();
  await hide(false);
  await oneScene(page);
});

test('Atrás en la pausa: no repite la entrada ni duplica la escena (ENT 03)', async ({ page }) => {
  await page.goto('/');
  await phaseIs(page, 'paused');
  await page.goto('/legal/privacidad');
  await page.goBack();
  // Vuelta desde la caché del navegador (la pausa sigue) o carga nueva de `/`
  // (la entrada vuelve a empezar, D-21).
  await page.waitForFunction(() => ['paused', 'landed'].includes(window.__boiaIntro?.phase ?? ''));
  const d = (await diag(page))!;
  expect(d.history).not.toContain('landing');
  expect(d.worldsAlive).toBeLessThanOrEqual(1);
  expect(await canvases(page).count()).toBeLessThanOrEqual(1);
});

test.describe('movimiento reducido', () => {
  test.use({ reducedMotion: 'reduce' });

  test('planeta quieto, título y botón; al pulsar, fundido sin mover la cámara (REQ-ENT-010)', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-entry', 'reduced');
    await phaseIs(page, 'paused');
    await expect(title(page)).toHaveText('BOIA');
    await expect(enterButton(page)).toBeVisible();
    // Título 3D quieto: un solo fotograma, que no cambia (T27).
    await expect(title(page)).toHaveAttribute('data-title', '3d', { timeout: 10_000 });
    await expect(title3d(page)).toBeVisible();
    await page.waitForFunction(
      () =>
        Number(getComputedStyle(document.querySelector('.intro-overlay__title')!).opacity) === 1,
    );
    expect(await titleInk(page)).toBeGreaterThan(2000);
    const still = await titlePose(page);
    const draws = (await diag(page))!.title.draws;
    const frames = (await diag(page))!.framesRendered;
    await page.waitForTimeout(800);
    expect((await diag(page))!.phase).toBe('paused');
    expect(await titlePose(page)).toBe(still);
    expect((await diag(page))!.title.draws, 'no se repinta en reposo').toBe(draws);
    expect((await diag(page))!.framesRendered, 'el planeta está quieto').toBe(frames);
    await enterButton(page).click();
    const d = await waitLanded(page);
    expect(d.mode).toBe('reduced');
    expect(d.history).not.toContain('appearing');
    expect(d.outcome).toBe('played');
    expect(d.framesRendered).toBeGreaterThan(0);
    expect(d.cameraMoves).toBe(0);
    await oneScene(page);
    await receivesTaps(page, 'tickets');
  });
});

test('motor bloqueado: el planeta ligero y Tickets funcionando (REQ-ENT-017, 038)', async ({
  page,
}) => {
  const blocked = await onSceneChunk(page, (route) => route.abort('blockedbyclient'));
  await page
    .context()
    .route('https://example.com/**', (r) =>
      r.fulfill({ contentType: 'text/html', body: '<title>sandbox</title>' }),
    );

  await page.goto('/');
  const d = await waitLanded(page, 6000);
  expect(blocked.length, 'se bloqueó el bundle de la escena').toBeGreaterThan(0);
  expect(d.sceneStatus).toBe('failed');
  expect(d.worldsAlive).toBe(0);
  await expect(canvases(page)).toHaveCount(0);

  // El planeta ligero, en CSS, con el horizonte detrás del hero.
  const planet = page.locator('.hero__planet');
  await expect(planet).toBeVisible();
  const box = (await planet.boundingBox())!;
  expect(box.width).toBeGreaterThan(page.viewportSize()!.width);
  expect(box.y).toBeGreaterThan(0);
  expect(box.y).toBeLessThan(page.viewportSize()!.height);
  await twoHeroButtons(page);

  await heroTickets(page).click();
  await expect(ticketsPanel(page)).toBeVisible();
  const buy = ticketsPanel(page)
    .getByRole('button', { name: /comprar entradas/i })
    .first();
  await expect(buy).toBeVisible();
  // Sin escena, la compra de prueba (D-20) se abre igual.
  await buy.click();
  await expect(page.getByTestId('checkout-confirmar')).toBeVisible({ timeout: 20_000 });
});

test('sin WebGL: landing ligera enseguida, sin canvas', async ({ page }) => {
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
  const d = await waitLanded(page, 10_000);
  expect(d.outcome).toBe('none');
  expect(d.sceneStatus).toBe('failed');
  await expect(canvases(page)).toHaveCount(0);
  await expect(page.locator('.hero__planet')).toBeVisible();
  await twoHeroButtons(page);
});

test('cada carga completa de `/` reproduce la entrada, aunque ya se viera (D-21, REQ-ENT-009)', async ({
  page,
}) => {
  test.setTimeout(60_000);
  // La marca de «ya la vio» de antes de D-21 ya no cuenta.
  await page.addInitScript(() => localStorage.setItem('boia.intro.v2', 'seen'));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-entry', 'intro');
  await phaseIs(page, 'paused');
  await enterButton(page).click();
  await waitLanded(page);

  // Recarga: otra vez la entrada entera.
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-entry', 'intro');
  await phaseIs(page, 'paused');
  expect((await diag(page))!.history).toEqual(['waiting', 'appearing', 'paused']);
});

test('una URL que apunta a algo entra directa; «Ver la introducción» la repite (REQ-ENT-009, 011)', async ({
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

  // `?intro=0`: directa a la landing, con el planeta en el horizonte.
  await page.goto('/?intro=0');
  await expect(page.locator('html')).toHaveAttribute('data-entry', 'direct');
  const d = await waitLanded(page);
  expect(d.history).toEqual(['landed']);
  await expect(page.locator('.intro-overlay')).toHaveCount(0);
  await twoHeroButtons(page);

  // Un parámetro de la web: directa.
  await page.goto('/?menu=carnet');
  await expect(page.locator('html')).toHaveAttribute('data-entry', 'direct');
  expect((await waitLanded(page)).history).toEqual(['landed']);

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
      () => window.__boiaIntro?.mode === 'direct' && window.__boiaIntro.phase === 'landed',
    );
    expect(
      await page.evaluate(() => (window as Window & { __sinRecarga?: boolean }).__sinRecarga),
      'sin recarga',
    ).toBe(true);
    await expect(page.locator('html')).not.toHaveAttribute('data-intro', /.*/);
    await expect(page.locator('.intro-overlay')).toHaveCount(0);
    await twoHeroButtons(page);
  };

  // `/` con su entrada → una página de la web → vuelta a `/`.
  await page.goto('/');
  await phaseIs(page, 'paused');
  await page.getByRole('button', { name: 'Saltar animación' }).click();
  await waitLanded(page);
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

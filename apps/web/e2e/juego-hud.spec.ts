import {
  MINIMAP_MAX_WIDTH_FRACTION,
  MINIMAP_ZONE_KEY,
  SENSITIVITY_RANGE,
  SETTINGS_KEY,
} from '@boia/engine/ui';
import { expect, test, type Page } from '@playwright/test';

/**
 * HUD de /juego (T05): minimapa (D-07), brújula, ancla, avisos y Menú de a
 * bordo. Corre en el proyecto móvil (360×640, táctil) y en el de escritorio.
 */

const minimap = (page: Page) => page.getByTestId('minimapa');

async function openGame(page: Page) {
  await page.goto('/juego');
  await expect(minimap(page)).toBeVisible();
  // El motor ya corre (y escucha el teclado) cuando la caja de datos da un número de FPS.
  await expect(page.getByTestId('hud')).toContainText(/\d+ fps/, { timeout: 20_000 });
}

async function joystickTop(page: Page): Promise<number> {
  const v = await page.getByTestId('hud-capa').getAttribute('data-joystick-top');
  return Number(v);
}

test('minimapa ≤ 22 % del ancho y ningún elemento del HUD tapa la zona del joystick', async ({
  page,
}, info) => {
  await openGame(page);
  const vp = page.viewportSize()!;
  if (info.project.name === 'mobile') expect(vp).toEqual({ width: 360, height: 640 });

  const box = (await minimap(page).boundingBox())!;
  expect(box.width / vp.width).toBeLessThanOrEqual(MINIMAP_MAX_WIDTH_FRACTION);
  expect(box.height).toBeCloseTo(box.width, 0);

  const top = await joystickTop(page);
  // La zona del joystick es la franja inferior de la pantalla.
  expect(top).toBeGreaterThanOrEqual(vp.height / 2);
  expect(top).toBeLessThan(vp.height);

  const hud = page.locator('[data-hud]');
  const n = await hud.count();
  expect(n).toBeGreaterThanOrEqual(4);
  for (let i = 0; i < n; i++) {
    const el = hud.nth(i);
    if (!(await el.isVisible())) continue;
    const b = (await el.boundingBox())!;
    const name = await el.getAttribute('data-hud');
    expect(b.y + b.height, `${name} acaba antes de la zona del joystick`).toBeLessThanOrEqual(top);
    expect(b.x, name!).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width, name!).toBeLessThanOrEqual(vp.width);
  }

  // Cualquier punto de la zona del joystick llega al canvas (nace el joystick).
  const hits = await page.evaluate(
    ({ top, w, h }) => {
      const out: string[] = [];
      for (let y = top + 4; y < h; y += 40) {
        for (let x = 4; x < w; x += 40) {
          out.push(document.elementFromPoint(x, y)?.tagName ?? 'none');
        }
      }
      return out;
    },
    { top, w: vp.width, h: vp.height },
  );
  expect(new Set(hits)).toEqual(new Set(['CANVAS']));
});

test('tocar el minimapa lo amplía; mantenerlo 500 ms y arrastrar lo mueve y se recuerda', async ({
  page,
}) => {
  await openGame(page);
  const vp = page.viewportSize()!;

  // Toque corto: mapa ampliado.
  const b0 = (await minimap(page).boundingBox())!;
  const c0 = { x: b0.x + b0.width / 2, y: b0.y + b0.height / 2 };
  await page.mouse.click(c0.x, c0.y);
  const map = page.getByTestId('minimapa-ampliado');
  await expect(map).toBeVisible();
  await map.getByRole('button', { name: 'Cerrar' }).click();
  await expect(map).toBeHidden();

  // Pulsación larga y arrastre hasta abajo a la izquierda (zona del joystick):
  // se ajusta a la zona segura más cercana, a la izquierda y fuera de esa franja.
  await page.mouse.move(c0.x, c0.y);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await expect(minimap(page)).toHaveClass(/is-dragging/);
  await page.mouse.move(40, vp.height - 40, { steps: 8 });
  await page.mouse.up();
  await expect(map).toBeHidden();

  const top = await joystickTop(page);
  const check = async () => {
    const b = (await minimap(page).boundingBox())!;
    expect(b.x + b.width / 2).toBeLessThan(vp.width / 2);
    expect(b.y + b.height).toBeLessThanOrEqual(top);
    expect(b.y).toBeGreaterThan(b0.y);
    return b;
  };
  await expect.poll(async () => (await minimap(page).boundingBox())!.x).toBeLessThan(vp.width / 2);
  const placed = await check();
  const saved = await page.evaluate((k) => localStorage.getItem(k), MINIMAP_ZONE_KEY);
  expect(saved).toBeTruthy();

  await page.reload();
  await openGame(page);
  const after = await check();
  expect(after).toEqual(placed);
});

test('Menú de a bordo: siete iconos, separación y modo de teclado guardado', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('menu-ancla').click();
  const menu = page.getByTestId('menu');
  await expect(menu).toBeVisible();
  const tabs = menu.getByRole('tab');
  expect(await tabs.count()).toBeGreaterThanOrEqual(7);
  for (const name of [
    'Welcome Aboard',
    'Mi Carnet',
    'Logros',
    'Barco',
    'Ranking',
    'Controles',
    'Ajustes',
  ]) {
    await expect(menu.getByRole('tab', { name, exact: true })).toBeVisible();
  }
  await expect(menu.locator('.juego-menu-sep')).toHaveCount(1);
  // El título va dentro de la sección.
  await expect(menu.getByRole('heading', { name: 'Welcome Aboard' })).toBeVisible();

  // Barco: estilos y skins (T12; antes, el selector de prueba de T11), fuera del joystick.
  await menu.getByRole('tab', { name: 'Barco', exact: true }).click();
  await expect(menu.getByTestId('barco')).toBeVisible();

  // Controles: dirección de pantalla por defecto; se cambia a tanque y se guarda.
  await menu.getByRole('tab', { name: 'Controles' }).click();
  const modes = menu.getByTestId('modo-teclado');
  await expect(modes.getByRole('radio', { name: /Dirección de pantalla/ })).toBeChecked();
  await modes.getByRole('radio', { name: /Control de tanque/ }).check();

  // Ajustes: música y efectos por separado.
  await menu.getByRole('tab', { name: 'Ajustes' }).click();
  await menu.getByTestId('ajuste-music').getByRole('checkbox').uncheck();
  await expect(menu.getByTestId('ajuste-sfx').getByRole('checkbox')).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();

  const stored = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k) ?? '{}'),
    SETTINGS_KEY,
  );
  expect(stored).toMatchObject({
    keyboardMode: 'tank',
    music: { enabled: false },
    sfx: { enabled: true },
  });

  await page.reload();
  await openGame(page);
  await page.getByTestId('menu-ancla').click();
  await page.getByTestId('menu').getByRole('tab', { name: 'Controles' }).click();
  await expect(
    page.getByTestId('modo-teclado').getByRole('radio', { name: /Control de tanque/ }),
  ).toBeChecked();
});

test('la caja de fps y velocidad sólo sale con ?debug (O11)', async ({ page }) => {
  await openGame(page);
  // Sin `?debug` el motor corre (los datos están) pero no hay caja a la vista.
  await expect(page.getByTestId('hud')).toBeHidden();
  await expect(page.locator('[data-hud="datos"]:visible')).toHaveCount(0);

  await page.goto('/juego?debug');
  await expect(page.getByTestId('hud')).toBeVisible();
  await expect(page.getByTestId('hud')).toContainText(/\d+ fps/, { timeout: 20_000 });
});

test('sin audio antes del primer gesto; el primer toque lo desbloquea', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as Window & { __audioContexts?: number };
    const Original = window.AudioContext;
    w.__audioContexts = 0;
    window.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) {
        super(options);
        w.__audioContexts = (w.__audioContexts ?? 0) + 1;
      }
    };
  });
  await openGame(page);
  const contexts = () =>
    page.evaluate(() => (window as Window & { __audioContexts?: number }).__audioContexts);
  expect(await contexts()).toBe(0);

  const vp = page.viewportSize()!;
  await page.mouse.click(vp.width / 2, vp.height - 40);
  await expect.poll(contexts).toBe(1);
});

test('la sensibilidad del giro se ajusta en Controles y se guarda', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('menu-ancla').click();
  const menu = page.getByTestId('menu');
  await menu.getByRole('tab', { name: 'Controles' }).click();
  const sens = menu.getByTestId('sensibilidad');
  await sens.getByRole('slider', { name: /teclado/ }).fill(String(SENSITIVITY_RANGE.max * 100));
  await sens.getByRole('slider', { name: /táctil/ }).fill(String(SENSITIVITY_RANGE.min * 100));
  const stored = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k) ?? '{}'),
    SETTINGS_KEY,
  );
  expect(stored.sensitivity).toEqual({
    keyboard: SENSITIVITY_RANGE.max,
    touch: SENSITIVITY_RANGE.min,
  });
});

test('un logro sale como aviso arriba, de uno en uno', async ({ page }) => {
  await openGame(page);
  const top = await joystickTop(page);
  // Navegar hacia arriba lleva el barco a la boia tutorial (logro find_boia).
  await page.keyboard.down('ArrowUp');
  const notice = page.getByTestId('aviso');
  await expect(notice.first()).toBeVisible({ timeout: 10_000 });
  await page.keyboard.up('ArrowUp');
  await expect(notice.first()).toHaveAttribute('data-kind', 'achievement');
  // Sin esperas implícitas: se mira lo que hay en cada instante.
  for (let i = 0; i < 12; i++) {
    const boxes = await notice.evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom };
      }),
    );
    expect(boxes.length).toBeLessThanOrEqual(1);
    for (const b of boxes) expect(b.bottom).toBeLessThanOrEqual(top);
    await page.waitForTimeout(150);
  }
  // El primero es el logro de la boia; a los 4 s se va solo.
  await expect(page.locator('[data-kind="achievement"]')).toHaveCount(0, { timeout: 10_000 });
});

test('sin el botón de accesibilidad de Pixi y sin errores del minimapa al redimensionar', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await openGame(page);
  // El sistema de accesibilidad de Pixi mete en el body un <button> invisible
  // que es parada del tabulador (en móvil); el motor lo quita (T29).
  await expect(page.locator('button[title*="accessibility"]')).toHaveCount(0);

  // Un viewport casi sin hueco no deja al minimapa con un SVG de tamaño negativo.
  const vp = page.viewportSize()!;
  await page.setViewportSize({ width: 40, height: 40 });
  await page.waitForTimeout(300);
  await page.setViewportSize(vp);
  await expect(minimap(page)).toBeVisible();
  expect(errors.filter((e) => /negative value/i.test(e))).toEqual([]);
});

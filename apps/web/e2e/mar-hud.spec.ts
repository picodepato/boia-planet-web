import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAMPLE_CONTENT } from '../lib/landing/sample-content';
import { t } from '../lib/i18n';

/**
 * El HUD de /mar (T65, decisión de Hernán y Álvaro del 2026-10-02, que
 * sustituye la barra de T53; REQ-PRO-008, REQ-PRO-009): arriba, los enlaces a
 * la web (Fotos, Contacto, Artistas y Shop salen a su sección de la landing;
 * Carnet abre el menú del juego en Mi Carnet); a la izquierda, el botón del
 * menú del juego con el icono de logros y todo dentro; abajo, sólo «Entradas»
 * y el turbo. El minimapa se queda y su arrastre ya no rompe nada. Las
 * tarjetas siguen siendo pequeñas, abajo; los avisos, chips arriba.
 *
 * En el móvil (375×812, proyecto `mobile`) y en escritorio (proyecto
 * `desktop`). Con RECORD_T65=1 deja capturas en docs/informes/img/ p005-t65-*.png.
 */

test.describe.configure({ timeout: 120_000 });

const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../docs/informes/img',
);

async function snap(page: Page, name: string) {
  if (!process.env.RECORD_T65) return;
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, name) });
}

async function openMar(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/mar');
  await expect(page.getByTestId('mar-canvas')).toBeVisible();
  await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 30_000 });
  return errors;
}

/** Entero en pantalla y encima de todo en su centro (nada lo tapa). */
async function expectOnTop(el: Locator) {
  await expect(el).toBeVisible();
  await expect(el).toBeInViewport({ ratio: 1 });
  const onTop = await el.evaluate((node) => {
    const r = node.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && node.contains(hit);
  });
  expect(onTop, 'nada lo tapa').toBe(true);
}

const box = async (el: Locator) => (await el.boundingBox())!;
type Box = { x: number; y: number; width: number; height: number };
const apart = (a: Box, b: Box) =>
  a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;

/** Los enlaces de arriba: su texto y la sección de la landing a la que llevan. */
const LINKS = [
  { id: 'fotos', label: t('mar.hud.fotos'), section: 'fotos' },
  { id: 'contacto', label: t('mar.hud.contacto'), section: 'contacto' },
  { id: 'artistas', label: t('mar.hud.artistas'), section: 'artistas' },
  { id: 'shop', label: t('mar.hud.shop'), section: 'tienda' },
] as const;

/** Lo que el menú del juego tiene que llevar (secciones en su hoja). */
const MENU_ITEMS = [
  'mar-menu-logros',
  'mar-menu-carnet',
  'mar-barco',
  'mar-mis-codigos',
  'mar-mi-botella',
  'mar-ranking-abrir',
  'mar-menu-ajustes',
  'mar-menu-controles',
  'mar-menu-bienvenida',
] as const;

const VIEWS = [
  { name: 'móvil 375×812', project: 'mobile', viewport: { width: 375, height: 812 } },
  { name: 'escritorio', project: 'desktop', viewport: undefined },
] as const;

for (const view of VIEWS) {
  test.describe(`HUD v2 en ${view.name}`, () => {
    if (view.viewport) test.use({ viewport: view.viewport });
    test.beforeEach(() => {
      test.skip(test.info().project.name !== view.project, `sólo en el proyecto ${view.project}`);
    });

    test('arriba los enlaces a la web, a la izquierda el menú, abajo sólo «Entradas» y el turbo', async ({
      page,
    }) => {
      const errors = await openMar(page);
      const vp = page.viewportSize()!;

      // Arriba: Fotos, Contacto, Artistas, Carnet y Shop, en ese orden y a la vista.
      const nav = page.getByTestId('mar-enlaces');
      await expect(nav).toBeVisible();
      const items = nav.locator('a, button');
      await expect(items).toHaveText([
        LINKS[0].label,
        LINKS[1].label,
        LINKS[2].label,
        t('mar.hud.carnet'),
        LINKS[3].label,
      ]);
      for (const l of LINKS) {
        const a = nav.getByTestId(`mar-enlace-${l.id}`);
        await expect(a).toHaveAttribute('href', `/#${l.section}`);
        await expectOnTop(a);
      }
      const carnet = nav.getByTestId('mar-enlace-carnet');
      await expectOnTop(carnet);
      await expect(carnet).toHaveAttribute('aria-haspopup', 'dialog');
      const top = await box(nav);
      expect(top.y).toBeLessThan(vp.height * 0.06);

      // A la izquierda, el botón del menú (el icono de logros); arriba, el minimapa y los saldos.
      const menuBtn = page.getByTestId('mar-logros');
      await expectOnTop(menuBtn);
      const m = await box(menuBtn);
      expect(m.x + m.width / 2).toBeLessThan(vp.width / 3);
      await expect(menuBtn).toContainText('🏆');
      await expectOnTop(page.getByTestId('mar-minimapa'));
      await expect(page.getByTestId('mar-saldos')).toBeVisible();

      // Abajo, sólo «Entradas» (en el centro) y el turbo; nada de la barra de antes.
      const bar = page.getByTestId('mar-barra');
      await expect(bar.locator('button, a')).toHaveCount(2);
      const tickets = bar.getByTestId('mar-entradas');
      const turbo = bar.getByTestId('mar-turbo');
      await expect(tickets).toContainText(t('hud.tickets'));
      await expectOnTop(tickets);
      await expectOnTop(turbo);
      for (const gone of ['mar-barra-mapa', 'mar-barra-carnet', 'mar-barra-menu']) {
        await expect(page.getByTestId(gone)).toHaveCount(0);
      }
      const tb = await box(tickets);
      expect(Math.abs(tb.x + tb.width / 2 - vp.width / 2)).toBeLessThan(vp.width * 0.06);
      expect(tb.y + tb.height).toBeGreaterThan(vp.height - 90);
      const b = await box(bar);
      expect(b.height).toBeLessThanOrEqual(80);

      // Nada se pisa.
      const all: Box[] = [
        ...(await Promise.all((await items.all()).map(box))),
        ...(await Promise.all(
          [
            page.getByTestId('mar-minimapa'),
            page.getByTestId('mar-saldos'),
            menuBtn,
            tickets,
            turbo,
          ].map(box),
        )),
      ];
      for (let i = 0; i < all.length; i++)
        for (let j = i + 1; j < all.length; j++)
          expect(apart(all[i]!, all[j]!), `los mandos ${i} y ${j} no se pisan`).toBe(true);
      await snap(page, `p005-t65-hud-${view.project}.png`);
      expect(errors).toEqual([]);
    });

    test('el menú de la izquierda lo tiene todo; Carnet y «Mi Carnet» abren el menú en Mi Carnet', async ({
      page,
    }) => {
      const errors = await openMar(page);
      const menuBtn = page.getByTestId('mar-logros');
      await menuBtn.click();
      const menu = page.getByTestId('mar-menu');
      await expect(menu).toBeVisible();
      await expect(menuBtn).toHaveAttribute('aria-expanded', 'true');
      for (const id of MENU_ITEMS) await expect(menu.getByTestId(id), id).toBeVisible();
      // Logros, Mi Carnet, Barco, Ajustes, día/noche, Mundos y «Cómo jugar».
      await expect(menu.getByTestId('mar-menu-logros')).toContainText(t('mar.client.logros'));
      await expect(menu.getByTestId('mar-barco')).toContainText(t('mar.tienda.barco'));
      await expect(menu.getByTestId('mar-menu-ajustes')).toContainText(t('mar.menu.ajustes'));
      const howTo = menu.getByTestId('mar-menu-como-jugar');
      await expect(howTo).toContainText(t('mar.menu.comoJugar'));
      await expect(howTo.getByTestId('mar-menu-controles')).toBeVisible();
      await expect(howTo.getByTestId('mar-menu-bienvenida')).toBeVisible();
      await expect(menu.getByTestId('mar-menu-momento').getByRole('radio')).toHaveCount(3);
      await expect(menu.getByTestId('mar-menu-mundos-abrir')).toContainText(t('mar.client.mundos'));
      await menu.getByTestId('mar-menu-mundos-abrir').click();
      await expect(menu.getByTestId('mundos')).toBeVisible();
      await snap(page, `p005-t65-menu-${view.project}.png`);

      // El momento del día se cambia aquí mismo.
      await menu.getByTestId('mar-momento-noche').click();
      await expect(page.locator('main.mar')).toHaveAttribute('data-mood', 'noche');

      // «Cómo jugar» lleva a Welcome Aboard; «‹ Menú» vuelve al menú.
      await menu.getByTestId('mar-menu-bienvenida').click();
      const welcome = page.getByTestId('mar-bienvenida');
      await expect(welcome).toBeVisible();
      await welcome.getByTestId('mar-hoja-menu').click();
      await expect(welcome).toHaveCount(0);
      await expect(menu).toBeVisible();
      await menu.getByTestId('mar-menu-cerrar').click();
      await expect(menu).toHaveCount(0);

      // Carnet de arriba: no sale del juego, abre el menú en Mi Carnet.
      await page.getByTestId('mar-enlace-carnet').click();
      const carnet = page.getByTestId('mar-carnet');
      await expect(carnet).toBeVisible();
      await expect(page).toHaveURL(/\/mar/);
      await carnet.getByTestId('mar-hoja-menu').click();
      await expect(page.getByTestId('mar-menu')).toBeVisible();
      // «Mi Carnet» desde Logros, también: la misma sección del menú.
      await page.getByTestId('mar-menu-logros').click();
      await page.getByTestId('mar-logros-carnet').click();
      await expect(carnet).toBeVisible();
      await expect(carnet.getByTestId('mar-hoja-menu')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(carnet).toHaveCount(0);
      expect(errors).toEqual([]);
    });

    test('Fotos, Contacto, Artistas y Shop llevan a su sección de la landing; Contacto con la Filosofía', async ({
      page,
    }) => {
      await openMar(page);
      const hrefs: Record<string, string> = {};
      for (const l of LINKS) {
        hrefs[l.id] = (await page.getByTestId(`mar-enlace-${l.id}`).getAttribute('href'))!;
      }
      // Contacto, tocándolo: entra directa (D-21: con ancla no hay entrada) a su sección.
      await page.getByTestId('mar-enlace-contacto').click();
      await expect(page).toHaveURL(/\/#contacto$/);
      const contact = page.locator('#contacto');
      await expect(contact).toBeInViewport();
      const philosophy = SAMPLE_CONTENT.blocks.find((b) => b.type === 'philosophy')!;
      const data = SAMPLE_CONTENT.blocks.find((b) => b.type === 'contact')!;
      if (philosophy.type !== 'philosophy' || data.type !== 'contact') throw new Error('muestra');
      const inner = contact.getByTestId('contacto-filosofia');
      await expect(inner).toContainText(t('philosophy.heading'));
      await expect(inner).toContainText(philosophy.paragraphs[0]!);
      const datos = contact.getByTestId('contacto-datos');
      if (data.email) await expect(datos).toContainText(data.email);
      for (const l of data.links)
        await expect(datos.getByRole('link', { name: l.label })).toBeVisible();
      // La Filosofía ya no es otra sección: su ancla está dentro de Contacto.
      await expect(page.locator('#filosofia')).toHaveCount(1);
      await expect(contact.locator('#filosofia')).toHaveCount(1);
      await snap(page, `p005-t65-contacto-${view.project}.png`);

      // Los demás, a su sección, que existe en la landing.
      for (const l of LINKS) {
        await page.goto(hrefs[l.id]!);
        await expect(page.locator(`#${l.section}`), l.id).toBeAttached();
      }
    });

    test('el minimapa: arrastrarlo lejos a cada lado y volver no lo rompe (ni la carta)', async ({
      page,
    }) => {
      // Muchos gestos sobre el 3D (por software en la máquina de pruebas): más tiempo.
      test.setTimeout(360_000);
      const errors = await openMar(page);
      const vp = page.viewportSize()!;
      const mini = page.getByTestId('mar-minimapa');
      // Su sitio en la maqueta (sin transformaciones: la escala de «pulsado» no cuenta).
      const place = () =>
        mini.evaluate((node) => {
          const el = node as HTMLElement;
          let x = 0;
          let y = 0;
          for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) {
            x += n.offsetLeft;
            y += n.offsetTop;
          }
          return { x, y, w: el.offsetWidth, h: el.offsetHeight };
        });
      const home = await place();

      // 1. Un arrastre que empieza en el minimapa, lejos a cada lado y de vuelta:
      //    el minimapa sigue en su sitio, el mapa no se abre solo y tocarlo funciona.
      for (const dir of [1, -1]) {
        const cx = home.x + home.w / 2;
        const cy = home.y + home.h / 2;
        await page.mouse.move(cx, cy);
        await page.mouse.down();
        await page.waitForTimeout(600); // pulsación larga: el gesto ya «arrastra»
        const far = dir > 0 ? vp.width - 4 : 4;
        for (let i = 1; i <= 4; i++) await page.mouse.move(cx + ((far - cx) * i) / 4, cy + i * 20);
        for (let i = 3; i >= 0; i--) await page.mouse.move(cx + ((far - cx) * i) / 4, cy + i * 20);
        await page.mouse.up();
        await expect(mini).toHaveAttribute('aria-pressed', 'false');
        expect(await place()).toEqual(home);
        await expect(mini).toBeInViewport({ ratio: 1 });
      }
      await mini.click();
      await expect(mini).toHaveAttribute('aria-pressed', 'true');

      // 2. La carta (el mapa grande) arrastrada muy a cada lado: se mueve entera,
      //    sin que ninguna isla salte al otro lado, y no se va de la pantalla.
      const pins = async () => {
        const read = () =>
          page.evaluate(() =>
            Object.fromEntries(
              [...document.querySelectorAll<HTMLElement>('.mar-pin.is-on[data-pin]')].map((el) => {
                const r = el.getBoundingClientRect();
                return [el.dataset.pin!, { x: r.left + r.width / 2, y: r.bottom }];
              }),
            ),
          );
        // Quieta: dos lecturas seguidas iguales (la cámara llega suave).
        let prev = await read();
        for (let i = 0; i < 40; i++) {
          await page.waitForTimeout(250);
          const now = await read();
          const same =
            Object.keys(now).length === Object.keys(prev).length &&
            Object.entries(now).every(
              ([id, p]) => prev[id] && Math.hypot(p.x - prev[id]!.x, p.y - prev[id]!.y) < 1,
            );
          if (same) return now;
          prev = now;
        }
        return prev;
      };
      const start = await pins();
      const ids = Object.keys(start);
      expect(ids.length, 'islas a la vista en el mapa').toBeGreaterThanOrEqual(4);

      const dragChart = async (dir: 1 | -1) => {
        for (let k = 0; k < 3; k++) {
          const x0 = dir > 0 ? vp.width * 0.15 : vp.width * 0.85;
          const y = vp.height * 0.45;
          await page.mouse.move(x0, y);
          await page.mouse.down();
          for (let i = 1; i <= 6; i++)
            await page.mouse.move(x0 + (dir * vp.width * 0.7 * i) / 6, y);
          await page.mouse.up();
        }
      };
      for (const dir of [1, -1] as const) {
        await dragChart(dir);
        const now = await pins();
        const common = ids.filter((id) => now[id]);
        expect(common.length, 'la carta no se va de la pantalla').toBeGreaterThanOrEqual(
          Math.min(3, ids.length),
        );
        // Todas se movieron casi lo mismo (sin saltos de un lado al otro) y en orden.
        const dx = common.map((id) => now[id]!.x - start[id]!.x);
        expect(Math.max(...dx) - Math.min(...dx), 'se mueve entera').toBeLessThan(vp.width * 0.2);
        expect(Math.abs(dx[0]!), 'hasta un límite').toBeLessThan(vp.width * 0.6);
        for (const a of common)
          for (const b of common)
            if (start[a]!.x + 20 < start[b]!.x)
              expect(now[a]!.x, `${a} sigue a la izquierda de ${b}`).toBeLessThan(now[b]!.x);
        await snap(page, `p005-t65-carta-${dir > 0 ? 'derecha' : 'izquierda'}-${view.project}.png`);
      }

      // 3. Y vuelve: cerrar y abrir el mapa la deja como al principio; el minimapa sigue funcionando.
      await mini.click();
      await expect(mini).toHaveAttribute('aria-pressed', 'false');
      await mini.click();
      await expect(mini).toHaveAttribute('aria-pressed', 'true');
      const back = await pins();
      for (const id of ids.filter((i) => back[i])) {
        expect(Math.abs(back[id]!.x - start[id]!.x), id).toBeLessThan(vp.width * 0.05);
      }
      await mini.click();
      await expect(mini).toHaveAttribute('aria-pressed', 'false');
      expect(errors).toEqual([]);
    });
  });
}

test.describe('tarjetas y avisos (móvil 375×812)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('la ficha de una isla: una tarjeta pequeña abajo que se despliega al tocarla', async ({
    page,
  }) => {
    const errors = await openMar(page);
    const vp = page.viewportSize()!;
    await page.getByTestId('mar-minimapa').click();
    await page.locator('[data-pin="allday"]').dispatchEvent('click');
    const sheet = page.getByTestId('mar-ficha');
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveAttribute('data-expandida', 'no');
    // Lo esencial y un solo botón; «Entradas» sigue a la vista, debajo.
    await expect(sheet.getByTestId('mar-rumbo')).toBeVisible();
    await expect(sheet.getByTestId('mar-volar')).toHaveCount(0);
    const small = await box(sheet);
    expect(small.height).toBeLessThanOrEqual(vp.height * 0.3);
    expect(small.y + small.height).toBeLessThanOrEqual(
      (await box(page.getByTestId('mar-entradas'))).y,
    );
    await expectOnTop(page.getByTestId('mar-entradas'));

    // Tocar la tarjeta (no su botón) la despliega entera.
    await sheet.locator('.mar-sheet__title').click();
    await expect(sheet).toHaveAttribute('data-expandida', 'si');
    await expect(sheet.getByTestId('mar-volar')).toBeVisible();
    await expect.poll(async () => (await box(sheet)).height).toBeGreaterThan(small.height);
    await expectOnTop(page.getByTestId('mar-entradas'));

    // Y vuelve a recogerse.
    await sheet.getByTestId('mar-ficha-mas').click();
    await expect(sheet).toHaveAttribute('data-expandida', 'no');
    await expect(sheet.getByTestId('mar-volar')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('los avisos son chips pequeños arriba que se van solos', async ({ page }) => {
    // «Entradas» abre «Elige tu evento» (T58) y su compra, dentro del mar: una compra da avisos.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors = await openMar(page);
    const vp = page.viewportSize()!;
    await page.getByTestId('mar-entradas').click();
    await page
      .getByTestId(/^mar-entradas-comprar-/)
      .first()
      .click();
    const checkout = page.getByTestId('checkout');
    // Sin Carnet, la compra pregunta antes (T66): se sigue sin él.
    await checkout.getByTestId('checkout-sin-carnet').click();
    await checkout.getByTestId('checkout-confirmar').click();
    await expect(checkout.getByTestId('checkout-resultado')).toBeVisible();
    await checkout.getByTestId('checkout-cerrar').click();
    await expect(checkout).toBeHidden();

    const chip = page.getByTestId('mar-aviso').first();
    await expect(chip).toBeVisible();
    const c = await box(chip);
    expect(c.height).toBeLessThanOrEqual(56);
    expect(c.y + c.height).toBeLessThan(vp.height * 0.2);
    // No pisa el minimapa, los saldos, los enlaces ni el botón del menú.
    for (const other of [
      page.getByTestId('mar-minimapa'),
      page.getByTestId('mar-saldos'),
      page.getByTestId('mar-enlaces'),
      page.getByTestId('mar-logros'),
    ]) {
      expect(apart(c, await box(other)), 'el chip no pisa el HUD de arriba').toBe(true);
    }
    // Sin tocarlo, se va solo (con su tiempo de lectura, D-22).
    await expect(page.getByTestId('mar-aviso')).toHaveCount(0, { timeout: 45_000 });
    expect(errors).toEqual([]);
  });
});

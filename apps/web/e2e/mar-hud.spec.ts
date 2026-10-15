import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAMPLE_CONTENT } from '../lib/landing/sample-content';
import { t } from '../lib/i18n';
import { ONLINE_EVENT } from './online-event';
import { seedCarnet } from './carnet-seed';

/**
 * El HUD de /mar (T65, decisión de Hernán y Álvaro del 2026-10-02, que
 * sustituye la barra de T53; REQ-PRO-008, REQ-PRO-009): arriba, los enlaces a
 * la web (Fotos, Shop, Artistas y Contacto salen a su sección de la landing;
 * Carnet, el último desde T68, abre el menú del juego en Mi Carnet); a la izquierda, el botón del
 * menú del juego con el icono de logros y todo dentro; abajo, sólo «Entradas»
 * y el turbo. El minimapa se queda y su arrastre ya no rompe nada; se mueve
 * sólo con «Mover el minimapa» de Ajustes (T298). Las
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

/** Los enlaces de arriba, en su orden (T68): su texto y la sección de la landing a la que llevan. */
const LINKS = [
  { id: 'fotos', label: t('mar.hud.fotos'), section: 'fotos' },
  { id: 'shop', label: t('mar.hud.shop'), section: 'tienda' },
  { id: 'artistas', label: t('mar.hud.artistas'), section: 'artistas' },
  { id: 'contacto', label: t('mar.hud.contacto'), section: 'contacto' },
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

      // Arriba: Fotos, Shop, Artistas, Contacto y Carnet (T68), en ese orden y a la vista.
      const nav = page.getByTestId('mar-enlaces');
      await expect(nav).toBeVisible();
      const items = nav.locator('a, button');
      await expect(items).toHaveText([...LINKS.map((l) => l.label), t('mar.hud.carnet')]);
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
      // El icono de Logros de la familia de BOIA (T114), decorativo: el nombre es el del menú.
      await expect(menuBtn.locator('[data-icon="logros"]')).toBeVisible();
      await expect(menuBtn).toHaveAccessibleName(new RegExp(`^${t('mar.menu.titulo')}`));
      await expectOnTop(page.getByTestId('mar-minimapa'));
      await expect(page.getByTestId('mar-saldos')).toBeVisible();

      // Abajo, sólo «Entradas» (en el centro), la bocina (T271) y el turbo; nada de la barra de antes.
      const bar = page.getByTestId('mar-barra');
      await expect(bar.locator('button, a')).toHaveCount(3);
      const tickets = bar.getByTestId('mar-entradas');
      const turbo = bar.getByTestId('mar-turbo');
      const horn = bar.getByTestId('mar-bocina');
      await expect(tickets).toContainText(t('hud.tickets'));
      await expectOnTop(tickets);
      await expectOnTop(turbo);
      await expectOnTop(horn);
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
            horn,
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
      // Iconos de BOIA (T114): uno distinto por entrada, decorativo, con su nombre en
      // texto; no encoge la zona táctil y su contorno contrasta con la hoja (≥ 3:1).
      const icons = new Set<string>();
      for (const id of MENU_ITEMS) {
        const tile = menu.getByTestId(id);
        const icon = tile.locator('.mar-menu__icon [data-icon]');
        await expect(icon, id).toBeVisible();
        await expect(tile.locator('.mar-menu__icon'), id).toHaveAttribute('aria-hidden', 'true');
        icons.add((await icon.getAttribute('data-icon'))!);
        const name = tile.locator('.mar-menu__name');
        const label = (await name.innerText()).replace(/\s+/g, ' ').trim();
        expect(label, id).not.toBe('');
        const whole = await name.evaluate((el) => el.scrollWidth <= el.clientWidth);
        expect(whole, `${id}: el nombre se lee entero`).toBe(true);
        await expect(tile, id).toHaveAccessibleName(new RegExp(`^${label}`));
        const tb = await box(tile);
        const ib = await box(icon);
        expect(Math.min(tb.width, tb.height), id).toBeGreaterThanOrEqual(44);
        expect(ib.width, id).toBeGreaterThanOrEqual(20);
        expect(ib.x >= tb.x && ib.x + ib.width <= tb.x + tb.width, id).toBe(true);
        const contrast = await icon.evaluate((el) => {
          const lum = (css: string) => {
            const [r, g, b] = css
              .match(/[\d.]+/g)!
              .slice(0, 3)
              .map((v) => Number(v) / 255)
              .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
            return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
          };
          const a = lum(getComputedStyle(el).color);
          const b = lum(getComputedStyle(el.closest('.mar-logros__sheet')!).backgroundColor);
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        });
        expect(contrast, id).toBeGreaterThanOrEqual(3);
      }
      expect(icons.size).toBe(MENU_ITEMS.length);
      await expect(menu.getByTestId('mar-menu-momento').locator('[data-icon]')).toHaveCount(3);
      // Logros, Mi Carnet, Barco, Ajustes, día/noche y «Cómo jugar».
      await expect(menu.getByTestId('mar-menu-logros')).toContainText(t('mar.client.logros'));
      await expect(menu.getByTestId('mar-barco')).toContainText(t('mar.tienda.barco'));
      await expect(menu.getByTestId('mar-menu-ajustes')).toContainText(t('mar.menu.ajustes'));
      const howTo = menu.getByTestId('mar-menu-como-jugar');
      await expect(howTo).toContainText(t('mar.menu.comoJugar'));
      await expect(howTo.getByTestId('mar-menu-controles')).toBeVisible();
      await expect(howTo.getByTestId('mar-menu-bienvenida')).toBeVisible();
      await expect(menu.getByTestId('mar-menu-momento').getByRole('radio')).toHaveCount(3);
      // Un solo mundo jugable (T122): el menú ya no ofrece «Mundos».
      await expect(menu.getByTestId('mar-menu-mundos')).toHaveCount(0);
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

    test('el minimapa se mueve con «Mover el minimapa» de Ajustes, sin abrir el mapa, y sigue ahí al recargar (T298)', async ({
      page,
    }) => {
      test.setTimeout(240_000);
      const errors = await openMar(page);
      const vp = page.viewportSize()!;
      const mini = page.getByTestId('mar-minimapa');
      const centerX = async () => {
        const b = await box(mini);
        return b.x + b.width / 2;
      };
      // De salida, arriba a la izquierda (encima del Menú).
      await expect(mini).toHaveAttribute('data-zona', 'top-left');
      expect(await centerX()).toBeLessThan(vp.width / 2);

      // Menú → Ajustes → «Mover el minimapa»: la hoja se cierra y el minimapa queda en modo mover.
      await page.getByTestId('mar-logros').click();
      await page.getByTestId('mar-menu-ajustes').click();
      await page.getByTestId('mar-ajustes-mover-minimapa').click();
      await expect(page.getByTestId('mar-ajustes')).toHaveCount(0);
      await expect(mini).toHaveAttribute('data-moviendo', 'si');
      await expect(mini).toHaveAccessibleName(t('mar.minimap.moverAria'));

      // Arrastrarlo al otro lado (con una pausa larga, como el toque largo que abre el mapa):
      // se suelta a la derecha y el mapa grande no se abre.
      const start = await box(mini);
      const cx = start.x + start.width / 2;
      const cy = start.y + start.height / 2;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.waitForTimeout(600);
      const to = vp.width - start.width / 2 - 12;
      for (let i = 1; i <= 6; i++) await page.mouse.move(cx + ((to - cx) * i) / 6, cy + i * 2);
      await page.mouse.up();
      await expect(mini).toHaveAttribute('aria-pressed', 'false');
      await expect(mini).toHaveAttribute('data-zona', 'top-right');
      await expect(mini).not.toHaveAttribute('data-moviendo', 'si');
      await expect(page.locator('main.mar')).toHaveAttribute('data-minimapa', 'derecha');
      await expect.poll(centerX).toBeGreaterThan(vp.width / 2);
      await expectOnTop(mini);
      // Los saldos se van a la izquierda y nada se pisa.
      const saldos = await box(page.getByTestId('mar-saldos'));
      expect(saldos.x + saldos.width / 2).toBeLessThan(vp.width / 2);
      for (const other of ['mar-saldos', 'mar-enlaces', 'mar-logros']) {
        expect(apart(await box(mini), await box(page.getByTestId(other))), other).toBe(true);
      }
      // Fuera del modo mover, tocarlo sigue abriendo y cerrando el mapa.
      await mini.click();
      await expect(mini).toHaveAttribute('aria-pressed', 'true');
      await mini.click();
      await expect(mini).toHaveAttribute('aria-pressed', 'false');

      // Al recargar, sigue a la derecha.
      await page.reload();
      await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 30_000 });
      await expect(mini).toHaveAttribute('data-zona', 'top-right');
      await expect.poll(centerX).toBeGreaterThan(vp.width / 2);

      // En modo mover, tocarlo lo cambia de lado (y tampoco abre el mapa).
      await page.getByTestId('mar-logros').click();
      await page.getByTestId('mar-menu-ajustes').click();
      await page.getByTestId('mar-ajustes-mover-minimapa').click();
      await expect(mini).toHaveAttribute('data-moviendo', 'si');
      await mini.click();
      await expect(mini).toHaveAttribute('data-zona', 'top-left');
      await expect(mini).toHaveAttribute('aria-pressed', 'false');
      await expect.poll(centerX).toBeLessThan(vp.width / 2);
      expect(errors).toEqual([]);
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
                // La punta del rótulo (su isla), no su caja: el reparto de rótulos (T280) aparta
                // las cajas de los mandos y de otras islas, y la punta (`--pin-tip`) sigue a la isla.
                const tip = parseFloat(el.style.getPropertyValue('--pin-tip')) || 0;
                const scale = el.offsetWidth ? r.width / el.offsetWidth : 1;
                return [el.dataset.pin!, { x: r.left + r.width / 2 + tip * scale, y: r.bottom }];
              }),
            ),
          );
        // Quieta: dos lecturas seguidas iguales (la cámara llega suave).
        let prev: Awaited<ReturnType<typeof read>> | undefined;
        await expect
          .poll(
            async () => {
              const now = await read();
              const previous = prev;
              const same =
                !!previous &&
                Object.keys(now).length === Object.keys(previous).length &&
                Object.entries(now).every(
                  ([id, p]) =>
                    previous[id] && Math.hypot(p.x - previous[id]!.x, p.y - previous[id]!.y) < 1,
                );
              prev = now;
              return same;
            },
            { intervals: [250], timeout: 30_000 },
          )
          .toBe(true);
        return prev!;
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
    // Lo esencial y las dos maneras de ir (T96); «Entradas» sigue a la vista, debajo.
    await expect(sheet.getByTestId('mar-rumbo')).toBeVisible();
    await expect(sheet.getByTestId('mar-volar')).toBeVisible();
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
    await expect(sheet.getByTestId('mar-rumbo')).toBeVisible();
    await expect(sheet.getByTestId('mar-volar')).toBeVisible();
    await expect.poll(async () => (await box(sheet)).height).toBeLessThanOrEqual(vp.height * 0.3);
    expect(errors).toEqual([]);
  });

  test('los avisos son chips pequeños arriba que se van solos', async ({ page }) => {
    // «Entradas» abre «Elige tu evento» (T58) y su compra, dentro del mar: una compra da avisos.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // Comprar pide el Carnet BOIA (plan 019): se viene con uno.
    await seedCarnet(page);
    const errors = await openMar(page);
    const vp = page.viewportSize()!;
    await page.getByTestId('mar-entradas').click();
    await page.getByTestId(`mar-entradas-comprar-${ONLINE_EVENT.id}`).click();
    const checkout = page.getByTestId('checkout');
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

test.describe('móvil pequeño 360×640 (plan 032 T299)', () => {
  test.use({ viewport: { width: 360, height: 640 } });

  test('el mapa grande: ningún rótulo bajo el «Cerrar» ni encima de otro', async ({ page }) => {
    test.setTimeout(240_000);
    const errors = await openMar(page);
    await page.getByTestId('mar-minimapa').click();
    await expect(page.getByTestId('mar-minimapa')).toHaveAttribute('aria-pressed', 'true');
    const read = () =>
      page.evaluate(() => {
        const rect = (el: Element) => {
          const r = el.getBoundingClientRect();
          return {
            id: (el as HTMLElement).dataset.pin ?? '',
            l: r.left,
            t: r.top,
            r: r.right,
            b: r.bottom,
          };
        };
        const alpha = (el: Element) => {
          const v = parseFloat(getComputedStyle(el).getPropertyValue('--pin-alpha'));
          return Number.isNaN(v) ? 1 : v;
        };
        const close = document.querySelector('.mar-mapclose');
        return {
          close: close ? rect(close) : null,
          pins: [...document.querySelectorAll('.mar-pin.is-on[data-pin]')]
            .filter((el) => !el.classList.contains('is-behind') && alpha(el) > 0.9)
            .map(rect),
        };
      });
    // Quieta: la cámara del mapa llega suave.
    let prev = '';
    await expect
      .poll(
        async () => {
          const now = JSON.stringify(await read());
          const same = now === prev;
          prev = now;
          return same;
        },
        { intervals: [400], timeout: 30_000 },
      )
      .toBe(true);
    const { close, pins } = await read();
    expect(close, 'el «Cerrar» del mapa').not.toBeNull();
    expect(pins.length, 'rótulos a la vista').toBeGreaterThanOrEqual(4);
    const hit = (a: NonNullable<typeof close>, b: NonNullable<typeof close>) =>
      a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
    for (const p of pins) {
      expect(hit(p, close!), `${p.id} bajo el «Cerrar»`).toBe(false);
      for (const q of pins) if (p.id < q.id) expect(hit(p, q), `${p.id} / ${q.id}`).toBe(false);
    }
    expect(errors).toEqual([]);
  });

  test('si el navegador quita el 3D, el mar se para con un aviso y sigue al volver', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const errors = await openMar(page);
    const canvas = page.getByTestId('mar-canvas');
    await expect(canvas).toHaveAttribute('data-gl', 'running');
    const lose = (action: 'loseContext' | 'restoreContext') =>
      page.evaluate((a) => {
        const el = document.querySelector('[data-testid="mar-canvas"]') as HTMLCanvasElement;
        // Con el contexto perdido `getExtension` da null: la extensión se guarda la primera vez.
        const w = window as unknown as { __loseCtx?: WEBGL_lose_context };
        if (!w.__loseCtx) {
          const gl = el.getContext('webgl2') ?? el.getContext('webgl');
          w.__loseCtx = gl!.getExtension('WEBGL_lose_context')!;
        }
        w.__loseCtx[a]();
      }, action);
    await lose('loseContext');
    await expect(canvas).toHaveAttribute('data-gl', 'lost');
    const aviso = page.getByTestId('mar-gl-aviso');
    await expect(aviso).toBeVisible();
    await expectOnTop(aviso);
    expect((await box(aviso)).width).toBeLessThanOrEqual(360);
    await lose('restoreContext');
    await expect(canvas).toHaveAttribute('data-gl', 'running');
    await expect(aviso).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

import { circuitFromWorld } from '@boia/engine/circuit';
import { RACE_FAST_ACHIEVEMENT, SAMPLE_ACHIEVEMENTS, SAMPLE_CREW } from '@boia/store';
import { CIRCUIT_ID, WORLD_REGISTRY } from '@boia/world';
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marWorld } from '../app/mar/engine/compact';
import { MAR_SHIP_CONFIG, RACE_SHIP_CONFIG } from '../app/mar/engine/steering';
import { lapTargets } from '../app/mar/race';
import { SAMPLE_CIRCUIT_MS } from '../lib/mundo/ranking-circuit';

/**
 * Los Rápidos en /mar (T61, T73, REQ-AVE-026…028): un circuito cerrado de
 * tres vueltas marcado por boias por todo el mapa. Desde cerca de la salida
 * se ve el récord; llegar a ella ya no arranca la carrera: una tarjeta la
 * explica y pregunta, y «Empezar» enciende el semáforo y deja el barco
 * quieto hasta «¡Ya!»; el cronómetro pequeño de arriba dice la vuelta y la
 * boia que tocan. Una carrera con el teclado (a cada boia en orden, tres
 * vueltas) termina con medalla, tiempo, récord y el puesto entre la
 * tripulación de muestra en una tarjeta pequeña, y «Otra vez» corre contra
 * el fantasma de esa carrera. Móvil y escritorio. Se explora y se espera
 * la salida a 15 nudos; sólo con el cronómetro corriendo, a 22 (T109).
 *
 * Con RECORD_T61=1 deja capturas en docs/informes/img/ p005-t61-*.png (móvil).
 */

test.describe.configure({ timeout: 300_000 });

const world = marWorld(WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config);
const spec = circuitFromWorld(world, CIRCUIT_ID)!;
const targets = lapTargets(world, spec);
const start = targets.at(-1)!;
/** El nombre del circuito en el mundo (el de su salida): «Los Rápidos». */
const placeName = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config.objects.find(
  (o) => o.identity.id === start.id,
)!.identity.name;

const mar = (page: Page) => page.locator('main.mar');
/** La tripulación de muestra con tiempo en el circuito: contra ella se compite en esta versión. */
const timedCrew = SAMPLE_CREW.filter((c) => SAMPLE_CIRCUIT_MS[c.userId] !== undefined);
const crono = (page: Page) => page.getByTestId('mar-crono');
/** Las marcas amarillas de la ruta entre islas (decisión 13, T88): `on` u `off`. */
const ruta = (page: Page) => page.getByTestId('mar-canvas');
/**
 * La física del barco (T109): `carrera` (22 nudos) sólo con el cronómetro
 * corriendo; si no, `crucero` (15).
 */
const manejo = (page: Page) => page.getByTestId('mar-canvas');
/** Lo más rápido que marcó el velocímetro durante el último `pilot` (nudos). */
const topKnots = (page: Page) =>
  page.evaluate(() => (window as unknown as { topNudos?: number }).topNudos ?? 0);
const CRUISE_KNOTS = MAR_SHIP_CONFIG.maxSpeed / 10;
const RACE_KNOTS = RACE_SHIP_CONFIG.maxSpeed / 10;

const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../docs/informes/img',
);

async function snap(page: Page, name: string) {
  if (test.info().project.name !== 'mobile' || !process.env.RECORD_T61) return;
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, name) });
}

async function openMar(page: Page, query = '') {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`/mar${query}`);
  await expect(page.getByTestId('mar-canvas')).toBeVisible();
  await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 30_000 });
  await expect(mar(page)).toHaveAttribute('data-barco', /\d/);
  return errors;
}

type Point = { x: number; y: number };

/**
 * Qué quiere el piloto: `intro` (hasta ver el récord junto a la salida),
 * `offer` (hasta que llegar a la salida saca la tarjeta que pregunta si
 * empezar), `race` (boia a boia hasta la tarjeta de meta) o `skip` (a la
 * boia 1 y, sin pasar por la 2, de vuelta a la salida hasta el aviso).
 */
type Goal = 'intro' | 'offer' | 'race' | 'skip';

/**
 * Pilota dentro de la página, con las flechas, una decisión por fotograma:
 * así el gobierno va al paso del barco aunque la página vaya lenta (en el
 * navegador sin GPU de las pruebas cada orden de Playwright tarda casi un
 * segundo). Lee la posición (`data-barco`) y lo que pide el cronómetro.
 */
async function pilot(page: Page, goal: Goal, ms = 200_000): Promise<string> {
  return page.evaluate(
    async ({ goal, targets, start, ms }) => {
      const main = document.querySelector<HTMLElement>('main.mar')!;
      const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
      const held = new Set<string>();
      const press = (keys: string[]) => {
        for (const k of [...held]) {
          if (keys.includes(k)) continue;
          window.dispatchEvent(new KeyboardEvent('keyup', { key: k, code: k }));
          held.delete(k);
        }
        for (const k of keys) {
          if (held.has(k)) continue;
          window.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: k }));
          held.add(k);
        }
      };
      const steer = (t: Point) => {
        const [x, y] = (main.dataset.barco ?? '0,0').split(',').map(Number);
        const dx = t.x - x!;
        const dy = t.y - y!;
        const d = Math.hypot(dx, dy) || 1;
        const keys: string[] = [];
        if (dx / d > 0.38) keys.push('ArrowRight');
        if (dx / d < -0.38) keys.push('ArrowLeft');
        if (dy / d > 0.38) keys.push('ArrowDown');
        if (dy / d < -0.38) keys.push('ArrowUp');
        press(keys);
      };
      const until = performance.now() + ms;
      // Lo más rápido que marca el velocímetro mientras pilota (T109).
      const top = window as unknown as { topNudos?: number };
      top.topNudos = 0;
      const knots = () => Number(document.querySelector('.mar-speed strong')?.textContent ?? 0);
      // Si se acaba sin meta, por qué: los avisos a la vista y dónde estaba.
      const why = () =>
        [...document.querySelectorAll('[data-testid="mar-aviso"]')]
          .map((n) => n.textContent)
          .join(' / ') + ` @ ${main.dataset.barco ?? ''}`;
      let skipped = false;
      try {
        while (performance.now() < until) {
          top.topNudos = Math.max(top.topNudos ?? 0, knots());
          const chip = q('mar-crono');
          if (goal === 'intro') {
            const intro = q('mar-carrera-salida');
            if (intro) return intro.textContent ?? '';
            steer(start);
          } else if (goal === 'offer') {
            if (chip) return `carrera sin preguntar: ${chip.dataset.fase ?? ''}`;
            if (q('mar-carrera-oferta')) return 'offer';
            steer(start);
          } else if (goal === 'race') {
            if (q('mar-carrera-final')) return 'ok';
            if (!chip) return `sin carrera: ${why()}`;
            const buoy = Number(chip.dataset.boia);
            steer(buoy === 0 ? start : targets[buoy - 1]!);
          } else {
            const notice = [...document.querySelectorAll('[data-testid="mar-aviso"]')].some((n) =>
              /boia 2/i.test(n.textContent ?? ''),
            );
            if (notice) return 'ok';
            if (!chip) return 'sin carrera';
            if (Number(chip.dataset.boia) === 2) skipped = true;
            steer(skipped ? start : targets[0]!);
          }
          await new Promise((r) => requestAnimationFrame(r));
        }
        return 'tiempo';
      } finally {
        press([]);
      }
    },
    { goal, targets, start, ms },
  );
}

/**
 * Llega a la salida: sale la tarjeta que explica la carrera y no empieza
 * sola; «Empezar» lanza la cuenta atrás. El barco se queda quieto en la
 * salida durante ella aunque se pulse adelante, y sale al «¡Ya!».
 */
async function startRace(page: Page) {
  expect(await pilot(page, 'offer')).toBe('offer');
  // Hasta la salida, a 15 nudos como siempre que no se corre (T109).
  expect(await topKnots(page)).toBeLessThanOrEqual(CRUISE_KNOTS);
  await expect(manejo(page)).toHaveAttribute('data-manejo', 'crucero');
  const offer = page.getByTestId('mar-carrera-oferta');
  await expect(offer).toBeVisible();
  await expect(offer).toContainText(placeName);
  await expect(offer).toContainText(String(spec.laps));
  await expect(offer).toContainText(/fantasma/i);
  // Sin «Empezar» no hay carrera.
  await page.waitForTimeout(1500);
  await expect(crono(page)).toHaveCount(0);
  // Sin carrera, las marcas amarillas guían entre islas.
  await expect(ruta(page)).toHaveAttribute('data-ruta', 'on');
  await snap(page, 'p006-t73-oferta.png');
  await page.getByTestId('mar-carrera-empezar').click();
  await expect(offer).toHaveCount(0);
  await expect(crono(page)).toHaveAttribute('data-fase', 'countdown');
  // Desde la cuenta atrás, sin marcas amarillas (decisión 13, T88).
  await expect(ruta(page)).toHaveAttribute('data-ruta', 'off');
  // La cuenta atrás aún no es carrera: crucero (T109).
  await expect(manejo(page)).toHaveAttribute('data-manejo', 'crucero');
  // La posición se publica cuatro veces por segundo: la primera puede ser de antes de
  // quedarse en la salida. Desde que está en ella, no se mueve hasta «¡Ya!».
  const moved = await page.evaluate(async (p) => {
    const main = document.querySelector<HTMLElement>('main.mar')!;
    const chip = () => document.querySelector<HTMLElement>('[data-testid="mar-crono"]');
    const off = () => {
      const [x, y] = (main.dataset.barco ?? '0,0').split(',').map(Number);
      return Math.hypot(x! - p.x, y! - p.y);
    };
    let reached = false;
    let most = 0;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', code: 'ArrowUp' }));
    while (chip()?.dataset.fase === 'countdown') {
      const d = off();
      if (d < 2) reached = true;
      if (reached) most = Math.max(most, d);
      await new Promise((r) => requestAnimationFrame(r));
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp', code: 'ArrowUp' }));
    return reached ? most : Infinity;
  }, start);
  expect(moved, 'quieto en la salida durante la cuenta atrás').toBeLessThan(2);
  await expect(crono(page)).toHaveAttribute('data-fase', 'racing');
  await expect(ruta(page)).toHaveAttribute('data-ruta', 'off');
  // Con el cronómetro corriendo, la física de carrera: 22 nudos (T109).
  await expect(manejo(page)).toHaveAttribute('data-manejo', 'carrera');
}

test('Los Rápidos: pregunta en la salida, tres vueltas por las boias, medalla, récord y puesto; la segunda, contra el fantasma', async ({
  page,
}) => {
  const errors = await openMar(page, `?cerca=${start.id}`);
  // Antes de correr, al acercarse a la salida: el circuito y que aún no hay récord.
  // (Se lee al vuelo: el barco sigue hacia la salida, donde sale la tarjeta de empezar.)
  const intro = await pilot(page, 'intro');
  expect(intro).toContain(placeName);
  expect(intro).not.toMatch(/\d,\d/);

  await startRace(page);
  // El cronómetro pequeño de arriba: vuelta 1 de 3, boia 1, sin fantasma la primera vez.
  await expect(crono(page)).toHaveAttribute('data-vuelta', '1');
  await expect(crono(page)).toHaveAttribute('data-boia', '1');
  await expect(crono(page)).toHaveAttribute('data-fantasma', 'no');
  await expect(crono(page)).toContainText(`1/${spec.laps}`);
  const box = await crono(page).boundingBox();
  const view = page.viewportSize()!;
  expect(box!.y, 'arriba').toBeLessThan(view.height * 0.25);
  expect(box!.height, 'pequeño').toBeLessThan(80);
  await snap(page, 'p005-t61-carrera.png');

  expect(await pilot(page, 'race')).toBe('ok');
  // Corriendo, el velocímetro llega a los 22 nudos de carrera (T109).
  expect(await topKnots(page)).toBeGreaterThanOrEqual(RACE_KNOTS);
  const card = page.getByTestId('mar-carrera-final');
  await expect(card).toBeVisible();
  // En meta vuelven las marcas amarillas y el crucero de 15 nudos (T109).
  await expect(ruta(page)).toHaveAttribute('data-ruta', 'on');
  await expect(manejo(page)).toHaveAttribute('data-manejo', 'crucero');
  await expect(card).toHaveAttribute('data-medalla', /^(gold|silver|bronze)$/);
  await expect(page.getByTestId('mar-carrera-tiempo')).toContainText(/\d+,\d/);
  await expect(page.getByTestId('mar-carrera-record')).toBeVisible();
  await expect(crono(page)).toHaveCount(0);
  // Contra los demás (la tripulación de muestra) y contra ti (tu récord, que es esta carrera).
  await expect(page.getByTestId('mar-carrera-puesto')).toContainText(String(timedCrew.length + 1));
  const table = page.getByTestId('mar-carrera-ranking');
  for (const c of timedCrew) await expect(table).toContainText(c.nickname);
  await expect(table.locator('li')).toHaveCount(timedCrew.length + 1);
  const mine = table.locator('li[data-mio="si"]');
  await expect(mine).toHaveCount(1);
  const time = (await page.getByTestId('mar-carrera-tiempo').textContent())!.match(/[\d:,]+\d/)![0];
  await expect(mine).toContainText(time);
  await snap(page, 'p005-t61-meta.png');

  // «Otra vez»: cuenta atrás desde la salida y, tras «¡Ya!», el fantasma de la mejor carrera.
  await page.getByTestId('mar-carrera-otra').click();
  await expect(card).toHaveCount(0);
  await expect(crono(page)).toHaveAttribute('data-fase', 'racing', { timeout: 10_000 });
  await expect(ruta(page)).toHaveAttribute('data-ruta', 'off');
  await expect(manejo(page)).toHaveAttribute('data-manejo', 'carrera');
  await expect(crono(page)).toHaveAttribute('data-fantasma', 'si');
  await expect(page.getByTestId('mar-canvas')).toHaveAttribute('data-ghost', 'on');
  await snap(page, 'p005-t61-fantasma.png');
  expect(errors).toEqual([]);
});

test('saltarse una boia no cuenta la vuelta: el aviso dice cuál falta', async ({ page }) => {
  const errors = await openMar(page, `?cerca=${start.id}`);
  await startRace(page);
  // A la boia 1 y, sin pasar por la 2, de vuelta a la salida: avisa y la vuelta sigue en la 1.
  expect(await pilot(page, 'skip', 90_000)).toBe('ok');
  await expect(crono(page)).toHaveAttribute('data-vuelta', '1');
  await expect(crono(page)).toHaveAttribute('data-boia', '2');
  await expect(ruta(page)).toHaveAttribute('data-ruta', 'off');
  // Abrir un panel anula la carrera: vuelven las marcas amarillas (T88).
  await page.getByTestId('mar-logros').click();
  await page.getByTestId('mar-menu').getByTestId('mar-ranking-abrir').click();
  await expect(crono(page)).toHaveCount(0);
  await expect(ruta(page)).toHaveAttribute('data-ruta', 'on');
  // Anulada, vuelve el crucero de 15 nudos (T109).
  await expect(manejo(page)).toHaveAttribute('data-manejo', 'crucero');
  expect(errors).toEqual([]);
});

/**
 * Fuera de la carretera (T76), con el piloto dentro de la página: hacia la
 * boia 1 hasta `y` < 100 y, desde ahí, `rounds` veces a la izquierda (oeste)
 * hasta el aviso y de vuelta a la derecha hasta que se apaga. Devuelve
 * cuántas vueltas acabó con la carrera viva, o por qué paró.
 */
async function inAndOut(page: Page, rounds: number): Promise<string> {
  return page.evaluate(async (rounds) => {
    const main = document.querySelector<HTMLElement>('main.mar')!;
    const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    const y = () => Number((main.dataset.barco ?? '0,0').split(',')[1]);
    const held = new Set<string>();
    const press = (keys: string[]) => {
      for (const k of [...held]) {
        if (keys.includes(k)) continue;
        window.dispatchEvent(new KeyboardEvent('keyup', { key: k, code: k }));
        held.delete(k);
      }
      for (const k of keys) {
        if (held.has(k)) continue;
        window.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: k }));
        held.add(k);
      }
    };
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    const until = async (keys: string[], done: () => boolean, ms = 20_000) => {
      const end = performance.now() + ms;
      press(keys);
      while (!done() && performance.now() < end) {
        if (!q('mar-crono')) return false;
        await frame();
      }
      return done();
    };
    try {
      if (!(await until(['ArrowUp'], () => y() < 100))) return 'sin llegar';
      for (let i = 0; i < rounds; i++) {
        if (!(await until(['ArrowLeft'], () => !!q('mar-fuera')))) return `sin aviso ${i}`;
        if (!(await until(['ArrowRight'], () => !q('mar-fuera')))) return `sin volver ${i}`;
        if (!q('mar-crono')) return `acabó ${i}`;
      }
      return `vivas ${rounds}`;
    } finally {
      press([]);
    }
  }, rounds);
}

test('fuera de la carretera: boyitas a los lados, entrar y salir no la acaba, 5 s fuera sí', async ({
  page,
}) => {
  const errors = await openMar(page, `?cerca=${start.id}`);
  await startRace(page);
  // Al empezar aparecen las boyitas que marcan la carretera.
  await expect(page.getByTestId('mar-canvas')).toHaveAttribute('data-carretera', 'on');
  await expect(page.getByTestId('mar-fuera')).toHaveCount(0);
  // Salir y volver varias veces seguidas: cada vez avisa y, al volver, la carrera sigue.
  expect(await inAndOut(page, 3)).toBe('vivas 3');
  await expect(crono(page)).toHaveAttribute('data-fase', 'racing');
  // Se aparta otra vez y suelta los mandos: avisa con la cuenta de 5 s…
  await page.evaluate(() =>
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', code: 'ArrowLeft' })),
  );
  await expect(page.getByTestId('mar-fuera')).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() =>
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft', code: 'ArrowLeft' })),
  );
  await expect(page.getByTestId('mar-fuera')).toContainText(/[1-5] s/);
  // …y sin volver, la carrera se acaba (por salirse) y las boyitas se van.
  await expect(crono(page)).toHaveCount(0, { timeout: 20_000 });
  await expect(page.getByTestId('mar-canvas')).toHaveAttribute('data-carretera', 'off');
  // Anulada, vuelven las marcas amarillas (T88) y el crucero de 15 nudos (T109).
  await expect(ruta(page)).toHaveAttribute('data-ruta', 'on');
  await expect(manejo(page)).toHaveAttribute('data-manejo', 'crucero');
  await expect(page.getByTestId('mar-aviso').filter({ hasText: /te saliste/i })).toBeVisible();
  expect(errors).toEqual([]);
});

/**
 * Plan 015 T176 (decisión 16): terminar la regata deja «Primera regata»
 * lista para reclamar, una vez; «Rápido» está en «Logros» con el tiempo que
 * pide (lo cumple sólo una regata por debajo).
 */
test('logro: terminar la regata deja «Primera regata» lista para reclamar', async ({ page }) => {
  const first = SAMPLE_ACHIEVEMENTS.find((a) => a.id === 'circuito')!;
  const fast = SAMPLE_ACHIEVEMENTS.find((a) => a.id === RACE_FAST_ACHIEVEMENT)!;
  const errors = await openMar(page, `?cerca=${start.id}`);
  // El piloto de teclado a veces se sale de la carretera en el navegador lento
  // de las pruebas (la carrera se anula): otra salida, hasta tres.
  let outcome = '';
  for (let i = 0; i < 3 && outcome !== 'ok'; i++) {
    await startRace(page);
    outcome = await pilot(page, 'race');
  }
  expect(outcome).toBe('ok');
  await expect(page.getByTestId('mar-carrera-final')).toBeVisible();
  await page.getByTestId('mar-logros').click();
  await page.getByTestId('mar-menu-logros').click();
  const panel = page.getByTestId('mar-logros-panel');
  const row = panel.getByTestId(`logro-${first.id}`);
  await expect(row).toHaveAttribute('data-estado', 'ready');
  await expect(row).toContainText(first.title);
  const rapido = panel.getByTestId(`logro-${fast.id}`);
  await expect(rapido).toContainText(fast.title);
  await expect(rapido).toHaveAttribute('data-estado', /^(ready|in_progress)$/);
  await panel.getByTestId(`logro-reclamar-${first.id}`).click();
  await expect(row).toHaveAttribute('data-estado', 'claimed');
  expect(errors).toEqual([]);
});

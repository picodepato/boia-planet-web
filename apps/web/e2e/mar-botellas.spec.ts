import { BOTTLE_MESSAGE_MAX } from '@boia/contracts';
import { isSeaSpot, sheetZones } from '@boia/engine/bottles';
import {
  MemoryStorage,
  SAMPLE_BOTTLES,
  SAMPLE_CREW,
  STORE_KEY,
  createLocalRepository,
} from '@boia/store';
import { WORLD_REGISTRY } from '@boia/world';
import { expect, test, type Page } from '@playwright/test';
import { marReadable, placeBottles } from '../app/mar/bottles';
import { marWorld } from '../app/mar/engine/compact';
import { pointMap } from '../app/mar/engine/compress';
import { SAMPLE_CIRCUIT_MS } from '../lib/mundo/ranking-circuit';
import { t } from '../lib/i18n';

/**
 * Botellas y Ranking en el mar 3D (T56, REQ-IDE-040…044, REQ-IDE-053): las
 * botellas de muestra flotan en el mar; con un Carnet (creado ahí mismo) se
 * echa una de hasta 140 caracteres, que sigue junto al barco al recargar
 * (sólo la ve quien la escribió: todo vive en este navegador, D-20); echar
 * otra sustituye a la suya (una por persona, decisión 2026-10-02); y el
 * ranking local se abre desde el Menú con sus tres pestañas.
 */

test.describe.configure({ timeout: 120_000 });

async function openMar(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/mar');
  await expect(page.getByTestId('mar-canvas')).toBeVisible();
  await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 30_000 });
  return errors;
}

/** Ids de las botellas que el motor tiene en el agua. */
async function bottlesInSea(page: Page): Promise<string[]> {
  const v = await page.getByTestId('mar-canvas').getAttribute('data-bottles');
  return (v ?? '').split(' ').filter(Boolean);
}

async function openMenuEntry(page: Page, testId: string) {
  await page.getByTestId('mar-logros').click();
  await page.getByTestId('mar-menu').getByTestId(testId).click();
}

const nearby = (page: Page) => page.locator('[data-testid^="mar-botella-cerca-"]');

test('botellas: las de muestra flotan; con Carnet se echa una de 140 y sigue al recargar', async ({
  page,
}, info) => {
  const errors = await openMar(page);

  // Las de muestra flotan en el mar y una se encuentra nada más zarpar.
  await expect
    .poll(() => bottlesInSea(page), { timeout: 10_000 })
    .toEqual(expect.arrayContaining(SAMPLE_BOTTLES.map((b) => b.id)));
  const seeded = page.locator('[data-testid^="mar-botella-cerca-botella-muestra-"]').first();
  await expect(seeded).toBeVisible({ timeout: 10_000 });
  const seededId = (await seeded.getAttribute('data-testid'))!.replace('mar-botella-cerca-', '');
  const sample = SAMPLE_BOTTLES.find((b) => b.id === seededId)!;
  const author = SAMPLE_CREW.find((c) => c.userId === sample.userId)!;
  await expect(seeded).toHaveText(t('mar.botella.deCerca', { name: author.nickname }));
  await seeded.click();
  const panel = page.getByTestId('mar-botella');
  await expect(panel.getByTestId('botella-leida')).toBeVisible();
  await expect(panel.getByTestId('botella-mensaje')).toHaveText(sample.message);
  await panel.getByTestId('mar-botella-cerrar').click();
  await expect(panel).toBeHidden();

  // Mi botella: sin Carnet no se puede; «Crear mi Carnet» lleva a Mi Carnet
  // dentro del mundo (T55) y, creado, de vuelta a la botella sin salir del mar.
  await openMenuEntry(page, 'mar-mi-botella');
  await expect(panel.getByTestId('botella-sin-carnet')).toBeVisible();
  await panel.getByTestId('botella-sin-carnet').getByRole('button').click();
  const carnet = page.getByTestId('mar-carnet');
  await expect(panel).toBeHidden();
  await carnet.getByTestId('carnet-crear').click();
  await carnet.getByTestId('carnet-apodo-input').fill(`Marinera ${info.project.name}`);
  await carnet.getByTestId('carnet-guardar').click();
  await expect(carnet.getByTestId('carnet-mio')).toBeVisible();
  await carnet.getByRole('button', { name: t('juego.carnet.echarUnaBotella') }).click();
  await expect(carnet).toBeHidden();
  await expect(page).toHaveURL(/\/mar/);

  // 140 caracteres como mucho.
  const text = panel.getByTestId('botella-texto');
  await expect(text).toBeVisible();
  const message =
    `Botella de prueba desde el mar 3D (${info.project.name}): nos vemos en el All Day. `
      .padEnd(BOTTLE_MESSAGE_MAX + 10, 'o')
      .slice(0, BOTTLE_MESSAGE_MAX);
  await text.fill(`${message}!`);
  await expect(panel.getByTestId('botella-echar')).toBeDisabled();
  await text.fill(message);
  await expect(panel.getByTestId('botella-echar')).toBeEnabled();
  await panel.getByTestId('botella-echar').click();
  await expect(panel).toBeHidden();

  // Flota junto al barco: «Tu botella».
  const own = nearby(page).filter({ hasText: t('mar.botella.tuyaCerca') });
  await expect(own).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => bottlesInSea(page)).toHaveLength(SAMPLE_BOTTLES.length + 1);
  const ownId = (await own.getAttribute('data-testid'))!.replace('mar-botella-cerca-', '');

  // Recarga: el barco sigue donde estaba y la botella también, para quien la escribió.
  await page.reload();
  await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 30_000 });
  await expect.poll(() => bottlesInSea(page), { timeout: 10_000 }).toContain(ownId);
  const again = page.getByTestId(`mar-botella-cerca-${ownId}`);
  await expect(again).toBeVisible({ timeout: 10_000 });
  await again.click();
  await expect(panel.getByTestId('botella-mensaje')).toHaveText(message);
  await panel.getByTestId('mar-botella-cerrar').click();

  // En el Menú, «Mi botella» ya es la suya: editarla o retirarla.
  await openMenuEntry(page, 'mar-mi-botella');
  await expect(panel.getByTestId('botella-mia')).toBeVisible();
  await expect(panel.getByTestId('botella-mensaje')).toHaveText(message);
  await panel.getByTestId('mar-botella-cerrar').click();

  // Mi Carnet (T55) la enseña y lleva a ella: «Editar o retirar».
  await page.getByTestId('mar-enlace-carnet').click();
  const carnetSheet = page.getByTestId('mar-carnet');
  await expect(carnetSheet.getByTestId('carnet-botella')).toContainText(message);
  await carnetSheet.getByRole('button', { name: t('juego.carnet.editarORetirar') }).click();
  await expect(carnetSheet).toBeHidden();
  await expect(panel.getByTestId('botella-mia')).toBeVisible();

  // Una por persona (decisión 2026-10-02): echar otra sustituye a la suya.
  await panel.getByTestId('botella-echar-otra').click();
  await expect(panel.getByTestId('botella-sustituye')).toBeVisible();
  const replacement = `Otra botella (${info.project.name}): la de antes se retira.`;
  await panel.getByTestId('botella-texto').fill(replacement);
  await panel.getByTestId('botella-echar').click();
  await expect(panel).toBeHidden();
  await expect.poll(() => bottlesInSea(page), { timeout: 10_000 }).not.toContain(ownId);
  await expect.poll(() => bottlesInSea(page)).toHaveLength(SAMPLE_BOTTLES.length + 1);
  await openMenuEntry(page, 'mar-mi-botella');
  await expect(panel.getByTestId('botella-mensaje')).toHaveText(replacement);
  expect(errors).toEqual([]);
});

test('ranking: se abre desde el Menú con la carrera y los puntos de siempre y los miembros de muestra', async ({
  page,
}) => {
  const errors = await openMar(page);
  await openMenuEntry(page, 'mar-ranking-abrir');
  const panel = page.getByTestId('mar-ranking');
  const ranking = panel.getByTestId('ranking');
  await expect(ranking.getByTestId('ranking-rotulo')).toHaveText(t('ranking.localLabel'));
  // Cuatro pestañas (plan 017 T188): carrera, Cañón, Castillo y puntos; sin la
  // de temporada hasta que se defina qué es una temporada. Las del Cañón y el
  // Castillo, en ranking.spec.ts.
  const tabs = {
    circuito: ranking.getByTestId('ranking-tab-circuito'),
    siempre: ranking.getByTestId('ranking-tab-siempre'),
  };
  await expect(ranking.getByRole('tab')).toHaveCount(4);
  await expect(tabs.siempre).toHaveText(t('ranking.tab.allTime'));
  await expect(tabs.circuito).toHaveText(t('ranking.tab.circuit'));
  const rows = ranking.getByTestId('ranking-lista').locator('li.ranking-row');

  // Circuito (la primera): los tiempos de muestra y el visitante, sin vuelta todavía, al final.
  await expect(tabs.circuito).toHaveAttribute('aria-selected', 'true');
  await expect(ranking.getByTestId('ranking-lista')).toHaveAttribute('data-scope', 'circuit');
  const timed = SAMPLE_CREW.filter((c) => SAMPLE_CIRCUIT_MS[c.userId] !== undefined);
  await expect(rows).toHaveCount(timed.length + 1);
  for (const c of timed) {
    await expect(ranking.getByTestId(`ranking-fila-${c.userId}`)).toContainText(c.nickname);
  }
  await expect(rows.last()).toHaveAttribute('data-testid', 'ranking-fila-mia');
  await expect(rows.last()).toContainText(t('lib.ranking.sinVuelta'));

  // De siempre: el visitante entre todos los miembros de muestra (con el teclado del tablist: Fin).
  await tabs.circuito.focus();
  await page.keyboard.press('End');
  await expect(tabs.siempre).toHaveAttribute('aria-selected', 'true');
  await expect(tabs.siempre).toBeFocused();
  await expect(ranking.getByTestId('ranking-lista')).toHaveAttribute('data-scope', 'all');
  await expect(rows).toHaveCount(SAMPLE_CREW.length + 1);
  for (const c of SAMPLE_CREW) {
    await expect(ranking.getByTestId(`ranking-fila-${c.userId}`)).toContainText(c.nickname);
  }
  await expect(ranking.getByTestId('ranking-fila-mia')).toHaveAttribute('aria-current', 'true');

  // La fila propia abre Mi Carnet dentro del mundo (T55), sin salir del mar.
  await ranking.getByTestId('ranking-fila-mia').getByRole('link').click();
  await expect(panel).toBeHidden();
  await expect(page.getByTestId('mar-carnet')).toBeVisible();
  await expect(page).toHaveURL(/\/mar/);
  expect(errors).toEqual([]);
});

/**
 * Botellas donde se pueden leer (T88): una botella guardada junto a una isla
 * (dentro del radio donde su ficha se abre sola) flota, al cargar, donde se
 * lee: el barco, desde fuera de la ficha, va hasta ella sin que se abra la
 * ficha, la encuentra y la abre.
 */
test('una botella junto a una isla se puede leer', async ({ page }) => {
  const shared = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config;
  const mar = marWorld(shared);
  const island = sheetZones(mar).find(
    (z) => mar.objects.find((o) => o.identity.id === z.id)?.identity.category === 'isla',
  )!;
  const land = mar.objects.find((o) => o.identity.id === island.id)!.geometry.collision!.radius;
  // Guardada al sur de la isla, en el agua de su ficha (por donde llega `?cerca=`).
  const near = pointMap(shared).toShared({ x: island.x, y: island.y + (land + island.radius) / 2 });
  const at = { x: Math.round(near.x), y: Math.round(near.y) };
  expect(isSeaSpot(shared, at), 'agua del mapa compartido').toBe(true);
  expect(marReadable(mar)(pointMap(shared).toMar(at)), 'ahí no se lee').toBe(false);

  const storage = new MemoryStorage();
  const repo = createLocalRepository({ storage, watch: false });
  await repo.carnet.create({ nickname: 'Grumete Isla' });
  const message = `Junto a la isla ${island.id}: se lee igual.`;
  const bottle = await repo.bottles.place({ message, ...at });
  const json = storage.getItem(STORE_KEY)!;
  await page.addInitScript(
    ([key, doc]) => {
      try {
        if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, doc);
      } catch {
        // sin almacenamiento: la prueba fallará más abajo, con su motivo
      }
    },
    [STORE_KEY, json] as const,
  );

  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`/mar?cerca=${island.id}`);
  await expect(page.locator('.mar-splash')).toHaveCount(0, { timeout: 30_000 });
  await expect.poll(() => bottlesInSea(page), { timeout: 10_000 }).toContain(bottle.id);

  // El barco, junto a la isla pero fuera de su ficha, navega hasta donde flota
  // (el mismo sitio que calcula /mar): aparece cerca, sin ficha que la tape, y se abre.
  const ship = (await page.locator('main.mar').getAttribute('data-barco'))!.split(',').map(Number);
  expect(Math.hypot(ship[0]! - island.x, ship[1]! - island.y)).toBeGreaterThan(island.radius);
  await expect(page.getByTestId('mar-ficha')).toHaveCount(0);
  const [afloat] = placeBottles([{ id: bottle.id, ...at, isMine: true, read: false }], shared, mar);
  expect(marReadable(mar)(afloat!)).toBe(true);
  const found = page.getByTestId(`mar-botella-cerca-${bottle.id}`);
  const sailed = await page.evaluate(
    async ({ target, testId }) => {
      const main = document.querySelector<HTMLElement>('main.mar')!;
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
      const until = performance.now() + 60_000;
      try {
        while (performance.now() < until) {
          if (document.querySelector(`[data-testid="${testId}"]`)) return 'ok';
          if (document.querySelector('[data-testid="mar-ficha"]')) return 'ficha abierta';
          const [x, y] = (main.dataset.barco ?? '0,0').split(',').map(Number);
          const dx = target.x - x!;
          const dy = target.y - y!;
          const d = Math.hypot(dx, dy) || 1;
          const keys: string[] = [];
          if (dx / d > 0.38) keys.push('ArrowRight');
          if (dx / d < -0.38) keys.push('ArrowLeft');
          if (dy / d > 0.38) keys.push('ArrowDown');
          if (dy / d < -0.38) keys.push('ArrowUp');
          press(keys);
          await new Promise((r) => requestAnimationFrame(r));
        }
        return `tiempo @ ${main.dataset.barco ?? ''}`;
      } finally {
        press([]);
      }
    },
    { target: { x: afloat!.x, y: afloat!.y }, testId: `mar-botella-cerca-${bottle.id}` },
  );
  expect(sailed).toBe('ok');
  await expect(found).toBeVisible();
  await found.click();
  const panel = page.getByTestId('mar-botella');
  await expect(panel.getByTestId('botella-mensaje')).toHaveText(message);
  expect(errors).toEqual([]);
});

import { circuitFromWorld } from '@boia/engine/circuit';
import { CANON_MEDAL_PRIZES } from '@boia/engine/minigames';
import { rescueMissionOf } from '@boia/engine/mission';
import { type BossId, SURVIVORS_CONFIG, type SurvivorsMedal } from '@boia/engine/survivors';
import { CIRCUIT_ID, WORLD_REGISTRY } from '@boia/world';
import { type Locator, type Page, type TestInfo, expect, test } from '@playwright/test';
import { formatClock, formatPlayed } from '../app/mar/canon-hud-model';
import { marWorld } from '../app/mar/engine/compact';
import { lapTargets } from '../app/mar/race';
import { type MessageKey, t as msg } from '../lib/i18n';
import { SAMPLE_CANON_SCORES, canonGameScore, crewCanonPlace } from '../lib/mundo/ranking-canon';
import { mar, marSheet, openMar, shipAt, steerTo } from './mar-helpers';

/**
 * El Cañón «Que no pare la música» dentro de /mar (plan 009, T99): el panel
 * de su isla lo empieza en el mismo mar, donde está el barco (sin la capa
 * 2D), sin las marcas amarillas ni lo demás que la partida aparta; el atajo
 * `?minijuego=canon&t=&seed=` empieza en ese segundo con esa semilla; en
 * carrera el panel explica que ahora no; al acabar vuelve el mundo con el
 * barco donde acabó. El estado se lee de `data-testid="mar-canon"`.
 *
 * T119 cierra la beta: inundarse, llegar al amanecer (con `&t=` cerca del
 * final) y su premio (desde T153, el del bronce, una vez al día por medalla)
 * (con el logro `canon` listo para reclamar), el abandono tras más de 5 min
 * en pausa y la Boia Fiestera que sigue a bordo durante una partida.
 *
 * T121: en producción (sin Playwright al mando, con `?dev=1`), una partida
 * empezada con `&t=` no da premio ni logro, y la pantalla final lo dice. *
 * T147 cierra la beta 3 a nivel de humo, sin esperar 7 minutos: cada boss
 * llega con `t=`/`acto=` (Vecino, Tiburón, Barco Fantasma, Kraken), la carta
 * del cofre, el botín (`botin=1`), «Mostrar vida/daño», la barra del boss, las
 * medallas en la tarjeta final (ninguna, bronce, oro) y el acto 2 que se abre;
 * más el rendimiento en `baja` con cada boss final en pantalla. Las esperas
 * contestan las cartas que se abren a medias (`answerCard`) y leen a la vez
 * lo que cambia junto, para no fallar bajo carga.
 */

test.describe.configure({ timeout: 240_000 });

const world = marWorld(WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config);
const spec = circuitFromWorld(world, CIRCUIT_ID)!;
const raceStart = lapTargets(world, spec).at(-1)!;

const game = (page: Page) => page.getByTestId('mar-canon');
const canvas = (page: Page) => page.getByTestId('mar-canvas');
const panel = (page: Page) => page.getByTestId('panel-minijuego');
const previa = (page: Page) => page.getByTestId('mar-canon-previa');

/** «Jugar» en el panel de la isla abre el pop-up antes de la partida (T151). */
async function openPrevia(page: Page): Promise<Locator> {
  await panel(page)
    .getByRole('button', { name: msg('juego.minigameLayer.jugar') })
    .click();
  await expect(previa(page)).toBeVisible({ timeout: 15_000 });
  await expect(panel(page)).toHaveCount(0);
  return previa(page);
}

const pointOf = (s: string | null) => {
  const [x, y] = (s ?? '0,0').split(',').map(Number);
  return { x: x!, y: y! };
};
/**
 * Una carta de nivel abierta para la partida (el barco, el reloj y el turbo
 * se quedan quietos): se contesta con Intro. Las esperas largas la llaman en
 * cada vuelta para no depender de cuándo sube de nivel (T147).
 */
async function answerCard(page: Page): Promise<void> {
  if ((await game(page).getAttribute('data-estado')) === 'card') await page.keyboard.press('Enter');
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

for (const reduced of [false, true]) {
  test(`lecturas de vida y daño desde la pausa, recordadas por navegador (T136, reducido=${reduced})`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const errors = await openMar(page, '?minijuego=canon&t=120&seed=7&dificultad=tormenta');
    await expect(game(page)).toHaveAttribute('data-estado', 'running');
    await expect(page.getByTestId('mar-canon-readouts')).toHaveCount(0);
    await page.getByTestId('mar-canon-pausa').click();
    const menu = page.getByTestId('mar-menu');
    const health = menu.getByRole('switch', { name: msg('mar.canon.mostrarVida') });
    const damage = menu.getByRole('switch', { name: msg('mar.canon.mostrarDano') });
    await expect(health).toHaveAttribute('aria-checked', 'false');
    await expect(damage).toHaveAttribute('aria-checked', 'false');
    await health.focus();
    await page.keyboard.press('Space');
    await damage.click();
    await expect(health).toHaveAttribute('aria-checked', 'true');
    await expect(damage).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    const overlay = page.getByTestId('mar-canon-readouts');
    await expect(overlay).toBeVisible();
    await expect(overlay).toHaveAttribute('data-canon-health-overlay', 'on');
    await expect(overlay).toHaveAttribute('data-canon-damage-overlay', 'on');
    await expect(overlay).toHaveAttribute('data-reduced-motion', String(reduced));
    // These counters are updated only when bars and numbers were actually drawn on-screen.
    await expect
      .poll(
        async () => {
          const card = page.getByTestId('mar-canon-carta').first();
          if ((await card.isVisible()) && (await card.isEnabled())) await card.click();
          return (
            Number(await overlay.getAttribute('data-health-seen')) > 0 &&
            Number(await overlay.getAttribute('data-damage-seen')) > 0
          );
        },
        { timeout: 60_000 },
      )
      .toBe(true);
    await openMar(page, '?minijuego=canon&seed=7');
    await page.getByTestId('mar-canon-pausa').click();
    await expect(health).toHaveAttribute('aria-checked', 'true');
    await expect(damage).toHaveAttribute('aria-checked', 'true');
    await health.click();
    await damage.click();
    await page.getByTestId('mar-menu-seguir').click();
    await expect(page.getByTestId('mar-canon-readouts')).toBeHidden();
    expect(errors).toEqual([]);
  });
}

test('el botón de turbo acelera durante el Cañón y conserva su cooldown (T124)', async ({
  page,
}) => {
  const errors = await openMar(page, '?minijuego=canon&seed=7');
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  const turbo = page.getByTestId('mar-turbo');
  await expect(turbo).toBeVisible();
  // Una carta de nivel que se abra a medias para la partida: se contesta (T147).
  const speed = async () => {
    await answerCard(page);
    return Number(await canvas(page).getAttribute('data-canon-speed'));
  };
  await page.keyboard.down('ArrowRight');
  await expect.poll(speed, { timeout: 20_000 }).toBeGreaterThan(140);
  // El turbo dura 2,4 s: la velocidad y el botón se miran en cada fotograma
  // (bajo carga, una espera con sondeo se lo podía perder). Si una carta se
  // abrió justo al pulsar, el turbo no entra: se contesta y se pulsa otra vez.
  let peak = { speed: 0, turboS: 0, on: false };
  for (let attempt = 0; attempt < 5 && peak.turboS <= 0; attempt++) {
    await answerCard(page);
    await turbo.click();
    peak = await page.evaluate(async () => {
      const el = document.querySelector<HTMLElement>('[data-testid="mar-canvas"]')!;
      const button = document.querySelector<HTMLElement>('[data-testid="mar-turbo"]');
      const out = { speed: 0, turboS: 0, on: false };
      const t0 = performance.now();
      await new Promise<void>((done) => {
        const step = () => {
          out.speed = Math.max(out.speed, Number(el.dataset.canonSpeed ?? 0));
          out.turboS = Math.max(out.turboS, Number(el.dataset.canonTurbo ?? 0));
          out.on ||= button?.classList.contains('is-on') ?? false;
          if (performance.now() - t0 < 3000) requestAnimationFrame(step);
          else done();
        };
        requestAnimationFrame(step);
      });
      return out;
    });
  }
  expect(peak.turboS).toBeGreaterThan(0);
  expect(peak.on).toBe(true);
  expect(peak.speed).toBeGreaterThan(170);
  const before = Number(await canvas(page).getAttribute('data-canon-turbo-cooldown'));
  expect(before).toBeGreaterThan(0);
  // Otra pulsación no reinicia el reloj del turbo.
  await turbo.click();
  await expect
    .poll(
      async () => {
        await answerCard(page);
        return Number(await canvas(page).getAttribute('data-canon-turbo-cooldown'));
      },
      { timeout: 20_000 },
    )
    .toBeLessThan(before);
  await page.keyboard.up('ArrowRight');
  expect(errors).toEqual([]);
});

/**
 * T146: los impulsos y las rampas del circuito funcionan durante una partida
 * del Cañón como navegando libre (T124): el impulso sube la velocidad por
 * encima del turbo y la rampa lanza el barco al aire (`data-salto`).
 */
for (const [kind, id] of [
  ['impulso', 'circuito-impulso-1'],
  ['rampa', 'circuito-rampa-1'],
] as const) {
  test(`navegando por encima de ${kind === 'impulso' ? 'un impulso' : 'una rampa'} durante el Cañón ${
    kind === 'impulso' ? 'acelera el barco' : 'lanza el barco al aire'
  } (T146)`, async ({ page }) => {
    const errors = await openMar(page, `?cerca=${id}&minijuego=canon&seed=7`);
    await expect(game(page)).toHaveAttribute('data-estado', 'running');
    const speed = async () => Number(await canvas(page).getAttribute('data-canon-speed'));
    let max = 0;
    // El salto se apunta al verlo: bajo carga, cuando se vuelve a leer ya puede haber caído (T156).
    let airborne = false;
    await steerTo(
      page,
      id,
      async () => {
        await answerCard(page);
        max = Math.max(max, await speed());
        if ((await canvas(page).getAttribute('data-salto')) === 'aire') airborne = true;
        return kind === 'impulso' ? max > 190 : airborne;
      },
      { ms: 60_000 },
    );
    if (kind === 'impulso') expect(max).toBeGreaterThan(190);
    else expect(airborne).toBe(true);
    if (kind === 'rampa') {
      // Y cae al agua: chapuzón (una carta que se abra en el aire para la partida: se contesta).
      await expect
        .poll(
          async () => {
            await answerCard(page);
            return canvas(page).getAttribute('data-salto');
          },
          { timeout: 20_000 },
        )
        .toBe('agua');
    }
    expect(errors).toEqual([]);
  });
}

test('desde el panel de su isla, el Cañón se juega en el mismo mar, sin marcas amarillas ni capa 2D', async ({
  page,
}) => {
  const errors = await openMar(page, '?ir=canon');
  await expect(mar(page)).toHaveAttribute('data-llegada', 'canon', { timeout: 60_000 });
  const sheet = marSheet(page);
  if (await sheet.isVisible().catch(() => false)) {
    await sheet.getByRole('button', { name: 'Cerrar' }).first().click();
  }
  await expect(panel(page)).toBeVisible({ timeout: 15_000 });
  await expect(panel(page)).toHaveAttribute('data-game', 'canon');
  await expect(panel(page)).toContainText(msg('mar.canon.title'));
  // La versión definitiva (T156) ya no lleva la etiqueta «BETA».
  await expect(panel(page).getByTestId('panel-minijuego-beta')).toHaveCount(0);
  await expect(canvas(page)).toHaveAttribute('data-ruta', 'on');
  // Un objetivo marcado con el «!» (T99 de Codex) antes de jugar.
  await page.getByTestId('mar-ayuda-abrir').dispatchEvent('click');
  await page.getByTestId('mar-ayuda-rumbo-objetivo').dispatchEvent('click');
  await expect(page.getByTestId('mar-objective-marker')).toBeVisible();
  await expect(canvas(page)).not.toHaveAttribute('data-fauna-oculta', /.+/);
  const before = await shipAt(page);

  // «Jugar» abre el pop-up previo (T151); su «Jugar» empieza.
  await (await openPrevia(page)).getByTestId('mar-canon-previa-jugar').click();
  await expect(previa(page)).toHaveCount(0);
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  await expect(canvas(page)).toHaveAttribute('data-canon', 'on');
  // Una partida del Cañón nunca es carrera: el barco, sin los 22 nudos (T109).
  await expect(canvas(page)).toHaveAttribute('data-manejo', 'crucero');
  // Sin marcas amarillas, ni botellas, descuentos o encuentros en el mar.
  await expect(canvas(page)).toHaveAttribute('data-ruta', 'off');
  for (const layer of ['bottles', 'discounts', 'encounters']) {
    await expect(canvas(page)).toHaveAttribute('data-escondido', new RegExp(`\\b${layer}\\b`));
  }
  // Ni peces ni gaviotas, ni el «!» de objetivos ni el objetivo marcado (T120).
  await expect(canvas(page)).toHaveAttribute('data-fauna-oculta', 'on');
  await expect(page.getByTestId('mar-ayuda-abrir')).toHaveCount(0);
  await expect(page.getByTestId('mar-objective-marker')).toHaveCount(0);
  // Ni la capa 2D del cañón ni el panel.
  await expect(page.getByTestId('minijuego')).toHaveCount(0);
  await expect(panel(page)).toHaveCount(0);
  // Empieza donde está el barco, y el tiempo corre.
  expect(dist(pointOf(await game(page).getAttribute('data-barco')), before)).toBeLessThan(80);
  await expect
    .poll(async () => Number(await game(page).getAttribute('data-activo')), { timeout: 20_000 })
    .toBeGreaterThan(1);
  await expect(game(page)).toHaveAttribute('data-tiempo', /^\d+$/);
  expect(errors).toEqual([]);
});

test('`?minijuego=canon&t=<s>&seed=<n>` empieza en ese segundo con esa semilla', async ({
  page,
}) => {
  const errors = await openMar(page, '?minijuego=canon&t=120&seed=7');
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  await expect(game(page)).toHaveAttribute('data-semilla', '7');
  const left = Number(await game(page).getAttribute('data-tiempo'));
  expect(left).toBeLessThanOrEqual(420 - 120);
  expect(left).toBeGreaterThan(420 - 120 - 30);
  // Ya hay nivel y enemigos de ese momento de la partida.
  expect(Number(await game(page).getAttribute('data-nivel'))).toBeGreaterThan(1);
  // El atajo se consume.
  expect(new URL(page.url()).searchParams.has('minijuego')).toBe(false);
  expect(errors).toEqual([]);
});

test('ya tarde (`t=` pasadas las 3:30) salen en pantalla los seis enemigos, sin errores (T126)', async ({
  page,
}) => {
  const errors = await openMar(page, '?minijuego=canon&t=240&seed=7');
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  expect(Number(await game(page).getAttribute('data-tiempo'))).toBeLessThan(420 - 210);
  // `data-canon-vistos`: los tipos que han salido dentro de la vista de la cámara en la partida.
  // T132: navegando a toda máquina (un barco parado se inunda en ~20 s, antes de que
  // las medusas lentas y los piratas, que se paran a distancia, entren en la vista);
  // lo que se recicla aparece por delante, hacia donde va el barco.
  const all = Object.keys(SURVIVORS_CONFIG.enemies).sort();
  await page.keyboard.down('ArrowRight');
  await expect
    .poll(
      async () => {
        if ((await game(page).getAttribute('data-estado')) === 'card')
          await page.keyboard.press('Enter');
        return ((await canvas(page).getAttribute('data-canon-vistos')) ?? '').split(' ').sort();
      },
      { timeout: 90_000, intervals: [500] },
    )
    .toEqual(all);
  await page.keyboard.up('ArrowRight');
  expect(errors).toEqual([]);
});

test('antes de las 2:30 (`t=`) llega el Vecino Quejica y entra en pantalla, sin errores (T138)', async ({
  page,
}) => {
  const slot = SURVIVORS_CONFIG.acts[0]!.events.find((e) => e.ref === 'vecino')!;
  expect(slot.enabled).toBe(true);
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  const errors = await openMar(page, `?minijuego=canon&t=${slot.atS - 10}&seed=7`);
  await expect(game(page)).toHaveAttribute('data-estado', /running|card/);
  await expect(canvas(page)).not.toHaveAttribute('data-canon-boss', /vecino/);
  await page.keyboard.down('ArrowRight');
  await expect
    .poll(
      async () => {
        if ((await game(page).getAttribute('data-estado')) === 'card')
          await page.keyboard.press('Enter');
        return (await canvas(page).getAttribute('data-canon-boss-vista')) ?? '';
      },
      { timeout: 90_000, intervals: [400] },
    )
    .toMatch(/vecino/);
  await expect(canvas(page)).toHaveAttribute('data-canon-boss', /vecino/);
  await page.keyboard.up('ArrowRight');
  expect(errors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test('pasadas las 5:30 (`t=`) el Barco Pirata Fantasma está en la partida y entra en pantalla, sin errores (T140)', async ({
  page,
}) => {
  const slot = SURVIVORS_CONFIG.acts[0]!.events.find((e) => e.type === 'boss')!;
  expect(slot.ref).toBe('fantasma');
  const errors = await openMar(page, `?minijuego=canon&t=${slot.atS + 5}&seed=7`);
  await expect(game(page)).toHaveAttribute('data-estado', /running|card/);
  // El hueco del boss final ya pasó: `&t=` saca el boss del último hueco, sólido o desvanecido.
  // `data-canon-boss`: los bosses vivos («fantasma:solid»); `data-canon-boss-vista`: los que están en la vista.
  await expect(canvas(page)).toHaveAttribute('data-canon-boss', /fantasma:(solid|ghost)/, {
    timeout: 20_000,
  });
  // Navegando (un barco parado se inunda), el Fantasma, que gira alrededor del barco, entra en la vista.
  await page.keyboard.down('ArrowRight');
  await expect
    .poll(
      async () => {
        if ((await game(page).getAttribute('data-estado')) === 'card')
          await page.keyboard.press('Enter');
        return (await canvas(page).getAttribute('data-canon-boss-vista')) ?? '';
      },
      { timeout: 90_000, intervals: [400] },
    )
    .toMatch(/fantasma:(solid|ghost)/);
  await page.keyboard.up('ArrowRight');
  expect(errors).toEqual([]);
});

test('acto 2 pasadas las 5:30 (`acto=2&t=`): el Kraken persigue bajo el agua, sale y entra en pantalla, sin errores (T142)', async ({
  page,
}) => {
  const act2 = SURVIVORS_CONFIG.acts.find((a) => a.act === 2)!;
  const slot = act2.events.find((e) => e.type === 'boss' && e.enabled !== false)!;
  expect(slot.ref).toBe('kraken');
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  const errors = await openMar(page, `?minijuego=canon&acto=2&t=${slot.atS + 5}&seed=7`);
  await expect(game(page)).toHaveAttribute('data-estado', /running|card/);
  await expect(game(page)).toHaveAttribute('data-acto', '2');
  // `data-canon-boss`: «kraken:<modo>» (submerged, emerging, emerged, grabbing, diving).
  await expect(canvas(page)).toHaveAttribute('data-canon-boss', /kraken:/, { timeout: 20_000 });
  await page.keyboard.down('ArrowRight');
  const seen = new Set<string>();
  await expect
    .poll(
      async () => {
        if ((await game(page).getAttribute('data-estado')) === 'card')
          await page.keyboard.press('Enter');
        const vista = (await canvas(page).getAttribute('data-canon-boss-vista')) ?? '';
        for (const m of vista.matchAll(/kraken:(\w+)/g)) seen.add(m[1]!);
        // Visto en pantalla y, alguna vez, fuera del agua (cabeza y tentáculos).
        return (
          seen.size > 0 && (seen.has('emerged') || seen.has('grabbing') || seen.has('emerging'))
        );
      },
      { timeout: 90_000, intervals: [300] },
    )
    .toBe(true);
  await page.keyboard.up('ArrowRight');
  expect(errors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

for (const reduced of [false, true]) {
  test(`all max-level weapons are drawn without console errors (T128, reduced=${reduced})`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
    if (reduced) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'deviceMemory', { configurable: true, get: () => 2 });
      });
    }
    const errors = await openMar(page, '?minijuego=canon&armas=1&seed=7');
    await expect(game(page)).toHaveAttribute('data-estado', 'running');
    if (reduced) await expect(game(page)).toHaveAttribute('data-calidad', 'baja');
    expect(new URL(page.url()).searchParams.has('armas')).toBe(false);
    const all = Object.keys(SURVIVORS_CONFIG.weapons).sort();
    // Level cards pause the sim; pick with the supported keyboard input throughout the run.
    await expect
      .poll(
        async () => {
          if ((await game(page).getAttribute('data-estado')) === 'card')
            await page.keyboard.press('Enter');
          const seen = ((await canvas(page).getAttribute('data-canon-armas-vistas')) ?? '')
            .split(' ')
            .filter(Boolean)
            .sort();
          const active = Number(await game(page).getAttribute('data-activo'));
          return active >= 12 && JSON.stringify(seen) === JSON.stringify(all);
        },
        { timeout: 90_000, intervals: [400] },
      )
      .toBe(true);
    const counts = ((await canvas(page).getAttribute('data-canon-armas')) ?? '')
      .split(' ')
      .filter(Boolean);
    expect(counts.length).toBeGreaterThan(0);
    for (const count of counts) expect(count).toMatch(/^[A-Za-z]+:[1-9]\d*$/);
    expect(errors).toEqual([]);
  });
}

test('el interruptor de desarrollo cambia en vivo el estilo de derrota (T117)', async ({
  page,
}) => {
  const errors = await openMar(page, '?minijuego=canon&t=120&seed=7&derrota=puf');
  await expect(game(page)).toHaveAttribute('data-estado', /running|card/, { timeout: 20_000 });
  const toggle = page.getByTestId('mar-canon-derrota');
  await expect(toggle).toHaveAttribute('data-derrota', 'puf');
  await expect(canvas(page)).toHaveAttribute('data-derrota', 'puf');
  await expect(toggle).toContainText(msg('mar.canon.dev.derrota.puf'));
  // El cañón dispara solo: caen enemigos con el estilo de ahora. (Una carta de
  // nivel que se abra mientras tanto para la partida: se contesta con Intro.)
  const defeated = async () => {
    if ((await game(page).getAttribute('data-estado')) === 'card')
      await page.keyboard.press('Enter');
    return Number(await game(page).getAttribute('data-derrotados'));
  };
  await expect.poll(defeated, { timeout: 30_000 }).toBeGreaterThan(0);
  await toggle.dispatchEvent('click');
  await expect(toggle).toHaveAttribute('data-derrota', 'sumergirse');
  await expect(canvas(page)).toHaveAttribute('data-derrota', 'sumergirse');
  await expect(toggle).toContainText(msg('mar.canon.dev.derrota.sumergirse'));
  const before = Number(await game(page).getAttribute('data-derrotados'));
  await expect.poll(defeated, { timeout: 30_000 }).toBeGreaterThan(before);
  // El atajo `derrota` también se consume.
  expect(new URL(page.url()).searchParams.has('derrota')).toBe(false);
  expect(errors).toEqual([]);
});

test('al acabar vuelve el mundo, con el barco donde acabó la partida', async ({ page }) => {
  const errors = await openMar(page, '?minijuego=canon&t=416&seed=3');
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  await expect(canvas(page)).toHaveAttribute('data-ruta', 'off');
  await expect(canvas(page)).toHaveAttribute('data-fauna-oculta', 'on');
  const start = pointOf(await game(page).getAttribute('data-barco'));
  // Navega un poco durante la partida, hasta moverse de verdad (T156: una
  // carta de nivel que se abra a medias para la partida y el barco; se contesta).
  await page.keyboard.down('ArrowLeft');
  await expect
    .poll(
      async () => {
        await answerCard(page);
        if ((await game(page).getAttribute('data-estado')) === 'ended') return Infinity;
        return dist(pointOf(await game(page).getAttribute('data-barco')), start);
      },
      { timeout: 30_000 },
    )
    .toBeGreaterThan(40);
  await page.keyboard.up('ArrowLeft');
  await expect(game(page)).toHaveAttribute('data-estado', 'ended', { timeout: 60_000 });
  await expect(game(page)).toHaveAttribute('data-fin', /^(survived|flooded)$/);
  // La pantalla final (T118); el mundo vuelve con «Volver al mar».
  await expect(page.getByTestId('mar-canon-final')).toBeVisible();
  await page.getByTestId('mar-canon-volver').click();
  await expect(page.getByTestId('mar-canon-final')).toHaveCount(0);
  // El mundo, de vuelta.
  await expect(canvas(page)).toHaveAttribute('data-canon', 'off');
  await expect(canvas(page)).toHaveAttribute('data-ruta', 'on');
  await expect(canvas(page)).not.toHaveAttribute('data-escondido', /.+/);
  await expect(canvas(page)).not.toHaveAttribute('data-fauna-oculta', /.+/);
  await expect(page.getByTestId('mar-ayuda-abrir')).toBeVisible();
  // El barco sigue donde acabó (no vuelve a donde empezó).
  const end = pointOf(await game(page).getAttribute('data-barco'));
  expect(dist(end, start)).toBeGreaterThan(20);
  await page.waitForTimeout(1000);
  expect(dist(await shipAt(page), end)).toBeLessThan(80);
  // Y se puede volver a navegar.
  const now = await shipAt(page);
  await page.keyboard.down('ArrowRight');
  await expect
    .poll(async () => dist(await shipAt(page), now), { timeout: 15_000 })
    .toBeGreaterThan(20);
  await page.keyboard.up('ArrowRight');
  expect(errors).toEqual([]);
});

/** Pilota con las flechas hasta la salida de Los Rápidos, hasta que sale la tarjeta de empezar. */
async function sailToRaceOffer(page: Page): Promise<string> {
  return page.evaluate(
    async ({ start }) => {
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
      const until = performance.now() + 120_000;
      try {
        while (performance.now() < until) {
          if (document.querySelector('[data-testid="mar-carrera-oferta"]')) return 'offer';
          const [x, y] = (main.dataset.barco ?? '0,0').split(',').map(Number);
          const dx = start.x - x!;
          const dy = start.y - y!;
          const d = Math.hypot(dx, dy) || 1;
          const keys: string[] = [];
          if (dx / d > 0.38) keys.push('ArrowRight');
          if (dx / d < -0.38) keys.push('ArrowLeft');
          if (dy / d > 0.38) keys.push('ArrowDown');
          if (dy / d < -0.38) keys.push('ArrowUp');
          press(keys);
          await new Promise((r) => requestAnimationFrame(r));
        }
        return 'tiempo';
      } finally {
        press([]);
      }
    },
    { start: { x: raceStart.x, y: raceStart.y } },
  );
}

test('en plena carrera el panel del Cañón explica que ahora no y no empieza', async ({ page }) => {
  // `&oferta=1`: el panel de la isla del Cañón sin ir hasta ella (atajo de desarrollo).
  const errors = await openMar(page, `?cerca=${raceStart.id}&minijuego=canon&oferta=1`);
  await expect(panel(page)).toBeVisible({ timeout: 15_000 });
  await expect(panel(page)).not.toHaveAttribute('data-bloqueado', 'si');
  expect(await sailToRaceOffer(page)).toBe('offer');
  // En el móvil el panel (abierto lejos de su isla sólo por el atajo) tapa la tarjeta: sin puntero.
  await page.getByTestId('mar-carrera-empezar').dispatchEvent('click');
  await expect(page.getByTestId('mar-crono')).toHaveAttribute('data-fase', /countdown|racing/);
  // El panel lo explica y «Jugar» no empieza nada.
  await expect(panel(page)).toHaveAttribute('data-bloqueado', 'si');
  await expect(page.getByTestId('panel-minijuego-bloqueo')).toHaveText(msg('mar.canon.lock.race'));
  const play = panel(page).getByRole('button', { name: msg('juego.minigameLayer.jugar') });
  await expect(play).toBeDisabled();
  await play.click({ force: true });
  await page.waitForTimeout(500);
  await expect(game(page)).toHaveCount(0);
  await expect(canvas(page)).not.toHaveAttribute('data-canon', 'on');
  expect(errors).toEqual([]);
});

// --- La interfaz de la partida (T118) -------------------------------------------------

type Box = { x: number; y: number; width: number; height: number };

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/**
 * «Entradas» sigue a la vista y a mano: ninguna pieza de la partida la pisa
 * y lo que hay en su centro es el propio botón.
 */
async function expectTicketsFree(page: Page, pieces: Locator[]): Promise<void> {
  const tickets = page.getByTestId('mar-entradas');
  await expect(tickets).toBeVisible();
  const t = (await tickets.boundingBox())!;
  for (const piece of pieces) {
    const b = (await piece.boundingBox())!;
    expect(overlaps(b, t), (await piece.getAttribute('data-testid')) ?? '').toBe(false);
  }
  const onTop = await page.evaluate(
    ({ x, y }) => !!document.elementFromPoint(x, y)?.closest('[data-testid="mar-entradas"]'),
    { x: t.x + t.width / 2, y: t.y + t.height / 2 },
  );
  expect(onTop).toBe(true);
}

/** La pieza se ve entera dentro de la pantalla. */
async function expectOnScreen(page: Page, piece: Locator): Promise<Box> {
  await expect(piece).toBeVisible();
  const b = (await piece.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(vp.width + 0.5);
  expect(b.y + b.height).toBeLessThanOrEqual(vp.height + 0.5);
  return b;
}

const activeS = async (page: Page) => Number(await game(page).getAttribute('data-activo'));

test('HUD con cuenta atrás y nivel, sin BETA; el agua a bordo bajo el barco; nada tapa «Entradas»', async ({
  page,
}) => {
  const errors = await openMar(page, '?minijuego=canon&t=120&seed=7');
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  const hud = page.getByTestId('mar-canon-hud');
  await expectOnScreen(page, hud);
  // T123: pequeño y pegado arriba (la banda alta de la pantalla), sin pisar nada fijo.
  const vp0 = page.viewportSize()!;
  const hudBox = (await hud.boundingBox())!;
  const xpBox = (await hud.getByRole('progressbar').boundingBox())!;
  const timeBox = (await hud.getByTestId('mar-canon-tiempo').boundingBox())!;
  for (const b of [hudBox, xpBox, timeBox]) expect(b.y + b.height).toBeLessThan(vp0.height * 0.2);
  expect(hudBox.height).toBeLessThanOrEqual(64);
  expect(xpBox.height).toBeLessThanOrEqual(8);
  const fixed = ['mar-entradas', 'mar-enlaces', 'mar-minimapa', 'mar-saldos'].map((id) =>
    page.getByTestId(id),
  );
  for (const piece of fixed) {
    if ((await piece.count()) === 0 || !(await piece.isVisible())) continue;
    const pb = (await piece.boundingBox())!;
    expect(overlaps(hudBox, pb), (await piece.getAttribute('data-testid')) ?? '').toBe(false);
  }
  await expect(hud.getByTestId('mar-canon-beta')).toHaveCount(0);
  // La cuenta atrás, «m:ss», baja desde lo que queda de la partida.
  const time = hud.getByTestId('mar-canon-tiempo');
  await expect(time).toHaveText(/^\d+:\d\d$/);
  // Texto y segundos se leen en el mismo instante: el reloj sigue corriendo entre dos lecturas.
  const read = await time.evaluate((el) => ({
    secs: Number(el.getAttribute('data-segundos')),
    text: el.textContent ?? '',
  }));
  const secs = read.secs;
  expect(secs).toBeLessThanOrEqual(SURVIVORS_CONFIG.durationS - 120);
  expect(read.text).toBe(formatClock(secs));
  // (Una carta de nivel que se abra mientras tanto para el reloj: se contesta con Intro, como en las demás.)
  await expect
    .poll(
      async () => {
        if ((await game(page).getAttribute('data-estado')) === 'card')
          await page.keyboard.press('Enter');
        return Number(await time.getAttribute('data-segundos'));
      },
      { timeout: 15_000 },
    )
    .toBeLessThan(secs);
  // El nivel, encima de su barra (el del atajo `t=`: ya subió). Número y texto
  // se leen en el mismo instante: el nivel puede subir entre dos lecturas.
  const level = hud.getByTestId('mar-canon-nivel');
  const lvRead = await level.evaluate((el) => ({
    lv: Number(el.getAttribute('data-nivel')),
    text: el.textContent ?? '',
  }));
  expect(lvRead.lv).toBeGreaterThan(1);
  expect(lvRead.text).toBe(msg('mar.canon.hud.nivel', { nivel: lvRead.lv }));
  await expect(hud.getByRole('progressbar')).toBeVisible();
  // El agua a bordo, bajo el barco: de un tamaño que se lee y en medio del mar.
  const water = page.getByTestId('mar-canon-agua');
  const w = await expectOnScreen(page, water);
  expect(w.width).toBeGreaterThanOrEqual(60);
  expect(w.height).toBeGreaterThanOrEqual(12);
  const vp = page.viewportSize()!;
  expect(w.x + w.width / 2).toBeGreaterThan(vp.width * 0.2);
  expect(w.x + w.width / 2).toBeLessThan(vp.width * 0.8);
  expect(w.y).toBeGreaterThan(vp.height * 0.2);
  expect(w.y + w.height).toBeLessThan(vp.height * 0.85);
  await expect(water).toHaveAttribute('data-pct', /^\d+$/);
  await expect(water).toHaveAttribute('data-nivel', /^(ok|alerta|peligro)$/);
  await expectTicketsFree(page, [hud, water]);
  expect(errors).toEqual([]);
});

test('carta de nivel con el teclado: flechas, números e Intro; mientras, la partida espera', async ({
  page,
}) => {
  const errors = await openMar(page, '?minijuego=canon&seed=5&carta=1');
  const cards = page.getByTestId('mar-canon-carta');
  const n = SURVIVORS_CONFIG.cardChoices;
  await expect(cards).toHaveCount(n);
  await expect(game(page)).toHaveAttribute('data-estado', 'card');
  // Cada carta dice qué mejora es y lo que da.
  for (let i = 0; i < n; i++) {
    const card = cards.nth(i);
    await expect(card.locator('.mar-canon-card__name')).not.toBeEmpty();
    await expect(card.locator('.mar-canon-card__effect')).toHaveText(/\d/);
    await expect(card).toHaveAttribute(
      'data-tipo',
      /^(weapon|vinyl|evolution|salvavidas|fallback)/,
    );
  }
  // La partida no corre con la carta abierta.
  const before = await activeS(page);
  await page.waitForTimeout(800);
  expect(await activeS(page)).toBe(before);
  // El foco empieza en la primera; flechas y números lo mueven.
  await expect(cards.nth(0)).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(cards.nth(1)).toBeFocused();
  await page.keyboard.press(String(n));
  await expect(cards.nth(n - 1)).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(cards.nth(0)).toBeFocused();
  await page.keyboard.press('ArrowRight');
  const pick = await cards.nth(1).getAttribute('data-mejora');
  await page.keyboard.press('Enter');
  await expect(cards).toHaveCount(0);
  await expect(game(page)).toHaveAttribute('data-mejoras', `${pick}:1`);
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  await expect.poll(() => activeS(page), { timeout: 15_000 }).toBeGreaterThan(before);
  expect(errors).toEqual([]);
});

test('armas y vinilos arriba a la derecha (T130, T148); nada tapa «Entradas»', async ({ page }) => {
  const errors = await openMar(page, '?minijuego=canon&t=120&seed=7');
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  const row = page.getByTestId('mar-canon-equipo');
  const b = await expectOnScreen(page, row);
  const vp = page.viewportSize()!;
  // 4 armas + 4 vinilos (los que dice la config), con el arma inicial ya a bordo.
  const slots = SURVIVORS_CONFIG.slots.weapons + SURVIVORS_CONFIG.slots.vinyls;
  await expect(row.getByTestId('mar-canon-hueco')).toHaveCount(slots);
  await expect(
    row.locator('[data-fila="armas"] [data-id]:not([data-id=""])').first(),
  ).toBeVisible();
  // Arriba a la derecha, donde fuera de la partida están los saldos (T148), en el móvil y en escritorio.
  expect(b.y).toBeLessThan(vp.height * 0.25);
  expect(b.x).toBeGreaterThan(vp.width * 0.5);
  expect(vp.width - (b.x + b.width)).toBeLessThan(24);
  // No tapa la cuenta atrás ni el nivel, ni «Entradas», ni lo demás fijo, ni el agua.
  const hud = page.getByTestId('mar-canon-hud');
  const water = page.getByTestId('mar-canon-agua');
  await expectTicketsFree(page, [row, hud, water]);
  for (const id of ['mar-enlaces', 'mar-minimapa', 'mar-saldos', 'mar-turbo']) {
    const piece = page.getByTestId(id);
    if ((await piece.count()) === 0 || !(await piece.isVisible())) continue;
    expect(overlaps(b, (await piece.boundingBox())!), id).toBe(false);
  }
  expect(overlaps(b, (await hud.boundingBox())!)).toBe(false);
  expect(errors).toEqual([]);
});

// --- «Terminar partida» y el HUD de la beta 3 (T148) ------------------------------------

/** Las cajas de varias piezas en una sola lectura (lo que no está o no se ve, fuera). */
async function boxesOf(page: Page, ids: readonly string[]): Promise<Record<string, Box>> {
  return page.evaluate((list) => {
    const out: Record<string, { x: number; y: number; width: number; height: number }> = {};
    for (const id of list) {
      const el = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) out[id] = { x: r.x, y: r.y, width: r.width, height: r.height };
    }
    return out;
  }, ids);
}

test('Terminar partida: pregunta (Esc y «No» vuelven), acaba en «Partida terminada» sin premio ni cambio de saldos (T148)', async ({
  page,
}) => {
  // Los saldos antes, en una visita sin partida.
  const errors = await openMar(page);
  const before = await balances(page);
  errors.push(...(await openMar(page, '?minijuego=canon&seed=5')));
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  await expect.poll(() => activeS(page), { timeout: 15_000 }).toBeGreaterThan(1);
  const menu = page.getByTestId('mar-menu');
  const quit = page.getByTestId('mar-menu-terminar');
  const confirm = page.getByTestId('mar-menu-terminar-confirmar');

  // Pausa (Esc): «Terminar partida» junto a «Seguir jugando».
  await answerCard(page);
  await page.keyboard.press('Escape');
  await expect(menu).toBeVisible();
  await expect(game(page)).toHaveAttribute('data-estado', 'paused');
  await expect(quit).toHaveText(msg('mar.canon.menu.terminar'));
  // Esc en la pregunta: vuelve atrás sin cerrar el menú ni acabar.
  await quit.click();
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText(msg('mar.canon.menu.terminar.pregunta'));
  await expect(page.getByTestId('mar-menu-terminar-no')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(confirm).toHaveCount(0);
  await expect(menu).toBeVisible();
  await expect(quit).toBeFocused();
  await expect(game(page)).toHaveAttribute('data-estado', 'paused');
  // «No, seguir»: lo mismo.
  await quit.click();
  await page.getByTestId('mar-menu-terminar-no').click();
  await expect(confirm).toHaveCount(0);
  await expect(menu).toBeVisible();
  await expect(game(page)).not.toHaveAttribute('data-fin', /.+/);

  // «Sí, terminar»: se cierra el menú y queda la tarjeta final corta.
  await quit.click();
  await page.getByTestId('mar-menu-terminar-si').click();
  await expect(menu).toHaveCount(0);
  const end = page.getByTestId('mar-canon-final');
  await expect(end).toBeVisible();
  await expect(game(page)).toHaveAttribute('data-estado', 'ended');
  await expect(game(page)).toHaveAttribute('data-fin', 'quit');
  await expect(end).toHaveAttribute('data-fin', 'quit');
  await expect(end).toHaveAttribute('data-ranking', 'no');
  await expect(end.getByRole('heading')).toHaveText(msg('mar.canon.fin.terminada'));
  await expect(end.getByTestId('mar-canon-final-enemigos')).toHaveText(
    (await game(page).getAttribute('data-derrotados'))!,
  );
  await expect(end.getByTestId('mar-canon-final-notas')).toHaveText(
    (await game(page).getAttribute('data-notas'))!,
  );
  await expect(end.getByTestId('mar-canon-final-tiempo')).toHaveText(
    formatPlayed(Number(await game(page).getAttribute('data-activo'))),
  );
  // Sin medalla, sin línea de premio: la sesión se abandonó sin liquidar.
  await expect(end.getByTestId('mar-canon-final-medalla')).toHaveCount(0);
  await expect(end.getByTestId('mar-canon-final-premio')).toHaveCount(0);
  await expect(game(page)).toHaveAttribute('data-premio', 'quit');
  await page.waitForTimeout(1000);
  expect(await balances(page)).toEqual(before);

  // De vuelta al mar: los saldos, iguales; el logro del Cañón no queda listo.
  await page.getByTestId('mar-canon-volver').click();
  await expect(canvas(page)).toHaveAttribute('data-canon', 'off');
  await expect(page.getByTestId('mar-saldos')).toBeVisible();
  expect(await balances(page)).toEqual(before);
  await page.getByTestId('mar-logros').click();
  await page.getByTestId('mar-menu-logros').click();
  await expect(page.getByTestId('logro-canon')).toBeVisible();
  await expect(page.getByTestId('logro-canon')).not.toHaveAttribute('data-estado', 'ready');
  expect(errors).toEqual([]);
});

test('HUD: los saldos se apartan durante la partida y vuelven al volver al mar (T148)', async ({
  page,
}) => {
  const errors = await openMar(page);
  const saldos = page.getByTestId('mar-saldos');
  await expect(saldos).toBeVisible();
  // `&t=412`: casi el final de la noche, para llegar a la tarjeta final enseguida.
  errors.push(...(await openMar(page, '?minijuego=canon&t=412&seed=3')));
  await expect(page.getByTestId('mar-canon-hud')).toBeVisible();
  await expect(saldos).toBeHidden();
  // En su sitio, arriba a la derecha, las armas y los vinilos.
  await expect(page.getByTestId('mar-canon-equipo')).toBeVisible();
  const end = page.getByTestId('mar-canon-final');
  // Las cartas que se abran paran el reloj: se contestan con Intro.
  await expect
    .poll(
      async () => {
        await answerCard(page);
        return end.isVisible();
      },
      { timeout: 60_000, intervals: [300] },
    )
    .toBe(true);
  await expect(saldos).toBeHidden();
  await page.getByTestId('mar-canon-volver').click();
  await expect(canvas(page)).toHaveAttribute('data-canon', 'off');
  await expect(saldos).toBeVisible();
  await expect(page.getByTestId('mar-canon-equipo')).toHaveCount(0);
  expect(errors).toEqual([]);
});

/** Los tamaños de pantalla de la beta 3 (T148): dos teléfonos, una tableta y un escritorio. */
const HUD_SIZES = [
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;

test('HUD: con un boss y las siete armas, los huecos arriba a la derecha no pisan la pausa, el menú, el agua, la barra del boss ni el minimapa (T148)', async ({
  page,
}) => {
  const slot = SURVIVORS_CONFIG.acts[0]!.events.find((e) => e.ref === 'vecino')!;
  // `armas=1`: todas las armas (la fila más larga); el Vecino entra enseguida.
  const errors = await openMar(page, `?minijuego=canon&armas=1&t=${slot.atS - 1}&seed=7`);
  await expect(game(page)).toHaveAttribute('data-estado', /running|card/);
  const slots = page.getByTestId('mar-canon-equipo');
  await expect(slots.locator('[data-fila="armas"] [data-testid="mar-canon-hueco"]')).toHaveCount(
    Object.keys(SURVIVORS_CONFIG.weapons).length,
  );
  await expect
    .poll(
      async () => {
        await answerCard(page);
        return page.getByTestId('mar-canon-jefe').isVisible();
      },
      { timeout: 60_000, intervals: [250] },
    )
    .toBe(true);
  // En pausa (el menú encima no mueve el HUD): el boss sigue en su barra mientras se mide.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('mar-menu')).toBeVisible();
  await expect(game(page)).toHaveAttribute('data-estado', 'paused');
  const ids = [
    'mar-canon-equipo',
    'mar-canon-hud',
    'mar-canon-pausa',
    'mar-canon-tiempo',
    'mar-canon-jefe',
    'mar-canon-agua',
    'mar-logros',
    'mar-minimapa',
    'mar-enlaces',
    'mar-entradas',
    'mar-turbo',
    'mar-touch',
  ];
  for (const size of HUD_SIZES) {
    await page.setViewportSize(size);
    let boxes: Record<string, Box> = {};
    await expect
      .poll(
        async () => {
          boxes = await boxesOf(page, ids);
          return !!boxes['mar-canon-equipo'] && !!boxes['mar-canon-hud'] && !!boxes['mar-canon-jefe'];
        },
        { timeout: 30_000, intervals: [200] },
      )
      .toBe(true);
    const where = `${size.width}×${size.height}`;
    const eq = boxes['mar-canon-equipo']!;
    const hud = boxes['mar-canon-hud']!;
    // Dentro de la pantalla y arriba a la derecha.
    expect(eq.x, where).toBeGreaterThanOrEqual(0);
    expect(eq.y, where).toBeGreaterThanOrEqual(0);
    expect(eq.x + eq.width, where).toBeLessThanOrEqual(size.width + 0.5);
    expect(eq.x + eq.width / 2, where).toBeGreaterThan(size.width / 2);
    expect(eq.y, where).toBeLessThan(size.height * 0.2);
    for (const id of ids.slice(1)) {
      const b = boxes[id];
      if (!b) continue;
      expect(overlaps(eq, b), `${where}: equipo × ${id}`).toBe(false);
    }
    // El HUD de en medio, más pequeño, tampoco pisa el minimapa, los enlaces ni el menú.
    expect(hud.height, where).toBeLessThanOrEqual(76);
    for (const id of ['mar-minimapa', 'mar-enlaces', 'mar-logros', 'mar-entradas']) {
      const b = boxes[id];
      if (b) expect(overlaps(hud, b), `${where}: hud × ${id}`).toBe(false);
    }
  }
  expect(errors).toEqual([]);
});

test('el atajo carta=surtido enseña una carta de cada clase; la evolución destaca y deja su arma dorada en la fila (T130)', async ({
  page,
}) => {
  const errors = await openMar(page, '?minijuego=canon&seed=3&carta=surtido');
  const cards = page.getByTestId('mar-canon-carta');
  await expect(cards).toHaveCount(6);
  const kinds = await cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-tipo')));
  expect([...kinds].sort()).toEqual(
    ['evolution', 'salvavidas', 'vinyl-level', 'vinyl-new', 'weapon-level', 'weapon-new'].sort(),
  );
  // Cada una: nombre, lo que da y su clase; las de nivel dicen «Nivel n: …».
  for (let i = 0; i < 6; i++) {
    const card = cards.nth(i);
    await expect(card.locator('.mar-canon-card__name')).not.toBeEmpty();
    await expect(card.locator('.mar-canon-card__tag')).not.toBeEmpty();
    const effect = card.locator('.mar-canon-card__effect');
    await expect(effect).not.toBeEmpty();
    await expect(effect).not.toContainText(/[{}]/);
    const kind = kinds[i]!;
    if (kind.endsWith('-level')) await expect(effect).toContainText(/^Nivel \d/);
  }
  // La evolución destaca (clase aparte) y ya ocupa su sitio en la oferta.
  const evo = page.locator('[data-testid="mar-canon-carta"][data-tipo="evolution"]');
  await expect(evo).toHaveCount(1);
  await expect(evo).toHaveClass(/is-evolution/);
  const evoIndex = kinds.indexOf('evolution');
  await page.waitForTimeout(500);
  await page.keyboard.press(String(evoIndex + 1));
  await page.keyboard.press('Enter');
  await expect(cards).toHaveCount(0);
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  await expect(page.locator('[data-testid="mar-canon-hueco"].is-evolved')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('carta de nivel con el dedo: grandes, a la vista y sin tapar «Entradas»', async ({
  page,
  isMobile,
}) => {
  const errors = await openMar(page, '?minijuego=canon&seed=9&carta=1');
  const cards = page.getByTestId('mar-canon-carta');
  const n = SURVIVORS_CONFIG.cardChoices;
  await expect(cards).toHaveCount(n);
  const pieces: Locator[] = [page.getByTestId('mar-canon-hud')];
  for (let i = 0; i < n; i++) {
    const b = await expectOnScreen(page, cards.nth(i));
    // Áreas táctiles amplias.
    expect(b.height).toBeGreaterThanOrEqual(64);
    expect(b.width).toBeGreaterThanOrEqual(150);
    pieces.push(cards.nth(i));
  }
  await expectTicketsFree(page, pieces);
  // Un momento tras abrirse no se elige sin querer; luego, un toque elige.
  await page.waitForTimeout(500);
  const last = cards.nth(n - 1);
  const pick = await last.getAttribute('data-mejora');
  if (isMobile) await last.tap();
  else await last.click();
  await expect(cards).toHaveCount(0);
  await expect(game(page)).toHaveAttribute('data-mejoras', `${pick}:1`);
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  expect(errors).toEqual([]);
});

test('Esc abre el menú de /mar con el aviso de salir; al cerrarlo sigue; la pausa y las fichas también paran', async ({
  page,
}) => {
  const errors = await openMar(page, '?minijuego=canon&seed=4');
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  await expect.poll(() => activeS(page), { timeout: 15_000 }).toBeGreaterThan(0.5);
  const menu = page.getByTestId('mar-menu');

  await page.keyboard.press('Escape');
  await expect(menu).toBeVisible();
  await expect(page.getByTestId('mar-menu-aviso-partida')).toHaveText(msg('mar.canon.menu.aviso'));
  await expect(game(page)).toHaveAttribute('data-estado', 'paused');
  const paused = await activeS(page);
  await page.waitForTimeout(800);
  expect(await activeS(page)).toBe(paused);
  // Cerrar el menú (Esc otra vez) sigue la partida.
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  await expect.poll(() => activeS(page), { timeout: 15_000 }).toBeGreaterThan(paused);

  // El botón de pausa del HUD abre el mismo menú; «Seguir jugando» lo cierra.
  await page.getByTestId('mar-canon-pausa').click();
  await expect(menu).toBeVisible();
  await expect(game(page)).toHaveAttribute('data-estado', 'paused');
  await page.getByTestId('mar-menu-seguir').click();
  await expect(menu).toHaveCount(0);
  await expect(game(page)).toHaveAttribute('data-estado', 'running');

  // «Mis códigos» desde el menú también deja la partida en pausa (T116).
  await page.getByTestId('mar-canon-pausa').click();
  await page.getByTestId('mar-mis-codigos').click();
  await expect(page.getByTestId('mar-ficha')).toHaveAttribute('data-tipo', 'codes');
  await expect(game(page)).toHaveAttribute('data-estado', 'paused');
  const inSheet = await activeS(page);
  await page.waitForTimeout(800);
  expect(await activeS(page)).toBe(inSheet);
  await page
    .getByTestId('mar-ficha')
    .getByRole('button', { name: msg('mar.sheet.cerrar') })
    .click();
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  expect(errors).toEqual([]);
});

test('pantalla final con tiempo, enemigos y notas; «Otra vez» empieza otra donde está el barco', async ({
  page,
}) => {
  const errors = await openMar(page, '?minijuego=canon&t=416&seed=3');
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  const end = page.getByTestId('mar-canon-final');
  await expect(end).toBeVisible({ timeout: 60_000 });
  await expect(game(page)).toHaveAttribute('data-estado', 'ended');
  const reason = (await game(page).getAttribute('data-fin')) as 'survived' | 'flooded';
  expect(['survived', 'flooded']).toContain(reason);
  await expect(end).toHaveAttribute('data-fin', reason);
  await expect(end.getByRole('heading')).toHaveText(
    msg(reason === 'survived' ? 'mar.canon.fin.amanece' : 'mar.canon.fin.inundado'),
  );
  await expect(end.getByTestId('mar-canon-final-enemigos')).toHaveText(
    (await game(page).getAttribute('data-derrotados'))!,
  );
  await expect(end.getByTestId('mar-canon-final-notas')).toHaveText(
    (await game(page).getAttribute('data-notas'))!,
  );
  await expect(end.getByTestId('mar-canon-final-tiempo')).toHaveText(
    formatPlayed(Number(await game(page).getAttribute('data-activo'))),
  );
  // El HUD se va; la escena se queda quieta detrás y el mundo sigue apartado.
  await expect(page.getByTestId('mar-canon-hud')).toHaveCount(0);
  await expect(canvas(page)).toHaveAttribute('data-canon', 'on');
  await expect(canvas(page)).toHaveAttribute('data-ruta', 'off');
  await expectTicketsFree(page, [end]);
  const where = pointOf(await game(page).getAttribute('data-barco'));

  await page.getByTestId('mar-canon-otra').click();
  await expect(end).toHaveCount(0);
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  await expect(page.getByTestId('mar-canon-hud')).toBeVisible();
  expect(Number(await game(page).getAttribute('data-tiempo'))).toBeGreaterThan(
    SURVIVORS_CONFIG.durationS - 10,
  );
  expect(dist(pointOf(await game(page).getAttribute('data-barco')), where)).toBeLessThan(80);
  await expect(canvas(page)).toHaveAttribute('data-ruta', 'off');
  expect(errors).toEqual([]);
});

// --- Sesión, premio y finales (T119) --------------------------------------------------

/** Los saldos del mar: ★ puntos y 🪙 monedas. */
async function balances(page: Page): Promise<{ points: number; coins: number }> {
  const text = (await page.getByTestId('mar-saldos').textContent()) ?? '';
  return {
    points: Number(/★\s*(\d+)/.exec(text)?.[1] ?? NaN),
    coins: Number(/🪙\s*(\d+)/.exec(text)?.[1] ?? NaN),
  };
}

const prize = (page: Page) => page.getByTestId('mar-canon-final-premio');

test('sin esquivar, el agua llena el barco: «¡Barco inundado!» y sin premio', async ({ page }) => {
  const errors = await openMar(page, '?minijuego=canon&t=200&seed=2');
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  // Nadie toca el timón: las pirañas llegan y el agua sube.
  await expect
    .poll(async () => Number(await game(page).getAttribute('data-agua')), { timeout: 60_000 })
    .toBeGreaterThan(0);
  const end = page.getByTestId('mar-canon-final');
  // Las armas de la beta 2 suben de nivel aun sin timón, y cada carta para la
  // partida hasta elegir: se coge la primera con Intro, sin esquivar nada.
  await expect
    .poll(
      async () => {
        if ((await game(page).getAttribute('data-estado')) === 'card') {
          await page.keyboard.press('Enter');
        }
        return end.isVisible();
      },
      { timeout: 120_000, intervals: [500] },
    )
    .toBe(true);
  await expect(game(page)).toHaveAttribute('data-fin', 'flooded');
  await expect(end).toHaveAttribute('data-fin', 'flooded');
  await expect(end.getByRole('heading')).toHaveText(msg('mar.canon.fin.inundado'));
  // La tarjeta final (T145): sin medalla, acto y dificultad, equipo y bosses.
  await expect(end.getByTestId('mar-canon-final-medalla')).toHaveText(
    msg('mar.canon.fin.medalla.ninguna'),
  );
  await expect(end.getByTestId('mar-canon-final-partida')).toHaveText(
    msg('mar.canon.fin.partida', { acto: 1, dificultad: msg('mar.canon.dificultad.normal') }),
  );
  await expect(end.getByTestId('mar-canon-final-desbloqueo')).toHaveCount(0);
  expect(
    await end.getByTestId('mar-canon-final-equipo').locator('[data-item]').count(),
  ).toBeGreaterThan(0);
  await expect(end.getByTestId('mar-canon-final-bosses')).toContainText(
    msg('mar.canon.fin.bosses'),
  );
  // La sesión se liquida: perdida, sin premio ni línea de premio.
  await expect(game(page)).toHaveAttribute('data-premio', 'not_won');
  await expect(prize(page)).toHaveAttribute('data-premio', 'not_won');
  await expect(prize(page)).toHaveText('');
  // De vuelta al mar.
  await page.getByTestId('mar-canon-volver').click();
  await expect(canvas(page)).toHaveAttribute('data-canon', 'off');
  await expect(canvas(page)).toHaveAttribute('data-ruta', 'on');
  expect(errors).toEqual([]);
});

test('llegar al amanecer da el premio del bronce una vez al día (T153), y el logro del Cañón', async ({
  page,
}) => {
  const { points: rewardPoints, coins: rewardCoins } = CANON_MEDAL_PRIZES.bronce;
  // Los saldos antes de jugar, en una visita sin partida: con `&t=419` la
  // partida acaba en un segundo y el premio podría llegar antes de leerlos.
  const errors = await openMar(page);
  const before = await balances(page);
  // `&t=419`: el último segundo de la noche (atajo de desarrollo).
  errors.push(...(await openMar(page, '?minijuego=canon&t=419&seed=3')));
  await expect(game(page)).toHaveAttribute('data-semilla', '3');
  const end = page.getByTestId('mar-canon-final');
  await expect(end).toBeVisible({ timeout: 60_000 });
  await expect(game(page)).toHaveAttribute('data-fin', 'survived');
  await expect(end.getByRole('heading')).toHaveText(msg('mar.canon.fin.amanece'));
  // Amanecer sin los minibosses vencidos: bronce (T144, en la tarjeta: T147).
  await expect(end.getByTestId('mar-canon-final-medalla')).toHaveAttribute(
    'data-medalla',
    'bronce',
  );
  await expect(end.getByTestId('mar-canon-final-medalla')).toHaveText(
    msg('mar.canon.fin.medalla.bronce'),
  );
  await expect(end.getByTestId('mar-canon-final-tiempo')).toHaveText(formatPlayed(420));
  // La sesión valida el tiempo activo y el libro da el premio.
  await expect(game(page)).toHaveAttribute('data-premio', 'granted', { timeout: 15_000 });
  await expect(prize(page)).toHaveText(
    msg('mar.canon.premio.ganado', { puntos: rewardPoints, monedas: rewardCoins }),
  );
  await expect
    .poll(() => balances(page), { timeout: 15_000 })
    .toEqual({ points: before.points + rewardPoints, coins: before.coins + rewardCoins });
  await page.getByTestId('mar-canon-volver').click();
  await expect(canvas(page)).toHaveAttribute('data-canon', 'off');
  // La señal `win_minigame`: el logro «canon» queda listo para reclamar.
  await page.getByTestId('mar-logros').click();
  await page.getByTestId('mar-menu-logros').click();
  await expect(page.getByTestId('logro-canon')).toHaveAttribute('data-estado', 'ready');

  // Otra visita, otro bronce el mismo día: vale, pero no paga otra vez.
  await openMar(page);
  const again = await balances(page);
  await openMar(page, '?minijuego=canon&t=419&seed=5');
  await expect(end).toBeVisible({ timeout: 60_000 });
  await expect(game(page)).toHaveAttribute('data-fin', 'survived');
  await expect(game(page)).toHaveAttribute('data-premio', 'duplicate', { timeout: 15_000 });
  await expect(prize(page)).toHaveText(msg('mar.canon.premio.repetido'));
  await page.waitForTimeout(1000);
  expect(await balances(page)).toEqual(again);
  expect(errors).toEqual([]);
});

test('en producción, con `?dev=1`, una partida de `&t=` llega al amanecer pero no da premio ni logro (T121)', async ({
  page,
}) => {
  // Como un navegador cualquiera: sin `navigator.webdriver`, los atajos sólo
  // se encienden con `?dev=1` (el servidor de las e2e es un build de producción).
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false });
  });
  const errors = await openMar(page, '?dev=1&minijuego=canon&t=419&seed=3');
  expect(await page.evaluate(() => navigator.webdriver)).toBe(false);
  await expect(game(page)).toHaveAttribute('data-semilla', '3');
  const before = await balances(page);
  const end = page.getByTestId('mar-canon-final');
  await expect(end).toBeVisible({ timeout: 60_000 });
  await expect(game(page)).toHaveAttribute('data-fin', 'survived');
  await expect(end.getByRole('heading')).toHaveText(msg('mar.canon.fin.amanece'));
  await expect(game(page)).toHaveAttribute('data-premio', 'test_start', { timeout: 15_000 });
  await expect(prize(page)).toHaveText(msg('mar.canon.premio.prueba'));
  await page.waitForTimeout(1000);
  expect(await balances(page)).toEqual(before);
  await page.getByTestId('mar-canon-volver').click();
  await expect(canvas(page)).toHaveAttribute('data-canon', 'off');
  // Sin `win_minigame`: el logro «canon» no queda listo para reclamar.
  await page.getByTestId('mar-logros').click();
  await page.getByTestId('mar-menu-logros').click();
  await expect(page.getByTestId('logro-canon')).toBeVisible();
  await expect(page.getByTestId('logro-canon')).not.toHaveAttribute('data-estado', 'ready');
  expect(errors).toEqual([]);
});

test('más de 5 minutos en pausa abandona la partida: vuelve el mundo, con aviso y sin premio', async ({
  page,
}) => {
  const errors = await openMar(page, '?minijuego=canon&seed=4');
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  await expect.poll(() => activeS(page), { timeout: 15_000 }).toBeGreaterThan(0.5);
  // La pestaña se oculta y el reloj salta 5 min y 1 s (como si la página se congelara).
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    const real = performance.now.bind(performance);
    performance.now = () => real() + 301_000;
  });
  await expect(page.getByTestId('mar-canon-aviso')).toContainText(msg('mar.canon.abandono'), {
    timeout: 15_000,
  });
  await expect(game(page)).toHaveAttribute('data-fin', 'abandoned');
  await expect(game(page)).toHaveAttribute('data-premio', 'abandoned');
  // Sin pantalla final: el mundo ya ha vuelto.
  await expect(page.getByTestId('mar-canon-final')).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });
  await expect(canvas(page)).toHaveAttribute('data-canon', 'off');
  await expect(canvas(page)).toHaveAttribute('data-ruta', 'on');
  await expect(canvas(page)).not.toHaveAttribute('data-escondido', /.+/);
  expect(errors).toEqual([]);
});

test('con la Boia Fiestera a bordo, sigue a bordo durante la partida y después', async ({
  page,
}) => {
  const spec = rescueMissionOf(WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config)!;
  const errors = await openMar(page, `?cerca=${spec.characterId}`);
  await expect(mar(page)).toHaveAttribute('data-mision', 'waiting');
  await steerTo(
    page,
    spec.characterId,
    async () => (await mar(page).getAttribute('data-mision')) === 'aboard',
  );
  await expect(mar(page)).toHaveAttribute('data-mision', 'aboard');

  // Una partida (otra visita, con el atajo): ella no se baja.
  await openMar(page, '?minijuego=canon&t=418&seed=6');
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  await expect(mar(page)).toHaveAttribute('data-mision', 'aboard');
  await expect(page.getByTestId('mar-canon-final')).toBeVisible({ timeout: 60_000 });
  await expect(mar(page)).toHaveAttribute('data-mision', 'aboard');
  await page.getByTestId('mar-canon-volver').click();
  await expect(canvas(page)).toHaveAttribute('data-canon', 'off');
  // La misión sigue: su «?» va con ella, camino de su destino.
  await expect(mar(page)).toHaveAttribute('data-mision', 'aboard');
  const minimap = page.getByTestId('mar-minimapa').locator('canvas');
  await expect
    .poll(async () => (await minimap.getAttribute('data-mark-places')) ?? '')
    .toContain(spec.destination);
  expect(errors).toEqual([]);
});

test('el pop-up previo ofrece tres dificultades con Normal marcada y la elegida empieza la partida (T131, T151)', async ({
  page,
}) => {
  const errors = await openMar(page, '?minijuego=canon&oferta=1');
  await expect(panel(page)).toBeVisible({ timeout: 15_000 });
  // Ya no van en el panel de la isla: en el pop-up que abre su «Jugar».
  await expect(panel(page).getByTestId('mar-canon-dificultad')).toHaveCount(0);
  const box = await openPrevia(page);
  const group = box.getByTestId('mar-canon-dificultad');
  await expect(group).toBeVisible();
  const option = (id: string) => box.getByTestId(`mar-canon-dificultad-${id}`);
  for (const id of ['tranquila', 'normal', 'tormenta']) {
    await expect(option(id)).toHaveText(msg(`mar.canon.dificultad.${id}` as MessageKey));
    await expect(option(id)).toHaveAttribute('aria-checked', id === 'normal' ? 'true' : 'false');
  }
  await expect(box.getByTestId('mar-canon-previa-dificultad-texto')).toHaveText(
    msg('mar.canon.dificultad.normal.texto'),
  );
  // Con el teclado: la flecha mueve la selección; con el dedo o el ratón: un toque.
  await option('normal').focus();
  await page.keyboard.press('ArrowLeft');
  await expect(option('tranquila')).toHaveAttribute('aria-checked', 'true');
  await expect(option('tranquila')).toBeFocused();
  await option('tormenta').dispatchEvent('click');
  await expect(option('tormenta')).toHaveAttribute('aria-checked', 'true');
  await expect(option('normal')).toHaveAttribute('aria-checked', 'false');
  await expect(box).toHaveAttribute('data-dificultad', 'tormenta');
  await expect(box.getByTestId('mar-canon-previa-dificultad-texto')).toHaveText(
    msg('mar.canon.dificultad.tormenta.texto'),
  );
  await expect(box.getByTestId('mar-canon-previa-jugar')).toContainText(
    msg('mar.canon.previa.eleccion', { n: 1, dificultad: msg('mar.canon.dificultad.tormenta') }),
  );
  await box.getByTestId('mar-canon-previa-jugar').click();
  await expect(game(page)).toHaveAttribute('data-estado', 'running', { timeout: 20_000 });
  await expect(game(page)).toHaveAttribute('data-dificultad', 'tormenta');
  await expect(game(page)).toHaveAttribute('data-acto', '1');
  expect(errors).toEqual([]);
});

test('`&dificultad=tormenta` (atajo de desarrollo) empieza con esa dificultad; sin él, Normal (T131)', async ({
  page,
}) => {
  const errors = await openMar(page, '?minijuego=canon&seed=7&dificultad=tormenta');
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  await expect(game(page)).toHaveAttribute('data-dificultad', 'tormenta');
  const again = await openMar(page, '?minijuego=canon&seed=7');
  await expect(game(page)).toHaveAttribute('data-dificultad', 'normal');
  expect([...errors, ...again]).toEqual([]);
});

/** El hueco del boss final del acto `act` en el guion (T144). */
const finalSlot = (act: number) =>
  SURVIVORS_CONFIG.acts
    .find((a) => a.act === act)!
    .events.find((e) => e.type === 'boss' && e.enabled !== false)!;

test('campaña en el pop-up previo: el acto 2 cerrado de primeras y el 3 «Próximamente»; vencer al Barco Fantasma (`vencer=1`) abre el 2 y «Jugar» lo empieza (T144, T151)', async ({
  page,
}) => {
  // Un visitante nuevo: Acto 1 marcado, Acto 2 cerrado, Acto 3 «próximamente».
  const errors = await openMar(page, '?minijuego=canon&oferta=1');
  await expect(panel(page)).toBeVisible({ timeout: 15_000 });
  await openPrevia(page);
  const acts = previa(page).getByTestId('mar-canon-acto');
  const act = (n: number) => previa(page).getByTestId(`mar-canon-acto-${n}`);
  await expect(acts).toBeVisible();
  // Junto a las dificultades y «Jugar».
  await expect(previa(page).getByTestId('mar-canon-dificultad')).toBeVisible();
  await expect(act(1)).toHaveAttribute('aria-checked', 'true');
  await expect(act(1)).toHaveAttribute('data-estado', 'open');
  await expect(act(2)).toHaveAttribute('data-estado', 'locked');
  await expect(act(2)).toHaveAttribute('aria-disabled', 'true');
  await expect(act(2)).toContainText(msg('mar.canon.acto.cerrado'));
  await expect(act(3)).toHaveAttribute('data-estado', 'soon');
  await expect(act(3)).toContainText(msg('mar.canon.acto.proximamente'));
  await expect(act(3)).toHaveAttribute('aria-disabled', 'true');
  // Cada acto dice su boss final; el ranking es el del acto marcado.
  await expect(act(1)).toContainText(msg('survivors.boss.fantasma'));
  await expect(act(2)).toContainText(msg('survivors.boss.kraken'));
  await expect(previa(page).getByTestId('mar-canon-previa-ranking')).toHaveAttribute(
    'data-boss',
    finalSlot(1).ref,
  );
  // Ni el dedo ni las flechas marcan un acto cerrado.
  await act(2).dispatchEvent('click');
  await expect(act(1)).toHaveAttribute('aria-checked', 'true');
  await act(1).focus();
  await page.keyboard.press('ArrowRight');
  await expect(act(1)).toHaveAttribute('aria-checked', 'true');
  await expect(act(2)).toHaveAttribute('aria-checked', 'false');
  await act(3).dispatchEvent('click');
  await expect(act(1)).toHaveAttribute('aria-checked', 'true');
  await expect(previa(page)).toHaveAttribute('data-acto', '1');

  // Vencer al boss final del acto 1 (atajo: cae en cuanto aparece): oro, y se abre el acto 2.
  const slot = finalSlot(1);
  const won = await openMar(page, `?minijuego=canon&t=${slot.atS + 1}&seed=7&vencer=1`);
  await expect(game(page)).toHaveAttribute('data-fin', 'victory', { timeout: 30_000 });
  await expect(game(page)).toHaveAttribute('data-medalla', 'oro');
  await expect(game(page)).toHaveAttribute('data-vencidos', new RegExp(slot.ref));
  await expect(game(page)).toHaveAttribute('data-desbloqueado', '2', { timeout: 15_000 });
  // La tarjeta final lo dice (T147): el oro y el acto 2 abierto.
  const medal = page.getByTestId('mar-canon-final-medalla');
  await expect(medal).toHaveAttribute('data-medalla', 'oro');
  await expect(medal).toHaveText(msg('mar.canon.fin.medalla.oro'));
  await expect(page.getByTestId('mar-canon-final-desbloqueo')).toHaveAttribute('data-acto', '2');
  await page.getByTestId('mar-canon-volver').click();
  await expect(page.getByTestId('mar-canon-final')).toHaveCount(0);

  // Otra visita: el acto 2 abierto (y el 1, superado); el pop-up lo empieza.
  const again = await openMar(page, '?minijuego=canon&oferta=1');
  await expect(panel(page)).toBeVisible({ timeout: 15_000 });
  await openPrevia(page);
  await expect(act(1)).toContainText(msg('mar.canon.acto.superado'));
  await expect(act(1)).toHaveAttribute('data-superado', 'si');
  await expect(act(2)).toHaveAttribute('data-estado', 'open');
  await expect(act(2)).not.toHaveAttribute('aria-disabled', 'true');
  await expect(act(3)).toHaveAttribute('data-estado', 'soon');
  await act(1).focus();
  await page.keyboard.press('ArrowRight');
  await expect(act(2)).toHaveAttribute('aria-checked', 'true');
  await expect(act(2)).toBeFocused();
  await expect(previa(page).getByTestId('mar-canon-previa-ranking')).toHaveAttribute(
    'data-boss',
    finalSlot(2).ref,
  );
  await previa(page).getByTestId('mar-canon-previa-jugar').click();
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  await expect(game(page)).toHaveAttribute('data-acto', '2');
  expect([...errors, ...won, ...again]).toEqual([]);
});

test('pop-up previo: se abre con «Jugar» del panel, entero en pantalla y sin tapar «Entradas»; ranking del boss; Tab no sale; Esc y la × vuelven al panel (T151)', async ({
  page,
  isMobile,
}) => {
  const errors = await openMar(page, '?minijuego=canon&oferta=1');
  await expect(panel(page)).toBeVisible({ timeout: 15_000 });
  const box = await openPrevia(page);
  await expect(box).toHaveAttribute('role', 'dialog');
  await expect(box).toHaveAttribute('aria-modal', 'true');
  await expect(box).toContainText(msg('mar.canon.title'));
  await expect(box.getByTestId('mar-canon-previa-beta')).toHaveCount(0);
  // De entrada: Acto 1, Normal, con el foco en el acto marcado.
  await expect(box).toHaveAttribute('data-acto', '1');
  await expect(box).toHaveAttribute('data-dificultad', 'normal');
  await expect(box.getByTestId('mar-canon-acto-1')).toBeFocused();
  // Entero en pantalla, «Jugar» incluido, y «Entradas» a mano.
  await expectOnScreen(page, box);
  await expectOnScreen(page, box.getByTestId('mar-canon-previa-jugar'));
  await expectTicketsFree(page, [box]);
  // Áreas táctiles amplias.
  for (const id of ['mar-canon-acto-1', 'mar-canon-dificultad-normal', 'mar-canon-previa-cerrar']) {
    const b = (await box.getByTestId(id).boundingBox())!;
    expect(b.height, id).toBeGreaterThanOrEqual(44);
  }
  const playBox = (await box.getByTestId('mar-canon-previa-jugar').boundingBox())!;
  expect(playBox.height).toBeGreaterThanOrEqual(48);
  // El ranking del boss final del acto elegido (T155; en modo local, la tripulación de muestra).
  const ranking = box.getByTestId('mar-canon-previa-ranking');
  await expect(ranking).toHaveAttribute('data-boss', finalSlot(1).ref);
  await expect(ranking).toContainText(
    msg('mar.canon.previa.ranking', { nombre: msg('survivors.boss.fantasma') }),
  );
  await expect(ranking.getByTestId('mar-canon-ranking-tabla')).toHaveAttribute(
    'data-boss',
    finalSlot(1).ref,
  );
  // Tab da la vuelta dentro del diálogo; mientras, el barco no se mueve.
  const before = await shipAt(page);
  const inside = () => box.evaluate((el) => el.contains(document.activeElement));
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    expect(await inside()).toBe(true);
  }
  await page.keyboard.press('Shift+Tab');
  expect(await inside()).toBe(true);
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowUp');
  expect(dist(await shipAt(page), before)).toBeLessThan(5);
  // Esc lo cierra (sin abrir el menú) y vuelve el panel de la isla.
  await page.keyboard.press('Escape');
  await expect(previa(page)).toHaveCount(0);
  await expect(panel(page)).toBeVisible();
  await expect(page.getByTestId('mar-menu')).toHaveCount(0);
  await expect(game(page)).toHaveCount(0);
  // Otra vez, ahora con el dedo (o el ratón): la ×.
  const again = await openPrevia(page);
  const close = again.getByTestId('mar-canon-previa-cerrar');
  if (isMobile) await close.tap();
  else await close.click();
  await expect(previa(page)).toHaveCount(0);
  await expect(panel(page)).toBeVisible();
  // Y «Jugar» con el dedo empieza la partida elegida.
  const third = await openPrevia(page);
  const tormenta = third.getByTestId('mar-canon-dificultad-tormenta');
  if (isMobile) await tormenta.tap();
  else await tormenta.click();
  const play = third.getByTestId('mar-canon-previa-jugar');
  if (isMobile) await play.tap();
  else await play.click();
  await expect(previa(page)).toHaveCount(0);
  await expect(game(page)).toHaveAttribute('data-estado', 'running', { timeout: 20_000 });
  await expect(game(page)).toHaveAttribute('data-dificultad', 'tormenta');
  await expect(game(page)).toHaveAttribute('data-acto', '1');
  expect(errors).toEqual([]);
});

/** Las filas del ranking del pop-up (T155) y la tuya. */
const rankingRows = (page: Page) => previa(page).getByTestId('mar-canon-ranking-fila');
const myRankingRow = (page: Page) => rankingRows(page).and(page.locator('[data-mio="si"]'));
/** Las puntuaciones de las filas, en orden (null: tú sin partida). */
const rankingScores = (page: Page) =>
  rankingRows(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-puntos')));

test('ranking por boss (T155): en el pop-up, la tripulación de muestra del boss; tras una partida, tu puntuación, tu mejor y tu puesto en la tarjeta final y en el pop-up; las de atajo no entran', async ({
  page,
}) => {
  const boss = finalSlot(1).ref as BossId;
  const crew = Object.values(SAMPLE_CANON_SCORES[boss]!).sort((a, b) => b - a);
  // Un visitante nuevo: los de muestra, de más a menos, y tú al final sin partida.
  const errors = await openMar(page, '?minijuego=canon&oferta=1');
  await expect(panel(page)).toBeVisible({ timeout: 15_000 });
  await openPrevia(page);
  const ranking = () => previa(page).getByTestId('mar-canon-ranking');
  await expect(ranking()).toHaveAttribute('data-ranking', 'local');
  await expect(ranking().getByTestId('mar-canon-ranking-tabla')).toHaveAttribute('data-boss', boss);
  expect(await rankingScores(page)).toEqual([...crew.map(String), null]);
  await expect(myRankingRow(page)).toContainText(msg('mar.canon.ranking.tu.sin'));

  // Una partida de atajo (`&t=`) no entra en el ranking, y la tarjeta lo dice.
  errors.push(...(await openMar(page, '?minijuego=canon&t=419&seed=3')));
  const end = page.getByTestId('mar-canon-final');
  const rank = end.getByTestId('mar-canon-final-ranking');
  await expect(end).toBeVisible({ timeout: 60_000 });
  await expect(rank).toHaveAttribute('data-ranking', 'off', { timeout: 15_000 });
  await expect(rank).toHaveAttribute('data-motivo', 'test');
  await expect(end.getByTestId('mar-canon-final-puesto')).toHaveText(
    msg('mar.canon.fin.ranking.prueba'),
  );
  await expect(end.getByTestId('mar-canon-final-mejor')).toHaveCount(0);

  // Con el ayudante de las pruebas (`&ranking=1`, sólo en dev y e2e) entra en el ranking local.
  errors.push(...(await openMar(page, '?minijuego=canon&t=419&seed=3&ranking=1')));
  await expect(end).toBeVisible({ timeout: 60_000 });
  await expect(game(page)).toHaveAttribute('data-fin', 'survived');
  await expect(rank).toHaveAttribute('data-ranking', 'local', { timeout: 15_000 });
  const defeated = Number(await end.getByTestId('mar-canon-final-enemigos').textContent());
  const notes = Number(await end.getByTestId('mar-canon-final-notas').textContent());
  const medal = (await end.getByTestId('mar-canon-final-medalla').getAttribute('data-medalla')) as
    | SurvivorsMedal
    | 'ninguna';
  const score = canonGameScore({
    defeated,
    notes,
    medal: medal === 'ninguna' ? null : medal,
    playedS: SURVIVORS_CONFIG.durationS,
    difficulty: 'normal',
  }).total;
  expect(score).toBeGreaterThan(0);
  const place = crewCanonPlace(score, boss);
  await expect(rank).toHaveAttribute('data-boss', boss);
  await expect(rank).toHaveAttribute('data-puntos', String(score));
  await expect(rank).toHaveAttribute('data-mejor', String(score));
  await expect(rank).toHaveAttribute('data-puesto', String(place.position));
  await expect(end.getByTestId('mar-canon-final-puntos')).toContainText(
    new Intl.NumberFormat('es-ES').format(score),
  );
  await expect(end.getByTestId('mar-canon-final-mejor')).toHaveText(
    msg('mar.canon.fin.ranking.nuevo'),
  );
  await expect(end.getByTestId('mar-canon-final-puesto')).toHaveText(
    msg('mar.canon.fin.ranking.puesto', { puesto: place.position, total: place.of }),
  );
  await page.getByTestId('mar-canon-volver').click();
  await expect(canvas(page)).toHaveAttribute('data-canon', 'off');

  // De vuelta en el pop-up: tu mejor en su puesto entre los de muestra.
  errors.push(...(await openMar(page, '?minijuego=canon&oferta=1')));
  await expect(panel(page)).toBeVisible({ timeout: 15_000 });
  await openPrevia(page);
  await expect(myRankingRow(page)).toHaveAttribute('data-puntos', String(score));
  await expect(myRankingRow(page)).toHaveAttribute('data-puesto', String(place.position));
  await expect(myRankingRow(page)).toContainText(msg('mar.canon.ranking.tu'));
  expect(await rankingScores(page)).toEqual([...crew, score].sort((a, b) => b - a).map(String));
  expect(errors).toEqual([]);
});

test('ranking por boss (T155): una partida del pop-up acabada con «Terminar partida» no se puntúa ni entra', async ({
  page,
}) => {
  const errors = await openMar(page, '?minijuego=canon&oferta=1');
  await expect(panel(page)).toBeVisible({ timeout: 15_000 });
  const box = await openPrevia(page);
  await box.getByTestId('mar-canon-previa-jugar').click();
  await expect(game(page)).toHaveAttribute('data-estado', 'running', { timeout: 20_000 });
  await expect.poll(() => activeS(page), { timeout: 15_000 }).toBeGreaterThan(1);
  await answerCard(page);
  await quitFromPause(page);
  const end = page.getByTestId('mar-canon-final');
  await expect(end).toHaveAttribute('data-ranking', 'no');
  await page.waitForTimeout(1000);
  await expect(end.getByTestId('mar-canon-final-ranking')).toHaveCount(0);
  await page.getByTestId('mar-canon-volver').click();
  await expect(canvas(page)).toHaveAttribute('data-canon', 'off');
  // En el pop-up sigues sin partida.
  errors.push(...(await openMar(page, '?minijuego=canon&oferta=1')));
  await expect(panel(page)).toBeVisible({ timeout: 15_000 });
  await openPrevia(page);
  await expect(myRankingRow(page)).toContainText(msg('mar.canon.ranking.tu.sin'));
  await expect(myRankingRow(page)).not.toHaveAttribute('data-puntos', /.+/);
  expect(errors).toEqual([]);
});

test('`&acto=2` (atajo de desarrollo) juega el guion del acto 2 sin campaña: su boss final es el Kraken (T144)', async ({
  page,
}) => {
  const slot = finalSlot(2);
  const errors = await openMar(page, `?minijuego=canon&acto=2&seed=7&t=${slot.atS + 2}`);
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  await expect(game(page)).toHaveAttribute('data-acto', '2');
  await expect(game(page)).toHaveAttribute('data-jefes', new RegExp(slot.ref), { timeout: 20_000 });
  // Sin atajo, el acto 1.
  const again = await openMar(page, '?minijuego=canon&seed=7');
  await expect(game(page)).toHaveAttribute('data-acto', '1');
  expect([...errors, ...again]).toEqual([]);
});

/**
 * T132: el bucle entero de la beta 2 de un vistazo, sin esperar 7 minutos.
 * Lo demás del bucle ya tiene su prueba en este archivo: los seis enemigos
 * tarde (T126), las siete armas dibujadas (T128), una carta de cada clase
 * (T130), las dificultades en el panel (T131) y el turbo (T124).
 */
test('bucle de la beta 2: Tormenta, una evolución ofrecida, un arma nueva elegida y el turbo en marcha (T132)', async ({
  page,
}) => {
  const errors = await openMar(page, '?minijuego=canon&seed=3&carta=surtido&dificultad=tormenta');
  await expect(game(page)).toHaveAttribute('data-dificultad', 'tormenta');
  const cards = page.getByTestId('mar-canon-carta');
  await expect(cards).toHaveCount(6);
  // La ayuda dice cuántas cartas hay (no un «1–3» fijo).
  await expect(page.locator('.mar-canon-cards__help')).toHaveText(
    msg('mar.canon.cartas.ayuda', { n: 6 }),
  );
  // La evolución se ofrece (su condición se cumple con el atajo).
  await expect(page.locator('[data-testid="mar-canon-carta"][data-tipo="evolution"]')).toHaveCount(
    1,
  );
  // Se elige el arma nueva y entra en la fila de armas.
  const kinds = await cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-tipo')));
  const index = kinds.indexOf('weapon-new');
  expect(index).toBeGreaterThanOrEqual(0);
  const id = ((await cards.nth(index).getAttribute('data-carta')) ?? '').split(':')[1]!;
  expect(Object.keys(SURVIVORS_CONFIG.weapons)).toContain(id);
  const row = page.getByTestId('mar-canon-equipo').locator('[data-fila="armas"]');
  await expect(row.locator(`[data-id="${id}"]`)).toHaveCount(0);
  await page.waitForTimeout(500);
  await page.keyboard.press(String(index + 1));
  await page.keyboard.press('Enter');
  await expect(cards).toHaveCount(0);
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  await expect(row.locator(`[data-id="${id}"]`)).toHaveCount(1);
  // Los interactivos del mundo siguen en la partida: el turbo acelera.
  const turbo = page.getByTestId('mar-turbo');
  await turbo.click();
  await expect(turbo).toHaveClass(/is-on/);
  await expect
    .poll(async () => Number(await canvas(page).getAttribute('data-canon-turbo')), {
      timeout: 10_000,
    })
    .toBeGreaterThan(0);
  await expect
    .poll(async () => Number(await game(page).getAttribute('data-activo')), { timeout: 20_000 })
    .toBeGreaterThan(2);
  expect(errors).toEqual([]);
});

function percentile(values: readonly number[], p: number): number {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] ?? 0;
}

/** ms que se miden los fotogramas con los topes llenos. */
const PERF_MS = 8000;
/**
 * Tope holgado del percentil 95 del tiempo entre fotogramas (medido en T132:
 * 33 ms; con la CPU 4×, 50 ms): la máquina de pruebas va cargada, así que
 * esto sólo pilla que algo se dispare, no los 60 fps de un móvil de verdad
 * (las cifras van a la sección de T132 de ESTADO).
 */
const PERF_P95_MAX_MS = 100;

/** Una medida de fotogramas jugando (`label`), apuntada en la consola y en el informe. */
interface PerfReport {
  label: string;
  frames: number;
  p50: number;
  p95: number;
  worst: number;
  enemies: number;
  cap: number;
  armas: string;
  jefes: string;
  jefesVista: string;
  estado: string | null;
}

/**
 * Mide `PERF_MS` ms de fotogramas jugando: las cartas que se abran a media
 * medida se contestan con Intro. Apunta la medida (`[perf-canon]`).
 */
async function measureFrames(page: Page, info: TestInfo, label: string): Promise<PerfReport> {
  if ((await game(page).getAttribute('data-estado')) === 'card') await page.keyboard.press('Enter');
  const enemies = Number(await game(page).getAttribute('data-enemigos'));
  const frames = await page.evaluate(async (ms) => {
    const deltas: number[] = [];
    await new Promise<void>((done) => {
      let t0 = 0;
      let last = 0;
      const state = document.querySelector<HTMLElement>('[data-testid="mar-canon"]');
      const step = (now: number) => {
        if (!t0) t0 = last = now;
        else {
          deltas.push(now - last);
          last = now;
        }
        // Una carta que se abre a media medida se contesta (Intro), para medir jugando.
        if (state?.dataset.estado === 'card') {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        }
        if (now - t0 < ms) requestAnimationFrame(step);
        else done();
      };
      requestAnimationFrame(step);
    });
    return deltas;
  }, PERF_MS);
  const report: PerfReport = {
    label,
    frames: frames.length,
    p50: +percentile(frames, 50).toFixed(1),
    p95: +percentile(frames, 95).toFixed(1),
    worst: +Math.max(...frames).toFixed(1),
    enemies,
    cap: SURVIVORS_CONFIG.caps.baja.enemies,
    armas: (await canvas(page).getAttribute('data-canon-armas')) ?? '',
    jefes: (await game(page).getAttribute('data-jefes')) ?? '',
    jefesVista: (await canvas(page).getAttribute('data-canon-boss-vista')) ?? '',
    estado: await game(page).getAttribute('data-estado'),
  };
  console.log(`[perf-canon] ${JSON.stringify(report)}`);
  info.annotations.push({ type: 'perf', description: JSON.stringify(report) });
  expect(frames.length, label).toBeGreaterThan(10);
  return report;
}

/** Calidad `baja` forzada: un teléfono con 2 GB. */
async function forceLowQuality(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, get: () => 2 });
  });
}

/** Contesta las cartas con Intro hasta tener el mar casi lleno (80 % del tope de `baja`). */
async function fillSea(page: Page): Promise<void> {
  const cap = SURVIVORS_CONFIG.caps.baja.enemies;
  await expect
    .poll(
      async () => {
        if ((await game(page).getAttribute('data-estado')) === 'card')
          await page.keyboard.press('Enter');
        return Number(await game(page).getAttribute('data-enemigos'));
      },
      { timeout: 60_000, intervals: [300] },
    )
    .toBeGreaterThanOrEqual(cap * 0.8);
}

test('rendimiento en `baja`: a las 6:00 con los topes llenos y las siete armas, el tiempo por fotograma se mide y no se dispara (T132)', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile', 'se mide una vez, en el teléfono');
  await forceLowQuality(page);
  const errors = await openMar(page, '?minijuego=canon&t=360&armas=1&seed=7');
  await expect(game(page)).toHaveAttribute('data-estado', /running|card/);
  await expect(game(page)).toHaveAttribute('data-calidad', 'baja');
  await fillSea(page);
  const free = await measureFrames(page, info, 'sin limitar la CPU');
  expect(free.p95, 'percentil 95 del tiempo por fotograma (ms)').toBeLessThanOrEqual(
    PERF_P95_MAX_MS,
  );
  // Lo mismo con la CPU 4× más lenta (como en landing-perf): sólo se apunta.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await measureFrames(page, info, 'CPU 4×');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  expect(errors).toEqual([]);
});

/**
 * La mascota minikraken en cubierta (T154): `?mascota=1` la da (como al
 * vencer al Kraken) y se equipa en Mi Barco; se queda puesta en las visitas
 * siguientes del mismo navegador.
 */
async function equipMascot(page: Page): Promise<void> {
  await openMar(page, '?mascota=1');
  await page.getByTestId('mar-logros').click();
  await page.getByTestId('mar-barco').click();
  const shop = page.getByTestId('mar-tienda').getByTestId('barco');
  const option = shop.getByTestId('barco-mascota-mascota-minikraken');
  await expect(option).not.toHaveAttribute('data-bloqueado', 'si');
  await option.click();
  await expect(option).toHaveAttribute('aria-checked', 'true');
  await expect(canvas(page)).toHaveAttribute('data-mascota', 'minikraken');
}

/**
 * T147: lo mismo con cada boss final en la partida (el Barco Fantasma del
 * acto 1 y el Kraken del acto 2), las siete armas y el mar lleno, en `baja`.
 * En Tormenta para que el boss aguante toda la medida con las armas al máximo.
 * T156: además con el sonido sonando (bucle de boss) y la mascota en cubierta.
 */
for (const act of [1, 2] as const) {
  test(`rendimiento en \`baja\` con el boss final del acto ${act} en pantalla, los topes llenos, las siete armas, el sonido y la mascota (T147, T156)`, async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'mobile', 'se mide una vez, en el teléfono');
    const boss = finalSlot(act).ref;
    await forceLowQuality(page);
    await equipMascot(page);
    const errors = await openMar(
      page,
      `?minijuego=canon&acto=${act}&t=${finalSlot(act).atS + 2}&armas=1&dificultad=tormenta&seed=7`,
    );
    await expect(game(page)).toHaveAttribute('data-estado', /running|card/);
    await expect(game(page)).toHaveAttribute('data-calidad', 'baja');
    await expect(canvas(page)).toHaveAttribute('data-mascota', 'minikraken');
    await expect(game(page)).toHaveAttribute('data-jefes', new RegExp(boss), { timeout: 20_000 });
    // El primer gesto (una tecla) enciende el sonido; con el boss, su bucle.
    await expect(game(page)).toHaveAttribute('data-sonido', /bloqueado|activo/, { timeout: 15_000 });
    await page.keyboard.press('ArrowLeft');
    await expect(game(page)).toHaveAttribute('data-sonido', 'activo');
    await expect(game(page)).toHaveAttribute('data-musica', 'jefe', { timeout: 10_000 });
    await fillSea(page);
    // El boss entra en la vista (el Kraken, también su sombra bajo el agua).
    await expect
      .poll(async () => (await canvas(page).getAttribute('data-canon-boss-vista')) ?? '', {
        timeout: 30_000,
      })
      .toContain(boss);
    const free = await measureFrames(page, info, `${boss}, sin limitar la CPU`);
    expect(free.jefes, 'el boss sigue en la partida durante la medida').toContain(boss);
    expect(free.p95, 'percentil 95 del tiempo por fotograma (ms)').toBeLessThanOrEqual(
      PERF_P95_MAX_MS,
    );
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await measureFrames(page, info, `${boss}, CPU 4×`);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    expect(errors).toEqual([]);
  });
}

test('`botin=1`: los tres objetos del botín flotan junto al barco y se cogen tocándolos; la Llama avisa en el HUD (T135)', async ({
  page,
}) => {
  const errors = await openMar(page, '?minijuego=canon&botin=1&seed=7');
  await expect(game(page)).toHaveAttribute('data-estado', 'running');
  expect(new URL(page.url()).searchParams.has('botin')).toBe(false);
  await expect(game(page)).toHaveAttribute('data-botin-agua', '3');
  await expect(game(page)).toHaveAttribute('data-botin', '0');
  // Se gobierna con las flechas hacia el objeto más cercano hasta cogerlos todos.
  const held = new Set<string>();
  const hold = async (keys: string[]) => {
    for (const k of [...held]) {
      if (keys.includes(k)) continue;
      await page.keyboard.up(k);
      held.delete(k);
    }
    for (const k of keys) {
      if (held.has(k)) continue;
      await page.keyboard.down(k);
      held.add(k);
    }
  };
  let flameSeen = false;
  try {
    const until = Date.now() + 60_000;
    while (Date.now() < until) {
      if ((await game(page).getAttribute('data-estado')) === 'card') {
        await hold([]);
        await page.keyboard.press('Enter');
      }
      if ((await page.getByTestId('mar-canon-llama').count()) > 0) flameSeen = true;
      if (Number(await game(page).getAttribute('data-botin')) >= 3) break;
      const target = await game(page).getAttribute('data-botin-cerca');
      if (!target) break;
      const t = pointOf(target);
      const s = pointOf(await game(page).getAttribute('data-barco'));
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const d = Math.hypot(dx, dy) || 1;
      const keys: string[] = [];
      if (dx / d > 0.35) keys.push('ArrowRight');
      if (dx / d < -0.35) keys.push('ArrowLeft');
      if (dy / d > 0.35) keys.push('ArrowDown');
      if (dy / d < -0.35) keys.push('ArrowUp');
      await hold(keys);
      await page.waitForTimeout(100);
    }
  } finally {
    await hold([]);
  }
  expect(Number(await game(page).getAttribute('data-botin'))).toBeGreaterThanOrEqual(1);
  // La Llama (10 s): su aviso con los segundos que quedan, mientras dura.
  if (!flameSeen && Number(await game(page).getAttribute('data-llama')) > 0) {
    await expect(page.getByTestId('mar-canon-llama')).toBeVisible();
    flameSeen = true;
  }
  if (Number(await game(page).getAttribute('data-botin')) >= 3) expect(flameSeen).toBe(true);
  expect(errors).toEqual([]);
});

test('a las 4:30 (`t=270`) entra el Tiburón Martillo; vencido, su cofre abre una carta de cofre (T139)', async ({
  page,
}) => {
  // Las siete armas al máximo (`armas=1`): el tiburón cae en un rato. T147: en
  // Normal (en Tranquila, con el móvil cargado, a veces caía antes de entrar en
  // la vista) y a las 4:30 justas, con el tiburón como último hueco pasado (con
  // `t=` antes del 4:30 entraba también el Vecino y su cofre se confundía con
  // el del tiburón).
  const slot = SURVIVORS_CONFIG.acts[0]!.events.find((e) => e.ref === 'martillo')!;
  const errors = await openMar(
    page,
    `?minijuego=canon&t=${slot.atS}&armas=1&dificultad=normal&seed=7`,
  );
  await expect(game(page)).toHaveAttribute('data-estado', /running|card/);
  await expect(game(page)).toHaveAttribute('data-jefes', /martillo/, { timeout: 20_000 });
  expect((await game(page).getAttribute('data-jefes')) ?? '').not.toContain('vecino');
  const held = new Set<string>();
  const hold = async (keys: string[]) => {
    for (const k of [...held]) {
      if (keys.includes(k)) continue;
      await page.keyboard.up(k);
      held.delete(k);
    }
    for (const k of keys) {
      if (held.has(k)) continue;
      await page.keyboard.down(k);
      held.add(k);
    }
  };
  // `data-canon-jefes-vistos` junta lo que estuvo en pantalla en toda la partida.
  let sharkSeen = false;
  const lookForShark = async () => {
    const vistos = (await canvas(page).getAttribute('data-canon-jefes-vistos')) ?? '';
    if (vistos.split(' ').includes('martillo')) sharkSeen = true;
  };
  let chestCard = false;
  try {
    const until = Date.now() + 180_000;
    while (Date.now() < until && !chestCard) {
      await lookForShark();
      if ((await game(page).getAttribute('data-estado')) === 'card') {
        await hold([]);
        const cards = page.getByTestId('mar-canon-cartas');
        // La carta puede acabar de cerrarse (el estado va un paso por detrás): sin esperar.
        const origin =
          (await cards.count()) > 0
            ? await cards.getAttribute('data-origen', { timeout: 1000 }).catch(() => null)
            : null;
        if (origin === null) {
          await page.waitForTimeout(100);
          continue;
        }
        if (origin === 'cofre') {
          // La carta del cofre: una sola, gratis, con su cabecera propia.
          const card = page.getByTestId('mar-canon-carta');
          await expect(card).toHaveCount(1);
          await expect(card).toHaveClass(/is-chest/);
          await expect(cards.locator('h2')).toHaveText(msg('mar.canon.cofre.titulo'));
          await expect(card.locator('.mar-canon-card__name')).not.toBeEmpty();
          await expect(card.locator('.mar-canon-card__effect')).not.toContainText(/[{}]/);
          const level = await game(page).getAttribute('data-nivel');
          await page.waitForTimeout(500);
          await page.keyboard.press('Enter');
          // Se cierra (si quedaba una carta de nivel pendiente, se abre ahora esa).
          await expect(
            page.locator('[data-testid="mar-canon-cartas"][data-origen="cofre"]'),
          ).toHaveCount(0);
          // Gratis: no gasta nivel.
          expect(await game(page).getAttribute('data-nivel')).toBe(level);
          // Es el cofre del tiburón: el único miniboss de esta partida, ya vencido.
          expect((await game(page).getAttribute('data-vencidos')) ?? '').toContain('martillo');
          chestCard = true;
          break;
        }
        await page.waitForTimeout(400);
        await page.keyboard.press('Enter');
        continue;
      }
      const target = await game(page).getAttribute('data-cofre-cerca');
      if (!target) {
        // Mientras pelea: a vueltas suaves, sin alejarse.
        await hold(Math.floor(Date.now() / 2500) % 2 ? ['ArrowRight'] : ['ArrowLeft']);
        await page.waitForTimeout(150);
        continue;
      }
      const t = pointOf(target);
      const s = pointOf(await game(page).getAttribute('data-barco'));
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const d = Math.hypot(dx, dy) || 1;
      const keys: string[] = [];
      if (dx / d > 0.35) keys.push('ArrowRight');
      if (dx / d < -0.35) keys.push('ArrowLeft');
      if (dy / d > 0.35) keys.push('ArrowDown');
      if (dy / d < -0.35) keys.push('ArrowUp');
      await hold(keys);
      await page.waitForTimeout(100);
    }
  } finally {
    await hold([]);
  }
  await lookForShark();
  expect(sharkSeen).toBe(true);
  expect(chestCard).toBe(true);
  expect(errors).toEqual([]);
});

test('boss HUD: barra arriba con nombre y aviso de llegada, sin pisar el resto del HUD (T143)', async ({
  page,
}) => {
  const slot = SURVIVORS_CONFIG.acts[0]!.events.find((e) => e.ref === 'vecino')!;
  const errors = await openMar(page, `?minijuego=canon&t=${slot.atS - 6}&seed=7`);
  await expect(game(page)).toHaveAttribute('data-estado', /running|card/);
  await expect(page.getByTestId('mar-canon-jefe')).toHaveCount(0);
  // Navegando (un barco parado se inunda) hasta que llegue el Vecino: el aviso dura unos segundos,
  // así que todo se mide en una sola lectura.
  await page.keyboard.down('ArrowRight');
  const ids = [
    'mar-canon-hud',
    'mar-canon-jefe',
    'mar-canon-jefe-aviso',
    'mar-canon-pausa',
    'mar-canon-tiempo',
    'mar-entradas',
    'mar-enlaces',
    'mar-minimapa',
    'mar-saldos',
    'mar-turbo',
    'mar-canon-equipo',
    'mar-touch',
  ];
  type Seen = { boxes: Record<string, Box>; name: string; text: string; kind: string };
  let seen: Seen | null = null;
  await expect
    .poll(
      async () => {
        if ((await game(page).getAttribute('data-estado')) === 'card')
          await page.keyboard.press('Enter');
        seen = await page.evaluate((list) => {
          const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
          const banner = q('mar-canon-jefe-aviso');
          const bar = q('mar-canon-jefe');
          if (!banner || !bar) return null;
          const boxes: Record<string, { x: number; y: number; width: number; height: number }> = {};
          for (const id of list) {
            const el = q(id);
            if (!el) continue;
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0)
              boxes[id] = { x: r.x, y: r.y, width: r.width, height: r.height };
          }
          return {
            boxes,
            name: q('mar-canon-jefe-nombre')?.textContent ?? '',
            text: banner.textContent ?? '',
            kind: banner.getAttribute('data-aviso') ?? '',
          };
        }, ids);
        return seen !== null;
      },
      { timeout: 60_000, intervals: [150] },
    )
    .toBe(true);
  await page.keyboard.up('ArrowRight');
  const s = seen as unknown as Seen;
  expect(s.kind).toBe('arrival');
  expect(s.name).toBe(msg('survivors.boss.vecino'));
  expect(s.text).toBe(msg('mar.canon.boss.llega', { nombre: msg('survivors.boss.vecino') }));
  const vp = page.viewportSize()!;
  const { boxes } = s;
  const inScreen = (b: Box) =>
    b.x >= 0 && b.y >= 0 && b.x + b.width <= vp.width + 0.5 && b.y + b.height <= vp.height + 0.5;
  const hud = boxes['mar-canon-hud']!;
  const bar = boxes['mar-canon-jefe']!;
  const banner = boxes['mar-canon-jefe-aviso']!;
  expect(inScreen(bar)).toBe(true);
  expect(inScreen(banner)).toBe(true);
  // La barra va dentro del HUD de arriba, en la banda alta.
  expect(bar.y + bar.height).toBeLessThan(vp.height * 0.35);
  expect(bar.x).toBeGreaterThanOrEqual(hud.x - 0.5);
  expect(bar.x + bar.width).toBeLessThanOrEqual(hud.x + hud.width + 0.5);
  expect(overlaps(banner, hud)).toBe(false);
  // No tapa la cuenta atrás ni la pausa, y ni la barra ni el aviso pisan lo fijo ni los mandos.
  for (const id of ['mar-canon-pausa', 'mar-canon-tiempo'])
    expect(overlaps(bar, boxes[id]!), id).toBe(false);
  for (const id of [
    'mar-entradas',
    'mar-enlaces',
    'mar-minimapa',
    'mar-saldos',
    'mar-turbo',
    'mar-canon-equipo',
    'mar-touch',
  ]) {
    const b = boxes[id];
    if (!b) continue;
    expect(overlaps(hud, b), id).toBe(false);
    expect(overlaps(banner, b), id).toBe(false);
  }
  expect(errors).toEqual([]);
});

// --- T152: sonido y accesibilidad ---------------------------------------------------

/** Pulsa Tab hasta que el foco llegue a `testId` (o falla tras `max` pulsaciones). */
async function tabTo(page: Page, testId: string, max = 40): Promise<void> {
  for (let i = 0; i < max; i++) {
    const at = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? '');
    if (at === testId) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`el foco no llega a ${testId}`);
}

/** La pausa con Esc (también con una carta abierta, que espera debajo del menú). */
async function pauseWithEsc(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('mar-menu')).toBeVisible();
}

/** «Terminar partida» desde la pausa (T148), para acabar rápido. */
async function quitFromPause(page: Page): Promise<void> {
  await pauseWithEsc(page);
  await page.getByTestId('mar-menu-terminar').click();
  await page.getByTestId('mar-menu-terminar-si').click();
  await expect(game(page)).toHaveAttribute('data-fin', 'quit');
}

test('sonido: callado hasta el primer gesto; bucle de batalla, de boss al llegar el Vecino y el mar al acabar; volumen y silencio en la pausa, recordados (T152)', async ({
  page,
}) => {
  const slot = SURVIVORS_CONFIG.acts[0]!.events.find((e) => e.ref === 'vecino')!;
  const errors = await openMar(page, `?minijuego=canon&t=${slot.atS - 6}&seed=7`);
  await expect(game(page)).toHaveAttribute('data-estado', /running|card/);
  // Empezada por el atajo, sin tocar nada: el módulo carga, pero nada suena aún.
  await expect(game(page)).toHaveAttribute('data-sonido', 'bloqueado', { timeout: 15_000 });
  await expect(game(page)).toHaveAttribute('data-musica', 'batalla');
  // El primer gesto (una tecla) lo desbloquea.
  await page.keyboard.press('ArrowLeft');
  await expect(game(page)).toHaveAttribute('data-sonido', 'activo');
  await expect(game(page)).toHaveAttribute('data-musica', 'batalla');
  // Llega el Vecino: entra el bucle de boss.
  await expect
    .poll(
      async () => {
        await answerCard(page);
        return (await game(page).getAttribute('data-jefes')) ?? '';
      },
      { timeout: 60_000, intervals: [400] },
    )
    .toMatch(/vecino/);
  await expect(game(page)).toHaveAttribute('data-musica', 'jefe');

  // En la pausa: el sonido del juego y su volumen, con áreas de 44 px.
  await pauseWithEsc(page);
  const menu = page.getByTestId('mar-menu');
  const sound = menu.getByRole('switch', { name: msg('mar.canon.sonido.juego') });
  const volume = menu.getByRole('slider', { name: msg('mar.canon.sonido.volumen.aria') });
  await expect(sound).toHaveAttribute('aria-checked', 'true');
  await expect(volume).toHaveValue('70');
  for (const el of [sound, volume]) {
    expect((await el.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await volume.fill('40');
  await sound.click();
  await expect(sound).toHaveAttribute('aria-checked', 'false');
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('boia.canon.sonido.v1') ?? 'null')),
  ).toEqual({ volume: 0.4, muted: true });
  await page.getByTestId('mar-menu-seguir').click();

  // Al acabar, el bucle se funde y vuelve el mar.
  await quitFromPause(page);
  await expect(game(page)).toHaveAttribute('data-musica', 'mar');

  // Otra visita: lo elegido sigue.
  errors.push(...(await openMar(page, '?minijuego=canon&seed=7')));
  await page.getByTestId('mar-canon-pausa').click();
  await expect(sound).toHaveAttribute('aria-checked', 'false');
  await expect(volume).toHaveValue('40');
  await sound.click();
  await expect(sound).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('mar-menu-seguir').click();
  expect(errors).toEqual([]);
});

test('teclado: sólo con el teclado se abre el pop-up, se elige, se juega, se pausa y se silencia (T152)', async ({
  page,
}) => {
  const errors = await openMar(page, '?minijuego=canon&oferta=1');
  await expect(panel(page)).toBeVisible({ timeout: 15_000 });
  // «Jugar» del panel con el teclado.
  await panel(page).getByRole('button', { name: msg('juego.minigameLayer.jugar') }).focus();
  await page.keyboard.press('Enter');
  const box = previa(page);
  await expect(box).toBeVisible();
  await expect(box.getByTestId('mar-canon-acto-1')).toBeFocused();
  // La dificultad con las flechas y «Jugar» con Intro.
  await tabTo(page, 'mar-canon-dificultad-normal');
  await page.keyboard.press('ArrowRight');
  await expect(box).toHaveAttribute('data-dificultad', 'tormenta');
  await tabTo(page, 'mar-canon-previa-jugar');
  await page.keyboard.press('Enter');
  await expect(box).toHaveCount(0);
  await expect(game(page)).toHaveAttribute('data-estado', 'running', { timeout: 20_000 });
  await expect(game(page)).toHaveAttribute('data-dificultad', 'tormenta');
  // El teclado ya fue un gesto: el sonido suena.
  await expect(game(page)).toHaveAttribute('data-sonido', 'activo', { timeout: 15_000 });
  // El barco navega con las flechas.
  const from = pointOf(await game(page).getAttribute('data-barco'));
  await page.keyboard.down('ArrowUp');
  await expect
    .poll(
      async () => {
        await answerCard(page);
        return dist(pointOf(await game(page).getAttribute('data-barco')), from);
      },
      { timeout: 20_000 },
    )
    .toBeGreaterThan(20);
  await page.keyboard.up('ArrowUp');
  // Esc pausa; Tab llega al sonido del juego y Espacio lo apaga; Esc sigue.
  await answerCard(page);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('mar-menu')).toBeVisible();
  await expect(game(page)).toHaveAttribute('data-estado', 'paused');
  await tabTo(page, 'mar-canon-sonido');
  await page.keyboard.press('Space');
  await expect(page.getByTestId('mar-canon-sonido')).toHaveAttribute('aria-checked', 'false');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('mar-menu')).toHaveCount(0);
  await expect(game(page)).toHaveAttribute('data-estado', /running|card/);
  expect(errors).toEqual([]);
});

test('accesibilidad: avisos aria-live de nivel, boss y resultado; sin temblor de cámara con movimiento reducido; pausa y cartas de 44 px (T152)', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const slot = SURVIVORS_CONFIG.acts[0]!.events.find((e) => e.ref === 'vecino')!;
  const errors = await openMar(page, `?minijuego=canon&t=${slot.atS - 6}&seed=7&carta=1`);
  const say = page.getByTestId('mar-canon-anuncio');
  await expect(say).toHaveAttribute('aria-live', 'polite');
  // Subir de nivel: la carta y su aviso.
  const cards = page.getByTestId('mar-canon-cartas');
  await expect(cards).toBeVisible({ timeout: 15_000 });
  const level = Number(await cards.getAttribute('data-nivel'));
  await expect(say).toHaveText(msg('mar.canon.anuncio.nivel', { nivel: level }));
  for (const card of await page.getByTestId('mar-canon-carta').all()) {
    const b = (await card.boundingBox())!;
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(b.width).toBeGreaterThanOrEqual(44);
  }
  await page.waitForTimeout(600);
  await page.keyboard.press('Enter');
  await expect(cards).toHaveCount(0);
  // La pausa se ve pequeña pero se toca en 44 px: a 20 px del centro sigue siendo ella.
  const pause = page.getByTestId('mar-canon-pausa');
  const p = (await pause.boundingBox())!;
  const cx = p.x + p.width / 2;
  const cy = p.y + p.height / 2;
  const around = [
    [cx - 20, cy],
    [cx + 20, cy],
    [cx, cy - 20],
    [cx, cy + 20],
  ];
  // Sin carta encima (una nueva puede abrirse en cualquier momento y tapa la pantalla).
  await expect
    .poll(
      async () => {
        await answerCard(page);
        return page.evaluate((points) => {
          if (document.querySelector('[data-testid="mar-canon-cartas"]')) return null;
          return points.map(
            ([x, y]) =>
              document.elementFromPoint(x!, y!)?.closest('[data-testid]')?.getAttribute('data-testid') ??
              '',
          );
        }, around);
      },
      { timeout: 20_000 },
    )
    .toEqual(around.map(() => 'mar-canon-pausa'));
  // Llega el Vecino: su aviso. Mientras, sin esquivar, al barco le entra agua.
  await expect
    .poll(
      async () => {
        await answerCard(page);
        return (await say.textContent()) ?? '';
      },
      { timeout: 60_000, intervals: [400] },
    )
    .toBe(msg('mar.canon.boss.llega', { nombre: msg('survivors.boss.vecino') }));
  await expect
    .poll(
      async () => {
        await answerCard(page);
        return Number(await game(page).getAttribute('data-agua'));
      },
      { timeout: 60_000, intervals: [400] },
    )
    .toBeGreaterThan(0);
  // Con movimiento reducido la cámara no tiembla con los golpes.
  await expect(canvas(page)).not.toHaveAttribute('data-temblor', /.+/);
  // El resultado también se anuncia.
  await quitFromPause(page);
  const title = page.getByTestId('mar-canon-final').getByRole('heading');
  await expect(say).toHaveText((await title.textContent())!);
  expect(errors).toEqual([]);
});

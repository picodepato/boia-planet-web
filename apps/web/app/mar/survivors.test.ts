import { SURVIVORS_CONFIG } from '@boia/engine/survivors';
import { WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { es } from '../../lib/i18n/es';
import { marWorld } from './engine/compact';
import { MAR_SHIP_CONFIG } from './engine/steering';
import { SurvivorsView } from './engine/survivors-view';
import { planetRect } from './engine/wrap';
import {
  CANON_GAME_ID,
  type DevEnv,
  type EngineHideTarget,
  HIDE_LAYERS,
  type HideLayer,
  LAYER_KINDS,
  SurvivorsRun,
  canonBlockKey,
  canonShortcut,
  devShortcutsEnabled,
  hiddenDuringGame,
  hideForGame,
  islandPinsOnly,
  marHideHost,
  survivorsSea,
  withoutCanonShortcut,
} from './survivors';

/**
 * El Cañón dentro de /mar (plan 009, T99): el interruptor de los atajos de
 * desarrollo, lo que se esconde durante la partida (y que vuelve igual), el
 * mar de la partida, el bloqueo en carrera y la partida con su reloj.
 */

const world = marWorld(WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config);
const period = planetRect(world.bounds);
const spawn = world.spawn ?? { x: 0, y: 0, heading: 0 };

const env = (over: Partial<DevEnv>): DevEnv => ({
  nodeEnv: 'production',
  webdriver: false,
  search: '',
  ...over,
});

describe('atajos de desarrollo: un solo interruptor', () => {
  it('en `pnpm dev` siempre', () => {
    expect(devShortcutsEnabled(env({ nodeEnv: 'development' }))).toBe(true);
  });

  it('en el servidor de las e2e (el navegador lo maneja Playwright) siempre', () => {
    expect(devShortcutsEnabled(env({ webdriver: true }))).toBe(true);
  });

  it('en producción sólo con ?dev=1', () => {
    expect(devShortcutsEnabled(env({ search: '?dev=1' }))).toBe(true);
    expect(devShortcutsEnabled(env({ search: '?minijuego=canon&dev=1' }))).toBe(true);
    expect(devShortcutsEnabled(env({}))).toBe(false);
    expect(devShortcutsEnabled(env({ search: '?dev=0' }))).toBe(false);
    expect(devShortcutsEnabled(env({ search: '?minijuego=canon' }))).toBe(false);
  });

  it('`?minijuego=canon&t=&seed=` pide empezar en ese segundo con esa semilla', () => {
    const dev = env({ nodeEnv: 'development' });
    expect(canonShortcut('?minijuego=canon&t=120&seed=7', dev)).toEqual({
      t: 120,
      seed: 7,
      offer: false,
    });
    expect(canonShortcut('?minijuego=canon', dev)).toEqual({ t: 0, seed: null, offer: false });
    expect(canonShortcut('?minijuego=canon&oferta=1', dev)?.offer).toBe(true);
    // `t` dentro de la partida; basura, desde el principio.
    expect(canonShortcut('?minijuego=canon&t=99999', dev)?.t).toBe(SURVIVORS_CONFIG.durationS - 1);
    expect(canonShortcut('?minijuego=canon&t=abc&seed=-3', dev)).toEqual({
      t: 0,
      seed: null,
      offer: false,
    });
    expect(canonShortcut('?minijuego=faro', dev)).toBeNull();
  });

  it('en producción sin ?dev=1 el atajo no hace nada; con él, sí', () => {
    expect(canonShortcut('?minijuego=canon&t=60', env({}))).toBeNull();
    expect(canonShortcut('?minijuego=canon&t=60&dev=1', env({}))?.t).toBe(60);
    expect(canonShortcut('?minijuego=canon&t=60', env({ webdriver: true }))?.t).toBe(60);
  });

  it('al usarlo se quita de la URL; `dev` y lo demás se quedan', () => {
    const out = new URL(
      withoutCanonShortcut(
        'https://x.test/mar?minijuego=canon&t=5&seed=2&oferta=1&dev=1&cerca=faro',
      ),
    );
    expect([...out.searchParams.keys()].sort()).toEqual(['cerca', 'dev']);
  });
});

/** Un `Mar3D` de mentira: las marcas de la ruta y las vistas escondidas por capa. */
function fakeEngine(route = false) {
  const kinds = new Map<string, readonly string[]>();
  let routeHidden = route;
  const engine: EngineHideTarget = {
    get routeHidden() {
      return routeHidden;
    },
    setRouteHidden: (h) => {
      routeHidden = h;
    },
    isKindsHidden: (l) => kinds.has(l),
    setKindsHidden: (l, k) => {
      if (k) kinds.set(l, k);
      else kinds.delete(l);
    },
  };
  let ui: ReadonlySet<HideLayer> = new Set();
  const host = marHideHost(engine, { get: () => ui, set: (n) => (ui = n) });
  const state = () => ({
    route: routeHidden,
    kinds: [...kinds.entries()].sort(([a], [b]) => a.localeCompare(b)),
    ui: [...ui].sort(),
  });
  return { host, state, hiddenKinds: () => new Set([...kinds.values()].flat()) };
}

describe('lo que se esconde durante la partida', () => {
  it('esconde todas las capas: ruta, fichas, botellas, descuentos, encuentros y minimapa', () => {
    expect([...HIDE_LAYERS].sort()).toEqual(
      ['bottles', 'discounts', 'encounters', 'minimap', 'route', 'sheets'].sort(),
    );
    const f = fakeEngine();
    hideForGame(f.host);
    for (const l of HIDE_LAYERS) expect(f.host.isHidden(l), l).toBe(true);
    expect(f.state().route).toBe(true);
    // En el 3D: las botellas, los descuentos escondidos y los encuentros.
    for (const k of ['botella', 'secreto', 'cofre', 'restos', 'encuentro', 'cocodrilo', 'delfin']) {
      expect(f.hiddenKinds().has(k), k).toBe(true);
    }
  });

  it('todo lo escondido al empezar vuelve al acabar, igual que estaba', () => {
    const f = fakeEngine();
    const before = f.state();
    const restore = hideForGame(f.host);
    expect(f.state()).not.toEqual(before);
    restore();
    expect(f.state()).toEqual(before);
    for (const l of HIDE_LAYERS) expect(f.host.isHidden(l), l).toBe(false);
    // Una segunda vez no hace nada.
    restore();
    expect(f.state()).toEqual(before);
  });

  it('lo que ya estaba escondido sigue escondido al acabar', () => {
    const f = fakeEngine(true);
    const restore = hideForGame(f.host);
    restore();
    expect(f.state().route).toBe(true);
  });

  it('cada cosa que la partida aparta del mundo tiene su vista escondida en el 3D', () => {
    const kinds = new Set(Object.values(LAYER_KINDS).flat());
    const hidden = world.objects.filter(hiddenDuringGame);
    expect(hidden.length).toBeGreaterThan(0);
    for (const o of hidden) {
      const kind = o.identity.category === 'obstaculo' ? 'medusa' : o.identity.category;
      expect(kinds.has(kind), o.identity.id).toBe(true);
    }
    // Las islas siguen.
    expect(world.objects.filter((o) => o.identity.category === 'isla').some(hiddenDuringGame)).toBe(
      false,
    );
  });

  it('los rótulos durante la partida son sólo los de las islas', () => {
    const pins = world.objects.map((o) => ({ id: o.identity.id }));
    const shown = islandPinsOnly(world, pins);
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.map((p) => p.id)).toContain(CANON_GAME_ID);
    expect(shown.map((p) => p.id)).not.toContain('fiestera');
  });
});

describe('el mar de la partida', () => {
  it('es el planeta de /mar, con sus islas y sin lo escondido (un cocodrilo no es una pared invisible)', () => {
    const sea = survivorsSea(world, period, { x: spawn.x, y: spawn.y });
    expect(sea.bounds).toEqual(period);
    const at = (id: string) => world.objects.find((o) => o.identity.id === id)!.position;
    const has = (p: { x: number; y: number }) =>
      sea.obstacles.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 1e-6);
    expect(has(at('canon'))).toBe(true);
    expect(has(at('allday'))).toBe(true);
    expect(has(at('fiestera-cocodrilo_1'))).toBe(false);
    expect(has(at('circuito-medusa'))).toBe(false);
  });

  it('suma el decorado sólido propio de /mar', () => {
    const extra = [{ x: 12345, y: 0, radius: 9 }];
    const sea = survivorsSea(world, period, { x: 0, y: 0 }, extra);
    expect(sea.obstacles).toContainEqual(extra[0]);
  });
});

describe('bloqueo en carrera', () => {
  it('durante la carrera no se empieza y el panel lo explica con su clave', () => {
    const key = canonBlockKey({ raceActive: true });
    expect(key).not.toBeNull();
    expect(es[key!]).toBeTruthy();
    expect(canonBlockKey({ raceActive: false })).toBeNull();
  });

  it('las mejoras de la config tienen su texto en el catálogo', () => {
    for (const u of SURVIVORS_CONFIG.upgrades) {
      expect(es[u.i18nKey as keyof typeof es], u.i18nKey).toBeTruthy();
    }
    expect(es['mar.canon.title']).toBeTruthy();
    expect(es['mar.canon.summary']).toBeTruthy();
  });
});

describe('la partida en /mar', () => {
  const sea = () => survivorsSea(world, period, { x: spawn.x, y: spawn.y });

  it('el reloj del navegador da los pasos; la pestaña oculta es pausa', () => {
    const run = new SurvivorsRun(sea(), { seed: 3, quality: 'alta', ship: MAR_SHIP_CONFIG });
    expect(run.tick(1000, false)).toBe(0);
    expect(run.tick(1100, false)).toBe(6);
    for (let i = 0; i < 6; i++) run.step({ dirX: 0, dirY: -1, throttle: 1, drift: false });
    expect(run.hook().activo).toBeCloseTo(0.1, 6);
    expect(run.tick(61_100, true)).toBe(0);
    expect(run.snapshot().pauseTotalS).toBeCloseTo(60, 3);
    expect(run.hook().activo).toBeCloseTo(0.1, 6);
  });

  it('empieza donde está el barco, con la semilla, la calidad (su tope) y el segundo pedidos', () => {
    const run = new SurvivorsRun(sea(), {
      seed: 11,
      quality: 'baja',
      ship: MAR_SHIP_CONFIG,
      startAtS: 120,
    });
    const h = run.hook();
    expect(h.semilla).toBe(11);
    expect(h.calidad).toBe('baja');
    expect(h.tiempo).toBe(SURVIVORS_CONFIG.durationS - 120);
    expect(h.estado).toBe('running');
    expect(run.game.caps).toEqual(SURVIVORS_CONFIG.caps.baja);
    const [x, y] = h.barco.split(',').map(Number);
    expect(Math.hypot(x! - spawn.x, y! - spawn.y)).toBeLessThan(40);
  });

  it('elige sola la carta de nivel (hasta las cartas de T101) y avisa del final una vez', () => {
    const ends: string[] = [];
    const run = new SurvivorsRun(sea(), {
      seed: 5,
      quality: 'alta',
      ship: MAR_SHIP_CONFIG,
      startAtS: SURVIVORS_CONFIG.durationS - 3,
      onEnd: (reason) => ends.push(reason),
    });
    let cards = 0;
    for (let i = 0; i < 60 * 10 && !run.ended; i++) {
      if (run.snapshot().status === 'card') cards++;
      run.step({ dirX: 1, dirY: 0, throttle: 1, drift: false });
    }
    expect(run.ended).toBe(true);
    expect(ends).toHaveLength(1);
    expect(['survived', 'flooded']).toContain(ends[0]);
    expect(run.hook().fin).toBe(ends[0]);
    expect(run.hook().estado).toBe('ended');
    expect(cards).toBeLessThan(5);
    run.step({ dirX: 1, dirY: 0, throttle: 1, drift: false });
    expect(ends).toHaveLength(1);
  });

  it('una pausa de más de 5 min con la pestaña oculta abandona la partida', () => {
    const ends: string[] = [];
    const run = new SurvivorsRun(sea(), {
      seed: 2,
      quality: 'alta',
      ship: MAR_SHIP_CONFIG,
      onEnd: (reason) => ends.push(reason),
    });
    run.tick(0, false);
    run.tick(200_000, true);
    expect(ends).toEqual([]);
    run.tick(301_500, true);
    expect(ends).toEqual(['abandoned']);
  });
});

describe('las piezas provisionales de la partida', () => {
  it('una pieza por tipo con el tope de cada calidad', () => {
    for (const q of ['alta', 'baja'] as const) {
      const caps = SURVIVORS_CONFIG.caps[q];
      const view = new SurvivorsView(SURVIVORS_CONFIG, caps);
      const cap = view.capacity();
      for (const id of Object.keys(SURVIVORS_CONFIG.enemies))
        expect(cap[id], id).toBe(caps.enemies);
      expect(cap.projectiles).toBe(caps.projectiles);
      expect(cap.notes).toBe(caps.notes);
      view.dispose();
    }
  });

  it('pinta lo que hay en la partida', () => {
    const run = new SurvivorsRun(survivorsSea(world, period, { x: spawn.x, y: spawn.y }), {
      seed: 9,
      quality: 'alta',
      ship: MAR_SHIP_CONFIG,
      startAtS: 60,
    });
    const view = new SurvivorsView(run.config, run.game.caps);
    view.update(run.snapshot(), 0);
    const s = run.snapshot();
    const total = view.group.children.reduce(
      (n, m) => n + (m as unknown as { count: number }).count,
      0,
    );
    expect(total).toBe(s.enemies.length + s.projectiles.length + s.notes.length);
    view.dispose();
  });
});

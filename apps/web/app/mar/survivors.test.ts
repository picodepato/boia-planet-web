import {
  DEFAULT_SHIP_CONFIG,
  type ShipInput,
  createShipState,
  shipSpeed,
  stepShip,
} from '@boia/engine/headless';
import {
  NOTE_FIGURES,
  SURVIVORS_CONFIG,
  createSurvivors,
  survivorsShipConfig,
} from '@boia/engine/survivors';
import {
  LocalSessionAuthority,
  type MinigameRewardSink,
  WorldMinigameSession,
  canon,
  canonEnd,
} from '@boia/engine/minigames';
import { WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it, vi } from 'vitest';
import { es } from '../../lib/i18n/es';
import { withWinSignal } from '../../lib/mundo/minigame-layer';
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
  devStartRewards,
  hiddenDuringGame,
  hideForGame,
  isDevStart,
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
      defeatStyle: null,
      card: false,
    });
    expect(canonShortcut('?minijuego=canon', dev)).toEqual({
      t: 0,
      seed: null,
      offer: false,
      defeatStyle: null,
      card: false,
    });
    expect(canonShortcut('?minijuego=canon&oferta=1', dev)?.offer).toBe(true);
    expect(canonShortcut('?minijuego=canon&carta=1', dev)?.card).toBe(true);
    // `t` dentro de la partida; basura, desde el principio.
    expect(canonShortcut('?minijuego=canon&t=99999', dev)?.t).toBe(SURVIVORS_CONFIG.durationS - 1);
    expect(canonShortcut('?minijuego=canon&t=abc&seed=-3', dev)).toEqual({
      t: 0,
      seed: null,
      offer: false,
      defeatStyle: null,
      card: false,
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
        'https://x.test/mar?minijuego=canon&t=5&seed=2&oferta=1&derrota=puf&dev=1&cerca=faro',
      ),
    );
    expect([...out.searchParams.keys()].sort()).toEqual(['cerca', 'dev']);
  });
});

/** Un `Mar3D` de mentira: las marcas de la ruta, la fauna y las vistas escondidas por capa. */
function fakeEngine(route = false, wildlife = false) {
  const kinds = new Map<string, readonly string[]>();
  let routeHidden = route;
  let wildlifeHidden = wildlife;
  const engine: EngineHideTarget = {
    get routeHidden() {
      return routeHidden;
    },
    setRouteHidden: (h) => {
      routeHidden = h;
    },
    get wildlifeHidden() {
      return wildlifeHidden;
    },
    setWildlifeHidden: (h) => {
      wildlifeHidden = h;
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
    wildlife: wildlifeHidden,
    kinds: [...kinds.entries()].sort(([a], [b]) => a.localeCompare(b)),
    ui: [...ui].sort(),
  });
  return { host, state, hiddenKinds: () => new Set([...kinds.values()].flat()) };
}

describe('lo que se esconde durante la partida', () => {
  it('esconde todas las capas: ruta, fichas, botellas, descuentos, encuentros, minimapa, objetivo y fauna', () => {
    expect([...HIDE_LAYERS].sort()).toEqual(
      [
        'bottles',
        'discounts',
        'encounters',
        'minimap',
        'objective',
        'route',
        'sheets',
        'wildlife',
      ].sort(),
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
    const f = fakeEngine(true, true);
    const restore = hideForGame(f.host);
    restore();
    expect(f.state().route).toBe(true);
    expect(f.state().wildlife).toBe(true);
  });

  it('lo nuevo del mundo (T120): peces y gaviotas en el 3D, y el objetivo marcado, se van y vuelven', () => {
    const f = fakeEngine();
    const restore = hideForGame(f.host);
    // La fauna, en el motor (los peces se confundirían con enemigos).
    expect(f.state().wildlife).toBe(true);
    // El «!» de objetivos, su panel y el objetivo marcado (rótulo y marca del minimapa), en la interfaz.
    expect(f.state().ui).toContain('objective');
    restore();
    expect(f.state().wildlife).toBe(false);
    expect(f.state().ui).not.toContain('objective');
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

describe('la maniobrabilidad de la partida sobre el barco de /mar (T120)', () => {
  const h = SURVIVORS_CONFIG.handling;

  it('se aplica como factores sobre la config de ahora del barco, sin valores absolutos', () => {
    const s = survivorsShipConfig(MAR_SHIP_CONFIG, h);
    // La velocidad de crucero es la del barco de /mar (la de la fusión: la del motor).
    expect(MAR_SHIP_CONFIG.maxSpeed).toBe(DEFAULT_SHIP_CONFIG.maxSpeed);
    expect(s.maxSpeed).toBe(MAR_SHIP_CONFIG.maxSpeed);
    expect(s.acceleration).toBeCloseTo(MAR_SHIP_CONFIG.acceleration * h.accelerationScale, 9);
    expect(s.brakeDeceleration).toBeCloseTo(MAR_SHIP_CONFIG.brakeDeceleration * h.brakeScale, 9);
    expect(s.turnRate).toBeCloseTo(MAR_SHIP_CONFIG.turnRate * h.turnRateScale, 9);
    expect(s.lateralGrip).toBeCloseTo(MAR_SHIP_CONFIG.lateralGrip * h.lateralGripScale, 9);
    expect(s.turnRadius).toBeCloseTo(MAR_SHIP_CONFIG.turnRadius! / h.turnRateScale, 9);
    // Lo demás del barco de /mar se queda (radio, giro marcha atrás…).
    expect(s.radius).toBe(MAR_SHIP_CONFIG.radius);
    expect(s.reverseTurn).toEqual(MAR_SHIP_CONFIG.reverseTurn);
    // Más giro, menos inercia que fuera de la partida.
    expect(s.turnRate).toBeGreaterThan(MAR_SHIP_CONFIG.turnRate);
    expect(s.acceleration).toBeGreaterThan(MAR_SHIP_CONFIG.acceleration);
  });

  it('en la partida el barco llega a su crucero de /mar (no más) y antes que fuera', () => {
    const ahead: ShipInput = { dirX: 1, dirY: 0, throttle: 1, drift: false };
    const goal = MAR_SHIP_CONFIG.maxSpeed * 0.9;
    // Mar abierto: sin islas, para medir sólo el barco.
    const open = { bounds: period, obstacles: [], start: { x: 0, y: 0, heading: 0 } };
    const game = createSurvivors(SURVIVORS_CONFIG, 4, open, {
      quality: 'alta',
      ship: MAR_SHIP_CONFIG,
    });
    let top = 0;
    let inGame: number | null = null;
    for (let i = 0; i < 60 * 6 && !game.ended; i++) {
      game.step({ ship: ahead });
      const p = game.snapshot().player;
      const v = Math.hypot(p.vx, p.vy);
      top = Math.max(top, v);
      if (inGame === null && v >= goal) inGame = i + 1;
    }
    // El mismo mando con el barco de /mar fuera de la partida.
    const free = createShipState(0, 0, 0);
    let outside: number | null = null;
    for (let i = 0; i < 60 * 6 && outside === null; i++) {
      stepShip(free, ahead, MAR_SHIP_CONFIG, 1 / 60);
      if (shipSpeed(free) >= goal) outside = i + 1;
    }
    expect(top).toBeLessThanOrEqual(MAR_SHIP_CONFIG.maxSpeed + 1e-6);
    expect(inGame).not.toBeNull();
    expect(outside).not.toBeNull();
    expect(inGame!).toBeLessThan(outside!);
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
    // El título del registro ya no es el del cañón 2D: el mismo que el panel (T121).
    expect(es['minigame.canon.title']).toBe(es['mar.canon.title']);
  });
});

describe('partidas de prueba: sin premio en producción (T121)', () => {
  it('un atajo que cambia la partida la hace de prueba; el estilo de derrota, no', () => {
    expect(isDevStart({ t: 419 })).toBe(true);
    expect(isDevStart({ seed: 7 })).toBe(true);
    expect(isDevStart({ card: true })).toBe(true);
    expect(isDevStart({})).toBe(false);
    expect(isDevStart({ t: 0, seed: null, card: false })).toBe(false);
    // `?minijuego=canon&derrota=puf` sólo cambia cómo se ve.
    const sc = canonShortcut('?minijuego=canon&derrota=puf', env({ nodeEnv: 'development' }))!;
    expect(isDevStart(sc)).toBe(false);
    expect(isDevStart(canonShortcut('?minijuego=canon&t=419', env({ webdriver: true }))!)).toBe(
      true,
    );
  });

  it('una partida de prueba da premio en `pnpm dev` y en las e2e; en producción nunca, ni con ?dev=1', () => {
    expect(devStartRewards(env({ nodeEnv: 'development' }))).toBe(true);
    expect(devStartRewards(env({ webdriver: true }))).toBe(true);
    expect(devStartRewards(env({ webdriver: true, search: '?dev=1' }))).toBe(true);
    // Los atajos se encienden con ?dev=1, pero el premio no.
    const prod = env({ search: '?dev=1&minijuego=canon&t=419' });
    expect(devShortcutsEnabled(prod)).toBe(true);
    expect(devStartRewards(prod)).toBe(false);
    expect(devStartRewards(env({}))).toBe(false);
  });

  /** Una partida que llega al amanecer, con la sesión y el libro como en `canon-mode`. */
  async function survive(
    authority: LocalSessionAuthority,
    advance: (ms: number) => void,
    sink: MinigameRewardSink,
    onWin: (game: string) => void,
    o: { skippedS?: number; devStart?: boolean; devStartRewards: boolean },
  ) {
    const s = new WorldMinigameSession({
      def: canon,
      authority,
      sink: withWinSignal(sink, CANON_GAME_ID, onWin),
      ...(o.skippedS ? { skippedS: o.skippedS } : {}),
      ...(o.devStart ? { devStart: true } : {}),
      devStartRewards: o.devStartRewards,
    });
    const durationS = canon.defaults.timeLimitS;
    advance((durationS - (o.skippedS ?? 0)) * 1000);
    return s.finish(canonEnd('survived', durationS));
  }

  function harness() {
    let now = Date.UTC(2026, 9, 4, 20);
    const authority = new LocalSessionAuthority(() => now);
    const paid = new Set<string>();
    const sink: MinigameRewardSink = {
      grantWorldReward: vi.fn(async (input) => {
        if (paid.has(input.sourceRef)) return { granted: false, reason: 'duplicate' };
        paid.add(input.sourceRef);
        return { granted: true };
      }),
    };
    const onWin = vi.fn();
    return { authority, advance: (ms: number) => (now += ms), sink, onWin };
  }

  it('en producción, `&t=` o un atajo que cambia la partida: ni premio, ni `win_minigame`, ni logros', async () => {
    const h = harness();
    const rewards = devStartRewards(env({ search: '?dev=1' }));
    const lastSecond = canon.defaults.timeLimitS - 1;
    for (const o of [
      { skippedS: lastSecond, devStartRewards: rewards },
      { devStart: true, devStartRewards: rewards },
    ]) {
      const r = await survive(h.authority, h.advance, h.sink, h.onWin, o);
      expect(r.validation).toEqual({ valid: true });
      expect(r.reward).toEqual({ granted: false, reason: 'test_start' });
    }
    expect(h.sink.grantWorldReward).not.toHaveBeenCalled();
    expect(h.onWin).not.toHaveBeenCalled();

    // Una partida normal después sí cobra, una vez por temporada, con su señal.
    const normal = await survive(h.authority, h.advance, h.sink, h.onWin, {
      devStartRewards: rewards,
    });
    expect(normal.reward).toEqual({
      granted: true,
      points: canon.defaults.reward.points,
      coins: canon.defaults.reward.coins,
    });
    expect(h.onWin).toHaveBeenCalledWith(CANON_GAME_ID);
    const again = await survive(h.authority, h.advance, h.sink, h.onWin, {
      devStartRewards: rewards,
    });
    expect(again.reward).toEqual({ granted: false, reason: 'duplicate' });
  });

  it('en `pnpm dev` y en las e2e, la partida de `&t=` sigue cobrando (una vez)', async () => {
    for (const e of [env({ nodeEnv: 'development' }), env({ webdriver: true })]) {
      const h = harness();
      const r = await survive(h.authority, h.advance, h.sink, h.onWin, {
        skippedS: canon.defaults.timeLimitS - 1,
        devStart: true,
        devStartRewards: devStartRewards(e),
      });
      expect(r.reward.granted).toBe(true);
      expect(h.sink.grantWorldReward).toHaveBeenCalledTimes(1);
      expect(h.onWin).toHaveBeenCalledWith(CANON_GAME_ID);
    }
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

  it('la carta de nivel espera al jugador; `choose` elige esa opción en el paso siguiente (T118)', () => {
    const run = new SurvivorsRun(sea(), { seed: 5, quality: 'alta', ship: MAR_SHIP_CONFIG });
    const idle = { dirX: 0, dirY: 0, throttle: 0, drift: false };
    run.devLevelUp();
    run.step(idle);
    expect(run.snapshot().status).toBe('card');
    const card = run.snapshot().card!;
    const level = run.snapshot().xp.level;
    // Sin elegir, la carta sigue abierta (ya no se elige sola) y el tiempo no corre.
    const active = run.snapshot().activeS;
    for (let i = 0; i < 120; i++) run.step(idle);
    expect(run.snapshot().status).toBe('card');
    expect(run.snapshot().activeS).toBe(active);
    // Una opción que no existe no hace nada.
    run.choose(card.options.length);
    run.step(idle);
    expect(run.snapshot().status).toBe('card');
    const pick = card.options[1]!;
    run.choose(1);
    run.step(idle);
    expect(run.snapshot().status).toBe('running');
    expect(run.snapshot().upgrades[pick.upgrade]).toBe(1);
    expect(run.snapshot().xp.level).toBe(level);
    // Sin carta, `choose` no guarda nada para la siguiente.
    run.choose(0);
    run.devLevelUp();
    run.step(idle);
    run.step(idle);
    expect(run.snapshot().status).toBe('card');
  });

  it('avisa del final una vez', () => {
    const ends: string[] = [];
    const run = new SurvivorsRun(sea(), {
      seed: 5,
      quality: 'alta',
      ship: MAR_SHIP_CONFIG,
      startAtS: SURVIVORS_CONFIG.durationS - 3,
      autoPickCards: true,
      onEnd: (reason) => ends.push(reason),
    });
    for (let i = 0; i < 60 * 10 && !run.ended; i++) {
      run.step({ dirX: 1, dirY: 0, throttle: 1, drift: false });
    }
    expect(run.ended).toBe(true);
    expect(ends).toHaveLength(1);
    expect(['survived', 'flooded']).toContain(ends[0]);
    expect(run.hook().fin).toBe(ends[0]);
    expect(run.hook().estado).toBe('ended');
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

describe('las piezas de la partida', () => {
  it('una pieza por tipo (y por figura de nota) con el tope de cada calidad', () => {
    for (const q of ['alta', 'baja'] as const) {
      const caps = SURVIVORS_CONFIG.caps[q];
      const view = new SurvivorsView(SURVIVORS_CONFIG, caps);
      const cap = view.capacity();
      for (const id of Object.keys(SURVIVORS_CONFIG.enemies))
        expect(cap[id], id).toBe(caps.enemies);
      expect(cap.projectiles).toBe(caps.projectiles);
      for (const f of NOTE_FIGURES) expect(cap[`note-${f}`], f).toBe(caps.notes);
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
    // T126: además, el aro de cada élite, la sombra de lo que vuela, los
    // disparos enemigos y dos piezas por aviso de embestida.
    const flyers = s.enemies.filter((e) => e.type === 'gull').length;
    const elites = s.enemies.filter((e) => e.elite).length;
    expect(total).toBe(
      s.enemies.length +
        s.projectiles.length +
        s.notes.length +
        elites +
        flyers +
        s.enemyProjectiles.length +
        s.telegraphs.length * 2,
    );
    view.dispose();
  });
});

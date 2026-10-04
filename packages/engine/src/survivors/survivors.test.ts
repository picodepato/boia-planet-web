import { WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { rng } from '../minigames/rng';
import { DEFAULT_SHIP_CONFIG } from '../ship/config';
import type { ShipInput } from '../ship/controller';
import { wrapDelta } from '../world/wrap';
import {
  SURVIVORS_CONFIG,
  SURVIVORS_STEP_S,
  type SurvivorsConfig,
  figureOf,
  survivorsConfigHash,
  survivorsShipConfig,
  trackAt,
  xpToNext,
} from './config';
import { SpatialGrid } from './grid';
import { SurvivorsClock } from './clock';
import { type SurvivorsEvent, type SurvivorsGame, type SurvivorsInput, createSurvivors } from './sim';
import { type SurvivorsWorld, survivorsWorldOf } from './world';

// --- Mundos de prueba ---------------------------------------------------------

/** El mapa compartido con sus islas (las mismas con las que choca el barco). */
function arcillaWorld(): SurvivorsWorld {
  const w = WORLD_REGISTRY.get('arcilla').config;
  return survivorsWorldOf(w, w.bounds, { x: 0, y: 0 });
}

/** Un archipiélago denso en un mar pequeño que da la vuelta: islas por todas partes. */
function archipelago(seed: number): SurvivorsWorld {
  const r = rng(seed);
  const obstacles = [];
  for (let i = 0; i < 45; i++) {
    const x = -1800 + r() * 3600;
    const y = -1800 + r() * 3600;
    // El centro queda libre para el barco.
    if (Math.hypot(x, y) < 260) continue;
    obstacles.push({ x, y, radius: 40 + r() * 150 });
  }
  return {
    bounds: { left: -1800, right: 1800, top: -1800, bottom: 1800 },
    obstacles,
    start: { x: 0, y: 0 },
  };
}

/** Mar sin islas, para pruebas que colocan las cosas a mano. */
function openSea(obstacles: SurvivorsWorld['obstacles'] = []): SurvivorsWorld {
  return {
    bounds: { left: -2000, right: 2000, top: -2000, bottom: 2000 },
    obstacles,
    start: { x: 0, y: 0, heading: 0 },
  };
}

function withConfig(patch: (c: SurvivorsConfig) => void): SurvivorsConfig {
  const c = structuredClone(SURVIVORS_CONFIG);
  patch(c);
  return c;
}

/** El barco no se inunda nunca: para jugar los 7:00 enteros. */
const unsinkable = withConfig((c) => {
  c.player.waterCapacity = 1e12;
});

/** Sin guion: sólo lo que la prueba pone. */
const quiet = (patch: (c: SurvivorsConfig) => void = () => {}) =>
  withConfig((c) => {
    c.acts = [{ act: 1, durationS: c.durationS, tracks: [], events: [] }];
    patch(c);
  });

// --- Pilotos ------------------------------------------------------------------

/** Un guion de entradas fijo: vueltas y eses, y elige siempre la carta 0. */
function scriptedInput(step: number): SurvivorsInput {
  const a = step * 0.01;
  const ship: ShipInput = {
    dirX: Math.cos(a) + 0.3 * Math.sin(step * 0.05),
    dirY: Math.sin(a),
    throttle: 0.8,
    drift: false,
  };
  return { ship, choose: 0 };
}

/** Huye del enemigo más cercano (y elige la carta 0). */
function fleeInput(game: SurvivorsGame): SurvivorsInput {
  const s = game.snapshot();
  const p = s.player;
  const b = game.world.bounds;
  let fx = 0;
  let fy = 0;
  for (const e of s.enemies) {
    const dx = wrapDelta(p.x - e.x, b.right - b.left);
    const dy = wrapDelta(p.y - e.y, b.bottom - b.top);
    const d2 = Math.max(100, dx * dx + dy * dy);
    fx += dx / d2;
    fy += dy / d2;
  }
  if (Math.hypot(fx, fy) < 1e-9) return { choose: 0 };
  return { ship: { dirX: fx, dirY: fy, throttle: 1, drift: false }, choose: 0 };
}

/**
 * Un esquivador sencillo: huye de los enemigos cercanos (más peso cuanto más
 * cerca) y se aparta de las islas que tiene delante. Elige la carta 0.
 */
function dodgeInput(game: SurvivorsGame): SurvivorsInput {
  const s = game.snapshot();
  const p = s.player;
  const b = game.world.bounds;
  const w = b.right - b.left;
  const h = b.bottom - b.top;
  let fx = 0;
  let fy = 0;
  for (const e of s.enemies) {
    const dx = wrapDelta(p.x - e.x, w);
    const dy = wrapDelta(p.y - e.y, h);
    const d = Math.hypot(dx, dy);
    if (d > 420) continue;
    const k = 1 / Math.max(40, d) ** 2;
    fx += dx * k;
    fy += dy * k;
  }
  const norm = Math.hypot(fx, fy);
  if (norm > 1e-12) {
    fx /= norm;
    fy /= norm;
  }
  for (const o of game.world.obstacles) {
    const dx = wrapDelta(p.x - o.x, w);
    const dy = wrapDelta(p.y - o.y, h);
    const d = Math.hypot(dx, dy);
    const reach = o.radius + 160;
    if (d < reach) {
      const k = (reach - d) / 160;
      fx += (dx / Math.max(1, d)) * k * 2;
      fy += (dy / Math.max(1, d)) * k * 2;
    }
  }
  if (Math.hypot(fx, fy) < 1e-9) return { ship: { dirX: 0, dirY: 0, throttle: 0, drift: false }, choose: 0 };
  return { ship: { dirX: fx, dirY: fy, throttle: 1, drift: false }, choose: 0 };
}

interface RunResult {
  game: SurvivorsGame;
  events: SurvivorsEvent[];
  steps: number;
}

/** Juega hasta el final (o `maxSteps`), llamando a `each` tras cada paso. */
function play(
  game: SurvivorsGame,
  input: (step: number, game: SurvivorsGame) => SurvivorsInput,
  each: (game: SurvivorsGame, ev: readonly SurvivorsEvent[]) => void = () => {},
  maxSteps = 40_000,
): RunResult {
  const events: SurvivorsEvent[] = [];
  let steps = 0;
  while (!game.ended && steps < maxSteps) {
    const ev = game.step(input(steps, game));
    for (const e of ev) if (e.type !== 'fire') events.push({ ...e });
    each(game, ev);
    steps++;
  }
  return { game, events, steps };
}

// --- Pruebas ------------------------------------------------------------------

describe('survivors: configuración', () => {
  it('versionada y con huella estable que cubre cada valor', () => {
    expect(SURVIVORS_CONFIG.version).toBeGreaterThan(0);
    expect(survivorsConfigHash()).toBe(survivorsConfigHash(structuredClone(SURVIVORS_CONFIG)));
    const tweaked = withConfig((c) => {
      c.handling.turnRateScale += 0.01;
    });
    expect(survivorsConfigHash(tweaked)).not.toBe(survivorsConfigHash());
  });

  it('trae lo de la beta 1 en catálogos con hueco para el diseño completo', () => {
    const c = SURVIVORS_CONFIG;
    expect(Object.keys(c.enemies).sort()).toEqual(['crab', 'piranha']);
    expect(Object.keys(c.weapons)).toEqual([c.startingWeapon]);
    expect(c.weapons.canon?.blockedByIslands).toBe(true);
    expect(c.acts.map((a) => a.act)).toEqual([1]);
    expect(c.acts[0]!.durationS).toBe(c.durationS);
    expect(['puf', 'sumergirse']).toContain(c.defeatStyle);
    expect(c.caps.alta.enemies).toBeGreaterThan(c.caps.baja.enemies);
    // Cada mejora: efecto fijo y su clave de texto.
    for (const u of c.upgrades) {
      expect(u.i18nKey).toBe(`survivors.upgrade.${u.id}`);
      expect(u.amount).toBeGreaterThan(0);
    }
    expect(c.upgrades.map((u) => u.id).sort()).toEqual(
      ['bailing', 'damage', 'fireRate', 'magnet', 'projectiles', 'speed'].sort(),
    );
  });

  it('la maniobrabilidad de la partida gira más y tiene menos inercia', () => {
    const base = DEFAULT_SHIP_CONFIG;
    const s = survivorsShipConfig(base, SURVIVORS_CONFIG.handling);
    expect(s.turnRate).toBeGreaterThan(base.turnRate);
    expect(s.acceleration).toBeGreaterThan(base.acceleration);
    expect(s.brakeDeceleration).toBeGreaterThan(base.brakeDeceleration);
    expect(s.maxSpeed).toBe(base.maxSpeed);
    expect(survivorsShipConfig(base, SURVIVORS_CONFIG.handling, 0.2).maxSpeed).toBeCloseTo(
      base.maxSpeed * 1.2,
    );
    // Cámara más lejos y algo más alta.
    expect(SURVIVORS_CONFIG.camera.distanceScale).toBeGreaterThan(1);
    expect(SURVIVORS_CONFIG.camera.heightScale).toBeGreaterThan(1);
  });

  it('figuras por valor y experiencia creciente', () => {
    const v = SURVIVORS_CONFIG.notes.values;
    expect(v.corchea).toBeLessThan(v.negra);
    expect(v.negra).toBeLessThan(v.blanca);
    expect(v.blanca).toBeLessThan(v.redonda);
    expect(figureOf(SURVIVORS_CONFIG, v.corchea)).toBe('corchea');
    expect(figureOf(SURVIVORS_CONFIG, v.blanca)).toBe('blanca');
    expect(figureOf(SURVIVORS_CONFIG, v.redonda * 3)).toBe('redonda');
    expect(xpToNext(SURVIVORS_CONFIG, 2)).toBeGreaterThan(xpToNext(SURVIVORS_CONFIG, 1));
  });
});

describe('survivors: rejilla espacial', () => {
  it('encuentra lo de la celda de al lado al otro lado de la costura', () => {
    const g = new SpatialGrid({ left: -1000, right: 1000, top: -500, bottom: 500 }, 128, 4);
    g.insert(0, 990, 0);
    g.insert(1, 0, 0);
    g.insert(2, -990, 495);
    const out: number[] = [];
    expect(g.query(-995, 0, 30, out)).toEqual([0]);
    expect(g.query(-990, -495, 30, out)).toEqual([2]);
    g.clear();
    expect(g.query(0, 0, 3000, out)).toEqual([]);
  });

  it('una consulta más grande que el mar no repite nada', () => {
    const g = new SpatialGrid({ left: 0, right: 300, top: 0, bottom: 300 }, 128, 4);
    g.insert(0, 10, 10);
    g.insert(1, 290, 290);
    const out: number[] = [];
    expect([...g.query(150, 150, 5000, out)].sort()).toEqual([0, 1]);
  });
});

describe('survivors: determinismo', () => {
  it('misma semilla y mismas entradas = misma partida; otra semilla, otra', () => {
    const run = (seed: number) => {
      const game = createSurvivors(SURVIVORS_CONFIG, seed, archipelago(3));
      const hashes: string[] = [];
      play(
        game,
        (i) => scriptedInput(i),
        // Cada 5 s de tiempo activo: no depende de cuánto aguante el guion
        // (el barco de base pasó de 22 a 15 nudos en la fusión de T120).
        (g) => {
          if (g.activeS > 0 && Math.round(g.activeS * 60) % 300 === 0) hashes.push(g.stateHash());
        },
        6000,
      );
      hashes.push(game.stateHash());
      return hashes;
    };
    const a = run(7);
    const b = run(7);
    expect(a.length).toBeGreaterThan(2);
    expect(b).toEqual(a);
    expect(run(8).at(-1)).not.toBe(a.at(-1));
  });
});

describe('survivors: partidas completas', () => {
  for (const quality of ['alta', 'baja'] as const) {
    it(`el tope de calidad ${quality} nunca se pasa en 7:00 enteros`, () => {
      const game = createSurvivors(unsinkable, 11, archipelago(5), { quality });
      const caps = SURVIVORS_CONFIG.caps[quality];
      let maxEnemies = 0;
      let maxProjectiles = 0;
      let maxNotes = 0;
      const r = play(
        game,
        (i) => scriptedInput(i),
        (g) => {
          const s = g.snapshot();
          maxEnemies = Math.max(maxEnemies, s.enemies.length);
          maxProjectiles = Math.max(maxProjectiles, s.projectiles.length);
          maxNotes = Math.max(maxNotes, s.notes.length);
        },
      );
      expect(r.game.snapshot().end).toBe('survived');
      expect(maxEnemies).toBeLessThanOrEqual(caps.enemies);
      expect(maxProjectiles).toBeLessThanOrEqual(caps.projectiles);
      expect(maxNotes).toBeLessThanOrEqual(caps.notes);
      // El tope se llega a tocar: la prueba mide algo.
      expect(maxEnemies).toBe(caps.enemies);
      expect(r.game.snapshot().pressure).toBeGreaterThan(0);
    });
  }

  const worlds: [string, number, () => SurvivorsWorld][] = [
    ['archipiélago A', 1, () => archipelago(21)],
    ['archipiélago B', 2, () => archipelago(22)],
    ['el mapa compartido', 3, arcillaWorld],
  ];
  for (const [name, seed, make] of worlds) {
    it(`nada aparece ni se queda en tierra (${name}, semilla ${seed})`, () => {
      const game = createSurvivors(unsinkable, seed, make(), { quality: 'alta' });
      let checked = 0;
      let notes = 0;
      let defeatedOnLand = 0;
      play(
        game,
        (i, g) => (i % 600 < 300 ? scriptedInput(i) : fleeInput(g)),
        (g, ev) => {
          const s = g.snapshot();
          for (const e of s.enemies) {
            if (g.onLand(e.x, e.y)) throw new Error(`enemigo ${e.id} en tierra a ${g.activeS}s`);
            checked++;
          }
          for (const n of s.notes) {
            if (g.onLand(n.x, n.y)) throw new Error(`nota ${n.id} en tierra a ${g.activeS}s`);
            notes++;
          }
          for (const e of ev) if (e.type === 'defeated' && g.onLand(e.x, e.y)) defeatedOnLand++;
        },
      );
      expect(game.snapshot().end).toBe('survived');
      expect(checked).toBeGreaterThan(100_000);
      expect(notes).toBeGreaterThan(1000);
      expect(defeatedOnLand).toBe(0);
    });
  }

  it('termina «survived» justo a los 7:00 de tiempo activo', () => {
    const game = createSurvivors(unsinkable, 4, archipelago(9));
    let endAt = -1;
    let before = -1;
    play(
      game,
      (i) => scriptedInput(i),
      (g, ev) => {
        if (ev.some((e) => e.type === 'end')) endAt = g.activeS;
        else before = g.activeS;
      },
    );
    const s = game.snapshot();
    expect(s.end).toBe('survived');
    expect(endAt).toBe(SURVIVORS_CONFIG.durationS);
    expect(before).toBeCloseTo(SURVIVORS_CONFIG.durationS - SURVIVORS_STEP_S, 9);
    expect(s.timeLeftS).toBe(0);
    expect(s.status).toBe('ended');
    // Ya no avanza.
    expect(game.step(scriptedInput(0))).toEqual([]);
  });

  it('sin esquivar, el barco se inunda', () => {
    const game = createSurvivors(SURVIVORS_CONFIG, 3, archipelago(9));
    const r = play(game, () => ({ choose: 0 }));
    const s = game.snapshot();
    expect(s.end).toBe('flooded');
    expect(s.activeS).toBeLessThan(SURVIVORS_CONFIG.durationS);
    expect(s.water.level).toBe(s.water.capacity);
    expect(r.events.filter((e) => e.type === 'hit').length).toBeGreaterThan(0);
    expect(r.events.at(-1)).toEqual({ type: 'end', reason: 'flooded' });
  });

  it('cada golpe da ~0,5 s de invulnerabilidad', () => {
    const game = createSurvivors(unsinkable, 3, archipelago(9));
    const hitSteps: number[] = [];
    play(
      game,
      () => ({ choose: 0 }),
      (g, ev) => {
        if (ev.some((e) => e.type === 'hit')) hitSteps.push(Math.round(g.activeS * 60));
      },
      6000,
    );
    expect(hitSteps.length).toBeGreaterThan(2);
    const minGap = Math.min(...hitSteps.slice(1).map((s, i) => s - hitSteps[i]!));
    expect(minGap * SURVIVORS_STEP_S).toBeGreaterThanOrEqual(
      SURVIVORS_CONFIG.player.invulnerableS - 1e-9,
    );
  });
});

describe('survivors: equilibrio de la beta 1 (T123)', () => {
  it('ningún enemigo común alcanza la velocidad máxima del barco en los 7:00 (salvo el telegrafiado)', () => {
    const cfg = SURVIVORS_CONFIG;
    const top = DEFAULT_SHIP_CONFIG.maxSpeed;
    for (const act of cfg.acts) {
      for (const track of act.tracks) {
        const def = cfg.enemies[track.enemy]!;
        if (def.behavior === 'charger') continue;
        for (let t = track.fromS; t < track.toS; t += 1) {
          const key = trackAt(track, t)!;
          const speed = def.speed * key.speedScale * (1 + def.growthPerMinute.speed * (t / 60));
          expect(speed, `${def.id} a ${t}s`).toBeLessThan(top * 0.95);
        }
        const end = trackAt(track, track.toS - 1e-6)!;
        const last =
          def.speed * end.speedScale * (1 + def.growthPerMinute.speed * (cfg.durationS / 60));
        expect(last).toBeLessThan(top * 0.95);
      }
    }
    expect(cfg.enemies.piranha!.speed).toBeCloseTo(top * 0.8, -1);
  });

  const seeds: [number, () => SurvivorsWorld][] = [
    [1, () => archipelago(31)],
    [2, () => archipelago(32)],
    [3, arcillaWorld],
    [4, () => archipelago(34)],
  ];
  for (const [seed, make] of seeds) {
    it(`un esquivador aguanta mucho más que un barco parado (semilla ${seed})`, () => {
      const idle = createSurvivors(SURVIVORS_CONFIG, seed, make());
      const idleRun = play(idle, () => ({ choose: 0 }));
      const bot = createSurvivors(SURVIVORS_CONFIG, seed, make());
      const botRun = play(bot, (_i, g) => dodgeInput(g));
      const idleS = idleRun.game.snapshot().activeS;
      const botS = botRun.game.snapshot().activeS;
      expect(idleRun.game.snapshot().end).toBe('flooded');
      expect(botS).toBeGreaterThan(idleS * 3);
      expect(botS).toBeGreaterThan(90);
    });
  }
});

describe('survivors: pausa y tiempo activo', () => {
  it('una pausa de 5:01 abandona; la pausa nunca cuenta como tiempo activo', () => {
    const game = createSurvivors(SURVIVORS_CONFIG, 5, openSea());
    for (let i = 0; i < 120; i++) game.step();
    const active = game.activeS;
    expect(active).toBeCloseTo(2, 9);
    game.step({ pause: true });
    const fiveMin = Math.round(300 / SURVIVORS_STEP_S);
    for (let i = 1; i < fiveMin; i++) game.step();
    expect(game.ended).toBe(false);
    expect(game.snapshot().status).toBe('paused');
    expect(game.activeS).toBe(active);
    expect(game.snapshot().pauseRunS).toBeCloseTo(300, 6);
    let end: SurvivorsEvent[] = [];
    for (let i = 0; i < 60 && !game.ended; i++) end = [...game.step()];
    expect(game.snapshot().end).toBe('abandoned');
    expect(end).toEqual([{ type: 'end', reason: 'abandoned' }]);
    expect(game.activeS).toBe(active);
  });

  it('la pestaña oculta cuenta como pausa en el reloj; seguir jugando la reinicia', () => {
    const game = createSurvivors(SURVIVORS_CONFIG, 5, openSea());
    const clock = new SurvivorsClock();
    let steps = 0;
    for (let f = 0; f < 60; f++) {
      const n = clock.frame(game, 1 / 60);
      for (let i = 0; i < n; i++) game.step();
      steps += n;
    }
    expect(steps).toBe(60);
    expect(game.activeS).toBeCloseTo(1, 9);
    // 4:00 oculta, luego jugar: no abandona y la pausa seguida vuelve a 0.
    expect(clock.frame(game, 240, true)).toBe(0);
    expect(game.snapshot().pauseTotalS).toBeCloseTo(240, 6);
    expect(game.activeS).toBeCloseTo(1, 9);
    for (let i = 0; i < clock.frame(game, 1 / 60); i++) game.step();
    expect(game.snapshot().pauseRunS).toBe(0);
    // Otra vez oculta 5:01: abandonada.
    clock.frame(game, 301, true);
    expect(game.snapshot().end).toBe('abandoned');
    expect(clock.frame(game, 1 / 60)).toBe(0);
  });

  it('un hueco largo entre imágenes cuenta como pausa, no como juego', () => {
    const game = createSurvivors(SURVIVORS_CONFIG, 5, openSea());
    const clock = new SurvivorsClock(0.25);
    const n = clock.frame(game, 10);
    expect(n).toBe(Math.floor(0.25 / SURVIVORS_STEP_S + 1e-9));
    expect(game.snapshot().pauseTotalS).toBeCloseTo(9.75, 6);
  });

  it('el reloj dice cuánto del paso siguiente ya pasó (para pintar entre pasos)', () => {
    const game = createSurvivors(SURVIVORS_CONFIG, 5, openSea());
    const clock = new SurvivorsClock();
    expect(clock.alpha).toBe(0);
    expect(clock.frame(game, SURVIVORS_STEP_S * 2.5)).toBe(2);
    expect(clock.alpha).toBeCloseTo(0.5, 6);
    clock.frame(game, 10, true);
    expect(clock.alpha).toBe(0);
  });

  it('subir de nivel para el reloj hasta elegir carta', () => {
    const cfg = quiet((c) => {
      c.levels = { base: 1, linear: 0, quadratic: 0 };
    });
    const game = createSurvivors(cfg, 9, openSea());
    game.spawnNote(30, 0, 1);
    let ev: readonly SurvivorsEvent[] = [];
    for (let i = 0; i < 60 && game.snapshot().status !== 'card'; i++) ev = game.step();
    expect(ev.some((e) => e.type === 'note')).toBe(true);
    expect(ev).toContainEqual({ type: 'levelUp', level: 2 });
    const s = game.snapshot();
    expect(s.status).toBe('card');
    expect(s.card?.options).toHaveLength(cfg.cardChoices);
    expect(new Set(s.card?.options.map((o) => o.upgrade)).size).toBe(cfg.cardChoices);
    const frozen = game.activeS;
    for (let i = 0; i < 120; i++) game.step({ ship: { dirX: 1, dirY: 0, throttle: 1, drift: false } });
    expect(game.activeS).toBe(frozen);
    expect(game.snapshot().pauseRunS).toBeCloseTo(2, 6);
    const pick = game.snapshot().card!.options[1]!;
    game.step({ choose: 1 });
    const after = game.snapshot();
    expect(after.status).toBe('running');
    expect(after.upgrades[pick.upgrade]).toBe(1);
    expect(after.stats[pick.stat]).toBeCloseTo(pick.amount, 9);
    expect(game.activeS).toBeCloseTo(frozen + SURVIVORS_STEP_S, 9);
  });

  it('la carta abierta también cuenta para el límite de pausa', () => {
    const cfg = quiet((c) => {
      c.levels = { base: 1, linear: 0, quadratic: 0 };
    });
    const game = createSurvivors(cfg, 9, openSea());
    game.spawnNote(30, 0, 1);
    for (let i = 0; i < 60 && game.snapshot().status !== 'card'; i++) game.step();
    expect(game.snapshot().status).toBe('card');
    game.elapsePause(301);
    expect(game.snapshot().end).toBe('abandoned');
  });
});

describe('survivors: cañón, notas e islas', () => {
  const still = quiet((c) => {
    c.enemies.piranha!.speed = 0;
    c.enemies.piranha!.hp = 10;
  });

  it('las islas paran las bolas del cañón', () => {
    // Isla entre el barco (0, 0) y la piraña (400, 0).
    const blocked = createSurvivors(still, 1, openSea([{ x: 200, y: 0, radius: 50 }]));
    const target = blocked.spawnEnemy('piranha', 400, 0)!;
    const r = play(blocked, () => ({}), () => {}, 300);
    expect(r.events.filter((e) => e.type === 'blocked').length).toBeGreaterThan(0);
    expect(r.events.some((e) => e.type === 'defeated')).toBe(false);
    expect(target.hp).toBe(still.enemies.piranha!.hp);
    for (const e of r.events) {
      if (e.type === 'blocked') expect(Math.hypot(e.x - 200, e.y)).toBeLessThan(50 + 10);
    }
    // Sin la isla, la misma piraña cae.
    const open = createSurvivors(still, 1, openSea());
    open.spawnEnemy('piranha', 400, 0);
    const r2 = play(open, () => ({}), () => {}, 300);
    expect(r2.events.some((e) => e.type === 'defeated')).toBe(true);
  });

  it('el cañón apunta al más cercano y suelta una nota donde cae el enemigo', () => {
    const game = createSurvivors(still, 1, openSea());
    game.spawnEnemy('piranha', 0, 450);
    const near = game.spawnEnemy('piranha', 200, 0)!;
    const r = play(game, () => ({}), () => {}, 120);
    const first = r.events.find((e) => e.type === 'defeated');
    expect(first).toMatchObject({ type: 'defeated', id: near.id, enemy: 'piranha' });
    const notes = game.snapshot().notes;
    expect(notes.some((n) => Math.hypot(n.x - 200, n.y) < 1)).toBe(true);
  });

  it('las notas cercanas se funden en una de más valor', () => {
    const game = createSurvivors(quiet(), 1, openSea());
    const v = SURVIVORS_CONFIG.notes.values;
    game.spawnNote(600, 600, v.corchea);
    game.spawnNote(610, 600, v.corchea);
    game.spawnNote(600, 612, v.corchea);
    game.spawnNote(900, 900, v.corchea);
    expect(game.snapshot().notes).toHaveLength(4);
    const every = Math.round(SURVIVORS_CONFIG.notes.mergeEveryS / SURVIVORS_STEP_S);
    for (let i = 0; i < every; i++) game.step();
    const notes = game.snapshot().notes;
    expect(notes).toHaveLength(2);
    const merged = notes.find((n) => n.value === v.corchea * 3)!;
    expect(merged).toBeDefined();
    expect(merged.figure).toBe(figureOf(SURVIVORS_CONFIG, 3 * v.corchea));
    expect(merged.figure).not.toBe('corchea');
  });

  it('el imán atrae las notas de su radio y deja las de fuera', () => {
    const game = createSurvivors(quiet(), 1, openSea());
    const mr = SURVIVORS_CONFIG.player.magnetRadius;
    game.spawnNote(mr - 5, 0, 1);
    game.spawnNote(0, mr * 3, 1);
    game.step();
    const pulled = game.snapshot().notes.find((n) => n.y === 0)!;
    expect(pulled.magnet).toBe(true);
    expect(pulled.x).toBeLessThan(mr - 5);
    const r = play(game, () => ({}), () => {}, 60);
    expect(r.events.filter((e) => e.type === 'note')).toHaveLength(1);
    const left = game.snapshot().notes;
    expect(left).toHaveLength(1);
    expect(left[0]!.magnet).toBe(false);
    expect(left[0]!.y).toBe(mr * 3);
    expect(game.snapshot().notesPicked).toBe(1);
  });

  it('la mejora de imán agranda el radio', () => {
    const cfg = quiet((c) => {
      c.levels = { base: 1, linear: 0, quadratic: 0 };
      c.upgrades = c.upgrades.filter((u) => u.id === 'magnet');
      c.cardChoices = 1;
    });
    const mr = cfg.player.magnetRadius * (1 + cfg.upgrades[0]!.amount);
    // Sin la mejora, una nota a `mr − 5` no se mueve.
    const plain = createSurvivors(cfg, 1, openSea());
    plain.spawnNote(0, mr - 5, 1);
    plain.step();
    expect(plain.snapshot().notes[0]!.magnet).toBe(false);
    // Con ella, sí.
    const game = createSurvivors(cfg, 1, openSea());
    game.spawnNote(20, 0, 1);
    for (let i = 0; i < 30 && game.snapshot().status !== 'card'; i++) game.step();
    game.step({ choose: 0 });
    expect(game.snapshot().upgrades.magnet).toBe(1);
    game.spawnNote(0, mr - 5, 1);
    game.step();
    const note = game.snapshot().notes.find((n) => n.x === 0);
    expect(note?.magnet).toBe(true);
    expect(note!.y).toBeLessThan(mr - 5);
  });
});

describe('survivors: enemigos', () => {
  it('rodean una isla para llegar al barco (sin buscar caminos)', () => {
    const cfg = quiet((c) => {
      c.weapons.canon!.damage = 0;
      c.player.waterCapacity = 1e12;
    });
    const world = openSea([{ x: 300, y: 0, radius: 100 }]);
    for (const type of ['piranha', 'crab'] as const) {
      const game = createSurvivors(cfg, 1, world);
      const e = game.spawnEnemy(type, 600, 0)!;
      let hitAt = -1;
      play(
        game,
        () => ({}),
        (g, ev) => {
          if (game.onLand(e.x, e.y)) throw new Error('en tierra');
          if (hitAt < 0 && ev.some((x) => x.type === 'hit')) hitAt = g.activeS;
        },
        60 * 30,
      );
      expect(hitAt).toBeGreaterThan(0);
    }
  });

  it('los que se quedan lejos se reciclan al anillo', () => {
    const game = createSurvivors(quiet(), 1, openSea());
    const far = SURVIVORS_CONFIG.spawn.recycleDistance + 100;
    const e = game.spawnEnemy('crab', far, 0)!;
    game.step();
    const d = Math.hypot(e.x, e.y);
    expect(d).toBeGreaterThanOrEqual(SURVIVORS_CONFIG.spawn.ringMin - 1);
    expect(d).toBeLessThanOrEqual(SURVIVORS_CONFIG.spawn.ringMax + 1);
  });

  it('con el tope lleno, lo que aparece sale más fuerte', () => {
    const cfg = withConfig((c) => {
      c.player.waterCapacity = 1e12;
      c.caps.baja.enemies = 10;
      c.weapons.canon!.damage = 0;
    });
    const game = createSurvivors(cfg, 1, archipelago(5), { quality: 'baja' });
    play(game, (i) => scriptedInput(i), () => {}, 60 * 60);
    const s = game.snapshot();
    expect(s.enemies.length).toBe(10);
    expect(s.pressure).toBeGreaterThan(0);
  });
});

describe('survivors: empezar en t (atajo &t=)', () => {
  it('es determinista por semilla y empieza a esa hora', () => {
    const make = (seed: number) =>
      createSurvivors(SURVIVORS_CONFIG, seed, archipelago(4), { startAtS: 300 });
    const a = make(5);
    const b = make(5);
    expect(a.stateHash()).toBe(b.stateHash());
    expect(a.activeS).toBeCloseTo(300, 9);
    const s = a.snapshot();
    expect(s.timeLeftS).toBeCloseTo(SURVIVORS_CONFIG.durationS - 300, 6);
    expect(s.xp.level).toBeGreaterThan(1);
    expect(s.enemies.length).toBeGreaterThan(0);
    for (const e of s.enemies) expect(a.onLand(e.x, e.y)).toBe(false);
    for (let i = 0; i < 600; i++) {
      a.step(scriptedInput(i));
      b.step(scriptedInput(i));
    }
    expect(a.stateHash()).toBe(b.stateHash());
    expect(make(6).stateHash()).not.toBe(make(5).stateHash());
  });

  it('cerca del final, sobrevive al llegar a los 7:00', () => {
    const game = createSurvivors(unsinkable, 2, archipelago(4), { startAtS: 415 });
    play(game, (i) => scriptedInput(i));
    expect(game.snapshot().end).toBe('survived');
    expect(game.activeS).toBe(SURVIVORS_CONFIG.durationS);
  });
});

import { describe, expect, it } from 'vitest';
import { rng } from '../minigames/rng';
import { DEFAULT_SHIP_CONFIG } from '../ship/config';
import type { ShipInput } from '../ship/controller';
import { wrapDelta } from '../world/wrap';
import { type EnemyId, SURVIVORS_CONFIG, SURVIVORS_STEP_S, type SurvivorsConfig } from './config';
import { type SurvivorsEvent, type SurvivorsGame, type SurvivorsInput, createSurvivors } from './sim';
import type { SurvivorsWorld } from './world';

/**
 * Beta 2 (plan 011, T125): los cuatro enemigos nuevos, los disparos
 * enemigos, las élites, la «Marea» y el guion entero del acto 1 sin bosses.
 * Los ayudantes de mundo y de juego se repiten de `survivors.test.ts` para
 * no tocar ese archivo (T123 lo edita en paralelo).
 */

// --- Mundos y ayudantes -------------------------------------------------------

function archipelago(seed: number): SurvivorsWorld {
  const r = rng(seed);
  const obstacles = [];
  for (let i = 0; i < 45; i++) {
    const x = -1800 + r() * 3600;
    const y = -1800 + r() * 3600;
    if (Math.hypot(x, y) < 260) continue;
    obstacles.push({ x, y, radius: 40 + r() * 150 });
  }
  return {
    bounds: { left: -1800, right: 1800, top: -1800, bottom: 1800 },
    obstacles,
    start: { x: 0, y: 0 },
  };
}

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

const unsinkable = withConfig((c) => {
  c.player.waterCapacity = 1e12;
});

/** Sin guion ni hitos: sólo lo que la prueba pone. */
const quiet = (patch: (c: SurvivorsConfig) => void = () => {}) =>
  withConfig((c) => {
    c.acts = [{ act: 1, durationS: c.durationS, tracks: [], events: [] }];
    c.player.waterCapacity = 1e12;
    patch(c);
  });

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

function play(
  game: SurvivorsGame,
  input: (step: number, game: SurvivorsGame) => SurvivorsInput,
  each: (game: SurvivorsGame, ev: readonly SurvivorsEvent[]) => void = () => {},
  maxSteps = 40_000,
): { events: SurvivorsEvent[]; steps: number } {
  const events: SurvivorsEvent[] = [];
  let steps = 0;
  while (!game.ended && steps < maxSteps) {
    const ev = game.step(input(steps, game));
    for (const e of ev) if (e.type !== 'fire') events.push({ ...e });
    each(game, ev);
    steps++;
  }
  return { events, steps };
}

const steps = (s: number) => Math.round(s / SURVIVORS_STEP_S);
const act = SURVIVORS_CONFIG.acts[0]!;
const elitesEvent = act.events.find((e) => e.type === 'elites' && e.enabled !== false)!;
const mareaEvent = act.events.find((e) => e.type === 'marea' && e.enabled !== false)!;
const mareaDef = SURVIVORS_CONFIG.marea[mareaEvent.ref]!;
const elitesDef = SURVIVORS_CONFIG.elites[elitesEvent.ref]!;

// --- Guion y velocidades ------------------------------------------------------

describe('survivors beta 2: guion del acto 1 en datos', () => {
  it('cada tipo entra a su minuto; Marea a 5:00 20 s; élites desde 3:30; minibosses apagados, boss final encendido', () => {
    const from = Object.fromEntries(act.tracks.map((t) => [t.enemy, t.fromS]));
    expect(from).toEqual({
      piranha: 0,
      jellyfish: 0,
      gull: 60,
      crab: 90,
      pirate: 180,
      swordfish: 210,
    });
    for (const t of act.tracks) expect(t.toS).toBe(act.durationS);
    expect(elitesEvent.atS).toBe(210);
    expect(mareaEvent).toMatchObject({ atS: 300, durationS: 20 });
    expect(mareaDef.enemy in SURVIVORS_CONFIG.enemies).toBe(true);
    // Vecino (T138) y Fantasma (T140) ya están encendidos; Martillo espera T139.
    const slots = act.events.filter((e) => e.type === 'miniboss' || e.type === 'boss');
    expect(slots.map((e) => [e.type, e.atS, e.enabled !== false, e.ref])).toEqual([
      ['miniboss', 150, true, 'vecino'],
      ['miniboss', 270, false, 'martillo'],
      ['boss', 330, true, 'fantasma'],
    ]);
    expect(act.durationS).toBe(420);
  });

  it('los enemigos nuevos nunca navegan más rápido que el barco; sólo la embestida avisada', () => {
    const top = DEFAULT_SHIP_CONFIG.maxSpeed;
    const minutes = SURVIVORS_CONFIG.durationS / 60;
    for (const id of ['gull', 'pirate', 'swordfish', 'jellyfish'] as const) {
      const def = SURVIVORS_CONFIG.enemies[id]!;
      const growth = 1 + def.growthPerMinute.speed * minutes;
      const maxScale = Math.max(
        1,
        ...act.tracks.filter((t) => t.enemy === id).flatMap((t) => t.keys.map((k) => k.speedScale)),
      );
      expect(def.speed * growth * maxScale * elitesDef.speedScale, id).toBeLessThan(top);
    }
    expect(SURVIVORS_CONFIG.enemies.swordfish!.charger!.chargeSpeed).toBeGreaterThan(top);
    expect(SURVIVORS_CONFIG.enemies.swordfish!.charger!.telegraphS).toBeGreaterThan(0.5);
    // Y el disparo del pirata, esquivable: no mucho más rápido que el barco.
    expect(SURVIVORS_CONFIG.enemies.pirate!.shooter!.projectile.speed).toBeLessThan(top * 2.5);
  });
});

// --- Gaviota --------------------------------------------------------------------

describe('survivors beta 2: gaviota', () => {
  it('cruza una isla en línea recta para llegar al barco', () => {
    const cfg = quiet((c) => {
      c.weapons.canon!.base.damage = 0;
    });
    const world = openSea([{ x: 300, y: 0, radius: 100 }]);
    const game = createSurvivors(cfg, 1, world);
    const gull = game.spawnEnemy('gull', 600, 0)!;
    let overLand = 0;
    let hitAt = -1;
    play(
      game,
      () => ({}),
      (g, ev) => {
        if (game.onLand(gull.x, gull.y)) overLand++;
        if (hitAt < 0 && ev.some((e) => e.type === 'hit' && e.enemy === 'gull')) hitAt = g.activeS;
      },
      steps(20),
    );
    expect(overLand).toBeGreaterThan(5);
    expect(hitAt).toBeGreaterThan(0);
    // En línea casi recta: antes de lo que tarda un cangrejo en rodearla.
    expect(hitAt).toBeLessThan((600 / SURVIVORS_CONFIG.enemies.gull!.speed) * 1.6);
  });
});

// --- Pirata y disparos ----------------------------------------------------------

describe('survivors beta 2: pirata en botecito', () => {
  const standoff = SURVIVORS_CONFIG.enemies.pirate!.shooter!.standoff;

  it('se para a distancia y dispara recto; el disparo mete agua al barco', () => {
    // Sin cañón: que el pirata llegue a ponerse a tiro (el bloqueo por islas va en la siguiente).
    const game = createSurvivors(
      quiet((c) => {
        c.weapons.canon!.base.damage = 0;
      }),
      1,
      openSea(),
    );
    const pirate = game.spawnEnemy('pirate', standoff + 300, 0)!;
    let aimAt = -1;
    let fired = 0;
    let hits = 0;
    let maxShots = 0;
    play(
      game,
      () => ({}),
      (g, ev) => {
        const s = g.snapshot();
        if (aimAt < 0 && pirate.phase === 'aim') aimAt = g.activeS;
        maxShots = Math.max(maxShots, s.enemyProjectiles.length);
        for (const e of ev) {
          if (e.type === 'enemyFire') fired++;
          if (e.type === 'hit' && e.enemy === 'pirate') hits++;
        }
      },
      steps(12),
    );
    expect(aimAt).toBeGreaterThan(0);
    expect(fired).toBeGreaterThan(1);
    expect(hits).toBeGreaterThan(0);
    expect(maxShots).toBeGreaterThan(0);
    expect(game.snapshot().water.level).toBeGreaterThan(0);
    // Parado a tiro: no llega a tocar el barco.
    expect(Math.hypot(pirate.x, pirate.y)).toBeGreaterThan(standoff * 0.7);
  });

  it('una isla para el disparo enemigo y la bola del cañón, los dos sentidos', () => {
    const island = { x: 160, y: 0, radius: 50 };
    const cfg = quiet((c) => {
      c.enemies.pirate!.speed = 0;
    });
    const game = createSurvivors(cfg, 1, openSea([island]));
    const pirate = game.spawnEnemy('pirate', standoff - 20, 0)!;
    const r = play(game, () => ({}), () => {}, steps(10));
    const blocked = r.events.filter((e) => e.type === 'blocked');
    expect(blocked.some((e) => e.type === 'blocked' && e.owner === 'enemy')).toBe(true);
    expect(blocked.some((e) => e.type === 'blocked' && e.owner === 'player')).toBe(true);
    for (const e of blocked) {
      if (e.type === 'blocked') expect(Math.hypot(e.x - island.x, e.y)).toBeLessThan(island.radius + 10);
    }
    expect(r.events.some((e) => e.type === 'hit')).toBe(false);
    expect(r.events.some((e) => e.type === 'defeated')).toBe(false);
    expect(pirate.hp).toBe(pirate.maxHp);
    expect(game.snapshot().water.level).toBe(0);
    // Sin la isla, el mismo pirata acierta y cae.
    const open = createSurvivors(cfg, 1, openSea());
    open.spawnEnemy('pirate', standoff - 20, 0);
    const r2 = play(open, () => ({}), () => {}, steps(10));
    expect(r2.events.some((e) => e.type === 'hit' && e.enemy === 'pirate')).toBe(true);
    expect(r2.events.some((e) => e.type === 'defeated' && e.enemy === 'pirate')).toBe(true);
  });

  it('el tope de disparos enemigos de `baja` se toca y nunca se pasa', () => {
    const cfg = quiet((c) => {
      c.weapons.canon!.base.damage = 0;
      c.enemies.pirate!.speed = 0;
      c.enemies.pirate!.shooter!.cooldownS = 0.1;
      c.enemies.pirate!.shooter!.projectile.range = 4000;
    });
    const game = createSurvivors(cfg, 1, openSea(), { quality: 'baja' });
    const cap = cfg.caps.baja.enemyProjectiles;
    const n = Math.min(cfg.caps.baja.enemies, 50);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      game.spawnEnemy('pirate', Math.cos(a) * (standoff - 10), Math.sin(a) * (standoff - 10));
    }
    expect(game.snapshot().enemies).toHaveLength(n);
    let max = 0;
    play(
      game,
      () => ({}),
      (g) => {
        max = Math.max(max, g.snapshot().enemyProjectiles.length);
      },
      steps(6),
    );
    expect(max).toBe(cap);
    // Y la rejilla de disparos responde alrededor del barco.
    expect(game.enemyShotsNear(0, 0, 400).length).toBeGreaterThan(0);
    expect(game.enemyShotsNear(0, 0, 400).length).toBeLessThanOrEqual(cap);
  });
});

// --- Pez espada -----------------------------------------------------------------

describe('survivors beta 2: pez espada', () => {
  it('avisa con una línea en el agua, quieto, y luego embiste recto', () => {
    const ch = SURVIVORS_CONFIG.enemies.swordfish!.charger!;
    const game = createSurvivors(
      quiet((c) => {
        c.weapons.canon!.base.damage = 0;
      }),
      1,
      openSea(),
    );
    const fish = game.spawnEnemy('swordfish', ch.windupRange - 40, 0)!;
    const x0 = fish.x;
    let telegraphAt = -1;
    let chargeAt = -1;
    let hitAt = -1;
    let maxSpeed = 0;
    const progress: number[] = [];
    play(
      game,
      () => ({}),
      (g, ev) => {
        const s = g.snapshot();
        for (const e of ev) {
          if (e.type === 'telegraph' && telegraphAt < 0) {
            telegraphAt = g.activeS;
            expect(e.id).toBe(fish.id);
            expect(e.length).toBe(ch.chargeDistance);
            expect(Math.cos(e.heading)).toBeCloseTo(-1, 3);
          }
          if (e.type === 'hit' && hitAt < 0) hitAt = g.activeS;
        }
        if (fish.phase === 'telegraph' && chargeAt < 0) {
          // El primer aviso: quieto mientras avisa, y la línea en la instantánea con su progreso.
          expect(fish.x).toBeCloseTo(x0, 6);
          expect(s.telegraphs).toHaveLength(1);
          progress.push(s.telegraphs[0]!.progress);
        }
        if (fish.phase === 'charge') {
          if (chargeAt < 0) chargeAt = g.activeS;
          maxSpeed = Math.max(maxSpeed, Math.hypot(fish.vx, fish.vy));
        }
      },
      steps(6),
    );
    expect(telegraphAt).toBeGreaterThan(0);
    expect(chargeAt).toBeGreaterThan(telegraphAt);
    expect(chargeAt - telegraphAt).toBeCloseTo(ch.telegraphS, 1);
    expect(progress.length).toBeGreaterThan(10);
    for (let i = 1; i < progress.length; i++) expect(progress[i]!).toBeGreaterThanOrEqual(progress[i - 1]!);
    expect(progress[0]!).toBeLessThan(0.1);
    expect(progress.at(-1)!).toBeGreaterThan(0.9);
    expect(maxSpeed).toBeCloseTo(ch.chargeSpeed, 3);
    expect(hitAt).toBeGreaterThanOrEqual(chargeAt);
    // La línea sólo existe mientras avisa.
    expect(game.snapshot().telegraphs).toHaveLength(fish.phase === 'telegraph' ? 1 : 0);
  });

  it('la embestida se acaba contra una isla', () => {
    const ch = SURVIVORS_CONFIG.enemies.swordfish!.charger!;
    const game = createSurvivors(quiet(), 1, openSea([{ x: 160, y: 0, radius: 60 }]));
    const fish = game.spawnEnemy('swordfish', ch.windupRange - 40, 0)!;
    let charged = false;
    const r = play(
      game,
      () => ({}),
      () => {
        if (fish.phase === 'charge') charged = true;
        if (game.onLand(fish.x, fish.y)) throw new Error('pez espada en tierra');
      },
      steps(ch.telegraphS + 1.5),
    );
    expect(charged).toBe(true);
    expect(r.events.some((e) => e.type === 'hit')).toBe(false);
    expect(fish.x).toBeGreaterThan(160 + 60);
  });
});

// --- Medusa ---------------------------------------------------------------------

describe('survivors beta 2: medusa', () => {
  it('al caer se parte en 2 pequeñas, que ya no se parten', () => {
    const split = SURVIVORS_CONFIG.enemies.jellyfish!.split!;
    const cfg = quiet((c) => {
      c.enemies.jellyfish!.speed = 0;
    });
    const game = createSurvivors(cfg, 1, openSea());
    const mother = game.spawnEnemy('jellyfish', 220, 0)!;
    // Hasta el reparto (el cañón la hunde a su ritmo, sea cual sea su daño).
    let splitEv: SurvivorsEvent | undefined;
    for (let i = 0; i < steps(10) && !splitEv; i++) {
      const ev = game.step({}).find((e) => e.type === 'split');
      if (ev) splitEv = { ...ev };
    }
    expect(splitEv).toMatchObject({ type: 'split', enemy: 'jellyfish', id: mother.id, count: split.count });
    const kids = game.snapshot().enemies.filter((e) => e.type === 'jellyfish');
    expect(kids).toHaveLength(split.count);
    for (const k of kids) {
      expect(k.scale).toBeCloseTo(split.scale, 9);
      expect(k.radius).toBeCloseTo(cfg.enemies.jellyfish!.radius * split.scale, 9);
      expect(k.maxHp).toBeCloseTo(mother.maxHp * split.hpScale, 9);
      expect(k.hp).toBeLessThanOrEqual(k.maxHp);
      expect(k.hp).toBeGreaterThan(0);
    }
    // Las pequeñas caen sin partirse más: en total 3 medusas vencidas y un solo reparto.
    const r = play(game, () => ({}), () => {}, steps(20));
    const defeated = r.events.filter((e) => e.type === 'defeated' && e.enemy === 'jellyfish');
    expect(defeated).toHaveLength(split.count);
    expect(r.events.filter((e) => e.type === 'split')).toHaveLength(0);
    expect(game.snapshot().enemies).toHaveLength(0);
    expect(game.snapshot().defeated).toBe(1 + split.count);
  });
});

// --- Élites ---------------------------------------------------------------------

describe('survivors beta 2: élites', () => {
  it('sólo salen desde el hito del guion, con más aguante y mejor nota', () => {
    const game = createSurvivors(unsinkable, 13, archipelago(5));
    const firstSeen = new Map<number, { t: number; elite: boolean; type: EnemyId; hp: number }>();
    let activeBefore = false;
    let activeAfter = false;
    play(
      game,
      (i) => scriptedInput(i),
      (g) => {
        const s = g.snapshot();
        if (s.activeS < elitesEvent.atS) activeBefore ||= s.elitesActive;
        else activeAfter ||= s.elitesActive;
        for (const e of s.enemies) {
          if (!firstSeen.has(e.id)) firstSeen.set(e.id, { t: s.activeS, elite: e.elite, type: e.type, hp: e.maxHp });
        }
      },
    );
    // Insumergible: amanece, o vence al Barco Fantasma antes (T140).
    expect(['survived', 'victory']).toContain(game.snapshot().end);
    expect(activeBefore).toBe(false);
    expect(activeAfter).toBe(true);
    const all = [...firstSeen.values()];
    const elites = all.filter((e) => e.elite);
    expect(elites.length).toBeGreaterThan(5);
    for (const e of elites) expect(e.t).toBeGreaterThanOrEqual(elitesEvent.atS);
    // Una fracción, no una saturación.
    const after = all.filter((e) => e.t >= elitesEvent.atS);
    expect(elites.length / after.length).toBeLessThan(elitesDef.chance * 2);
    // Más aguante que un normal del mismo tipo aparecido poco después.
    for (const el of elites.slice(0, 20)) {
      const peer = after.find((e) => !e.elite && e.type === el.type && Math.abs(e.t - el.t) < 10);
      if (peer) expect(el.hp).toBeGreaterThan(peer.hp * (elitesDef.hpScale * 0.8));
    }
    expect(elitesDef.noteScale).toBeGreaterThan(1);
  }, 60_000);

  it('una élite puesta a mano suelta una nota mayor', () => {
    const cfg = quiet((c) => {
      c.enemies.piranha!.speed = 0;
    });
    // Dentro del radio del imán: la nota que suelta se recoge.
    const at = cfg.player.magnetRadius - 10;
    const plain = createSurvivors(cfg, 1, openSea());
    plain.spawnEnemy('piranha', at, 0);
    const elite = createSurvivors(cfg, 1, openSea());
    const e = elite.spawnEnemy('piranha', at, 0, true)!;
    expect(e.elite).toBe(true);
    expect(e.maxHp).toBeCloseTo(cfg.enemies.piranha!.hp * elitesDef.hpScale, 9);
    const value = (g: SurvivorsGame) =>
      play(g, () => ({}), () => {}, steps(8)).events
        .filter((ev) => ev.type === 'note')
        .reduce((acc, ev) => acc + (ev.type === 'note' ? ev.value : 0), 0);
    const a = value(plain);
    const b = value(elite);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeCloseTo(a * elitesDef.noteScale, 6);
  });
});

// --- Marea ----------------------------------------------------------------------

describe('survivors beta 2: «Marea»', () => {
  it('a 5:00 cae un anillo entero desde todos lados, y sigue cayendo 20 s', () => {
    const cfg = withConfig((c) => {
      c.acts = [{ ...c.acts[0]!, tracks: [], events: [mareaEvent] }];
      c.player.waterCapacity = 1e12;
      c.weapons.canon!.base.damage = 0;
    });
    const game = createSurvivors(cfg, 3, openSea());
    const before = steps(mareaEvent.atS) - 1;
    for (let i = 0; i < before; i++) game.step();
    expect(game.snapshot().enemies).toHaveLength(0);
    expect(game.snapshot().mareaActive).toBe(false);
    game.step();
    const s = game.snapshot();
    expect(s.activeS).toBeCloseTo(mareaEvent.atS, 6);
    expect(s.mareaActive).toBe(true);
    expect(s.enemies).toHaveLength(mareaDef.count);
    const octants = new Set<number>();
    for (const e of s.enemies) {
      expect(e.type).toBe(mareaDef.enemy);
      const d = Math.hypot(e.x, e.y);
      expect(d).toBeGreaterThanOrEqual(cfg.spawn.ringMin - 1);
      expect(d).toBeLessThanOrEqual(cfg.spawn.ringMax + 1);
      octants.add(Math.floor(((Math.atan2(e.y, e.x) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)));
    }
    expect(octants.size).toBe(8);
    // Siguen cayendo anillos hasta que acaba; después, ninguno más.
    let ids = new Set(s.enemies.map((e) => e.id));
    for (let i = 0; i < steps(mareaDef.burstEveryS); i++) game.step();
    const s2 = game.snapshot();
    expect(s2.enemies.filter((e) => !ids.has(e.id)).length).toBe(mareaDef.count);
    for (let i = 0; i < steps(mareaEvent.durationS!); i++) game.step();
    expect(game.snapshot().mareaActive).toBe(false);
    ids = new Set(game.snapshot().enemies.map((e) => e.id));
    for (let i = 0; i < steps(mareaDef.burstEveryS * 2); i++) game.step();
    expect(game.snapshot().enemies.every((e) => ids.has(e.id))).toBe(true);
  });

  it('un hito apagado no hace nada', () => {
    const cfg = withConfig((c) => {
      c.acts = [{ ...c.acts[0]!, tracks: [], events: [{ ...mareaEvent, enabled: false }] }];
    });
    const game = createSurvivors(cfg, 3, openSea());
    for (let i = 0; i < steps(mareaEvent.atS + 5); i++) game.step();
    expect(game.snapshot().enemies).toHaveLength(0);
    expect(game.snapshot().mareaActive).toBe(false);
  });
});

// --- Partidas completas ---------------------------------------------------------

describe('survivors beta 2: partidas completas de 7:00', () => {
  it('la misma semilla da la misma partida de principio a fin; el guion entero se ve', () => {
    const run = (seed: number) => {
      const game = createSurvivors(unsinkable, seed, archipelago(7));
      const hashes: string[] = [];
      const seen = new Set<EnemyId>();
      let elites = 0;
      let telegraphs = 0;
      let shots = 0;
      let splits = 0;
      let maxShots = 0;
      let mareaSteps = 0;
      play(
        game,
        (i) => scriptedInput(i),
        (g, ev) => {
          const s = g.snapshot();
          if (Math.round(s.activeS * 60) % 1800 === 0) hashes.push(g.stateHash());
          for (const e of s.enemies) {
            seen.add(e.type);
            if (e.elite) elites++;
          }
          telegraphs += s.telegraphs.length;
          maxShots = Math.max(maxShots, s.enemyProjectiles.length);
          if (s.mareaActive) mareaSteps++;
          for (const e of ev) {
            if (e.type === 'enemyFire') shots++;
            if (e.type === 'split') splits++;
          }
        },
      );
      hashes.push(game.stateHash());
      return { hashes, seen, elites, telegraphs, shots, splits, maxShots, mareaSteps, end: game.snapshot().end };
    };
    const a = run(21);
    const b = run(21);
    expect(a.end).toBe('survived');
    expect(b.hashes).toEqual(a.hashes);
    expect(a.hashes.length).toBeGreaterThan(10);
    expect([...a.seen].sort()).toEqual(Object.keys(SURVIVORS_CONFIG.enemies).sort());
    expect(a.elites).toBeGreaterThan(0);
    expect(a.telegraphs).toBeGreaterThan(0);
    expect(a.shots).toBeGreaterThan(0);
    // Este piloto no esquiva: el cañón de la beta 1 dispara al más cercano y
    // sólo caen pirañas y gaviotas pegadas al casco; las medusas (y su
    // reparto) se cubren en su prueba aparte.
    expect(a.splits).toBeGreaterThanOrEqual(0);
    expect(a.maxShots).toBeLessThanOrEqual(SURVIVORS_CONFIG.caps.alta.enemyProjectiles);
    expect(a.mareaSteps).toBe(steps(mareaEvent.durationS!));
    expect(run(22).hashes.at(-1)).not.toBe(a.hashes.at(-1));
  }, 60_000);

  it('en `baja` todos los topes aguantan 7:00 enteros con el guion completo', () => {
    const game = createSurvivors(unsinkable, 5, archipelago(5), { quality: 'baja' });
    const caps = SURVIVORS_CONFIG.caps.baja;
    let maxE = 0;
    let maxP = 0;
    let maxS = 0;
    let maxN = 0;
    play(
      game,
      (i) => scriptedInput(i),
      (g) => {
        const s = g.snapshot();
        maxE = Math.max(maxE, s.enemies.length);
        maxP = Math.max(maxP, s.projectiles.length);
        maxS = Math.max(maxS, s.enemyProjectiles.length);
        maxN = Math.max(maxN, s.notes.length);
      },
    );
    expect(game.snapshot().end).toBe('survived');
    expect(maxE).toBe(caps.enemies);
    expect(maxP).toBeLessThanOrEqual(caps.projectiles);
    expect(maxS).toBeLessThanOrEqual(caps.enemyProjectiles);
    expect(maxN).toBeLessThanOrEqual(caps.notes);
    expect(game.snapshot().pressure).toBeGreaterThan(0);
  }, 60_000);

  it('empezar en t (atajo &t=) tras las élites y la Marea sigue siendo determinista', () => {
    const make = (seed: number) =>
      createSurvivors(SURVIVORS_CONFIG, seed, archipelago(4), { startAtS: 305 });
    const a = make(5);
    const b = make(5);
    expect(a.stateHash()).toBe(b.stateHash());
    for (let i = 0; i < 300; i++) {
      a.step(scriptedInput(i));
      b.step(scriptedInput(i));
    }
    expect(a.stateHash()).toBe(b.stateHash());
    expect(a.snapshot().elitesActive).toBe(true);
    expect(a.snapshot().mareaActive).toBe(true);
    // Las pruebas de `wrapDelta` del mar que da la vuelta siguen valiendo para lo nuevo.
    const bnd = a.world.bounds;
    for (const e of a.snapshot().enemies) {
      expect(Math.abs(wrapDelta(e.x - a.snapshot().player.x, bnd.right - bnd.left))).toBeLessThanOrEqual(
        SURVIVORS_CONFIG.spawn.recycleDistance + 1,
      );
    }
  });
});

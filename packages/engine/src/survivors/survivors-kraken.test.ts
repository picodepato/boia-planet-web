import { describe, expect, it } from 'vitest';
import { rng } from '../minigames/rng';
import type { ShipInput } from '../ship/controller';
import { validateBoss } from './bosses';
import { runBot } from './bots';
import {
  type BossId,
  SURVIVORS_CONFIG,
  SURVIVORS_CONFIG_VERSION,
  SURVIVORS_STEP_S,
  type SurvivorsConfig,
  actOf,
} from './config';
import { ROCK_ATTACK, TENTACLE_ATTACK, type KrakenMode, validateKraken } from './kraken';
import { type SurvivorsEvent, type SurvivorsGame, type SurvivorsInput, createSurvivors } from './sim';
import type { SurvivorsWorld } from './world';

/**
 * El Kraken (plan 012 T141), el boss final del acto 2 en la simulación pura:
 * sumergido no se le golpea ni moja; cada tentáculo y cada roca avisan antes
 * de golpear; tumbar un tentáculo expone la cabeza; sólo se agarra a islas
 * al alcance; al caer, el suceso de final; y una partida entera del acto 2
 * es determinista.
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
  return { bounds: { left: -1800, right: 1800, top: -1800, bottom: 1800 }, obstacles, start: { x: 0, y: 0 } };
}

function openSea(obstacles: SurvivorsWorld['obstacles'] = []): SurvivorsWorld {
  return { bounds: { left: -2000, right: 2000, top: -2000, bottom: 2000 }, obstacles, start: { x: 0, y: 0, heading: 0 } };
}

function withConfig(patch: (c: SurvivorsConfig) => void): SurvivorsConfig {
  const c = structuredClone(SURVIVORS_CONFIG);
  patch(c);
  return c;
}

const KRAKEN = SURVIVORS_CONFIG.bosses.kraken!;
const K = KRAKEN.kraken!;

/** Sin guion ni hitos, barco insumergible: sólo el Kraken que la prueba pone. */
const quiet = (patch: (c: SurvivorsConfig) => void = () => {}) =>
  withConfig((c) => {
    c.acts = [{ act: 1, durationS: c.durationS, tracks: [], events: [] }];
    c.player.waterCapacity = 1e12;
    c.salvavidas.offerChance = 0;
    patch(c);
  });

/** El acto 2 de verdad con el barco insumergible. */
const act2 = (patch: (c: SurvivorsConfig) => void = () => {}) =>
  withConfig((c) => {
    c.player.waterCapacity = 1e12;
    c.salvavidas.offerChance = 0;
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

const IDLE: SurvivorsInput = { ship: { dirX: 0, dirY: 0, throttle: 0, drift: false }, choose: 0 };

/** Un suceso con el segundo de partida en que salió. */
type Timed = SurvivorsEvent & { atS: number };

function play(
  game: SurvivorsGame,
  input: (step: number) => SurvivorsInput,
  each: (game: SurvivorsGame, ev: readonly SurvivorsEvent[]) => void = () => {},
  maxSteps = 40_000,
): Timed[] {
  const events: Timed[] = [];
  let steps = 0;
  while (!game.ended && steps < maxSteps) {
    const ev = game.step(input(steps));
    const atS = game.activeS;
    for (const e of ev) if (e.type !== 'fire') events.push({ ...e, atS });
    each(game, ev);
    steps++;
  }
  return events;
}

function run(game: SurvivorsGame, seconds: number, input: SurvivorsInput = IDLE): Timed[] {
  return play(game, () => input, () => {}, Math.round(seconds / SURVIVORS_STEP_S));
}

/** Avanza hasta que el Kraken esté en `mode` (o se acaben `maxS` s); devuelve los sucesos. */
function runUntil(game: SurvivorsGame, mode: KrakenMode, maxS: number, input: SurvivorsInput = IDLE): Timed[] {
  const out: Timed[] = [];
  const steps = Math.round(maxS / SURVIVORS_STEP_S);
  for (let i = 0; i < steps && !game.ended; i++) {
    const ev = game.step(input);
    const atS = game.activeS;
    for (const e of ev) if (e.type !== 'fire') out.push({ ...e, atS });
    if (kraken(game)?.mode === mode) break;
  }
  return out;
}

const of = <T extends SurvivorsEvent['type']>(events: readonly Timed[], type: T) =>
  events.filter((e): e is Extract<Timed, { type: T }> => e.type === type);

function kraken(game: SurvivorsGame) {
  return game.snapshot().bosses.find((b) => b.boss === 'kraken')?.kraken ?? null;
}

function body(game: SurvivorsGame) {
  return game.snapshot().bosses.find((b) => b.boss === 'kraken') ?? null;
}

/** Quema el círculo (x, y, r) con la Llama durante `dt` s de un golpe; devuelve cuántas partes tocó. */
function flame(game: SurvivorsGame, x: number, y: number, r: number, dt: number): number {
  return game.flameBosses(x, y, r, dt);
}

// --- Datos ---------------------------------------------------------------------

describe('kraken T141: datos', () => {
  it('la versión de la config sube; el Kraken es un boss final coherente con sus números propios', () => {
    expect(SURVIVORS_CONFIG_VERSION).toBeGreaterThanOrEqual(10);
    expect(KRAKEN.kind).toBe('boss');
    expect(KRAKEN.chest).toBe(false);
    expect(KRAKEN.ignoresIslands).toBe(true);
    expect(validateBoss(KRAKEN)).toEqual([]);
    expect(validateKraken(KRAKEN)).toEqual([]);
    expect(K.phases.length).toBe(KRAKEN.phases.length);
    // Todo avisa: tentáculos y rocas tienen su tiempo de aviso.
    expect(K.tentacle.telegraphS).toBeGreaterThan(0);
    expect(K.grab.rock.flightS).toBeGreaterThan(0);
    // Las fases van por vida, de mayor a menor, y la última no sale.
    const marks = KRAKEN.phases.map((p) => p.untilHpFraction);
    expect(marks.at(-1)).toBe(0);
    for (let i = 1; i < marks.length - 1; i++) expect(marks[i]!).toBeLessThan(marks[i - 1]!);
    // La validación pilla datos rotos.
    const bad = structuredClone(KRAKEN);
    bad.kraken!.tentacle.telegraphS = 0;
    bad.kraken!.phases = bad.kraken!.phases.slice(1);
    expect(validateBoss(bad).length).toBeGreaterThanOrEqual(2);
  });

  it('el Kraken es el hueco final del acto 2, encendido; el acto 1 tiene el suyo (el Fantasma)', () => {
    const a1 = actOf(SURVIVORS_CONFIG, 1)!;
    const a2 = actOf(SURVIVORS_CONFIG, 2)!;
    const final2 = a2.events.find((e) => e.type === 'boss')!;
    expect(final2.ref).toBe('kraken');
    expect(final2.enabled).toBe(true);
    // El acto 1 no llama al Kraken; sus huecos sólo van encendidos con su boss hecho (T138–T140).
    for (const e of a1.events.filter((e) => e.type === 'boss' || e.type === 'miniboss')) {
      expect(e.ref).not.toBe('kraken');
      expect(e.enabled !== false).toBe(SURVIVORS_CONFIG.bosses[e.ref as BossId] !== undefined);
    }
    // Los demás hitos del 2 son los del 1.
    expect(a2.events.filter((e) => e.type !== 'boss')).toEqual(a1.events.filter((e) => e.type !== 'boss'));
    // En el acto 2 el Kraken entra a su segundo, sumergido, delante del barco.
    const g = createSurvivors(act2(), 5, openSea(), { act: 2, startAtS: final2.atS - 1 });
    const ev = run(g, 2);
    const spawn = of(ev, 'bossSpawn');
    expect(spawn.map((e) => e.boss)).toEqual(['kraken']);
    expect(of(ev, 'krakenState')[0]).toMatchObject({ state: 'submerged', island: -1 });
    const b = body(g)!;
    expect(b.kind).toBe('boss');
    expect(b.kraken!.mode).toBe('submerged');
    expect(b.invulnerable).toBe(true);
    // Y en el acto 1, su propio boss final (T140) tras el miniboss del 4:30 (T139), nunca el Kraken.
    const g1 = createSurvivors(act2(), 5, openSea(), { act: 1, startAtS: final2.atS - 1 });
    run(g1, 2);
    expect(g1.snapshot().bosses.map((b) => b.boss)).not.toContain('kraken');
    expect(g1.snapshot().bosses.map((b) => b.boss)).toContain('fantasma');
  });
});

// --- Sumergido -------------------------------------------------------------------

describe('kraken T141: bajo el agua', () => {
  it('sumergido persigue al barco, no se le golpea (ni la Llama ni las bolas) y no moja al pasar por debajo', () => {
    // El Kraken nace encima del barco quieto: sumergido, se queda pegado a él.
    const g = createSurvivors(quiet(), 1, openSea());
    const v0 = g.spawnBoss('kraken', 0, 0)!;
    expect(v0.kraken!.mode).toBe('submerged');
    expect(v0.invulnerable).toBe(true);
    // Durante el mínimo sumergido no puede emerger: quema y dispara mientras.
    const ev = run(g, K.minSubmergedS - 0.2);
    const b = body(g)!;
    expect(b.kraken!.mode).toBe('submerged');
    expect(b.hp).toBe(b.maxHp);
    expect(flame(g, b.x, b.y, 200, 5)).toBe(0);
    expect(body(g)!.hp).toBe(b.maxHp);
    expect(of(ev, 'bossDamaged')).toEqual([]);
    expect(of(ev, 'bossHit')).toEqual([]);
    expect(of(ev, 'hit')).toEqual([]);
    expect(Math.hypot(b.x, b.y)).toBeLessThan(K.emergeDistance);
    // Al emerger ya toca (es sólido) y la cabeza sigue sin recibir daño hasta que algo la exponga.
    const ev2 = runUntil(g, 'emerged', 10);
    expect(of(ev2, 'krakenState').map((e) => e.state)).toEqual(['emerging', 'emerged']);
    const b2 = body(g)!;
    expect(b2.kraken!.exposed).toBe(false);
    expect(b2.invulnerable).toBe(true);
    expect(flame(g, b2.x, b2.y, 10, 5)).toBe(0);
    expect(body(g)!.hp).toBe(b.maxHp);
  });

  it('la sombra pasa por debajo de las islas y emerge siempre en agua', () => {
    // Una isla grande entre el Kraken y el barco; el barco al otro lado, quieto.
    const g = createSurvivors(quiet(), 2, openSea([{ x: 500, y: 0, radius: 220 }]));
    g.spawnBoss('kraken', 1100, 0);
    let underIsland = 0;
    for (let i = 0; i < Math.round(12 / SURVIVORS_STEP_S); i++) {
      g.step(IDLE);
      const b = body(g)!;
      if (b.kraken!.mode === 'submerged' && g.onLand(b.x, b.y)) underIsland++;
      if (b.kraken!.mode !== 'submerged') {
        expect(g.onLand(b.x, b.y, b.radius)).toBe(false);
        break;
      }
    }
    expect(underIsland).toBeGreaterThan(0);
    expect(body(g)!.kraken!.mode).not.toBe('submerged');
  });

  it('sin acercarse al barco, pasado `maxSubmergedS` emerge igual', () => {
    // Barco rápido y lejos: la sombra no llega, pero sale.
    const g = createSurvivors(quiet((c) => (c.bosses.kraken!.speed = 1)), 3, openSea());
    g.spawnBoss('kraken', 1500, 0);
    const ev = runUntil(g, 'emerging', K.maxSubmergedS + 1);
    const st = of(ev, 'krakenState').find((e) => e.state === 'emerging')!;
    expect(st).toBeDefined();
    expect(st.atS).toBeGreaterThanOrEqual(K.maxSubmergedS - SURVIVORS_STEP_S);
  });
});

// --- Tentáculos y cabeza ------------------------------------------------------------

describe('kraken T141: tentáculos', () => {
  it('cada tentáculo avisa con su círculo al menos `telegraphS` antes de subir; sólo moja al subir y uno por salida', () => {
    const g = createSurvivors(quiet(), 4, openSea());
    g.spawnBoss('kraken', 0, 0);
    const warningsSeen = new Map<number, { x: number; y: number }>();
    const ev = play(
      g,
      () => IDLE,
      (game) => {
        for (const w of game.snapshot().bossWarnings) {
          if (w.attack === TENTACLE_ATTACK && !w.hit) warningsSeen.set(w.id, { x: w.x, y: w.y });
          expect(w.kind).toBe('circles');
        }
      },
      Math.round(20 / SURVIVORS_STEP_S),
    );
    const tents = of(ev, 'krakenTentacle');
    const rises = tents.filter((e) => e.stage === 'rise');
    expect(rises.length).toBeGreaterThanOrEqual(K.phases[0]!.tentacles);
    for (const r of rises) {
      const w = tents.find((e) => e.stage === 'warning' && e.tentacle === r.tentacle)!;
      expect(w).toBeDefined();
      expect(r.atS - w.atS).toBeGreaterThanOrEqual(K.tentacle.telegraphS - SURVIVORS_STEP_S * 1.5);
      expect([r.x, r.y]).toEqual([w.x, w.y]);
    }
    // El aviso genérico de la salida va antes del golpe genérico.
    const tele = of(ev, 'bossTelegraph').filter((e) => e.attack === TENTACLE_ATTACK);
    const atk = of(ev, 'bossAttack').filter((e) => e.attack === TENTACLE_ATTACK);
    expect(tele.length).toBeGreaterThan(0);
    expect(atk.length).toBeGreaterThan(0);
    expect(atk[0]!.atS - tele[0]!.atS).toBeGreaterThanOrEqual(K.tentacle.telegraphS - SURVIVORS_STEP_S * 1.5);
    // El barco quieto, con el primer tentáculo encima: se moja una vez por salida, siempre tras un aviso.
    const hits = of(ev, 'bossHit').filter((e) => e.attack === TENTACLE_ATTACK);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.length).toBeLessThanOrEqual(tele.length);
    for (const h of hits) expect(tele.some((t) => t.atS < h.atS)).toBe(true);
    // Nada moja sin aviso: ningún golpe de contacto ni otro ataque.
    expect(of(ev, 'bossHit').filter((e) => e.attack !== TENTACLE_ATTACK)).toEqual([]);
  });

  it('un tentáculo arriba es blanco de las armas; tumbarlo expone la cabeza `exposeS` s y sólo entonces recibe daño', () => {
    const g = createSurvivors(quiet(), 6, openSea());
    g.spawnBoss('kraken', 0, 0);
    // Hasta que haya un tentáculo arriba.
    let up: { id: number; x: number; y: number; hp: number; maxHp: number } | null = null;
    for (let i = 0; i < Math.round(20 / SURVIVORS_STEP_S) && !up; i++) {
      g.step(IDLE);
      up = kraken(g)?.tentacles.find((t) => t.stage === 'up') ?? null;
    }
    expect(up).not.toBeNull();
    const b = body(g)!;
    expect(b.kraken!.mode).toBe('emerged');
    expect(b.kraken!.exposed).toBe(false);
    // La cabeza no: una llama corta sobre el cuerpo no le quita vida (los
    // tentáculos de al lado, si los toca, sí la sufren; corta, no los tumba).
    flame(g, b.x, b.y, 10, 0.01);
    expect(body(g)!.hp).toBe(b.maxHp);
    // El tentáculo sí: lo hiere y, al tumbarlo, la cabeza queda expuesta.
    expect(flame(g, up!.x, up!.y, 1, 0.01)).toBeGreaterThanOrEqual(1);
    g.step(IDLE);
    const t1 = kraken(g)!.tentacles.find((t) => t.id === up!.id)!;
    expect(t1.hp).toBeLessThan(t1.maxHp);
    g.flameBosses(up!.x, up!.y, 1, 1000);
    run(g, SURVIVORS_STEP_S);
    const k = kraken(g)!;
    expect(k.exposed).toBe(true);
    expect(k.exposedS).toBeGreaterThan(K.exposeS - SURVIVORS_STEP_S * 2);
    expect(k.tentacles.find((t) => t.id === up!.id)).toBeUndefined();
    expect(body(g)!.invulnerable).toBe(false);
    // Ahora la cabeza recibe daño.
    const before = body(g)!.hp;
    expect(flame(g, b.x, b.y, 10, 1)).toBeGreaterThanOrEqual(1);
    expect(body(g)!.hp).toBeLessThan(before);
    // La ventana se cierra (el cañón puede renovarla tumbando otro tentáculo:
    // se espera a que no quede ninguna) y vuelve a estar protegida; hundido, igual.
    for (let i = 0; i < Math.round(40 / SURVIVORS_STEP_S) && kraken(g)!.exposed; i++) g.step(IDLE);
    const b3 = body(g)!;
    expect(b3.kraken!.exposed).toBe(false);
    expect(b3.invulnerable).toBe(true);
    flame(g, b3.x, b3.y, 1, 0.01);
    expect(body(g)!.hp).toBe(b3.hp);
  });

  it('los sucesos de tentáculo: tumbar uno da `destroyed` y `krakenExposed`; las armas del barco lo tumban solas', () => {
    // El cañón de serie dispara al tentáculo (lo más cercano a tiro) y acaba tumbándolo.
    const g = createSurvivors(quiet((c) => (c.bosses.kraken!.kraken!.tentacle.hp = 10)), 8, openSea());
    g.spawnBoss('kraken', 0, 0);
    const ev = run(g, 25);
    const destroyed = of(ev, 'krakenTentacle').filter((e) => e.stage === 'destroyed');
    expect(destroyed.length).toBeGreaterThan(0);
    const exposed = of(ev, 'krakenExposed');
    expect(exposed.length).toBe(destroyed.length);
    expect(exposed[0]!.exposedS).toBeCloseTo(K.exposeS, 5);
    expect(of(ev, 'krakenTentacleHit').length).toBeGreaterThan(0);
    // Con la cabeza expuesta, el cañón también la hiere.
    expect(of(ev, 'bossDamaged').length).toBeGreaterThan(0);
  });

  it('en un archipiélago los tentáculos sólo salen del agua y el Kraken emerge en agua', () => {
    const g = createSurvivors(quiet(), 9, archipelago(3));
    g.spawnBoss('kraken', 300, 0);
    const ev = play(
      g,
      scriptedInput,
      (game) => {
        const b = body(game);
        if (b && b.kraken!.mode !== 'submerged') expect(game.onLand(b.x, b.y, b.radius)).toBe(false);
      },
      Math.round(40 / SURVIVORS_STEP_S),
    );
    const warnings = of(ev, 'krakenTentacle').filter((e) => e.stage === 'warning');
    expect(warnings.length).toBeGreaterThan(0);
    for (const w of warnings) expect(g.onLand(w.x, w.y, K.tentacle.radius)).toBe(false);
  });
});

// --- Agarre a islas y rocas ------------------------------------------------------------

describe('kraken T141: agarre y rocas', () => {
  /** Agarra desde la primera fase, para verlo pronto. */
  const grabby = (patch: (c: SurvivorsConfig) => void = () => {}) =>
    quiet((c) => {
      const k = c.bosses.kraken!.kraken!;
      k.phases = k.phases.map((p) => ({ ...p, grabs: true, rocks: Math.max(2, p.rocks) }));
      patch(c);
    });

  it('se agarra sólo a una isla al alcance: en mar abierto nunca; con una isla cerca sí; con la isla lejos no', () => {
    const states = (world: SurvivorsWorld, seconds: number) => {
      const g = createSurvivors(grabby(), 11, world);
      g.spawnBoss('kraken', 120, 0);
      const ev = run(g, seconds);
      return { ev, g };
    };
    // Mar abierto: tres salidas y ninguna agarrada.
    const open = states(openSea(), 45);
    expect(of(open.ev, 'krakenState').filter((e) => e.state === 'emerged').length).toBeGreaterThanOrEqual(2);
    expect(of(open.ev, 'krakenState').filter((e) => e.state === 'grabbing')).toEqual([]);
    expect(of(open.ev, 'krakenRock')).toEqual([]);
    // Isla al alcance: la primera salida es un agarre a esa isla (índice 0) y llueven rocas.
    const near = states(openSea([{ x: 420, y: 0, radius: 80 }]), 20);
    const grab = of(near.ev, 'krakenState').find((e) => e.state === 'grabbing');
    expect(grab).toBeDefined();
    expect(grab!.island).toBe(0);
    // (El `submerged` inicial lo da `spawnBoss`, fuera de `run`.)
    expect(of(near.ev, 'krakenState').map((e) => e.state).slice(0, 2)).toEqual(['emerging', 'grabbing']);
    expect(of(near.ev, 'krakenRock').filter((e) => e.stage === 'thrown').length).toBeGreaterThan(0);
    // Isla fuera de alcance (su borde a más de `grab.range` del Kraken): no se agarra.
    const far = states(openSea([{ x: 1400, y: 0, radius: 80 }]), 45);
    expect(of(far.ev, 'krakenState').filter((e) => e.state === 'grabbing')).toEqual([]);
    // Agarrado, está pegado al borde de la isla, en agua, y lo dice el snapshot.
    const g = createSurvivors(grabby(), 11, openSea([{ x: 420, y: 0, radius: 80 }]));
    g.spawnBoss('kraken', 120, 0);
    runUntil(g, 'grabbing', 20);
    const b = body(g)!;
    expect(b.kraken!.mode).toBe('grabbing');
    expect(b.kraken!.island).toBe(0);
    expect(Math.hypot(b.x - 420, b.y) - 80 - b.radius).toBeLessThan(12);
    expect(g.onLand(b.x, b.y, b.radius)).toBe(false);
  });

  it('cada roca avisa con su círculo de caída durante todo el vuelo y cae donde avisó; moja una por andanada', () => {
    const g = createSurvivors(grabby(), 12, openSea([{ x: 420, y: 0, radius: 80 }]));
    g.spawnBoss('kraken', 120, 0);
    let rocksInFlight = 0;
    const ev = play(
      g,
      () => IDLE,
      (game) => {
        const k = kraken(game);
        if (!k) return;
        const s = game.snapshot();
        for (const r of k.rocks) {
          rocksInFlight++;
          // Su círculo de caída está entre los avisos, en el punto de caída.
          const w = s.bossWarnings.find((w) => w.attack === ROCK_ATTACK && w.x === r.x && w.y === r.y);
          expect(w).toBeDefined();
          expect(w!.hit).toBe(false);
          expect(w!.radius).toBe(K.grab.rock.radius);
          expect(w!.progress).toBeCloseTo(r.progress, 9);
        }
      },
      Math.round(25 / SURVIVORS_STEP_S),
    );
    expect(rocksInFlight).toBeGreaterThan(0);
    const rocks = of(ev, 'krakenRock');
    const landed = rocks.filter((e) => e.stage === 'landed');
    expect(landed.length).toBeGreaterThan(0);
    for (const l of landed) {
      const t = rocks.find((e) => e.stage === 'thrown' && e.rock === l.rock)!;
      expect(t).toBeDefined();
      expect([l.x, l.y]).toEqual([t.x, t.y]);
      expect(l.atS - t.atS).toBeGreaterThanOrEqual(K.grab.rock.flightS - SURVIVORS_STEP_S * 1.5);
    }
    // Barco quieto, la primera roca de cada andanada encima: moja, una vez por andanada, tras su aviso.
    const tele = of(ev, 'bossTelegraph').filter((e) => e.attack === ROCK_ATTACK);
    const hits = of(ev, 'bossHit').filter((e) => e.attack === ROCK_ATTACK);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.length).toBeLessThanOrEqual(tele.length);
    for (const h of hits) expect(tele.some((t) => h.atS - t.atS >= K.grab.rock.flightS - SURVIVORS_STEP_S * 1.5)).toBe(true);
  });

  it('agarrado, la cabeza recibe daño (`grab.exposesHead`); sin esa regla, no', () => {
    const g = createSurvivors(grabby(), 13, openSea([{ x: 420, y: 0, radius: 80 }]));
    g.spawnBoss('kraken', 120, 0);
    runUntil(g, 'grabbing', 20);
    const b = body(g)!;
    expect(b.kraken!.exposed).toBe(K.grab.exposesHead);
    expect(b.invulnerable).toBe(!K.grab.exposesHead);
    const g2 = createSurvivors(grabby((c) => (c.bosses.kraken!.kraken!.grab.exposesHead = false)), 13, openSea([{ x: 420, y: 0, radius: 80 }]));
    g2.spawnBoss('kraken', 120, 0);
    runUntil(g2, 'grabbing', 20);
    const b2 = body(g2)!;
    expect(b2.kraken!.mode).toBe('grabbing');
    expect(b2.invulnerable).toBe(true);
    expect(flame(g2, b2.x, b2.y, 10, 1)).toBe(0);
  });

  it('las salidas se alternan: tras un agarre, la siguiente es de tentáculos aunque la isla siga al alcance', () => {
    const g = createSurvivors(grabby(), 14, openSea([{ x: 420, y: 0, radius: 80 }]));
    g.spawnBoss('kraken', 120, 0);
    const ev = run(g, 60);
    const outs = of(ev, 'krakenState')
      .map((e) => e.state)
      .filter((s) => s === 'grabbing' || s === 'emerged');
    expect(outs.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < outs.length; i++) if (outs[i - 1] === 'grabbing') expect(outs[i]).toBe('emerged');
  });
});

// --- Fases, derrota y la partida entera ------------------------------------------------

describe('kraken T141: fases, derrota y determinismo', () => {
  it('las fases pasan por vida y cambian los números (más tentáculos, agarres); al caer, el suceso de final', () => {
    const g = createSurvivors(quiet(), 15, openSea());
    g.spawnBoss('kraken', 0, 0);
    // Hasta tener la cabeza expuesta por un tentáculo.
    let exposed = false;
    for (let i = 0; i < Math.round(30 / SURVIVORS_STEP_S) && !exposed; i++) {
      g.step(IDLE);
      const k = kraken(g)!;
      const up = k.tentacles.find((t) => t.stage === 'up');
      if (up) g.flameBosses(up.x, up.y, 1, 1000);
      exposed = kraken(g)!.exposed;
    }
    expect(exposed).toBe(true);
    const b0 = body(g)!;
    expect(b0.phase).toBe(0);
    // La quema hasta el 50 %: fase 1 (más tentáculos y agarres).
    g.flameBosses(b0.x, b0.y, 1, (b0.maxHp * 0.5) / g.config.bossFight.flameDps);
    const ev1 = run(g, SURVIVORS_STEP_S);
    expect(of(ev1, 'bossPhase').map((e) => e.phase)).toEqual([1]);
    expect(body(g)!.phase).toBe(1);
    expect(K.phases[1]!.tentacles).toBeGreaterThan(K.phases[0]!.tentacles);
    expect(K.phases[1]!.grabs).toBe(true);
    expect(K.phases[0]!.grabs).toBe(false);
    // Le deja un punto (lo que pasa fuera de `step` no deja sucesos) y el cañón
    // del barco lo remata dentro de un paso en cuanto la cabeza vuelve a estar a tiro.
    const b1 = body(g)!;
    expect(b1.invulnerable).toBe(false);
    g.flameBosses(b1.x, b1.y, 1, (b1.hp - 1) / g.config.bossFight.flameDps);
    expect(body(g)!.hp).toBeCloseTo(1, 6);
    let defeated: Timed[] = [];
    for (let i = 0; i < Math.round(90 / SURVIVORS_STEP_S) && defeated.length === 0; i++) {
      const ev = run(g, SURVIVORS_STEP_S);
      defeated = of(ev, 'bossDefeated');
    }
    expect(defeated).toHaveLength(1);
    expect(defeated[0]).toMatchObject({ boss: 'kraken', kind: 'boss' });
    const s = g.snapshot();
    expect(s.finalBossDefeated).toBe(true);
    expect(s.bossesDefeated).toEqual(['kraken']);
    expect(s.bosses).toEqual([]);
    expect(s.bossWarnings).toEqual([]);
    // La nota grande cae; sin cofre (es un boss final).
    expect(s.notes.length).toBeGreaterThan(0);
    expect(s.chests).toEqual([]);
    // Después, nada del Kraken sigue sonando.
    const after = run(g, 3);
    expect(after.filter((e) => e.type.startsWith('kraken'))).toEqual([]);
  });

  it('al amanecer, un Kraken vivo se retira con lo suyo recogido', () => {
    const g = createSurvivors(act2(), 16, openSea(), { act: 2, startAtS: 410 });
    expect(body(g)!.boss).toBe('kraken');
    const ev = run(g, 12);
    expect(g.snapshot().end).toBe('survived');
    expect(of(ev, 'bossRetreated').map((e) => e.boss)).toEqual(['kraken']);
    expect(g.snapshot().bosses).toEqual([]);
    expect(g.snapshot().finalBossDefeated).toBe(false);
  });

  it('una partida entera del acto 2 es determinista y se ve el Kraken entero', () => {
    const go = (seed: number) => {
      const g = createSurvivors(act2(), seed, archipelago(7), { act: 2 });
      const hashes: string[] = [];
      const modes = new Set<KrakenMode>();
      let tentaclesSeen = 0;
      let rocksSeen = 0;
      let shadowSteps = 0;
      const events = play(g, scriptedInput, (game) => {
        const s = game.snapshot();
        if (Math.round(s.activeS * 60) % 1800 === 0) hashes.push(game.stateHash());
        const k = s.bosses.find((b) => b.boss === 'kraken')?.kraken;
        if (!k) return;
        modes.add(k.mode);
        tentaclesSeen += k.tentacles.length;
        rocksSeen += k.rocks.length;
        if (k.mode === 'submerged') shadowSteps++;
      });
      hashes.push(g.stateHash());
      return { hashes, events, modes, tentaclesSeen, rocksSeen, shadowSteps, s: g.snapshot() };
    };
    const a = go(31);
    const b = go(31);
    expect(b.hashes).toEqual(a.hashes);
    expect(a.hashes.length).toBeGreaterThan(10);
    expect(go(32).hashes.at(-1)).not.toBe(a.hashes.at(-1));
    // Insumergible: amanece, o vence al Kraken antes (T140: el boss final acaba la partida).
    expect(['survived', 'victory']).toContain(a.s.end);
    expect(a.s.act).toBe(2);
    // El Kraken entra una vez, en su hueco (los minibosses encendidos, T139, van aparte).
    const spawns = of(a.events, 'bossSpawn').filter((e) => e.boss === 'kraken');
    expect(spawns.length).toBe(1);
    expect(spawns[0]!.atS).toBeGreaterThanOrEqual(actOf(SURVIVORS_CONFIG, 2)!.events.find((e) => e.type === 'boss')!.atS);
    expect(a.shadowSteps).toBeGreaterThan(0);
    expect(a.modes.has('emerged')).toBe(true);
    expect(a.tentaclesSeen).toBeGreaterThan(0);
    // Cada tentáculo que sube avisó antes; cada roca que cae salió antes.
    const tents = of(a.events, 'krakenTentacle');
    for (const r of tents.filter((e) => e.stage === 'rise')) {
      const w = tents.find((e) => e.stage === 'warning' && e.tentacle === r.tentacle)!;
      expect(r.atS - w.atS).toBeGreaterThanOrEqual(K.tentacle.telegraphS - SURVIVORS_STEP_S * 1.5);
    }
    const rocks = of(a.events, 'krakenRock');
    for (const l of rocks.filter((e) => e.stage === 'landed')) {
      expect(rocks.some((e) => e.stage === 'thrown' && e.rock === l.rock && e.atS <= l.atS - K.grab.rock.flightS + SURVIVORS_STEP_S * 1.5)).toBe(true);
    }
    // Acaba vencido o retirado, nunca en el limbo.
    const kraken = (e: { boss: string }) => e.boss === 'kraken';
    expect(of(a.events, 'bossDefeated').filter(kraken).length + of(a.events, 'bossRetreated').filter(kraken).length).toBe(1);
    expect(a.s.bosses).toEqual([]);
  }, 120_000);

  it('el piloto cuenta los golpes del Kraken: a un barco quieto le llegan; el que esquiva puede librarse', () => {
    const idle = runBot(act2(), 'idle', 2, archipelago(5), { act: 2, startAtS: 329 }, 420);
    expect(idle.bossHits).toBeGreaterThan(0);
    expect(idle.hits).toBeGreaterThanOrEqual(idle.bossHits);
    const greedy = runBot(act2(), 'greedy', 2, archipelago(5), { act: 2, startAtS: 329 }, 420);
    expect(greedy.hits).toBeGreaterThanOrEqual(greedy.bossHits);
    expect(greedy.end).toBe('survived');
  }, 120_000);
});

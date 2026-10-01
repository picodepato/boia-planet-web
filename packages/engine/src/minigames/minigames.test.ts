import { parseWorldConfig } from '@boia/world';
import { describe, expect, it, vi } from 'vitest';
import {
  CANON_DEFAULTS,
  type CanonConfig,
  type CanonFoe,
  CanonSim,
  aimFromPull,
  ballAt,
  canon,
  canonMinPlausibleMs,
  canonMultiplier,
  canonPlan,
  canonShot,
  canonWave,
  powerFor,
  pullFor,
} from './canon';
import { MinigameController, STEP_S } from './controller';
import {
  COAST_Y,
  FARO_DEFAULTS,
  type FaroConfig,
  type FaroShip,
  FaroSim,
  LAMP,
  faro,
  faroMinPlausibleMs,
  faroMultiplier,
  faroPlan,
  faroWave,
} from './faro';
import { MINIGAME_REGISTRY } from './registry';
import { minigameSkin } from './skin';
import { type MinigameRewardSink, grantMinigameReward, policyText } from './rewards';
import { LocalSessionAuthority, type MinigameResult } from './session';
import { type Bot, canonExpert, canonWaster, faroExpert, playHeadless } from './testing';
import type { BaseConfig, MinigameDefinition, SimEvent } from './types';
import { MemoryStore } from '../ui/storage';
import { simulate } from '../world/simulate';

/** Reloj de la autoridad que avanza con la partida. */
function clock(start = Date.UTC(2026, 8, 29, 18)) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

function setup<C extends BaseConfig>(def: MinigameDefinition<C>, config?: C, seed = 7) {
  const c = clock();
  const granted: Parameters<MinigameRewardSink['grantWorldReward']>[0][] = [];
  const sink: MinigameRewardSink = {
    grantWorldReward: vi.fn(async (input) => {
      granted.push(input);
      return { granted: true };
    }),
  };
  const authority = new LocalSessionAuthority(c.now, () => seed);
  const records = new MemoryStore();
  const controller = new MinigameController({
    def,
    ...(config ? { config } : {}),
    authority,
    sink,
    records,
  });
  return { clock: c, sink, granted, authority, controller, records };
}

/** Avanza la simulación `seconds` s con la misma entrada (la acción, sólo en el primer paso). */
function run(sim: { step: (dt: number, i: object) => SimEvent[] }, seconds: number, input = {}) {
  const events: SimEvent[] = [];
  const steps = Math.round(seconds / STEP_S);
  for (let i = 0; i < steps; i++)
    events.push(...sim.step(STEP_S, i === 0 ? input : { ...input, action: false }));
  return events;
}

const faroWith = (patch: Partial<FaroConfig>): FaroConfig => ({ ...FARO_DEFAULTS, ...patch });
const canonWith = (patch: Partial<CanonConfig>): CanonConfig => ({ ...CANON_DEFAULTS, ...patch });

/** Pone un barco del faro justo en la línea del haz recto (ángulo 0), listo para navegar. */
function onBeam(sim: FaroSim, ship: FaroShip, y = 0.4) {
  ship.x0 = LAMP.x;
  ship.tx = LAMP.x;
  ship.x = LAMP.x;
  ship.y = y;
  ship.spawnAt = 0;
  ship.state = 'sailing';
  ship.speed = 0;
}

describe('registro de INICIAR_MINIJUEGO', () => {
  it('con el registro, el motor da `faro` y `canon` por disponibles y nada más', () => {
    expect([...MINIGAME_REGISTRY.keys()]).toEqual(['faro', 'canon']);
    const island = (id: string, x: number, gameId: string) => ({
      identity: { id, name: id, category: 'prueba' },
      appearance: { asset: 'placeholder:prueba' },
      position: { x, y: 900 },
      geometry: { activation: { shape: 'circle' as const, radius: 60 } },
      behaviors: [{ type: 'start_minigame' as const, params: { gameId } }],
    });
    const w = parseWorldConfig({
      id: 'prueba',
      version: 0,
      bounds: { left: 0, right: 4000, top: -20000, bottom: 4000 },
      objects: [
        island('faro', 500, 'faro'),
        island('canon', 1500, 'canon'),
        island('otro', 2500, 'otro'),
      ],
    });
    const seen = (x: number) =>
      simulate(w, {
        seconds: 3,
        start: { x, y: 1200 },
        input: () => ({ dirX: 0, dirY: -1, throttle: 1, drift: false }),
        minigames: MINIGAME_REGISTRY,
      }).events.filter((e) => e.type === 'minigame');
    expect(seen(500)).toEqual([
      { type: 'minigame', objectId: 'faro', gameId: 'faro', available: true },
    ]);
    expect(seen(1500)).toEqual([
      { type: 'minigame', objectId: 'canon', gameId: 'canon', available: true },
    ]);
    expect(seen(2500)).toEqual([
      { type: 'minigame', objectId: 'otro', gameId: 'otro', available: false },
    ]);
  });
});

describe('Vigilancia del faro (T60)', () => {
  const c = FARO_DEFAULTS;

  it('la misma semilla da las mismas oleadas; cada oleada trae más barcos', () => {
    const a = faroPlan(11, c);
    expect(faroPlan(11, c)).toEqual(a);
    expect(faroPlan(12, c)).not.toEqual(a);
    expect(a).toHaveLength(c.waves);
    a.forEach((wave, i) => expect(wave).toHaveLength(faroWave(c, i + 1).ships));
  });

  it('las oleadas van cada vez más rápidas y más apretadas', () => {
    for (let n = 1; n < c.waves; n++) {
      const now = faroWave(c, n);
      const next = faroWave(c, n + 1);
      expect(next.speed).toBeGreaterThan(now.speed);
      expect(next.intervalS).toBeLessThanOrEqual(now.intervalS);
      expect(next.ships).toBeGreaterThan(now.ships);
    }
    // En la partida: los barcos de la segunda oleada navegan más rápido que los de la primera.
    const { controller, clock: k } = setup(faro, faroWith({ waves: 2 }));
    playHeadless(controller, faroExpert, k.advance);
    const sim = controller.sim as FaroSim;
    expect(sim.wave).toBe(2);
    const base = (s: FaroShip) => s.speed / c.kinds[s.kind].speed;
    const w1 = sim.ships.filter((s) => s.wave === 1).map(base);
    const w2 = sim.ships.filter((s) => s.wave === 2).map(base);
    expect(Math.min(...w2)).toBeGreaterThan(Math.max(...w1));
  });

  it('la luz se acumula sobre un barco hasta descubrirlo, y se va apagando fuera del haz', () => {
    const sim = new FaroSim(3, c);
    const ship = sim.ships[0]!;
    onBeam(sim, ship);
    const spotS = c.kinds[ship.kind].spotS;
    run(sim, spotS - 4 * STEP_S);
    expect(sim.isLit(ship)).toBe(true);
    expect(ship.state).toBe('sailing');
    expect(ship.light).toBeGreaterThan(0.8);
    // Fuera del haz antes de llenarse, la luz baja.
    ship.light = 0.5;
    const lit = ship.light;
    run(sim, 0.4, { turn: 1 });
    expect(sim.isLit(ship)).toBe(false);
    expect(ship.light).toBeLessThan(lit);
    // De vuelta en el haz, se descubre: media vuelta y sus puntos.
    run(sim, 1, { aim: { x: ship.x, y: ship.y } });
    expect(ship.state).toBe('retreating');
    expect(sim.score).toBe(c.kinds[ship.kind].points);
  });

  it('la racha multiplica los puntos y se rompe al perder una vida', () => {
    expect([0, 3, 4, 7, 8, 12, 40].map((s) => faroMultiplier(c, s))).toEqual([1, 1, 2, 2, 3, 4, 4]);
    const sim = new FaroSim(3, c);
    const [a, b] = sim.ships;
    sim.streak = c.combo.every;
    onBeam(sim, a!);
    const events = run(sim, 1.2);
    expect(events.find((e) => e.kind === 'hit')).toMatchObject({
      points: c.kinds[a!.kind].points * 2,
      combo: 2,
    });
    expect(sim.streak).toBe(c.combo.every + 1);
    // Un pirata que toca costa: una vida menos y la racha a cero.
    b!.state = 'sailing';
    b!.x0 = b!.tx = 0.05;
    b!.y = COAST_Y - 0.0001;
    const lost = run(sim, STEP_S);
    expect(lost.map((e) => e.kind)).toContain('escape');
    expect(sim.lives).toBe(c.lives - 1);
    expect(sim.streak).toBe(0);
  });

  it('el DESTELLO descubre a todos los del cono ancho, uno por oleada', () => {
    const sim = new FaroSim(5, c);
    const [a, b] = sim.ships;
    for (const [s, x] of [
      [a!, 0.35],
      [b!, 0.62],
    ] as const) {
      onBeam(sim, s, 0.3);
      s.x0 = s.tx = s.x = x;
    }
    expect(sim.isLit(a!) || sim.isLit(b!)).toBe(false);
    expect(sim.flashes).toBe(1);
    const events = sim.step(STEP_S, { action: true });
    expect(events.filter((e) => e.kind === 'hit')).toHaveLength(2);
    expect([a!.state, b!.state]).toEqual(['retreating', 'retreating']);
    expect(sim.flashes).toBe(0);
    // Sin destellos, el botón sólo avisa.
    const score = sim.score;
    expect(sim.step(STEP_S, { action: true }).map((e) => e.kind)).toContain('false_alarm');
    expect(sim.score).toBe(score);
  });

  it('las vidas acaban la partida: sin vigilar, los piratas tocan costa', async () => {
    const { controller, clock: k, sink } = setup(faro);
    controller.start();
    const escapes: SimEvent[] = [];
    while (controller.phase === 'playing') {
      k.advance(1000 / 60);
      escapes.push(...controller.tick(STEP_S, {}).filter((e) => e.kind === 'escape'));
    }
    const sim = controller.sim as FaroSim;
    expect(sim.ended).toMatchObject({ reason: 'lives' });
    expect(sim.lives).toBe(0);
    expect(escapes).toHaveLength(c.lives);
    expect(sim.ships.filter((s) => s.state === 'landed')).toHaveLength(c.lives);
    if (sim.score < c.goal) {
      expect(sim.ended?.outcome).toBe('lost');
      expect((await controller.settling!).reward).toEqual({ granted: false, reason: 'not_won' });
      expect(sink.grantWorldReward).not.toHaveBeenCalled();
    }
  });

  it('se gana el premio con la marca del objetivo, y la partida sigue hasta el final', async () => {
    const { controller, granted, clock: k } = setup(faro);
    playHeadless(controller, faroExpert, k.advance);
    const sim = controller.sim as FaroSim;
    expect(sim.ended).toEqual({ outcome: 'won', reason: 'waves' });
    expect(sim.wave).toBe(c.waves);
    expect(sim.score).toBeGreaterThan(c.goal);
    const s = await controller.settling!;
    expect(s.validation).toEqual({ valid: true });
    expect(s.reward).toEqual({ granted: true, points: c.reward.points, coins: c.reward.coins });
    expect(granted[0]).toMatchObject({ sourceRef: 'minigame:faro', policy: c.reward.policy });
  });

  it('acabar las oleadas sin llegar al objetivo no da premio', () => {
    const { controller, clock: k } = setup(faro, faroWith({ waves: 1, goal: 100_000 }));
    playHeadless(controller, faroExpert, k.advance);
    expect(controller.sim?.ended).toEqual({ outcome: 'lost', reason: 'waves' });
  });
});

describe('Cañón contra tiburones (T60)', () => {
  const c = CANON_DEFAULTS;

  /** Un cañón sin oleada: sólo los intrusos que se pongan a mano. */
  function emptySim(config = c): CanonSim {
    const sim = new CanonSim(1, config);
    sim.foes.length = 0;
    return sim;
  }

  function place(sim: CanonSim, kind: CanonFoe['kind'], x: number): CanonFoe {
    const f: CanonFoe = {
      id: 100 + sim.foes.length,
      wave: 1,
      kind,
      spawnAt: 0,
      x,
      speed: 0,
      hp: kind === 'pirate' ? c.pirate.hp : 1,
      submerged: false,
      diveTimer: 999,
      state: 'swimming',
    };
    sim.foes.push(f);
    return f;
  }

  /** Dispara con este ángulo y esta potencia y espera a que la bola caiga. */
  function shoot(sim: CanonSim, angle: number, power: number): SimEvent[] {
    const events = sim.step(STEP_S, { pull: pullFor(angle, power, c), action: true });
    while (sim.balls.length) events.push(...sim.step(STEP_S, {}));
    events.push(...run(sim, c.reloadS));
    return events;
  }

  it('el arrastre da el ángulo (dirección) y la potencia (longitud)', () => {
    for (const [angle, power] of [
      [0.3, 0.4],
      [0.8, 1],
      [1.2, 0.2],
    ] as const) {
      const a = aimFromPull(pullFor(angle, power, c), c);
      expect(a.angle).toBeCloseTo(angle, 9);
      expect(a.power).toBeCloseTo(power, 9);
    }
    // Hacia atrás o hacia abajo, se queda en los topes.
    expect(aimFromPull({ x: -0.1, y: -0.3 }, c).angle).toBe(c.angleMax);
    expect(aimFromPull({ x: 0.3, y: 0.2 }, c).angle).toBe(c.angleMin);
    expect(aimFromPull({ x: 3, y: 0 }, c).power).toBe(1);
  });

  it('la bola vuela en parábola y cae, con el ángulo y la potencia calculados, sobre el tiburón', () => {
    for (const [angle, targetX] of [
      [0.6, 0.65],
      [0.35, 0.4],
      [1.1, 0.9],
    ] as const) {
      const power = powerFor(angle, targetX, c)!;
      expect(power).not.toBeNull();
      const shot = canonShot(angle, power, c);
      expect(shot.landX).toBeCloseTo(targetX, 9);
      // Una parábola: aceleración constante hacia abajo (segunda diferencia = g·dt²).
      const dt = shot.tLand / 10;
      const ys = [3, 4, 5].map((i) => ballAt(shot, i * dt, c).y);
      expect(ys[0]! - 2 * ys[1]! + ys[2]!).toBeCloseTo(c.gravity * dt * dt, 9);

      const sim = emptySim();
      const shark = place(sim, 'shark', targetX);
      const events = shoot(sim, angle, power);
      expect(sim.angle).toBeCloseTo(angle, 9);
      expect(sim.power).toBeCloseTo(power, 9);
      const splash = events.find((e) => e.kind === 'splash')!;
      expect(splash.x).toBeCloseTo(targetX, 2);
      expect(shark.state).toBe('fleeing');
      expect(sim.score).toBe(c.shark.points);
    }
  });

  it('un tiro desviado cae al agua; un tiburón sumergido no se entera', () => {
    const sim = emptySim();
    const shark = place(sim, 'shark', 0.6);
    const off = powerFor(0.6, 0.6 + c.splashRadius + c.shark.radius + 0.05, c)!;
    expect(shoot(sim, 0.6, off).map((e) => e.kind)).toContain('miss');
    expect(shark.state).toBe('swimming');
    shark.submerged = true;
    shoot(sim, 0.6, powerFor(0.6, 0.6, c)!);
    expect(shark.state).toBe('swimming');
    expect(sim.score).toBe(0);
    expect(Object.keys(shark).some((k) => /herid|wound|health/i.test(k))).toBe(false);
  });

  it('el combo multiplica los puntos de los aciertos seguidos y un fallo lo pone a cero', () => {
    expect([0, 1, 2, 3, 9].map((n) => canonMultiplier(c, n))).toEqual([1, 2, 3, 4, 4]);
    const sim = emptySim();
    const xs = [0.4, 0.55, 0.7];
    for (const x of xs) place(sim, 'shark', x);
    const gained: number[] = [];
    for (const x of xs) {
      const before = sim.score;
      shoot(sim, 0.7, powerFor(0.7, x, c)!);
      gained.push(sim.score - before);
    }
    expect(gained).toEqual([1, 2, 3].map((m) => c.shark.points * m));
    expect(sim.combo).toBe(3);
    // Un fallo: combo a cero; el siguiente acierto vuelve a valer x1.
    shoot(sim, 0.7, powerFor(0.7, 0.95, c)!);
    expect(sim.combo).toBe(0);
    place(sim, 'shark', 0.5);
    const before = sim.score;
    shoot(sim, 0.7, powerFor(0.7, 0.5, c)!);
    expect(sim.score - before).toBe(c.shark.points);
  });

  it('a un pirata hay que darle dos veces; el segundo impacto va con combo', () => {
    const sim = emptySim();
    const pirate = place(sim, 'pirate', 0.7);
    const p = powerFor(0.5, 0.7, c)!;
    shoot(sim, 0.5, p);
    expect(pirate.state).toBe('swimming');
    expect(pirate.hp).toBe(c.pirate.hp - 1);
    expect(sim.score).toBe(c.pirate.hitPoints);
    shoot(sim, 0.5, powerFor(0.5, pirate.x, c)!);
    expect(pirate.state).toBe('fleeing');
    expect(sim.score).toBe(c.pirate.hitPoints + c.pirate.points * 2);
  });

  it('las oleadas van cada vez más rápidas, con más intrusos y piratas desde la segunda', () => {
    for (let n = 1; n < c.waves; n++) {
      expect(canonWave(c, n + 1).speed).toBeGreaterThan(canonWave(c, n).speed);
      expect(canonWave(c, n + 1).foes).toBeGreaterThan(canonWave(c, n).foes);
    }
    const plan = canonPlan(4, c);
    expect(plan[0]!.every((f) => f.kind === 'shark')).toBe(true);
    expect(plan.flat().some((f) => f.kind === 'pirate')).toBe(true);
    const { controller, clock: k } = setup(canon, canonWith({ waves: 2 }));
    playHeadless(controller, canonExpert, k.advance);
    const sim = controller.sim as CanonSim;
    expect(sim.wave).toBe(2);
    const sharks = (w: number) => sim.foes.filter((f) => f.wave === w && f.kind === 'shark');
    expect(sharks(2)[0]!.speed).toBeGreaterThan(sharks(1)[0]!.speed);
  });

  it('las vidas acaban la partida: cada intruso que llega a la playa se lleva una', async () => {
    const { controller, clock: k } = setup(canon);
    controller.start();
    const escapes: SimEvent[] = [];
    while (controller.phase === 'playing') {
      k.advance(1000 / 60);
      escapes.push(...controller.tick(STEP_S, {}).filter((e) => e.kind === 'escape'));
    }
    const sim = controller.sim as CanonSim;
    expect(sim.ended).toEqual({ outcome: 'lost', reason: 'lives' });
    expect(sim.lives).toBe(0);
    expect(escapes).toHaveLength(c.lives);
    expect((await controller.settling!).reward).toEqual({ granted: false, reason: 'not_won' });
  });

  it('se gana el premio con la marca del objetivo; disparar al agua no puntúa', async () => {
    const won = setup(canon);
    playHeadless(won.controller, canonExpert, won.clock.advance);
    expect(won.controller.sim?.ended).toEqual({ outcome: 'won', reason: 'waves' });
    expect(won.controller.sim!.score).toBeGreaterThan(c.goal);
    expect((await won.controller.settling!).reward.granted).toBe(true);

    const waste = setup(canon);
    playHeadless(waste.controller, canonWaster, waste.clock.advance);
    expect(waste.controller.sim?.ended).toEqual({ outcome: 'lost', reason: 'lives' });
    expect(waste.controller.sim!.score).toBe(0);
  });
});

describe('sesión, semilla y duración (REQ-AVE-038)', () => {
  function forged(
    session: { id: string; seed: number; configHash: string },
    patch: Partial<MinigameResult> = {},
  ): MinigameResult {
    return {
      sessionId: session.id,
      gameId: 'faro',
      version: FARO_DEFAULTS.version,
      seed: session.seed,
      configHash: session.configHash,
      outcome: 'won',
      reason: 'lives',
      score: FARO_DEFAULTS.goal,
      elapsedMs: 1500,
      ...patch,
    };
  }

  it('una semilla repetida con una duración imposible no concede nada', async () => {
    const c = clock();
    const authority = new LocalSessionAuthority(c.now, () => 42);
    const sink: MinigameRewardSink = { grantWorldReward: vi.fn(async () => ({ granted: true })) };
    const session = authority.open(faro, FARO_DEFAULTS);
    const min = faroMinPlausibleMs(FARO_DEFAULTS.goal, 42, FARO_DEFAULTS);
    expect(min).toBeGreaterThan(1000);
    c.advance(FARO_DEFAULTS.timeLimitS * 1000);
    // La misma semilla, la marca del premio, pero en menos tiempo del posible.
    const result = forged(session, { elapsedMs: min / 2 });
    const v = authority.settle(result);
    expect(v).toEqual({ valid: false, reason: 'implausible_duration' });
    expect(await grantMinigameReward(sink, FARO_DEFAULTS.reward, result, v)).toEqual({
      granted: false,
      reason: 'implausible_duration',
    });
    // Repetir la misma sesión, ahora con una duración posible, tampoco.
    const again = authority.settle(forged(session, { elapsedMs: min + 1000 }));
    expect(again).toEqual({ valid: false, reason: 'replayed' });
    // Y la semilla en otra sesión no sirve: cada sesión tiene la suya.
    const other = new LocalSessionAuthority(c.now, () => 43).open(faro, FARO_DEFAULTS);
    expect(authority.settle(forged(session, { sessionId: other.id }))).toEqual({
      valid: false,
      reason: 'unknown_session',
    });
    expect(sink.grantWorldReward).not.toHaveBeenCalled();
  });

  it('no se juega más rápido que el reloj ni más que el límite', () => {
    const c = clock();
    const authority = new LocalSessionAuthority(c.now, () => 42);
    const min = faroMinPlausibleMs(FARO_DEFAULTS.goal, 42, FARO_DEFAULTS);
    const s1 = authority.open(faro, FARO_DEFAULTS);
    c.advance(2000);
    expect(authority.settle(forged(s1, { elapsedMs: min + 100 }))).toEqual({
      valid: false,
      reason: 'implausible_duration',
    });
    const s2 = authority.open(faro, FARO_DEFAULTS);
    c.advance(FARO_DEFAULTS.timeLimitS * 3000);
    expect(authority.settle(forged(s2, { elapsedMs: FARO_DEFAULTS.timeLimitS * 2000 }))).toEqual({
      valid: false,
      reason: 'implausible_duration',
    });
    const s3 = authority.open(faro, FARO_DEFAULTS);
    c.advance(min + 5000);
    expect(authority.settle(forged(s3, { elapsedMs: min + 100 }))).toEqual({ valid: true });
  });

  it('otra semilla, otra versión o una marca que no casa con el final no valen', () => {
    const c = clock();
    const authority = new LocalSessionAuthority(c.now, () => 42);
    const ok = { elapsedMs: FARO_DEFAULTS.timeLimitS * 900 };
    c.advance(FARO_DEFAULTS.timeLimitS * 1000);
    const s = () => authority.open(faro, FARO_DEFAULTS);
    expect(authority.settle(forged(s(), { ...ok, seed: 41 })).valid).toBe(false);
    expect(authority.settle(forged(s(), { ...ok, version: 99 })).valid).toBe(false);
    // «Ganada» sin la marca, o «perdida» con ella.
    expect(authority.settle(forged(s(), { ...ok, score: 2 }))).toEqual({
      valid: false,
      reason: 'implausible_score',
    });
    expect(authority.settle(forged(s(), { ...ok, outcome: 'lost' }))).toEqual({
      valid: false,
      reason: 'implausible_score',
    });
    expect(authority.settle(forged(s(), { ...ok, score: 10.5, outcome: 'lost' }))).toEqual({
      valid: false,
      reason: 'implausible_score',
    });
  });

  it('una partida real dura al menos el mínimo de su semilla', () => {
    const short = faroWith({ waves: 4 });
    const shortCanon = canonWith({ waves: 4 });
    for (const seed of [1, 2, 3]) {
      const f = setup(faro, short, seed);
      playHeadless(f.controller, faroExpert, f.clock.advance);
      expect(f.controller.sim!.score).toBeGreaterThan(0);
      expect(f.controller.sim!.time * 1000).toBeGreaterThanOrEqual(
        faroMinPlausibleMs(f.controller.sim!.score, seed, short),
      );
      const k = setup(canon, shortCanon, seed);
      playHeadless(k.controller, canonExpert, k.clock.advance);
      expect(k.controller.sim!.score).toBeGreaterThan(0);
      expect(k.controller.sim!.time * 1000).toBeGreaterThanOrEqual(
        canonMinPlausibleMs(k.controller.sim!.score, seed, shortCanon),
      );
    }
  });

  it('ocultar la pestaña, abandonar, recargar o cambiar la configuración invalidan la marca', async () => {
    // Ocultar: la partida se pausa, puede seguir, pero no da premio.
    const hidden = setup(faro);
    hidden.controller.start();
    hidden.controller.pause('hidden');
    expect(hidden.controller.phase).toBe('paused');
    expect(hidden.controller.counts()).toBe(false);
    hidden.controller.resume();
    playHeadless(hidden.controller, faroExpert, hidden.clock.advance);
    const h = await hidden.controller.settling!;
    expect(h.ending.outcome).toBe('won');
    expect(h.reward).toEqual({ granted: false, reason: 'hidden' });
    expect(hidden.sink.grantWorldReward).not.toHaveBeenCalled();

    // Abandonar: la sesión queda marcada.
    const left = setup(canon);
    left.controller.start();
    const id = left.controller.session!.id;
    left.controller.abandon();
    expect(left.authority.isValid(id)).toBe(false);

    // Recargar: una autoridad nueva no conoce la sesión.
    const reloaded = new LocalSessionAuthority();
    expect(reloaded.settle({ ...forged({ id, seed: 1, configHash: 'x' }) })).toEqual({
      valid: false,
      reason: 'unknown_session',
    });

    // Cambiar la configuración a mitad de partida.
    const c = clock();
    const authority = new LocalSessionAuthority(c.now, () => 7);
    let live: FaroConfig = faroWith({ waves: 2 });
    const ctl = new MinigameController({
      def: faro,
      config: live,
      authority,
      currentConfig: () => live,
    });
    ctl.start();
    live = faroWith({ waves: 2, goal: 2 });
    playHeadless(ctl, faroExpert, c.advance);
    expect((await ctl.settling!).validation).toEqual({ valid: false, reason: 'config_changed' });
  });

  it('la pausa no cuenta como tiempo de juego', () => {
    const { controller } = setup(canon);
    controller.start();
    controller.tick(0.5, {});
    const t = controller.sim!.time;
    controller.pause('user');
    controller.tick(0.5, {});
    expect(controller.sim!.time).toBe(t);
    controller.resume();
    controller.tick(0.1, {});
    expect(controller.sim!.time).toBeGreaterThan(t);
  });

  it('los límites de la regla acotan puntos y monedas; «sólo marca» no concede', async () => {
    const sink: MinigameRewardSink = { grantWorldReward: vi.fn(async () => ({ granted: true })) };
    const result = forged({ id: 'x', seed: 1, configHash: 'h' });
    const rule = { ...FARO_DEFAULTS.reward, points: 999, coins: 999 };
    expect(await grantMinigameReward(sink, rule, result, { valid: true })).toEqual({
      granted: true,
      points: rule.maxPoints,
      coins: rule.maxCoins,
    });
    expect(
      await grantMinigameReward(sink, { ...rule, policy: 'record_only' }, result, { valid: true }),
    ).toEqual({ granted: false, reason: 'record_only' });
    expect(policyText(FARO_DEFAULTS.reward, FARO_DEFAULTS.goal)).toContain(
      String(FARO_DEFAULTS.goal),
    );
  });

  it('la marca personal se guarda en el dispositivo y sólo sube con partidas válidas', async () => {
    const a = setup(canon, canonWith({ waves: 2 }));
    playHeadless(a.controller, canonExpert, a.clock.advance);
    const first = await a.controller.settling!;
    expect(first.newBest).toBe(true);
    expect(first.best).toBe(a.controller.sim!.score);
    // Una peor no la baja.
    a.controller.start();
    while (a.controller.phase === 'playing') {
      a.clock.advance(1000 / 60);
      a.controller.tick(STEP_S, {});
    }
    const second = await a.controller.settling!;
    expect(second.newBest).toBe(false);
    expect(second.best).toBe(first.score);
  });
});

describe('dibujo en el estilo de cada mundo', () => {
  /** Un contexto 2D que acepta cualquier llamada y cuenta los trazos. */
  function fakeCtx() {
    let calls = 0;
    const target: Record<string, unknown> = {};
    const ctx: unknown = new Proxy(target, {
      get(t, key) {
        if (typeof key === 'string' && key in t) return t[key];
        return () => {
          calls++;
          return { addColorStop: () => {} };
        };
      },
      set(t, key, value) {
        if (typeof key === 'string') t[key] = value;
        return true;
      },
    });
    return { ctx: ctx as CanvasRenderingContext2D, calls: () => calls };
  }

  const theme = {
    sea: { base: '#112233', wave: '#223344', crest: '#ffffff' },
    ui: { accent: '#ff0000', onAccent: '#000000' },
  };

  it.each(['arcilla', 'acuarela', 'otro'])(
    '%s: los dos juegos se pintan de principio a fin',
    (worldId) => {
      const skin = minigameSkin(worldId, theme);
      const games = [
        [faro, faroWith({ waves: 2 }), faroExpert],
        [canon, canonWith({ waves: 2 }), canonExpert],
      ] as const;
      for (const [def, config, bot] of games) {
        for (const reducedMotion of [false, true]) {
          const { controller, clock: c } = setup(
            def as unknown as MinigameDefinition<BaseConfig>,
            config as BaseConfig,
          );
          controller.start();
          for (let i = 0; controller.phase === 'playing'; i++) {
            c.advance(1000 / 60);
            controller.tick(1 / 60, (bot as Bot)(controller.sim!));
            if (i % 15) continue;
            const f = fakeCtx();
            controller.sim!.draw(f.ctx, 360, 520, skin, { reducedMotion, clock: i / 60 });
            expect(f.calls()).toBeGreaterThan(20);
          }
          expect(controller.phase).toBe('ended');
        }
      }
    },
  );

  it('Arcilla y Acuarela tienen su estilo; otro mundo toma su mar y su acento', () => {
    expect(minigameSkin('arcilla').style).toBe('clay');
    expect(minigameSkin('acuarela').style).toBe('wash');
    expect(minigameSkin('otro', theme)).toMatchObject({
      style: 'plain',
      sea: theme.sea.base,
      accent: theme.ui.accent,
    });
  });
});

describe('textos de cada juego', () => {
  it('cada evento con aviso tiene texto; los finales dicen por qué acabó', () => {
    for (const def of [faro, canon] as unknown as MinigameDefinition<BaseConfig>[]) {
      expect(def.hint).not.toBe('');
      expect(def.feedback({ kind: 'escape' })?.tone).toBe('bad');
      expect(def.feedback({ kind: 'wave', wave: 2 })?.text).toContain('2');
      for (const reason of ['lives', 'waves', 'time'] as const) {
        expect(def.endText({ outcome: 'lost', reason })).not.toBe('');
      }
    }
    expect(faro.feedback({ kind: 'hit', points: 30, combo: 2 })?.text).toContain('x2');
    expect(canon.feedback({ kind: 'scare', points: 10, combo: 1 })?.text).toContain('+10');
  });
});

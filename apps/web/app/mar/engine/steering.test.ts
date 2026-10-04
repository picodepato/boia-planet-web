import { CircuitRace, circuitFromWorld } from '@boia/engine/circuit';
import {
  DEFAULT_SHIP_CONFIG,
  type ShipConfig,
  type ShipInput,
  type ShipState,
  WorldRuntime,
  createShipState,
  shipSpeed,
  stepShip,
} from '@boia/engine/headless';
import { SURVIVORS_CONFIG, survivorsShipConfig } from '@boia/engine/survivors';
import { CIRCUIT_ID, WORLD_REGISTRY, type WorldObjectInput, parseWorldConfig } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { marWorld } from './compact';
import {
  MAR_SHIP_CONFIG,
  MAR_STICK,
  RACE_MAX_SPEED,
  RACE_SHIP_CONFIG,
  type ShipEffects,
  ShipHandling,
  TURBO_SPEED,
  VOYAGE_SPEED,
  baseShipConfig,
  boostedConfig,
  stepShipConfig,
  stickInput,
} from './steering';

const spec = circuitFromWorld(
  marWorld(WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config),
  CIRCUIT_ID,
)!;

const DT = 1 / 60;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * /mar antes de T54: la física por defecto con el radio de choque de /mar y
 * el joystick de entonces (zona muerta 8 px, acelerador (len − 8) / 56, sin
 * sensibilidad).
 */
const OLD_CFG: ShipConfig = { ...DEFAULT_SHIP_CONFIG, radius: 18 };
function oldStick(dx: number, dy: number): ShipInput {
  const len = Math.hypot(dx, dy);
  return { dirX: dx, dirY: dy, throttle: Math.min(1, (len - 8) / 56), drift: false };
}

/** Segundos hasta que el rumbo llega (±0,01 rad) a `target`; Infinity si no llega en 60 s. */
function timeToHeading(cfg: ShipConfig, input: ShipInput, target: number): number {
  const s = createShipState(0, 0, 0);
  for (let t = 0; t < 60; t += DT) {
    if (Math.abs(wrap(target - s.heading)) < 0.01) return t;
    stepShip(s, input, cfg, DT);
  }
  return Infinity;
}

interface Turn {
  /** Separación máxima de la línea de partida (u): el diámetro de la vuelta. */
  width: number;
  /** Segundos hasta dar la vuelta (180°). */
  time: number;
}

/**
 * Vuelta de 180° desde el crucero a `speed` u/s con rumbo este. `reverse`:
 * el joystick a fondo hacia atrás (oeste); si no, a fondo hacia un lado del
 * rumbo (la vuelta hacia delante de siempre), hasta haber girado 180°.
 */
function uTurn(cfg: ShipConfig, speed: number, reverse: boolean): Turn {
  const s = createShipState(0, 0, 0);
  s.vx = speed;
  let turned = 0;
  let width = 0;
  for (let t = 0; t < 30; t += DT) {
    // Ligeramente a la derecha de la popa: elige el lado del giro.
    const a = reverse ? Math.PI - 0.02 : s.heading + Math.PI / 2;
    const before = s.heading;
    stepShip(s, { dirX: Math.cos(a), dirY: Math.sin(a), throttle: 1, drift: false }, cfg, DT);
    turned += wrap(s.heading - before);
    width = Math.max(width, Math.abs(s.y));
    if (turned >= Math.PI - 0.03) return { width, time: t + DT };
  }
  throw new Error('no da la vuelta');
}

/** Radio de giro instantáneo (u) a `speed` u/s, con el joystick a fondo a `side` rad del rumbo. */
function turnRadius(cfg: ShipConfig, speed: number, side: number): number {
  const s = createShipState(0, 0, 0);
  s.vx = speed;
  stepShip(s, { dirX: Math.cos(side), dirY: Math.sin(side), throttle: 1, drift: false }, cfg, DT);
  return speed / (Math.abs(s.heading) / DT);
}

describe('gobierno del barco en /mar (T54)', () => {
  it('con un arrastre pequeño (justo pasada la zona muerta) gira 90° mucho antes que antes', () => {
    const drag = MAR_STICK.deadZone + 4;
    const now = stickInput(0, drag);
    expect(now).not.toBeNull();
    const before = timeToHeading(OLD_CFG, oldStick(0, drag), Math.PI / 2);
    const after = timeToHeading(MAR_SHIP_CONFIG, now!, Math.PI / 2);
    expect(after).toBeLessThan(before / 4);
    expect(after).toBeLessThan(1.5);
  });

  it('dentro de la zona muerta no hay entrada', () => {
    expect(stickInput(MAR_STICK.deadZone, 0)).toBeNull();
    expect(stickInput(0, MAR_STICK.deadZone + 1)?.throttle).toBeGreaterThan(0);
  });

  it('tirar hacia atrás yendo hacia delante da una vuelta más corta y más rápida', () => {
    const v = MAR_SHIP_CONFIG.maxSpeed;
    const forward = uTurn(MAR_SHIP_CONFIG, v, false);
    const reverse = uTurn(MAR_SHIP_CONFIG, v, true);
    expect(reverse.width).toBeLessThan(forward.width * 0.8);
    expect(reverse.time).toBeLessThan(forward.time);
    // Y más cerrada que la vuelta hacia atrás de antes.
    expect(reverse.width).toBeLessThan(uTurn(OLD_CFG, v, true).width * 0.6);
  });

  it('el turbo y el viaje no abren el círculo de giro', () => {
    const cruise = MAR_SHIP_CONFIG.maxSpeed;
    for (const k of [TURBO_SPEED, VOYAGE_SPEED]) {
      const cfg = boostedConfig(MAR_SHIP_CONFIG, k);
      // El radio de giro (velocidad / giro por segundo) a fondo hacia un lado
      // o hacia atrás es el mismo a la velocidad del turbo que a la de crucero.
      for (const side of [Math.PI / 2, Math.PI - 0.02]) {
        expect(turnRadius(cfg, cfg.maxSpeed, side)).toBeLessThanOrEqual(
          turnRadius(MAR_SHIP_CONFIG, cruise, side) * 1.001,
        );
      }
      // La vuelta entera: casi la de crucero (el turbo frena desde más
      // arriba), mucho más cerrada que la del turbo de antes, y tirar hacia
      // atrás sigue cerrándola.
      const fwd = uTurn(cfg, cfg.maxSpeed, false).width;
      expect(fwd).toBeLessThan(uTurn(MAR_SHIP_CONFIG, cruise, false).width * 1.05);
      const old = boostedConfig(OLD_CFG, k);
      expect(fwd).toBeLessThan(uTurn(old, old.maxSpeed, false).width * 0.6);
      expect(uTurn(cfg, cfg.maxSpeed, true).width).toBeLessThan(fwd);
    }
    // Sin `turnRadius` (antes) el turbo sí lo abría: la prueba mide algo.
    const old = boostedConfig(OLD_CFG, TURBO_SPEED);
    expect(turnRadius(old, old.maxSpeed, Math.PI / 2)).toBeGreaterThan(
      turnRadius(OLD_CFG, OLD_CFG.maxSpeed, Math.PI / 2) * 1.5,
    );
  });

  it('la sensibilidad táctil llega al barco como turnScale', () => {
    expect(stickInput(0, 40, 1.3)?.turnScale).toBe(1.3);
    const turned = (scale: number) => {
      const s = createShipState(0, 0, 0);
      s.vx = MAR_SHIP_CONFIG.maxSpeed;
      stepShip(s, stickInput(0, 40, scale)!, MAR_SHIP_CONFIG, DT);
      return s.heading;
    };
    expect(turned(1.5)).toBeGreaterThan(turned(1));
    expect(turned(0.5)).toBeLessThan(turned(1));
  });
});

it('T99: crucero base de 15 nudos; turbo conserva su multiplicador', () => {
  const ship = createShipState(0, 0, 0);
  const input: ShipInput = { dirX: 1, dirY: 0, throttle: 1, drift: false };
  expect(MAR_SHIP_CONFIG.maxSpeed).toBe(150);
  for (let i = 0; i < 180; i++) stepShip(ship, input, MAR_SHIP_CONFIG, DT);
  expect(Math.hypot(ship.vx, ship.vy) / 10).toBeCloseTo(15);
  const turbo = boostedConfig(MAR_SHIP_CONFIG, TURBO_SPEED);
  for (let i = 0; i < 180; i++) stepShip(ship, input, turbo, DT);
  expect(Math.hypot(ship.vx, ship.vy) / 10).toBeCloseTo(24);
});

/** La física de /mar a 22 nudos, congelada como estaba antes de T99. */
const HISTORICAL_22KN: ShipConfig = {
  maxSpeed: 220,
  acceleration: 240,
  brakeDeceleration: 170,
  turnRate: 3.4,
  minTurnFactor: 0.75,
  lateralGrip: 6,
  gripToForward: 0.8,
  drift: { turnMultiplier: 1.8, lateralGrip: 1.1, gripToForward: 0.35 },
  radius: 18,
  wallRestitution: 0.15,
  obstacleRestitution: 0.45,
  openEdgeCurrent: 260,
  openEdgeSoftZone: 200,
  steerFloor: 0.8,
  turnRadius: 220 / 3.4,
  reverseTurn: { turnBoost: 1.9, brake: 520 },
};

it('T99: preserves turn times and proportional distances against the frozen 22-knot configuration', () => {
  const baseline = HISTORICAL_22KN;
  expect(MAR_SHIP_CONFIG.maxSpeed / MAR_SHIP_CONFIG.acceleration).toBeCloseTo(
    baseline.maxSpeed / baseline.acceleration,
  );
  expect(MAR_SHIP_CONFIG.maxSpeed / MAR_SHIP_CONFIG.brakeDeceleration).toBeCloseTo(
    baseline.maxSpeed / baseline.brakeDeceleration,
  );
  for (const multiplier of [1, TURBO_SPEED, VOYAGE_SPEED]) {
    for (const reverse of [false, true]) {
      const oldConfig = multiplier === 1 ? baseline : boostedConfig(baseline, multiplier);
      const newConfig =
        multiplier === 1 ? MAR_SHIP_CONFIG : boostedConfig(MAR_SHIP_CONFIG, multiplier);
      const oldTurn = uTurn(oldConfig, oldConfig.maxSpeed, reverse);
      const newTurn = uTurn(newConfig, newConfig.maxSpeed, reverse);
      expect(newTurn.time).toBeCloseTo(oldTurn.time, 6);
      expect(newTurn.width / oldTurn.width).toBeCloseTo(150 / 220, 6);
      if (process.env.RECORD_T99) console.log({ multiplier, reverse, oldTurn, newTurn });
    }
  }
});

/**
 * Un efecto del mundo fijo (`k` × la máxima): un `WorldRuntime` de verdad,
 * con un impulso (o un freno) activo de ese factor.
 */
function worldEffect(k: number): ShipEffects {
  const params =
    k > 1
      ? { mode: 'boost' as const, intensity: k - 1, duration: 10 }
      : { mode: 'slow' as const, intensity: 1 - k, duration: 10 };
  const pad: WorldObjectInput = {
    identity: { id: 'efecto', name: 'efecto', category: 'prueba' },
    appearance: { asset: 'placeholder:prueba' },
    position: { x: 0, y: 0 },
    geometry: { activation: { shape: 'circle', radius: 30 } },
    behaviors: [{ type: 'collision', params }],
  };
  const runtime = new WorldRuntime(
    parseWorldConfig({
      id: 'prueba',
      version: 0,
      bounds: { left: -1000, right: 1000, top: -1000, bottom: 1000 },
      objects: k === 1 ? [] : [pad],
    }),
  );
  // El barco pasa por encima: el efecto queda activo (10 s, de sobra para cada prueba).
  runtime.step(createShipState(0, 0, 0), MAR_SHIP_CONFIG, DT);
  expect(runtime.speedFactor()).toBeCloseTo(k, 9);
  return runtime;
}

/** A fondo hacia el este `s` segundos con la física de `cfg`. */
function sail(ship: ShipState, cfg: ShipConfig, s: number): void {
  const ahead: ShipInput = { dirX: 1, dirY: 0, throttle: 1, drift: false };
  for (let i = 0; i < s * 60; i++) stepShip(ship, ahead, cfg, DT);
}

describe('T109: 22 nudos sólo durante la carrera', () => {
  it('la física de carrera es entera la de 22 nudos de antes de T99', () => {
    const flat = (c: ShipConfig) =>
      Object.entries({ ...c, ...c.drift, ...c.reverseTurn, drift: 0, reverseTurn: 0 });
    const got = Object.fromEntries(flat(RACE_SHIP_CONFIG));
    for (const [k, v] of flat(HISTORICAL_22KN)) expect(got[k], k).toBeCloseTo(v as number, 9);
    expect(Object.keys(got).sort()).toEqual(
      flat(HISTORICAL_22KN)
        .map(([k]) => k)
        .sort(),
    );
    expect(RACE_SHIP_CONFIG.maxSpeed).toBe(RACE_MAX_SPEED);
    // Fuera de la carrera, el crucero de 15 nudos.
    expect(baseShipConfig(true)).toBe(RACE_SHIP_CONFIG);
    expect(baseShipConfig(false)).toBe(MAR_SHIP_CONFIG);
    expect(new ShipHandling().config).toBe(MAR_SHIP_CONFIG);
  });

  it('a 22 nudos gira en el mismo tiempo que a 15, en un círculo proporcional', () => {
    const ship = createShipState(0, 0, 0);
    sail(ship, RACE_SHIP_CONFIG, 3);
    expect(shipSpeed(ship) / 10).toBeCloseTo(22);
    for (const reverse of [false, true]) {
      const race = uTurn(RACE_SHIP_CONFIG, RACE_SHIP_CONFIG.maxSpeed, reverse);
      const cruise = uTurn(MAR_SHIP_CONFIG, MAR_SHIP_CONFIG.maxSpeed, reverse);
      expect(race.time).toBeCloseTo(cruise.time, 6);
      expect(race.width / cruise.width).toBeCloseTo(RACE_MAX_SPEED / MAR_SHIP_CONFIG.maxSpeed, 6);
    }
    // El mismo radio de choque: las colisiones no cambian.
    expect(RACE_SHIP_CONFIG.radius).toBe(MAR_SHIP_CONFIG.radius);
  });

  it('el turbo y los impulsos o frenos del mundo se componen igual a 15 que a 22 nudos', () => {
    for (const k of [1, 0.5, 1.5]) {
      for (const boost of [1, TURBO_SPEED, VOYAGE_SPEED]) {
        const effects = worldEffect(k);
        const cruise = stepShipConfig(MAR_SHIP_CONFIG, effects, boost);
        const race = stepShipConfig(RACE_SHIP_CONFIG, effects, boost);
        expect(cruise.maxSpeed).toBeCloseTo(MAR_SHIP_CONFIG.maxSpeed * k * boost, 9);
        expect(race.maxSpeed).toBeCloseTo(RACE_SHIP_CONFIG.maxSpeed * k * boost, 9);
        // El turbo no abre el círculo de ninguna de las dos.
        expect(race.turnRadius).toBe(RACE_SHIP_CONFIG.turnRadius);
        expect(cruise.turnRadius).toBe(MAR_SHIP_CONFIG.turnRadius);
        expect(race.turnRate).toBe(cruise.turnRate);
      }
    }
    const turbo = createShipState(0, 0, 0);
    sail(turbo, stepShipConfig(RACE_SHIP_CONFIG, worldEffect(1), TURBO_SPEED), 4);
    expect(shipSpeed(turbo) / 10).toBeCloseTo(22 * TURBO_SPEED);
  });

  /**
   * Cada forma de dejar de correr: meta, anulada (panel, fuera de la
   * carretera, tiempo), otro mundo (la carrera se cambia por otra) y otra
   * vez desde la tarjeta (cuenta atrás).
   */
  const endings: [string, (r: CircuitRace, now: number) => CircuitRace][] = [
    [
      'meta',
      (r, now) => {
        for (let lap = 1; lap <= spec.laps; lap++) {
          for (let order = 1; order <= spec.buoys; order++) r.checkpoint(order, now);
          r.checkpoint(0, now);
        }
        return r;
      },
    ],
    ['panel', (r) => (r.invalidate('panel'), r)],
    ['fuera de la carretera', (r) => (r.invalidate('offroad'), r)],
    ['tiempo', (r, now) => (r.tick(now + spec.maxDuration + 1), r)],
    ['otro mundo', () => new CircuitRace(spec)],
    [
      'otra vez',
      (r, now) => {
        r.invalidate('panel');
        r.start(now);
        return r;
      },
    ],
  ];

  for (const [name, end] of endings) {
    it(`al dejar de correr (${name}) vuelve a 15 nudos y no le queda velocidad de carrera`, () => {
      const effects = worldEffect(1);
      const cap = (b: ShipConfig) => stepShipConfig(b, effects).maxSpeed;
      const handling = new ShipHandling();
      const ship = createShipState(0, 0, 0.3);
      let race = new CircuitRace(spec);
      race.start(0);
      expect(handling.sync(race.racing, ship, cap)).toBe(false);
      expect(handling.config).toBe(MAR_SHIP_CONFIG);
      race.tick(spec.countdown);
      expect(handling.sync(race.racing, ship, cap)).toBe(true);
      expect(handling.config).toBe(RACE_SHIP_CONFIG);
      const ahead: ShipInput = {
        dirX: Math.cos(0.3),
        dirY: Math.sin(0.3),
        throttle: 1,
        drift: false,
      };
      const step = () => stepShip(ship, ahead, stepShipConfig(handling.config, effects), DT);
      for (let i = 0; i < 4 * 60; i++) step();
      expect(shipSpeed(ship)).toBeCloseTo(RACE_MAX_SPEED);

      race = end(race, spec.countdown + 4);
      expect(race.racing).toBe(false);
      const pose = { x: ship.x, y: ship.y, heading: ship.heading };
      const dir = Math.atan2(ship.vy, ship.vx);
      // Sin recortar, el primer paso a 15 nudos perdería más que un golpe (el temblor de Mar3D, 60 u/s).
      const unclamped = { ...ship };
      stepShip(unclamped, ahead, stepShipConfig(MAR_SHIP_CONFIG, effects), DT);
      expect(shipSpeed(ship) - shipSpeed(unclamped)).toBeGreaterThan(60);
      expect(handling.sync(race.racing, ship, cap)).toBe(true);
      expect(handling.config).toBe(MAR_SHIP_CONFIG);
      // Recortada en el acto al crucero, sin moverlo ni girarlo.
      expect(shipSpeed(ship)).toBeCloseTo(MAR_SHIP_CONFIG.maxSpeed, 9);
      expect(Math.atan2(ship.vy, ship.vx)).toBeCloseTo(dir, 9);
      expect({ x: ship.x, y: ship.y, heading: ship.heading }).toEqual(pose);
      // Recortada, el paso siguiente no la toma por un golpe.
      const before = shipSpeed(ship);
      step();
      expect(before - shipSpeed(ship)).toBeLessThan(1);
      // Y ya no sube de 15 nudos.
      for (let i = 0; i < 3 * 60; i++) step();
      expect(shipSpeed(ship)).toBeLessThanOrEqual(MAR_SHIP_CONFIG.maxSpeed + 1e-9);
    });
  }

  it('al dejar la carrera con turbo o un impulso, se queda con el tope de crucero de ese momento', () => {
    const cases: [number, number][] = [
      [1, TURBO_SPEED],
      [1.5, 1],
      [1.5, TURBO_SPEED],
      [0.5, 1],
    ];
    for (const [k, boost] of cases) {
      const effects = worldEffect(k);
      const handling = new ShipHandling();
      const ship = createShipState(0, 0, 0);
      handling.sync(true, ship, () => Infinity);
      sail(ship, stepShipConfig(handling.config, effects, boost), 4);
      expect(shipSpeed(ship)).toBeCloseTo(RACE_MAX_SPEED * k * boost);
      handling.sync(false, ship, (b) => stepShipConfig(b, effects, boost).maxSpeed);
      expect(shipSpeed(ship), `${k} × ${boost}`).toBeCloseTo(
        MAR_SHIP_CONFIG.maxSpeed * k * boost,
        9,
      );
    }
    // Más despacio que el tope de crucero no se toca.
    const handling = new ShipHandling();
    const slow = createShipState(0, 0, 0);
    slow.vx = 100;
    handling.sync(true, slow, () => Infinity);
    handling.sync(false, slow, () => MAR_SHIP_CONFIG.maxSpeed);
    expect(slow.vx).toBe(100);
  });

  it('una partida del Cañón no es carrera: su maniobrabilidad va sobre la base de crucero', () => {
    const h = SURVIVORS_CONFIG.handling;
    for (const base of [baseShipConfig(false), baseShipConfig(true)]) {
      const s = survivorsShipConfig(base, h);
      // Factores sobre la base que toque: se componen igual con las dos.
      expect(s.maxSpeed).toBe(base.maxSpeed);
      expect(s.turnRate).toBeCloseTo(base.turnRate * h.turnRateScale, 9);
      expect(s.acceleration).toBeCloseTo(base.acceleration * h.accelerationScale, 9);
    }
    // La de la partida es la de crucero: a 15 nudos.
    expect(survivorsShipConfig(baseShipConfig(false), h).maxSpeed / 10).toBe(15);
  });
});

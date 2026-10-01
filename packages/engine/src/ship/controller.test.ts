import { describe, expect, it } from 'vitest';
import { DEFAULT_SHIP_CONFIG as cfg } from './config';
import {
  type ShipEnvironment,
  type ShipInput,
  type ShipState,
  IDLE_INPUT,
  collideShip,
  createShipState,
  shipSpeed,
  stepShip,
  wrapDelta,
  wrapInto,
} from './controller';

const DT = 1 / 60;
const bounds = { left: 0, right: 1000, top: 0, bottom: 2000 };
const openSea: ShipEnvironment = {
  bounds: { left: -1e6, right: 1e6, top: -1e6, bottom: 1e6 },
  obstacles: [],
};
const north: ShipInput = { dirX: 0, dirY: -1, throttle: 1, drift: false };

function run(s: ShipState, input: ShipInput, seconds: number, env = openSea) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    stepShip(s, input, cfg, DT);
    collideShip(s, env, cfg, DT);
  }
}

describe('ShipController', () => {
  it('acelera hasta la velocidad máxima en maxSpeed / acceleration segundos', () => {
    const s = createShipState(0, 0, -Math.PI / 2);
    const expected = cfg.maxSpeed / cfg.acceleration;
    let t = 0;
    while (shipSpeed(s) < cfg.maxSpeed - 1e-6 && t < 10) {
      stepShip(s, north, cfg, DT);
      t += DT;
    }
    expect(Math.abs(t - expected)).toBeLessThanOrEqual(DT * 1.5);
    run(s, north, 2);
    expect(shipSpeed(s)).toBeCloseTo(cfg.maxSpeed, 6);
  });

  it('soltar el control frena suave hasta parar', () => {
    const s = createShipState(0, 0, -Math.PI / 2);
    run(s, north, 2);
    stepShip(s, IDLE_INPUT, cfg, DT);
    expect(shipSpeed(s)).toBeGreaterThan(cfg.maxSpeed * 0.9);
    run(s, IDLE_INPUT, cfg.maxSpeed / cfg.brakeDeceleration + 0.1);
    expect(shipSpeed(s)).toBe(0);
  });

  it('el drift aumenta el giro y el derrape lateral', () => {
    const turnRight: ShipInput = { dirX: 1, dirY: 0, throttle: 1, drift: false };
    const plain = createShipState(0, 0, -Math.PI / 2);
    const drift = createShipState(0, 0, -Math.PI / 2);
    run(plain, north, 2);
    run(drift, north, 2);
    run(plain, turnRight, 0.3);
    run(drift, { ...turnRight, drift: true }, 0.3);
    const turned = (s: ShipState) => s.heading - -Math.PI / 2;
    expect(turned(drift)).toBeGreaterThan(turned(plain) * 1.5);
    const slip = (s: ShipState) =>
      Math.abs(-s.vx * Math.sin(s.heading) + s.vy * Math.cos(s.heading));
    expect(slip(drift)).toBeGreaterThan(slip(plain));
    expect(drift.drifting).toBe(true);
    expect(plain.drifting).toBe(false);
  });

  it('las costas laterales y el borde inferior dejan el barco dentro', () => {
    const env: ShipEnvironment = { bounds, obstacles: [] };
    for (const input of [
      { dirX: -1, dirY: 0, throttle: 1, drift: false },
      { dirX: 1, dirY: 0, throttle: 1, drift: true },
      { dirX: -0.3, dirY: 1, throttle: 1, drift: false },
    ]) {
      const s = createShipState(500, 1800, Math.atan2(input.dirY, input.dirX));
      for (let i = 0; i < 600; i++) {
        stepShip(s, input, cfg, DT);
        collideShip(s, env, cfg, DT);
        expect(s.x).toBeGreaterThanOrEqual(bounds.left + cfg.radius);
        expect(s.x).toBeLessThanOrEqual(bounds.right - cfg.radius);
        expect(s.y).toBeLessThanOrEqual(bounds.bottom - cfg.radius);
      }
    }
  });

  it('contra una costa lateral desliza: conserva la velocidad paralela', () => {
    const env: ShipEnvironment = { bounds, obstacles: [] };
    const diag: ShipInput = { dirX: -1, dirY: -1, throttle: 1, drift: false };
    const s = createShipState(40, 1500, Math.atan2(-1, -1));
    for (let i = 0; i < 90; i++) {
      stepShip(s, diag, cfg, DT);
      collideShip(s, env, cfg, DT);
      expect(shipSpeed(s)).toBeLessThanOrEqual(cfg.maxSpeed + 1e-9);
    }
    expect(s.x).toBeCloseTo(bounds.left + cfg.radius, 6);
    expect(s.vy).toBeLessThan(-cfg.maxSpeed * 0.3);
  });

  it('el borde superior está abierto y una corriente suave devuelve el barco', () => {
    const env: ShipEnvironment = { bounds, obstacles: [] };
    const s = createShipState(500, 100, -Math.PI / 2);
    let minY = s.y;
    for (let i = 0; i < 60 * 8; i++) {
      stepShip(s, north, cfg, DT);
      collideShip(s, env, cfg, DT);
      minY = Math.min(minY, s.y);
    }
    expect(minY).toBeLessThan(bounds.top);
    expect(minY).toBeGreaterThan(bounds.top - cfg.openEdgeSoftZone);
    // Con el acelerador a fondo se queda quieto en la zona, sin vaivén.
    const settled = s.y;
    run(s, north, 1, env);
    expect(Math.abs(s.y - settled)).toBeLessThan(5);
    run(s, IDLE_INPUT, 6, env);
    expect(s.y).toBeGreaterThan(bounds.top);
  });

  it('un obstáculo circular bloquea con rebote suave', () => {
    const rock = { x: 500, y: 1000, radius: 40 };
    const env: ShipEnvironment = { bounds, obstacles: [rock] };
    const s = createShipState(500, 1300, -Math.PI / 2);
    let bounced = false;
    for (let i = 0; i < 60 * 4; i++) {
      stepShip(s, north, cfg, DT);
      collideShip(s, env, cfg, DT);
      const d = Math.hypot(s.x - rock.x, s.y - rock.y);
      expect(d).toBeGreaterThanOrEqual(rock.radius + cfg.radius - 1e-9);
      if (s.vy > 0) bounced = true;
    }
    expect(bounced).toBe(true);
  });
});

describe('golpe y sensibilidad', () => {
  it('collideShip deja en `impact` la velocidad del golpe, y stepShip la vuelve a 0', () => {
    const s = createShipState(500, 500, 0);
    s.vx = 180;
    const wall: ShipEnvironment = { bounds: { ...bounds, right: 500 }, obstacles: [] };
    expect(collideShip(s, wall, cfg, DT)).toBe(true);
    expect(s.impact).toBeCloseTo(180, 6);
    stepShip(s, IDLE_INPUT, cfg, DT);
    expect(s.impact).toBe(0);

    const o = createShipState(0, 0, 0);
    o.vx = 120;
    const rock: ShipEnvironment = { ...openSea, obstacles: [{ x: 20, y: 0, radius: 10 }] };
    collideShip(o, rock, cfg, DT);
    expect(o.impact).toBeCloseTo(120, 6);
  });

  it('la sensibilidad (turnScale) escala el giro del casco', () => {
    const turned = (turnScale?: number) => {
      const s = createShipState(0, 0, 0);
      s.vx = cfg.maxSpeed;
      const input: ShipInput = { dirX: 0, dirY: 1, throttle: 1, drift: false };
      if (turnScale !== undefined) input.turnScale = turnScale;
      stepShip(s, input, cfg, DT);
      return s.heading;
    };
    const base = turned();
    expect(turned(1)).toBeCloseTo(base, 12);
    expect(turned(1.5)).toBeCloseTo(base * 1.5, 9);
    expect(turned(0.5)).toBeCloseTo(base * 0.5, 9);
  });
});

describe('mundo que da la vuelta (wrap, /mar)', () => {
  const W = bounds.right - bounds.left;
  const H = bounds.bottom - bounds.top;
  const wrapped: ShipEnvironment = { bounds, obstacles: [], wrap: true };
  const sides: { name: string; start: [number, number]; input: ShipInput }[] = [
    { name: 'oeste', start: [60, 1000], input: { dirX: -1, dirY: 0, throttle: 1, drift: false } },
    { name: 'este', start: [940, 1000], input: { dirX: 1, dirY: 0, throttle: 1, drift: false } },
    { name: 'norte', start: [500, 60], input: { dirX: 0, dirY: -1, throttle: 1, drift: false } },
    { name: 'sur', start: [500, 1940], input: { dirX: 0, dirY: 1, throttle: 1, drift: false } },
  ];

  for (const side of sides) {
    it(`quien sale por el ${side.name} vuelve por el lado opuesto, sin frenar`, () => {
      const [x0, y0] = side.start;
      const s = createShipState(x0, y0, Math.atan2(side.input.dirY, side.input.dirX));
      s.vx = side.input.dirX * cfg.maxSpeed;
      s.vy = side.input.dirY * cfg.maxSpeed;
      let crossed = false;
      for (let i = 0; i < 60; i++) {
        const px = s.x;
        const py = s.y;
        stepShip(s, side.input, cfg, DT);
        collideShip(s, wrapped, cfg, DT);
        // Siempre dentro del periodo.
        expect(s.x).toBeGreaterThanOrEqual(bounds.left);
        expect(s.x).toBeLessThan(bounds.right);
        expect(s.y).toBeGreaterThanOrEqual(bounds.top);
        expect(s.y).toBeLessThan(bounds.bottom);
        // El salto de un paso es de un periodo: aparece en el borde opuesto.
        if (Math.abs(s.x - px) > W / 2 || Math.abs(s.y - py) > H / 2) {
          crossed = true;
          if (side.input.dirX < 0) expect(s.x).toBeGreaterThan(bounds.right - 20);
          if (side.input.dirX > 0) expect(s.x).toBeLessThan(bounds.left + 20);
          if (side.input.dirY < 0) expect(s.y).toBeGreaterThan(bounds.bottom - 20);
          if (side.input.dirY > 0) expect(s.y).toBeLessThan(bounds.top + 20);
        }
      }
      expect(crossed).toBe(true);
      expect(shipSpeed(s)).toBeCloseTo(cfg.maxSpeed, 3);
    });
  }

  it('un obstáculo al otro lado del borde bloquea por el camino más corto', () => {
    const rock = { x: 10, y: 1000, radius: 40 };
    const env: ShipEnvironment = { bounds, obstacles: [rock], wrap: true };
    const east: ShipInput = { dirX: 1, dirY: 0, throttle: 1, drift: false };
    const s = createShipState(900, 1000, 0);
    for (let i = 0; i < 60 * 3; i++) {
      stepShip(s, east, cfg, DT);
      collideShip(s, env, cfg, DT);
      const dx = wrapDelta(s.x - rock.x, W);
      expect(Math.hypot(dx, s.y - rock.y)).toBeGreaterThanOrEqual(rock.radius + cfg.radius - 1e-6);
    }
  });

  it('wrapDelta da el camino más corto y wrapInto lleva dentro del periodo', () => {
    expect(wrapDelta(900, W)).toBeCloseTo(-100);
    expect(wrapDelta(-900, W)).toBeCloseTo(100);
    expect(wrapDelta(300, W)).toBeCloseTo(300);
    expect(wrapDelta(1700, H)).toBeCloseTo(-300);
    expect(wrapInto(-10, bounds.left, bounds.right)).toBeCloseTo(W - 10);
    expect(wrapInto(W + 5, bounds.left, bounds.right)).toBeCloseTo(5);
    expect(wrapInto(250, bounds.left, bounds.right)).toBe(250);
  });

  it('sin wrap (lo de /juego) el choque con los bordes es el de siempre', () => {
    const cases: [number, number, number, number][] = [
      [5, 1000, -50, 0],
      [995, 1000, 50, 0],
      [500, 1995, 0, 60],
      [500, -30, 0, -60],
    ];
    for (const [x, y, vx, vy] of cases) {
      const a = { ...createShipState(x, y, 0), vx, vy };
      const b = { ...createShipState(x, y, 0), vx, vy };
      const hitA = collideShip(a, { bounds, obstacles: [] }, cfg, DT);
      const hitB = collideShip(b, { bounds, obstacles: [], wrap: false }, cfg, DT);
      expect(b).toEqual(a);
      expect(hitB).toBe(hitA);
    }
    // Y la regla de siempre: costa lateral con rebote suave, abajo también.
    const w = { ...createShipState(5, 1000, 0), vx: -50, vy: 0 };
    collideShip(w, { bounds, obstacles: [] }, cfg, DT);
    expect(w.x).toBe(bounds.left + cfg.radius);
    expect(w.vx).toBeCloseTo(50 * cfg.wallRestitution);
    const south = { ...createShipState(500, 1995, 0), vx: 0, vy: 60 };
    collideShip(south, { bounds, obstacles: [] }, cfg, DT);
    expect(south.y).toBe(bounds.bottom - cfg.radius);
  });
});

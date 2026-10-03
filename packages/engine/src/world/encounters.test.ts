import { type WorldObjectInput, parseWorldConfig } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SHIP_CONFIG } from '../ship/config';
import { IDLE_INPUT, createShipState, stepShip } from '../ship/controller';
import { WorldRuntime, patrolPoint } from './runtime';

/**
 * Lo que T20 añade al motor de comportamientos: colisiones de varios
 * círculos (islas alargadas), el vaivén del cocodrilo del circuito, la
 * fuerza del remolino y mover objetos desde la aplicación (delfín).
 */

const base = (objects: WorldObjectInput[]) =>
  parseWorldConfig({
    id: 't20',
    version: 1,
    bounds: { left: -2000, right: 2000, top: -2000, bottom: 2000 },
    objects,
  });

const obj = (id: string, extra: Partial<WorldObjectInput>): WorldObjectInput => ({
  identity: { id, name: id, category: 'prueba' },
  appearance: { asset: 'placeholder:roca' },
  position: { x: 0, y: 0 },
  geometry: {},
  behaviors: [],
  ...extra,
});

describe('colisión de varios círculos', () => {
  it('cada círculo extra es un obstáculo sólido; sin COLISIÓN, ninguno', () => {
    const world = base([
      obj('escollera', {
        geometry: {
          collision: { shape: 'circle', radius: 10 },
          collisionParts: [
            { dx: 20, dy: 0, radius: 10 },
            { dx: -20, dy: 0, radius: 10 },
          ],
        },
        behaviors: [{ type: 'collision', params: { mode: 'block' } }],
      }),
    ]);
    const rt = new WorldRuntime(world);
    expect(rt.solidObstacles().map((o) => o.x)).toEqual([0, 20, -20]);
    // El barco que entra por el extremo se queda fuera.
    const ship = createShipState(20, 30, -Math.PI / 2);
    ship.vy = -200;
    for (let i = 0; i < 30; i++) {
      ship.y += ship.vy / 60;
      rt.step(ship, DEFAULT_SHIP_CONFIG, 1 / 60);
    }
    expect(Math.hypot(ship.x - 20, ship.y)).toBeGreaterThanOrEqual(10 + DEFAULT_SHIP_CONFIG.radius - 0.01);
  });

  it('círculos extra sin COLISIÓN principal no valen', () => {
    expect(() =>
      base([
        obj('mal', {
          geometry: { activation: { shape: 'circle', radius: 5 }, collisionParts: [{ dx: 1, dy: 1, radius: 3 }] },
          behaviors: [{ type: 'collision', params: { mode: 'block' } }],
        }),
      ]),
    ).toThrow(/círculos extra/);
  });
});

describe('vaivén (params.patrol)', () => {
  it('va y vuelve entre sus puntos en su periodo', () => {
    const p = { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], period: 4 };
    expect(patrolPoint(p, 0)).toEqual({ x: 0, y: 0 });
    expect(patrolPoint(p, 1).x).toBeCloseTo(50);
    expect(patrolPoint(p, 2).x).toBeCloseTo(100);
    expect(patrolPoint(p, 3).x).toBeCloseTo(50);
    expect(patrolPoint(p, 4).x).toBeCloseTo(0);
  });

  it('el runtime mueve el objeto y su colisión con él', () => {
    const world = base([
      obj('croc', {
        geometry: { collision: { shape: 'circle', radius: 10 } },
        behaviors: [{ type: 'collision', params: { mode: 'slow', intensity: 0.6, duration: 2 } }],
        params: { patrol: { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], period: 4 } },
      }),
    ]);
    const rt = new WorldRuntime(world);
    const ship = createShipState(0, 1000);
    for (let i = 0; i < 60; i++) rt.step(ship, DEFAULT_SHIP_CONFIG, 1 / 60);
    expect(rt.objectState('croc')!.x).toBeCloseTo(50, 0);
  });
});

describe('remolino (params.swirl)', () => {
  it('dentro de su radio la corriente lleva el barco de lado; fuera, nada', () => {
    const world = base([
      obj('remolino', {
        geometry: { proximityRadius: 100 },
        behaviors: [{ type: 'proximity' }],
        params: { swirl: { strength: 120, pull: 0 } },
      }),
    ]);
    const rt = new WorldRuntime(world);
    const inside = createShipState(50, 0);
    const heading = inside.heading;
    rt.step(inside, DEFAULT_SHIP_CONFIG, 1 / 60);
    // A la derecha del centro, el giro horario (+x → +y) lo lleva hacia +y
    // (T96: es una corriente, mueve el barco aunque la quilla no derrape) y
    // le gira la proa en el mismo sentido.
    expect(inside.y).toBeCloseTo((120 * 0.5) / 60, 6);
    expect(inside.heading).toBeGreaterThan(heading);
    const outside = createShipState(500, 0);
    rt.step(outside, DEFAULT_SHIP_CONFIG, 1 / 60);
    expect(outside.x).toBe(500);
    expect(outside.y).toBe(0);
    expect(outside.vx).toBe(0);
    expect(outside.vy).toBe(0);
  });

  it('sin motor, el barco da vueltas dentro (se surfea con la quilla agarrada)', () => {
    const world = base([
      obj('remolino', {
        geometry: { proximityRadius: 100 },
        behaviors: [{ type: 'proximity' }],
        params: { swirl: { strength: 110, pull: 25 } },
      }),
    ]);
    const rt = new WorldRuntime(world);
    const ship = createShipState(60, 0);
    // Una quilla que anula todo derrape: con el empujón de antes no se movía.
    const cfg = { ...DEFAULT_SHIP_CONFIG, lateralGrip: 1000 };
    let turned = 0;
    let prev = Math.atan2(ship.y, ship.x);
    for (let i = 0; i < 120; i++) {
      stepShip(ship, IDLE_INPUT, cfg, 1 / 60);
      rt.step(ship, cfg, 1 / 60);
      const a = Math.atan2(ship.y, ship.x);
      turned += Math.atan2(Math.sin(a - prev), Math.cos(a - prev));
      prev = a;
    }
    // En 2 s da al menos media vuelta alrededor del centro, y sigue dentro.
    expect(turned).toBeGreaterThan(Math.PI / 2);
    expect(Math.hypot(ship.x, ship.y)).toBeLessThan(100);
    expect(rt.drainEvents()).toContainEqual({ type: 'proximity_enter', objectId: 'remolino' });
  });
});

describe('mover objetos desde la aplicación', () => {
  it('moveObject cambia su sitio y su proximidad; setObjectPresent lo oculta', () => {
    const world = base([
      obj('delfin', { geometry: { proximityRadius: 50 }, behaviors: [{ type: 'proximity' }] }),
    ]);
    const rt = new WorldRuntime(world);
    const ship = createShipState(300, 0);
    rt.step(ship, DEFAULT_SHIP_CONFIG, 1 / 60);
    expect(rt.drainEvents()).toEqual([]);
    expect(rt.moveObject('delfin', 290, 0)).toBe(true);
    rt.step(ship, DEFAULT_SHIP_CONFIG, 1 / 60);
    expect(rt.drainEvents()).toContainEqual({ type: 'proximity_enter', objectId: 'delfin' });
    expect(rt.setObjectPresent('delfin', false)).toBe(true);
    expect(rt.objectState('delfin')!.present).toBe(false);
    expect(rt.moveObject('nada', 0, 0)).toBe(false);
  });
});

import { sheetRadius } from '@boia/engine/bottles';
import { circuitFromWorld } from '@boia/engine/circuit';
import { IDLE_INPUT, WorldRuntime, createShipState, stepShip } from '@boia/engine/headless';
import { CIRCUIT_ID, WORLD_REGISTRY } from '@boia/world';
import type { PlaneGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { WHIRLPOOL_TIERS, WhirlpoolTimer } from '../../../lib/mundo/encounters';
import { roadPath } from '../race';
import { ROAD_HALF_WIDTH, distToPath } from '../road';
import { WHIRLPOOL_SHEET_MARGIN, marWorld } from './compact';
import { toScene } from './compress';
import { WHIRLPOOL_LIFT, WHIRLPOOL_SEGMENTS, whirlpool } from './effects';
import { MAR_SHIP_CONFIG, keysInput } from './steering';
import { periodOf, planetRect, shortest } from './wrap';

/**
 * Los remolinos del mar 3D (REQ-AVE-019, T96): salen del mundo, se ven
 * (la malla sigue la curva del planeta) y se surfean con el barco de /mar.
 */

const world = marWorld(WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config);
const period = periodOf(planetRect(world.bounds));
const whirls = world.objects.filter((o) => o.identity.active && o.identity.category === 'remolino');
const swirlOf = (o: (typeof whirls)[number]) =>
  o.params?.swirl as { strength: number; pull: number } | undefined;

describe('remolinos del mar 3D', () => {
  it('el mundo de /mar trae remolinos con su giro y su radio', () => {
    expect(whirls.length).toBeGreaterThan(0);
    for (const o of whirls) {
      expect(swirlOf(o)?.strength, o.identity.id).toBeGreaterThan(0);
      expect(o.geometry.proximityRadius, o.identity.id).toBeGreaterThan(0);
      expect(
        o.behaviors.some((b) => b.type === 'proximity'),
        o.identity.id,
      ).toBe(true);
    }
  });

  it('fuera de toda ficha que se abre sola y de la carretera de la carrera', () => {
    const path = roadPath(world, circuitFromWorld(world, CIRCUIT_ID)!);
    for (const w of whirls) {
      const r = w.geometry.proximityRadius!;
      for (const o of world.objects) {
        const sheet = sheetRadius(o);
        if (sheet === null || o === w) continue;
        const s = shortest(o.position, w.position, period);
        expect(Math.hypot(s.dx, s.dy), `${w.identity.id} y ${o.identity.id}`).toBeGreaterThanOrEqual(
          sheet + r + WHIRLPOOL_SHEET_MARGIN - 1,
        );
      }
      expect(distToPath(path, w.position, period)).toBeGreaterThan(ROAD_HALF_WIDTH + r);
    }
  });

  it('la malla es fina: sigue la curva del planeta y no se hunde bajo el agua', () => {
    for (const o of whirls) {
      const R = toScene(o.geometry.proximityRadius!) * 1.1;
      const mesh = whirlpool(R);
      const g = mesh.geometry as PlaneGeometry;
      expect(g.parameters.widthSegments).toBe(WHIRLPOOL_SEGMENTS);
      expect(g.parameters.heightSegments).toBe(WHIRLPOOL_SEGMENTS);
      // La curva baja `bend · r²`: entre dos vértices vecinos (diagonal de un
      // cuadro) la cuerda se hunde `bend · d² / 4`. Con la curva de cerca del
      // barco (bend 0.0045), muy por debajo de lo que el remolino flota.
      const cell = (2 * R * Math.SQRT2) / WHIRLPOOL_SEGMENTS;
      expect((0.0045 * cell * cell) / 4).toBeLessThan(WHIRLPOOL_LIFT / 10);
      expect(mesh.position.y).toBe(WHIRLPOOL_LIFT);
    }
  });

  it('se surfea: sin motor el agua lleva el barco en círculo y lo mantiene dentro', () => {
    for (const o of whirls) {
      const rt = new WorldRuntime(world);
      const R = o.geometry.proximityRadius!;
      const c = o.position;
      const ship = createShipState(c.x + R * 0.6, c.y);
      let turned = 0;
      let prev = 0;
      for (let i = 0; i < 90; i++) {
        stepShip(ship, IDLE_INPUT, rt.shipConfig(MAR_SHIP_CONFIG), 1 / 60);
        rt.step(ship, MAR_SHIP_CONFIG, 1 / 60);
        const s = shortest(c, ship, period);
        const a = Math.atan2(s.dy, s.dx);
        turned += Math.atan2(Math.sin(a - prev), Math.cos(a - prev));
        prev = a;
        expect(Math.hypot(s.dx, s.dy)).toBeLessThan(R);
      }
      // En 1,5 s, más de un cuarto de vuelta alrededor del centro.
      expect(turned, o.identity.id).toBeGreaterThan(Math.PI / 2);
      expect(rt.drainEvents()).toContainEqual({ type: 'proximity_enter', objectId: o.identity.id });
    }
  });

  it('con motor a fondo hacia fuera, se sale', () => {
    for (const o of whirls) {
      const rt = new WorldRuntime(world);
      const c = o.position;
      const ship = createShipState(c.x + 10, c.y, 0);
      for (let i = 0; i < 180; i++) {
        stepShip(ship, keysInput(1, 0), rt.shipConfig(MAR_SHIP_CONFIG), 1 / 60);
        rt.step(ship, MAR_SHIP_CONFIG, 1 / 60);
      }
      const s = shortest(c, ship, period);
      expect(Math.hypot(s.dx, s.dy)).toBeGreaterThan(o.geometry.proximityRadius!);
      expect(rt.drainEvents()).toContainEqual({ type: 'proximity_exit', objectId: o.identity.id });
    }
  });
});

describe('el reto del remolino (REQ-AVE-019)', () => {
  const coinsAfter = (seconds: number) => {
    const timer = new WhirlpoolTimer();
    timer.enter(0);
    return timer.exit(seconds * 1000).tiers.reduce((sum, t) => sum + t.coins, 0);
  };

  it('más tiempo dentro da más recompensa', () => {
    const steps = [0, ...WHIRLPOOL_TIERS.map((t) => t.seconds)];
    const coins = steps.map(coinsAfter);
    expect(coins[0]).toBe(0);
    for (let i = 1; i < coins.length; i++) expect(coins[i]!).toBeGreaterThan(coins[i - 1]!);
    // Sin entrar, nada.
    expect(new WhirlpoolTimer().exit(10_000).tiers).toEqual([]);
  });
});

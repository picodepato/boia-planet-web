import { RAMP_JUMP, WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SHIP_CONFIG } from '../ship/config';
import { createShipState } from '../ship/controller';
import { WorldRuntime } from '../world/runtime';
import { BoatJump, DEFAULT_JUMP, type JumpEvent, jumpOf, rampsOf } from './jump';

/**
 * Las rampas de salto de Los Rápidos (T73): pasar por encima de una es un
 * impulso del mundo con `params.jump`; el barco despega, vuela una parábola y
 * cae al agua con chapuzón.
 */

const world = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config;
const ramps = rampsOf(world);

describe('rampas de salto', () => {
  it('el circuito tiene rampas y cada una lleva su salto', () => {
    expect(ramps.size).toBeGreaterThanOrEqual(2);
    for (const [id, j] of ramps) {
      expect(j, id).toEqual(RAMP_JUMP);
      expect(id).toMatch(/^circuito-rampa-/);
    }
    expect(jumpOf(world.objects.find((o) => o.identity.id === 'circuito'))).toBeNull();
    // Un salto a medias se completa con el de por defecto.
    expect(jumpOf({ params: { jump: { height: -3 } } })).toEqual(DEFAULT_JUMP);
  });

  it('pasar por una rampa la dispara (impulso) y el barco salta y cae al agua con chapuzón', () => {
    const [id, spec] = [...ramps][0]!;
    const ramp = world.objects.find((o) => o.identity.id === id)!;
    const heading = ramp.params!.heading as number;
    const runtime = new WorldRuntime(world, { seed: 1 });
    // A 200 u antes de la rampa, de proa hacia ella y a toda máquina.
    const ship = createShipState(
      ramp.position.x - Math.cos(heading) * 200,
      ramp.position.y - Math.sin(heading) * 200,
      heading,
    );
    const jump = new BoatJump();
    const events: JumpEvent[] = [];
    const heights: number[] = [];
    const dt = 1 / 60;
    for (let i = 0; i < 4 * 60; i++) {
      const t = i * dt;
      ship.vx = Math.cos(heading) * DEFAULT_SHIP_CONFIG.maxSpeed;
      ship.vy = Math.sin(heading) * DEFAULT_SHIP_CONFIG.maxSpeed;
      ship.x += ship.vx * dt;
      ship.y += ship.vy * dt;
      runtime.step(ship, DEFAULT_SHIP_CONFIG, dt);
      events.push(...jump.tick(t));
      for (const e of runtime.drainEvents()) {
        if (e.type === 'effect' && e.effect === 'boost' && ramps.has(e.objectId)) {
          events.push(...jump.launch(e.objectId, ramps.get(e.objectId)!, t));
        }
      }
      heights.push(jump.height(t));
    }
    expect(events).toEqual([
      { type: 'jump', objectId: id, height: spec.height, duration: spec.duration },
      { type: 'splash', objectId: id },
    ]);
    // En el aire llega a la altura de la rampa y vuelve al agua.
    expect(Math.max(...heights)).toBeCloseTo(spec.height, 0);
    expect(heights.at(-1)).toBe(0);
    expect(jump.airborne).toBe(false);
  });

  it('el vuelo es una parábola: sube con la proa arriba, cae de proa y en el aire no se relanza', () => {
    const jump = new BoatJump();
    const spec = { height: 40, duration: 1 };
    expect(jump.launch('r', spec, 10)).toHaveLength(1);
    expect(jump.launch('otra', spec, 10.2)).toEqual([]);
    expect(jump.height(10.5)).toBeCloseTo(40);
    expect(jump.height(10.25)).toBeCloseTo(30);
    expect(jump.pitch(10.1)).toBeGreaterThan(0);
    expect(jump.pitch(10.9)).toBeLessThan(0);
    expect(jump.tick(10.99)).toEqual([]);
    expect(jump.tick(11)).toEqual([{ type: 'splash', objectId: 'r' }]);
    expect(jump.height(11.2)).toBe(0);
    expect(jump.tick(12)).toEqual([]);
    jump.launch('r', spec, 20);
    jump.reset();
    expect(jump.tick(25)).toEqual([]);
  });
});

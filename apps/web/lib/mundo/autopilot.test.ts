import { WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import {
  VOYAGE_MAX_S,
  VOYAGE_SPEED,
  VOYAGE_STALL_S,
  arrivalPoint,
  isSteeringKey,
  planVoyage,
  stepVoyage,
  voyageHref,
} from './autopilot';

/**
 * «Ir a la isla» en /juego (T43): el viaje para dentro del radio de la isla
 * (su panel se abre al llegar) y fuera de su casco, llega siempre (también
 * atascado o con el tiempo agotado) y no tarda más de lo que dice.
 */

const world = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config;
const castaway = world.objects.find((o) => o.identity.category === 'naufrago')!;
const eventIsland = world.objects.find((o) =>
  o.behaviors.some((b) => b.type === 'content' && b.params.target === 'event'),
)!;
const DT = 1 / 60;

describe('piloto automático a la isla (T43)', () => {
  it('llega dentro del radio de la isla y fuera de su casco', () => {
    const from = castaway.position;
    const p = arrivalPoint(eventIsland, from);
    const d = Math.hypot(p.x - eventIsland.position.x, p.y - eventIsland.position.y);
    expect(d).toBeLessThan(eventIsland.geometry.proximityRadius!);
    expect(d).toBeGreaterThan(eventIsland.geometry.collision!.radius);
  });

  it('del náufrago a la isla del evento en línea recta: llega a tiempo y a la llegada', () => {
    const v = planVoyage(eventIsland, castaway.position, 'ev');
    expect(v.speed).toBeGreaterThanOrEqual(VOYAGE_SPEED);
    let ship = { x: castaway.position.x, y: castaway.position.y };
    let arrived = null;
    for (let i = 0; i < (VOYAGE_MAX_S / DT) * 2 && !arrived; i++) {
      const r = stepVoyage(v, ship, DT);
      ship = { x: r.x, y: r.y };
      if (r.kind === 'arrive') arrived = r;
    }
    expect(arrived).not.toBeNull();
    expect(ship).toEqual(v.arrival);
    expect(v.elapsed).toBeLessThanOrEqual(VOYAGE_MAX_S + DT);
  });

  it('atascado (la costa no le deja avanzar), llega de un salto', () => {
    const v = planVoyage(eventIsland, castaway.position, 'ev');
    const stuck = { x: castaway.position.x, y: castaway.position.y };
    let r = stepVoyage(v, stuck, DT);
    let steps = 1;
    while (r.kind === 'move' && steps < 1000) {
      r = stepVoyage(v, stuck, DT);
      steps++;
    }
    expect(r.kind).toBe('arrive');
    expect(steps * DT).toBeLessThanOrEqual(VOYAGE_STALL_S + 2 * DT);
    expect({ x: r.x, y: r.y }).toEqual(v.arrival);
  });

  it('el timón cancela: flechas y WASD; el enlace abre /juego en esa isla', () => {
    expect(['ArrowUp', 'ArrowLeft', 'KeyW', 'KeyD'].every(isSteeringKey)).toBe(true);
    expect(['Space', 'Escape', 'KeyM'].some(isSteeringKey)).toBe(false);
    expect(voyageHref('ev x')).toBe('/juego?evento=ev%20x&piloto=1');
  });
});

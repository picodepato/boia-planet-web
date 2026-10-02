import { WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { marWorld } from './compact';
import {
  MAP_PAN_SLACK,
  PLANET_MARGIN,
  behindPlanet,
  bendDrop,
  mapPanLimit,
  periodOf,
  planetRect,
  pushOut,
  rayOnPlanet,
  steer,
  wrapIn,
} from './wrap';

const world = marWorld(WORLD_REGISTRY.get('arcilla').config);
const rect = planetRect(world.bounds);
const period = periodOf(rect);
const opts = { shipRadius: 18, period };

describe('el planeta de agua de /mar', () => {
  it('el periodo es el mapa con su margen y todos los lugares caen dentro', () => {
    expect(rect.left).toBe(world.bounds.left - PLANET_MARGIN.side);
    expect(rect.bottom).toBe(world.bounds.bottom + PLANET_MARGIN.bottom);
    for (const o of world.objects) {
      expect(wrapIn(o.position.x, rect.left, rect.right)).toBeCloseTo(o.position.x, 6);
      expect(wrapIn(o.position.y, rect.top, rect.bottom)).toBeCloseTo(o.position.y, 6);
    }
  });

  it('el piloto automático da la vuelta cuando es más corto', () => {
    const nearEast = { x: rect.right - 200, y: 0 };
    const nearWest = { x: rect.left + 200, y: 0 };
    // Del borde este al oeste: 400 u dando la vuelta hacia el este, no el mapa entero.
    const east = steer(nearEast, nearWest, [], opts);
    expect(east.dirX).toBeGreaterThan(0.9);
    expect(east.distance).toBeCloseTo(400, 6);
    const west = steer(nearWest, nearEast, [], opts);
    expect(west.dirX).toBeLessThan(-0.9);
    // Norte ↔ sur igual.
    const north = steer({ x: 0, y: rect.top + 150 }, { x: 0, y: rect.bottom - 150 }, [], opts);
    expect(north.dirY).toBeLessThan(-0.9);
    expect(north.distance).toBeCloseTo(300, 6);
    // Sin dar la vuelta (periodo nulo), por dentro del mapa.
    const flat = steer(nearEast, nearWest, [], { ...opts, period: null });
    expect(flat.dirX).toBeLessThan(-0.9);
    expect(flat.distance).toBeCloseTo(period.w - 400, 6);
  });

  it('el piloto automático elige la vuelta más corta a cada isla del mapa desde el puerto', () => {
    const spawn = world.spawn!;
    for (const o of world.objects.filter((x) => x.identity.category === 'isla')) {
      const s = steer(spawn, o.position, [], opts);
      const inside = Math.hypot(o.position.x - spawn.x, o.position.y - spawn.y);
      expect(s.distance).toBeLessThanOrEqual(inside + 1e-6);
      // Nunca más de medio periodo por eje.
      expect(Math.abs(s.dirX * s.distance)).toBeLessThanOrEqual(period.w / 2 + 1e-6);
    }
  });

  it('esquiva un obstáculo en el camino, también al otro lado del borde', () => {
    const ship = { x: rect.right - 150, y: 0 };
    const target = { x: rect.left + 400, y: 0 };
    const rock = { x: rect.left + 100, y: 5, radius: 60 };
    const s = steer(ship, target, [rock], opts);
    expect(s.dirX).toBeGreaterThan(0);
    // La roca queda un poco al sur (+y): el rumbo se aparta hacia el norte.
    expect(s.dirY).toBeLessThan(-0.1);
  });

  it('llega cerca del destino, aunque esté al otro lado del borde', () => {
    const s = steer({ x: rect.right - 10, y: 0 }, { x: rect.left + 10, y: 0 }, [], opts);
    expect(s.arrived).toBe(true);
  });

  it('el decorado propio (castillo, Explanada) no se atraviesa', () => {
    const ship = { x: rect.left + 5, y: 0, vx: -100, vy: 0 };
    const hit = pushOut(ship, [{ x: rect.right - 10, y: 0, radius: 40 }], 18, period);
    expect(hit).toBe(true);
    // Sale por el lado del barco (el este del círculo, que está al otro lado del borde).
    expect(ship.x).toBeCloseTo(rect.left + 48, 6);
    expect(ship.vx).toBeGreaterThan(0);
  });

  it('la curva: un rayo bajo el horizonte toca el agua, uno por encima no', () => {
    const bend = 0.003;
    const camY = 22;
    const down = rayOnPlanet(camY, 0, -0.6, -0.8, bend);
    expect(down.hit).toBe(true);
    const r = down.t * 0.8;
    expect(camY - 0.6 * down.t).toBeCloseTo(-bendDrop(bend, r), 6);
    // Casi horizontal: pasa por encima del planeta.
    expect(rayOnPlanet(camY, 0, -0.05, -0.9987, bend).hit).toBe(false);
    // Sin curva, el plano de siempre.
    expect(rayOnPlanet(camY, 0, -0.05, -0.9987, 0).hit).toBe(true);
  });

  it('lo que queda tras el horizonte se oculta; lo cercano, no', () => {
    const bend = 0.003;
    const camY = 22;
    const far = 200;
    expect(behindPlanet(camY, far, -bendDrop(bend, far), bend)).toBe(true);
    expect(behindPlanet(camY, 30, -bendDrop(bend, 30), bend)).toBe(false);
    // Una torre muy alta asoma por encima del horizonte.
    expect(behindPlanet(camY, far, -bendDrop(bend, far) + 200, bend)).toBe(false);
  });
});

describe('mapPanLimit (T65): la carta se arrastra sin irse de la pantalla', () => {
  it('si no cabe, hasta ver su borde', () => {
    expect(mapPanLimit(1000, 600)).toBe(200);
    // Arrastrada al límite, el borde de la vista coincide con el de la carta.
    expect(mapPanLimit(1000, 600) + 600 / 2).toBe(1000 / 2);
  });

  it('si cabe entera (o casi), sólo un poco', () => {
    expect(mapPanLimit(1000, 1400)).toBe(1000 * MAP_PAN_SLACK);
    expect(mapPanLimit(1000, 1000)).toBe(1000 * MAP_PAN_SLACK);
    expect(mapPanLimit(1000, 950)).toBe(1000 * MAP_PAN_SLACK);
  });

  it('nunca más de medio periodo: lo arrastrado no da la vuelta', () => {
    for (const view of [0, 10, 300, 999, 5000]) {
      const lim = mapPanLimit(period.w, view);
      expect(lim).toBeGreaterThanOrEqual(0);
      expect(lim).toBeLessThanOrEqual(period.w / 2);
    }
    expect(mapPanLimit(0, 100)).toBe(0);
  });
});

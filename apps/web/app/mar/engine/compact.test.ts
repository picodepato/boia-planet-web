import {
  DEFAULT_SHIP_CONFIG,
  WorldRuntime,
  createShipState,
  stepShip,
} from '@boia/engine/headless';
import { missionDestinationId, rescueMissionOf } from '@boia/engine/mission';
import { WORLD_REGISTRY, type WorldConfig } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { MAR3D_SCALE } from './compress';
import {
  ROUTE,
  ROUTE_NEIGHBOURS,
  ROUTE_STOPS,
  WHIRLPOOL_NEAR,
  contentBounds,
  decorCircles,
  decorSpots,
  footprintOf,
  marWorld,
  nearestOnRoute,
  seaRoute,
} from './compact';
import { PLANET_MARGIN, periodOf, planetRect, pushOut, shortest, steer } from './wrap';

const shared = WORLD_REGISTRY.get('arcilla').config;
const world = marWorld(shared);
// El mar de T33: las mismas escalas sin compactar.
const before = marWorld(shared, { compact: 1 });
const rect = planetRect(world.bounds);
const period = periodOf(rect);
const route = seaRoute(world);
const byId = (w: WorldConfig, id: string) => w.objects.find((o) => o.identity.id === id)!;
const islands = (w: WorldConfig) => w.objects.filter((o) => o.identity.category === 'isla');
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const around = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  const s = shortest(a, b, period);
  return Math.hypot(s.dx, s.dy);
};
const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
/** Distancia de cada isla a su vecina más cercana. */
const neighbourGaps = (w: WorldConfig) =>
  islands(w).map((a) =>
    Math.min(
      ...islands(w)
        .filter((b) => b !== a)
        .map((b) => dist(a.position, b.position)),
    ),
  );

describe('el mundo compacto de /mar (T50)', () => {
  it('las islas quedan a la mitad de distancia de su vecina que en T33', () => {
    const now = median(neighbourGaps(world));
    const then = median(neighbourGaps(before));
    expect(now / then).toBeGreaterThan(MAR3D_SCALE.compact * 0.9);
    expect(now / then).toBeLessThanOrEqual(MAR3D_SCALE.compact * 1.05);
  });

  it('conserva todos los lugares, con sus ids, comportamientos y radios de disparo', () => {
    expect(world.objects.map((o) => o.identity.id)).toEqual(
      shared.objects.map((o) => o.identity.id),
    );
    for (const o of world.objects) {
      const b = byId(before, o.identity.id);
      expect(o.behaviors.map((x) => x.type)).toEqual(b.behaviors.map((x) => x.type));
      // Huellas y radios iguales que en T33: sólo cambia dónde están.
      expect(o.geometry).toEqual(b.geometry);
    }
  });

  it('ninguna huella pisa otra: islas, decorado y radios de proximidad de las islas', () => {
    const circles = [
      ...islands(world).map((o) => ({
        id: o.identity.id,
        piece: o.identity.id,
        x: o.position.x,
        y: o.position.y,
        r: footprintOf(o),
        prox: o.geometry.proximityRadius!,
      })),
      ...decorCircles(decorSpots(world)).map((c, i) => ({
        id: `${c.kind}-${i}`,
        piece: c.kind,
        x: c.x,
        y: c.y,
        r: c.radius,
        prox: 0,
      })),
    ];
    for (let i = 0; i < circles.length; i++) {
      for (let j = i + 1; j < circles.length; j++) {
        const a = circles[i]!;
        const b = circles[j]!;
        const d = around(a, b);
        // Los círculos de una misma pieza (la Explanada) se solapan a propósito.
        if (a.piece === b.piece) continue;
        // Cabe el barco entre dos huellas.
        expect(d, `${a.id} / ${b.id}`).toBeGreaterThan(a.r + b.r + 2 * DEFAULT_SHIP_CONFIG.radius);
        if (a.prox && b.prox) {
          expect(d, `proximidad ${a.id} / ${b.id}`).toBeGreaterThanOrEqual(
            a.prox + b.prox + MAR3D_SCALE.islandGap - 1,
          );
        }
      }
    }
    // Y nada ajeno (mar vivo, circuito, secretos, puerto) cae dentro de una isla o del decorado.
    const solid = [
      ...islands(world).map((o) => ({
        id: o.identity.id,
        x: o.position.x,
        y: o.position.y,
        r: footprintOf(o),
      })),
      ...decorCircles(decorSpots(world)).map((c) => ({ id: c.kind, x: c.x, y: c.y, r: c.radius })),
    ];
    for (const o of world.objects) {
      if (o.identity.category === 'isla' || o.identity.id === 'puerto') continue;
      for (const s of solid) {
        if (o.position.zone === s.id) continue;
        expect(around(o.position, s), `${o.identity.id} en ${s.id}`).toBeGreaterThan(s.r);
      }
    }
  });

  it('el planeta se ajusta a lo que hay, con poco mar de más al dar la vuelta', () => {
    expect(world.bounds).toEqual(contentBounds(world, decorCircles(decorSpots(world))));
    expect(rect.left).toBe(world.bounds.left - PLANET_MARGIN.side);
    expect(rect.bottom).toBe(world.bounds.bottom + PLANET_MARGIN.bottom);
    // El mar que da la vuelta es más pequeño que el mapa de T33 a su escala.
    const t33 = periodOf(planetRect(before.bounds));
    expect(period.w * period.h).toBeLessThan(t33.w * t33.h * 0.35);
  });

  it('el barco sale libre del anillo y el runtime acepta el mundo', () => {
    const rt = new WorldRuntime({ ...world, bounds: rect }, { wrap: true });
    const s = world.spawn!;
    expect(dist(rt.safePoint(s.x, s.y, 18), s)).toBeLessThan(1);
  });
});

describe('la ruta (marcas en el agua)', () => {
  it('une sólo la ruta principal, en orden, sin vuelta al puerto (T113)', () => {
    expect(route.stops).toEqual(['puerto', 'cala', 'halloween', 'allday', 'ultima']);
    expect(route.stops).toEqual([...ROUTE_STOPS]);
    // La línea pasa por cada parada, en orden, y acaba en la última isla.
    expect(route.stopAt).toHaveLength(route.stops.length);
    route.stops.forEach((id, i) => {
      const p = route.path[route.stopAt[i]!]!;
      const at = id === 'puerto' ? world.spawn! : byId(world, id).position;
      expect(around(p, at), id).toBeLessThan(0.01);
    });
    expect(route.stopAt[route.stops.length - 1]).toBe(route.path.length - 1);
    expect(route.stopAt).toEqual([...route.stopAt].sort((a, b) => a - b));
  });

  it('las islas opcionales no están en la ruta pero siguen en el mundo, accesibles', () => {
    for (const id of ['fotos', 'tienda', 'canon', 'faro']) {
      expect(route.stops, id).not.toContain(id);
      const o = byId(world, id);
      expect(o.identity.active, id).toBe(true);
      expect(o.position, id).toBeDefined();
    }
    const rt = new WorldRuntime({ ...world, bounds: rect }, { wrap: true });
    for (const id of ['fotos', 'tienda', 'canon', 'faro']) {
      const o = byId(world, id);
      const pt = rt.safePoint(o.position.x, o.position.y + footprintOf(o) + 60, 18);
      expect(around(pt, o.position), id).toBeGreaterThan(0);
    }
  });

  it('la Fiestera baja en la última isla de la ruta (su destino)', () => {
    const spec = rescueMissionOf(world)!;
    const dest = missionDestinationId(world, spec.missionId);
    expect(route.stops.indexOf(dest!)).toBe(route.stops.length - 1);
  });

  it('cada tramo va por el camino más corto del planeta', () => {
    for (let i = 1; i < route.path.length; i++) {
      const a = route.path[i - 1]!;
      const b = route.path[i]!;
      expect(Math.abs(b.x - a.x)).toBeLessThanOrEqual(period.w / 2 + 1e-6);
      expect(Math.abs(b.y - a.y)).toBeLessThanOrEqual(period.h / 2 + 1e-6);
    }
    // Entre dos paradas, la línea no es mucho más larga que el camino corto (rodeos pequeños).
    for (let i = 1; i < route.stopAt.length; i++) {
      let len = 0;
      for (let k = route.stopAt[i - 1]! + 1; k <= route.stopAt[i]!; k++) {
        len += dist(route.path[k - 1]!, route.path[k]!);
      }
      const direct = around(route.path[route.stopAt[i - 1]!]!, route.path[route.stopAt[i]!]!);
      expect(len, `tramo ${i}`).toBeLessThan(direct * 1.3);
    }
  });

  it('sin boyas que unan las islas: la ruta son marcas en el agua, sin pisar nada sólido (T59)', () => {
    // Ni boyas de ruta en lo que calcula /mar…
    expect(route).not.toHaveProperty('buoys');
    // …ni lugares nuevos en el mundo de /mar: las boias que hay son las del
    // mapa compartido (la de la entrada, la de WhatsApp y las informativas),
    // todas con algo que decir o que abrir; las de carrera son del circuito.
    expect(world.objects).toHaveLength(shared.objects.length);
    const boias = (w: WorldConfig) =>
      w.objects.filter((o) => o.identity.category === 'boia').map((o) => o.identity.id);
    expect(boias(world)).toEqual(boias(shared));
    for (const o of world.objects.filter((x) => x.identity.category === 'boia')) {
      expect(
        o.behaviors.some((b) => b.type === 'dialogue' || b.type === 'content'),
        o.identity.id,
      ).toBe(true);
    }
    // Lo que guía son las marcas, a lo largo de toda la ruta.
    expect(route.dashes.length).toBeGreaterThan(route.stops.length * 3);
    const rt = new WorldRuntime({ ...world, bounds: rect }, { wrap: true });
    const solids = [...rt.solidObstacles(), ...decorCircles(decorSpots(world))];
    for (const b of route.dashes) {
      expect(b.x).toBeGreaterThanOrEqual(rect.left);
      expect(b.x).toBeLessThan(rect.right);
      expect(b.y).toBeGreaterThanOrEqual(rect.top);
      expect(b.y).toBeLessThan(rect.bottom);
      for (const c of solids) expect(around(b, c)).toBeGreaterThanOrEqual(c.radius + 20 - 1e-6);
    }
  });

  it('el mar vivo queda junto a la ruta, sin amontonarse', () => {
    const near = world.objects.filter((o) =>
      (ROUTE_NEIGHBOURS as readonly string[]).includes(o.identity.category),
    );
    expect(near.length).toBeGreaterThan(0);
    for (const o of near) {
      // El remolino, que además huye de las fichas y de la carretera, puede quedar algo más lejos.
      const limit = o.identity.category === 'remolino' ? WHIRLPOOL_NEAR : ROUTE.near;
      expect(nearestOnRoute(route, o.position, period).d, o.identity.id).toBeLessThanOrEqual(
        limit + 1,
      );
    }
    for (let i = 0; i < near.length; i++) {
      for (let j = i + 1; j < near.length; j++) {
        expect(around(near[i]!.position, near[j]!.position)).toBeGreaterThan(60);
      }
    }
    // Se mueven con lo suyo: los sitios donde reaparecen los restos siguen alrededor.
    const r = byId(world, 'restos-1');
    const spawn = r.behaviors.find((b) => b.type === 'spawn');
    const positions = spawn?.type === 'spawn' ? (spawn.params.positions ?? []) : [];
    expect(positions.length).toBeGreaterThan(0);
    for (const p of positions) expect(around(p, r.position)).toBeLessThan(100);
  });

  it('de una parada a la siguiente, unos segundos a velocidad normal con el piloto', () => {
    const rt = new WorldRuntime({ ...world, bounds: rect }, { wrap: true });
    const decor = decorCircles(decorSpots(world));
    const cfg = { ...DEFAULT_SHIP_CONFIG, radius: 18 };
    /** s del piloto automático (sin turbo) de un punto a la orilla de un lugar (Mar3D.setCourse). */
    const sail = (from: { x: number; y: number }, id: string) => {
      const o = byId(world, id);
      const reach = footprintOf(o) + cfg.radius + 40;
      const s = createShipState(from.x, from.y, -Math.PI / 2);
      const d0 = shortest(o.position, from, period);
      const l = Math.hypot(d0.dx, d0.dy) || 1;
      const target = {
        x: o.position.x + (d0.dx / l) * reach,
        y: o.position.y + (d0.dy / l) * reach,
      };
      const dt = 1 / 60;
      for (let t = 0; t < 60; t += dt) {
        const r = steer(s, target, [...rt.solidObstacles(), ...decor], {
          shipRadius: cfg.radius,
          period,
        });
        if (r.arrived) return { t, at: { x: s.x, y: s.y } };
        stepShip(
          s,
          { dirX: r.dirX, dirY: r.dirY, throttle: r.throttle, drift: false },
          rt.shipConfig(cfg),
          dt,
        );
        rt.step(s, cfg, dt);
        pushOut(s, decor, cfg.radius, period);
      }
      return { t: Infinity, at: { x: s.x, y: s.y } };
    };
    // Del puerto a la isla del evento (lo que hace «Entradas» sin turbo).
    const toEvent = sail(world.spawn!, 'allday');
    expect(toEvent.t).toBeLessThan(10 * (220 / cfg.maxSpeed));
    // Y a lo largo de la ruta, parada tras parada.
    let at: { x: number; y: number } = world.spawn!;
    const legs: number[] = [];
    for (const id of route.stops.slice(1)) {
      const leg = sail(at, id);
      legs.push(leg.t);
      at = leg.at;
    }
    expect(Math.max(...legs)).toBeLessThan(12 * (220 / cfg.maxSpeed));
    expect(median(legs)).toBeLessThan(8 * (220 / cfg.maxSpeed));
    console.info(
      `T50 piloto sin turbo: puerto → allday ${toEvent.t.toFixed(1)} s; tramos ${legs
        .map((t) => t.toFixed(1))
        .join(' / ')} s`,
    );
  });
});

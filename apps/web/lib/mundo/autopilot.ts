import { DEFAULT_SHIP_CONFIG } from '@boia/engine/headless';
import type { Vec2, WorldObject } from '@boia/world';

/**
 * Piloto automático de «Ir a la isla» en /juego (T43, D-23 punto 5,
 * REQ-COM-036): desde una tarjeta de descuento, el barco navega solo hasta la
 * isla del evento del código, en turbo como el viaje de «Entradas» de /mar
 * (plan 003 T35), y se puede saltar. Sin E/S: el juego llama a `stepVoyage`
 * en cada paso del motor y pone el barco donde dice (`game.moveShip`, que
 * nunca lo deja en tierra ni dentro de una isla); llegar al radio de la isla
 * abre su panel como si se hubiera llegado navegando.
 */

/** Velocidad del turbo: 2,6× la del barco, como el de /mar (T35). muestra */
export const VOYAGE_SPEED = DEFAULT_SHIP_CONFIG.maxSpeed * 2.6;
/** s que dura como mucho un viaje normal: más lejos, más rápido. muestra */
export const VOYAGE_TARGET_S = 8;
/** s tras los que se llega igual (como el tope de 20 s de /mar, más corto). muestra */
export const VOYAGE_MAX_S = 12;
/** s sin acercarse (atascado contra la costa) tras los que se llega de un salto. muestra */
export const VOYAGE_STALL_S = 0.75;
/** u más allá del casco de la isla donde para el barco. muestra */
const ARRIVAL_MARGIN = 60;

export interface Voyage {
  placeId: string;
  name: string;
  /** Evento del código, si lo hay. */
  eventId: string | null;
  /** Dónde para el barco: dentro del radio de la isla, fuera de su casco. */
  arrival: Vec2;
  /** u/s de este viaje. */
  speed: number;
  elapsed: number;
  /** Menor distancia a la llegada vista hasta ahora, y cuánto hace. */
  best: number;
  stuck: number;
}

export type VoyageStep = { kind: 'move' | 'arrive'; x: number; y: number; heading: number };

/** Lo que ocupa el casco de un lugar (sus piezas de colisión incluidas). */
function hullReach(o: WorldObject): number {
  const g = o.geometry;
  const parts = (g.collisionParts ?? []).map((p) => Math.hypot(p.dx, p.dy) + p.radius);
  return Math.max(g.collision?.radius ?? 0, ...parts, 0);
}

/**
 * Dónde para el barco al llegar a una isla: en la recta desde `from`, dentro
 * de su radio de proximidad (para que su panel se abra) y fuera del casco.
 */
export function arrivalPoint(o: WorldObject, from: Vec2): Vec2 {
  const reach = o.geometry.proximityRadius ?? o.geometry.activation?.radius ?? 0;
  const hull = hullReach(o);
  const d = reach > 0 ? Math.max(hull + ARRIVAL_MARGIN, Math.min(reach * 0.55, reach - 30)) : hull;
  const dx = from.x - o.position.x;
  const dy = from.y - o.position.y;
  const len = Math.hypot(dx, dy);
  // Encima de la isla (o sin dirección): se llega por el sur, como `?cerca=`.
  const ux = len > 1 ? dx / len : 0;
  const uy = len > 1 ? dy / len : 1;
  return { x: o.position.x + ux * d, y: o.position.y + uy * d };
}

export function planVoyage(o: WorldObject, ship: Vec2, eventId: string | null = null): Voyage {
  const arrival = arrivalPoint(o, ship);
  const dist = Math.hypot(arrival.x - ship.x, arrival.y - ship.y);
  return {
    placeId: o.identity.id,
    name: o.identity.name,
    eventId,
    arrival,
    speed: Math.max(VOYAGE_SPEED, dist / VOYAGE_TARGET_S),
    elapsed: 0,
    best: dist,
    stuck: 0,
  };
}

/** Rumbo de mundo (rad) de `a` a `b`: el mismo convenio que el barco. */
const headingTo = (a: Vec2, b: Vec2) => Math.atan2(b.y - a.y, b.x - a.x);

/**
 * Un paso del viaje desde donde está el barco. Llega (`arrive`) al tocar la
 * llegada, si se atasca o si se acaba el tiempo: en esos dos casos, de un
 * salto, como «Saltar».
 */
export function stepVoyage(v: Voyage, ship: Vec2, dt: number): VoyageStep {
  v.elapsed += dt;
  const dx = v.arrival.x - ship.x;
  const dy = v.arrival.y - ship.y;
  const dist = Math.hypot(dx, dy);
  if (dist < v.best - 0.5) {
    v.best = dist;
    v.stuck = 0;
  } else {
    v.stuck += dt;
  }
  const step = v.speed * dt;
  if (dist <= step || v.elapsed >= VOYAGE_MAX_S || v.stuck >= VOYAGE_STALL_S) {
    return { kind: 'arrive', ...v.arrival, heading: headingTo(ship, v.arrival) };
  }
  return {
    kind: 'move',
    x: ship.x + (dx / dist) * step,
    y: ship.y + (dy / dist) * step,
    heading: Math.atan2(dy, dx),
  };
}

/** El juego abierto en la isla de un evento, con el barco llegando (desde fuera del mar). */
export function voyageHref(eventId: string): string {
  return `/juego?evento=${encodeURIComponent(eventId)}&piloto=1`;
}

/** Parámetro de /juego que arranca el viaje a la isla de `?evento=`. */
export const VOYAGE_PARAM = 'piloto';

/** Teclas que cuentan como tomar el timón (y cancelan el viaje). */
export function isSteeringKey(code: string): boolean {
  return /^(Arrow(Up|Down|Left|Right)|Key[WASD])$/.test(code);
}

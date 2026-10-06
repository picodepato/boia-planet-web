import {
  BOTTLE_LAND_CLEARANCE,
  type ShipPose,
  type SpotTest,
  bottleSpotProblem,
  findReadableDropSpot,
  isSeaSpot,
  nearbyBottles,
  nearestSeaSpot,
  readableSpot,
  relocateBottle,
  sheetZones,
} from '@boia/engine/bottles';
import type { Vec2, WorldConfig } from '@boia/world';
import { decorCircles, decorSpots } from './engine/compact';
import { type PointMap, pointMap } from './engine/compress';
import { type Period, periodOf, planetRect, shortest, wrapIn } from './engine/wrap';

/**
 * Las botellas en el mar 3D (T56, REQ-IDE-040…044), sin three.js. El
 * repositorio guarda cada botella con su posición del mapa compartido (la
 * que valida, la misma que usaba /juego); aquí se pasa al planeta de /mar
 * (`pointMap`) y, si cae en tierra, al agua más cercana. Al echar una, el
 * sitio junto al barco se busca en el planeta y se guarda de vuelta en el
 * mapa compartido.
 */

export interface MarBottle {
  id: string;
  /** u de motor del mundo de /mar. */
  x: number;
  y: number;
  mine: boolean;
  read: boolean;
}

/** Lo que hace falta de una botella del repositorio (`BottleView`). */
export interface StoredBottle extends Vec2 {
  id: string;
  isMine: boolean;
  read: boolean;
}

/**
 * El agua del planeta de /mar donde puede flotar una botella: dentro del
 * planeta (con su margen), fuera de las islas y lo sólido, y fuera del
 * decorado propio (castillo, Explanada, islote de la cueva).
 */
export function marSea(mar: WorldConfig): SpotTest {
  const planet = { ...mar, bounds: planetRect(mar.bounds) };
  const decor = decorCircles(decorSpots(mar));
  return (p) =>
    bottleSpotProblem(planet, p) === null &&
    decor.every((c) => Math.hypot(p.x - c.x, p.y - c.y) >= c.radius + BOTTLE_LAND_CLEARANCE);
}

/** El periodo del planeta de /mar (u de motor): da la vuelta por los dos lados. */
export const marPeriod = (mar: WorldConfig): Period => periodOf(planetRect(mar.bounds));

/**
 * Donde una botella flota y se puede leer (T88): el agua de `marSea` y,
 * además, lejos de toda isla cuya ficha se abre sola (su radio de ficha más
 * el de lectura más un margen), por el camino corto del planeta.
 */
export function marReadable(mar: WorldConfig): SpotTest {
  const sea = marSea(mar);
  const readable = readableSpot(sheetZones(mar), marPeriod(mar));
  return (p) => sea(p) && readable(p);
}

/**
 * Las botellas del repositorio en el mar de /mar; las que no tienen sitio,
 * fuera. Las que caen en tierra o donde no se pueden leer (junto a una isla,
 * T88) pasan al agua legible más cercana, siempre la misma para la misma botella.
 */
export function placeBottles(
  list: readonly StoredBottle[],
  shared: WorldConfig,
  mar: WorldConfig,
  map: PointMap = pointMap(shared),
): MarBottle[] {
  const readable = marReadable(mar);
  // Se guarda en u enteras: el sitio redondeado también tiene que valer.
  const ok: SpotTest = (p) => readable({ x: Math.round(p.x), y: Math.round(p.y) });
  const out: MarBottle[] = [];
  for (const b of list) {
    const q = map.toMar(b);
    const spot = relocateBottle(ok, q);
    if (!spot) continue;
    out.push({
      id: b.id,
      x: Math.round(spot.x),
      y: Math.round(spot.y),
      mine: b.isMine,
      read: b.read,
    });
  }
  return out;
}

/**
 * Dónde se guarda la botella que echa el barco (posición del mapa
 * compartido, la que valida el repositorio): junto a la popa en el planeta
 * donde se pueda leer (T88) o, junto a una isla, en el agua legible más
 * cercana; de vuelta en el mapa, en su agua. null si no hay sitio.
 */
export function dropSpot(
  shared: WorldConfig,
  mar: WorldConfig,
  ship: ShipPose,
  map: PointMap = pointMap(shared),
): Vec2 | null {
  const ok = marReadable(mar);
  const rect = planetRect(mar.bounds);
  const wrap = (p: Vec2) => ({
    x: wrapIn(p.x, rect.left, rect.right),
    y: wrapIn(p.y, rect.top, rect.bottom),
  });
  const q = findReadableDropSpot((p) => ok(wrap(p)), ship);
  if (!q) return null;
  const p = map.toShared(wrap(q));
  if (isSeaSpot(shared, p)) return p;
  // Si el punto cae fuera del mapa (el margen del planeta), se busca desde su borde.
  const b = shared.bounds;
  const inside = {
    x: Math.min(b.right, Math.max(b.left, p.x)),
    y: Math.min(b.bottom, Math.max(b.top, p.y)),
  };
  return nearestSeaSpot(shared, inside);
}

/**
 * Ids de las botellas cerca del barco (REQ-IDE-041), por el camino corto del
 * planeta, de la más cercana a la más lejana; las que ya estaban cerca
 * (`previous`) no se pierden al frenar.
 */
export function bottlesNear(
  ship: Vec2,
  bottles: readonly MarBottle[],
  previous: ReadonlySet<string>,
  period: Period,
): string[] {
  const near = bottles.map((b) => {
    const d = shortest(ship, b, period);
    return { id: b.id, x: ship.x + d.dx, y: ship.y + d.dy };
  });
  return nearbyBottles(ship, near, previous);
}

import type { Vec2, WorldConfig, WorldObject } from '@boia/world';
import { BOTTLE_FIND_RADIUS } from './finder';
import { type ShipPose, type SpotTest, findDropSpotWhere, nearestSpotWhere } from './sea';

/**
 * Botellas donde se pueden leer (T88, decisión 13 del plan 008). Al acercarse
 * a una isla se abre sola su ficha (`content_open`), y con una ficha abierta
 * no salen los botones de las botellas cercanas: una botella que se
 * encuentra desde dentro de ese radio no se puede leer. La regla: cada
 * botella queda, de toda isla cuya ficha se abre sola, a su radio de ficha
 * más el de lectura (`BOTTLE_FIND_RADIUS`) más un margen. Así, desde
 * cualquier punto donde la botella aparece cerca, la ficha está cerrada.
 * Lo pequeño que también abre ficha (la boia del WhatsApp, en el puerto) sólo
 * aparta la botella de su ficha más el margen: se rodea sin entrar en ella.
 *
 * Sin DOM ni three.js: la usan /mar (al echar una y al colocar las
 * guardadas) y las botellas globales (T93).
 */

/** u de margen además del radio de ficha (y del de lectura, en las islas). muestra */
export const BOTTLE_READ_MARGIN = 30;

/** Histéresis de proximidad cuando el mundo no la da (la misma que el motor). */
const DEFAULT_HYSTERESIS = 12;

/** Una zona donde se abre sola una ficha: centro (u de motor) y radio de ficha. */
export interface SheetZone {
  id: string;
  x: number;
  y: number;
  /** u hasta donde la ficha sigue abierta (proximidad + histéresis). */
  radius: number;
  /** u que una botella guarda del centro (`bottleKeepAway`). */
  keepAway: number;
}

/** Periodo del planeta (u): las distancias van por el camino corto. null: sin vuelta. */
export interface WrapPeriod {
  w: number;
  h: number;
}

/**
 * Radio en el que la ficha de `o` está abierta, o null si `o` no abre ficha
 * sola. El motor abre el contenido al entrar en proximidad (o al tocar, si
 * no hay proximidad) y lo cierra al salir de proximidad + histéresis.
 */
export function sheetRadius(o: WorldObject): number | null {
  if (!o.identity.active) return null;
  if (!o.behaviors.some((b) => b.type === 'content')) return null;
  const prox = o.behaviors.find((b) => b.type === 'proximity');
  const radius =
    (prox?.type === 'proximity' ? prox.params.radius : undefined) ?? o.geometry.proximityRadius;
  if (radius !== undefined && radius !== null) {
    const hysteresis = prox?.type === 'proximity' ? prox.params.hysteresis : DEFAULT_HYSTERESIS;
    return radius + hysteresis;
  }
  return o.geometry.activation?.radius ?? o.geometry.collision?.radius ?? null;
}

/**
 * u que una botella guarda del centro de una zona de ficha de radio `radius`:
 * de una isla, ficha + lectura + margen; de lo demás, ficha + margen.
 */
export function bottleKeepAway(radius: number, island: boolean): number {
  return radius + (island ? BOTTLE_FIND_RADIUS : 0) + BOTTLE_READ_MARGIN;
}

/** Las zonas de ficha del mundo, en su orden. */
export function sheetZones(world: WorldConfig): SheetZone[] {
  const out: SheetZone[] = [];
  for (const o of world.objects) {
    const radius = sheetRadius(o);
    if (radius === null) continue;
    out.push({
      id: o.identity.id,
      x: o.position.x,
      y: o.position.y,
      radius,
      keepAway: bottleKeepAway(radius, o.identity.category === 'isla'),
    });
  }
  return out;
}

function wrapD(d: number, p: number): number {
  return p > 0 ? d - p * Math.round(d / p) : d;
}

/** La zona que impide leer una botella en `p`, o null si se puede leer. */
export function unreadableBecause(
  zones: readonly SheetZone[],
  p: Vec2,
  period: WrapPeriod | null = null,
): SheetZone | null {
  for (const z of zones) {
    const dx = period ? wrapD(p.x - z.x, period.w) : p.x - z.x;
    const dy = period ? wrapD(p.y - z.y, period.h) : p.y - z.y;
    if (Math.hypot(dx, dy) < z.keepAway) return z;
  }
  return null;
}

/** ¿Se lee una botella en `p`? (lejos de toda ficha que se abre sola). */
export function readableSpot(zones: readonly SheetZone[], period: WrapPeriod | null = null): SpotTest {
  return (p) => unreadableBecause(zones, p, period) === null;
}

/** u hasta donde se busca agua legible al recolocar una botella. */
export const BOTTLE_RELOCATE_MAX = 1600;

/**
 * Dónde queda una botella guardada en `p`: ahí mismo si cumple `ok` (agua y
 * legible); si no, el punto válido más cercano. Determinista: la misma
 * botella cae siempre en el mismo sitio. null si no hay sitio.
 */
export function relocateBottle(ok: SpotTest, p: Vec2): Vec2 | null {
  return nearestSpotWhere(ok, p, BOTTLE_RELOCATE_MAX);
}

/**
 * Dónde cae la botella que echa el barco: junto a la popa si ahí cumple `ok`
 * (`findDropSpotWhere`); si el barco está cerca de una isla, el agua legible
 * más cercana (la botella se aleja a la deriva hasta donde se puede leer).
 */
export function findReadableDropSpot(ok: SpotTest, ship: ShipPose): Vec2 | null {
  return findDropSpotWhere(ok, ship) ?? relocateBottle(ok, ship);
}

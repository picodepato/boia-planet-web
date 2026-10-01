import type { WorldObject } from '@boia/world';
import type { PlaceRequest } from '../world-handoff';

/**
 * Llegada a un lugar sin conducir (REQ-ENT-034, REQ-AVE-022, T44): los
 * accesos de la landing (Tickets, Fotos, Tienda) abrían el 2D con
 * `?ir=<lugar>` (el mar 3D, T55, navega hasta allí: `app/mar/voyage.ts`); el barco entra navegando unos segundos hasta su punto seguro
 * (al sur del lugar, fuera de su radio: así no concede premios, visitas ni
 * descubrimientos, REQ-ENT-039) y se abre el panel del lugar. Cerrar el panel
 * deja el barco allí, listo para navegar. La entrada es breve y se salta con
 * cualquier tecla o toque; con movimiento reducido, el barco aparece ya allí.
 */

/** u que se queda el barco fuera del radio del lugar (también `?cerca=`). muestra */
export const NEAR_MARGIN = 140;
/** u que recorre el barco al entrar navegando hasta el punto seguro. muestra */
export const ARRIVAL_RUN = 720;
/** Duración de la entrada navegando. muestra */
export const ARRIVAL_MS = 1600;
/** Rumbo de llegada: hacia el norte, con el lugar delante. */
export const ARRIVAL_HEADING = -Math.PI / 2;

export interface Point {
  x: number;
  y: number;
}

/** Punto seguro junto a un lugar: al sur de él, fuera de todos sus radios. */
export function approachPoint(o: WorldObject): Point {
  const reach = Math.max(
    o.geometry.proximityRadius ?? 0,
    o.geometry.activation?.radius ?? 0,
    o.geometry.collision?.radius ?? 0,
  );
  return { x: o.position.x, y: o.position.y + reach + NEAR_MARGIN };
}

/** Qué panel abre el lugar al llegar. */
export type ArrivalPanel =
  | { kind: 'event'; objectId: string; eventId: string }
  | { kind: 'place'; objectId: string; target: 'info' | 'photos' | 'store'; ref?: string };

export interface ArrivalPlan {
  placeId: string;
  from: Point;
  to: Point;
  heading: number;
  panel: ArrivalPanel | null;
}

const contentOf = (o: WorldObject) =>
  o.behaviors
    .filter((b) => b.type === 'content')
    .map((b) => b.params as { target?: unknown; ref?: unknown })[0];

/**
 * Plan de llegada a lo pedido en la URL, o `null` si el lugar no existe o no
 * está activo en este mundo. En una isla de evento, `eventId` (si existe)
 * manda sobre el evento de la isla; si no, el suyo.
 */
export function planArrival(
  objects: readonly WorldObject[],
  request: PlaceRequest,
  eventExists: (id: string) => boolean,
): ArrivalPlan | null {
  const o = objects.find((x) => x.identity.id === request.placeId && x.identity.active);
  if (!o) return null;
  const to = approachPoint(o);
  const from = { x: to.x, y: to.y + ARRIVAL_RUN };
  const c = contentOf(o);
  const ref = typeof c?.ref === 'string' ? c.ref : undefined;
  let panel: ArrivalPanel | null = null;
  if (c?.target === 'event') {
    const wanted = request.eventId && eventExists(request.eventId) ? request.eventId : ref;
    if (wanted && eventExists(wanted))
      panel = { kind: 'event', objectId: o.identity.id, eventId: wanted };
  } else if (c?.target === 'info' || c?.target === 'photos' || c?.target === 'store') {
    panel = { kind: 'place', objectId: o.identity.id, target: c.target, ...(ref ? { ref } : {}) };
  }
  return { placeId: o.identity.id, from, to, heading: ARRIVAL_HEADING, panel };
}

/** Dónde va el barco en el instante `t` (0..1) de la llegada: frena al final. */
export function arrivalPoint(plan: ArrivalPlan, t: number): Point {
  const k = Math.min(1, Math.max(0, t));
  const eased = 1 - (1 - k) ** 3;
  return {
    x: plan.from.x + (plan.to.x - plan.from.x) * eased,
    y: plan.from.y + (plan.to.y - plan.from.y) * eased,
  };
}

interface Movable {
  moveShip(x: number, y: number, heading?: number): Point;
}

/**
 * Lleva el barco del inicio al punto seguro en `ARRIVAL_MS` y llama a
 * `onDone` al llegar (una vez). Una tecla o un toque la saltan. Devuelve la
 * función que la cancela sin llamar a `onDone`.
 */
export function runArrival(
  game: Movable,
  plan: ArrivalPlan,
  onDone: () => void,
  opts: { reducedMotion?: boolean } = {},
): () => void {
  let raf = 0;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    cleanup();
    game.moveShip(plan.to.x, plan.to.y, plan.heading);
    onDone();
  };
  const cleanup = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    window.removeEventListener('keydown', finish);
    window.removeEventListener('pointerdown', finish);
  };
  if (opts.reducedMotion) {
    finish();
    return () => {};
  }
  const start = performance.now();
  const frame = (now: number) => {
    const t = (now - start) / ARRIVAL_MS;
    if (t >= 1) return finish();
    const p = arrivalPoint(plan, t);
    game.moveShip(p.x, p.y, plan.heading);
    raf = requestAnimationFrame(frame);
  };
  game.moveShip(plan.from.x, plan.from.y, plan.heading);
  window.addEventListener('keydown', finish);
  window.addEventListener('pointerdown', finish);
  raf = requestAnimationFrame(frame);
  return () => {
    done = true;
    cleanup();
  };
}

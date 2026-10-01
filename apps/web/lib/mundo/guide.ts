import type { RescuePhase } from '@boia/engine/mission';
import type { WorldObject } from '@boia/world';

/**
 * Lo que el mar señala (T59): la misión central (la Boia Fiestera), los tres
 * descuentos escondidos y los minijuegos. Sin React ni motor, todo sale de
 * los datos del mapa:
 *
 * - la misión es el objeto con `params.mission`; mientras espera, se señala
 *   a ella; a bordo, a su destino (`params.missionDestination`); entregada,
 *   ya no;
 * - un descuento es un lugar con un premio `reward` de tipo `discount`, o el
 *   de la misión (`params.missionReward.discount` del destino); deja de
 *   señalarse cuando el código ya se encontró;
 * - un minijuego es un lugar con `start_minigame`; deja de señalarse al
 *   llegar a él.
 *
 * Los descuentos pendientes son los «?» del minimapa; el delfín y las boies
 * informativas (`params.guide`) llevan hasta cualquiera de estos sitios. Los
 * secretos sin premio no salen aquí: siguen escondidos (REQ-AVE-015).
 */

export type GuideKind = 'mission' | 'discount' | 'minigame';

export interface GuideSpot {
  kind: GuideKind;
  /** El objeto que se señala (la Fiestera, el náufrago, el ánfora, la isla). */
  objectId: string;
  /** El lugar al que se pone rumbo (el destino de la misión, a bordo). */
  placeId: string;
  /** El código que espera ahí, si lo hay y no se ha encontrado. */
  discountId: string | null;
  x: number;
  y: number;
}

export interface GuideState {
  /** Paso de la misión de ahora (null: el mundo no tiene misión o aún carga). */
  phase: RescuePhase | null;
  /** Destino guardado de la misión (id de lugar), o null. */
  destination: string | null;
  /** Lugares y objetos ya encontrados (islas visitadas, objetos recogidos). */
  found: { has(id: string): boolean };
  /** Códigos ya encontrados (por id de descuento). */
  foundDiscounts: { has(id: string): boolean };
}

/** El código que da un lugar del mapa (su premio `discount`), o null. */
export function discountRefOf(o: WorldObject): string | null {
  for (const b of o.behaviors) {
    if (b.type === 'reward' && b.params.kind === 'discount' && b.params.ref) return b.params.ref;
  }
  return null;
}

/** El código que da la entrega de la misión en su destino (`missionReward.discount`). */
export function missionDiscountOf(
  objects: readonly WorldObject[],
  destination: string | null,
): string | null {
  if (!destination) return null;
  const o = objects.find((x) => x.identity.id === destination && x.identity.active);
  const d = (o?.params?.missionReward as { discount?: unknown } | undefined)?.discount;
  return typeof d === 'string' && d.length > 0 ? d : null;
}

const missionCharacter = (objects: readonly WorldObject[]) =>
  objects.find(
    (o) =>
      o.identity.active && typeof o.params?.mission === 'string' && o.params.mission.length > 0,
  );

/** Destino de la misión para las partidas nuevas (el lugar con `missionDestination`). */
function newGameDestination(objects: readonly WorldObject[], missionId: string): string | null {
  return (
    objects.find((o) => o.identity.active && o.params?.missionDestination === missionId)?.identity
      .id ?? null
  );
}

const spotAt = (
  kind: GuideKind,
  o: WorldObject,
  place: WorldObject,
  discountId: string | null,
): GuideSpot => ({
  kind,
  objectId: o.identity.id,
  placeId: place.identity.id,
  discountId,
  x: place.position.x,
  y: place.position.y,
});

/** Todo lo que el mar señala ahora, en el orden del mapa (la misión primero). */
export function guideSpots(objects: readonly WorldObject[], state: GuideState): GuideSpot[] {
  const out: GuideSpot[] = [];
  const character = missionCharacter(objects);
  if (character) {
    const missionId = character.params!.mission as string;
    const destination = state.destination ?? newGameDestination(objects, missionId);
    const discount = missionDiscountOf(objects, destination);
    const pending = discount && !state.foundDiscounts.has(discount) ? discount : null;
    const phase = state.phase;
    if (phase === null || phase === 'loading' || phase === 'waiting') {
      out.push(spotAt('mission', character, character, pending));
    } else if (phase === 'boarding' || phase === 'aboard') {
      const place = objects.find((o) => o.identity.id === destination && o.identity.active);
      if (place) out.push(spotAt('mission', character, place, pending));
    }
  }
  for (const o of objects) {
    if (!o.identity.active || o === character) continue;
    const discount = discountRefOf(o);
    if (discount) {
      if (!state.foundDiscounts.has(discount)) out.push(spotAt('discount', o, o, discount));
      continue;
    }
    const minigame = o.behaviors.some((b) => b.type === 'start_minigame');
    if (minigame && !state.found.has(o.identity.id)) out.push(spotAt('minigame', o, o, null));
  }
  return out;
}

/** Los «?» del minimapa: los sitios con un código por encontrar (como mucho, uno por objeto). */
export function discountMarks(spots: readonly GuideSpot[]): GuideSpot[] {
  return spots.filter((s) => s.discountId !== null);
}

/**
 * El sitio señalado más cercano a un punto (ni ya al alcance: a menos de
 * `minDistance` u no se guía), o null.
 */
export function nearestSpot(
  spots: readonly GuideSpot[],
  from: { x: number; y: number },
  minDistance = 0,
): GuideSpot | null {
  let best: GuideSpot | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const s of spots) {
    const d = Math.hypot(s.x - from.x, s.y - from.y);
    if (d < minDistance || d >= bestD) continue;
    best = s;
    bestD = d;
  }
  return best;
}

/**
 * Adónde manda una boia informativa al terminar de hablar: a su sitio
 * (`params.guide`, el id de lo que señala) si sigue pendiente; si no, a lo
 * pendiente más cercano a ella. null si no es una boia que guíe o ya no
 * queda nada.
 */
export function buoyGuide(
  objects: readonly WorldObject[],
  buoyId: string,
  spots: readonly GuideSpot[],
): GuideSpot | null {
  const buoy = objects.find((o) => o.identity.id === buoyId);
  const guide = buoy?.params?.guide;
  if (!buoy || typeof guide !== 'string') return null;
  return (
    spots.find((s) => s.objectId === guide || s.placeId === guide) ??
    nearestSpot(spots, buoy.position)
  );
}

import { EVENT_STATE_BEHAVIOR, type BoiaEvent, type Discount } from '@boia/contracts';
import type { PlacePatch, SkinPatch } from '@boia/store';
import {
  BOARD_REF,
  type Behavior,
  type ComposedWorld,
  MISSING_SKIN_ASSET,
  type Place,
  type PlaceSkin,
  type SharedMap,
  type WorldRegistry,
  type WorldSkin,
  composeWorld,
} from '@boia/world';
import { t } from '../i18n';

/**
 * El mundo con los cambios del Admin de la demo (T26, D-20), sin E/S: el
 * mapa compartido de `@boia/world` más los cambios del repositorio
 * (`content.places()` por id de lugar, `content.skins()` por mundo y lugar) y
 * los eventos, que deciden qué evento abre cada isla. Lo usan el Admin (para
 * validar y previsualizar) y el 2D (para jugar lo que el Admin dejó).
 *
 * - Posición, parámetros y activado van por id de lugar y valen en todos los
 *   mundos (mover un lugar lo mueve en todos).
 * - Nombre, textos y «oculto» van por (mundo, lugar).
 * - La salida, el puerto y el aterrizaje de la entrada son puntos del mapa con
 *   ids reservados (`MAP_POINTS`), guardados como un lugar más.
 * - Un evento se liga a una isla con su `islandId`; la isla no es el evento:
 *   sin evento vigente abre su panel de isla con sus recuerdos (REQ-COM-002).
 */

/** Puntos del mapa que no son lugares, con su id reservado en el repositorio. */
export const MAP_POINTS = {
  spawn: 'mapa:salida',
  port: 'mapa:puerto',
  introLanding: 'mapa:entrada',
} as const;
export type MapPointKey = keyof typeof MAP_POINTS;
export const MAP_POINT_KEYS = Object.keys(MAP_POINTS) as MapPointKey[];

export const MAP_POINT_LABELS: Record<MapPointKey, string> = {
  spawn: t('admin.world.salidaDelBarco'),
  port: t('admin.world.puerto'),
  introLanding: t('admin.world.aterrizajeDeLaEntrada'),
};

export function isMapPointId(id: string): boolean {
  return (Object.values(MAP_POINTS) as string[]).includes(id);
}

/**
 * Parámetro con nombre propio: el radio de proximidad va a la geometría del
 * lugar. El resto de `params` se mezcla con los `params` del lugar (vaivén,
 * remolino, destino de misión…), con la forma que decide `@boia/world`.
 */
export const PROXIMITY_PARAM = 'proximityRadius';

export interface WorldContent {
  places: Readonly<Record<string, PlacePatch>>;
  skins: Readonly<Record<string, Readonly<Record<string, SkinPatch>>>>;
  /** Eventos para ligar a sus islas; null deja las islas como en el mapa. */
  events: readonly BoiaEvent[] | null;
  /**
   * Descuentos con su escondite (`hiddenAt`, T43): el lugar pasa a entregar
   * ese código. Sin ellos, los lugares entregan lo que nombra el mapa.
   */
  discounts?: readonly Discount[] | undefined;
  /**
   * Destino de las partidas nuevas de cada misión por mundo (REQ-AVE-011,
   * T45): mundo → misión → id de lugar. Sin él, el del mapa.
   */
  missionDestinations?: Readonly<Record<string, Readonly<Record<string, string>>>> | undefined;
  now?: Date;
}

export const EMPTY_WORLD_CONTENT: WorldContent = { places: {}, skins: {}, events: null };

/** Un punto del mapa: el del mapa o el que dejó el Admin. */
export function mapPoint(
  map: SharedMap,
  key: MapPointKey,
  places: Readonly<Record<string, PlacePatch>> = {},
): { x: number; y: number } | null {
  const base = key === 'spawn' ? map.spawn : key === 'port' ? map.port : map.introLanding;
  if (!base) return null;
  const p = places[MAP_POINTS[key]];
  return { x: p?.x ?? base.x, y: p?.y ?? base.y };
}

function patchPlace(p: Place, patch: PlacePatch | undefined): Place {
  if (!patch) return p;
  const next: Place = { ...p };
  if (patch.x !== undefined || patch.y !== undefined) {
    next.position = { ...p.position, x: patch.x ?? p.position.x, y: patch.y ?? p.position.y };
  }
  if (patch.enabled !== undefined) next.active = patch.enabled;
  if (patch.params) {
    const { [PROXIMITY_PARAM]: radius, ...rest } = patch.params;
    if (typeof radius === 'number') next.geometry = { ...p.geometry, proximityRadius: radius };
    if (Object.keys(rest).length > 0) next.params = { ...(p.params ?? {}), ...rest };
  }
  return next;
}

/** El mapa con los cambios compartidos (posición, parámetros, activado y puntos del mapa). */
export function applyPlacePatches(
  map: SharedMap,
  places: Readonly<Record<string, PlacePatch>>,
): SharedMap {
  const spawn = mapPoint(map, 'spawn', places)!;
  const port = mapPoint(map, 'port', places);
  const intro = mapPoint(map, 'introLanding', places)!;
  return {
    ...map,
    spawn: { ...map.spawn, ...spawn },
    ...(map.port && port ? { port: { ...map.port, ...port } } : {}),
    introLanding: intro,
    places: map.places.map((p) => patchPlace(p, places[p.id])),
  };
}

/** Los textos de un lugar en un mundo: los del mapa y, encima, los de su skin. */
export function placeTexts(
  map: SharedMap,
  skin: WorldSkin,
  placeId: string,
): Record<string, string> {
  const place = map.places.find((p) => p.id === placeId);
  const base = (place?.content?.texts ?? {}) as Record<string, string>;
  return { ...base, ...(skin.places[placeId]?.texts ?? {}) };
}

/** La skin de un mundo con los cambios del Admin (nombre, textos, oculto, arte). */
export function applySkinPatches(
  map: SharedMap,
  skin: WorldSkin,
  patches: Readonly<Record<string, SkinPatch>>,
): WorldSkin {
  const known = new Set(map.places.map((p) => p.id));
  const places: Record<string, PlaceSkin> = { ...skin.places };
  const names: Record<string, string> = { ...skin.names };
  for (const [id, patch] of Object.entries(patches)) {
    if (!known.has(id)) continue;
    if (patch.name !== undefined) names[id] = patch.name;
    const base = places[id];
    const touches = patch.texts !== undefined || patch.asset !== undefined || patch.hidden === true;
    if (!base && !touches) continue;
    // Sin skin en este mundo, se queda con el marcador (no se inventa arte).
    const next: PlaceSkin = base ? { ...base } : { asset: MISSING_SKIN_ASSET };
    if (patch.asset !== undefined) next.asset = patch.asset;
    if (patch.texts !== undefined) next.texts = { ...placeTexts(map, skin, id), ...patch.texts };
    if (patch.hidden === true) next.hidden = true;
    else if (patch.hidden === false) delete next.hidden;
    places[id] = next;
  }
  return { ...skin, places, names };
}

// ---------------------------------------------------------------------------
// Eventos e islas

type ContentBehavior = Extract<Behavior, { type: 'content' }>;

function contentOf(p: Pick<Place, 'behaviors'>): ContentBehavior | undefined {
  return p.behaviors.find((b): b is ContentBehavior => b.type === 'content');
}

/** El faro desde el plan 014 (T157): su ficha es el «Tablón del faro», no la de una isla. */
const isBoard = (p: Pick<Place, 'behaviors'>) => contentOf(p)?.params.ref === BOARD_REF;

/**
 * Islas a las que se puede ligar un evento: las de categoría isla cuyo panel
 * es de evento o de isla (no el Puerto de Fotos, la tienda, las de minijuego
 * ni el faro con su tablón). Hoy: las tres islas con entradas (Halloween,
 * Sonido y Nochevieja) y el Puerto de Alicante.
 */
export function eventIslands(map: SharedMap): Place[] {
  return map.places.filter((p) => {
    if (p.category !== 'isla') return false;
    if (p.behaviors.some((b) => b.type === 'start_minigame')) return false;
    if (isBoard(p)) return false;
    const c = contentOf(p);
    return !c || c.params.target === 'event' || c.params.target === 'info';
  });
}

function startOfDay(d: Date): number {
  const s = new Date(d.getTime());
  s.setUTCHours(0, 0, 0, 0);
  return s.getTime();
}

/** ¿El evento sigue vivo (se lista y no ha pasado)? */
export function isCurrentEvent(e: BoiaEvent, now: Date): boolean {
  return EVENT_STATE_BEHAVIOR[e.state].listed && new Date(e.startsAt).getTime() >= startOfDay(now);
}

/** El evento que abre una isla: el próximo vigente ligado a ella, o ninguno. */
export function islandEvent(
  placeId: string,
  events: readonly BoiaEvent[],
  now: Date,
): BoiaEvent | undefined {
  return events
    .filter((e) => e.islandId === placeId && isCurrentEvent(e, now))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
}

/** Recuerdos de una isla: sus eventos ya pasados o terminados (la isla los conserva). */
export function islandMemories(
  placeId: string,
  events: readonly BoiaEvent[],
  now: Date,
): BoiaEvent[] {
  return events
    .filter((e) => e.islandId === placeId && e.state !== 'draft' && !isCurrentEvent(e, now))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
}

/**
 * Liga cada isla con su evento vigente: su panel abre ese evento y vende sus
 * entradas. Una isla de evento sin evento vigente abre su panel de isla (con
 * sus recuerdos) y deja de vender.
 */
export function linkIslandEvents(
  map: SharedMap,
  events: readonly BoiaEvent[],
  now: Date,
): SharedMap {
  const linkable = new Set(eventIslands(map).map((p) => p.id));
  return {
    ...map,
    places: map.places.map((p) => {
      if (!linkable.has(p.id)) return p;
      const current = islandEvent(p.id, events, now);
      const c = contentOf(p);
      if (!current && c?.params.target !== 'event') return p;
      const behaviors: Behavior[] = [];
      let hasContent = false;
      for (const b of p.behaviors) {
        if (b.type === 'content') {
          hasContent = true;
          const rest = { ...b.params };
          delete rest.ref;
          behaviors.push({
            type: 'content',
            params: current
              ? { ...rest, target: 'event', ref: current.id }
              : { ...rest, target: 'info' },
          });
          if (current && !p.behaviors.some((x) => x.type === 'ticket')) {
            behaviors.push({ type: 'ticket', params: { eventId: current.id } });
          }
        } else if (b.type === 'ticket') {
          if (current)
            behaviors.push({ type: 'ticket', params: { ...b.params, eventId: current.id } });
        } else {
          behaviors.push(b);
        }
      }
      if (current && !hasContent) {
        behaviors.push(
          { type: 'content', params: { target: 'event', ref: current.id, closeOnExit: true } },
          { type: 'ticket', params: { eventId: current.id } },
        );
      }
      return { ...p, behaviors };
    }),
  };
}

/**
 * Lugares donde el Admin puede esconder un código (T43, REQ-COM-020): los que
 * ya dan premios (náufrago, restos, secretos…) y no abren un panel (una isla
 * perdería el suyo al enseñar el código).
 */
export function discountHidingPlaces(map: SharedMap): Place[] {
  return map.places.filter(
    (p) =>
      p.behaviors.some((b) => b.type === 'reward' || b.type === 'collectible') &&
      !p.behaviors.some((b) => b.type === 'content'),
  );
}

/**
 * Cada descuento con escondite (`hiddenAt`) pasa a darlo su lugar: el premio
 * de descuento del lugar cambia de código o, si no tenía, se añade uno (una
 * vez por visitante). Si dos se esconden en el mismo lugar, gana el de más
 * prioridad (REQ-COM-020).
 */
export function hideDiscounts(map: SharedMap, discounts: readonly Discount[]): SharedMap {
  const byPlace = new Map<string, Discount>();
  for (const d of discounts) {
    if (!d.hiddenAt) continue;
    const had = byPlace.get(d.hiddenAt);
    if (!had || d.priority > had.priority) byPlace.set(d.hiddenAt, d);
  }
  if (byPlace.size === 0) return map;
  return {
    ...map,
    places: map.places.map((p) => {
      const d = byPlace.get(p.id);
      if (!d) return p;
      let replaced = false;
      const behaviors: Behavior[] = p.behaviors.map((b) => {
        if (b.type !== 'reward' || b.params.kind !== 'discount' || replaced) return b;
        replaced = true;
        return { ...b, params: { ...b.params, ref: d.id } };
      });
      if (!replaced) {
        behaviors.push({
          type: 'reward',
          params: { kind: 'discount', amount: 1, ref: d.id, frequency: 'once' },
        });
      }
      return { ...p, behaviors };
    }),
  };
}

// ---------------------------------------------------------------------------
// Destino de las misiones (REQ-AVE-010, REQ-AVE-011; T45)

/**
 * Puede ser destino de una misión: una isla activa sin minijuego ni tablón
 * (el faro, T157), con radio de llegada (la entrega salta al entrar en él).
 * No un punto, una roca ni un lugar escondido.
 */
export function isDestinationPlace(
  p: Pick<Place, 'category' | 'active' | 'behaviors' | 'geometry'>,
): boolean {
  if (!p.active || p.category !== 'isla') return false;
  if (p.behaviors.some((b) => b.type === 'start_minigame')) return false;
  if (isBoard(p)) return false;
  return (
    p.geometry.proximityRadius !== undefined || p.behaviors.some((b) => b.type === 'proximity')
  );
}

/** Islas que pueden ser destino de una misión en el mapa (con los cambios del Admin). */
export function destinationPlaces(map: SharedMap): Place[] {
  return map.places.filter(isDestinationPlace);
}

/** El lugar que el mapa marca como destino de una misión (`params.missionDestination`). */
export function mapMissionDestination(map: SharedMap, missionId: string): Place | undefined {
  return map.places.find((p) => p.active && p.params?.missionDestination === missionId);
}

/** Misiones del mapa (los lugares con `params.mission`). */
export function mapMissions(map: SharedMap): { missionId: string; place: Place }[] {
  return map.places.flatMap((p) => {
    const m = p.params?.mission;
    return p.active && typeof m === 'string' && m ? [{ missionId: m, place: p }] : [];
  });
}

/**
 * El mapa de un mundo con el destino que fijó el Admin para las partidas
 * nuevas de cada misión: la marca `missionDestination` pasa a ese lugar, que
 * se lleva también el premio de la entrega y un sitio donde dejar al
 * personaje (al sur de la isla, si no tiene uno propio). El destino anterior
 * conserva su sitio y su premio: las partidas empezadas hacia él siguen
 * igual (REQ-AVE-010). Un destino que ya no sirve (desactivado, borrado) no
 * se aplica: la misión sigue con el del mapa, nunca sin destino.
 */
export function withMissionDestinations(
  map: SharedMap,
  byMission: Readonly<Record<string, string>>,
): SharedMap {
  let places = map.places;
  for (const [missionId, placeId] of Object.entries(byMission)) {
    const target = places.find((p) => p.id === placeId);
    const current = places.find((p) => p.active && p.params?.missionDestination === missionId);
    if (!target || !isDestinationPlace(target) || current?.id === placeId) continue;
    const reward = current?.params?.missionReward;
    places = places.map((p) => {
      if (p.id === current?.id) {
        const params = { ...(p.params ?? {}) };
        delete params.missionDestination;
        return { ...p, params };
      }
      if (p.id !== placeId) return p;
      const edge = p.geometry.collision?.radius ?? 0;
      return {
        ...p,
        params: {
          ...(p.params ?? {}),
          missionDestination: missionId,
          ...(p.params?.missionDrop
            ? {}
            : {
                missionDrop: {
                  x: p.position.x,
                  y: Math.round((p.position.y + edge + 8) * 100) / 100,
                  z: 0,
                },
              }),
          ...(reward !== undefined && p.params?.missionReward === undefined
            ? { missionReward: reward }
            : {}),
        },
      };
    });
  }
  return places === map.places ? map : { ...map, places };
}

/** El mapa compartido con todos los cambios que no son de un mundo. */
export function liveMap(registry: WorldRegistry, content: WorldContent): SharedMap {
  let map = applyPlacePatches(registry.map, content.places);
  if (content.discounts) map = hideDiscounts(map, content.discounts);
  return content.events ? linkIslandEvents(map, content.events, content.now ?? new Date()) : map;
}

/** Un mundo con los cambios del Admin. Lanza si el resultado no es un mundo válido. */
export function composeLiveWorld(
  registry: WorldRegistry,
  worldId: string,
  content: WorldContent,
): ComposedWorld {
  const map = withMissionDestinations(
    liveMap(registry, content),
    content.missionDestinations?.[worldId] ?? {},
  );
  const skin = applySkinPatches(map, registry.skin(worldId), content.skins[worldId] ?? {});
  return composeWorld(map, skin);
}

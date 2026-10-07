import {
  COLLISION_DEFAULTS,
  type WorldConfig,
  type WorldObject,
  type WorldRegistry,
  type WorldSkin,
  composeWorld,
} from '@boia/world';
import { missionDestination, rescueMissionOf } from '@boia/engine/mission';
import {
  MAP_POINT_KEYS,
  MAP_POINT_LABELS,
  type WorldContent,
  applySkinPatches,
  composeLiveWorld,
  isMapPointId,
  liveMap,
  mapPoint,
} from './world';
import { isPublished, objectPlaceProblem } from './objects';
import { marWorld } from '../../app/mar/engine/compact';
import { NEAR_MARGIN } from '../mundo/arrival';
import { t } from '../i18n';

/**
 * Validación de un cambio del mundo antes de guardarlo (REQ-ADM-013,
 * REQ-ADM-014), con las mismas reglas que comprueban las pruebas del mar de
 * T09/T20 (`packages/engine/src/world/arcilla.test.ts`):
 * - los ids existen (lugares del mapa o puntos del mapa);
 * - cada lugar queda dentro del mapa y el resultado es un mundo válido para el
 *   esquema de `@boia/world` en todos los mundos;
 * - la salida, el puerto, el aterrizaje de la entrada y todo destino de
 *   teletransporte quedan en el agua (nunca en tierra);
 * - ninguna isla corta el paso: desde la salida se llega a cada lugar que
 *   hace algo;
 * - los parámetros de un lugar cambiado están en su rango seguro
 *   (`PARAM_RANGES`, REQ-ADM-013);
 * - toda misión tiene su destino y todo circuito una ruta válida: salida
 *   (orden 0), al menos dos arcos y órdenes seguidos (REQ-ADM-014).
 * Devuelve el motivo del rechazo, en castellano, o null.
 */

/** Radio del casco (`DEFAULT_SHIP_CONFIG.radius` de @boia/engine). */
export const SHIP_RADIUS = 13.5;
/** Lado de la celda de la inundación (el de las pruebas del mar). */
export const NAV_CELL = 16;

interface Circle {
  x: number;
  y: number;
  radius: number;
}

/** Círculos sólidos de un mundo (objetos activos con COLISIÓN sólida), como el motor. */
export function solidCircles(world: WorldConfig): Circle[] {
  const out: Circle[] = [];
  for (const o of world.objects) {
    if (!o.identity.active || o.state?.visible === false) continue;
    const radius = o.geometry.collision?.radius ?? o.geometry.activation?.radius;
    if (radius === undefined) continue;
    const b = o.behaviors.find((x) => x.type === 'collision');
    if (b?.type !== 'collision') continue;
    if (!(b.params.solid ?? COLLISION_DEFAULTS[b.params.mode].solid)) continue;
    out.push({ x: o.position.x, y: o.position.y, radius });
    if (o.geometry.collision) {
      for (const p of o.geometry.collisionParts ?? []) {
        out.push({ x: o.position.x + p.dx, y: o.position.y + p.dy, radius: p.radius });
      }
    }
  }
  return out;
}

/** ¿Cabe el barco en `p` sin tocar tierra ni salirse del mapa? */
export function isWater(world: WorldConfig, obstacles: Circle[], p: { x: number; y: number }) {
  const b = world.bounds;
  const r = SHIP_RADIUS;
  if (p.x < b.left + r || p.x > b.right - r || p.y < b.top + r || p.y > b.bottom - r) return false;
  return obstacles.every((o) => Math.hypot(p.x - o.x, p.y - o.y) >= o.radius + r);
}

/** Hasta dónde hay que acercarse para que el lugar haga lo suyo. */
function interactionRadius(o: WorldObject): number {
  const r = SHIP_RADIUS;
  const prox = o.geometry.proximityRadius;
  const touch = (o.geometry.activation?.radius ?? o.geometry.collision?.radius ?? 0) + r;
  const collect = o.behaviors.find((x) => x.type === 'collectible');
  const pick = collect?.type === 'collectible' ? (collect.params.radius ?? touch) + r : 0;
  return Math.max(prox ?? 0, touch, pick);
}

/** Lugares activos que hacen algo y a los que no se llega desde la salida. */
export function unreachablePlaces(
  world: WorldConfig,
  obstacles = solidCircles(world),
): WorldObject[] {
  const b = world.bounds;
  const R = SHIP_RADIUS;
  const cell = NAV_CELL;
  const cols = Math.ceil((b.right - b.left) / cell);
  const rows = Math.ceil((b.bottom - b.top) / cell);
  const cx = (i: number) => b.left + (i + 0.5) * cell;
  const cy = (j: number) => b.top + (j + 0.5) * cell;
  const water = new Uint8Array(cols * rows).fill(1);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = cx(i);
      const y = cy(j);
      if (x < b.left + R || x > b.right - R || y < b.top + R || y > b.bottom - R) {
        water[j * cols + i] = 0;
      }
    }
  }
  for (const o of obstacles) {
    const reach = o.radius + R;
    const i0 = Math.max(0, Math.floor((o.x - reach - b.left) / cell));
    const i1 = Math.min(cols - 1, Math.floor((o.x + reach - b.left) / cell));
    const j0 = Math.max(0, Math.floor((o.y - reach - b.top) / cell));
    const j1 = Math.min(rows - 1, Math.floor((o.y + reach - b.top) / cell));
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        if (Math.hypot(cx(i) - o.x, cy(j) - o.y) < reach) water[j * cols + i] = 0;
      }
    }
  }
  const seen = new Uint8Array(cols * rows);
  const s = world.spawn ?? { x: (b.left + b.right) / 2, y: b.bottom - R * 2 };
  const si = Math.floor((s.x - b.left) / cell);
  const sj = Math.floor((s.y - b.top) / cell);
  if (si >= 0 && sj >= 0 && si < cols && sj < rows && water[sj * cols + si]) {
    const queue = [sj * cols + si];
    seen[queue[0]!] = 1;
    while (queue.length) {
      const k = queue.pop()!;
      const i = k % cols;
      const j = (k - i) / cols;
      const next = [
        i + 1 < cols ? k + 1 : -1,
        i > 0 ? k - 1 : -1,
        j + 1 < rows ? k + cols : -1,
        j > 0 ? k - cols : -1,
      ];
      for (const n of next) {
        if (n < 0 || seen[n] || !water[n]) continue;
        seen[n] = 1;
        queue.push(n);
      }
    }
  }
  const out: WorldObject[] = [];
  for (const o of world.objects) {
    if (!o.identity.active) continue;
    // Decorado sin función (anillo, carriles, posidonia) o sólo roca: no hace falta llegar.
    if (o.behaviors.every((x) => x.type === 'decorative' || x.type === 'collision')) continue;
    const r = interactionRadius(o);
    const i0 = Math.max(0, Math.floor((o.position.x - r - b.left) / cell));
    const i1 = Math.min(cols - 1, Math.floor((o.position.x + r - b.left) / cell));
    const j0 = Math.max(0, Math.floor((o.position.y - r - b.top) / cell));
    const j1 = Math.min(rows - 1, Math.floor((o.position.y + r - b.top) / cell));
    let ok = false;
    for (let i = i0; i <= i1 && !ok; i++) {
      for (let j = j0; j <= j1 && !ok; j++) {
        if (!seen[j * cols + i]) continue;
        if (Math.hypot(cx(i) - o.position.x, cy(j) - o.position.y) <= r) ok = true;
      }
    }
    if (!ok) out.push(o);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Rangos seguros de los parámetros de un lugar (REQ-ADM-013)

/** Rango de un parámetro numérico, con su nombre para el motivo del rechazo. */
export interface ParamRange {
  label: string;
  min: number;
  max: number;
  integer?: boolean;
}

/**
 * Rangos de los parámetros de lugar que lee el motor (`params` del mapa):
 * remolino, vaivén, misión, circuito y encuentros. La clave es la ruta del
 * parámetro (`swirl.strength`). Los valores de la muestra caben con margen.
 */
export const PARAM_RANGES: Readonly<Record<string, ParamRange>> = {
  proximityRadius: { label: t('admin.validate.radioDeProximidad'), min: 1, max: 2000 },
  'swirl.strength': { label: t('admin.validate.fuerzaDelRemolino'), min: 0, max: 400 },
  'swirl.pull': { label: t('admin.validate.atraccionDelRemolino'), min: 0, max: 200 },
  'patrol.period': { label: t('admin.validate.periodoDelVaivenS'), min: 1, max: 120 },
  crocRadius: { label: t('admin.validate.radioDeLosCocodrilos'), min: 1, max: 2000 },
  'missionReward.points': {
    label: t('admin.validate.puntosDeLaEntrega'),
    min: 0,
    max: 1000,
    integer: true,
  },
  'missionReward.coins': {
    label: t('admin.validate.monedasDeLaEntrega'),
    min: 0,
    max: 1000,
    integer: true,
  },
  rewardCoins: { label: t('admin.validate.monedasDelEncuentro'), min: 0, max: 500, integer: true },
  version: { label: t('admin.validate.versionDelCircuito'), min: 1, max: 1000, integer: true },
};

/** Parámetros que son puntos del mar (listas de `{x, y}` o un punto). */
const POINT_LISTS: Readonly<Record<string, { label: string; min: number; max: number }>> = {
  'patrol.points': { label: t('admin.validate.puntosDelVaiven'), min: 2, max: 20 },
  trail: { label: t('admin.validate.recorridoDelEncuentro'), min: 1, max: 50 },
};
const POINTS: Readonly<Record<string, string>> = {
  missionDrop: t('admin.validate.puntoDeEntregaDe'),
};

function valueAt(params: Record<string, unknown>, path: string): unknown {
  let v: unknown = params;
  for (const k of path.split('.')) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
    v = (v as Record<string, unknown>)[k];
  }
  return v;
}

const fmt = (n: number) => String(n).replace('.', ',');

/**
 * Motivo por el que unos parámetros de lugar se salen de su rango seguro, o
 * null. Sólo mira los que conoce; el resto lo valida el esquema del mundo.
 */
export function paramProblem(
  name: string,
  params: Record<string, unknown>,
  bounds: { left: number; right: number; top: number; bottom: number },
): string | null {
  for (const [path, r] of Object.entries(PARAM_RANGES)) {
    const v = valueAt(params, path);
    if (v === undefined) continue;
    if (typeof v !== 'number' || !Number.isFinite(v))
      return t('admin.validate.noEsUnNumero', { name, label: r.label });
    if (r.integer && !Number.isInteger(v))
      return t('admin.validate.tieneQueSerEntero', { name, label: r.label });
    if (v < r.min || v > r.max) {
      return t('admin.validate.fueraDeRangoEntre2', {
        name,
        label: r.label,
        fmt: fmt(v),
        fmt2: fmt(r.min),
        fmt3: fmt(r.max),
      });
    }
  }
  const inside = (p: unknown) => {
    const x = (p as { x?: unknown } | null)?.x;
    const y = (p as { y?: unknown } | null)?.y;
    return (
      typeof x === 'number' &&
      typeof y === 'number' &&
      x >= bounds.left &&
      x <= bounds.right &&
      y >= bounds.top &&
      y <= bounds.bottom
    );
  };
  for (const [path, r] of Object.entries(POINT_LISTS)) {
    const v = valueAt(params, path);
    if (v === undefined) continue;
    if (!Array.isArray(v) || v.length < r.min || v.length > r.max) {
      return t('admin.validate.fueraDeRangoEntre', {
        name,
        label: r.label,
        min: r.min,
        max: r.max,
      });
    }
    if (!v.every(inside)) return t('admin.validate.conPuntosFueraDel', { name, label: r.label });
  }
  for (const [path, label] of Object.entries(POINTS)) {
    const v = valueAt(params, path);
    if (v !== undefined && !inside(v)) return t('admin.validate.fueraDelMapa', { name, label });
  }
  return null;
}

// ---------------------------------------------------------------------------
// Misiones y circuitos (REQ-ADM-014)

const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

/** Misiones (`params.mission`) sin un destino activo (`params.missionDestination`). */
export function missionProblem(world: WorldConfig): string | null {
  const active = world.objects.filter((o) => o.identity.active);
  for (const o of active) {
    const mission = str(o.params?.mission);
    if (!mission) continue;
    const dest = active.find((x) => x.params?.missionDestination === mission);
    if (!dest) return t('admin.validate.laMisionDeNo', { mission, name: o.identity.name });
    if (
      dest.geometry.proximityRadius === undefined &&
      !dest.behaviors.some((b) => b.type === 'proximity')
    ) {
      return t('admin.validate.elDestinoDeLa', { mission, name: dest.identity.name });
    }
  }
  return null;
}

/**
 * Por qué no se puede fijar `placeId` como destino de las partidas nuevas de
 * `missionId` en `worldId` (REQ-AVE-010, REQ-AVE-011), o null. Se compone el
 * mundo con el destino nuevo y la misión tiene que salir con él, igual que la
 * juega el motor: una misión sin destino (o con uno que no existe, está
 * desactivado, oculto en ese mundo o sin radio de llegada) no se publica.
 */
export function missionDestinationProblem(
  registry: WorldRegistry,
  content: WorldContent,
  worldId: string,
  missionId: string,
  placeId: string | null,
): string | null {
  if (!registry.has(worldId)) return t('admin.validate.noExisteElMundo', { worldId });
  const byMission = { ...(content.missionDestinations?.[worldId] ?? {}) };
  if (placeId === null) delete byMission[missionId];
  else {
    if (!registry.map.places.some((p) => p.id === placeId)) {
      return t('admin.validate.noExisteElLugar', { placeId });
    }
    byMission[missionId] = placeId;
  }
  let world: WorldConfig;
  try {
    world = composeLiveWorld(registry, worldId, {
      ...content,
      missionDestinations: { ...(content.missionDestinations ?? {}), [worldId]: byMission },
    }).config;
  } catch (err) {
    return t('admin.validate.elMundoNoSeria', { worldId, zodMessage: zodMessage(err) });
  }
  const spec = rescueMissionOf(world, missionId);
  if (!spec) return t('admin.validate.laMisionNoTendria', { missionId, worldId });
  if (placeId === null) return null;
  const o = world.objects.find((x) => x.identity.id === placeId);
  const name = o?.identity.name ?? placeId;
  if (spec.destination !== placeId || !missionDestination(world, placeId)) {
    return t('admin.validate.noPuedeSerDestino', { name, worldId });
  }
  return null;
}

/** Circuitos del mapa: los que nombran sus arcos o un lugar (`params.circuit`). */
export function circuitIds(world: WorldConfig): string[] {
  const ids = new Set<string>();
  for (const o of world.objects) {
    const c = str(o.params?.circuit);
    if (c) ids.add(c);
    for (const b of o.behaviors) {
      if (b.type === 'checkpoint' && b.params.circuitId) ids.add(b.params.circuitId);
    }
  }
  return [...ids];
}

/**
 * Circuitos sin ruta válida: con los arcos activos, hace falta la salida
 * (orden 0), al menos dos arcos y que los órdenes vayan seguidos.
 */
export function circuitProblem(world: WorldConfig): string | null {
  for (const id of circuitIds(world)) {
    const orders = world.objects
      .filter((o) => o.identity.active)
      .flatMap((o) =>
        o.behaviors.flatMap((b) =>
          b.type === 'checkpoint' && b.params.circuitId === id ? [b.params.order] : [],
        ),
      );
    const unique = [...new Set(orders)].sort((a, b) => a - b);
    if (!unique.includes(0)) return t('admin.validate.elCircuitoNoTendria', { id });
    if (orders.length < 2) return t('admin.validate.elCircuitoNoTendria2', { id });
    const gap = unique.findIndex((n, i) => n !== i);
    if (gap >= 0) return t('admin.validate.elCircuitoNoTendria3', { id, gap });
  }
  return null;
}

function zodMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'issues' in err && Array.isArray(err.issues)) {
    const first = err.issues[0] as { message?: string; path?: unknown[] } | undefined;
    if (first?.message) return first.message;
  }
  return err instanceof Error ? err.message.split('\n')[0]! : String(err);
}

/** La skin sin nada oculto: la navegación se comprueba con todos los lugares a la vista. */
function withEverythingVisible(skin: WorldSkin): WorldSkin {
  const places = Object.fromEntries(
    Object.entries(skin.places).map(([id, s]) => {
      const copy = { ...s };
      delete copy.hidden;
      return [id, copy];
    }),
  );
  return { ...skin, places };
}

/**
 * Motivo por el que este estado del mundo no se puede guardar, o null. Se
 * comprueba en todos los mundos: el mapa es el mismo y un cambio de posición
 * vale en todos.
 */
export function worldProblem(registry: WorldRegistry, content: WorldContent): string | null {
  const known = new Map(registry.map.places.map((p) => [p.id, p]));
  for (const id of Object.keys(content.places)) {
    if (!known.has(id) && !isMapPointId(id)) return t('admin.validate.noExisteElLugar2', { id });
  }
  const b = registry.map.bounds;
  for (const [id, patch] of Object.entries(content.places)) {
    const base = known.get(id);
    const x = patch.x ?? base?.position.x;
    const y = patch.y ?? base?.position.y;
    if (x === undefined || y === undefined) continue;
    if (x < b.left || x > b.right || y < b.top || y > b.bottom) {
      return t('admin.validate.quedariaFueraDelMapa', { v1: base?.name ?? id });
    }
    if (patch.params && base) {
      const merged = { ...(base.params ?? {}), ...patch.params };
      const why = paramProblem(base.name, merged, b);
      if (why) return why;
    }
  }
  // Objetos nuevos del Admin (T190): dentro del mapa, con id propio y parámetros seguros.
  for (const o of content.objects ?? []) {
    if (!isPublished(o)) continue;
    if (known.has(o.id) || isMapPointId(o.id)) {
      return t('admin.objects.problem.takenId', { id: o.id });
    }
    if (o.x < b.left || o.x > b.right || o.y < b.top || o.y > b.bottom) {
      return t('admin.validate.quedariaFueraDelMapa', { v1: o.name });
    }
    const why = objectPlaceProblem(o) ?? paramProblem(o.name, o.params, b);
    if (why) return why;
  }
  for (const [worldId, byPlace] of Object.entries(content.skins)) {
    if (!registry.has(worldId)) return t('admin.validate.noExisteElMundo', { worldId });
    for (const id of Object.keys(byPlace)) {
      if (!known.has(id)) return t('admin.validate.noExisteElLugar2', { id });
    }
  }
  // Esquema: cada mundo se compone sin errores, y cada misión que empieza en él
  // tiene destino (REQ-AVE-010): p. ej. no se oculta su isla sólo en ese mundo.
  for (const id of registry.ids()) {
    let composed: WorldConfig;
    try {
      composed = composeLiveWorld(registry, id, content).config;
    } catch (err) {
      return t('admin.validate.elMundoNoSeria2', { id, zodMessage: zodMessage(err) });
    }
    for (const o of composed.objects) {
      const mission = str(o.params?.mission);
      if (!mission || !o.identity.active) continue;
      if (!rescueMissionOf(composed, mission)) {
        return t('admin.validate.laMisionSeQuedaria', { mission, id });
      }
    }
  }
  // El mar: con todos los lugares a la vista (lo más estricto para cualquier mundo).
  const map = liveMap(registry, content);
  const skin = withEverythingVisible(registry.skin(registry.defaultId));
  const world = composeWorld(map, applySkinPatches(map, skin, {})).config;
  const plot = missionProblem(world) ?? circuitProblem(world);
  if (plot) return plot;
  const obstacles = solidCircles(world);
  for (const key of MAP_POINT_KEYS) {
    const p = mapPoint(registry.map, key, content.places);
    if (p && !isWater(world, obstacles, p)) {
      return t('admin.validate.quedariaEnTierraO', { v1: MAP_POINT_LABELS[key] });
    }
  }
  for (const o of world.objects) {
    if (!o.identity.active) continue;
    for (const beh of o.behaviors) {
      if (beh.type !== 'teleport') continue;
      if (!isWater(world, obstacles, beh.params)) {
        return t('admin.validate.elTeletransporteDeDejaria', { name: o.identity.name });
      }
    }
  }
  for (const o of content.objects ?? []) {
    if (!isPublished(o)) continue;
    // Nunca en tierra: su sitio, en el agua de todo lo demás.
    const others = solidCircles({
      ...world,
      objects: world.objects.filter((x) => x.identity.id !== o.id),
    });
    if (!isWater(world, others, o)) return t('admin.objects.problem.onLand', { name: o.name });
    if (o.safePoint && !isWater(world, obstacles, o.safePoint)) {
      return t('admin.objects.problem.safeOnLand', { name: o.name });
    }
  }
  const sea = newObjectsAtSeaProblem(registry, content);
  if (sea) return sea;
  const blocked = unreachablePlaces(world, obstacles);
  if (blocked.length > 0) {
    const names = blocked.slice(0, 3).map((o) => `«${o.identity.name}»`);
    return t('admin.validate.unaIslaCortariaEl', {
      names: names.join(', '),
      v2: blocked.length > 3 ? t('admin.validate.yMas', { v1: blocked.length - 3 }) : '',
    });
  }
  return null;
}

/**
 * Los objetos nuevos publicados en el mar 3D de /mar (T190), que acorta el
 * agua y agranda las islas (`marWorld`): cada uno sigue en el agua y el sitio
 * donde llega el barco al ir a él (al sur, fuera de sus radios, como
 * `approachPoint`) es agua del mar, no la otra punta del planeta ni tierra.
 */
function newObjectsAtSeaProblem(registry: WorldRegistry, content: WorldContent): string | null {
  const published = (content.objects ?? []).filter(isPublished);
  if (published.length === 0) return null;
  const sea = marWorld(composeLiveWorld(registry, registry.defaultId, content).config);
  const solids = solidCircles(sea);
  for (const o of published) {
    const m = sea.objects.find((x) => x.identity.id === o.id);
    if (!m) continue;
    const others = solidCircles({
      ...sea,
      objects: sea.objects.filter((x) => x.identity.id !== o.id),
    });
    if (!isWater(sea, others, m.position)) {
      return t('admin.objects.problem.onLand', { name: o.name });
    }
    const reach = Math.max(
      m.geometry.proximityRadius ?? 0,
      m.geometry.activation?.radius ?? 0,
      m.geometry.collision?.radius ?? 0,
    );
    const arrival = { x: m.position.x, y: m.position.y + reach + NEAR_MARGIN };
    if (!isWater(sea, solids, arrival)) {
      return t('admin.objects.problem.seaArrival', { name: o.name });
    }
  }
  return null;
}

import type { Rect, Sector, Vec2, WorldConfig, WorldObject } from '@boia/world';
import { GROUND_Y_SCALE } from '@boia/world';

/**
 * Carga del mundo por sectores (REQ-MUN-012, REQ-ARQ-014, T47), sin Pixi ni
 * DOM: qué sectores y qué objetos tienen que tener su arte cargado para una
 * posición del barco y un tamaño de pantalla, y cuáles se pueden soltar.
 *
 * - Un sector se pide cuando su rectángulo, ampliado con la mitad de la
 *   pantalla más `preload`, contiene el barco o un punto por delante de él
 *   (la velocidad por `lookahead` segundos). Se suelta cuando ni ampliado con
 *   `release` los contiene: la histéresis evita cargar y soltar en el borde.
 * - Cada objeto se dibuja (y pide sus texturas) igual, por su posición de ese
 *   momento: los restos y cofres que reaparecen en otro sitio (REQ-AVE-016)
 *   se cargan donde estén, no donde los puso el mapa.
 * - Un objeto «falta» si su huella (posición ± `SPRITE_REACH`) toca la
 *   pantalla y su arte aún no está: es lo que la prueba cuenta como fotograma
 *   con textura ausente, y lo que la precarga tiene que evitar.
 */

/** Calidad del arte: `baja` para dispositivos débiles (atlas a media resolución). */
export type QualityTier = 'alta' | 'baja';
export const QUALITY_TIERS: readonly QualityTier[] = ['alta', 'baja'];

export interface StreamTuning {
  /** u de mundo más allá de la media pantalla en que se pide el arte. */
  preload: number;
  /** u de mundo más allá de la media pantalla a partir de las que se suelta. */
  release: number;
  /** s de velocidad que se miran por delante del barco. */
  lookahead: number;
  /** Sectores con atlas en memoria a la vez, como mucho (límite de memoria). */
  maxSectors: number;
}

/** muestra: ajustables tras medir en el dispositivo mínimo (REQ-ARQ-015). */
export const STREAM_TUNING: Record<QualityTier, StreamTuning> = {
  alta: { preload: 1400, release: 3000, lookahead: 1.5, maxSectors: 6 },
  baja: { preload: 1200, release: 2200, lookahead: 1.5, maxSectors: 3 },
};

/**
 * u de mundo que un sprite puede asomar desde su posición (el pivote va en la
 * base y el arte sube). Las islas más grandes miden ~370 × 140 px de pantalla
 * a la escala del barco (0,32), es decir, ~370 × 280 u. muestra
 */
export const SPRITE_REACH = { x: 700, y: 900 } as const;

/** Media pantalla en u de mundo (el plano del agua se aplasta a la mitad en y). */
export interface ViewExtent {
  hx: number;
  hy: number;
}

export function viewExtent(width: number, height: number): ViewExtent {
  return { hx: width / 2, hy: height / 2 / GROUND_Y_SCALE };
}

/** Pantalla por defecto de los cálculos sin navegador (presupuesto, atlas): 1440 × 900. */
export const REFERENCE_VIEW: ViewExtent = viewExtent(1440, 900);

/** Sector implícito de un mundo sin sectores: todo el mapa. */
export const WHOLE_WORLD_SECTOR = 'todo';

/** Los sectores del mundo; sin ninguno, uno que cubre los límites. */
export function sectorsOf(world: Pick<WorldConfig, 'sectors' | 'bounds'>): Sector[] {
  if (world.sectors.length > 0) return world.sectors;
  return [{ id: WHOLE_WORLD_SECTOR, name: 'Todo el mapa', area: world.bounds }];
}

/** Distancia por ejes de un punto a un rectángulo (0 dentro). */
export function rectGap(r: Rect, p: Vec2): { dx: number; dy: number } {
  return {
    dx: Math.max(r.left - p.x, 0, p.x - r.right),
    dy: Math.max(r.top - p.y, 0, p.y - r.bottom),
  };
}

/** El sector de un punto: el primero que lo contiene o, fuera de todos, el más cercano. */
export function sectorAt(sectors: readonly Sector[], p: Vec2): string {
  let best = sectors[0]?.id ?? WHOLE_WORLD_SECTOR;
  let bestD = Number.POSITIVE_INFINITY;
  for (const s of sectors) {
    const { dx, dy } = rectGap(s.area, p);
    const d = Math.hypot(dx, dy);
    if (d === 0) return s.id;
    if (d < bestD) {
      bestD = d;
      best = s.id;
    }
  }
  return best;
}

/** El sector «de casa» de cada objeto activo, por su posición en el mapa. */
export function objectsBySector(
  world: Pick<WorldConfig, 'sectors' | 'bounds' | 'objects'>,
): Map<string, WorldObject[]> {
  const sectors = sectorsOf(world);
  const out = new Map<string, WorldObject[]>(sectors.map((s) => [s.id, []]));
  for (const o of world.objects) {
    if (!o.identity.active) continue;
    out.get(sectorAt(sectors, o.position))!.push(o);
  }
  return out;
}

/** Puntos que mira la precarga: el barco y dos por delante, según su velocidad. */
export function lookaheadPoints(ship: Vec2, velocity: Vec2, seconds: number): Vec2[] {
  if (Math.hypot(velocity.x, velocity.y) < 1) return [ship];
  return [
    ship,
    { x: ship.x + velocity.x * seconds * 0.5, y: ship.y + velocity.y * seconds * 0.5 },
    { x: ship.x + velocity.x * seconds, y: ship.y + velocity.y * seconds },
  ];
}

/** s de un viaje en turbo cuyo arte se carga antes de arrancar. muestra */
export const VOYAGE_PRELOAD_SECONDS = [0.75, 1.5] as const;

/**
 * Qué cargar antes de arrancar un viaje en turbo (piloto automático, T43):
 * el primer tramo de la ruta y el destino. Un viaje sale ya a toda
 * velocidad, así que la mirada por delante no llega a tiempo en el arranque.
 */
export function voyagePreload(from: Vec2, to: Vec2, speed: number): Vec2[] {
  const d = Math.hypot(to.x - from.x, to.y - from.y);
  if (d < 1) return [to];
  const along = VOYAGE_PRELOAD_SECONDS.map((s) => Math.min(1, (s * speed) / d)).filter(
    (k) => k < 1,
  );
  return [
    ...along.map((k) => ({ x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k })),
    to,
  ];
}

/** ¿Está `p` a menos de (media pantalla + `pad`) de alguno de los puntos? */
export function withinView(
  p: Vec2,
  points: readonly Vec2[],
  view: ViewExtent,
  pad: number,
): boolean {
  return points.some(
    (q) => Math.abs(p.x - q.x) <= view.hx + pad && Math.abs(p.y - q.y) <= view.hy + pad,
  );
}

/** ¿Toca el rectángulo, ampliado con (media pantalla + `pad`), alguno de los puntos? */
export function sectorWithinView(
  r: Rect,
  points: readonly Vec2[],
  view: ViewExtent,
  pad: number,
): boolean {
  return points.some((q) => {
    const { dx, dy } = rectGap(r, q);
    return dx <= view.hx + pad && dy <= view.hy + pad;
  });
}

export interface SectorPlan {
  /** Sectores que tienen que estar cargados, del más cercano al más lejano. */
  want: string[];
  /** Sectores cargados que ya se pueden soltar. */
  release: string[];
}

/**
 * Qué sectores cargar y cuáles soltar. `loaded` son los que están en memoria
 * (o cargando). Si con los pedidos se pasa de `maxSectors`, se sueltan los
 * más lejanos de los que no se piden.
 */
export function planSectors(
  sectors: readonly Sector[],
  points: readonly Vec2[],
  view: ViewExtent,
  loaded: ReadonlySet<string>,
  tuning: StreamTuning,
): SectorPlan {
  const ship = points[0] ?? { x: 0, y: 0 };
  const dist = (s: Sector) => {
    const { dx, dy } = rectGap(s.area, ship);
    return Math.hypot(dx, dy);
  };
  const byDistance = [...sectors].sort((a, b) => dist(a) - dist(b));
  const want = byDistance
    .filter((s) => sectorWithinView(s.area, points, view, tuning.preload))
    .map((s) => s.id);
  const wanted = new Set(want);
  const keep = new Set(
    byDistance
      .filter((s) => wanted.has(s.id) || sectorWithinView(s.area, points, view, tuning.release))
      .map((s) => s.id),
  );
  const release = byDistance.filter((s) => loaded.has(s.id) && !keep.has(s.id)).map((s) => s.id);
  // Límite de memoria: de lo que queda, fuera lo más lejano que no se pide.
  const staying = byDistance.filter(
    (s) => (loaded.has(s.id) || wanted.has(s.id)) && keep.has(s.id),
  );
  let extra = staying.length - Math.max(tuning.maxSectors, want.length);
  for (let i = staying.length - 1; i >= 0 && extra > 0; i--) {
    const s = staying[i]!;
    if (wanted.has(s.id)) continue;
    release.push(s.id);
    extra--;
  }
  return { want, release };
}

/**
 * Objetos que tienen que tener vista para estas posiciones (cerca de algún
 * punto) y objetos cuya vista se puede soltar (lejos de todos).
 */
export function planObjects(
  states: Iterable<{ id: string; x: number; y: number }>,
  points: readonly Vec2[],
  view: ViewExtent,
  tuning: StreamTuning,
): { want: Set<string>; keep: Set<string> } {
  const want = new Set<string>();
  const keep = new Set<string>();
  for (const s of states) {
    if (withinView(s, points, view, tuning.preload)) want.add(s.id);
    if (withinView(s, points, view, tuning.release)) keep.add(s.id);
  }
  return { want, keep };
}

/** ¿Asoma a la pantalla (centrada en `camera`) el arte de un objeto en `p`? */
export function onScreen(p: Vec2, camera: Vec2, view: ViewExtent): boolean {
  return (
    Math.abs(p.x - camera.x) <= view.hx + SPRITE_REACH.x &&
    Math.abs(p.y - camera.y) <= view.hy + SPRITE_REACH.y
  );
}

/**
 * Calidad según el dispositivo: `baja` con ahorro de datos, poca memoria
 * (`deviceMemory` ≤ 2 GB), pocos núcleos en táctil (≤ 4) o texturas
 * máximas de menos de 4096 px. Lo que no se sabe no baja la calidad.
 */
export function detectQuality(d: {
  deviceMemory?: number | undefined;
  hardwareConcurrency?: number | undefined;
  saveData?: boolean | undefined;
  touch?: boolean | undefined;
  maxTextureSize?: number | undefined;
}): QualityTier {
  if (d.saveData) return 'baja';
  if (d.deviceMemory !== undefined && d.deviceMemory <= 2) return 'baja';
  if (d.touch && d.hardwareConcurrency !== undefined && d.hardwareConcurrency <= 4) return 'baja';
  if (d.maxTextureSize !== undefined && d.maxTextureSize < 4096) return 'baja';
  return 'alta';
}

import type { Behavior, Rect, WorldConfig, WorldObject } from '@boia/world';

/**
 * El mapa compartido (D-20) visto en el mar 3D. Mismo mapa, mismos lugares y
 * mismos comportamientos que el 2D, con dos cambios de escala para que en 3D
 * el mar no sea un desierto y las islas se lean desde lejos:
 *
 * - el agua entre zonas se acorta `spread` veces (el 2D la estira ×15 para
 *   un minuto de ruta directa; aquí el zoom ya da la vista de conjunto);
 * - las islas crecen `islandGrow` veces (casco, colisión y proximidad), y lo
 *   que está pegado a ellas se aparta con ellas.
 *
 * - (T50) todo lo que no es composición local se acerca otra vez `compact`
 *   veces, y si dos islas quedan con sus radios de proximidad pisándose se
 *   separan lo justo.
 *
 * Las composiciones locales (el puerto, el remanso de la Fiestera, el
 * semáforo del circuito) no se acortan: cada pieza queda a su distancia 1:1
 * del ancla de su zona, como en el arte. Lo que sale es un `WorldConfig`
 * normal: lo ejecuta el mismo `WorldRuntime` que el 2D, en u de motor.
 * Todo `muestra`.
 */
export const MAR3D_SCALE = {
  spread: 2.5,
  /**
   * El mundo compacto de `/mar` (T50): el agua entre zonas se acorta otra vez
   * a la mitad, para que de una isla a la siguiente haya unos segundos de
   * navegación. Multiplica a `spread`; 1 es el mar de T33. muestra
   */
  compact: 0.5,
  /** u de agua mínimas entre los radios de proximidad de dos islas. */
  islandGap: 40,
  islandGrow: 2.4,
  /** Las islas amplían su proximidad menos que su casco (el panel ya salta lejos). */
  islandProximityGrow: 1.5,
  /** u alrededor del ancla de una zona dentro de las que una pieza es composición local. */
  localRadius: 320,
  /** u de motor por unidad de escena de three.js (el barco mide 48 u → 3). */
  unitsPerScene: 16,
} as const;

type Point = { x: number; y: number };

interface Anchor {
  id: string;
  at: Point;
  to: Point;
  grow: number;
}

const isIsland = (o: WorldObject) => o.identity.category === 'isla';

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Radio de proximidad de una isla en el mar 3D (el que da `compressObject`). */
function grownProximity(o: WorldObject): number {
  const g = MAR3D_SCALE.islandGrow;
  const prox = o.geometry.proximityRadius ?? 0;
  return Math.max(
    prox * MAR3D_SCALE.islandProximityGrow,
    (o.geometry.collision?.radius ?? 0) * g + 120,
  );
}

/**
 * Anclas: el lugar que da nombre a cada zona (el que tiene su mismo id). `k`
 * es la escala de las posiciones (1 / spread · compact).
 */
function anchorsOf(world: WorldConfig, k: number): Anchor[] {
  const out: Anchor[] = [];
  const reach = new Map<string, number>();
  for (const o of world.objects) {
    const zone = o.position.zone;
    if (!zone || o.identity.id !== zone) continue;
    const at = { x: o.position.x, y: o.position.y };
    out.push({
      id: o.identity.id,
      at,
      to: { x: at.x * k, y: at.y * k },
      grow: isIsland(o) ? MAR3D_SCALE.islandGrow : 1,
    });
    if (isIsland(o)) reach.set(o.identity.id, grownProximity(o));
  }
  separate(out, reach);
  return out;
}

/**
 * Islas con los radios de proximidad pisándose: se apartan lo justo, las dos
 * a partes iguales (con sus composiciones). En el mapa de Arcilla sólo el
 * Faro y el Cañón se tocan al compactar, y por poco.
 */
function separate(anchors: Anchor[], reach: ReadonlyMap<string, number>): void {
  const isl = anchors.filter((a) => reach.has(a.id));
  for (let iter = 0; iter < 24; iter++) {
    let moved = false;
    for (let i = 0; i < isl.length; i++) {
      for (let j = i + 1; j < isl.length; j++) {
        const a = isl[i]!;
        const b = isl[j]!;
        const need = reach.get(a.id)! + reach.get(b.id)! + MAR3D_SCALE.islandGap;
        const dx = b.to.x - a.to.x;
        const dy = b.to.y - a.to.y;
        const d = Math.hypot(dx, dy);
        if (d >= need - 0.5) continue;
        const nx = d > 1e-6 ? dx / d : 1;
        const ny = d > 1e-6 ? dy / d : 0;
        const push = (need - d) / 2;
        a.to = { x: a.to.x - nx * push, y: a.to.y - ny * push };
        b.to = { x: b.to.x + nx * push, y: b.to.y + ny * push };
        moved = true;
      }
    }
    if (!moved) break;
  }
}

function nearestAnchor(anchors: readonly Anchor[], p: Point): Anchor | null {
  let best: Anchor | null = null;
  let bestD: number = MAR3D_SCALE.localRadius;
  for (const a of anchors) {
    const d = Math.hypot(p.x - a.at.x, p.y - a.at.y);
    if (d <= bestD) {
      best = a;
      bestD = d;
    }
  }
  return best;
}

/** Un punto del mapa en el mar 3D (u de motor). */
function compressPoint(anchors: readonly Anchor[], p: Point, k: number): Point {
  const a = nearestAnchor(anchors, p);
  if (a) {
    return { x: r2(a.to.x + (p.x - a.at.x) * a.grow), y: r2(a.to.y + (p.y - a.at.y) * a.grow) };
  }
  return { x: r2(p.x * k), y: r2(p.y * k) };
}

/** Recorre parámetros y cambia de escala todo lo que es un punto ({x, y}). */
function compressParams(anchors: readonly Anchor[], v: unknown, k: number): unknown {
  if (Array.isArray(v)) return v.map((x) => compressParams(anchors, x, k));
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, x] of Object.entries(o)) out[key] = compressParams(anchors, x, k);
    if (typeof o.x === 'number' && typeof o.y === 'number') {
      const p = compressPoint(anchors, { x: o.x, y: o.y }, k);
      out.x = p.x;
      out.y = p.y;
    }
    return out;
  }
  return v;
}

function growBehavior(b: Behavior, k: number): Behavior {
  if (b.type === 'proximity' && b.params.radius !== undefined) {
    return { ...b, params: { ...b.params, radius: r2(b.params.radius * k) } };
  }
  return b;
}

/** Los sitios donde reaparece algo (restos, cofres) también cambian de escala. */
function compressSpawn(anchors: readonly Anchor[], b: Behavior, k: number): Behavior {
  if (b.type !== 'spawn' || !b.params.positions) return b;
  return {
    ...b,
    params: {
      ...b.params,
      positions: b.params.positions.map((p) => compressPoint(anchors, p, k)),
    },
  };
}

function compressObject(anchors: readonly Anchor[], o: WorldObject, k: number): WorldObject {
  const p = compressPoint(anchors, o.position, k);
  const out: WorldObject = { ...o, position: { ...o.position, x: p.x, y: p.y } };
  if (o.params) out.params = compressParams(anchors, o.params, k) as Record<string, unknown>;
  out.behaviors = o.behaviors.map((b) => compressSpawn(anchors, b, k));
  if (!isIsland(o)) return out;
  const g = MAR3D_SCALE.islandGrow;
  const pg = MAR3D_SCALE.islandProximityGrow;
  const geo = o.geometry;
  out.geometry = {
    ...geo,
    ...(geo.collision
      ? { collision: { ...geo.collision, radius: r2(geo.collision.radius * g) } }
      : {}),
    ...(geo.collisionParts
      ? {
          collisionParts: geo.collisionParts.map((c) => ({
            dx: r2(c.dx * g),
            dy: r2(c.dy * g),
            radius: r2(c.radius * g),
          })),
        }
      : {}),
    ...(geo.activation
      ? { activation: { ...geo.activation, radius: r2(geo.activation.radius * g) } }
      : {}),
    ...(geo.proximityRadius !== undefined
      ? {
          proximityRadius: r2(
            Math.max(geo.proximityRadius * pg, (geo.collision?.radius ?? 0) * g + 120),
          ),
        }
      : {}),
  };
  out.behaviors = out.behaviors.map((b) => growBehavior(b, pg));
  return out;
}

function compressRect(anchors: readonly Anchor[], r: Rect, spawn: Point, k: number): Rect {
  // Los lados abiertos (oeste, este, norte) van a escala de posiciones; el
  // sur (el paseo) es parte del puerto y queda a su distancia 1:1.
  const south = compressPoint(anchors, { x: spawn.x, y: r.bottom }, k);
  return {
    left: r2(r.left * k),
    right: r2(r.right * k),
    top: r2(r.top * k),
    bottom: south.y,
  };
}

/**
 * El mundo que se juega, en la escala del mar 3D. `compact` (por defecto el
 * de `MAR3D_SCALE`) acerca las zonas; con 1 sale el mar de T33.
 */
export function compressWorld(world: WorldConfig, opts: { compact?: number } = {}): WorldConfig {
  const k = (opts.compact ?? MAR3D_SCALE.compact) / MAR3D_SCALE.spread;
  const anchors = anchorsOf(world, k);
  const spawn = world.spawn ?? {
    x: (world.bounds.left + world.bounds.right) / 2,
    y: world.bounds.bottom - 200,
    heading: -Math.PI / 2,
  };
  const s = compressPoint(anchors, spawn, k);
  return {
    ...world,
    bounds: compressRect(anchors, world.bounds, spawn, k),
    spawn: { x: s.x, y: s.y, heading: spawn.heading },
    sectors: world.sectors.map((sec) => ({
      ...sec,
      area: {
        left: r2(sec.area.left * k),
        right: r2(sec.area.right * k),
        top: r2(sec.area.top * k),
        bottom: r2(sec.area.bottom * k),
      },
    })),
    objects: world.objects.map((o) => compressObject(anchors, o, k)),
  };
}

/** u de motor → unidades de escena. */
export const toScene = (u: number) => u / MAR3D_SCALE.unitsPerScene;
/** Unidades de escena → u de motor. */
export const fromScene = (s: number) => s * MAR3D_SCALE.unitsPerScene;

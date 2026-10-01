import type { Vec2, WorldConfig } from '@boia/world';

/**
 * Dónde puede flotar una botella (REQ-IDE-040): en el mar navegable del mapa
 * compartido, nunca en tierra. Sin Pixi ni DOM: lo usan la interfaz (para
 * elegir el sitio junto al barco) y el repositorio (para rechazar una
 * posición mala con su motivo).
 *
 * Tierra es: fuera de los límites navegables (costas laterales, borde
 * inferior y más allá del borde superior abierto) o dentro de la huella de
 * colisión de un lugar (islas, rocas, boies), con un margen. El mapa es
 * compartido (D-20), así que el mar es el mismo en todos los mundos.
 */

/** u de margen con las costas y los bordes del mapa. muestra */
export const BOTTLE_SHORE_MARGIN = 32;
/** u de margen alrededor de la colisión de un lugar. muestra */
export const BOTTLE_LAND_CLEARANCE = 20;
/** u entre el barco y la botella que echa. muestra */
export const BOTTLE_DROP_DISTANCE = 56;

export type SeaProblem = 'fuera' | 'tierra';

/** Motivo para la interfaz (y para el error del repositorio). muestra */
export const SEA_PROBLEM_TEXT: Record<SeaProblem, string> = {
  fuera: 'ahí ya no hay mar navegable',
  tierra: 'eso es tierra',
};

/** Qué impide dejar una botella en `p`, o null si es mar. */
export function bottleSpotProblem(world: WorldConfig, p: Vec2): SeaProblem | null {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return 'fuera';
  const b = world.bounds;
  const m = BOTTLE_SHORE_MARGIN;
  if (p.x < b.left + m || p.x > b.right - m || p.y < b.top + m || p.y > b.bottom - m) {
    return 'fuera';
  }
  for (const o of world.objects) {
    if (!o.identity.active) continue;
    const r = o.geometry.collision?.radius;
    if (r === undefined) continue;
    if (Math.hypot(p.x - o.position.x, p.y - o.position.y) < r + BOTTLE_LAND_CLEARANCE) {
      return 'tierra';
    }
  }
  return null;
}

export function isSeaSpot(world: WorldConfig, p: Vec2): boolean {
  return bottleSpotProblem(world, p) === null;
}

/** Validador con la forma que pide `@boia/store` (`validate.bottlePosition`). */
export function bottlePositionValidator(
  world: WorldConfig | (() => WorldConfig),
): (p: Vec2) => string | null {
  return (p) => {
    const w = typeof world === 'function' ? world() : world;
    const why = bottleSpotProblem(w, p);
    return why ? SEA_PROBLEM_TEXT[why] : null;
  };
}

export interface ShipPose {
  x: number;
  y: number;
  /** Rumbo del casco en el plano del agua (rad); proa = (cos, sin). */
  heading: number;
}

/** ¿Puede flotar una botella en `p`? (el mar de un mapa u otro, como el del planeta de /mar). */
export type SpotTest = (p: Vec2) => boolean;

/**
 * Sitio junto al barco donde `ok` deja caer su botella: primero por la popa
 * (la deja atrás al seguir navegando), luego a los lados y, si hace falta,
 * un poco más lejos. null si alrededor no hay sitio.
 */
export function findDropSpotWhere(ok: SpotTest, ship: ShipPose): Vec2 | null {
  const stern = ship.heading + Math.PI;
  const turns = [0, 0.25, -0.25, 0.5, -0.5, 0.75, -0.75, 1];
  for (const k of [1, 1.5, 2.2, 3]) {
    const d = BOTTLE_DROP_DISTANCE * k;
    for (const t of turns) {
      const a = stern + t * Math.PI;
      const p = { x: ship.x + Math.cos(a) * d, y: ship.y + Math.sin(a) * d };
      if (ok(p)) return p;
    }
  }
  return null;
}

/** El punto más cercano a `p` que cumple `ok` (en anillos cada `step` u), o null. */
export function nearestSpotWhere(ok: SpotTest, p: Vec2, maxDistance = 480, step = 16): Vec2 | null {
  if (ok(p)) return { x: p.x, y: p.y };
  for (let r = step; r <= maxDistance; r += step) {
    const n = Math.max(8, Math.round((2 * Math.PI * r) / step));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 2 * Math.PI;
      const q = { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r };
      if (ok(q)) return q;
    }
  }
  return null;
}

/**
 * Sitio de mar junto al barco donde cae su botella: primero por la popa (la
 * deja atrás al seguir navegando), luego a los lados y, si hace falta, un
 * poco más lejos. null si alrededor sólo hay tierra.
 */
export function findDropSpot(world: WorldConfig, ship: ShipPose): Vec2 | null {
  return findDropSpotWhere((p) => isSeaSpot(world, p), ship);
}

/** El punto de mar más cercano a `p` (en anillos cada `step` u), o null. */
export function nearestSeaSpot(
  world: WorldConfig,
  p: Vec2,
  maxDistance = 480,
  step = 16,
): Vec2 | null {
  return nearestSpotWhere((q) => isSeaSpot(world, q), p, maxDistance, step);
}

function spawnOf(world: WorldConfig): Vec2 {
  const b = world.bounds;
  return world.spawn ?? { x: (b.left + b.right) / 2, y: b.bottom - 200 };
}

/**
 * Dónde van las botellas de muestra que no caen en el mar de este mapa (sus
 * coordenadas vienen del mapa de Arcilla, T16): la primera cerca de la
 * salida, para que se descubra la mecánica nada más zarpar; las demás,
 * repartidas a lo largo de la travesía hacia el norte. muestra
 */
const SEED_LAYOUT: readonly { along: number; dx: number; dy: number }[] = [
  { along: 0, dx: -95, dy: -75 },
  { along: 0.45, dx: 150, dy: 0 },
  { along: 0.75, dx: -150, dy: 0 },
];

/**
 * Deja en el mar las botellas que no lo están: las que ya caen en el mar se
 * quedan donde están; las demás se recolocan en sitios fijos del mapa
 * (siempre los mismos para el mismo mapa). Las que no tienen sitio, fuera.
 */
export function settleInSea<T extends Vec2>(world: WorldConfig, items: readonly T[]): T[] {
  const spawn = spawnOf(world);
  const b = world.bounds;
  const north = b.top + (b.bottom - b.top) * 0.15;
  let k = 0;
  const out: T[] = [];
  for (const item of items) {
    if (isSeaSpot(world, item)) {
      out.push(item);
      continue;
    }
    const seed = SEED_LAYOUT[k % SEED_LAYOUT.length]!;
    const lap = Math.floor(k / SEED_LAYOUT.length);
    k++;
    const target = {
      x: spawn.x + seed.dx + lap * 40,
      y: spawn.y + (north - spawn.y) * seed.along + seed.dy - lap * 60,
    };
    const spot = nearestSeaSpot(world, target);
    if (spot) out.push({ ...item, x: Math.round(spot.x), y: Math.round(spot.y) });
  }
  return out;
}

import type { DefenseConfig, DefenseTowerKind } from './config';
import type { DefensePath } from './path';

/**
 * La regla de construir (decisión 8 del plan 014, T159). Una isla se pone
 * en (x, y) si:
 *
 * - la partida no ha acabado;
 * - el punto está dentro del anillo del avión (`plane.buildRing`) y la isla
 *   entera cabe en la arena;
 * - no pisa el camino: su borde queda a `towers.pathClearance` u del borde
 *   del carril como poco;
 * - no pisa el vórtice ni se le pega (`towers.vortexClearance`);
 * - no se monta en el castillo ni en otra isla. Todas las islas cubren el
 *   mismo círculo, `islandRadius` (su tamaño de nivel 3: subir de nivel nunca
 *   las solapa);
 * - llega el dinero.
 *
 * No hay tope de islas. Si no se puede, `reason` dice por qué (el HUD lo
 * enseña en la vista previa). Lo de sitio va antes que el dinero.
 */

export type DefenseBuildReason =
  | 'ended'
  | 'ring'
  | 'arena'
  | 'path'
  | 'vortex'
  | 'castle'
  | 'overlap'
  | 'coins';

export type DefenseBuildCheck =
  | { readonly ok: true; readonly cost: number }
  | { readonly ok: false; readonly reason: DefenseBuildReason; readonly cost: number };

/** Lo que la regla mira de la partida (lo da `DefenseGame`, o un bot con su snapshot). */
export interface DefenseBuildWorld {
  readonly config: DefenseConfig;
  readonly path: DefensePath;
  readonly plane: { readonly x: number; readonly y: number };
  readonly towers: readonly { readonly x: number; readonly y: number }[];
  readonly coins: number;
  readonly ended?: boolean;
}

/** Sólo el sitio: ¿cabe una isla en (x, y) sin contar el avión ni el dinero? */
export function defenseSiteReason(
  config: DefenseConfig,
  path: DefensePath,
  towers: readonly { readonly x: number; readonly y: number }[],
  x: number,
  y: number,
): DefenseBuildReason | null {
  const r = config.islandRadius;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return 'arena';
  if (Math.hypot(x, y) + r > config.arenaRadius) return 'arena';
  if (Math.hypot(x, y) < config.castle.radius + r) return 'castle';
  if (
    Math.hypot(x - path.start.x, y - path.start.y) <
    config.vortexRadius + r + config.towers.vortexClearance
  )
    return 'vortex';
  if (path.distanceTo(x, y) < path.width / 2 + r + config.towers.pathClearance) return 'path';
  const min2 = (2 * r) ** 2;
  for (const t of towers) {
    const dx = t.x - x;
    const dy = t.y - y;
    if (dx * dx + dy * dy < min2) return 'overlap';
  }
  return null;
}

export function defenseBuildCheck(
  w: DefenseBuildWorld,
  kind: DefenseTowerKind,
  x: number,
  y: number,
): DefenseBuildCheck {
  const cost = w.config.towers.kinds[kind].cost;
  if (w.ended) return { ok: false, reason: 'ended', cost };
  if (Math.hypot(x - w.plane.x, y - w.plane.y) > w.config.plane.buildRing)
    return { ok: false, reason: 'ring', cost };
  const site = defenseSiteReason(w.config, w.path, w.towers, x, y);
  if (site) return { ok: false, reason: site, cost };
  if (w.coins < cost) return { ok: false, reason: 'coins', cost };
  return { ok: true, cost };
}

/** Lo que cuesta subir una isla al siguiente nivel, o null en el 3. */
export function defenseTowerUpgradeCost(
  config: DefenseConfig,
  tower: { readonly kind: DefenseTowerKind; readonly level: number },
): number | null {
  if (tower.level >= 3) return null;
  return config.towers.kinds[tower.kind].upgradeCost[Math.max(1, tower.level) - 1]!;
}

/** Lo que devuelve venderla: una parte de lo gastado en ella. */
export function defenseTowerSellValue(
  config: DefenseConfig,
  tower: { readonly spent: number },
): number {
  return Math.floor(tower.spent * config.towers.sellRefund);
}

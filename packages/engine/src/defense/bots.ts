import { defenseSiteReason, defenseTowerUpgradeCost } from './build';
import type { DefenseConfig, DefenseTowerKind } from './config';
import { buildDefensePath } from './path';
import type { DefenseInput, DefenseSnapshot } from './sim';
import type { DefenseEnemyView } from './towers';

/**
 * Bots de prueba. `idlePlaneBot` se queda donde empieza; `chasePlaneBot`
 * vuela hacia el enemigo más adelantado del camino (el que antes llegaría al
 * castillo), se queda a medio alcance y compra los niveles del avión en
 * cuanto llega el dinero. Solos (sin islas) no bastan. `buildingBot` (T159)
 * además construye islas en los sitios que más camino cubren, las sube y
 * compra los niveles del avión: es el jugador sencillo de las pruebas de
 * equilibrio (T165 las afina).
 */

export type DefenseBot = (s: DefenseSnapshot) => DefenseInput;

export const idlePlaneBot: DefenseBot = () => ({});

export const chasePlaneBot: DefenseBot = (s) => {
  const input: DefenseInput = {};
  if (s.plane.nextUpgradeCost !== null && s.coins >= s.plane.nextUpgradeCost)
    input.upgradePlane = true;
  chase(s, input);
  return input;
};

/** Vuela hacia el más adelantado y se queda a medio alcance. */
function chase(s: DefenseSnapshot, input: DefenseInput): void {
  let target: DefenseEnemyView | null = null;
  for (const e of s.enemies) if (!e.dead && (!target || e.distance > target.distance)) target = e;
  if (!target) return;
  const dx = target.x - s.plane.x;
  const dy = target.y - s.plane.y;
  const d = Math.hypot(dx, dy);
  if (d > s.plane.range * 0.5) input.move = { x: dx / d, y: dy / d };
}

export interface BuildingBotOptions {
  /** Las islas en el orden en que las construye; después repite `repeat`. */
  order?: readonly DefenseTowerKind[];
  repeat?: readonly DefenseTowerKind[];
  /** u alrededor de un sitio en que cuenta el camino que cubre. */
  coverRadius?: number;
}

const DEFAULT_ORDER: readonly DefenseTowerKind[] = [
  'ultima',
  'tienda',
  'cala',
  'allday',
  'halloween',
  'fotos',
  'faro',
];
const DEFAULT_REPEAT: readonly DefenseTowerKind[] = ['cala', 'allday', 'ultima', 'fotos', 'faro'];

/**
 * Un jugador sencillo que construye. Al empezar puntúa una rejilla de sitios
 * libres (fuera del camino, del vórtice y del castillo) por cuánto camino
 * tienen cerca, y luego, por turnos:
 *
 * 1. construye la siguiente isla de `order` (después, de `repeat`) en el
 *    mejor sitio libre (la granja en el peor: no necesita camino), volando
 *    hasta tenerlo dentro de su anillo;
 * 2. a partir de la tercera isla, compra los niveles del avión;
 * 3. tras las de `order`, alterna subir de nivel la isla más baja con
 *    construir otra de `repeat`.
 *
 * Sin nada que hacer, persigue al más adelantado como `chasePlaneBot`.
 */
export function buildingBot(cfg: DefenseConfig, opts: BuildingBotOptions = {}): DefenseBot {
  const order = opts.order ?? DEFAULT_ORDER;
  const repeat = opts.repeat ?? DEFAULT_REPEAT;
  const coverR = opts.coverRadius ?? 230;
  const path = buildDefensePath(cfg.path, cfg.castle.radius);

  // Sitios: rejilla de la arena, puntuados por las muestras del camino que tienen cerca.
  const samples: { x: number; y: number }[] = [];
  for (let d = 0; d <= path.length; d += 25) samples.push(path.sampleAt(d));
  const step = 35;
  const sites: { x: number; y: number; score: number }[] = [];
  for (let x = -cfg.arenaRadius; x <= cfg.arenaRadius; x += step) {
    for (let y = -cfg.arenaRadius; y <= cfg.arenaRadius; y += step) {
      if (defenseSiteReason(cfg, path, [], x, y)) continue;
      let score = 0;
      for (const p of samples) if (Math.hypot(p.x - x, p.y - y) <= coverR) score++;
      sites.push({ x, y, score });
    }
  }
  sites.sort((a, b) => b.score - a.score || a.x - b.x || a.y - b.y);

  let built = 0;
  let goal: { kind: DefenseTowerKind; x: number; y: number } | null = null;
  let lastCount = 0;
  let upgradeTurn = false;

  const nextKind = (): DefenseTowerKind =>
    built < order.length ? order[built]! : repeat[(built - order.length) % repeat.length]!;

  const pickSite = (s: DefenseSnapshot, kind: DefenseTowerKind) => {
    const list = kind === 'tienda' ? [...sites].reverse() : sites;
    for (const site of list)
      if (!defenseSiteReason(cfg, path, s.towers, site.x, site.y)) return site;
    return null;
  };

  return (s) => {
    const input: DefenseInput = {};
    if (s.end) return input;
    if (s.towers.length > lastCount) {
      built++;
      goal = null;
      if (built > order.length) upgradeTurn = true;
    }
    lastCount = s.towers.length;

    if (built >= 3 && s.plane.nextUpgradeCost !== null && s.coins >= s.plane.nextUpgradeCost) {
      input.upgradePlane = true;
      return withChase(s, input);
    }

    // Tras las islas de `order`, un turno sube la más baja y el siguiente construye.
    if (upgradeTurn && !goal) {
      let low: (typeof s.towers)[number] | null = null;
      for (const t of s.towers)
        if (t.kind !== 'tienda' && t.level < 3 && (!low || t.level < low.level)) low = t;
      if (!low) upgradeTurn = false;
      else {
        const cost = defenseTowerUpgradeCost(cfg, low);
        if (cost !== null && s.coins >= cost) {
          input.upgradeTower = low.id;
          upgradeTurn = false;
        }
        return withChase(s, input);
      }
    }

    if (!goal) {
      const kind = nextKind();
      if (s.coins >= cfg.towers.kinds[kind].cost) {
        const site = pickSite(s, kind);
        if (site) goal = { kind, x: site.x, y: site.y };
      }
    }
    if (!goal) return withChase(s, input);

    const dx = goal.x - s.plane.x;
    const dy = goal.y - s.plane.y;
    const d = Math.hypot(dx, dy);
    if (d <= s.plane.buildRing * 0.9) input.build = { ...goal };
    else input.move = { x: dx / d, y: dy / d };
    return input;
  };
}

function withChase(s: DefenseSnapshot, input: DefenseInput): DefenseInput {
  chase(s, input);
  return input;
}

import { defenseSiteReason, defenseTowerUpgradeCost } from './build';
import type { DefenseConfig, DefenseTowerKind } from './config';
import { buildDefensePath } from './path';
import type { DefenseInput, DefenseSnapshot } from './sim';
import type { DefenseEnemyView } from './towers';

/**
 * Bots de prueba. `idlePlaneBot` se queda donde empieza; `chasePlaneBot`
 * vuela hacia el enemigo más adelantado del camino (el que antes llegaría al
 * castillo), se queda a medio alcance y compra los niveles de daño del
 * avión en cuanto llega el dinero. Solos (sin islas) no bastan. `buildingBot` (T159)
 * además construye islas en los sitios que más camino cubren, las sube y
 * compra los niveles del avión: es el jugador sencillo de las pruebas de
 * equilibrio (T165 las afina).
 */

export type DefenseBot = (s: DefenseSnapshot) => DefenseInput;

export const idlePlaneBot: DefenseBot = () => ({});

export const chasePlaneBot: DefenseBot = (s) => {
  const input: DefenseInput = {};
  if (s.plane.nextDamageCost !== null && s.coins >= s.plane.nextDamageCost)
    input.upgradePlane = 'damage';
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
  /** Hasta qué nivel de daño sube el avión (3 por defecto). */
  planeLevel?: number;
}

/** El orden de la construcción sencilla (todas las islas) y lo que repite después. */
export const BUILDING_BOT_ORDER: readonly DefenseTowerKind[] = [
  'ultima',
  'tienda',
  'cala',
  'allday',
  'halloween',
  'fotos',
  'faro',
];
export const BUILDING_BOT_REPEAT: readonly DefenseTowerKind[] = [
  'cala',
  'allday',
  'ultima',
  'fotos',
  'faro',
];

/**
 * Un jugador sencillo que construye. Al empezar puntúa una rejilla de sitios
 * libres (fuera del camino, del vórtice y del castillo) por cuánto camino
 * tienen cerca, y luego, por turnos:
 *
 * 1. construye la siguiente isla de `order` (después, de `repeat`) en el
 *    mejor sitio libre (la granja en el peor: no necesita camino);
 * 2. a partir de la tercera isla, compra los niveles de daño del avión
 *    hasta `planeLevel` (3 por defecto, como el avión del plan 014);
 * 3. tras las de `order`, alterna subir de nivel la isla más baja con
 *    construir otra de `repeat`.
 *
 * Sin nada que hacer, persigue al más adelantado como `chasePlaneBot`.
 */
export function buildingBot(cfg: DefenseConfig, opts: BuildingBotOptions = {}): DefenseBot {
  const order = opts.order ?? BUILDING_BOT_ORDER;
  const repeat = opts.repeat ?? BUILDING_BOT_REPEAT;
  const coverR = opts.coverRadius ?? 230;
  const planeLevel = opts.planeLevel ?? 3;
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

    const planeCost = s.plane.nextDamageCost;
    if (
      built >= 3 &&
      s.plane.damageLevel < planeLevel &&
      planeCost !== null &&
      s.coins >= planeCost
    ) {
      input.upgradePlane = 'damage';
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

    // Se construye en cualquier sitio de la arena (plan 015): sin volar hasta allí.
    input.build = { ...goal };
    return withChase(s, input);
  };
}

function withChase(s: DefenseSnapshot, input: DefenseInput): DefenseInput {
  chase(s, input);
  return input;
}

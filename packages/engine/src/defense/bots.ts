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
 * compra los niveles del avión y la vida del castillo: es el jugador sencillo de las pruebas de
 * equilibrio (T165 las afina; T178 añade la velocidad del avión y el castillo).
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
  /** Hasta qué nivel suben el daño y la velocidad de ataque del avión (3 por defecto). */
  planeLevel?: number;
  /**
   * Sube la vida del castillo (plan 015) cuando le falta al menos lo que
   * suma una mejora (true por defecto).
   */
  castle?: boolean;
  /**
   * Sube Ibiza (la granja) a nivel 2 y 3 en cuanto llega el dinero, desde la
   * tercera isla (true por defecto; se paga en 30 y 20 s).
   */
  farm?: boolean;
}

/** El orden de la construcción sencilla (todas las islas) y lo que repite después. */
export const BUILDING_BOT_ORDER: readonly DefenseTowerKind[] = [
  'tienda',
  'halloween',
  'faro',
  'allday',
  'fotos',
  'cala',
  'ultima',
];
/**
 * Lo que repite: las que más rinden (plan 015 T178; con Ibiza pagándose en
 * 50 s, la granja va primero).
 */
export const BUILDING_BOT_REPEAT: readonly DefenseTowerKind[] = [
  'allday',
  'halloween',
  'faro',
  'fotos',
];

/**
 * Un jugador sencillo que construye. Al empezar puntúa una rejilla de sitios
 * libres (fuera del camino, del vórtice y del castillo) por cuánto camino
 * tienen cerca, y luego, por turnos:
 *
 * 1. construye la siguiente isla de `order` (después, de `repeat`) en el
 *    mejor sitio libre (la granja en el peor: no necesita camino);
 * 2. a partir de la tercera isla, compra los niveles del avión (daño y
 *    velocidad de ataque, el más bajo primero) hasta `planeLevel` (3 por
 *    defecto) y sube Ibiza (`farm`); si al castillo le falta lo que suma
 *    una mejora de vida, la compra antes que nada (`castle`);
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
  const castle = opts.castle ?? true;
  const farm = opts.farm ?? true;
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

    const castleCost = s.castle.nextUpgradeCost;
    if (
      castle &&
      castleCost !== null &&
      s.castle.maxLife - s.castle.life >= cfg.castle.lifePerLevel &&
      s.coins >= castleCost
    ) {
      input.upgradeCastle = true;
      return withChase(s, input);
    }

    if (farm && built >= 3) {
      for (const t of s.towers) {
        if (t.kind !== 'tienda') continue;
        const cost = defenseTowerUpgradeCost(cfg, t);
        if (cost !== null && s.coins >= cost) {
          input.upgradeTower = t.id;
          return withChase(s, input);
        }
      }
    }

    const stat = s.plane.speedLevel < s.plane.damageLevel ? 'speed' : 'damage';
    const level = stat === 'speed' ? s.plane.speedLevel : s.plane.damageLevel;
    const planeCost = stat === 'speed' ? s.plane.nextSpeedCost : s.plane.nextDamageCost;
    if (built >= 3 && level < planeLevel && planeCost !== null && s.coins >= planeCost) {
      input.upgradePlane = stat;
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

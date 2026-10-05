import type { ShipInput } from '../ship/controller';
import { wrapDelta } from '../world/wrap';
import type { CardOption } from './cards';
import type { DifficultyId, EnemyId, PassiveId, SurvivorsConfig, WeaponId } from './config';
import { SURVIVORS_STEP_S } from './config';
import {
  type SurvivorsGame,
  type SurvivorsInput,
  type SurvivorsOptions,
  createSurvivors,
} from './sim';
import type { SurvivorsWorld } from './world';

/**
 * Pilotos sencillos para medir el equilibrio del modo (plan 011 T132): juegan
 * partidas enteras aceleradas contra la simulación pura, sin pantalla. No son
 * IA de juego: sólo dan curvas comparables entre dificultades y semillas.
 *
 * - `idle`: el barco quieto; elige siempre la primera carta.
 * - `dodge`: huye de los enemigos cercanos (más cuanto más cerca) y se aparta
 *   de las islas; elige siempre la primera carta.
 * - `greedy`: esquiva igual, va a por las notas cuando no tiene enemigos
 *   cerca y elige la carta que más puntúa (evolución, Salvavidas, armas y sus
 *   niveles, el vinilo pareja de un arma que lleva…).
 */
export type BotKind = 'idle' | 'dodge' | 'greedy';

/** u: enemigos más lejos que esto no asustan al esquivador. */
const DODGE_REACH = 420;
/** u: margen alrededor de una isla en que el esquivador se aparta. */
const ISLAND_MARGIN = 160;

/** u: el codicioso va a por notas sólo sin enemigos más cerca que esto. */
const SAFE_DISTANCE = 130;
/** u: notas más lejos que esto no le atraen. */
const NOTE_REACH = 700;

/**
 * El mando del esquivador para este paso (sin la carta). Con `notes`, cuando
 * ningún enemigo está cerca, además se acerca a la nota más próxima (como
 * haría quien juega para subir de nivel).
 */
export function dodgeShip(game: SurvivorsGame, notes = false): ShipInput {
  const s = game.snapshot();
  const p = s.player;
  const b = game.world.bounds;
  const w = b.right - b.left;
  const h = b.bottom - b.top;
  let fx = 0;
  let fy = 0;
  let nearest = Infinity;
  for (const e of s.enemies) {
    const dx = wrapDelta(p.x - e.x, w);
    const dy = wrapDelta(p.y - e.y, h);
    const d = Math.hypot(dx, dy);
    if (d < nearest) nearest = d;
    if (d > DODGE_REACH) continue;
    const k = 1 / Math.max(40, d) ** 2;
    fx += dx * k;
    fy += dy * k;
  }
  if (notes && nearest > SAFE_DISTANCE) {
    let best = NOTE_REACH;
    let nx = 0;
    let ny = 0;
    for (const n of s.notes) {
      const dx = wrapDelta(n.x - p.x, w);
      const dy = wrapDelta(n.y - p.y, h);
      const d = Math.hypot(dx, dy);
      if (d < best) {
        best = d;
        nx = dx / Math.max(1, d);
        ny = dy / Math.max(1, d);
      }
    }
    const threat = Math.hypot(fx, fy);
    if (best < NOTE_REACH) {
      // La nota tira con la fuerza de una amenaza a `SAFE_DISTANCE` u.
      const pull = Math.max(threat, 1 / SAFE_DISTANCE);
      fx += nx * pull;
      fy += ny * pull;
    }
  }
  for (const shot of s.enemyProjectiles) {
    const dx = wrapDelta(p.x - shot.x, w);
    const dy = wrapDelta(p.y - shot.y, h);
    const d = Math.hypot(dx, dy);
    if (d > DODGE_REACH / 2) continue;
    const k = 1 / Math.max(40, d) ** 2;
    fx += dx * k;
    fy += dy * k;
  }
  const norm = Math.hypot(fx, fy);
  if (norm > 1e-12) {
    fx /= norm;
    fy /= norm;
  }
  for (const o of game.world.obstacles) {
    const dx = wrapDelta(p.x - o.x, w);
    const dy = wrapDelta(p.y - o.y, h);
    const d = Math.hypot(dx, dy);
    const reach = o.radius + ISLAND_MARGIN;
    if (d < reach) {
      const k = (reach - d) / ISLAND_MARGIN;
      fx += (dx / Math.max(1, d)) * k * 2;
      fy += (dy / Math.max(1, d)) * k * 2;
    }
  }
  if (Math.hypot(fx, fy) < 1e-9) return { dirX: 0, dirY: 0, throttle: 0, drift: false };
  return { dirX: fx, dirY: fy, throttle: 1, drift: false };
}

/** Vinilo que hace pareja con cada arma para su evolución (de la config). */
function pairedVinyls(config: SurvivorsConfig, held: readonly WeaponId[]): Set<PassiveId> {
  const out = new Set<PassiveId>();
  for (const e of config.evolutions) if (held.includes(e.weapon)) out.add(e.passive);
  return out;
}

/** Lo que vale una carta para el piloto codicioso (más es mejor). */
export function greedyScore(game: SurvivorsGame, opt: CardOption): number {
  const held = game.heldWeapons.map((w) => w.id);
  switch (opt.kind) {
    case 'evolution':
      return 100;
    case 'salvavidas':
      return 90;
    case 'weapon-level':
      return 50 + opt.targetLevel;
    case 'weapon-new':
      return 60 - held.length * 4;
    case 'vinyl-new':
    case 'vinyl-level': {
      const paired = opt.vinylId && pairedVinyls(game.config, held).has(opt.vinylId);
      if (paired) return 48;
      if (opt.vinylId === 'house' || opt.vinylId === 'chill') return 40;
      return 30;
    }
    case 'fallback':
      return 0;
  }
}

/** La carta que elige un piloto (índice de la carta abierta). */
export function botChoice(kind: BotKind, game: SurvivorsGame): number {
  const card = game.snapshot().card;
  if (!card || kind !== 'greedy') return 0;
  let best = 0;
  let bestScore = -Infinity;
  card.options.forEach((o, i) => {
    const s = greedyScore(game, o);
    if (s > bestScore) {
      best = i;
      bestScore = s;
    }
  });
  return best;
}

/** El paso entero de un piloto. */
export function botInput(kind: BotKind, game: SurvivorsGame): SurvivorsInput {
  const choose = botChoice(kind, game);
  if (kind === 'idle') return { choose };
  return { ship: dodgeShip(game, kind === 'greedy'), choose };
}

/** Lo que se mide de una partida de un piloto. */
export interface BotRun {
  bot: BotKind;
  difficulty: DifficultyId;
  seed: number;
  end: 'survived' | 'flooded' | 'abandoned' | null;
  /** s de tiempo activo jugados. */
  endS: number;
  /** s de tiempo activo de cada subida de nivel, en orden. */
  levelUpsS: number[];
  /** Nivel al final de cada minuto jugado (índice 0 = 1:00). */
  levelByMinute: number[];
  /** Agua a bordo al final de cada minuto jugado. */
  waterByMinute: number[];
  /** Enemigos vivos por tipo al final de cada minuto jugado. */
  enemiesByMinute: Partial<Record<EnemyId, number>>[];
  /** Derrotados por tipo en la partida. */
  defeatedByType: Partial<Record<EnemyId, number>>;
  /** Armas y vinilos al final. */
  weapons: string[];
  vinyls: string[];
  /** Golpes recibidos. */
  hits: number;
  /** Agua a bordo al acabar. */
  finalWater: number;
  /** Agua metida por cada tipo de enemigo. */
  waterByType: Partial<Record<EnemyId, number>>;
}

/**
 * Juega una partida entera de `kind` (o hasta `maxS` s activos) y mide.
 * Determinista: misma config, semilla, mundo y piloto = mismas cifras.
 */
export function runBot(
  config: SurvivorsConfig,
  kind: BotKind,
  seed: number,
  world: SurvivorsWorld,
  opts: SurvivorsOptions = {},
  maxS = config.durationS,
): BotRun {
  const game = createSurvivors(config, seed, world, opts);
  const run: BotRun = {
    bot: kind,
    difficulty: game.difficulty,
    seed,
    end: null,
    endS: 0,
    levelUpsS: [],
    levelByMinute: [],
    waterByMinute: [],
    enemiesByMinute: [],
    defeatedByType: {},
    weapons: [],
    vinyls: [],
    hits: 0,
    finalWater: 0,
    waterByType: {},
  };
  const minuteSteps = Math.round(60 / SURVIVORS_STEP_S);
  const maxSteps = Math.round(maxS / SURVIVORS_STEP_S) + 200_000;
  let guard = 0;
  let lastActive = 0;
  while (!game.ended && game.activeS < maxS - 1e-9 && guard++ < maxSteps) {
    const water = game.snapshot().water.level;
    const ev = game.step(botInput(kind, game));
    for (const e of ev) {
      if (e.type === 'levelUp') {
        run.levelUpsS.push(game.activeS);
      } else if (e.type === 'hit') {
        run.hits++;
        run.waterByType[e.enemy] = (run.waterByType[e.enemy] ?? 0) + (e.water - water);
      } else if (e.type === 'defeated') {
        run.defeatedByType[e.enemy] = (run.defeatedByType[e.enemy] ?? 0) + 1;
      }
    }
    const active = Math.round(game.activeS / SURVIVORS_STEP_S);
    if (active !== lastActive && active % minuteSteps === 0) {
      const s = game.snapshot();
      run.levelByMinute.push(s.xp.level);
      run.waterByMinute.push(Math.round(s.water.level));
      const byType: Partial<Record<EnemyId, number>> = {};
      for (const e of s.enemies) byType[e.type] = (byType[e.type] ?? 0) + 1;
      run.enemiesByMinute.push(byType);
    }
    lastActive = active;
  }
  const s = game.snapshot();
  run.end = s.end;
  run.endS = s.activeS;
  run.finalWater = s.water.level;
  run.weapons = s.weapons.map((w) => `${w.evolutionId ?? w.id}${w.evolutionId ? '' : w.level}`);
  run.vinyls = s.vinyls.map((v) => `${v.id}${v.level}`);
  return run;
}

/** s entre subidas de nivel seguidas (la primera, desde 0). */
export function levelGaps(run: BotRun): number[] {
  return run.levelUpsS.map((t, i) => t - (i === 0 ? 0 : run.levelUpsS[i - 1]!));
}

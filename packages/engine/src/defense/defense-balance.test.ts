import { describe, expect, it } from 'vitest';
import {
  BUILDING_BOT_ORDER,
  BUILDING_BOT_REPEAT,
  type BuildingBotOptions,
  buildingBot,
} from './bots';
import {
  DEFENSE_CONFIG,
  DEFENSE_DIFFICULTY_IDS,
  DEFENSE_RUN_MINS,
  DEFENSE_TOWER_KINDS,
  type DefenseRunMin,
  type DefenseTowerKind,
  type DifficultyId,
  defenseTowerStats,
} from './config';
import { createDefense, type DefenseResult } from './sim';

/**
 * Equilibrio de «Defensa del Castillo» (plan 014 T165): partidas enteras del
 * bot que construye (`buildingBot`) contra la config de verdad, por duración
 * (5, 7, 10 min), dificultad y semilla. Las curvas y los porcentajes medidos
 * están en la sección de T165 de `ESTADO.md`; aquí se fija la forma:
 *
 * - Tranquila se gana con oro con la construcción sencilla (todas las islas);
 * - Normal se gana, pero el castillo recibe golpes y una construcción de una
 *   sola isla puede caer;
 * - Tormenta cuesta: la construcción sencilla no siempre aguanta, pero nunca
 *   se hunde en la apertura (antes de los 160 s);
 * - ninguna estrategia de una sola isla domina, y cada isla está en alguna
 *   de las mejores construcciones;
 * - Ibiza (la granja) se paga sola en un tiempo razonable.
 */

const CFG = DEFENSE_CONFIG;
const SEEDS = [1, 2, 3, 4, 5, 6];
/** Las estrategias de comparación se juegan con una semilla. */
const STRATEGY_SEED = 7;

/** La construcción sencilla del bot: todas las islas, en su orden por defecto. */
const MIXED: BuildingBotOptions = {};
const ATTACKERS = DEFENSE_TOWER_KINDS.filter((k) => k !== 'tienda');

interface Strategy {
  name: string;
  opts: BuildingBotOptions;
  /** Las islas que puede construir. */
  uses: ReadonlySet<DefenseTowerKind>;
}

/** Granja + una sola isla de ataque, repetida. */
const singleIsland = (k: DefenseTowerKind): Strategy => ({
  name: `sola-${k}`,
  opts: { order: ['tienda', k], repeat: [k] },
  uses: new Set(['tienda', k]),
});
/** La sencilla sin una de las islas. */
const without = (k: DefenseTowerKind): Strategy => {
  const repeat = BUILDING_BOT_REPEAT.filter((x) => x !== k);
  return {
    name: `sin-${k}`,
    opts: { order: BUILDING_BOT_ORDER.filter((x) => x !== k), repeat },
    uses: new Set(BUILDING_BOT_ORDER.filter((x) => x !== k)),
  };
};
const STRATEGIES: Strategy[] = [
  { name: 'sencilla', opts: MIXED, uses: new Set(BUILDING_BOT_ORDER) },
  ...ATTACKERS.map(singleIsland),
  ...DEFENSE_TOWER_KINDS.map(without),
];

interface Run {
  r: DefenseResult;
  /** Vida del castillo al final de cada minuto. */
  curve: number[];
  /** s desde construir la primera granja hasta que ha devuelto su coste (null si no). */
  farmPaybackS: number | null;
}

function play(
  difficulty: DifficultyId,
  runMin: DefenseRunMin,
  opts: BuildingBotOptions,
  seed: number,
): Run {
  const g = createDefense(CFG, seed, { difficulty, runMin });
  const bot = buildingBot(CFG, opts);
  const curve: number[] = [];
  let nextMinute = 60;
  let farm: { id: number; builtS: number; earned: number } | null = null;
  let farmPaybackS: number | null = null;
  while (!g.ended) {
    const events = g.step(bot(g.snapshot()));
    const now = g.snapshot().activeS;
    for (const e of events) {
      if (e.type === 'towerBuilt' && e.kind === 'tienda' && !farm)
        farm = { id: e.towerId, builtS: now, earned: 0 };
      if (e.type === 'coins' && farm && e.towerId === farm.id && farmPaybackS === null) {
        farm.earned += e.amount;
        if (farm.earned >= CFG.towers.kinds.tienda.cost) farmPaybackS = now - farm.builtS;
      }
    }
    if (now >= nextMinute) {
      curve.push(g.snapshot().castle.life);
      nextMinute += 60;
    }
  }
  return { r: g.result()!, curve, farmPaybackS };
}

const cache = new Map<string, Run>();
function run(d: DifficultyId, m: DefenseRunMin, s: Strategy, seed: number): Run {
  const key = `${d}/${m}/${s.name}/${seed}`;
  let out = cache.get(key);
  if (!out) {
    out = play(d, m, s.opts, seed);
    cache.set(key, out);
  }
  return out;
}
const mixed = (d: DifficultyId, m: DefenseRunMin): Run[] =>
  SEEDS.map((seed) => run(d, m, STRATEGIES[0]!, seed));

/** Para ordenar: aguantar gana a caer; aguantando, más vida; cayendo, más tiempo. */
const rank = (r: DefenseResult): number =>
  r.end === 'held' ? 2 + r.castleLife / r.castleMaxLife : r.playedS / r.durationS;
const held = (rs: readonly Run[]): number => rs.filter((x) => x.r.end === 'held').length;
const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

describe('castillo: equilibrio con el bot que construye (T165)', () => {
  it('Tranquila: la construcción sencilla gana con oro en las tres duraciones', () => {
    for (const m of DEFENSE_RUN_MINS)
      for (const x of mixed('tranquila', m)) {
        expect(x.r.end).toBe('held');
        expect(x.r.medal).toBe('oro');
      }
  }, 120_000);

  it('Normal: se gana, pero el castillo recibe golpes y una sola isla puede caer', () => {
    for (const m of DEFENSE_RUN_MINS) {
      const rs = mixed('normal', m);
      expect(held(rs)).toBe(rs.length);
      // Pelea de verdad: en cada duración el castillo pierde vida casi siempre.
      expect(median(rs.map((x) => x.r.castleLife))).toBeLessThan(CFG.castle.life);
      // Y alguna construcción de una sola isla cae o acaba muy tocada.
      const singles = ATTACKERS.map((k) => run('normal', m, singleIsland(k), STRATEGY_SEED).r);
      expect(singles.some((r) => r.end === 'fallen' || r.castleLife <= r.castleMaxLife / 2)).toBe(
        true,
      );
    }
  }, 120_000);

  it('Tormenta: cuesta (la sencilla no siempre aguanta), pero no se hunde en la apertura', () => {
    let total = 0;
    let wins = 0;
    for (const m of DEFENSE_RUN_MINS) {
      const rs = mixed('tormenta', m);
      total += rs.length;
      wins += held(rs);
      for (const x of rs) {
        if (x.r.end === 'fallen') expect(x.r.playedS).toBeGreaterThan(160);
        // Aguantar en Tormenta nunca es gratis.
        else expect(x.r.castleLife).toBeLessThan(x.r.castleMaxLife);
      }
      // Más dura que Normal en la misma duración.
      const normal = mixed('normal', m);
      expect(median(rs.map((x) => rank(x.r)))).toBeLessThanOrEqual(
        median(normal.map((x) => rank(x.r))),
      );
    }
    expect(wins).toBeLessThan(total);
    expect(wins).toBeGreaterThan(0);
  }, 120_000);

  it('ninguna estrategia de una sola isla domina a la sencilla', () => {
    const cells = DEFENSE_RUN_MINS.flatMap((m) =>
      (['normal', 'tormenta'] as const).map((d) => [d, m] as const),
    );
    for (const k of ATTACKERS) {
      const worse = cells.filter(
        ([d, m]) =>
          rank(run(d, m, singleIsland(k), STRATEGY_SEED).r) <
          rank(run(d, m, STRATEGIES[0]!, STRATEGY_SEED).r),
      );
      expect(worse.length, `sola-${k}`).toBeGreaterThan(0);
    }
  }, 120_000);

  it('cada isla está en alguna de las mejores construcciones', () => {
    const inBest = new Set<DefenseTowerKind>();
    for (const d of DEFENSE_DIFFICULTY_IDS)
      for (const m of DEFENSE_RUN_MINS) {
        const scored = STRATEGIES.map((s) => ({ s, v: rank(run(d, m, s, STRATEGY_SEED).r) }));
        const best = Math.max(...scored.map((x) => x.v));
        for (const x of scored) if (x.v >= best - 1e-9) for (const k of x.s.uses) inBest.add(k);
      }
    expect([...inBest].sort()).toEqual([...DEFENSE_TOWER_KINDS].sort());
  }, 120_000);

  it('Ibiza se paga sola: cada nivel en menos de 2 min y la granja del bot lo cumple', () => {
    const def = CFG.towers.kinds.tienda;
    const income = (lvl: number) => {
      const st = defenseTowerStats(CFG, 'tienda', lvl);
      return st.coins / st.cooldownS;
    };
    expect(def.cost / income(1)).toBeLessThanOrEqual(120);
    expect(def.upgradeCost[0] / (income(2) - income(1))).toBeLessThanOrEqual(120);
    expect(def.upgradeCost[1] / (income(3) - income(2))).toBeLessThanOrEqual(120);
    for (const d of DEFENSE_DIFFICULTY_IDS) {
      const x = run(d, 5, STRATEGIES[0]!, STRATEGY_SEED);
      expect(x.farmPaybackS).not.toBeNull();
      expect(x.farmPaybackS!).toBeLessThanOrEqual(120);
    }
  }, 120_000);
});

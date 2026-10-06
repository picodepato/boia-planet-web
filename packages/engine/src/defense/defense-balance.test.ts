import { describe, expect, it } from 'vitest';
import {
  BUILDING_BOT_ORDER,
  BUILDING_BOT_REPEAT,
  type BuildingBotOptions,
  buildingBot,
  type DefenseBot,
} from './bots';
import {
  DEFENSE_CONFIG,
  DEFENSE_STEP_S,
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
 * Equilibrio de «Defensa del Castillo» (plan 014 T165; plan 015 T178 con el
 * camino v2, las mejoras del avión y del castillo, Ibiza y las prioridades):
 * partidas enteras del bot que construye (`buildingBot`) contra la config de
 * verdad, por duración (5, 7, 10 min), dificultad y semilla. Las curvas y los
 * porcentajes medidos están en las secciones de T165 y T178 de `ESTADO.md`;
 * aquí se fija la forma:
 *
 * - Tranquila se gana con oro con la construcción sencilla (todas las islas);
 * - Normal y Tormenta los aguanta la construcción sencilla (plan 016: Hernán
 *   quiere islas más fuertes, no enemigos más duros), pero una construcción
 *   de una sola isla puede caer, y sin Ibiza no llega el dinero;
 * - Tormenta nunca es más fácil que Normal;
 * - ninguna estrategia de una sola isla gana a la sencilla, y cada isla está
 *   en alguna de las mejores construcciones;
 * - Ibiza (la granja) se paga en 45 s a nivel 1 y cada mejora en 30 y 20 s
 *   (plan 016, decisión 5);
 * - «Llamar oleada» en cuanto el mar se vacía no hace más fácil Tormenta.
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

  it('Normal y Tormenta: la construcción sencilla aguanta siempre', () => {
    for (const d of ['normal', 'tormenta'] as const)
      for (const m of DEFENSE_RUN_MINS) {
        const rs = mixed(d, m);
        expect(held(rs), `${d} ${m}`).toBe(rs.length);
      }
  }, 120_000);

  it('alguna construcción de una sola isla cae en Normal o Tormenta', () => {
    const singles = (['normal', 'tormenta'] as const).flatMap((d) =>
      DEFENSE_RUN_MINS.flatMap((m) =>
        ATTACKERS.map((k) => run(d, m, singleIsland(k), STRATEGY_SEED).r),
      ),
    );
    expect(singles.some((r) => r.end === 'fallen')).toBe(true);
  }, 120_000);

  it('sin Ibiza no llega el dinero: la sencilla sin granja cae en Normal y Tormenta', () => {
    const noFarm = STRATEGIES.find((s) => s.name === 'sin-tienda')!;
    for (const d of ['normal', 'tormenta'] as const)
      expect(
        DEFENSE_RUN_MINS.some((m) => run(d, m, noFarm, STRATEGY_SEED).r.end === 'fallen'),
        d,
      ).toBe(true);
  }, 120_000);

  it('Tormenta nunca es más fácil que Normal', () => {
    for (const m of DEFENSE_RUN_MINS)
      expect(median(mixed('tormenta', m).map((x) => rank(x.r)))).toBeLessThanOrEqual(
        median(mixed('normal', m).map((x) => rank(x.r))),
      );
  }, 120_000);

  it('ninguna estrategia de una sola isla gana a la sencilla', () => {
    for (const d of ['normal', 'tormenta'] as const)
      for (const m of DEFENSE_RUN_MINS)
        for (const k of ATTACKERS)
          expect(
            rank(run(d, m, singleIsland(k), STRATEGY_SEED).r),
            `sola-${k} ${d} ${m}`,
          ).toBeLessThanOrEqual(rank(run(d, m, STRATEGIES[0]!, STRATEGY_SEED).r));
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

  it('Ibiza se paga en 45 s, y sus mejoras en 30 y 20 s; la granja del bot lo cumple', () => {
    const def = CFG.towers.kinds.tienda;
    const income = (lvl: number) => {
      const st = defenseTowerStats(CFG, 'tienda', lvl);
      return st.coins / st.cooldownS;
    };
    expect(def.cost / income(1)).toBeCloseTo(45, 6);
    expect(def.upgradeCost[0] / (income(2) - income(1))).toBeCloseTo(30, 6);
    expect(def.upgradeCost[1] / (income(3) - income(2))).toBeCloseTo(20, 6);
    // La granja paga a saltos (cada `cooldownS`): devuelve su coste en el
    // primer pago desde los 45 s.
    const every = defenseTowerStats(CFG, 'tienda', 1).cooldownS;
    const payback = Math.ceil(def.cost / income(1) / every - 1e-9) * every;
    for (const d of DEFENSE_DIFFICULTY_IDS) {
      const x = run(d, 5, STRATEGIES[0]!, STRATEGY_SEED);
      expect(x.farmPaybackS).not.toBeNull();
      expect(x.farmPaybackS!).toBeLessThanOrEqual(payback + DEFENSE_STEP_S * 2);
    }
  }, 120_000);

  it('«Llamar oleada» en cuanto el mar se vacía no hace más fácil Tormenta', () => {
    const callWhenClear = (opts: BuildingBotOptions): DefenseBot => {
      const bot = buildingBot(CFG, opts);
      return (s) => {
        const input = bot(s);
        if (s.enemies.length === 0 && s.nextWave && s.nextWave.inS > 1) input.callWave = true;
        return input;
      };
    };
    for (const m of DEFENSE_RUN_MINS) {
      const g = createDefense(CFG, STRATEGY_SEED, { difficulty: 'tormenta', runMin: m });
      const bot = callWhenClear(MIXED);
      let called = 0;
      while (!g.ended) for (const e of g.step(bot(g.snapshot()))) if (e.type === 'waveCalled') called++;
      expect(called).toBeGreaterThan(0);
      expect(rank(g.result()!)).toBeLessThanOrEqual(
        rank(run('tormenta', m, STRATEGIES[0]!, STRATEGY_SEED).r),
      );
    }
  }, 120_000);
});

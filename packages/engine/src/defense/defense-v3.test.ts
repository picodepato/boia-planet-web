import { describe, expect, it } from 'vitest';
import { defenseSiteReason } from './build';
import {
  DEFENSE_CONFIG,
  DEFENSE_DAMAGE_BOOST_016,
  DEFENSE_DAMAGE_T178,
  DEFENSE_STEP_S,
  DEFENSE_TOWER_KINDS,
  defenseFarmPayout,
  defenseFarmShare,
  defenseTowerStats,
} from './config';
import { buildDefensePath } from './path';
import { type DefenseEvent, type DefenseGame, type DefenseInput, createDefense } from './sim';

/**
 * El castillo v3 (plan 016 T181): curvas en U más anchas, Ibiza que se paga
 * en 45/30/20 s, las Ibizas de más que pagan menos (100/70/50 %) y el daño
 * +15 % de Faro, Nochevieja, Puerto y Benidorm. Las cifras salen de la
 * configuración, nunca a mano.
 */

const CFG = DEFENSE_CONFIG;
const PATH = buildDefensePath(CFG.path, CFG.castle.radius);
const DT = DEFENSE_STEP_S;

describe('curvas en U más anchas (decisión 3)', () => {
  // Lo que ocupa la isla más grande: todas cubren `islandRadius` a nivel 3.
  const island = 2 * CFG.islandRadius;
  // Y lo que necesita para ponerse: su huella con el agua libre hasta el carril.
  const buildable = 2 * (CFG.islandRadius + CFG.towers.pathClearance);

  it('entre los bordes del carril de cada U cabe la isla más grande y un 30 % más', () => {
    expect(PATH.uTurns.length).toBeGreaterThan(0);
    for (const u of PATH.uTurns) {
      const inner = 2 * u.radius - CFG.path.width;
      expect(inner).toBeGreaterThanOrEqual(island * 1.3);
      expect(inner).toBeGreaterThanOrEqual(buildable * 1.3);
      // Y la isla se pone holgada: también a un lado del centro de la U.
      const slack = (inner - buildable) / 2;
      expect(slack).toBeGreaterThan(0);
      expect(defenseSiteReason(CFG, PATH, [], u.x, u.y)).toBeNull();
    }
  });

  it('el camino apenas crece y el paseo sigue en sus segundos', () => {
    // La v2 del plan 015 medía ≈ 10 390 u: con U más anchas, poco más.
    expect(PATH.length).toBeGreaterThan(10_000);
    expect(PATH.length).toBeLessThan(11_000);
    expect(CFG.path.normalWalkS).toBe(44);
  });
});

describe('Ibiza: 45/30/20 s y las de más pagan menos (decisiones 5 y 6)', () => {
  const def = CFG.towers.kinds.tienda;
  const income = (lvl: number) => {
    const st = defenseTowerStats(CFG, 'tienda', lvl);
    return st.coins / st.cooldownS;
  };

  it('nivel 1 se paga en 45 s; la mejora a 2 en 30 s; la de 3 en 20 s', () => {
    expect(def.cost / income(1)).toBeCloseTo(45, 6);
    expect(def.upgradeCost[0] / (income(2) - income(1))).toBeCloseTo(30, 6);
    expect(def.upgradeCost[1] / (income(3) - income(2))).toBeCloseTo(20, 6);
  });

  it('la primera paga el 100 %, la segunda el 70 %, la tercera y siguientes el 50 %', () => {
    expect([0, 1, 2, 3, 6].map((r) => defenseFarmShare(CFG, r))).toEqual([1, 0.7, 0.5, 0.5, 0.5]);
    for (const lvl of [1, 2, 3]) {
      const coins = defenseTowerStats(CFG, 'tienda', lvl).coins;
      expect(defenseFarmPayout(CFG, lvl, 0)).toBe(coins);
      expect(defenseFarmPayout(CFG, lvl, 1)).toBe(Math.round(coins * 0.7));
      expect(defenseFarmPayout(CFG, lvl, 2)).toBe(Math.round(coins * 0.5));
    }
  });

  /** Una partida con dinero y tres Ibizas en sitios libres, en orden. */
  function threeFarms(): { g: DefenseGame; ids: number[] } {
    const cfg = structuredClone(CFG);
    cfg.startCoins = 5000;
    const g = createDefense(cfg, 5);
    const ids: number[] = [];
    const placed: { x: number; y: number }[] = [];
    for (let x = -900; x <= 900 && ids.length < 3; x += 40)
      for (let y = -900; y <= 900 && ids.length < 3; y += 40) {
        if (defenseSiteReason(cfg, PATH, placed, x, y)) continue;
        const t = g.build('tienda', x, y)!;
        ids.push(t.id);
        placed.push({ x, y });
      }
    return { g, ids };
  }

  /** Monedas de cada Ibiza en `s` segundos (por el aviso `coins`). */
  function paid(g: DefenseGame, ids: readonly number[], s: number): number[] {
    const out = ids.map(() => 0);
    for (let i = 0; i < Math.round(s / DT); i++)
      for (const e of g.step())
        if (e.type === 'coins' && e.towerId !== null) out[ids.indexOf(e.towerId)]! += e.amount;
    return out;
  }

  it('en la partida, por orden de construcción: la ficha dice lo que entra de verdad', () => {
    const { g, ids } = threeFarms();
    expect(ids).toHaveLength(3);
    expect(ids.map((id) => g.farmRank(id))).toEqual([0, 1, 2]);
    const st = defenseTowerStats(CFG, 'tienda', 1);
    const got = paid(g, ids, st.cooldownS * 2 + DT);
    expect(got).toEqual(ids.map((id) => g.farmPayout(id)! * 2));
    expect(got).toEqual([0, 1, 2].map((r) => defenseFarmPayout(CFG, 1, r) * 2));
    // Las monedas van directas al monedero (Hernán, 2026-10-06: sin montón).
    expect(g.result()).toBeNull();
  });

  it('vender la primera sube a las demás un puesto', () => {
    const { g, ids } = threeFarms();
    g.sellTower(ids[0]!);
    expect(g.farmRank(ids[1]!)).toBe(0);
    expect(g.farmRank(ids[2]!)).toBe(1);
    expect(g.farmRank(ids[0]!)).toBe(-1);
    expect(g.farmPayout(ids[1]!)).toBe(defenseFarmPayout(CFG, 1, 0));
    expect(g.farmPayout(ids[0]!)).toBeNull();
  });

  it('determinista: mismas órdenes, misma partida', () => {
    const play = () => {
      const { g, ids } = threeFarms();
      const log: DefenseEvent['type'][] = [];
      for (let i = 0; i < Math.round(40 / DT); i++) {
        const input: DefenseInput = {};
        if (i === 600) input.upgradeTower = ids[1]!;
        if (i === 1200) input.sellTower = ids[0]!;
        for (const e of g.step(input)) log.push(e.type);
      }
      return { hash: g.stateHash(), purse: g.purse, log: log.join(',') };
    };
    expect(play()).toEqual(play());
  });
});

describe('daño +15 % en Faro, Nochevieja, Puerto y Benidorm (Hernán, 2026-10-06)', () => {
  it('sale de los valores del plan 015 por el mismo factor, a todos los niveles', () => {
    expect(DEFENSE_DAMAGE_BOOST_016).toBe(1.15);
    expect(Object.keys(DEFENSE_DAMAGE_T178).sort()).toEqual(['cala', 'faro', 'fotos', 'ultima']);
    for (const level of [1, 2, 3] as const) {
      const before = (k: keyof typeof DEFENSE_DAMAGE_T178) => DEFENSE_DAMAGE_T178[k][level - 1]!;
      expect(defenseTowerStats(CFG, 'faro', level).damagePerS / before('faro')).toBeCloseTo(1.15, 3);
      expect(defenseTowerStats(CFG, 'ultima', level).damage / before('ultima')).toBeCloseTo(1.15, 3);
      expect(defenseTowerStats(CFG, 'cala', level).damage / before('cala')).toBeCloseTo(1.15, 3);
      expect(defenseTowerStats(CFG, 'fotos', level).damage / before('fotos')).toBeCloseTo(1.15, 3);
    }
  });

  it('Halloween, el Sonido e Ibiza no están en la lista de las que suben', () => {
    const up = new Set(Object.keys(DEFENSE_DAMAGE_T178));
    expect(DEFENSE_TOWER_KINDS.filter((k) => !up.has(k)).sort()).toEqual(
      ['allday', 'halloween', 'tienda'].sort(),
    );
  });
});

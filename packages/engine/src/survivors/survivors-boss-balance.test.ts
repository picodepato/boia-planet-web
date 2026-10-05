import { WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { rng } from '../minigames/rng';
import { type BotRun, runBot, warningEscape } from './bots';
import { type BossId, DIFFICULTY_IDS, type DifficultyId, SURVIVORS_CONFIG } from './config';
import { actFinalBoss, actMinibosses } from './medals';
import type { BossWarningView } from './sim';
import { type SurvivorsWorld, survivorsWorldOf } from './world';

/**
 * Equilibrio de la beta 3 con los bosses (plan 012 T147): partidas enteras
 * del piloto que esquiva y elige bien (`greedy`, que desde T147 también sale
 * de los avisos de boss) por acto, dificultad y semilla, contra la config de
 * verdad con su guion entero (Vecino 2:30, Tiburón 4:30, boss final 5:30).
 * Las curvas medidas están en la sección de T147 de `ESTADO.md`; aquí se fija
 * la forma:
 *
 * - los dos minibosses caen casi siempre en Tranquila y Normal, y el Tiburón
 *   ya no cae en un suspiro;
 * - el boss final se gana en Tranquila, es una pelea de verdad en Normal y
 *   cuesta mucho en Tormenta; el Kraken (acto 2) cuesta más que el Fantasma;
 * - las élites sueltan botín a más o menos la probabilidad configurada.
 */

function arcillaWorld(): SurvivorsWorld {
  const w = WORLD_REGISTRY.get('arcilla').config;
  return survivorsWorldOf(w, w.bounds, { x: 0, y: 0 });
}

/** Un archipiélago denso en un mar pequeño que da la vuelta (como en T132). */
function archipelago(seed: number): SurvivorsWorld {
  const r = rng(seed);
  const obstacles = [];
  for (let i = 0; i < 45; i++) {
    const x = -1800 + r() * 3600;
    const y = -1800 + r() * 3600;
    if (Math.hypot(x, y) < 260) continue;
    obstacles.push({ x, y, radius: 40 + r() * 150 });
  }
  return {
    bounds: { left: -1800, right: 1800, top: -1800, bottom: 1800 },
    obstacles,
    start: { x: 0, y: 0 },
  };
}

const SEEDS = [1, 2, 3, 4, 5, 6];
const worldFor = (seed: number): SurvivorsWorld =>
  seed % 2 === 1 ? arcillaWorld() : archipelago(30 + seed);

const cache = new Map<string, BotRun[]>();
function runs(act: number, difficulty: DifficultyId): BotRun[] {
  const key = `${act}/${difficulty}`;
  let out = cache.get(key);
  if (!out) {
    out = SEEDS.map((seed) =>
      runBot(SURVIVORS_CONFIG, 'greedy', seed, worldFor(seed), { difficulty, act }),
    );
    cache.set(key, out);
  }
  return out;
}

const mean = (xs: readonly number[]): number =>
  xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const beat = (r: BotRun, boss: BossId): boolean => r.bossesDefeated.includes(boss);
const wins = (rs: readonly BotRun[]): number => rs.filter((r) => r.end === 'victory').length;
/** s que duró el combate con `boss` (hasta caer o retirarse; null si no entró). */
const fightS = (r: BotRun, boss: BossId): number | null => {
  const f = r.bossFights.find((x) => x.boss === boss);
  return f ? (f.endS ?? r.endS) - f.spawnS : null;
};
const fights = (rs: readonly BotRun[], boss: BossId): number[] =>
  rs.map((r) => fightS(r, boss)).filter((s): s is number => s !== null);
/** Vida que le quedó al boss final (0 si cayó; 1 si ni llegó). */
const finalHpLeft = (r: BotRun, boss: BossId): number => r.bossHpLeft[boss] ?? 1;

const SLOW = 600_000;
const ACTS = [1, 2] as const;

describe('survivors: equilibrio con los bosses (T147)', () => {
  it('cada acto tiene sus dos minibosses y su boss final en el guion', () => {
    for (const act of ACTS) {
      expect(actMinibosses(act).length, `acto ${act}`).toBe(2);
      expect(actFinalBoss(act), `acto ${act}`).not.toBeNull();
    }
    expect(actFinalBoss(1)).not.toBe(actFinalBoss(2));
  });

  it(
    'quien esquiva y elige bien vence a los dos minibosses casi siempre en Tranquila y Normal',
    () => {
      for (const act of ACTS) {
        const minis = actMinibosses(act);
        for (const d of ['tranquila', 'normal'] as const) {
          for (const boss of minis) {
            const n = runs(act, d).filter((r) => beat(r, boss)).length;
            expect(n, `acto ${act} ${d} ${boss}`).toBeGreaterThanOrEqual(SEEDS.length - 2);
          }
          // Los dos en la misma partida (la plata), en la mayoría.
          const both = runs(act, d).filter((r) => minis.every((b) => beat(r, b))).length;
          expect(both, `acto ${act} ${d} ambos`).toBeGreaterThan(SEEDS.length / 2);
        }
      }
    },
    SLOW,
  );

  it(
    'los minibosses no caen en un suspiro (el Tiburón aguanta más de 20 s en Normal)',
    () => {
      const [vecino, martillo] = actMinibosses(1) as [BossId, BossId];
      expect(median(fights(runs(1, 'normal'), martillo))).toBeGreaterThanOrEqual(20);
      expect(median(fights(runs(1, 'normal'), vecino))).toBeGreaterThanOrEqual(10);
      // Y en Tranquila tampoco es instantáneo.
      expect(median(fights(runs(1, 'tranquila'), martillo))).toBeGreaterThanOrEqual(10);
    },
    SLOW,
  );

  it(
    'el boss final: se gana en Tranquila, es una pelea en Normal y cuesta mucho en Tormenta',
    () => {
      for (const act of ACTS) {
        const boss = actFinalBoss(act)!;
        const t = runs(act, 'tranquila');
        const n = runs(act, 'normal');
        const s = runs(act, 'tormenta');
        const label = `acto ${act} (${boss})`;
        // Tranquila: se gana en la mayoría (el Kraken, en la mitad o más).
        expect(wins(t), label).toBeGreaterThanOrEqual(
          act === 1 ? SEEDS.length - 1 : SEEDS.length / 2,
        );
        // Normal: se puede ganar, no más que en Tranquila, y no es un paseo.
        expect(wins(n), label).toBeGreaterThanOrEqual(act === 1 ? SEEDS.length / 2 : 1);
        expect(wins(n), label).toBeLessThanOrEqual(wins(t));
        expect(mean(fights(n, boss)), label).toBeGreaterThanOrEqual(40);
        // Tormenta: casi nunca, y le queda más vida que en Normal.
        expect(wins(s), label).toBeLessThanOrEqual(2);
        expect(wins(s), label).toBeLessThan(wins(n));
        expect(mean(s.map((r) => finalHpLeft(r, boss))), label).toBeGreaterThan(
          mean(n.map((r) => finalHpLeft(r, boss))),
        );
      }
    },
    SLOW,
  );

  it(
    'el Kraken (acto 2) cuesta más que el Barco Fantasma (acto 1) en cada dificultad',
    () => {
      for (const d of DIFFICULTY_IDS) {
        expect(wins(runs(2, d)), d).toBeLessThanOrEqual(wins(runs(1, d)));
      }
      const hp = (act: number) =>
        mean(runs(act, 'normal').map((r) => finalHpLeft(r, actFinalBoss(act)!)));
      expect(hp(2)).toBeGreaterThan(hp(1));
    },
    SLOW,
  );

  it(
    'quien esquiva casi no se come los golpes avisados de los bosses',
    () => {
      for (const act of ACTS) {
        for (const d of ['tranquila', 'normal'] as const) {
          // Menos de un golpe por combate de media.
          const rs = runs(act, d);
          const hits = rs.reduce((a, r) => a + r.bossHits, 0);
          const fought = rs.reduce((a, r) => a + r.bossFights.length, 0);
          expect(hits / fought, `acto ${act} ${d}`).toBeLessThan(1);
        }
      }
    },
    SLOW,
  );

  it(
    'las élites sueltan botín a más o menos la probabilidad de la config',
    () => {
      let drops = 0;
      let elites = 0;
      for (const act of ACTS) {
        for (const d of DIFFICULTY_IDS) {
          for (const r of runs(act, d)) {
            drops += r.drops;
            elites += r.elitesDefeated;
          }
        }
      }
      const p = SURVIVORS_CONFIG.drops.chance;
      expect(elites).toBeGreaterThan(1000);
      // ±4 desviaciones típicas de una binomial: holgado, pero pilla un 2× o un ½.
      const sd = Math.sqrt(p * (1 - p) * elites);
      expect(Math.abs(drops - p * elites)).toBeLessThan(4 * sd);
    },
    SLOW,
  );
});

/** Formas de aviso de prueba (los campos que no usa una forma, a 0). */
function warning(over: Partial<BossWarningView>): BossWarningView {
  return {
    id: 1,
    boss: 'prueba',
    attack: 'x',
    kind: 'circles',
    x: 0,
    y: 0,
    heading: 0,
    length: 0,
    radius: 0,
    thickness: 0,
    gaps: 0,
    gapRad: 0,
    gapPhase: 0,
    ringRadius: 0,
    progress: 0.5,
    hit: false,
    ...over,
  };
}

describe('survivors: el piloto sale de los avisos de boss (T147)', () => {
  const W = 10_000;
  it('círculo: lejos del centro; fuera, nada', () => {
    const c = warning({ kind: 'circles', radius: 70 });
    const out = warningEscape([c], 30, 0, W, W);
    expect(out.x).toBeGreaterThan(0);
    expect(Math.abs(out.y)).toBeLessThan(1e-9);
    expect(warningEscape([c], 300, 0, W, W)).toEqual({ x: 0, y: 0 });
  });

  it('línea de embestida: de lado, hacia el lado donde ya está', () => {
    const l = warning({ kind: 'line', heading: 0, length: 600, thickness: 30 });
    const above = warningEscape([l], 200, 10, W, W);
    expect(above.y).toBeGreaterThan(0);
    expect(Math.abs(above.x)).toBeLessThan(1e-9);
    const below = warningEscape([l], 200, -10, W, W);
    expect(below.y).toBeLessThan(0);
    // Por detrás del final de la línea o muy a un lado: nada.
    expect(warningEscape([l], 800, 0, W, W)).toEqual({ x: 0, y: 0 });
    expect(warningEscape([l], 200, 200, W, W)).toEqual({ x: 0, y: 0 });
  });

  it('anillo: rodea el centro hacia el hueco más cercano; ya pasada la onda, nada', () => {
    const r = warning({
      kind: 'ring',
      radius: 440,
      thickness: 22,
      gaps: 2,
      gapRad: 0.6,
      gapPhase: 0,
    });
    // A 100 u del centro, un poco por encima del hueco de ángulo 0: gira hacia abajo (−y).
    const a = 0.5;
    const out = warningEscape([r], Math.cos(a) * 100, Math.sin(a) * 100, W, W);
    const tangentDown = { x: Math.sin(a), y: -Math.cos(a) };
    expect(out.x * tangentDown.x + out.y * tangentDown.y).toBeGreaterThan(0.9);
    // Ya en el hueco: quieto.
    expect(warningEscape([r], 100, 0, W, W)).toEqual({ x: 0, y: 0 });
    // La onda ya pasó por encima: a salvo.
    const passed = { ...r, hit: true, ringRadius: 300 };
    expect(warningEscape([passed], Math.cos(a) * 100, Math.sin(a) * 100, W, W)).toEqual({
      x: 0,
      y: 0,
    });
  });
});

import { circuitFromWorld } from '@boia/engine/circuit';
import { FAST_LAP_MS, RACE_FAST_MS, SAMPLE_ACHIEVEMENTS } from '@boia/store';
import { CIRCUIT_ID, WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { marWorld } from './engine/compact';
import { botRace } from './race-test-helpers';

/**
 * El umbral de «Rápido» (plan 015 T176, decisión 16: «un tiempo decente que
 * un jugador normal consigue hacia el intento 3–5»), medido con el piloto
 * de las pruebas de Los Rápidos (`botRace`: la física y el runtime de /mar,
 * a fondo hacia cada boia, sin turbo).
 *
 * Modelo de jugador normal: el mismo piloto con un error de puntería que va
 * y viene (dos senos de 0,1–0,3 Hz y 0,3–0,7 Hz, fase y frecuencia propias
 * de cada jugador e intento) de amplitud `A_k = A_1 · L^(k−1)` en el intento
 * k: el primero se pasa de largo y zigzaguea (A_1 = 1 rad) y cada intento
 * corrige un 20 % (L = 0,8). Sin turbo. Para cada uno de 24 jugadores, el
 * primer intento con la regata por debajo del umbral.
 *
 * Medido el 2026-10-06 (curso v3 de T73): el piloto, 67,3 s; con 80 s, el
 * primer éxito cae en el intento 2 (1 jugador), 3 (10), 4 (5), 5 (2), 6 (2)
 * y 7 (4): mediana 4, 18 de 24 a más tardar en el quinto. Con 78 s, mediana
 * 5; con 82 s, 3 (muchos ya en el segundo).
 * `MEDIR=1 pnpm exec vitest run apps/web/app/mar/race-rapido.test.ts`
 * escribe la tabla.
 */

const world = marWorld(WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config);
const spec = circuitFromWorld(world, CIRCUIT_ID)!;

const PLAYERS = 24;
const MAX_TRIES = 10;
const A1 = 1;
const LEARN = 0.8;

/** Un generador pequeño y fijo (mulberry32): cada jugador e intento, el suyo. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** El tiempo del intento `k` (desde 1) del jugador `p`, en ms (Infinity si no llega). */
function attempt(p: number, k: number): number {
  const r = rng(1000 + p * 31 + k * 7);
  const f1 = 0.1 + 0.2 * r();
  const f2 = 0.3 + 0.4 * r();
  const p1 = 2 * Math.PI * r();
  const p2 = 2 * Math.PI * r();
  const amp = A1 * LEARN ** (k - 1);
  const aim = (t: number) =>
    amp * (0.6 * Math.sin(2 * Math.PI * f1 * t + p1) + 0.4 * Math.sin(2 * Math.PI * f2 * t + p2));
  return botRace(world, 300, false, aim).finish?.ms ?? Infinity;
}

/** El primer intento por debajo de `ms` de cada jugador (MAX_TRIES + 1 si ninguno). */
function firstSuccess(ms: number): number[] {
  return Array.from({ length: PLAYERS }, (_, p) => {
    for (let k = 1; k <= MAX_TRIES; k++) if (attempt(p, k) <= ms) return k;
    return MAX_TRIES + 1;
  });
}

const median = (xs: readonly number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

describe('«Rápido»: el umbral de la regata (T176)', () => {
  it('el logro pide RACE_FAST_MS en Los Rápidos', () => {
    const fast = SAMPLE_ACHIEVEMENTS.find((a) => a.triggerParams?.maxMs === RACE_FAST_MS);
    expect(fast?.triggerParams).toMatchObject({ circuit: spec.id, maxMs: RACE_FAST_MS });
  });

  it('el piloto perfecto lo hace; entre la plata y el bronce, por encima del Rayo', () => {
    const bot = botRace(world).finish!.ms;
    expect(bot).toBeLessThan(RACE_FAST_MS);
    expect(RACE_FAST_MS).toBeGreaterThan(FAST_LAP_MS);
    expect(RACE_FAST_MS).toBeGreaterThan(spec.medals.silver);
    expect(RACE_FAST_MS).toBeLessThan(spec.medals.bronze);
  });

  it('el jugador normal lo consigue hacia el intento 3–5, y casi nadie a la primera', () => {
    const tries = firstSuccess(RACE_FAST_MS);
    if (process.env.MEDIR) console.log('primer éxito por jugador', [...tries].sort((a, b) => a - b).join(','));
    const m = median(tries);
    expect(m).toBeGreaterThanOrEqual(3);
    expect(m).toBeLessThanOrEqual(5);
    expect(tries.filter((k) => k === 1)).toEqual([]);
    // La mayoría, a más tardar en el quinto.
    expect(tries.filter((k) => k <= 5).length).toBeGreaterThan(PLAYERS / 2);
  }, 120_000);
});

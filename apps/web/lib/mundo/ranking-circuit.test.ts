import { SAMPLE_CREW } from '@boia/store';
import { CIRCUIT_MEDALS, WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import {
  SAMPLE_CIRCUIT_MS,
  circuitName,
  circuitRanking,
  crewLeader,
  crewPlace,
} from './ranking-circuit';

const withTime = SAMPLE_CREW.filter((c) => SAMPLE_CIRCUIT_MS[c.userId] !== undefined);
const sorted = [...withTime].sort(
  (a, b) => SAMPLE_CIRCUIT_MS[a.userId]! - SAMPLE_CIRCUIT_MS[b.userId]!,
);

describe('pestaña Circuito del ranking local (T56)', () => {
  it('sin vuelta: los de muestra por tiempo y el visitante al final, sin puesto', () => {
    const r = circuitRanking({ nickname: null, hasCarnet: false, bestMs: null });
    expect(withTime.length).toBeGreaterThan(0);
    expect(r.rows.map((x) => x.userId)).toEqual([...sorted.map((c) => c.userId), '']);
    expect(r.rows.at(-1)).toBe(r.mine);
    expect(r.mine.position).toBeNull();
    expect(r.rows.slice(0, -1).map((x) => x.position)).toEqual(sorted.map((_, i) => i + 1));
    expect(r.rows.slice(0, -1).every((x) => x.isSample && !x.isMine)).toBe(true);
  });

  it('con vuelta: el visitante entra en su puesto por tiempo (más rápido, más arriba)', () => {
    const fastest = SAMPLE_CIRCUIT_MS[sorted[0]!.userId]!;
    const r = circuitRanking({ nickname: 'Yo', hasCarnet: true, bestMs: fastest - 1 });
    expect(r.rows[0]).toBe(r.mine);
    expect(r.mine.position).toBe(1);
    const slow = circuitRanking({ nickname: 'Yo', hasCarnet: true, bestMs: 10 * 60_000 });
    expect(slow.mine.position).toBe(sorted.length + 1);
    expect(slow.rows.at(-1)).toBe(slow.mine);
  });

  it('el nombre del circuito es el del lugar de salida en cada mundo', () => {
    for (const w of WORLD_REGISTRY.list()) {
      const name = circuitName(WORLD_REGISTRY.get(w.id).config);
      expect(name, w.id).toBeTruthy();
    }
  });
});

describe('la carrera contra la tripulación de muestra (T73)', () => {
  it('el puesto de una carrera: 1 más los que fueron más rápidos, de ellos más uno', () => {
    const times = sorted.map((c) => SAMPLE_CIRCUIT_MS[c.userId]!);
    const of = sorted.length + 1;
    expect(crewPlace(times[0]! - 1)).toEqual({ position: 1, of });
    expect(crewPlace(times[0]! + 1)).toEqual({ position: 2, of });
    expect(crewPlace(times.at(-1)! + 1)).toEqual({ position: of, of });
  });

  it('el récord de la tripulación es el del más rápido', () => {
    const first = sorted[0]!;
    expect(crewLeader()).toEqual({ name: first.nickname, ms: SAMPLE_CIRCUIT_MS[first.userId] });
    expect(crewLeader(SAMPLE_CREW, {})).toBeNull();
  });

  it('los tiempos de muestra son del trazado de ahora: entre las medallas, no todos con oro', () => {
    const times = Object.values(SAMPLE_CIRCUIT_MS);
    expect(Math.min(...times)).toBeGreaterThan(CIRCUIT_MEDALS.gold);
    expect(times.some((t) => t > CIRCUIT_MEDALS.silver)).toBe(true);
  });
});

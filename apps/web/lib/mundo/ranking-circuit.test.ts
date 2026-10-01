import { SAMPLE_CREW } from '@boia/store';
import { WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { SAMPLE_CIRCUIT_MS, circuitName, circuitRanking } from './ranking-circuit';

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

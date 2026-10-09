import { describe, expect, it } from 'vitest';
import { SAMPLE_CONTENT } from './sample-content';
import { TRIO_SIZE, trioAt } from './rotation';

// REQ-COM-026: 100 rotaciones con los artistas de muestra.
describe('rotación del trío de artistas en 100 pasos (REQ-COM-026)', () => {
  const n = SAMPLE_CONTENT.artists.length;
  const STEPS = 100;

  it('ningún trío repite a nadie ni repite a alguien en el paso siguiente', () => {
    expect(n).toBeGreaterThanOrEqual(2 * TRIO_SIZE);
    for (let step = 0; step < STEPS; step++) {
      const trio = trioAt(n, step);
      expect(new Set(trio).size).toBe(TRIO_SIZE);
      const next = new Set(trioAt(n, step + 1));
      for (const i of trio) expect(next.has(i)).toBe(false);
    }
  });

  it('en cada vuelta completa de n pasos, las apariciones por artista no difieren en más de 1', () => {
    for (let vuelta = 0; (vuelta + 1) * n <= STEPS; vuelta++) {
      const counts = new Array<number>(n).fill(0);
      for (let step = vuelta * n; step < (vuelta + 1) * n; step++) {
        for (const i of trioAt(n, step)) counts[i]! += 1;
      }
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    }
  });
});

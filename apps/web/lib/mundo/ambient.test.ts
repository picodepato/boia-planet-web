import { describe, expect, it } from 'vitest';
import {
  AMBIENT_PEAK,
  AMBIENT_RATE,
  AMBIENT_SECONDS,
  ambientRecipe,
  renderAmbient,
} from './ambient';
import { worlds } from './demo-world';

// Un loop corto basta para las propiedades; el de verdad dura AMBIENT_SECONDS.
const RATE = 8000;

describe('ambiente generado (O10)', () => {
  const ids = worlds.ids();

  it('cada mundo tiene su loop, y el mismo mundo da siempre el mismo', () => {
    expect(ids.length).toBeGreaterThan(1);
    const recipes = ids.map((id) => JSON.stringify(ambientRecipe(id)));
    expect(new Set(recipes).size).toBe(ids.length);
    const a = renderAmbient(ids[0]!, RATE);
    const b = renderAmbient(ids[0]!, RATE);
    expect(a).toEqual(b);
  });

  it('suena, no satura y dura lo que dice', () => {
    const s = renderAmbient(ids[0]!, RATE);
    expect(s.length).toBe(RATE * AMBIENT_SECONDS);
    let peak = 0;
    let energy = 0;
    for (const v of s) {
      peak = Math.max(peak, Math.abs(v));
      energy += v * v;
    }
    expect(peak).toBeCloseTo(AMBIENT_PEAK, 5);
    expect(Math.sqrt(energy / s.length)).toBeGreaterThan(0.05);
  });

  it('empalma sin chasquido: el salto del final al principio es como uno cualquiera', () => {
    for (const id of ids) {
      const s = renderAmbient(id, AMBIENT_RATE);
      let maxStep = 0;
      for (let i = 1; i < s.length; i++) maxStep = Math.max(maxStep, Math.abs(s[i]! - s[i - 1]!));
      const seam = Math.abs(s[0]! - s[s.length - 1]!);
      expect(seam, id).toBeLessThanOrEqual(maxStep);
    }
  });
});

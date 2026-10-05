import { describe, expect, it } from 'vitest';
import {
  DAMAGE_LIFE_S,
  DAMAGE_WINDOW_S,
  DamageNumbers,
  damageRise,
} from './survivors-readout-model';

const hit = (id: number, damage: number) => ({ id, kind: 'enemy' as const, damage, x: 10, y: 20 });

describe('damage numbers', () => {
  it('aggregates weapons in a short fixed window per enemy, preserving positions', () => {
    const numbers = new DamageNumbers(12);
    numbers.add(hit(1, 4.5), 0);
    numbers.add({ ...hit(1, 7.5), x: 15 }, 0.1);
    numbers.add(hit(2, 3), 0.02);
    expect(numbers.read(0.15)).toHaveLength(0);
    expect(numbers.read(0.19)).toMatchObject([
      { id: 1, damage: 12, x: 15 },
      { id: 2, damage: 3 },
    ]);
    numbers.add(hit(1, 2), 0.2);
    expect(numbers.read(0.37)).toMatchObject([{ damage: 12 }, { damage: 3 }, { damage: 2 }]);
  });

  it('keeps bosses separate from enemy ids and expires using active time', () => {
    const numbers = new DamageNumbers(12);
    numbers.add(hit(1, 4), 1);
    numbers.add({ ...hit(1, 8), kind: 'boss' }, 1);
    expect(numbers.read(1 + DAMAGE_WINDOW_S)).toHaveLength(2);
    // Repeated reads during a pause do not create numbers or age them.
    for (let i = 0; i < 20; i++) expect(numbers.read(1.2)).toHaveLength(2);
    expect(numbers.read(1 + DAMAGE_WINDOW_S + DAMAGE_LIFE_S + 0.001)).toHaveLength(0);
  });

  it('caps both pending and visible floods and drops stale windows', () => {
    const numbers = new DamageNumbers(3);
    for (let id = 0; id < 1000; id++) numbers.add(hit(id, 1), 0);
    expect(numbers.read(0.2).map((v) => v.id)).toEqual([0, 1, 2]);
    for (let id = 0; id < 10; id++) numbers.add(hit(id, 1), 0.21);
    expect(numbers.read(0.4).map((v) => v.id)).toEqual([0, 1, 2]);
    numbers.add(hit(10, 1), 0.41);
    expect(numbers.read(10)).toHaveLength(0);
  });

  it('finishes windows under sustained damage to more targets than the cap', () => {
    const numbers = new DamageNumbers(12);
    for (let step = 0; step < 60; step++) {
      for (let id = 0; id < 60; id++) numbers.add(hit(id, 1), step / 60);
      if (step > 10) {
        expect(numbers.read(step / 60).length).toBeGreaterThan(0);
        expect(numbers.read(step / 60).length).toBeLessThanOrEqual(12);
      }
    }
    expect(numbers.read(1).every((v) => v.damage > 1)).toBe(true);
  });

  it('clears pending and visible numbers when disabled, with no replay on re-enable', () => {
    const numbers = new DamageNumbers(12);
    numbers.add(hit(1, 4), 0);
    numbers.read(0.2);
    numbers.add(hit(2, 2), 0.2);
    numbers.clear();
    expect(numbers.read(0.5)).toHaveLength(0);
  });

  it('ignores non-positive/non-finite damage and disabled capacity', () => {
    const numbers = new DamageNumbers(12);
    for (const damage of [0, -1, Infinity, NaN]) numbers.add(hit(1, damage), 0);
    expect(numbers.read(1)).toHaveLength(0);
    const disabled = new DamageNumbers(0);
    disabled.add(hit(1, 1), 0);
    expect(disabled.read(1)).toHaveLength(0);
  });

  it('reduced motion keeps every number stationary', () => {
    expect(damageRise(0, false)).toBe(0);
    expect(damageRise(0.5, false)).toBeGreaterThan(0);
    expect(damageRise(0.1, true)).toBe(0);
    expect(damageRise(1, true)).toBe(0);
  });
});

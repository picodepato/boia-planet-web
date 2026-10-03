import { describe, expect, it } from 'vitest';
import {
  MOTION_BUDGET_MS,
  PROBE_FLOOR_MS,
  PROBE_LEVELS,
  QUALITY,
  nextProbeLevel,
  pickMotionLevel,
} from './quality';

const LAST = QUALITY.length - 1;
const over = MOTION_BUDGET_MS + 1;

/** A costs array with the given levels measured (`null` for the others). */
function probed(costs: Record<number, number>): (number | null)[] {
  return QUALITY.map((_, i) => costs[i] ?? null);
}

describe('render quality (plan 007 T80)', () => {
  it('level 0 is the design: MSAA at full resolution; the rest only lose quality', () => {
    expect(QUALITY[0]).toEqual({ msaa: true, scale: 1 });
    for (let i = 1; i < QUALITY.length; i++) {
      expect(QUALITY[i]!.msaa).toBe(false);
      expect(QUALITY[i]!.scale).toBeLessThanOrEqual(QUALITY[i - 1]!.scale);
    }
    expect(PROBE_LEVELS[0]).toBe(0);
    expect(PROBE_LEVELS.at(-1)).toBe(LAST);
  });

  it('a GPU within the motion budget keeps the full quality in motion', () => {
    expect(pickMotionLevel(probed({ 0: MOTION_BUDGET_MS / 4 }))).toBe(0);
    expect(pickMotionLevel(probed({ 0: MOTION_BUDGET_MS }))).toBe(0);
    expect(nextProbeLevel(probed({ 0: MOTION_BUDGET_MS }))).toBeUndefined();
  });

  it('measures the probed levels in order while none fits', () => {
    expect(nextProbeLevel(probed({}))).toBe(0);
    expect(pickMotionLevel(probed({}))).toBeUndefined();
    expect(nextProbeLevel(probed({ 0: over }))).toBe(PROBE_LEVELS[1]);
    expect(pickMotionLevel(probed({ 0: over }))).toBeUndefined();
    expect(pickMotionLevel(probed({ 0: 90, [PROBE_LEVELS[1]!]: MOTION_BUDGET_MS - 1 }))).toBe(
      PROBE_LEVELS[1],
    );
  });

  it('at the lowest level: kept while it holds 30 fps, else the static version', () => {
    const slow: Record<number, number> = {};
    for (const lv of PROBE_LEVELS) slow[lv] = 90;
    expect(pickMotionLevel(probed({ ...slow, [LAST]: over }))).toBe(LAST);
    expect(pickMotionLevel(probed({ ...slow, [LAST]: PROBE_FLOOR_MS }))).toBe(LAST);
    expect(pickMotionLevel(probed({ ...slow, [LAST]: PROBE_FLOOR_MS + 1 }))).toBeNull();
    expect(nextProbeLevel(probed(slow))).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import {
  LOW_POWER_MAX_SIDE,
  MOTION_BUDGET_MS,
  PROBE_FLOOR_MS,
  PROBE_MIN_FPS,
  PROBE_LEVELS,
  QUALITY,
  cappedResolution,
  needsResolutionCap,
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

  it('at the lowest level: kept while it holds PROBE_MIN_FPS, else the static version', () => {
    const slow: Record<number, number> = {};
    for (const lv of PROBE_LEVELS) slow[lv] = 90;
    expect(pickMotionLevel(probed({ ...slow, [LAST]: over }))).toBe(LAST);
    expect(pickMotionLevel(probed({ ...slow, [LAST]: PROBE_FLOOR_MS }))).toBe(LAST);
    expect(pickMotionLevel(probed({ ...slow, [LAST]: PROBE_FLOOR_MS + 1 }))).toBeNull();
    expect(nextProbeLevel(probed(slow))).toBeUndefined();
  });

  it('plan 041 T321: accepts the scene at 20 fps, rejects it below', () => {
    expect(PROBE_MIN_FPS).toBe(20);
    expect(PROBE_FLOOR_MS).toBe(50);
    const slow = { 0: 90, [PROBE_LEVELS[1]!]: 90 };
    // 20 fps at the lowest level: the scene, at the lowest level in motion.
    expect(pickMotionLevel(probed({ ...slow, [LAST]: 50 }))).toBe(LAST);
    expect(pickMotionLevel(probed({ ...slow, [LAST]: 45.5 }))).toBe(LAST);
    // 25-30 fps used to be the still; now it is the scene.
    expect(pickMotionLevel(probed({ ...slow, [LAST]: 1000 / 25 }))).toBe(LAST);
    // Slower than 20 fps everywhere: the still.
    expect(pickMotionLevel(probed({ ...slow, [LAST]: 51 }))).toBeNull();
    expect(pickMotionLevel(probed({ 0: 120, [PROBE_LEVELS[1]!]: 80, [LAST]: 70 }))).toBeNull();
  });

  it('plan 041 T321: an unmeasured level (null) is no failure; noisy samples count at their best', () => {
    // The failing desktop runs: [46.6, 127.8, null, 45.5] and [48.8, 46.5, null, 62.9].
    expect(pickMotionLevel([46.6, 127.8, null, 45.5])).toBe(LAST);
    expect(pickMotionLevel([48.8, 46.5, null, 62.9])).toBe(LAST);
    expect(nextProbeLevel([46.6, 127.8, null, 45.5])).toBeUndefined();
  });

  it('plan 041 T321: the lowest level caps the canvas resolution on big screens', () => {
    expect(needsResolutionCap(LAST)).toBe(true);
    expect(needsResolutionCap(null)).toBe(true);
    expect(needsResolutionCap(0)).toBe(false);
    expect(needsResolutionCap(PROBE_LEVELS[1])).toBe(false);
    // 1920×1080 at 1 and at 1.5 device px per CSS px: 1280 px on the long side.
    for (const dpr of [1, 1.5]) {
      const r = cappedResolution(1920, 1080, dpr);
      expect(Math.round(1920 * r)).toBe(LOW_POWER_MAX_SIDE);
      expect(Math.round(1080 * r)).toBe(720);
    }
    // 2560×1440: the same 1280×720 as a smaller screen.
    const r = cappedResolution(2560, 1440, 1.5);
    expect(Math.round(2560 * r)).toBe(LOW_POWER_MAX_SIDE);
    expect(Math.round(1440 * r)).toBe(720);
    // Portrait: the long side is the height.
    expect(Math.round(1440 * cappedResolution(900, 1440, 1))).toBe(LOW_POWER_MAX_SIDE);
    // A small window keeps its resolution.
    expect(cappedResolution(1024, 700, 1)).toBe(1);
    expect(cappedResolution(800, 600, 1.5)).toBe(1.5);
  });
});

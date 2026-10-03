/**
 * Render quality of the landing hero (plan 007 T80). Level 0 is the design:
 * 4× MSAA at the capped resolution, and every frame at rest gets it. A slow
 * GPU draws the frames in motion (the scroll, the appearance, «Zarpar»)
 * without MSAA and then at a fraction of the resolution; as soon as the
 * motion stops, the frame is drawn again at level 0.
 */
export const QUALITY: readonly { readonly msaa: boolean; readonly scale: number }[] = [
  { msaa: true, scale: 1 },
  { msaa: false, scale: 1 },
  { msaa: false, scale: 0.75 },
  { msaa: false, scale: 0.5 },
];

/**
 * The levels the first-frames probe measures, in order (the one in between
 * is only reached by stepping down while the frames in motion come slow):
 * few draws, so the probe costs little even on a slow GPU.
 */
export const PROBE_LEVELS: readonly number[] = [0, 1, QUALITY.length - 1];

/** A frame in motion should fit in this (ms, GPU included): 60 fps with room for the page. */
export const MOTION_BUDGET_MS = 20;
/** Under 30 fps at the lowest quality: the static version (low power). */
export const PROBE_FLOOR_MS = 1000 / 30;
/** A first sample this far over the motion budget needs no second one. */
export const CLEARLY_OVER_MS = 3 * MOTION_BUDGET_MS;

export interface ProbeResult {
  /** ms per frame (GPU included) per quality level; `null` for the levels not measured. */
  costs: (number | null)[];
  /** The level frames in motion use. */
  motion: number;
}

/** The next level the probe has to measure, if any. */
export function nextProbeLevel(costs: readonly (number | null | undefined)[]): number | undefined {
  for (const lv of PROBE_LEVELS) {
    const c = costs[lv];
    if (c === null || c === undefined) return lv;
    if (c <= MOTION_BUDGET_MS) return undefined;
  }
  return undefined;
}

/**
 * The level for frames in motion, from what the probed levels cost
 * (`costs[i]` for level `i`): the first probed level within
 * `MOTION_BUDGET_MS`; `undefined` while a level still has to be measured;
 * at the lowest level, `null` if even that is under 30 fps (the static
 * version).
 */
export function pickMotionLevel(
  costs: readonly (number | null | undefined)[],
): number | null | undefined {
  for (const lv of PROBE_LEVELS) {
    const c = costs[lv];
    if (c === null || c === undefined) return undefined;
    if (c <= MOTION_BUDGET_MS) return lv;
  }
  const last = QUALITY.length - 1;
  return costs[last]! <= PROBE_FLOOR_MS ? last : null;
}

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
/**
 * The slowest the scene is still accepted at (plan 041 T321): 20 fps at the
 * lowest quality. Below it, the static version (low power). The steady-state
 * cap of 30 fps in motion (run.ts) does not change.
 */
export const PROBE_MIN_FPS = 20;
/** A frame dearer than this (ms, GPU included) at the lowest quality: the static version. */
export const PROBE_FLOOR_MS = 1000 / PROBE_MIN_FPS;
/**
 * At the lowest quality, the long side of the canvas is drawn at this many
 * device px at most and upscaled by CSS (plan 041 T321): a big screen costs
 * like a smaller one.
 */
export const LOW_POWER_MAX_SIDE = 1280;
/** A first sample this far over the motion budget needs no second one. */
export const CLEARLY_OVER_MS = 3 * MOTION_BUDGET_MS;

export interface ProbeResult {
  /** ms per frame (GPU included) per quality level; `null` for the levels not measured. */
  costs: (number | null)[];
  /** The level frames in motion use. */
  motion: number;
  /** Device px per CSS px of the canvas (capped when the GPU needs the lowest level). */
  resolution: number;
}

/**
 * Device px per CSS px for a `width`×`height` (CSS px) canvas at the lowest
 * quality: `resolution`, lowered so the long side is at most
 * `LOW_POWER_MAX_SIDE` device px.
 */
export function cappedResolution(width: number, height: number, resolution: number): number {
  const side = Math.max(1, width, height);
  return Math.min(resolution, LOW_POWER_MAX_SIDE / side);
}

/** The probe ended at the lowest level (or below it): the canvas resolution gets capped. */
export function needsResolutionCap(motion: number | null | undefined): boolean {
  return motion === null || motion === QUALITY.length - 1;
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
 * at the lowest level, `null` if even that is under `PROBE_MIN_FPS` (the
 * static version). A level that was not measured (`null`) is no failure; and
 * since the lowest level costs no more than the others, the cheapest
 * measured cost is what the floor is checked against (the samples are noisy:
 * T321 saw 46.6 ms at level 0 and 127.8 ms at level 1 on the same GPU).
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
  let best = Infinity;
  for (const lv of PROBE_LEVELS) best = Math.min(best, costs[lv] ?? Infinity);
  return best <= PROBE_FLOOR_MS ? last : null;
}

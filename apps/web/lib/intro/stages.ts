import type { TitleMotion } from '@boia/engine/intro';

/**
 * The order of the hero on a load of `/` (plan 020 T227, Hernán's review
 * §Portada 1): first the globe, then the 3D BOIA letters, and at the end, with
 * a fade, «Zarpar», «Consigue descuentos» and «Desliza». The same on mobile and
 * with the static version (no WebGL, a scene that misses its budget, low
 * power): the still stands for the globe, the flat «BOIA» for the letters.
 *
 * `run.ts` marks the stage on `<html data-hero-stage>`; the CSS hides what
 * has not come yet (landing.css). Before `run.ts` arrives, the boot script's
 * `data-intro="play"` hides the same things, so nothing shows early.
 *
 * - `globe`: only the globe (or the still). At the rest it waits for the 3D
 *   letters' sheet, at most `TITLE_WAIT_MS`.
 * - `title`: «BOIA» comes in (the 3D letters rise, or the flat title fades in).
 * - `ready`: the buttons, the discount line and the scroll hint fade in.
 */
export type HeroStage = 'globe' | 'title' | 'ready';

/** At the rest, how long the globe waits for the 3D letters before the flat «BOIA». */
export const TITLE_WAIT_MS = 1200;
/** Static version: the still alone for a moment before «BOIA». */
export const STILL_GLOBE_MS = 700;
/** The flat «BOIA» fades in (landing.css: 0.4 s) and holds a beat. */
export const FLAT_TITLE_MS = 600;
/** After the last 3D letter lands, a beat before the buttons. */
export const AFTER_LETTERS_MS = 150;

/**
 * Whether this load plays the order: the boot script asked for the
 * appearance (plain `/`, D-21) and the system does not ask for reduced
 * motion. A direct URL (`?intro=0`, `/#…`, a return from /mar) and reduced
 * motion show everything at once, as before.
 */
export function playsOrder(bootMode: string, reducedMotion: boolean): boolean {
  return bootMode === 'intro' && !reducedMotion;
}

/** How long the 3D letters take to rise, from the first to the last one in place. */
export function lettersRiseMs(motion: Pick<TitleMotion, 'rise'>, letters: number): number {
  const r = motion.rise;
  return r.delayMs + r.staggerMs * Math.max(0, letters - 1) + r.durationMs;
}

/** How long «BOIA» holds the stage before the buttons come: 3D letters or flat title. */
export function titleStageMs(motion: Pick<TitleMotion, 'rise'>, letters: number | null): number {
  return letters === null ? FLAT_TITLE_MS : lettersRiseMs(motion, letters) + AFTER_LETTERS_MS;
}

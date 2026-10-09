/** Time each store image stays before the next one (T201). */
export const PRODUCT_ROTATION_MS = 2000;

/** The image after `index`, back to the first after the last. */
export const nextImageIndex = (index: number, count: number): number =>
  count > 0 ? (index + 1) % count : 0;

/** The image before `index`, round to the last from the first (plan 020 T227). */
export const prevImageIndex = (index: number, count: number): number =>
  count > 0 ? (index - 1 + count) % count : 0;

/** A swipe this far across the photo (fraction of its width) changes it. */
export const SWIPE_FRACTION = 0.2;
/** …or a flick this fast (px/ms), however short, once past `FLICK_MIN_PX`. */
export const FLICK_SPEED = 0.4;
export const FLICK_MIN_PX = 24;

/**
 * Where a sideways swipe on a product's photo goes (plan 020 T227, decision
 * 5): +1 the next photo (dragged to the left), -1 the previous one, 0 stays.
 */
export function swipeStep(dx: number, width: number, ms: number): -1 | 0 | 1 {
  const far = width > 0 && Math.abs(dx) >= width * SWIPE_FRACTION;
  const flick = Math.abs(dx) >= FLICK_MIN_PX && Math.abs(dx) / Math.max(ms, 1) >= FLICK_SPEED;
  if (!far && !flick) return 0;
  return dx < 0 ? 1 : -1;
}

/** Time each store image stays before the next one (T201). */
export const PRODUCT_ROTATION_MS = 3500;

/** The image after `index`, back to the first after the last. */
export const nextImageIndex = (index: number, count: number): number =>
  count > 0 ? (index + 1) % count : 0;

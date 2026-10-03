/**
 * Low power (plan 007 T80): the hero shows its static version (T78's still,
 * no WebGL) on devices that would struggle with the three.js scene. Signals,
 * any of them: the visitor asked to save data, `navigator.deviceMemory ≤ 4`
 * (GB, Chromium only) or `navigator.hardwareConcurrency ≤ 4`. The first
 * frames of the scene are measured too (`intro-scene.ts`, the probe): a GPU
 * that cannot hold 30 fps at the lowest motion quality also gets the still.
 *
 * Apple's WebKit does not report the real core count (Safari and every
 * browser on iOS say 4 or 8 to resist fingerprinting; every iPhone says 4),
 * so there the core count is not a signal and the frame probe decides.
 */

export interface PowerSignals {
  deviceMemory?: number;
  hardwareConcurrency?: number;
  vendor?: string;
  connection?: { saveData?: boolean };
}

/** At or under this many GB of memory, or this many cores: low power. */
export const LOW_MEMORY_GB = 4;
export const LOW_CORES = 4;

export function isLowPower(nav: PowerSignals): boolean {
  if (nav.connection?.saveData === true) return true;
  if (
    typeof nav.deviceMemory === 'number' &&
    nav.deviceMemory > 0 &&
    nav.deviceMemory <= LOW_MEMORY_GB
  )
    return true;
  const appleWebKit = /apple/i.test(nav.vendor ?? '');
  const cores = nav.hardwareConcurrency;
  return !appleWebKit && typeof cores === 'number' && cores > 0 && cores <= LOW_CORES;
}

/** This browser, now. */
export function lowPower(): boolean {
  try {
    return isLowPower(navigator as Navigator & PowerSignals);
  } catch {
    return false;
  }
}

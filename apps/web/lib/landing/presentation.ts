/**
 * The landing's presentation after the hero (plan 021 T235, after
 * noartmusic.com): one pinned screen that the scroll plays forwards and, going
 * back up, rewinds. Everything here is a pure function of the scroll `p`,
 * measured in viewport heights from the top of the presentation (which starts
 * with the page, over the hero):
 *
 * 1. `hero`   — the hero as it is.
 * 2. `black`  — the black veil comes over the hero (the first zoom).
 * 3. `beats`  — on the black, «BOIA» in three beats: it appears, it grows,
 *               it settles (pum, pum, pum).
 * 4. `window` — a small window of video opens around the logo.
 * 5. `open`   — the window opens to the full screen: a decisive start, a soft
 *               arrival.
 * 6. `full`   — the video full screen for a moment; at `END` the screen
 *               unpins and «Próximo evento» comes up under it.
 *
 * The page's CSS reserves `END + 1` screens for the track (landing.css,
 * `--reel-end`): change both together. The header stays hidden until `end`
 * (the boot script's `headerFrom` in the landing's page.tsx, plan 022 T238).
 */

export type PresentationStage = 'hero' | 'black' | 'beats' | 'window' | 'open' | 'full';

/** Where each stage starts (viewport heights of scroll). */
export const PRESENTATION = {
  black: 0,
  /** The veil is full black here. */
  beats: 0.42,
  window: 1.3,
  /** The small window is open and playing; the opening starts at `open`. */
  open: 1.62,
  full: 2.72,
  /** The screen unpins. */
  end: 3.1,
} as const;

/** The three beats of the logo: when each one starts and how long it takes. */
const BEATS = [0.5, 0.78, 1.06] as const;
const BEAT_LEN = 0.1;
/** The logo's scale before the first beat, and after each one. */
const BEAT_SCALES = [1.4, 1, 1.16, 0.92] as const;
/** Over how much scroll the logo turns white once the window starts to open. */
const LOGO_WHITE_LEN = 0.35;
/** How far the slit of the window opens (of `PRESENTATION.window → open`). */
const WINDOW_IN = 0.55;
/**
 * The video's scale in the small window (it grows to 1 with the opening). The
 * video covers the screen and the small window is at most half of it across
 * and high, so from 0.5 up the window never shows past the video's edge.
 */
export const VIDEO_SCALE_SMALL = 0.6;

export interface WindowBox {
  /** Insets of the video's clip from each edge of the screen, in px. */
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PresentationFrame {
  stage: PresentationStage;
  /** Opacity of the black over the hero, 0..1. */
  veil: number;
  logoOpacity: number;
  logoScale: number;
  /** The logo goes from the brand's orange (0) to white (1) as the video opens. */
  logoWhite: number;
  /** Opacity of the video (0 until the window starts to open). */
  video: number;
  /** The video's scale (about the centre of the screen). */
  videoScale: number;
  window: WindowBox;
  /** The video should play (its window is on screen). */
  playing: boolean;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const span = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
/** A decisive start and a soft arrival. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
/** A snap with a small overshoot: the beat. */
const snap = (t: number) => {
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

export function presentationStage(p: number): PresentationStage {
  const P = PRESENTATION;
  if (p <= P.black) return 'hero';
  if (p < P.beats) return 'black';
  if (p < P.window) return 'beats';
  if (p < P.open) return 'window';
  if (p < P.full) return 'open';
  return 'full';
}

/** The logo's scale at `p`: holds between the beats, snaps on each one. */
export function logoScale(p: number): number {
  let scale: number = BEAT_SCALES[0];
  for (let i = 0; i < BEATS.length; i++) {
    const t = span(p, BEATS[i]!, BEATS[i]! + BEAT_LEN);
    if (t <= 0) break;
    scale = lerp(BEAT_SCALES[i]!, BEAT_SCALES[i + 1]!, snap(t));
  }
  return scale;
}

/**
 * The small window: centred, about a third of the screen across on a wide
 * screen and half of it, in portrait, on a phone.
 */
export function smallWindow(vw: number, vh: number): { width: number; height: number } {
  if (vw >= vh) {
    const width = Math.min(vw * 0.3, 520);
    return { width, height: Math.min(width * (9 / 16), vh * 0.5) };
  }
  const width = vw * 0.5;
  return { width, height: Math.min(width * 1.3, vh * 0.5) };
}

/** How far the window has opened to the full screen at `p`, 0..1 (eased). */
export function openProgress(p: number): number {
  return easeOut(span(p, PRESENTATION.open, PRESENTATION.full));
}

/** The video's window at `p` for a `vw × vh` screen. */
export function windowBox(p: number, vw: number, vh: number): WindowBox {
  const small = smallWindow(vw, vh);
  const P = PRESENTATION;
  const inT = smooth(span(p, P.window, lerp(P.window, P.open, WINDOW_IN)));
  const openT = openProgress(p);
  // The slit opens from the middle line to the small window...
  const h0 = small.height * inT;
  // ...and the small window to the full screen.
  const w = lerp(small.width, vw, openT);
  const h = lerp(h0, vh, openT);
  const x = (vw - w) / 2;
  const y = (vh - h) / 2;
  return { top: y, right: x, bottom: y, left: x };
}

export function presentationFrame(p: number, vw: number, vh: number): PresentationFrame {
  const P = PRESENTATION;
  const veil = smooth(span(p, P.black, P.beats));
  const box = windowBox(p, vw, vh);
  const video = p > P.window ? 1 : 0;
  return {
    stage: presentationStage(p),
    veil,
    logoOpacity: smooth(span(p, BEATS[0], BEATS[0] + BEAT_LEN * 0.6)),
    logoScale: logoScale(p),
    logoWhite: smooth(span(p, P.open, P.open + LOGO_WHITE_LEN)),
    video,
    videoScale: lerp(VIDEO_SCALE_SMALL, 1, openProgress(p)),
    window: box,
    playing: video > 0 && p < P.end + 1,
  };
}

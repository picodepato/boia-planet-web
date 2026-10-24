/**
 * The hero's static version (2026-10-08, decision 4): today the T78 stills of
 * the sea by the port; Roke will provide a video or a GIF to replace them.
 * To use it, put the file under `public/` (for example
 * `public/contenido/portada/portada.mp4`) and set its path here: `.mp4` and
 * `.webm` play as a muted loop, any other image (`.gif`, `.webp`, `.png`,
 * `.jpg`) shows as it is. `null` keeps the stills.
 */
export const HERO_MEDIA_SRC: string | null = null;

export type HeroMediaKind = 'video' | 'image';

/** How the hero shows a file, from its extension. */
export function heroMediaKind(src: string): HeroMediaKind {
  return /\.(mp4|webm)(\?.*)?$/i.test(src) ? 'video' : 'image';
}

/**
 * The video of the presentation after the hero (plan 021 T235): the small
 * window that opens to the full screen. Since plan 042 T322 it is BOIA's real
 * video (8 s), converted to a muted H.264 MP4 (1280×720, 24 fps, yuv420p,
 * `+faststart`, ≤ 2 MB) with its first frame as the poster (WebP, 1280×720).
 * Since plan 043 T323 there is also a 1080p version (1920×1080, same format,
 * ≤ 5 MB) that `presentationVideoSrc` picks on big screens with a good
 * connection. To swap the video, replace the three files under
 * `public/contenido/portada/` in the same format.
 */
export const PRESENTATION_VIDEO = {
  src: '/contenido/portada/presentacion.mp4',
  src1080: '/contenido/portada/presentacion-1080.mp4',
  poster: '/contenido/portada/presentacion.webp',
} as const;

/** The long side of the screen, in device pixels, from which 1080p is worth it. */
export const PRESENTATION_1080_MIN_PX = 1440;
/** The viewport's CSS width from which 1080p is offered: phones and small screens stay at 720p. */
export const PRESENTATION_1080_MIN_CSS_WIDTH = 1024;
/** The slowest measured downlink (Mbps) that still gets 1080p (~5 MB in 8 s). */
export const PRESENTATION_1080_MIN_MBPS = 5;
/** The only `effectiveType` that gets 1080p when the browser reports one. */
export const PRESENTATION_1080_TYPE = '4g';

/** What the browser says of its screen and connection (Network Information API). */
export interface PresentationViewer {
  width: number;
  height: number;
  dpr: number;
  connection?: { saveData?: boolean; effectiveType?: string; downlink?: number } | null | undefined;
}

/**
 * Which file the presentation plays (plan 043 T323), decided once when its
 * source is set: the 1080p one only on a big screen (CSS width ≥
 * `PRESENTATION_1080_MIN_CSS_WIDTH`, so never on a phone, and long side × dpr
 * ≥ `PRESENTATION_1080_MIN_PX`), without data saving and, where the browser
 * reports its connection, on 4g with a downlink ≥ `PRESENTATION_1080_MIN_MBPS`
 * when given. Without `navigator.connection` (Safari, Firefox) the screen
 * alone decides. Anything else plays the 720p file.
 */
export function presentationVideoSrc(v: PresentationViewer): string {
  const big =
    v.width >= PRESENTATION_1080_MIN_CSS_WIDTH &&
    Math.max(v.width, v.height) * (v.dpr || 1) >= PRESENTATION_1080_MIN_PX;
  const c = v.connection;
  const good =
    !c ||
    (c.saveData !== true &&
      c.effectiveType === PRESENTATION_1080_TYPE &&
      (typeof c.downlink !== 'number' || c.downlink >= PRESENTATION_1080_MIN_MBPS));
  return big && good ? PRESENTATION_VIDEO.src1080 : PRESENTATION_VIDEO.src;
}

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

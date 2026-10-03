/** T78's stills of the hero scene (`art/landing/`), served by `/api/art`. */
const STILLS = '/api/art/landing';

const url = (name: string, width: number) => `${STILLS}/${name}-${width}.webp`;

/** The stills' size (both files share the aspect). */
const WIDTH = 1600;
const HEIGHT = 1000;

/**
 * How wide the still is drawn (plan 007 T85). It covers a full-viewport box
 * (`object-fit: cover`), so on a screen narrower than the still's aspect it
 * fills the height and is drawn `aspect × 100vh` wide, wider than the screen:
 * a portrait phone at DPR 2 needs the 1600 px file, not the 800 px one that
 * `100vw` would pick. Media conditions instead of `max()` so every browser
 * reads it.
 */
const STILL_SIZES = `(max-aspect-ratio: ${WIDTH}/${HEIGHT}) ${(100 * WIDTH) / HEIGHT}vh, 100vw`;

/**
 * The static version of the hero (plan 007 T79, T77 §9): the Blender render
 * of the sea by the port at golden hour and its night variant, fixed behind
 * the page. Lazy: they only load when the static version shows (CSS
 * `html[data-hero="still"]`, or the Admin's draft preview), so they are not
 * in the landing's critical path. Decorative (`alt=""`). `muestra`.
 */
export function HeroStills() {
  return (
    <>
      {(['hero-still', 'hero-still-noche'] as const).map((name) => (
        // eslint-disable-next-line @next/next/no-img-element -- arte de art/ servido por /api/art
        <img
          key={name}
          className={
            name === 'hero-still' ? 'hero__still-img' : 'hero__still-img hero__still-img--night'
          }
          src={url(name, 800)}
          srcSet={`${url(name, 800)} 800w, ${url(name, 1600)} 1600w`}
          sizes={STILL_SIZES}
          width={WIDTH}
          height={HEIGHT}
          alt=""
          loading="lazy"
          decoding="async"
        />
      ))}
    </>
  );
}

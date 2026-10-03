/** T78's stills of the hero scene (`art/landing/`), served by `/api/art`. */
const STILLS = '/api/art/landing';

const url = (name: string, width: number) => `${STILLS}/${name}-${width}.webp`;

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
          sizes="100vw"
          width={1600}
          height={1000}
          alt=""
          loading="lazy"
          decoding="async"
        />
      ))}
    </>
  );
}

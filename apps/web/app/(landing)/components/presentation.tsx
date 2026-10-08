import { Suspense, lazy } from 'react';
import { PRESENTATION_VIDEO } from '../../../lib/landing/hero-media';

/** The scroll behind the presentation: out of the landing's critical path (D-26). */
const PresentationMotion = lazy(() =>
  import('./presentation-motion').then((m) => ({ default: m.PresentationMotion })),
);

/**
 * The presentation between the hero and «Próximo evento» (plan 021 T235,
 * after noartmusic.com; `lib/landing/presentation.ts`): a pinned black
 * screen over the hero where the scroll brings «BOIA» in three beats, opens a
 * small window of video and takes it to the full screen. The layout (its
 * height, the pin) is decided by the CSS before the first paint; the motion
 * and the video come with `PresentationMotion`. Without JavaScript or with
 * reduced motion it is a still block: the poster and the logo. Decorative:
 * the hero and the sections around it say everything.
 */
export function Presentation() {
  return (
    <div className="reel" aria-hidden="true" data-testid="presentacion">
      <div className="reel__stage">
        <div className="reel__window">
          {/* eslint-disable-next-line @next/next/no-img-element -- art from art/, served by /api/art */}
          <img
            className="reel__poster"
            src={PRESENTATION_VIDEO.poster}
            width={1280}
            height={720}
            alt=""
            loading="lazy"
            decoding="async"
          />
          <video className="reel__video" loop playsInline preload="none" />
        </div>
        <span className="reel__logo" />
      </div>
      <Suspense fallback={null}>
        <PresentationMotion />
      </Suspense>
    </div>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import type { IntroData } from '../../../lib/intro/load';
import { attachIntro, enterIntro, skipIntro } from '../../../lib/intro/lazy';
import { ZARPAR_HREF, markZarpar } from '../../../lib/intro/zarpar';
import { HeroStills } from './hero-stills';

/**
 * Si la navegación de la app a /mar no llega en este tiempo tras «Zarpar»,
 * carga completa (con el velo puesto, nada se ve a medias).
 */
const ZARPAR_FALLBACK_MS = 8000;

/**
 * The hero's scene (T57, T64; plan 007 T79; D-19, D-21, D-24): the fixed
 * layer under the whole page. What the server paints works alone: the CSS
 * sky and a light CSS planet at the rest pose (REQ-ENT-038), and the stills
 * of the static version. On hydration, the hero (`lib/intro/run.ts`) loads
 * the three.js scene on demand and puts it on top; the scroll drives it.
 * «Zarpar» (`[data-zarpar]`, a plain link to /mar) dives into the port with
 * the veil and enters `/mar` with the welcome of the boia open (T64); the
 * header's pill fades to the veil. The hero lives as long as the load of
 * `/`, not this component: a remount picks it up where it was.
 */
export function IntroStage({
  data,
  coverLabel,
}: {
  data: IntroData | null;
  /** El texto de la pantalla de carga de /mar, que el velo ya enseña (T64). */
  coverLabel: string;
}) {
  const router = useRouter();
  // El router de la app es estable, pero la entrada no se vuelve a enganchar por él.
  const routerRef = useRef(router);
  routerRef.current = router;
  const hostRef = useRef<HTMLDivElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!data) {
      window.__boiaEntry?.reveal('none');
      return;
    }
    const hero = () => hostRef.current?.closest<HTMLElement>('.hero') ?? null;
    const find = <T extends Element>(sel: string) => ({
      get current() {
        return hero()?.querySelector<T>(sel) ?? null;
      },
    });
    let fallback = 0;
    const detach = attachIntro(data, {
      host: hostRef,
      hero: {
        get current() {
          return hero();
        },
      },
      ui: find<HTMLElement>('.hero__ui'),
      title: find<HTMLElement>('.hero__wordmark'),
      title3d: find<HTMLCanvasElement>('.intro-title3d'),
      enter: find<HTMLElement>('[data-zarpar="hero"]'),
      cover: coverRef,
      // Mientras se mira el planeta, /mar ya se va pidiendo: zarpar es inmediato.
      onPaused: () => routerRef.current.prefetch(ZARPAR_HREF),
      onEnterGame: () => {
        markZarpar();
        routerRef.current.push(ZARPAR_HREF);
        fallback = window.setTimeout(() => {
          if (window.location.pathname === '/') window.location.assign(ZARPAR_HREF);
        }, ZARPAR_FALLBACK_MS);
      },
    });
    // «Zarpar» is a link (it works without JavaScript); with the hero, it sails.
    const onClick = (e: MouseEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      // «Entradas» fast-forwards the appearance (the panel opens over the rest).
      if (target?.closest('[data-intro-skip]')) skipIntro();
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
      const pill = target?.closest<HTMLElement>('[data-zarpar]');
      if (!pill) return;
      if (enterIntro(pill.dataset.zarpar === 'header' ? 'header' : 'button')) e.preventDefault();
    };
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('click', onClick);
      window.clearTimeout(fallback);
      detach();
    };
  }, [data]);

  const copy = data?.config.copy;
  return (
    <>
      <div className="hero__scene" ref={hostRef} aria-hidden="true">
        {data && <div className="hero__planet" />}
        <HeroStills />
        {copy && <p className="intro-loading">{copy.loading}</p>}
      </div>
      {/* Velo del mar (T64): la pantalla de carga de /mar, que entra al final de «Zarpar». */}
      <div className="intro-cover" ref={coverRef} aria-hidden="true">
        <div className="intro-cover__boia" />
        <p className="intro-cover__label">{coverLabel}</p>
      </div>
    </>
  );
}

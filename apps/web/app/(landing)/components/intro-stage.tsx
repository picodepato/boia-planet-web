'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { IntroData } from '../../../lib/intro/load';
import { attachIntro, enterIntro, skipIntro } from '../../../lib/intro/run';
import { ZARPAR_HREF, markZarpar } from '../../../lib/intro/zarpar';

/**
 * Si la navegación de la app a /mar no llega en este tiempo tras «Zarpar»,
 * carga completa (con el velo puesto, nada se ve a medias).
 */
const ZARPAR_FALLBACK_MS = 8000;

/**
 * Escena del hero y entrada 3D con el planeta de `/mar` (T57, T64; D-19,
 * D-21, D-24; REQ-ENT-001…020). Lo que pinta el servidor funciona solo: el
 * cielo y un planeta ligero en CSS (REQ-ENT-038), y los textos de la
 * entrada. Al hidratar, la entrada (`lib/intro/run.ts`) carga bajo demanda la
 * escena three.js y la pone encima. En cada carga completa de `/` (D-21):
 * carga (sólo si hace falta) → el planeta aparece y gira → «BOIA» y
 * «Zarpar» → al pulsar, el planeta se vuelve hacia el puerto de salida, la
 * cámara se zambulle en él, el velo del mar cubre la vista y se entra en
 * `/mar` con la bienvenida de la boia abierta (T64), sin pasar por la
 * landing. «Saltar animación» y «Solo quiero ver las entradas» llevan a la
 * landing. El script de arranque ya ocultó la landing antes del primer
 * pintado (ver `bootScript`). La entrada vive lo que la carga de `/`, no lo
 * que este componente: un remontaje del hero la recoge donde iba.
 */
export function IntroStage({
  data,
  skipLabel,
  coverLabel,
}: {
  data: IntroData | null;
  skipLabel: string;
  /** El texto de la pantalla de carga de /mar, que el velo ya enseña (T64). */
  coverLabel: string;
}) {
  const router = useRouter();
  // El router de la app es estable, pero la entrada no se vuelve a enganchar por él.
  const routerRef = useRef(router);
  routerRef.current = router;
  const hostRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLParagraphElement>(null);
  const title3dRef = useRef<HTMLCanvasElement>(null);
  const enterRef = useRef<HTMLButtonElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  const [overlay, setOverlay] = useState(true);

  useEffect(() => {
    if (!data) {
      window.__boiaEntry?.reveal('none');
      setOverlay(false);
      return;
    }
    let fallback = 0;
    const detach = attachIntro(data, {
      host: hostRef,
      title: titleRef,
      title3d: title3dRef,
      enter: enterRef,
      cover: coverRef,
      onLanded: () => setOverlay(false),
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
    return () => {
      window.clearTimeout(fallback);
      detach();
    };
  }, [data]);

  const copy = data?.config.copy;
  return (
    <>
      <div className="hero__scene" ref={hostRef} aria-hidden="true">
        {data && (
          <div className="hero__still">
            <div className="hero__planet" />
          </div>
        )}
      </div>
      {copy && overlay && (
        <div className="intro-overlay">
          <div className="intro-loading" aria-hidden="true">
            <BoiaDrawing />
            <p className="intro-loading__label">{copy.loading}</p>
          </div>
          <p className="intro-overlay__title" ref={titleRef}>
            {copy.title}
            {data?.title && (
              <canvas className="intro-title3d" ref={title3dRef} aria-hidden="true" />
            )}
          </p>
          <button
            type="button"
            className="intro-overlay__enter"
            data-intro-enter=""
            ref={enterRef}
            onClick={enterIntro}
          >
            {copy.enter}
          </button>
          <div className="intro-overlay__links">
            {/* Tickets sin pasar por el botón ni por la animación (REQ-ENT-002). */}
            <a
              className="intro-overlay__tickets"
              href="#tickets"
              data-intro-skip=""
              data-tickets-open="hero"
              onClick={skipIntro}
            >
              {copy.ticketsOnly}
            </a>
            <button
              type="button"
              className="intro-overlay__skip"
              data-intro-skip=""
              onClick={skipIntro}
            >
              {skipLabel}
            </button>
          </div>
          {/* Velo del mar (T64): la pantalla de carga de /mar, que entra al final de «Zarpar». */}
          <div className="intro-cover" ref={coverRef} aria-hidden="true">
            <div className="intro-cover__boia" />
            <p className="intro-cover__label">{coverLabel}</p>
          </div>
        </div>
      )}
    </>
  );
}

/** Acto 0: una boia dibujada (muestra, hasta que haya arte o logo de BOIA). */
function BoiaDrawing() {
  return (
    <svg
      className="intro-loading__boia"
      viewBox="0 0 64 80"
      width="64"
      height="80"
      aria-hidden="true"
    >
      <circle cx="32" cy="10" r="4" fill="#ffd166" />
      <rect x="30.5" y="13" width="3" height="12" fill="#c9d4e6" />
      <path d="M16 58 L22 26 H42 L48 58 Z" fill="#f26a1b" />
      <path d="M19.2 42 H44.8 L46.4 50 H17.6 Z" fill="#ffffff" />
      <ellipse cx="32" cy="60" rx="20" ry="5" fill="#b9a6ff" />
      <path
        d="M4 70 Q12 64 20 70 T36 70 T52 70 T68 70"
        fill="none"
        stroke="#1b4a73"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

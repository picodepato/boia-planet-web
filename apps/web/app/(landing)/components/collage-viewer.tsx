'use client';

import type { Photo } from '@boia/contracts';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../../../lib/i18n/web';
import type { Box } from '../../../lib/landing/collage-layout';
import { useMediaUrl } from '../../../lib/photo-image';
import { type Phase, Still, prefersReducedMotion } from './media-collage';
import './collage-viewer.css';

/**
 * El visor del collage (plan 019 T216; aparte desde plan 020 T234 para no
 * cargarlo en la ruta crítica de la landing): la pieza abierta crece desde
 * su sitio hasta el centro sobre un fondo oscuro (FLIP con la Web Animations
 * API) y, al cerrar, vuelve. Con «reducir movimiento», sin animación.
 */

/** Duraciones (ms) de abrir y cerrar; 0 con «reducir movimiento». */
const OPEN_MS = 460;
const CLOSE_MS = 420;
const EASE_OUT = 'cubic-bezier(0.2, 0.9, 0.25, 1)';
const EASE_IN_OUT = 'cubic-bezier(0.6, 0, 0.3, 1)';

/** El tamaño de la pieza abierta: cabe en la pantalla con margen, sin deformarse. */
function fitted(photo: Pick<Photo, 'width' | 'height'>): Box {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxW = Math.max(120, vw - 32);
  const maxH = Math.max(120, vh - 112);
  const scale = Math.min(maxW / photo.width, maxH / photo.height);
  const width = Math.round(photo.width * scale);
  const height = Math.round(photo.height * scale);
  return { left: Math.round((vw - width) / 2), top: Math.round((vh - height) / 2), width, height };
}

/**
 * La transformación que lleva la pieza abierta (en `to`) a donde está en el
 * collage: centro con centro, escala por el tamaño sin girar (`offsetWidth`,
 * por la escala de la pieza) y el giro de la pieza.
 */
function fromPiece(el: HTMLElement, to: Box, rotate: number, scale: number): string {
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2 - (to.left + to.width / 2);
  const cy = r.top + r.height / 2 - (to.top + to.height / 2);
  const sx = ((el.offsetWidth || r.width) * scale) / to.width;
  const sy = ((el.offsetHeight || r.height) * scale) / to.height;
  return `translate(${cx}px, ${cy}px) rotate(${rotate}deg) scale(${sx}, ${sy})`;
}

/** La pieza abierta, sobre el fondo oscuro, con sus animaciones de abrir y cerrar. */
export default function CollageViewer({
  photo,
  phase,
  rotate,
  scale,
  piece,
  onOpened,
  onClose,
  onClosed,
}: {
  photo: Photo;
  phase: Phase;
  rotate: number;
  scale: number;
  piece: () => HTMLElement | null;
  onOpened: () => void;
  onClose: () => void;
  onClosed: () => void;
}) {
  const figure = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const src = useMediaUrl(photo.src);
  const poster = useMediaUrl(photo.kind === 'video' ? photo.poster : undefined);

  // Dónde acaba la pieza abierta (y si cambia la pantalla, se recoloca).
  useLayoutEffect(() => {
    const place = () => setBox(fitted(photo));
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [photo]);

  // La página no se desplaza debajo; Esc cierra.
  useEffect(() => {
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      root.style.overflow = before;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Abrir: de la pieza del collage al centro, y el fondo se oscurece.
  useLayoutEffect(() => {
    if (phase !== 'opening' || !box) return;
    const el = figure.current;
    const from = piece();
    const ms = prefersReducedMotion() ? 0 : OPEN_MS;
    closeButton.current?.focus({ preventScroll: true });
    if (!el || !from || ms === 0 || typeof el.animate !== 'function') {
      onOpened();
      return;
    }
    backdrop.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: ms * 0.7,
      easing: 'linear',
      fill: 'both',
    });
    const a = el.animate([{ transform: fromPiece(from, box, rotate, scale) }, { transform: 'none' }], {
      duration: ms,
      easing: EASE_OUT,
      fill: 'both',
    });
    a.onfinish = onOpened;
    return () => {
      a.onfinish = null;
    };
    // Sólo al empezar a abrir (box cambia al girar la pantalla, y no hay que repetirlo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, box === null]);

  // Cerrar: vuelve a su sitio y el fondo se aclara.
  useLayoutEffect(() => {
    if (phase !== 'closing' || !box) return;
    const el = figure.current;
    const to = piece();
    const ms = prefersReducedMotion() ? 0 : CLOSE_MS;
    if (!el || !to || ms === 0 || typeof el.animate !== 'function') {
      onClosed();
      return;
    }
    el.getAnimations().forEach((x) => x.cancel());
    backdrop.current?.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: ms,
      easing: 'linear',
      fill: 'both',
    });
    const a = el.animate([{ transform: 'none' }, { transform: fromPiece(to, box, rotate, scale) }], {
      duration: ms,
      easing: EASE_IN_OUT,
      fill: 'both',
    });
    a.onfinish = onClosed;
    return () => {
      a.onfinish = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="collage-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={t('gallery.viewer', { alt: photo.alt })}
      data-testid="collage-visor"
      data-fase={phase}
      data-pieza={photo.id}
    >
      <div ref={backdrop} className="collage-viewer__backdrop" onClick={onClose} />
      {box ? (
        <div
          ref={figure}
          className="collage-viewer__figure"
          style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
        >
          {photo.kind === 'video' && src ? (
            <video
              className="collage-viewer__media"
              src={src}
              poster={poster ?? undefined}
              muted
              loop
              autoPlay={!prefersReducedMotion()}
              controls={prefersReducedMotion()}
              playsInline
              aria-label={photo.alt}
              data-testid="collage-visor-video"
            />
          ) : (
            <Still photo={photo} index={0} className="collage-viewer__media" eager />
          )}
        </div>
      ) : null}
      <button
        ref={closeButton}
        type="button"
        className="collage-viewer__close"
        aria-label={t('gallery.close')}
        data-testid="collage-cerrar"
        onClick={onClose}
      >
        <span aria-hidden="true" />
      </button>
    </div>,
    document.body,
  );
}

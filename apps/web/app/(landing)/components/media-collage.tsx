'use client';

import type { Photo } from '@boia/contracts';
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { t } from '../../../lib/i18n/web';
import {
  type Box,
  type CollageCell,
  type Nudge,
  collageLayout,
  collageRows,
  nudgeAfterClose,
} from '../../../lib/landing/collage-layout';
import { useMediaUrl } from '../../../lib/photo-image';
import './collage.css';

/**
 * El collage de la Galería (plan 019 T216, decisión 8): fotos y clips cortos
 * sin sonido, algo superpuestos, sin textos. Reutilizable: recibe una lista
 * de piezas (las de la Galería, o las fotos de un evento, T215).
 *
 * - El servidor lo pinta ya colocado (`collage-layout.ts`): sin JavaScript
 *   se ve igual, sólo que no se abre.
 * - Abrir una pieza: crece desde su sitio hasta el centro sobre un fondo
 *   oscuro (FLIP con la Web Animations API).
 * - Cerrar (botón, fondo o Esc): vuelve a su sitio, baja al fondo del montón
 *   y las que la tocaban se apartan un poco, así se ven otras fotos.
 * - Un clip enseña su póster y sólo se reproduce (mudo, en bucle) mientras
 *   está en pantalla; con «reducir movimiento», nunca solo (REQ-COM-032).
 */

/** Duraciones (ms) de abrir y cerrar; 0 con «reducir movimiento». */
const OPEN_MS = 460;
const CLOSE_MS = 420;
const EASE_OUT = 'cubic-bezier(0.2, 0.9, 0.25, 1)';
const EASE_IN_OUT = 'cubic-bezier(0.6, 0, 0.3, 1)';

type Phase = 'opening' | 'open' | 'closing';

interface Opened {
  id: string;
  phase: Phase;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

const area = (c: CollageCell) => `${c.row} / ${c.col} / span ${c.rowSpan} / span ${c.colSpan}`;

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
 * collage: centro con centro, escala por el tamaño sin girar (`offsetWidth`)
 * y el giro de la pieza.
 */
function fromPiece(el: HTMLElement, to: Box, rotate: number): string {
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2 - (to.left + to.width / 2);
  const cy = r.top + r.height / 2 - (to.top + to.height / 2);
  const sx = (el.offsetWidth || r.width) / to.width;
  const sy = (el.offsetHeight || r.height) / to.height;
  return `translate(${cx}px, ${cy}px) rotate(${rotate}deg) scale(${sx}, ${sy})`;
}

export function MediaCollage({
  items,
  label,
  testId = 'collage',
}: {
  items: readonly Photo[];
  /** Para lectores de pantalla (el collage no lleva textos). */
  label?: string;
  testId?: string;
}) {
  const layout = useMemo(
    () => collageLayout(items.map((p) => ({ id: p.id, width: p.width, height: p.height }))),
    [items],
  );
  const baseZ = useMemo(() => new Map(layout.map((p) => [p.id, p.z])), [layout]);
  const pieces = useRef(new Map<string, HTMLElement>());
  const [nudges, setNudges] = useState<Map<string, Nudge>>(() => new Map());
  const [opened, setOpened] = useState<Opened | null>(null);
  const [nudgeCount, setNudgeCount] = useState(0);
  const refocus = useRef<string | null>(null);

  const close = useCallback(() => {
    setOpened((o) => (o && o.phase !== 'closing' ? { ...o, phase: 'closing' } : o));
  }, []);

  /** Al acabar de cerrar: la pieza vuelve, baja al fondo y empuja a las vecinas. */
  const closed = useCallback(
    (id: string) => {
      const boxes = new Map<string, Box>();
      for (const [pid, el] of pieces.current) {
        const r = el.getBoundingClientRect();
        boxes.set(pid, { left: r.left, top: r.top, width: r.width, height: r.height });
      }
      setNudges((n) => nudgeAfterClose(id, boxes, n, baseZ));
      setNudgeCount((c) => c + 1);
      refocus.current = id;
      setOpened(null);
    },
    [baseZ],
  );

  // El foco vuelve a la pieza cuando ya se ve (abierta estaba oculta).
  useEffect(() => {
    if (opened || !refocus.current) return;
    pieces.current
      .get(refocus.current)
      ?.querySelector<HTMLButtonElement>('button')
      ?.focus({ preventScroll: true });
    refocus.current = null;
  }, [opened]);

  const rows = {
    narrow: collageRows(layout.map((p) => p.narrow)),
    wide: collageRows(layout.map((p) => p.wide)),
  };
  const openedPhoto = opened ? items.find((p) => p.id === opened.id) : undefined;
  const openedPiece = opened ? layout.find((p) => p.id === opened.id) : undefined;

  return (
    <div
      className="collage"
      data-testid={testId}
      data-empujes={nudgeCount}
      style={{ '--rows-n': rows.narrow, '--rows-w': rows.wide } as CSSProperties}
    >
      <ul className="collage__grid" aria-label={label ?? t('gallery.label')}>
        {layout.map((piece, i) => {
          const photo = items[i]!;
          const nudge = nudges.get(piece.id);
          const isOpen = opened?.id === piece.id;
          return (
            <li
              key={piece.id}
              ref={(el) => {
                if (el) pieces.current.set(piece.id, el);
                else pieces.current.delete(piece.id);
              }}
              className="collage__piece"
              data-pieza={piece.id}
              data-kind={photo.kind ?? 'image'}
              data-album={photo.albumId}
              data-abierta={isOpen ? '' : undefined}
              style={
                {
                  '--area-n': area(piece.narrow),
                  '--area-w': area(piece.wide),
                  '--dx': `${piece.dx}%`,
                  '--dy': `${piece.dy}%`,
                  '--rot': `${piece.rotate}deg`,
                  '--nx': `${nudge?.x ?? 0}px`,
                  '--ny': `${nudge?.y ?? 0}px`,
                  zIndex: nudge?.z ?? piece.z,
                } as CSSProperties
              }
            >
              <button
                type="button"
                className="collage__hit"
                aria-label={t('gallery.open', { alt: photo.alt })}
                aria-haspopup="dialog"
                onClick={() => {
                  if (!opened) setOpened({ id: piece.id, phase: 'opening' });
                }}
              >
                <PieceMedia photo={photo} index={i} active={!opened} />
              </button>
            </li>
          );
        })}
      </ul>
      {opened && openedPhoto && openedPiece ? (
        <Viewer
          photo={openedPhoto}
          phase={opened.phase}
          rotate={openedPiece.rotate}
          piece={() => pieces.current.get(opened.id)?.querySelector<HTMLElement>('button') ?? null}
          onOpened={() => setOpened((o) => (o?.phase === 'opening' ? { ...o, phase: 'open' } : o))}
          onClose={close}
          onClosed={() => closed(opened.id)}
        />
      ) : null}
    </div>
  );
}

/** Lo que se ve de una pieza en el collage: la foto, el clip (o su póster) o el marcador. */
function PieceMedia({ photo, index, active }: { photo: Photo; index: number; active: boolean }) {
  if (photo.kind === 'video' && photo.src) {
    return <ClipPiece photo={photo} active={active} />;
  }
  return <Still photo={photo} index={index} className="collage__media" />;
}

/** Una imagen fija (foto o póster), o el marcador de muestra (sin texto) si no hay. */
function Still({
  photo,
  index,
  className,
  eager = false,
}: {
  photo: Photo;
  index: number;
  className: string;
  eager?: boolean;
}) {
  const url = useMediaUrl(photo.kind === 'video' ? photo.poster : photo.src);
  if (!url) {
    return (
      <span
        className={`${className} collage__blank collage__blank--${index % 4}`}
        role="img"
        aria-label={photo.alt}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- fotos del Admin (bucket, este navegador o art/)
    <img
      className={className}
      src={url}
      alt={photo.alt}
      width={photo.width}
      height={photo.height}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
    />
  );
}

/**
 * Un clip en el collage: su póster siempre (lo pinta el servidor); el vídeo,
 * sólo mientras al menos media pieza está en pantalla y nadie ha pedido
 * reducir el movimiento. Mudo, en bucle, sin controles.
 */
function ClipPiece({ photo, active }: { photo: Photo; active: boolean }) {
  const box = useRef<HTMLSpanElement>(null);
  const [inView, setInView] = useState(false);
  const src = useMediaUrl(photo.src);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) return;
    const io = new IntersectionObserver(
      (entries) => setInView(entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.5)),
      { threshold: [0, 0.5, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <span ref={box} className="collage__clip">
      <Still photo={photo} index={0} className="collage__media" />
      {inView && active && src ? (
        <video
          className="collage__media collage__video"
          src={src}
          muted
          loop
          autoPlay
          playsInline
          preload="auto"
          aria-hidden="true"
          tabIndex={-1}
          disablePictureInPicture
        />
      ) : null}
    </span>
  );
}

/** La pieza abierta, sobre el fondo oscuro, con sus animaciones de abrir y cerrar. */
function Viewer({
  photo,
  phase,
  rotate,
  piece,
  onOpened,
  onClose,
  onClosed,
}: {
  photo: Photo;
  phase: Phase;
  rotate: number;
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
    const a = el.animate([{ transform: fromPiece(from, box, rotate) }, { transform: 'none' }], {
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
    const a = el.animate([{ transform: 'none' }, { transform: fromPiece(to, box, rotate) }], {
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

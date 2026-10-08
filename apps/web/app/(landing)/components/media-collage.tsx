'use client';

import type { Photo } from '@boia/contracts';
import {
  type CSSProperties,
  Suspense,
  lazy,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { t } from '../../../lib/i18n/web';
import {
  type Box,
  type CollageCell,
  type Nudge,
  collageLayout,
  collageRows,
  dragOffset,
  isDrag,
  nudgeAfterClose,
} from '../../../lib/landing/collage-layout';
import { useMediaUrl } from '../../../lib/photo-image';
import './collage.css';

/**
 * El visor (la pieza abierta y sus animaciones) va aparte: no está en la ruta
 * crítica de la landing (D-26, plan 020 T234). Se pide en cuanto el
 * navegador está libre, o al tocar una pieza, así que al abrir ya está.
 */
const loadViewer = () => import('./collage-viewer');
const Viewer = lazy(loadViewer);

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
 * - Arrastrar una pieza (ratón, o dedo de lado: en vertical la página sigue
 *   desplazándose) la aparta y deja ver la de debajo; no sale del collage y
 *   queda encima. Un toque sin arrastre la abre (plan 020 T234).
 * - Un clip enseña su póster y sólo se reproduce (mudo, en bucle) mientras
 *   está en pantalla; con «reducir movimiento», nunca solo (REQ-COM-032).
 */

/** El «click» que sigue a soltar un arrastre con el ratón llega en el mismo instante. */
const CLICK_AFTER_DRAG_MS = 120;

export type Phase = 'opening' | 'open' | 'closing';

interface Opened {
  id: string;
  phase: Phase;
}

/** Un arrastre en curso: desde dónde, con qué empujón empezó y entre qué límites. */
interface Drag {
  id: string;
  pointer: number;
  x: number;
  y: number;
  start: { x: number; y: number };
  piece: Box;
  bounds: Box;
  moved: boolean;
  last?: { x: number; y: number };
}

const boxOf = (el: Element): Box => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
};

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

const area = (c: CollageCell) => `${c.row} / ${c.col} / span ${c.rowSpan} / span ${c.colSpan}`;

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
  const grid = useRef<HTMLUListElement>(null);
  const drag = useRef<Drag | null>(null);
  /**
   * La pieza que se acaba de soltar tras arrastrarla, y cuándo: el «click»
   * que el ratón manda justo después no la abre (el dedo no lo manda).
   */
  const swallow = useRef<{ id: string; at: number } | null>(null);
  const topZ = useRef(0);
  const nudgesRef = useRef(nudges);
  nudgesRef.current = nudges;

  useEffect(() => {
    const idle = (window as { requestIdleCallback?: (cb: () => void) => number })
      .requestIdleCallback;
    if (idle) idle(() => void loadViewer());
    else window.setTimeout(() => void loadViewer(), 1500);
  }, []);

  /** La siguiente capa por encima de todas (la pieza arrastrada queda arriba). */
  const nextZ = () => {
    let max = topZ.current;
    for (const z of baseZ.values()) max = Math.max(max, z);
    for (const n of nudgesRef.current.values()) if (n.z !== undefined) max = Math.max(max, n.z);
    topZ.current = max + 1;
    return topZ.current;
  };

  const onPointerDown = (id: string, e: ReactPointerEvent<HTMLElement>) => {
    void loadViewer();
    if (opened || drag.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const el = pieces.current.get(id);
    if (!el || !grid.current) return;
    const was = nudgesRef.current.get(id);
    drag.current = {
      id,
      pointer: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      start: { x: was?.x ?? 0, y: was?.y ?? 0 },
      piece: boxOf(el),
      bounds: boxOf(grid.current),
      moved: false,
    };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    const delta = { x: e.clientX - d.x, y: e.clientY - d.y };
    const el = pieces.current.get(d.id);
    if (!el) return;
    if (!d.moved) {
      if (!isDrag(delta.x, delta.y)) return;
      d.moved = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      el.dataset.arrastrando = '';
      el.style.zIndex = String(nextZ());
    }
    e.preventDefault();
    // Directo al estilo mientras se mueve (sin renderizar); al soltar, al estado.
    d.last = dragOffset(d.start, delta, d.piece, d.bounds);
    el.style.setProperty('--nx', `${d.last.x}px`);
    el.style.setProperty('--ny', `${d.last.y}px`);
  };

  const onPointerEnd = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    drag.current = null;
    if (!d.moved) return;
    const el = pieces.current.get(d.id);
    if (el) delete el.dataset.arrastrando;
    const at = d.last ?? d.start;
    const z = topZ.current;
    setNudges((n) => new Map(n).set(d.id, { x: at.x, y: at.y, z, dragged: true }));
    swallow.current = { id: d.id, at: e.timeStamp };
  };

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
      <ul ref={grid} className="collage__grid" aria-label={label ?? t('gallery.label')}>
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
              data-talla={piece.size}
              data-movida={nudge?.dragged ? '' : undefined}
              data-album={photo.albumId}
              data-abierta={isOpen ? '' : undefined}
              style={
                {
                  '--area-n': area(piece.narrow),
                  '--area-w': area(piece.wide),
                  '--dx': `${piece.dx}%`,
                  '--dy': `${piece.dy}%`,
                  '--rot': `${piece.rotate}deg`,
                  '--scale': piece.scale,
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
                onPointerDown={(e) => onPointerDown(piece.id, e)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerEnd}
                onPointerCancel={onPointerEnd}
                onClick={(e) => {
                  const after = swallow.current;
                  swallow.current = null;
                  if (after?.id === piece.id && e.timeStamp - after.at < CLICK_AFTER_DRAG_MS) return;
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
        <Suspense fallback={null}>
            <Viewer
            photo={openedPhoto}
            phase={opened.phase}
            rotate={openedPiece.rotate}
            scale={openedPiece.scale}
            piece={() => pieces.current.get(opened.id)?.querySelector<HTMLElement>('button') ?? null}
            onOpened={() => setOpened((o) => (o?.phase === 'opening' ? { ...o, phase: 'open' } : o))}
            onClose={close}
            onClosed={() => closed(opened.id)}
          />
        </Suspense>
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
export function Still({
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

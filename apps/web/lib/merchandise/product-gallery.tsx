'use client';

import type { MerchandiseProduct, ProductImageKind } from '@boia/contracts';
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { t, type MessageKey } from '../landing/texts';
import { PRODUCT_ROTATION_MS, nextImageIndex, prevImageIndex, swipeStep } from './rotation';

const KIND_KEY: Record<ProductImageKind, MessageKey> = {
  alone: 'store.image.alone',
  angle: 'store.image.angle',
  model: 'store.image.model',
};

/** A drag in progress: where it started and how far it has gone (px). */
interface Drag {
  id: number;
  x0: number;
  y0: number;
  t0: number;
  dx: number;
  /** Decided once the finger moves: sideways (ours) or down the page (the browser's). */
  axis: 'x' | 'y' | null;
}

/**
 * A product's images on a strip (T201, decision 11; plan 020 T227, decision
 * 5): the product alone, other angles, on a model, one at a time, passed by
 * swiping sideways (touch or mouse drag), with the arrows, the arrow keys or
 * the squares. They rotate by themselves while the card is on screen, until
 * someone takes over; never under `prefers-reduced-motion`, nor while the
 * pointer or focus is on the card. Without JavaScript only the first image
 * shows. Every image is `loading="lazy"`: the store sits far below the
 * landing's critical path.
 */
export function ProductGallery({ product }: { product: MerchandiseProduct }) {
  const { images } = product;
  const count = images.length;
  const [index, setIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [held, setHeld] = useState(false);
  const [visible, setVisible] = useState(false);
  const [still, setStill] = useState(true);
  /** Someone swiped or picked an image: the strip stops rotating by itself. */
  const [taken, setTaken] = useState(false);
  const [dragX, setDragX] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  useEffect(() => {
    setMounted(true);
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setStill(media.matches);
    sync();
    media.addEventListener('change', sync);
    const el = root.current;
    let io: IntersectionObserver | undefined;
    if (el && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(([entry]) => setVisible(!!entry?.isIntersecting));
      io.observe(el);
    } else setVisible(true);
    return () => {
      media.removeEventListener('change', sync);
      io?.disconnect();
    };
  }, []);

  const rotating = mounted && count > 1 && !still && !held && !taken && visible;
  useEffect(() => {
    if (!rotating) return;
    const id = window.setInterval(() => {
      if (!document.hidden) setIndex((i) => nextImageIndex(i, count));
    }, PRODUCT_ROTATION_MS);
    return () => window.clearInterval(id);
  }, [rotating, count]);

  const go = (i: number) => {
    setTaken(true);
    setIndex(i);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (count < 2 || (e.pointerType === 'mouse' && e.button !== 0)) return;
    // No native image drag with the mouse: the strip moves instead.
    if (e.pointerType === 'mouse') e.preventDefault();
    drag.current = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      t0: e.timeStamp,
      dx: 0,
      axis: null,
    };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.axis) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      d.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (d.axis === 'x') e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    if (d.axis !== 'x') return;
    d.dx = dx;
    setDragX(dx);
  };

  const endDrag = (e: PointerEvent<HTMLDivElement>, cancelled = false) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    setDragX(null);
    if (cancelled || d.axis !== 'x') return;
    const width = frame.current?.clientWidth ?? 0;
    const step = swipeStep(d.dx, width, e.timeStamp - d.t0);
    if (step > 0) go(nextImageIndex(index, count));
    else if (step < 0) go(prevImageIndex(index, count));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (count < 2) return;
    if (e.key === 'ArrowRight') go(nextImageIndex(index, count));
    else if (e.key === 'ArrowLeft') go(prevImageIndex(index, count));
    else return;
    e.preventDefault();
  };

  const offset = dragX === null ? `${-index * 100}%` : `calc(${-index * 100}% + ${dragX}px)`;

  return (
    <div
      ref={root}
      className="merchandise__gallery"
      role="group"
      aria-roledescription="carrusel"
      aria-label={t('store.gallery.label', { name: product.name })}
      data-testid={`merchandise-gallery-${product.id}`}
      data-index={index}
      data-rotating={rotating ? 'si' : 'no'}
      data-dragging={dragX === null ? undefined : 'si'}
      tabIndex={mounted && count > 1 ? 0 : undefined}
      onKeyDown={onKeyDown}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <div
        ref={frame}
        className="merchandise__frame"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endDrag(e)}
        onPointerCancel={(e) => endDrag(e, true)}
      >
        <div
          className="merchandise__track"
          data-testid={`merchandise-track-${product.id}`}
          style={index === 0 && dragX === null ? undefined : { transform: `translateX(${offset})` }}
        >
          {images.map((image, i) => (
            // Local compressed samples, deliberately deferred below the landing's critical content.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={image.src}
              src={image.src}
              alt={image.alt}
              width={800}
              height={800}
              loading="lazy"
              decoding="async"
              draggable={false}
              data-kind={image.kind}
              className={i === index ? 'is-active' : undefined}
              aria-hidden={i === index ? undefined : true}
            />
          ))}
        </div>
      </div>
      {mounted && count > 1 ? (
        <>
          <button
            type="button"
            className="merchandise__arrow merchandise__arrow--prev"
            aria-label={t('store.gallery.prev', { name: product.name })}
            data-testid={`merchandise-prev-${product.id}`}
            onClick={() => go(prevImageIndex(index, count))}
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            type="button"
            className="merchandise__arrow merchandise__arrow--next"
            aria-label={t('store.gallery.next', { name: product.name })}
            data-testid={`merchandise-next-${product.id}`}
            onClick={() => go(nextImageIndex(index, count))}
          >
            <span aria-hidden="true">›</span>
          </button>
          <div className="merchandise__dots">
            {images.map((image, i) => (
              <button
                key={image.src}
                type="button"
                className="merchandise__dot"
                aria-label={t('store.gallery.show', {
                  name: product.name,
                  kind: t(KIND_KEY[image.kind]),
                })}
                aria-pressed={i === index}
                data-testid={`merchandise-dot-${product.id}-${i}`}
                onClick={() => go(i)}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

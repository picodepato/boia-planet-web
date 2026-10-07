'use client';

import type { MerchandiseProduct, ProductImageKind } from '@boia/contracts';
import { useEffect, useRef, useState } from 'react';
import { t, type MessageKey } from '../landing/texts';
import { nextImageIndex, PRODUCT_ROTATION_MS } from './rotation';

const KIND_KEY: Record<ProductImageKind, MessageKey> = {
  alone: 'store.image.alone',
  angle: 'store.image.angle',
  model: 'store.image.model',
};

/**
 * A product's images, one at a time (T201, decision 11): the product alone,
 * other angles, on a model. They rotate by themselves while the card is on
 * screen; never under `prefers-reduced-motion`, nor while the pointer or focus
 * is on the card. The dots let anyone pick an image. Without JavaScript only
 * the first image shows. Every image is `loading="lazy"`: the store sits far
 * below the landing's critical path.
 */
export function ProductGallery({ product }: { product: MerchandiseProduct }) {
  const { images } = product;
  const [index, setIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [held, setHeld] = useState(false);
  const [visible, setVisible] = useState(false);
  const [still, setStill] = useState(true);
  const root = useRef<HTMLDivElement>(null);

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

  const rotating = mounted && images.length > 1 && !still && !held && visible;
  useEffect(() => {
    if (!rotating) return;
    const id = window.setInterval(() => {
      if (!document.hidden) setIndex((i) => nextImageIndex(i, images.length));
    }, PRODUCT_ROTATION_MS);
    return () => window.clearInterval(id);
  }, [rotating, images.length]);

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
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <div className="merchandise__frame">
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
            data-kind={image.kind}
            className={i === index ? 'is-active' : undefined}
            aria-hidden={i === index ? undefined : true}
          />
        ))}
      </div>
      {mounted && images.length > 1 ? (
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
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

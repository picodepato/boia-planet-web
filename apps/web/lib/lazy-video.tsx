'use client';

import { useEffect, useRef, useState } from 'react';
import { t, type WebKey } from './i18n/web';

export interface LazyVideoProps {
  src: string;
  poster: string;
  width: number;
  height: number;
  labelKey: WebKey;
  className?: string;
}

/**
 * REQ-COM-032: sólo el poster existe en SSR y fuera de la vista. El vídeo
 * se monta al entrar en pantalla, sin precarga ni reproducción automática.
 * Preparado para contenido de vídeo; las galerías actuales sólo admiten fotos.
 */
export function LazyVideo({ src, poster, width, height, labelKey, className }: LazyVideoProps) {
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (visible || !container.current || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px', threshold: 0 },
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [visible]);

  const label = t(labelKey);
  return (
    <div
      ref={container}
      className={className}
      data-lazy-video=""
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      {visible ? (
        <video
          src={src}
          poster={poster}
          width={width}
          height={height}
          aria-label={label}
          controls
          playsInline
          preload="none"
          style={{ display: 'block', width: '100%', height: 'auto' }}
        />
      ) : (
        <button
          type="button"
          aria-label={t('media.video.load', { nombre: label })}
          onClick={() => setVisible(true)}
          style={{ display: 'block', width: '100%', padding: 0, border: 0, position: 'relative' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- poster del contenido */}
          <img
            src={poster}
            alt={label}
            width={width}
            height={height}
            loading="lazy"
            style={{ display: 'block', width: '100%', height: 'auto' }}
          />
          <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
            {t('media.video.load', { nombre: label })}
          </span>
        </button>
      )}
    </div>
  );
}

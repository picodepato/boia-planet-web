'use client';

import type { Photo } from '@boia/contracts';
import { useEffect, useState } from 'react';
import { displayablePhotoUrl } from './admin/photo-store';

/**
 * Una foto con imagen (T189): una URL se pinta tal cual; un archivo que el
 * Admin dejó en este navegador (`local-photo:`) se pinta en cuanto se lee de
 * IndexedDB. Mientras, o si ya no está, un hueco con el texto alternativo.
 */
export function PhotoImage({
  photo,
  className,
}: {
  photo: Pick<Photo, 'src' | 'alt' | 'width' | 'height'>;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const src = photo.src;
  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (src) void displayablePhotoUrl(src).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [src]);
  if (!url) {
    return (
      <span
        className={className}
        role="img"
        aria-label={photo.alt}
        data-foto-cargando=""
        style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- fotos del Admin (bucket o este navegador)
    <img
      className={className}
      src={url}
      alt={photo.alt}
      width={photo.width}
      height={photo.height}
      loading="lazy"
    />
  );
}

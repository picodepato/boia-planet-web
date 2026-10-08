'use client';

import { type Photo, isLocalPhotoRef } from '@boia/contracts';
import { useEffect, useState } from 'react';
import { displayablePhotoUrl } from './admin/photo-store';

/**
 * La URL que se puede poner en `src` de una referencia de la galería: la
 * misma si no es local (también en el servidor); un archivo que el Admin
 * dejó en este navegador (`local-photo:`, T189), en cuanto se lee de
 * IndexedDB; null mientras, o si ya no está.
 */
export function useMediaUrl(ref: string | undefined): string | null {
  const direct = ref && !isLocalPhotoRef(ref) ? ref : null;
  const [local, setLocal] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setLocal(null);
    if (ref && isLocalPhotoRef(ref))
      void displayablePhotoUrl(ref).then((u) => alive && setLocal(u));
    return () => {
      alive = false;
    };
  }, [ref]);
  return direct ?? local;
}

/** Lo que se pinta como imagen fija: la foto, o el póster si es un clip (T216). */
export function stillOf(photo: Pick<Photo, 'src' | 'poster'> & { kind?: Photo['kind'] }) {
  return photo.kind === 'video' ? photo.poster : photo.src;
}

/**
 * Una foto con imagen (T189): una URL se pinta tal cual; un archivo que el
 * Admin dejó en este navegador (`local-photo:`) se pinta en cuanto se lee de
 * IndexedDB. Mientras, o si ya no está, un hueco con el texto alternativo.
 * De un clip (T216) se pinta su póster.
 */
export function PhotoImage({
  photo,
  className,
}: {
  photo: Pick<Photo, 'src' | 'alt' | 'width' | 'height'> & Partial<Pick<Photo, 'kind' | 'poster'>>;
  className?: string;
}) {
  const url = useMediaUrl(stillOf(photo));
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

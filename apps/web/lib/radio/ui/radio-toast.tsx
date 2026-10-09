'use client';

import type { RadioSong } from '@boia/contracts';
import { useEffect, useState } from 'react';
import type { RadioToast } from '../player';
import { t } from './t';

export const TOAST_MS = 4000;

/** La canción tal cual: «Título — Artista», o sólo el título si no hay artista. */
export function toastSongText(song: Pick<RadioSong, 'title' | 'artist'>): string {
  return song.artist
    ? t('radio.toast.cancion', { titulo: song.title, artista: song.artist })
    : t('radio.toast.solo', { titulo: song.title });
}

/**
 * El aviso de la canción que suena (plan 022 T247; plan 025 T259): abajo, con
 * el reproductor cerrado, a cada cambio de canción; se va solo. Es un botón:
 * al tocarlo abre la radio (lo mismo que su botón; el reproductor quita el
 * aviso al abrirse). `role="status"` en el hueco: los lectores de pantalla lo
 * anuncian sin cortar nada.
 */
export function RadioToastView({
  toast,
  onDone,
  onOpen,
}: {
  toast: RadioToast | null;
  onDone: (key: number) => void;
  onOpen: () => void;
}) {
  // `hidden`: la clave del aviso que ya se quitó por el tiempo.
  const [hidden, setHidden] = useState<number | null>(null);
  useEffect(() => {
    if (!toast) return;
    setHidden(null);
    const id = window.setTimeout(() => {
      setHidden(toast.key);
      onDone(toast.key);
    }, TOAST_MS);
    return () => window.clearTimeout(id);
  }, [toast, onDone]);
  const shown = toast && toast.key !== hidden ? toast : null;
  return (
    <div className="radio-toast-slot" role="status" aria-live="polite">
      {shown ? (
        <RadioToastButton key={shown.key} song={shown.song} onOpen={onOpen} />
      ) : null}
    </div>
  );
}

/**
 * El botón del aviso, sin estado (así se prueba sin navegador). Su nombre
 * accesible dice a dónde lleva: «Abrir la radio: Título — Artista».
 */
export function RadioToastButton({
  song,
  onOpen,
}: {
  song: Pick<RadioSong, 'title' | 'artist'>;
  onOpen: () => void;
}) {
  const text = toastSongText(song);
  const label = t('radio.toast.abrir', { cancion: text });
  return (
    <button
      type="button"
      className="radio-toast"
      aria-label={label}
      title={label}
      data-testid="radio-sonando"
      onClick={onOpen}
    >
      <span className="radio-toast__dot" aria-hidden="true" />
      <span className="radio-toast__text">{text}</span>
    </button>
  );
}

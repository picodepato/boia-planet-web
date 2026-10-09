'use client';

import { useEffect, useState } from 'react';
import type { RadioToast } from '../player';
import { t } from './t';

export const TOAST_MS = 4000;

/**
 * «Sonando: título - artista» (plan 022 T247): abajo, con el reproductor
 * cerrado, a cada cambio de canción; se va solo. `role="status"`: los
 * lectores de pantalla lo anuncian sin cortar nada.
 */
export function RadioToastView({
  toast,
  onDone,
}: {
  toast: RadioToast | null;
  onDone: (key: number) => void;
}) {
  const [shown, setShown] = useState<RadioToast | null>(null);
  useEffect(() => {
    if (!toast) {
      setShown(null);
      return;
    }
    setShown(toast);
    const id = window.setTimeout(() => {
      setShown((s) => (s?.key === toast.key ? null : s));
      onDone(toast.key);
    }, TOAST_MS);
    return () => window.clearTimeout(id);
  }, [toast, onDone]);
  return (
    <div className="radio-toast-slot" role="status" aria-live="polite">
      {shown ? (
        <p className="radio-toast" key={shown.key} data-testid="radio-sonando">
          <span className="radio-toast__dot" aria-hidden="true" />
          {t('radio.sonando', { titulo: shown.song.title, artista: shown.song.artist })}
        </p>
      ) : null}
    </div>
  );
}

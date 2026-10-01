'use client';

import { useSyncExternalStore } from 'react';
import { ACCESS_COPY } from '../../../lib/landing/access';
import { readSound, subscribeSound, toggleSound } from '../../../lib/landing/sound-pref';

/**
 * Interruptor de sonido de la cabecera (REQ-ENT-029). La landing no suena
 * (O10): decide si suenan música y efectos al navegar en el 2D y /mar. Sin
 * JavaScript no se ve (no haría nada).
 */
export function SoundToggle({ className = '' }: { className?: string }) {
  const on = useSyncExternalStore(subscribeSound, readSound, () => true);
  const state = on ? ACCESS_COPY.soundOn : ACCESS_COPY.soundOff;
  return (
    <button
      type="button"
      className={`sound-toggle ${className}`}
      aria-pressed={on}
      title={state}
      data-testid="cabecera-sonido"
      onClick={toggleSound}
    >
      <span aria-hidden="true">{on ? '🔊' : '🔇'}</span>
      <span className="sound-toggle__label">{ACCESS_COPY.sound}</span>
    </button>
  );
}

'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { t as msg } from '../../lib/i18n';
import { DEFAULT_READOUTS, readoutPreferences } from './canon-readout-preferences';
import { DEFAULT_SOUND, soundPreferences } from './canon-sound-preferences';

/**
 * Scoped extension of the shared pause dialog; stays in its scrollable body:
 * the combat readouts (T136) and the game sound, mute and volume (T152).
 */
export function CanonReadoutMenu({ covered }: { covered: boolean }) {
  const [target, setTarget] = useState<Element | null>(null);
  const store = readoutPreferences();
  const prefs = useSyncExternalStore(store.subscribe, store.get, () => DEFAULT_READOUTS);
  const soundStore = soundPreferences();
  const sound = useSyncExternalStore(soundStore.subscribe, soundStore.get, () => DEFAULT_SOUND);
  useEffect(() => {
    if (!covered) {
      setTarget(null);
      return;
    }
    const sync = () => setTarget(document.querySelector('[data-testid="mar-menu-partida"]'));
    sync();
    // Changing section can remove/recreate the menu without changing `covered`.
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [covered]);
  if (!covered || !target) return null;
  const keep = {
    onClick: (e: { stopPropagation(): void }) => e.stopPropagation(),
    onKeyDown: (e: { key: string; stopPropagation(): void }) => {
      if (e.key !== 'Escape') e.stopPropagation();
    },
  };
  return createPortal(
    <>
      <fieldset
        className="mar-canon-readout-options"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key !== 'Escape') e.stopPropagation();
        }}
      >
        <legend>{msg('mar.canon.lecturas')}</legend>
        {(['health', 'damage'] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="switch"
            aria-checked={prefs[key]}
            data-testid={`mar-canon-mostrar-${key}`}
            onClick={() => store.toggle(key)}
          >
            <span>{msg(key === 'health' ? 'mar.canon.mostrarVida' : 'mar.canon.mostrarDano')}</span>
            <span className="mar-canon-readout-switch" aria-hidden="true" />
          </button>
        ))}
      </fieldset>
      <fieldset className="mar-canon-readout-options mar-canon-sound-options" {...keep}>
        <legend>{msg('mar.canon.sonido')}</legend>
        <button
          type="button"
          role="switch"
          aria-checked={!sound.muted}
          data-testid="mar-canon-sonido"
          onClick={() => soundStore.toggleMuted()}
        >
          <span>{msg('mar.canon.sonido.juego')}</span>
          <span className="mar-canon-readout-switch" aria-hidden="true" />
        </button>
        <label className="mar-canon-sound-volume">
          <span aria-hidden="true">{msg('mar.canon.sonido.volumen')}</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(sound.volume * 100)}
            aria-label={msg('mar.canon.sonido.volumen.aria')}
            data-testid="mar-canon-volumen"
            onChange={(e) => soundStore.setVolume(Number(e.target.value) / 100)}
          />
        </label>
        <p className="mar-canon-sound-hint">{msg('mar.canon.sonido.ajustes')}</p>
      </fieldset>
    </>,
    target,
  );
}

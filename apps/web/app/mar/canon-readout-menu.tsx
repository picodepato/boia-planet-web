'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { t as msg } from '../../lib/i18n';
import { DEFAULT_READOUTS, readoutPreferences } from './canon-readout-preferences';
import { DEFAULT_SOUND, soundPreferences } from './canon-sound-preferences';

/**
 * The pause dialog's game block (`mar-menu-partida`) while it is open, or
 * null: the in-game options are portalled into it.
 */
function usePauseMenuTarget(covered: boolean): Element | null {
  const [target, setTarget] = useState<Element | null>(null);
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
  return covered ? target : null;
}

/** Clicks and keys inside the options stay there (Esc still closes the menu). */
const keep = {
  onClick: (e: { stopPropagation(): void }) => e.stopPropagation(),
  onKeyDown: (e: { key: string; stopPropagation(): void }) => {
    if (e.key !== 'Escape') e.stopPropagation();
  },
};

/** The game sound, mute and volume (T152), shared by the Cañón and the castle (T161). */
function SoundOptions() {
  const soundStore = soundPreferences();
  const sound = useSyncExternalStore(soundStore.subscribe, soundStore.get, () => DEFAULT_SOUND);
  return (
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
  );
}

/**
 * Scoped extension of the shared pause dialog; stays in its scrollable body:
 * the combat readouts (T136) and the game sound, mute and volume (T152).
 */
export function CanonReadoutMenu({ covered }: { covered: boolean }) {
  const target = usePauseMenuTarget(covered);
  const store = readoutPreferences();
  const prefs = useSyncExternalStore(store.subscribe, store.get, () => DEFAULT_READOUTS);
  if (!target) return null;
  return createPortal(
    <>
      <fieldset className="mar-canon-readout-options" {...keep}>
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
      <SoundOptions />
    </>,
    target,
  );
}

/** The castle's pause (T161): only the game sound and volume, the same block as the Cañón's. */
export function GameSoundMenu({ covered }: { covered: boolean }) {
  const target = usePauseMenuTarget(covered);
  if (!target) return null;
  return createPortal(<SoundOptions />, target);
}

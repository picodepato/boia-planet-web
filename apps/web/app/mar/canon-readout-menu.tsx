'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { t as msg } from '../../lib/i18n';
import { DEFAULT_READOUTS, readoutPreferences } from './canon-readout-preferences';

/** Scoped extension of the shared pause dialog; stays in its scrollable body. */
export function CanonReadoutMenu({ covered }: { covered: boolean }) {
  const [target, setTarget] = useState<Element | null>(null);
  const store = readoutPreferences();
  const prefs = useSyncExternalStore(store.subscribe, store.get, () => DEFAULT_READOUTS);
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
  return createPortal(
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
    </fieldset>,
    target,
  );
}

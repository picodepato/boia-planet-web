'use client';

import { useEffect, useState, type ComponentType } from 'react';
import { captureInstallPrompt } from '../../../lib/pwa/capture';

/**
 * La app instalable en la web pública (plan 027 T264), fuera de la ruta
 * crítica de la landing (D-26): aquí sólo se recoge el ofrecimiento de
 * instalar de Chrome, que puede llegar pronto. El registro del service worker
 * y el aviso «Instalar app» vienen en su propio trozo (`pwa-prompt.tsx`), que
 * se pide cuando la página ya cargó y está quieta.
 */
captureInstallPrompt();

/** Tras el `load`, esto más: que la entrada de la landing vaya primero. */
const AFTER_LOAD_MS = 2_000;

export function PwaLazy() {
  const [Prompt, setPrompt] = useState<ComponentType | null>(null);
  useEffect(() => {
    let gone = false;
    let timer = 0;
    const go = () => {
      timer = window.setTimeout(() => {
        // Si el trozo no carga, `console.warn` lo deja dicho y la web sigue igual.
        import('./pwa-prompt').then((m) => {
          if (!gone) setPrompt(() => m.PwaPrompt);
        }, console.warn);
      }, AFTER_LOAD_MS);
    };
    if (document.readyState === 'complete') go();
    else window.addEventListener('load', go, { once: true });
    return () => {
      gone = true;
      window.clearTimeout(timer);
      window.removeEventListener('load', go);
    };
  }, []);
  return Prompt ? <Prompt /> : null;
}

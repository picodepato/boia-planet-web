'use client';

import type { Viewport } from '@boia/engine/ui';
import { useEffect, useState } from 'react';

/**
 * Tamaño de la pantalla y zonas seguras del dispositivo, para colocar el HUD
 * con `hudLayout`. Las zonas seguras se leen de un elemento de prueba con
 * `padding: env(safe-area-inset-*)`. null hasta montar (no hay SSR del HUD).
 */
export function useViewport(): Viewport | null {
  const [vp, setVp] = useState<Viewport | null>(null);

  useEffect(() => {
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;inset:0;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top) env(safe-area-inset-right) ' +
      'env(safe-area-inset-bottom) env(safe-area-inset-left);';
    document.body.appendChild(probe);
    const read = () => {
      const cs = getComputedStyle(probe);
      const px = (v: string) => Number.parseFloat(v) || 0;
      setVp({
        width: window.innerWidth,
        height: window.innerHeight,
        insets: {
          top: px(cs.paddingTop),
          right: px(cs.paddingRight),
          bottom: px(cs.paddingBottom),
          left: px(cs.paddingLeft),
        },
      });
    };
    read();
    window.addEventListener('resize', read);
    window.addEventListener('orientationchange', read);
    return () => {
      window.removeEventListener('resize', read);
      window.removeEventListener('orientationchange', read);
      probe.remove();
    };
  }, []);

  return vp;
}

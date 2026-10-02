'use client';

import type { SphereProbe } from '@boia/engine/intro/sphere-probe';
import { useEffect, useRef, useState } from 'react';
import { demoWorld } from '../../lib/mundo/demo-world';

declare global {
  interface Window {
    __sphereProbe?: SphereProbe;
  }
}

/** Ruta de desarrollo de la prueba de la esfera (T13). `?tex=4096` cambia la textura. */
export function SphereProbeClient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState('cargando');

  useEffect(() => {
    let probe: SphereProbe | null = null;
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const tex = Number(new URLSearchParams(location.search).get('tex')) || undefined;
    void (async () => {
      try {
        const { createSphereProbe } = await import('@boia/engine/intro/sphere-probe');
        const p = await createSphereProbe({ canvas, world: demoWorld, texturePx: tex });
        if (cancelled) return p.destroy();
        probe = p;
        window.__sphereProbe = p;
        setStatus(`lista · ${p.renderer} · textura ${p.texturePx.join('×')}`);
      } catch (err) {
        console.error('[boia] la prueba de la esfera no arrancó', err);
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
      probe?.destroy();
      delete window.__sphereProbe;
    };
  }, []);

  return (
    <main style={{ position: 'fixed', inset: 0, background: '#0b1830' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      <p
        data-probe-status={status.split(' ')[0]}
        style={{
          position: 'absolute',
          left: 8,
          bottom: 4,
          margin: 0,
          font: '11px system-ui, sans-serif',
          color: 'rgba(255,255,255,0.5)',
          pointerEvents: 'none',
        }}
      >
        Prueba de la esfera (T13) · {status}
      </p>
    </main>
  );
}

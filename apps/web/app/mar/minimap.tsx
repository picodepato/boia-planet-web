'use client';

import { MinimapGesture, TAP_SLOP_PX } from '@boia/engine/ui';
import { type PointerEvent, type RefObject, useEffect, useRef } from 'react';
import { type GlobePin, drawGlobe } from './engine/globe';
import type { Mar3D, PinSpec } from './engine/mar3d';
import { t as msg } from '../../lib/i18n';

/**
 * Minimapa redondo de /mar (T34): el planeta entero como un globo pequeño y
 * semitransparente que gira despacio, con el barco, las islas (la del evento
 * en naranja), el rumbo y la ruta de boyas. Un lienzo 2D pequeño que se
 * repinta `MINIMAP_FPS` veces por segundo, no con cada fotograma del 3D.
 *
 * Los «?» (T59) son los descuentos por encontrar: el del náufrago, el del
 * ánfora y el premio de la Boia Fiestera (a ella mientras espera, a su
 * destino mientras va a bordo). Viven aquí, en el minimapa, y desaparecen
 * al encontrar su código.
 *
 * Tocarlo abre el mapa grande (la vista de mapa del 3D); tocarlo otra vez lo
 * cierra. El gesto es el del minimapa del 2D (`MinimapGesture`): un roce
 * que empieza en él y se mueve no cuenta como toque. muestra
 */

/** Repintados por segundo: el globo apenas cambia (el barco y un giro lentísimo). */
export const MINIMAP_FPS = 5;

/** Un «?» del minimapa: el lugar donde está (id y sitio del mapa) y su código. */
export interface MinimapMark {
  placeId: string;
  discountId: string;
  x: number;
  y: number;
}

export function MarMinimap({
  engineRef,
  pins,
  marks = [],
  mapMode,
  onToggle,
}: {
  engineRef: RefObject<Mar3D | null>;
  pins: readonly PinSpec[];
  marks?: readonly MinimapMark[];
  mapMode: boolean;
  onToggle: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gesture = useRef(new MinimapGesture());
  const from = useRef({ x: 0, y: 0 });
  const pinsRef = useRef(pins);
  const marksRef = useRef(marks);
  const drawRef = useRef<() => void>(() => {});

  useEffect(() => {
    pinsRef.current = pins;
    drawRef.current();
  }, [pins]);

  useEffect(() => {
    marksRef.current = marks;
    drawRef.current();
  }, [marks]);

  useEffect(() => {
    drawRef.current();
  }, [mapMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let frames = 0;
    const draw = () => {
      const g = engineRef.current;
      if (!g || g.paused || document.visibilityState !== 'visible') return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const size = Math.max(1, Math.round((canvas.clientWidth || 84) * dpr));
      if (canvas.width !== size) {
        canvas.width = size;
        canvas.height = size;
      }
      const list: GlobePin[] = [];
      for (const p of pinsRef.current) {
        const st = g.runtime.objectState(p.id);
        if (!st?.present) continue;
        list.push({ id: p.id, x: st.x, y: st.y, accent: !!p.accent });
      }
      // Donde está ahora (lo que se mueve, como la Fiestera) o su sitio del mapa.
      const marks: GlobePin[] = marksRef.current.map((m) => {
        const st = g.runtime.objectState(m.placeId);
        return st?.present
          ? { id: m.placeId, x: st.x, y: st.y }
          : { id: m.placeId, x: m.x, y: m.y };
      });
      drawGlobe(ctx, size, {
        rect: g.planetBounds,
        spin: g.planetSpin,
        ship: g.ship,
        pins: list,
        marks,
        route: g.route.path,
        course: g.courseTarget,
      });
      // Para las pruebas: que se repinta y qué pinta.
      frames++;
      canvas.dataset.frames = String(frames);
      canvas.dataset.pins = String(list.length);
      canvas.dataset.accent = list
        .filter((p) => p.accent)
        .map((p) => p.id)
        .join(',');
      canvas.dataset.marks = marksRef.current.map((m) => m.discountId).join(',');
      canvas.dataset.markPlaces = marks.map((m) => m.id).join(',');
    };
    drawRef.current = draw;
    draw();
    const t = window.setInterval(draw, 1000 / MINIMAP_FPS);
    return () => {
      window.clearInterval(t);
      drawRef.current = () => {};
    };
  }, [engineRef]);

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    from.current = { x: e.clientX, y: e.clientY };
    gesture.current.down(performance.now(), e.clientX, e.clientY);
  };

  const onPointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    const r = gesture.current.up(performance.now());
    if (!r) return;
    // Una pulsación larga que no se mueve también abre (aquí no se arrastra).
    const still = Math.hypot(e.clientX - from.current.x, e.clientY - from.current.y) <= TAP_SLOP_PX;
    if (r.kind === 'tap' || (r.kind === 'drop' && still)) onToggle();
  };

  return (
    <button
      type="button"
      className={`mar-minimap${mapMode ? ' is-on' : ''}`}
      data-testid="mar-minimapa"
      aria-label={`${mapMode ? msg('mar.minimap.cerrarElMapaY') : msg('mar.minimap.abrirElMapaDel')}${
        marks.length ? ` · ${msg('mar.minimap.codigos', { n: marks.length })}` : ''
      }`}
      data-codigos={marks.length}
      aria-pressed={mapMode}
      onPointerDown={onPointerDown}
      onPointerMove={(e) => gesture.current.move(performance.now(), e.clientX, e.clientY)}
      onPointerUp={onPointerUp}
      onPointerCancel={() => gesture.current.cancel()}
      onClick={(e) => {
        // El puntero ya se trató arriba; el teclado (Intro, espacio) llega sólo como clic.
        if (e.detail === 0) onToggle();
      }}
    >
      <canvas ref={canvasRef} aria-hidden="true" />
      <span className="mar-minimap__tag" aria-hidden="true">
        {mapMode ? msg('mar.minimap.barco') : msg('mar.minimap.mapa')}
      </span>
    </button>
  );
}

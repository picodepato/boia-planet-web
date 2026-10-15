'use client';

import {
  type MarMinimapZone,
  MinimapGesture,
  TAP_SLOP_PX,
  minimapRelease,
  otherMarMinimapZone,
  snapMarMinimap,
} from '@boia/engine/ui';
import { type PointerEvent, type RefObject, useEffect, useRef } from 'react';
import { type GlobePin, drawGlobe, globeProject } from './engine/globe';
import type { Mar3D, PinSpec } from './engine/mar3d';
import { t as msg } from '../../lib/i18n';

/**
 * Minimapa redondo de /mar (T34): el planeta entero como un globo pequeño y
 * semitransparente que gira despacio, con el barco, las islas (la del evento
 * en naranja), el rumbo y la ruta de boyas, centrado como el mapa grande
 * (T68: el giro ya no corre lo que enseña hacia la derecha). Un lienzo 2D pequeño que se
 * repinta `MINIMAP_FPS` veces por segundo, no con cada fotograma del 3D.
 *
 * Los «?» (T59) son los descuentos por encontrar: el del náufrago, el del
 * ánfora y el premio de la Boia Fiestera (a ella mientras espera, a su
 * destino mientras va a bordo). Viven aquí, en el minimapa, y desaparecen
 * al encontrar su código.
 *
 * Tocarlo abre el mapa grande (la vista de mapa del 3D); tocarlo otra vez lo
 * cierra. El gesto es el del minimapa del 2D (`MinimapGesture`): un roce
 * que empieza en él y se mueve no cuenta como toque. Tampoco un arrastre
 * lejos que vuelve al sitio (T65): sólo abre una pulsación que no se movió.
 *
 * Moverlo (T298, REQ-MUN-021): con «Mover el minimapa» de Ajustes entra en
 * modo mover; entonces arrastrarlo lo deja en el lado donde se suelte y
 * tocarlo (o Intro) lo cambia de lado. En ese modo nunca abre el mapa.
 * muestra
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
  objective = null,
  onToggle,
  zone = 'top-left',
  moving = false,
  onMove,
}: {
  engineRef: RefObject<Mar3D | null>;
  pins: readonly PinSpec[];
  marks?: readonly MinimapMark[];
  mapMode: boolean;
  objective?: { placeId: string; x: number; y: number } | null;
  onToggle: () => void;
  /** Dónde está ahora (T298). */
  zone?: MarMinimapZone;
  /** Modo mover (Ajustes → «Mover el minimapa»). */
  moving?: boolean;
  /** Se soltó o se cambió de lado en modo mover: su sitio nuevo. */
  onMove?: (zone: MarMinimapZone) => void;
}) {
  const objectiveRef = useRef(objective);
  const markerRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    objectiveRef.current = objective;
    drawRef.current();
  }, [objective]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gesture = useRef(new MinimapGesture());
  const from = useRef({ x: 0, y: 0 });
  /** Lo más lejos que fue el dedo desde que tocó (px). */
  const reach = useRef(0);
  const pinsRef = useRef(pins);
  const marksRef = useRef(marks);
  const drawRef = useRef<() => void>(() => {});
  /** Hay un dedo puesto que empezó en el minimapa. */
  const pressed = useRef(false);

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
      const center = drawGlobe(ctx, size, {
        rect: g.planetBounds,
        spin: g.planetSpin,
        ship: g.ship,
        pins: list,
        marks,
        route: g.route.path,
        course: g.courseTarget,
      });
      const target = objectiveRef.current;
      const marker = markerRef.current;
      if (target && marker) {
        const state = g.runtime.objectState(target.placeId);
        const point = globeProject(state?.x ?? target.x, state?.y ?? target.y, g.planetBounds, 0);
        const radius = (canvas.clientWidth || 84) * (0.5 - 5 / 88);
        marker.style.left = `${(canvas.clientWidth || 84) / 2 + point.x * radius}px`;
        marker.style.top = `${(canvas.clientWidth || 84) / 2 + point.y * radius}px`;
      }
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
      // Dónde quedó el centro del planeta, en px de CSS del lienzo (T68: centrado).
      const css = (canvas.clientWidth || size) / size;
      canvas.dataset.centro = `${(center.x * css).toFixed(1)},${(center.y * css).toFixed(1)}`;
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
    reach.current = 0;
    pressed.current = true;
    gesture.current.down(performance.now(), e.clientX, e.clientY);
  };

  const onPointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    const r = gesture.current.up(performance.now());
    if (!pressed.current) return;
    pressed.current = false;
    // Una pulsación larga que no se mueve también abre (aquí no se arrastra);
    // ir lejos y volver al mismo sitio no es quedarse quieto (T65).
    const still =
      Math.max(reach.current, Math.hypot(e.clientX - from.current.x, e.clientY - from.current.y)) <=
      TAP_SLOP_PX;
    const el = e.currentTarget;
    const action = minimapRelease({ moving, result: r, still });
    if (action === 'drop') {
      // Donde quedó su centro, con el arrastre puesto; luego vuelve a su caja.
      const box = el.getBoundingClientRect();
      onMove?.(snapMarMinimap(window.innerWidth, box.left + box.width / 2));
    } else if (action === 'swap') onMove?.(otherMarMinimapZone(zone));
    else if (action === 'toggle-map') onToggle();
    el.style.translate = '';
  };

  return (
    <button
      type="button"
      className={`mar-minimap${mapMode ? ' is-on' : ''}${moving ? ' is-moving' : ''}`}
      data-testid="mar-minimapa"
      data-zona={zone}
      data-moviendo={moving ? 'si' : undefined}
      aria-label={
        moving
          ? msg('mar.minimap.moverAria')
          : `${mapMode ? msg('mar.minimap.cerrarElMapaY') : msg('mar.minimap.abrirElMapaDel')}${
              marks.length ? ` · ${msg('mar.minimap.codigos', { n: marks.length })}` : ''
            }`
      }
      data-codigos={marks.length}
      aria-pressed={mapMode}
      onPointerDown={onPointerDown}
      onPointerMove={(e) => {
        reach.current = Math.max(
          reach.current,
          Math.hypot(e.clientX - from.current.x, e.clientY - from.current.y),
        );
        gesture.current.move(performance.now(), e.clientX, e.clientY);
        // En modo mover, el minimapa sigue al dedo hasta soltarlo.
        if (moving && pressed.current) {
          e.currentTarget.style.translate = `${e.clientX - from.current.x}px ${
            e.clientY - from.current.y
          }px`;
        }
      }}
      onPointerUp={onPointerUp}
      onPointerCancel={(e) => {
        gesture.current.cancel();
        pressed.current = false;
        e.currentTarget.style.translate = '';
      }}
      onClick={(e) => {
        // El puntero ya se trató arriba; el teclado (Intro, espacio) llega sólo como clic.
        if (e.detail !== 0) return;
        if (moving) onMove?.(otherMarMinimapZone(zone));
        else onToggle();
      }}
    >
      <canvas ref={canvasRef} aria-hidden="true" />
      {objective ? (
        <span
          ref={markerRef}
          className="mar-minimap__objective"
          data-testid="mar-objective-marker"
          data-destino={objective.placeId}
          aria-hidden="true"
        >
          !
        </span>
      ) : null}
      <span className="mar-minimap__tag" aria-hidden="true">
        {moving
          ? msg('mar.minimap.mover')
          : mapMode
            ? msg('mar.minimap.barco')
            : msg('mar.minimap.mapa')}
      </span>
    </button>
  );
}

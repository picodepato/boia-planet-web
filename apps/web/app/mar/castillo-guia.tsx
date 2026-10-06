'use client';

import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { t as msg } from '../../lib/i18n';
import {
  CASTLE_GUIDE_STEPS,
  type CastleGuideState,
  type CastleHudMode,
  GUIDE_START,
  type GuideBubblePlace,
  advanceGuide,
  closeGuideStep,
  guideEnded,
  guideStep,
  placeGuideBubble,
  skipGuide,
} from './castillo-guia-model';
import type { CastleMode } from './castillo-mode';
import './castillo-guia.css';

/**
 * La guía de la primera partida del castillo (plan 015 T173, decisión 14)
 * encima de la partida de verdad: un bocadillo corto que apunta a lo que
 * nombra, sin oscurecer nada (la partida sigue y se toca como siempre). Se
 * cierra con su ✕ o haciendo lo que pide, y sale el siguiente; «Saltar
 * guía», siempre a la vista, la acaba. Los pasos y cuándo pasa cada uno, en
 * `castillo-guia-model.ts`; aquí sólo se lee la partida (`castle.read()`) y
 * lo que enseña la franja de abajo (`mode`).
 */

/** Cada cuánto se mira la partida y dónde está lo que se señala (ms). */
const READ_MS = 150;

const samePlace = (a: GuideBubblePlace | null, b: GuideBubblePlace | null) =>
  a === b ||
  (!!a &&
    !!b &&
    a.left === b.left &&
    a.width === b.width &&
    a.side === b.side &&
    a.y === b.y &&
    a.tail === b.tail);

type Box = { left: number; top: number; width: number; height: number };

/**
 * Lo primero de `anchors` que se ve en pantalla, o null. Lo que está en la
 * franja de abajo cuenta desde arriba de la franja: el bocadillo va encima
 * de ella, con la punta sobre lo que nombra, y nunca tapa sus botones.
 */
function findAnchor(anchors: readonly string[]): Box | null {
  for (const id of anchors) {
    for (const el of document.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)) {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      const dock = el.closest('[data-testid="mar-castillo-franja"]')?.firstElementChild;
      const top = dock ? Math.min(r.top, dock.getBoundingClientRect().top) : r.top;
      return { left: r.left, width: r.width, top, height: r.bottom - top };
    }
  }
  return null;
}

export function CastleGuideLayer({
  castle,
  mode,
  hasPriority,
  covered,
}: {
  castle: CastleMode;
  /** Lo que enseña la franja de abajo del HUD. */
  mode: CastleHudMode;
  /** La ficha abierta es de una isla que elige a quién apunta. */
  hasPriority: boolean;
  /** El menú o un panel encima: el bocadillo se esconde (la guía espera). */
  covered: boolean;
}) {
  const on = castle.guide.on && castle.active && !castle.result;
  const [state, setState] = useState<CastleGuideState>(GUIDE_START);
  const stateRef = useRef(state);
  const [place, setPlace] = useState<GuideBubblePlace | null>(null);
  const latest = useRef({ mode, hasPriority, castle });
  latest.current = { mode, hasPriority, castle };

  const update = useCallback((next: CastleGuideState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  // Una guía nueva con cada partida guiada.
  useEffect(() => {
    if (on) update(GUIDE_START);
  }, [on, update]);

  useEffect(() => {
    if (!on) return;
    const tick = () => {
      const l = latest.current;
      const s = l.castle.read();
      if (!s) return;
      const next = advanceGuide(stateRef.current, {
        mode: l.mode,
        plane: { x: s.plane.x, y: s.plane.y },
        tally: l.castle.guide.tally(),
        hasPriority: l.hasPriority,
      });
      if (next !== stateRef.current) update(next);
      const step = guideStep(next);
      const at = step
        ? placeGuideBubble(findAnchor(step.anchors), {
            width: window.innerWidth,
            height: window.innerHeight,
          })
        : null;
      setPlace((prev) => (samePlace(prev, at) ? prev : at));
    };
    tick();
    const id = window.setInterval(tick, READ_MS);
    return () => window.clearInterval(id);
  }, [on, update]);

  // El último paso hecho (o cerrado): la guía acaba y la partida sigue igual.
  const ended = guideEnded(state);
  const { end } = castle.guide;
  useEffect(() => {
    if (on && ended) end();
  }, [on, ended, end]);

  const step = guideStep(state);
  if (!on || covered || !step || !place) return null;
  const n = state.step + 1;
  const style: CSSProperties = {
    left: place.left,
    width: place.width,
    top: place.y,
    ...(place.tail === null ? {} : { '--guia-punta': `${place.tail}px` }),
  } as CSSProperties;
  return (
    <div className="mar-castle-guia" data-testid="mar-castillo-guia" data-paso={step.id}>
      <div
        key={step.id}
        className={`mar-castle-bocadillo is-${place.side}`}
        data-testid="mar-castillo-guia-bocadillo"
        data-paso={step.id}
        data-lado={place.side}
        style={style}
      >
        <p className="mar-castle-bocadillo__texto" role="status" aria-live="polite">
          {msg(step.text)}
        </p>
        <button
          type="button"
          className="mar-castle-bocadillo__x"
          data-testid="mar-castillo-guia-cerrar"
          aria-label={msg('mar.castillo.guia.cerrar')}
          onClick={() => update(closeGuideStep(stateRef.current))}
        >
          <span aria-hidden="true">✕</span>
        </button>
        <div className="mar-castle-bocadillo__pie">
          <span className="mar-castle-bocadillo__paso" data-testid="mar-castillo-guia-paso">
            {msg('mar.castillo.guia.paso', { n, total: CASTLE_GUIDE_STEPS.length })}
          </span>
          <button
            type="button"
            className="mar-castle-bocadillo__saltar"
            data-testid="mar-castillo-guia-saltar"
            onClick={() => update(skipGuide())}
          >
            {msg('mar.castillo.guia.saltar')}
          </button>
        </div>
      </div>
    </div>
  );
}

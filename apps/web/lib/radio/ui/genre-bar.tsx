'use client';

import type { RadioGenre } from '@boia/contracts';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { pageLeft, revealLeft, stripEdges } from '../player-model';
import { t } from './t';

/**
 * La barra de géneros del reproductor (plan 023 T246). Cuando no caben, corre
 * de lado: con el dedo, con el trackpad, con la rueda (vertical u horizontal)
 * y con las flechitas de los bordes, que sólo salen si queda algo escondido a
 * ese lado (con el borde difuminado). El género elegido se trae a la vista.
 */

const ARROW_PAD = 18;

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

export function GenreBar({
  genres,
  active,
  onPick,
}: {
  genres: readonly RadioGenre[];
  active: string | null;
  onPick: (id: string | null) => void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ before: false, after: false });

  const measure = useCallback(() => {
    const el = strip.current;
    if (!el) return;
    const next = stripEdges(el);
    setEdges((prev) => (prev.before === next.before && prev.after === next.after ? prev : next));
  }, []);

  // Bordes: al correr, al cambiar de tamaño y al cambiar los géneros.
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      ro?.disconnect();
    };
  }, [measure, genres]);

  // La rueda vertical también la corre de lado (sin atrapar la página en los extremos).
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      const next = Math.max(0, Math.min(max, el.scrollLeft + e.deltaY));
      if (next === el.scrollLeft) return;
      e.preventDefault();
      el.scrollLeft = next;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // El género elegido, a la vista (al abrir, sin animación).
  const first = useRef(true);
  useLayoutEffect(() => {
    const el = strip.current;
    const btn = el?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!el || !btn) return;
    const left = revealLeft(el, btn.offsetLeft, btn.offsetWidth, ARROW_PAD);
    if (left !== el.scrollLeft) {
      const instant = first.current || reducedMotion();
      if (typeof el.scrollTo === 'function') {
        el.scrollTo({ left, behavior: instant ? 'auto' : 'smooth' });
      } else {
        el.scrollLeft = left;
      }
    }
    first.current = false;
  }, [active, genres]);

  const page = (dir: -1 | 1) => {
    const el = strip.current;
    if (!el) return;
    el.scrollTo({ left: pageLeft(el, dir), behavior: reducedMotion() ? 'auto' : 'smooth' });
  };

  return (
    <div
      className="radio-genres"
      data-before={edges.before ? '' : undefined}
      data-after={edges.after ? '' : undefined}
    >
      <div
        ref={strip}
        className="radio-genres__strip"
        role="group"
        aria-label={t('radio.generos')}
        data-testid="radio-generos"
      >
        <button
          type="button"
          className="radio-genre"
          aria-pressed={active === null}
          onClick={() => onPick(null)}
        >
          {t('radio.generos.todos')}
        </button>
        {genres.map((g) => (
          <button
            key={g.id}
            type="button"
            className="radio-genre"
            aria-pressed={active === g.id}
            data-testid={`radio-genero-${g.id}`}
            onClick={() => onPick(g.id)}
          >
            {g.name}
          </button>
        ))}
      </div>
      {/* Las flechas son para el ratón: con el teclado, el foco ya trae cada género a la vista. */}
      <button
        type="button"
        className="radio-genres__arrow radio-genres__arrow--before"
        tabIndex={-1}
        hidden={!edges.before}
        aria-label={t('radio.generos.antes')}
        data-testid="radio-generos-antes"
        onClick={() => page(-1)}
      >
        <span aria-hidden="true">‹</span>
      </button>
      <button
        type="button"
        className="radio-genres__arrow radio-genres__arrow--after"
        tabIndex={-1}
        hidden={!edges.after}
        aria-label={t('radio.generos.despues')}
        data-testid="radio-generos-despues"
        onClick={() => page(1)}
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>
  );
}

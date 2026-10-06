'use client';

import {
  DEFENSE_RUN_MINS,
  type DefenseMedal,
  type DefenseRunMin,
  type DifficultyId,
} from '@boia/engine/defense';
import { type ReactNode, useEffect, useId, useRef } from 'react';
import { type MessageKey, t as msg } from '../../lib/i18n';
import { castlePairMedal } from '../../lib/mundo/castle-medals';
import { CanonDifficultyPicker } from './canon-previa';
import type { CastleMode } from './castillo-mode';
import './canon-previa.css';
import './castillo-previa.css';

/**
 * El pop-up antes de la partida de «Defensa del Castillo» (plan 014 T162),
 * con el patrón del Cañón (plan 013 T151, `canon-previa.tsx`): al pulsar
 * «Jugar» en el panel de la isla del castillo se elige la dificultad (3) y
 * la duración (5, 7 o 10 min), se ve la mejor medalla de ese par y su
 * ranking (T163 lo llena; hasta entonces, un hueco vacío que lo dice) y se
 * juega.
 *
 * Un diálogo modal: el foco entra en la duración marcada y no sale del
 * diálogo con Tab; Esc o la × lo cierran y devuelven el panel de la isla.
 * Abajo en el móvil, centrado en escritorio. Los atajos `duracion=` y
 * `dificultad=` no pasan por aquí (salvo con `oferta=1`): empiezan la
 * partida directamente.
 */

export const CASTLE_MEDAL_KEY: Readonly<Record<DefenseMedal, MessageKey>> = {
  oro: 'mar.canon.fin.medalla.oro',
  plata: 'mar.canon.fin.medalla.plata',
  bronce: 'mar.canon.fin.medalla.bronce',
};

const MEDAL_ICON_KEY: Readonly<Record<DefenseMedal, MessageKey>> = {
  oro: 'mar.castillo.medalla.icono.oro',
  plata: 'mar.castillo.medalla.icono.plata',
  bronce: 'mar.castillo.medalla.icono.bronce',
};

export const CASTLE_DIFFICULTY_KEY: Readonly<Record<DifficultyId, MessageKey>> = {
  tranquila: 'mar.canon.dificultad.tranquila',
  normal: 'mar.canon.dificultad.normal',
  tormenta: 'mar.canon.dificultad.tormenta',
};

const DIFFICULTY_TEXT_KEY: Readonly<Record<DifficultyId, MessageKey>> = {
  tranquila: 'mar.castillo.previa.dificultad.tranquila',
  normal: 'mar.castillo.previa.dificultad.normal',
  tormenta: 'mar.castillo.previa.dificultad.tormenta',
};

/** «5 min · Tranquila»: el par elegido, en palabras. */
export function castlePairLabel(runMin: DefenseRunMin, difficulty: DifficultyId): string {
  return msg('mar.castillo.previa.eleccion', {
    min: runMin,
    dificultad: msg(CASTLE_DIFFICULTY_KEY[difficulty]),
  });
}

export function CastlePrevia({
  castle,
  ranking,
}: {
  castle: CastleMode;
  /** El ranking del par elegido (T163); sin él, el hueco vacío. */
  ranking?: (runMin: DefenseRunMin, difficulty: DifficultyId) => ReactNode;
}) {
  const { prep } = castle;
  const titleId = useId();
  const textId = useId();
  const boxRef = useRef<HTMLElement>(null);
  const latest = useRef(prep);
  latest.current = prep;

  // Al abrirse, el foco en la duración marcada (lo primero que se elige).
  useEffect(() => {
    if (!prep.open) return;
    boxRef.current
      ?.querySelector<HTMLElement>('[data-testid="mar-castillo-duracion"] [aria-checked="true"]')
      ?.focus({ preventScroll: true });
  }, [prep.open]);

  // Esc cierra (antes que nadie: no abre el menú de /mar); Tab no sale del diálogo.
  useEffect(() => {
    if (!prep.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        latest.current.close();
        return;
      }
      if (e.key !== 'Tab') return;
      const box = boxRef.current;
      if (!box) return;
      const focusable = [
        ...box.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"]'),
      ].filter((el) => el.tabIndex >= 0);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      const inside = box.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [prep.open]);

  if (!prep.open) return null;
  const { runMin, difficulty } = prep;
  const pair = castlePairLabel(runMin, difficulty);
  const best = castlePairMedal(castle.medals, runMin, difficulty);
  return (
    <div
      className="mar-canon-previa-wrap"
      onPointerDown={(e) => {
        // Tocar fuera del diálogo lo cierra, como la ×.
        if (e.target === e.currentTarget) prep.close();
      }}
    >
      <section
        ref={boxRef}
        className="mar-canon-previa mar-castle-previa"
        data-testid="mar-castillo-previa"
        data-duracion={runMin}
        data-dificultad={difficulty}
        data-bloqueado={prep.blocked ? 'si' : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={textId}
      >
        <header className="mar-canon-previa__head">
          <h2 id={titleId} className="mar-canon-previa__title">
            {msg('mar.castillo.titulo')}
          </h2>
          <button
            type="button"
            className="mar-canon-previa__close"
            data-testid="mar-castillo-previa-cerrar"
            aria-label={msg('mar.castillo.previa.cerrar')}
            onClick={prep.close}
          >
            <span aria-hidden="true">×</span>
          </button>
          <p id={textId} className="mar-canon-previa__text">
            {msg('mar.castillo.previa.texto')}
          </p>
        </header>

        <h3 className="mar-canon-previa__label">{msg('mar.castillo.previa.duracion')}</h3>
        <CastleRunMinPicker
          value={runMin}
          difficulty={difficulty}
          medals={castle.medals}
          onChange={prep.chooseRunMin}
        />

        <h3 className="mar-canon-previa__label">{msg('mar.canon.previa.dificultad')}</h3>
        <CanonDifficultyPicker value={difficulty} onChange={prep.chooseDifficulty} />
        <p className="mar-canon-previa__hint" data-testid="mar-castillo-previa-dificultad-texto">
          {msg(DIFFICULTY_TEXT_KEY[difficulty])}
        </p>

        <p
          className={`mar-castle-previa__best${best ? ` is-${best}` : ''}`}
          data-testid="mar-castillo-previa-medalla"
          data-medalla={best ?? 'ninguna'}
        >
          {best
            ? msg('mar.castillo.previa.medalla', { medalla: msg(CASTLE_MEDAL_KEY[best]) })
            : msg('mar.castillo.previa.medalla.ninguna')}
        </p>

        <section
          className="mar-canon-previa__ranking"
          data-testid="mar-castillo-previa-ranking"
          data-duracion={runMin}
          data-dificultad={difficulty}
          aria-label={msg('mar.castillo.previa.ranking', { eleccion: pair })}
        >
          <h3 className="mar-canon-previa__ranking-title">
            {msg('mar.castillo.previa.ranking', { eleccion: pair })}
          </h3>
          {ranking?.(runMin, difficulty) ?? (
            <p className="mar-canon-previa__empty" data-testid="mar-castillo-previa-ranking-vacio">
              {msg('mar.castillo.previa.ranking.vacio')}
            </p>
          )}
        </section>

        {prep.blocked ? (
          <p
            className="mar-canon-previa__lock"
            data-testid="mar-castillo-previa-bloqueo"
            role="status"
          >
            {prep.blocked}
          </p>
        ) : null}
        <button
          type="button"
          className="mar-canon-previa__play"
          data-testid="mar-castillo-previa-jugar"
          disabled={!!prep.blocked}
          aria-label={msg('mar.castillo.previa.jugar.aria', { eleccion: pair })}
          onClick={prep.play}
        >
          <span className="mar-canon-previa__play-main">{msg('mar.canon.previa.jugar')}</span>
          <span className="mar-canon-previa__play-sub">{pair}</span>
        </button>
      </section>
    </div>
  );
}

/**
 * 5 / 7 / 10 min: un grupo de opciones; cada duración con la mejor medalla
 * de su par con la dificultad elegida. Teclado (Tab y flechas) y dedo.
 */
export function CastleRunMinPicker({
  value,
  difficulty,
  medals,
  onChange,
}: {
  value: DefenseRunMin;
  difficulty: DifficultyId;
  medals: CastleMode['medals'];
  onChange: (m: DefenseRunMin) => void;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const move = (from: number, delta: number) => {
    const n = DEFENSE_RUN_MINS.length;
    const next = (from + delta + n) % n;
    onChange(DEFENSE_RUN_MINS[next]!);
    refs.current[next]?.focus();
  };
  return (
    <div
      className="mar-castle-duracion"
      role="radiogroup"
      aria-label={msg('mar.castillo.previa.duracion')}
      data-testid="mar-castillo-duracion"
      data-duracion={value}
    >
      {DEFENSE_RUN_MINS.map((m, i) => {
        const medal = castlePairMedal(medals, m, difficulty);
        const label = msg('mar.castillo.previa.minutos', { min: m });
        return (
          <button
            key={m}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={value === m}
            aria-label={
              medal
                ? `${label}. ${msg('mar.castillo.previa.medalla', { medalla: msg(CASTLE_MEDAL_KEY[medal]) })}`
                : label
            }
            tabIndex={value === m ? 0 : -1}
            className="mar-castle-duracion-opcion"
            data-testid={`mar-castillo-duracion-${m}`}
            data-duracion={m}
            data-medalla={medal ?? undefined}
            onClick={() => onChange(m)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                move(i, 1);
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                move(i, -1);
              }
            }}
          >
            <span className="mar-castle-duracion-num" aria-hidden="true">
              {m}
            </span>
            <span className="mar-castle-duracion-min" aria-hidden="true">
              {msg('mar.castillo.previa.min')}
            </span>
            <span className="mar-castle-duracion-medalla" aria-hidden="true">
              {medal ? msg(MEDAL_ICON_KEY[medal]) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

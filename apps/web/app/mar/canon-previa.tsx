'use client';

import {
  DIFFICULTY_IDS,
  type BossId,
  type DifficultyId,
  SURVIVORS_CONFIG,
  actFinalBoss,
} from '@boia/engine/survivors';
import { type ReactNode, useEffect, useId, useRef } from 'react';
import { type MessageKey, t as msg } from '../../lib/i18n';
import type { CampaignAct } from './canon-campaign';
import type { CanonMode } from './canon-mode';
import './canon-previa.css';

/**
 * El pop-up antes de la partida del Cañón (plan 013 T151, diseño §9): al
 * pulsar «Jugar» en el panel de su isla, se elige el acto (los abiertos; el
 * acto 2 tras vencer al Barco Fantasma, el 3 cerrado, «próximamente»), la
 * dificultad, se ve el ranking del boss final del acto elegido (T155 lo
 * llena; hasta entonces, un hueco vacío que lo dice) y se juega.
 *
 * Un diálogo modal: el foco entra en el acto marcado y no sale del diálogo
 * con Tab; Esc o la × lo cierran y devuelven el panel de la isla. Abajo en
 * el móvil, centrado en escritorio. Los atajos `acto=` y `dificultad=` no
 * pasan por aquí: empiezan la partida directamente.
 *
 * Las medallas por acto y dificultad aún no se guardan; del progreso sólo
 * se sabe qué boss final cayó (la campaña, T144): el acto sale «Superado».
 */

/** El nombre del boss final de un acto (clave del catálogo), o null si el acto aún no existe. */
export function actBossKey(act: number): MessageKey | null {
  const id = actFinalBoss(act);
  return id ? bossKey(id) : null;
}

function bossKey(id: BossId): MessageKey {
  return (SURVIVORS_CONFIG.bosses[id]?.i18nKey ?? `survivors.boss.${id}`) as MessageKey;
}

export function CanonPrevia({
  canon,
  ranking,
}: {
  canon: CanonMode;
  /** El ranking del boss final del acto elegido (T155); sin él, el hueco vacío. */
  ranking?: (act: number, boss: BossId | null) => ReactNode;
}) {
  const { prep } = canon;
  const titleId = useId();
  const textId = useId();
  const boxRef = useRef<HTMLElement>(null);
  const latest = useRef(prep);
  latest.current = prep;

  // Al abrirse, el foco en el acto marcado (el primero de lo que se elige).
  useEffect(() => {
    if (!prep.open) return;
    const box = boxRef.current;
    box
      ?.querySelector<HTMLElement>('[data-testid="mar-canon-acto"] [aria-checked="true"]')
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
  const act = canon.act;
  const boss = actFinalBoss(act);
  const bossName = boss ? msg(bossKey(boss)) : null;
  const difficulty = msg(DIFFICULTY_LABEL_KEY[canon.difficulty]);
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
        className="mar-canon-previa"
        data-testid="mar-canon-previa"
        data-acto={act}
        data-dificultad={canon.difficulty}
        data-bloqueado={prep.blocked ? 'si' : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={textId}
      >
        <header className="mar-canon-previa__head">
          <h2 id={titleId} className="mar-canon-previa__title">
            {msg('mar.canon.title')}{' '}
            <span
              className="mar-canon-previa__beta"
              data-testid="mar-canon-previa-beta"
              title={msg('mar.canon.beta.aria')}
            >
              {msg('mar.canon.beta')}
            </span>
          </h2>
          <button
            type="button"
            className="mar-canon-previa__close"
            data-testid="mar-canon-previa-cerrar"
            aria-label={msg('mar.canon.previa.cerrar')}
            onClick={prep.close}
          >
            <span aria-hidden="true">×</span>
          </button>
          <p id={textId} className="mar-canon-previa__text">
            {msg('mar.canon.previa.texto')}
          </p>
        </header>

        <h3 className="mar-canon-previa__label">{msg('mar.canon.previa.actos')}</h3>
        <CanonActPicker acts={canon.acts} value={act} onChange={prep.chooseAct} />

        <h3 className="mar-canon-previa__label">{msg('mar.canon.previa.dificultad')}</h3>
        <CanonDifficultyPicker value={canon.difficulty} onChange={prep.chooseDifficulty} />
        <p className="mar-canon-previa__hint" data-testid="mar-canon-previa-dificultad-texto">
          {msg(DIFFICULTY_TEXT_KEY[canon.difficulty])}
        </p>

        <section
          className="mar-canon-previa__ranking"
          data-testid="mar-canon-previa-ranking"
          data-acto={act}
          data-boss={boss ?? undefined}
          aria-label={bossName ? msg('mar.canon.previa.ranking', { nombre: bossName }) : undefined}
        >
          <h3 className="mar-canon-previa__ranking-title">
            {bossName ? msg('mar.canon.previa.ranking', { nombre: bossName }) : null}
          </h3>
          {ranking?.(act, boss) ?? (
            <p className="mar-canon-previa__empty" data-testid="mar-canon-previa-ranking-vacio">
              {msg('mar.canon.previa.ranking.vacio')}
            </p>
          )}
        </section>

        {prep.blocked ? (
          <p className="mar-canon-previa__lock" data-testid="mar-canon-previa-bloqueo" role="status">
            {prep.blocked}
          </p>
        ) : null}
        <button
          type="button"
          className="mar-canon-previa__play"
          data-testid="mar-canon-previa-jugar"
          disabled={!!prep.blocked}
          aria-label={msg('mar.canon.previa.jugar.aria', { n: act, dificultad: difficulty })}
          onClick={prep.play}
        >
          <span className="mar-canon-previa__play-main">{msg('mar.canon.previa.jugar')}</span>
          <span className="mar-canon-previa__play-sub">
            {msg('mar.canon.previa.eleccion', { n: act, dificultad: difficulty })}
          </span>
        </button>
      </section>
    </div>
  );
}

/**
 * Acto 1 / Acto 2 / Acto 3 (T144, en el pop-up desde T151): un grupo de
 * opciones, cada acto con su boss final. Sólo los abiertos se eligen; los
 * cerrados (falta vencer al boss final del anterior) y los que aún no
 * existen («próximamente») se ven pero no se marcan, y dicen por qué.
 * Teclado (Tab y flechas, que saltan los cerrados) y dedo.
 */
export function CanonActPicker({
  acts,
  value,
  onChange,
}: {
  acts: readonly CampaignAct[];
  value: number;
  onChange: (act: number) => void;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const open = acts.filter((a) => a.state === 'open');
  const move = (delta: number) => {
    const i = open.findIndex((a) => a.act === value);
    if (i < 0) return;
    const next = open[(i + delta + open.length) % open.length]!;
    onChange(next.act);
    refs.current[acts.indexOf(next)]?.focus();
  };
  return (
    <div
      className="mar-canon-acto"
      role="radiogroup"
      aria-label={msg('mar.canon.acto.aria')}
      data-testid="mar-canon-acto"
      data-acto={value}
    >
      {acts.map((a, i) => {
        const playable = a.state === 'open';
        const checked = playable && a.act === value;
        const key = actBossKey(a.act);
        const boss =
          a.state === 'soon' || !key
            ? msg('mar.canon.previa.boss.misterio')
            : msg('mar.canon.previa.boss', { nombre: msg(key) });
        const note =
          a.state === 'soon'
            ? msg('mar.canon.acto.proximamente')
            : a.state === 'locked'
              ? msg('mar.canon.acto.cerrado')
              : a.beaten
                ? msg('mar.canon.acto.superado')
                : null;
        const help =
          a.state === 'soon'
            ? msg('mar.canon.acto.proximamente.texto')
            : a.state === 'locked'
              ? msg('mar.canon.acto.cerrado.texto', { n: a.act - 1 })
              : a.beaten
                ? msg('mar.canon.acto.superado.texto')
                : msg('mar.canon.acto.abierto.texto');
        const label = msg('mar.canon.acto', { n: a.act });
        return (
          <button
            key={a.act}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-disabled={playable ? undefined : true}
            aria-label={`${label}. ${boss}.${note ? ` ${note}.` : ''} ${help}`}
            tabIndex={checked ? 0 : -1}
            className="mar-canon-acto-opcion"
            data-testid={`mar-canon-acto-${a.act}`}
            data-estado={a.state}
            data-superado={a.beaten ? 'si' : undefined}
            title={help}
            onClick={() => {
              if (playable) onChange(a.act);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                move(1);
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                move(-1);
              }
            }}
          >
            <span className="mar-canon-acto-sky" aria-hidden="true" />
            <span className="mar-canon-acto-nombre">{label}</span>
            <span className="mar-canon-acto-boss" aria-hidden="true">
              {a.state === 'soon' || !key ? msg('mar.canon.previa.boss.oculto') : msg(key)}
            </span>
            {note ? (
              <span className="mar-canon-acto-nota" aria-hidden="true">
                {note}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Tranquila / Normal / Tormenta (T131, en el pop-up desde T151): tres
 * botones de un grupo de opciones (Normal marcado de entrada). Teclado (Tab
 * y flechas) y dedo.
 */
export function CanonDifficultyPicker({
  value,
  onChange,
}: {
  value: DifficultyId;
  onChange: (d: DifficultyId) => void;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const move = (from: number, delta: number) => {
    const n = DIFFICULTY_IDS.length;
    const next = (from + delta + n) % n;
    onChange(DIFFICULTY_IDS[next]!);
    refs.current[next]?.focus();
  };
  return (
    <div
      className="mar-canon-dificultad"
      role="radiogroup"
      aria-label={msg('mar.canon.dificultad.aria')}
      data-testid="mar-canon-dificultad"
      data-dificultad={value}
    >
      {DIFFICULTY_IDS.map((id, i) => (
        <button
          key={id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={value === id}
          tabIndex={value === id ? 0 : -1}
          className="mar-canon-dificultad-opcion"
          data-testid={`mar-canon-dificultad-${id}`}
          data-dificultad={id}
          title={msg(DIFFICULTY_TEXT_KEY[id])}
          onClick={() => onChange(id)}
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
          {msg(DIFFICULTY_LABEL_KEY[id])}
        </button>
      ))}
    </div>
  );
}

const DIFFICULTY_LABEL_KEY: Readonly<Record<DifficultyId, MessageKey>> = {
  tranquila: 'mar.canon.dificultad.tranquila',
  normal: 'mar.canon.dificultad.normal',
  tormenta: 'mar.canon.dificultad.tormenta',
};
const DIFFICULTY_TEXT_KEY: Readonly<Record<DifficultyId, MessageKey>> = {
  tranquila: 'mar.canon.dificultad.tranquila.texto',
  normal: 'mar.canon.dificultad.normal.texto',
  tormenta: 'mar.canon.dificultad.tormenta.texto',
};

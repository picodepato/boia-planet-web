'use client';

import type { LevelUpCard } from '@boia/engine/survivors';
import { type RefObject, useCallback, useEffect, useId, useRef, useState } from 'react';
import { t as msg } from '../../lib/i18n';
import type { CanonMode } from './canon-mode';
import {
  CARD_ARM_MS,
  type CanonResult,
  type CanonView,
  END_KEYS,
  FLAME_ICON,
  SALVAVIDAS_ICON,
  type SlotView,
  type SlotsView,
  canonView,
  cardAmount,
  cardKeyAction,
  cardView,
  formatClock,
  formatPlayed,
  prizeLine,
  sameView,
  slotsView,
  waterLevelOf,
} from './canon-hud-model';
import type { Mar3D } from './engine/mar3d';
import './canon-hud.css';

/**
 * La interfaz del Cañón «Que no pare la música» en `/mar` (T118), al estilo
 * de los chips de la carrera: arriba al centro la cuenta atrás hasta el
 * amanecer, el nivel con su barra y la etiqueta «BETA» (con el botón de
 * pausa, que abre el menú de `/mar`); bajo el barco, el agua a bordo; al
 * subir de nivel, 1 de 3 cartas; al acabar, la pantalla final. Nada de esto
 * tapa «Entradas» (la barra de abajo va encima) ni el botón del menú.
 */

/** Cada cuánto se lee la partida para el HUD (ms); sólo se repinta si cambia. */
const READ_MS = 100;
/** Cuánto se queda el aviso de una partida abandonada (ms). */
const NOTICE_MS = 8000;
/** El agua a bordo, a la altura del agua bajo el barco (u de escena sobre la de los rótulos). */
const WATER_DY = -2.4;

/** Lo que el HUD pinta, leído de la partida unas veces por segundo. */
function useCanonView(canon: CanonMode): { view: CanonView | null; slots: SlotsView | null } {
  const [state, setState] = useState<{ view: CanonView | null; slots: SlotsView | null }>({
    view: null,
    slots: null,
  });
  const read = canon.read;
  const on = canon.active && !canon.result;
  useEffect(() => {
    if (!on) {
      setState({ view: null, slots: null });
      return;
    }
    const tick = () => {
      const s = read();
      const next = s ? canonView(s) : null;
      setState((prev) =>
        sameView(prev.view, next) ? prev : { view: next, slots: s ? slotsView(s) : null },
      );
    };
    tick();
    const id = window.setInterval(tick, READ_MS);
    return () => window.clearInterval(id);
  }, [on, read]);
  return state;
}

/**
 * Todo lo del Cañón encima del mar. `covered`: hay un panel o el menú
 * encima (la partida está en pausa); las cartas y la pantalla final
 * esperan debajo a que se cierre. `onPause`: el botón de pausa y Esc abren
 * el menú de `/mar`.
 */
export function CanonLayer({
  canon,
  engineRef,
  covered,
  onPause,
}: {
  canon: CanonMode;
  engineRef: RefObject<Mar3D | null>;
  covered: boolean;
  onPause: () => void;
}) {
  const { view, slots } = useCanonView(canon);

  // Esc: con la partida en marcha, pausa (el menú); en la pantalla final, volver al mar.
  // Con un panel o el menú abiertos, Esc es suyo (lo cierra).
  const latest = useRef({ canon, covered, onPause });
  latest.current = { canon, covered, onPause };
  useEffect(() => {
    if (!canon.active) return;
    const onKey = (e: KeyboardEvent) => {
      const { canon: c, covered: busy, onPause: pause } = latest.current;
      if (e.key !== 'Escape' || busy || !c.active || e.defaultPrevented) return;
      e.preventDefault();
      if (c.result) c.backToSea();
      else pause();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canon.active]);

  return (
    <>
      {view ? <CanonHud view={view} onPause={onPause} /> : null}
      {view && slots ? <CanonSlots slots={slots} /> : null}
      {view ? <CanonWater pct={view.waterPct} engineRef={engineRef} /> : null}
      {view?.card && !covered ? (
        <CanonCards card={view.card} capacity={view.waterCapacity} onChoose={canon.choose} />
      ) : null}
      {canon.result && !covered ? (
        <CanonEnd
          result={canon.result}
          prize={canon.prize}
          reward={canon.reward}
          onAgain={canon.again}
          onBack={canon.backToSea}
        />
      ) : null}
      {canon.notice ? <CanonNotice onClose={canon.dismissNotice} /> : null}
      {canon.fading ? <div className="mar-canon-fade" aria-hidden="true" /> : null}
    </>
  );
}

/** La etiqueta «BETA» (también en el panel de la isla del Cañón). */
function BetaTag() {
  return (
    <span
      className="mar-canon-beta"
      data-testid="mar-canon-beta"
      title={msg('mar.canon.beta.aria')}
    >
      {msg('mar.canon.beta')}
    </span>
  );
}

/** Arriba al centro: «BETA», la cuenta atrás, la pausa y, debajo, el nivel con su barra. */
function CanonHud({ view, onPause }: { view: CanonView; onPause: () => void }) {
  const time = formatClock(view.timeLeftS);
  return (
    <section
      className="mar-canon-hud"
      data-testid="mar-canon-hud"
      data-estado={view.status}
      aria-label={msg('mar.canon.hud.aria')}
    >
      <div className="mar-canon-hud__row">
        <BetaTag />
        <span
          className="mar-canon-hud__time"
          data-testid="mar-canon-tiempo"
          data-segundos={view.timeLeftS}
          role="timer"
          aria-live="off"
          aria-label={msg('mar.canon.hud.tiempo', { tiempo: time })}
        >
          {time}
        </span>
        <button
          type="button"
          className="mar-canon-pause"
          data-testid="mar-canon-pausa"
          aria-label={msg('mar.canon.pausa.aria')}
          title={msg('mar.canon.pausa')}
          onClick={onPause}
        >
          <span aria-hidden="true" className="mar-canon-pause__icon" />
        </button>
      </div>
      <div className="mar-canon-hud__level">
        <span className="mar-canon-hud__lv" data-testid="mar-canon-nivel" data-nivel={view.level}>
          {msg('mar.canon.hud.nivel', { nivel: view.level })}
        </span>
        <span
          className="mar-canon-xp"
          role="progressbar"
          aria-label={msg('mar.canon.hud.xp', { siguiente: view.level + 1 })}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={view.xpPct}
        >
          <span className="mar-canon-xp__fill" style={{ width: `${view.xpPct}%` }} />
        </span>
      </div>
      {view.flameS > 0 ? (
        <div
          className="mar-canon-hud__llama"
          data-testid="mar-canon-llama"
          data-segundos={view.flameS}
          role="status"
          aria-label={msg('mar.canon.llama.aria', { s: view.flameS })}
        >
          <span aria-hidden="true">{FLAME_ICON}</span>
          <span aria-hidden="true">{msg('mar.canon.llama', { s: view.flameS })}</span>
          <span className="mar-canon-llama-bar" aria-hidden="true">
            <span className="mar-canon-llama-bar__fill" style={{ width: `${view.flamePct}%` }} />
          </span>
        </div>
      ) : null}
    </section>
  );
}

/**
 * La fila pequena de armas y vinilos con su nivel (T130): abajo en
 * escritorio, arriba a la izquierda (bajo el minimapa) en el movil, para no
 * chocar con los mandos tactiles, con la cuenta atras ni con «Entradas».
 */
function CanonSlots({ slots }: { slots: SlotsView }) {
  return (
    <section
      className="mar-canon-slots"
      data-testid="mar-canon-equipo"
      aria-label={msg('mar.canon.equipo.aria')}
    >
      <SlotRow kind="armas" label={msg('mar.canon.equipo.armas')} items={slots.weapons} />
      <SlotRow kind="vinilos" label={msg('mar.canon.equipo.vinilos')} items={slots.vinyls} />
      {slots.salvavidas ? (
        <span
          className="mar-canon-slots__life"
          data-testid="mar-canon-salvavidas"
          role="img"
          aria-label={msg('mar.canon.equipo.salvavidas')}
          title={msg('mar.canon.equipo.salvavidas')}
        >
          {SALVAVIDAS_ICON}
        </span>
      ) : null}
    </section>
  );
}

function SlotRow({ kind, label, items }: { kind: string; label: string; items: SlotView[] }) {
  return (
    <ul className="mar-canon-slots__row" data-fila={kind} aria-label={label}>
      {items.map((it, i) => {
        const name = it.name ? msg(it.name) : '';
        const text = !it.id
          ? msg('mar.canon.equipo.hueco')
          : it.evolved
            ? msg('mar.canon.equipo.evolucionada', { nombre: name })
            : msg('mar.canon.equipo.nivel', { nombre: name, n: it.level, max: it.maxLevel });
        return (
          <li
            key={`${i}:${it.id ?? ''}`}
            className={`mar-canon-slot${it.id ? '' : ' is-empty'}${it.evolved ? ' is-evolved' : ''}${
              it.id && it.level >= it.maxLevel ? ' is-max' : ''
            }`}
            data-testid="mar-canon-hueco"
            data-id={it.id ?? ''}
            data-nivel={it.level}
            title={text}
            aria-label={text}
          >
            {it.id ? (
              <>
                <span aria-hidden="true" className="mar-canon-slot__icon">
                  {it.icon}
                </span>
                <span aria-hidden="true" className="mar-canon-slot__lv">
                  {it.evolved ? '★' : it.level}
                </span>
              </>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * El agua a bordo, bajo el barco (como en Vampire Survivors): el motor la
 * coloca y la sigue en cada fotograma (`Mar3D.anchor`). Además del color,
 * el dibujo de la barra cambia con el peligro y lleva marcas cada cuarto.
 */
function CanonWater({ pct, engineRef }: { pct: number; engineRef: RefObject<Mar3D | null> }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const g = engineRef.current;
    const el = ref.current;
    if (!g || !el) return;
    g.anchor(el, 'ship', WATER_DY);
    return () => g.release(el);
  }, [engineRef]);
  const level = waterLevelOf(pct);
  return (
    <div
      ref={ref}
      className={`mar-canon-water is-${level}`}
      data-testid="mar-canon-agua"
      data-pct={pct}
      data-nivel={level}
      role="meter"
      aria-label={msg('mar.canon.agua')}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-valuetext={msg('mar.canon.agua.valor', { pct })}
    >
      <span className="mar-canon-water__drop" aria-hidden="true" />
      <span className="mar-canon-water__track">
        <span className="mar-canon-water__fill" style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}

/** El icono de la carta del cofre de un miniboss (T139). */
const CHEST_ICON = '🎁';

/**
 * Las cartas de nivel: 1 de 3, grandes, con el dedo o con el teclado
 * (flechas o 1–n para moverse, Intro o espacio para elegir). Mientras están
 * abiertas la partida espera (la simulación lo cuenta como pausa). Un
 * momento al abrirse no se puede elegir, para no elegir sin querer.
 */
export function CanonCards({
  card,
  capacity,
  onChoose,
}: {
  card: LevelUpCard;
  capacity: number;
  onChoose: (index: number) => void;
}) {
  const titleId = useId();
  const [focused, setFocused] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const armedAt = useRef(0);
  const chosen = useRef(false);
  const count = card.options.length;
  // La carta del cofre de un miniboss (T139): una sola opción, gratis.
  const chest = card.source === 'chest';

  const pick = useCallback(
    (index: number) => {
      if (chosen.current || performance.now() < armedAt.current) return;
      chosen.current = true;
      onChoose(index);
    },
    [onChoose],
  );

  // Una carta nueva: el foco a la primera, armada en un momento.
  useEffect(() => {
    chosen.current = false;
    armedAt.current = performance.now() + CARD_ARM_MS;
    setFocused(0);
    const before = document.activeElement as HTMLElement | null;
    buttons.current[0]?.focus({ preventScroll: true });
    return () => {
      if (before && before.isConnected && before !== document.body) {
        before.focus({ preventScroll: true });
      }
    };
  }, [card]);

  // El teclado es de las cartas mientras están: no llega al barco.
  const focusedRef = useRef(focused);
  focusedRef.current = focused;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const action = cardKeyAction(e.key, focusedRef.current, count);
      if (!action) return;
      e.preventDefault();
      e.stopPropagation();
      if (action.kind === 'choose') {
        if (!e.repeat) pick(action.index);
        return;
      }
      if (e.repeat) return;
      setFocused(action.index);
      buttons.current[action.index]?.focus({ preventScroll: true });
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [count, pick]);

  return (
    <div
      className={`mar-canon-cards${chest ? ' is-chest' : ''}`}
      data-testid="mar-canon-cartas"
      data-nivel={card.level}
      data-origen={chest ? 'cofre' : 'nivel'}
    >
      <section className="mar-canon-cards__box" role="dialog" aria-labelledby={titleId}>
        <header className="mar-canon-cards__head">
          {chest ? (
            <span className="mar-canon-cards__chest" aria-hidden="true">
              {CHEST_ICON}
            </span>
          ) : null}
          <h2 id={titleId}>
            {chest ? msg('mar.canon.cofre.titulo') : msg('mar.canon.cartas.titulo', { nivel: card.level })}
          </h2>
          <p>{chest ? msg('mar.canon.cofre.elige') : msg('mar.canon.cartas.elige')}</p>
        </header>
        <div className="mar-canon-cards__list" role="group" aria-labelledby={titleId}>
          {card.options.map((o, i) => {
            const v = cardView(o);
            return (
              <button
                key={v.id}
                ref={(el) => {
                  buttons.current[i] = el;
                }}
                type="button"
                className={`mar-canon-card is-${v.kind}${chest ? ' is-chest' : ''}${i === focused ? ' is-focused' : ''}`}
                data-testid="mar-canon-carta"
                data-mejora={o.upgrade}
                data-carta={v.id}
                data-tipo={v.kind}
                data-indice={i}
                aria-keyshortcuts={String(i + 1)}
                onFocus={() => setFocused(i)}
                onClick={() => pick(i)}
              >
                <span className="mar-canon-card__key" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="mar-canon-card__icon" aria-hidden="true">
                  {v.icon}
                </span>
                <span className="mar-canon-card__text">
                  <span className="mar-canon-card__tag">{msg(v.tag)}</span>
                  <strong className="mar-canon-card__name">{msg(v.title)}</strong>
                  <span className="mar-canon-card__effect">
                    {msg(v.effect, { amount: cardAmount(o), capacidad: capacity })}
                  </span>
                  <span className="mar-canon-card__stack">
                    <span className="mar-canon-card__pips" aria-hidden="true">
                      {Array.from({ length: v.maxLevel }, (_, k) => (
                        <span
                          key={k}
                          className={
                            k < v.level - 1 ? 'is-had' : k === v.level - 1 ? 'is-new' : ''
                          }
                        />
                      ))}
                    </span>
                    {v.evolution
                      ? msg('mar.canon.cartas.maximo')
                      : v.fresh
                        ? msg('mar.canon.cartas.nueva')
                        : msg('mar.canon.cartas.nivel', { n: v.level, max: v.maxLevel })}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="mar-canon-cards__help">
          {count > 1
            ? msg('mar.canon.cartas.ayuda', { n: Math.min(count, 9) })
            : msg('mar.canon.cartas.ayuda.una')}
        </p>
      </section>
    </div>
  );
}

/** La pantalla final: «¡Amanece!» o «¡Barco inundado!», el tiempo, enemigos y notas. */
function CanonEnd({
  result,
  prize,
  reward,
  onAgain,
  onBack,
}: {
  result: CanonResult;
  prize: CanonMode['prize'];
  reward: CanonMode['reward'];
  onAgain: () => void;
  onBack: () => void;
}) {
  const titleId = useId();
  const again = useRef<HTMLButtonElement>(null);
  useEffect(() => again.current?.focus({ preventScroll: true }), []);
  const keys = END_KEYS[result.reason];
  const line = prizeLine(reward);
  return (
    <div className="mar-canon-endwrap">
      <section
        className={`mar-canon-end is-${result.reason}`}
        data-testid="mar-canon-final"
        data-fin={result.reason}
        role="dialog"
        aria-labelledby={titleId}
      >
        <div className="mar-canon-end__sky" aria-hidden="true" />
        <h2 id={titleId} className="mar-canon-end__title">
          {msg(keys.title)}
        </h2>
        <p className="mar-canon-end__line">{msg(keys.line)}</p>
        <dl className="mar-canon-end__stats">
          <div>
            <dt>{msg('mar.canon.fin.tiempo')}</dt>
            <dd data-testid="mar-canon-final-tiempo">{formatPlayed(result.playedS)}</dd>
          </div>
          <div>
            <dt>{msg('mar.canon.fin.enemigos')}</dt>
            <dd data-testid="mar-canon-final-enemigos">{result.defeated}</dd>
          </div>
          <div>
            <dt>{msg('mar.canon.fin.notas')}</dt>
            <dd data-testid="mar-canon-final-notas">{result.notes}</dd>
          </div>
        </dl>
        <p className="mar-canon-end__level">
          {msg('mar.canon.fin.nivel', { nivel: result.level })}
        </p>
        {/* El premio (T119): «+150 puntos y +50 monedas», o por qué no. */}
        <p
          className="mar-canon-end__prize"
          data-testid="mar-canon-final-premio"
          data-premio={prize ?? undefined}
          role="status"
        >
          {line ? msg(line.key, line.params) : null}
        </p>
        <div className="mar-canon-end__actions">
          <button
            type="button"
            className="mar-canon-end__back"
            data-testid="mar-canon-volver"
            onClick={onBack}
          >
            {msg('mar.canon.fin.volver')}
          </button>
          <button
            ref={again}
            type="button"
            className="mar-canon-end__again"
            data-testid="mar-canon-otra"
            onClick={onAgain}
          >
            {msg('mar.canon.fin.otra')}
          </button>
        </div>
      </section>
    </div>
  );
}

/** El aviso corto de una partida que se abandonó por estar más de 5 minutos en pausa. */
function CanonNotice({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onClose, NOTICE_MS);
    return () => window.clearTimeout(id);
  }, [onClose]);
  return (
    <div className="mar-canon-notice" role="status">
      <div className="mar-chip mar-canon-notice__chip" data-testid="mar-canon-aviso">
        <span>{msg('mar.canon.abandono')}</span>
        <button
          type="button"
          className="mar-chip__x"
          aria-label={msg('mar.canon.abandono.cerrar')}
          onClick={onClose}
        >
          ×
        </button>
      </div>
    </div>
  );
}

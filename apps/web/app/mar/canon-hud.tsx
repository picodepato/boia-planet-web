'use client';

import type { BossId, LevelUpCard } from '@boia/engine/survivors';
import { type RefObject, useCallback, useEffect, useId, useRef, useState } from 'react';
import { t as msg } from '../../lib/i18n';
import { CanonIcon } from './canon-icons';
import type { CanonMode } from './canon-mode';
import { CanonEndRanking, CanonEndScore } from './canon-ranking';
import { CanonReadoutMenu } from './canon-readout-menu';
import {
  BOSS_BANNER_MS,
  BOSS_NOTICE_KEYS,
  type BossBarView,
  type BossNotice,
  CARD_ARM_MS,
  CHEST_ICON,
  type CanonResult,
  type CanonView,
  endCardModel,
  FLAME_ICON,
  SALVAVIDAS_ICON,
  type SlotView,
  type SlotsView,
  bossBarView,
  bossNotices,
  canonView,
  noticeActive,
  sameBossBar,
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
 * amanecer, el nivel con su barra (con el botón de
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

/** El boss que se enseña, si sale de la pantalla y los avisos vivos (T143). */
interface BossHud {
  bar: BossBarView | null;
  offscreen: boolean;
  notices: readonly BossNotice[];
}
const NO_BOSS: BossHud = { bar: null, offscreen: false, notices: [] };

/** ¿El boss está fuera de la vista? La pantalla lo apunta en el lienzo (`data-canon-boss-vista`). */
function bossOffscreen(bar: BossBarView | null): boolean {
  if (!bar) return false;
  const el = document.querySelector<HTMLElement>('[data-testid="mar-canvas"]');
  const vista = el?.dataset.canonBossVista;
  if (vista === undefined) return bar.far;
  return !vista.split(' ').some((v) => v.split(':')[0] === bar.boss);
}

/** Lo que el HUD pinta, leído de la partida unas veces por segundo. */
function useCanonView(canon: CanonMode): {
  view: CanonView | null;
  slots: SlotsView | null;
  boss: BossHud;
} {
  const [state, setState] = useState<{
    view: CanonView | null;
    slots: SlotsView | null;
    boss: BossHud;
  }>({ view: null, slots: null, boss: NO_BOSS });
  const seen = useRef(new Map<number, { boss: BossId; kind: 'miniboss' | 'boss'; nameKey: string }>());
  const read = canon.read;
  const on = canon.active && !canon.result;
  useEffect(() => {
    if (!on) {
      seen.current.clear();
      setState({ view: null, slots: null, boss: NO_BOSS });
      return;
    }
    const tick = () => {
      const s = read();
      const next = s ? canonView(s) : null;
      const now = performance.now();
      const bar = s ? bossBarView(s) : null;
      const fresh = s ? bossNotices(seen.current, s, now) : [];
      if (s) {
        seen.current = new Map(s.bosses.map((b) => [b.id, { boss: b.boss, kind: b.kind, nameKey: b.nameKey }]));
      }
      const offscreen = bossOffscreen(bar);
      setState((prev) => {
        const live = [...prev.boss.notices, ...fresh].filter((n) => noticeActive(n, now));
        const sameNotices =
          live.length === prev.boss.notices.length && live.every((n, i) => n === prev.boss.notices[i]);
        const sameBoss =
          sameNotices && sameBossBar(prev.boss.bar, bar) && prev.boss.offscreen === offscreen;
        if (sameView(prev.view, next) && sameBoss) return prev;
        return {
          view: next,
          slots: s ? slotsView(s) : null,
          boss: sameBoss ? prev.boss : { bar, offscreen, notices: live },
        };
      });
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
  const { view, slots, boss } = useCanonView(canon);

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
      <CanonAnnouncer view={view} notices={boss.notices} result={canon.result} />
      {view ? <CanonReadoutMenu covered={covered} /> : null}
      {view ? <CanonHud view={view} bar={boss.bar} onPause={onPause} /> : null}
      {view && boss.bar && boss.offscreen ? <BossArrow bar={boss.bar} /> : null}
      {view && boss.notices.length ? <BossBanner notice={boss.notices[boss.notices.length - 1]!} /> : null}
      {view && slots ? <CanonSlots slots={slots} bossOn={!!boss.bar} /> : null}

      {view ? <CanonWater pct={view.waterPct} engineRef={engineRef} /> : null}
      {view?.card && !covered ? (
        <CanonCards card={view.card} capacity={view.waterCapacity} onChoose={canon.choose} />
      ) : null}
      {canon.result && !covered ? (
        <CanonEnd
          result={canon.result}
          unlocked={canon.unlocked}
          prize={canon.prize}
          reward={canon.reward}
          ranking={canon.ranking}
          onAgain={canon.again}
          onBack={canon.backToSea}
        />
      ) : null}
      {canon.notice ? <CanonNotice onClose={canon.dismissNotice} /> : null}
      {canon.fading ? <div className="mar-canon-fade" aria-hidden="true" /> : null}
    </>
  );
}

/**
 * Los avisos para lectores de pantalla (T152): subir de nivel (o abrir un
 * cofre), la llegada de un boss y el resultado. Una región `aria-live` que
 * está siempre en la página (las que aparecen de golpe no siempre se leen) y
 * no se ve.
 */
function CanonAnnouncer({
  view,
  notices,
  result,
}: {
  view: CanonView | null;
  notices: readonly BossNotice[];
  result: CanonResult | null;
}) {
  const [text, setText] = useState('');
  const card = view?.card ?? null;
  const arrival = [...notices].reverse().find((n) => n.kind === 'arrival') ?? null;
  const seen = useRef({ card, arrival });
  seen.current = { card, arrival };
  // Sólo cuando se abre otra carta o llega otro boss, no en cada lectura de la partida.
  const cardKey = card ? `${card.level}:${card.source}` : '';
  const arrivalKey = arrival ? `${arrival.boss}:${arrival.atMs}` : '';
  useEffect(() => {
    const c = seen.current.card;
    if (!c) return;
    setText(
      c.source === 'chest'
        ? msg('mar.canon.anuncio.cofre')
        : msg('mar.canon.anuncio.nivel', { nivel: c.level }),
    );
  }, [cardKey]);
  useEffect(() => {
    const a = seen.current.arrival;
    if (!a) return;
    setText(msg(BOSS_NOTICE_KEYS.arrival, { nombre: msg(a.nameKey) }));
  }, [arrivalKey]);
  useEffect(() => {
    if (!result) return;
    const end = endCardModel(result);
    setText(
      result.reason === 'quit'
        ? msg(end.title)
        : `${msg(end.title)}. ${msg(end.medal.key)}`,
    );
  }, [result]);
  return (
    <div
      className="mar-canon-sr"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="mar-canon-anuncio"
    >
      {text}
    </div>
  );
}

/** Arriba al centro: la cuenta atrás, la pausa y, debajo, el nivel con su barra. */
function CanonHud({
  view,
  bar,
  onPause,
}: {
  view: CanonView;
  bar: BossBarView | null;
  onPause: () => void;
}) {
  const time = formatClock(view.timeLeftS);
  return (
    <section
      className="mar-canon-hud"
      data-testid="mar-canon-hud"
      data-estado={view.status}
      aria-label={msg('mar.canon.hud.aria')}
      data-jefe={bar ? bar.kind : undefined}
    >
      <div className="mar-canon-hud__row">
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
      {bar ? <BossBar bar={bar} /> : null}
      {view.flameS > 0 ? (
        <div
          className="mar-canon-hud__llama"
          data-testid="mar-canon-llama"
          data-segundos={view.flameS}
          role="status"
          aria-label={msg('mar.canon.llama.aria', { s: view.flameS })}
        >
          <CanonIcon name={FLAME_ICON} className="mar-canon-hud__llama-icon" />
          <span aria-hidden="true">{msg('mar.canon.llama', { s: view.flameS })}</span>
          <span className="mar-canon-llama-bar" aria-hidden="true">
            <span className="mar-canon-llama-bar__fill" style={{ width: `${view.flamePct}%` }} />
          </span>
        </div>
      ) : null}
    </section>
  );
}

/** Los textos del estado visible de un boss que no recibe daño o está oculto. */
const BOSS_STATE_KEYS = {
  ghost: 'mar.canon.boss.estado.fantasma',
  shielded: 'mar.canon.boss.estado.escudo',
  submerged: 'mar.canon.boss.estado.sumergido',
  exposed: 'mar.canon.boss.estado.expuesto',
} as const;

/** La barra del boss, dentro del HUD de arriba (nunca tapa el resto): nombre, vida, marcas de fase y estado. */
export function BossBar({ bar }: { bar: BossBarView }) {
  const name = msg(bar.nameKey);
  const stateKey = bar.state === 'normal' ? null : BOSS_STATE_KEYS[bar.state];
  return (
    <div
      className={`mar-canon-boss is-${bar.kind} is-${bar.state}`}
      data-testid="mar-canon-jefe"
      data-jefe={bar.boss}
      data-tipo={bar.kind}
      data-estado={bar.state}
      data-vida={bar.hpPct}
      data-fase={bar.phase + 1}
    >
      <div className="mar-canon-boss__head">
        <span className="mar-canon-boss__name" data-testid="mar-canon-jefe-nombre">
          {name}
        </span>
        {stateKey ? (
          <span className="mar-canon-boss__state" data-testid="mar-canon-jefe-estado">
            {msg(stateKey)}
          </span>
        ) : null}
        {bar.phaseCount > 1 ? (
          <span className="mar-canon-boss__phase">
            {msg('mar.canon.boss.fase', { n: bar.phase + 1, total: bar.phaseCount })}
          </span>
        ) : null}
      </div>
      <span
        className="mar-canon-boss__bar"
        role="progressbar"
        aria-label={msg('mar.canon.boss.vida', { nombre: name })}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={bar.hpPct}
      >
        <span className="mar-canon-boss__fill" style={{ width: `${bar.hpPct}%` }} />
        {bar.marks.map((m) => (
          <span key={m} className="mar-canon-boss__mark" style={{ left: `${m}%` }} aria-hidden="true" />
        ))}
      </span>
    </div>
  );
}

/** El aviso grande bajo el HUD: llega, huye o cae un boss. Se quita solo (el estado lo filtra). */
function BossBanner({ notice }: { notice: BossNotice }) {
  const name = msg(notice.nameKey);
  return (
    <div
      className={`mar-canon-boss-banner is-${notice.kind} is-${notice.bossKind}`}
      data-testid="mar-canon-jefe-aviso"
      data-aviso={notice.kind}
      data-jefe={notice.boss}
      role="status"
      style={{ animationDuration: `${BOSS_BANNER_MS}ms` }}
    >
      {msg(BOSS_NOTICE_KEYS[notice.kind], { nombre: name })}
    </div>
  );
}

/** La flecha en el borde de la pantalla hacia un boss fuera de vista (desde el centro, hacia su ángulo). */
function BossArrow({ bar }: { bar: BossBarView }) {
  const rad = (bar.angleDeg * Math.PI) / 180;
  const cx = Math.cos(rad);
  const cy = Math.sin(rad);
  // Sobre una elipse inscrita en la pantalla (el 38 % del ancho y el 34 % del alto): lejos de los bordes con mandos.
  const left = 50 + cx * 38;
  const top = 50 + cy * 34;
  return (
    <div
      className={`mar-canon-boss-arrow is-${bar.kind}`}
      data-testid="mar-canon-jefe-flecha"
      data-angulo={bar.angleDeg}
      style={{ left: `${left}%`, top: `${top}%` }}
      role="img"
      aria-label={msg('mar.canon.boss.flecha', { nombre: msg(bar.nameKey) })}
    >
      <span className="mar-canon-boss-arrow__tip" style={{ rotate: `${bar.angleDeg}deg` }} aria-hidden="true" />
    </div>
  );
}

/**
 * Las armas y los vinilos con su nivel (T130) y la Segunda vida: arriba a la
 * derecha, en el sitio de los saldos, que se apartan durante la partida
 * (T148), en el móvil y en escritorio; sin chocar con la pausa, el menú, el
 * agua a bordo, la barra del boss, el minimapa ni «Entradas».
 */
function CanonSlots({ slots, bossOn }: { slots: SlotsView; bossOn: boolean }) {
  return (
    <section
      className={bossOn ? 'mar-canon-slots is-boss-on' : 'mar-canon-slots'}
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
          <CanonIcon name={SALVAVIDAS_ICON} />
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
            {it.id && it.icon ? (
              <>
                <CanonIcon name={it.icon} className="mar-canon-slot__icon" />
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
              <CanonIcon name={CHEST_ICON} />
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
                  <CanonIcon name={v.icon} />
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

/**
 * La pantalla final: «¡Amanece!» o «¡Barco inundado!», el tiempo, enemigos y
 * notas. Con «Terminar partida» (T148), «Partida terminada» sólo con el
 * tiempo, los enemigos y las notas: sin medalla, equipo ni premio.
 */
function CanonEnd({
  result,
  unlocked,
  prize,
  reward,
  ranking = null,
  onAgain,
  onBack,
}: {
  result: CanonResult;
  unlocked: number | null;
  prize: CanonMode['prize'];
  reward: CanonMode['reward'];
  /** El ranking de la partida (T155): puntuación, tu mejor y tu puesto. */
  ranking?: CanonMode['ranking'];
  onAgain: () => void;
  onBack: () => void;
}) {
  const titleId = useId();
  const again = useRef<HTMLButtonElement>(null);
  useEffect(() => again.current?.focus({ preventScroll: true }), []);
  const card = endCardModel(result, unlocked);
  const line = prizeLine(reward);
  // «Terminar partida» (T148): la tarjeta corta.
  const full = result.reason !== 'quit';
  return (
    <div className="mar-canon-endwrap">
      <section
        className={`mar-canon-end is-${result.reason}`}
        data-testid="mar-canon-final"
        data-fin={result.reason}
        data-ranking={result.ranked ? 'si' : 'no'}
        role="dialog"
        aria-labelledby={titleId}
      >
        <div className="mar-canon-end__sky" aria-hidden="true" />
        <h2 id={titleId} className="mar-canon-end__title">
          {msg(card.title)}
        </h2>
        <p className="mar-canon-end__line">{msg(card.line)}</p>
        {full ? (
          <>
            <p
              className="mar-canon-end__medal"
              data-testid="mar-canon-final-medalla"
              data-medalla={card.medal.id ?? 'ninguna'}
            >
              {msg(card.medal.key)}
            </p>
            <p className="mar-canon-end__run" data-testid="mar-canon-final-partida">
              {msg('mar.canon.fin.partida', {
                acto: card.act.n,
                dificultad: msg(card.difficulty),
              })}
            </p>
            {card.unlock ? (
              <p
                className="mar-canon-end__unlock"
                data-testid="mar-canon-final-desbloqueo"
                data-acto={card.unlock.n}
                role="status"
              >
                {msg(card.unlock.key, { n: card.unlock.n })}
              </p>
            ) : null}
          </>
        ) : null}
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
          {full && ranking ? <CanonEndScore ranking={ranking} /> : null}
        </dl>
        {full ? (
          <>
            <p className="mar-canon-end__level">
              {msg('mar.canon.fin.nivel', { nivel: result.level })}
            </p>
            <div
              className="mar-canon-end__gear"
              data-testid="mar-canon-final-equipo"
              role="group"
              aria-label={msg('mar.canon.fin.equipo')}
            >
              {[...result.weapons, ...result.vinyls].map((g) => (
                <span
                  key={g.id}
                  className={`mar-canon-end__item${g.evolved ? ' is-evolved' : ''}`}
                  data-item={g.id}
                >
                  <CanonIcon name={g.icon} className="mar-canon-end__item-icon" />
                  {msg('mar.canon.fin.nivelitem', { nombre: msg(g.name), nivel: g.level })}
                </span>
              ))}
            </div>
            <p className="mar-canon-end__bosses" data-testid="mar-canon-final-bosses">
              <span>{msg('mar.canon.fin.bosses')}: </span>
              {card.bosses.length
                ? card.bosses.map((k) => msg(k)).join(', ')
                : msg('mar.canon.fin.bosses.ninguno')}
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
            {ranking ? <CanonEndRanking ranking={ranking} /> : null}
          </>
        ) : null}
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

'use client';

import {
  type DefenseResult,
  type DefenseSpawn,
  type DefenseTowerKind,
  defenseSchedule,
} from '@boia/engine/defense';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { t as msg } from '../../lib/i18n';
import { BossBar } from './canon-hud';
import type { BossBarView } from './canon-hud-model';
import { GameSoundMenu } from './canon-readout-menu';
import type { DefenseRun } from './castillo';
import {
  type BuildOption,
  CASTLE_NOTICE_KEYS,
  type CastleBossNotice,
  type CastleView,
  type Line,
  type PlacementView,
  TOWER_NAME_KEYS,
  type TowerPanelView,
  buildOptions,
  castleEndView,
  castleView,
  defenseBossBar,
  defenseBossNotices,
  formatClock,
  levelLine,
  placementView,
  planeLine,
  sameCastleView,
  seenBosses,
  sellLine,
  towerPanel,
  upgradeLine,
} from './castillo-hud-model';
import { CastleIcon, TOWER_ICON } from './castillo-icons';
import type { CastleMode } from './castillo-mode';
import { castlePairLabel } from './castillo-previa';
import './castillo-hud.css';
import { CastleEndRanking } from './castillo-ranking';

/**
 * La interfaz de «Defensa del Castillo» en `/mar` (plan 014 T161), con el
 * estilo del HUD del Cañón (plan 013): arriba al centro el tiempo y la
 * pausa, la vida del castillo, la oleada y las monedas (y la barra del boss
 * del Cañón); abajo, encima de «Entradas», una sola franja que cambia:
 * «Construir» y el avión → las siete islas con su precio → la isla que se
 * coloca (verde o roja con el motivo, Cancelar / Construir) → la ficha de
 * una isla construida (nivel, Mejorar, Vender). Con el teclado: B construir,
 * 1–7 elegir isla, Intro colocar, I elegir la isla más cercana al avión
 * (otra vez: la siguiente), U mejorar, V vender, Esc atrás o pausa; las
 * flechas siguen llevando el avión. Con el dedo, un toque en el agua mueve la
 * isla que se coloca o elige la isla tocada (`DefenseRun.tap`).
 */

/** Cada cuánto se lee la partida para el HUD (ms); sólo se repinta si cambia. */
const READ_MS = 100;
/** Cuánto se queda el aviso de un boss (ms). */
const BANNER_MS = 3500;

interface HudState {
  view: CastleView | null;
  bar: BossBarView | null;
  placing: DefenseTowerKind | null;
  placement: PlacementView | null;
  panel: TowerPanelView | null;
  notices: readonly CastleBossNotice[];
}

const EMPTY: HudState = {
  view: null,
  bar: null,
  placing: null,
  placement: null,
  panel: null,
  notices: [],
};

function sameState(a: HudState, b: HudState): boolean {
  const pa = a.placement;
  const pb = b.placement;
  const ta = a.panel;
  const tb = b.panel;
  return (
    a.view === b.view &&
    a.placing === b.placing &&
    (pa === pb || (!!pa && !!pb && pa.ok === pb.ok && pa.key === pb.key && pa.cost === pb.cost)) &&
    (ta === tb ||
      (!!ta &&
        !!tb &&
        ta.id === tb.id &&
        ta.level === tb.level &&
        ta.canUpgrade === tb.canUpgrade &&
        ta.sellValue === tb.sellValue)) &&
    (a.bar === b.bar ||
      (!!a.bar && !!b.bar && a.bar.id === b.bar.id && a.bar.hpPct === b.bar.hpPct)) &&
    a.notices === b.notices
  );
}

/** Lo que el HUD pinta, leído de la partida unas veces por segundo. */
function useCastleHud(castle: CastleMode): HudState {
  const [state, setState] = useState<HudState>(EMPTY);
  const schedule = useRef<{ run: DefenseRun; list: DefenseSpawn[] } | null>(null);
  const seen = useRef<{
    bosses: ReturnType<typeof seenBosses>;
    defeated: readonly string[];
  } | null>(null);
  const on = castle.active && !castle.result;
  const { read, run: getRun } = castle;
  useEffect(() => {
    if (!on) {
      seen.current = null;
      setState(EMPTY);
      return;
    }
    const tick = () => {
      const run = getRun();
      const s = read();
      if (!run || !s) return;
      if (schedule.current?.run !== run) {
        schedule.current = { run, list: defenseSchedule(run.config, s.runMin, s.difficulty) };
        seen.current = null;
      }
      const now = performance.now();
      const fresh = seen.current
        ? defenseBossNotices(seen.current.bosses, seen.current.defeated, s, now)
        : [];
      seen.current = { bosses: seenBosses(s), defeated: [...s.bossesDefeated] };
      const view = castleView(s, schedule.current.list);
      const pl = run.placement(s);
      setState((prev) => {
        const notices = [...prev.notices, ...fresh].filter((n) => now - n.atMs < BANNER_MS);
        const sameNotices =
          notices.length === prev.notices.length && notices.every((n, i) => n === prev.notices[i]);
        const next: HudState = {
          view: sameCastleView(prev.view, view) ? prev.view : view,
          bar: defenseBossBar(s),
          placing: run.placing?.kind ?? null,
          placement: pl ? placementView(pl.check) : null,
          panel: towerPanel(run.config, s, run.selected),
          notices: sameNotices ? prev.notices : notices,
        };
        return sameState(prev, next) ? prev : next;
      });
    };
    tick();
    const id = window.setInterval(tick, READ_MS);
    return () => window.clearInterval(id);
  }, [on, read, getRun]);
  return state;
}

const say = (l: Line) => msg(l.key, l.params);

/**
 * Todo lo del castillo encima del mar. `covered`: el menú o un panel encima
 * (la partida en pausa; el teclado es suyo). `onPause`: la pausa y Esc abren
 * el menú de `/mar`, con el sonido y «Terminar partida».
 */
export function CastleLayer({
  castle,
  covered,
  onPause,
}: {
  castle: CastleMode;
  covered: boolean;
  onPause: () => void;
}) {
  const hud = useCastleHud(castle);
  const [tray, setTray] = useState(false);
  const playing = castle.active && !castle.result;
  const { view, placing, placement, panel } = hud;
  const run = castle.run;

  // Sin partida, la franja de abajo vuelve a empezar cerrada.
  useEffect(() => {
    if (!playing) setTray(false);
  }, [playing]);
  // La lista abierta lleva la cámara a la vista de salida (plan 015 T170).
  useEffect(() => {
    run()?.setBuildMenu(tray);
  }, [tray, run, playing]);

  // El foco, al cambiar lo que enseña la franja (para seguir con el teclado).
  const dock = useRef<HTMLDivElement>(null);
  const focusIn = useCallback((selector: string) => {
    window.requestAnimationFrame(() =>
      dock.current?.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true }),
    );
  }, []);

  const openTray = useCallback(() => {
    run()?.cancelPlacing();
    run()?.select(null);
    setTray(true);
  }, [run]);
  const closeTray = useCallback(() => setTray(false), []);
  const choose = useCallback(
    (o: BuildOption) => {
      if (!o.affordable) return;
      run()?.startPlacing(o.kind);
      setTray(false);
    },
    [run],
  );
  const cancel = useCallback(() => run()?.cancelPlacing(), [run]);
  const confirm = useCallback(() => run()?.confirmPlacing() ?? false, [run]);
  const closePanel = useCallback(() => run()?.select(null), [run]);
  const upgrade = useCallback(() => run()?.upgradeSelected(), [run]);
  const sell = useCallback(() => run()?.sellSelected(), [run]);
  const upgradePlane = useCallback(() => run()?.upgradePlane(), [run]);

  // El teclado de la partida (las flechas son del avión, en el motor).
  const latest = useRef({ covered, onPause, tray, view, placing, panel, castle });
  latest.current = { covered, onPause, tray, view, placing, panel, castle };
  useEffect(() => {
    if (!castle.active) return;
    const onKey = (e: KeyboardEvent) => {
      const l = latest.current;
      const r = run();
      if (l.covered || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      // En la tarjeta final, Esc vuelve al mar.
      if (l.castle.result) {
        if (e.key === 'Escape') {
          e.preventDefault();
          l.castle.leave();
        }
        return;
      }
      if (!r || r.ended) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const onButton = tag === 'BUTTON';
      if (k === 'Escape') {
        e.preventDefault();
        if (r.placing) {
          r.cancelPlacing();
          focusIn('[data-testid="mar-castillo-construir"]');
        } else if (l.tray) {
          setTray(false);
          focusIn('[data-testid="mar-castillo-construir"]');
        } else if (r.selected !== null) r.select(null);
        else l.onPause();
        return;
      }
      if (e.repeat) return;
      if (k === 'b') {
        e.preventDefault();
        if (l.tray) setTray(false);
        else {
          r.cancelPlacing();
          r.select(null);
          setTray(true);
          focusIn('[data-testid="mar-castillo-isla"]:not([aria-disabled="true"])');
        }
      } else if (l.tray && /^[1-9]$/.test(k)) {
        const o = l.view ? buildOptions(r.config, l.view.coins)[Number(k) - 1] : undefined;
        if (!o) return;
        e.preventDefault();
        if (o.affordable) {
          r.startPlacing(o.kind);
          setTray(false);
          focusIn('[data-testid="mar-castillo-colocar-si"]');
        }
      } else if (k === 'Enter' && r.placing && !onButton) {
        e.preventDefault();
        r.confirmPlacing();
      } else if (k === 'i') {
        e.preventDefault();
        setTray(false);
        if (r.selectNext() !== null) focusIn('[data-testid="mar-castillo-mejorar"]');
      } else if (k === 'u' && r.selected !== null) {
        e.preventDefault();
        r.upgradeSelected();
      } else if (k === 'v' && r.selected !== null) {
        e.preventDefault();
        r.sellSelected();
        focusIn('[data-testid="mar-castillo-construir"]');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [castle.active, run, focusIn]);

  const mode: 'idle' | 'tray' | 'placing' | 'tower' = placing
    ? 'placing'
    : tray
      ? 'tray'
      : panel
        ? 'tower'
        : 'idle';
  const last = hud.notices[hud.notices.length - 1] ?? null;

  if (!castle.active) return <CastleAnnouncer view={null} notices={[]} result={null} />;
  return (
    <>
      <CastleAnnouncer view={view} notices={hud.notices} result={castle.result} />
      {playing ? <GameSoundMenu covered={covered} /> : null}
      {playing && view ? (
        <div className="mar-castle-top">
          <CastleTop view={view} bar={hud.bar} onPause={onPause} />
          {last ? <CastleBanner notice={last} /> : null}
        </div>
      ) : null}
      {playing && view ? (
        <div
          ref={dock}
          className={`mar-castle-dock is-${mode}`}
          data-testid="mar-castillo-franja"
          data-modo={mode}
        >
          {mode === 'idle' ? (
            <CastleActions view={view} onBuild={openTray} onPlane={upgradePlane} />
          ) : mode === 'tray' ? (
            <CastleTray
              options={buildOptions(castle.run()!.config, view.coins)}
              onChoose={choose}
              onClose={closeTray}
            />
          ) : mode === 'placing' && placing && placement ? (
            <CastlePlacing
              kind={placing}
              placement={placement}
              onCancel={() => {
                cancel();
                focusIn('[data-testid="mar-castillo-construir"]');
              }}
              onConfirm={() => {
                if (confirm()) focusIn('[data-testid="mar-castillo-construir"]');
              }}
            />
          ) : mode === 'tower' && panel ? (
            <CastleTowerPanel
              panel={panel}
              onUpgrade={upgrade}
              onSell={() => {
                sell();
                focusIn('[data-testid="mar-castillo-construir"]');
              }}
              onClose={closePanel}
            />
          ) : null}
        </div>
      ) : null}
      {castle.result && !covered ? (
        <CastleEnd
          result={castle.result}
          record={castle.record}
          ranking={castle.ranking}
          onAgain={castle.again}
          onBack={castle.leave}
        />
      ) : null}
    </>
  );
}

/**
 * Los avisos para lectores de pantalla: empieza una oleada, llega un boss y
 * el resultado. Una región `aria-live` siempre en la página, que no se ve.
 */
function CastleAnnouncer({
  view,
  notices,
  result,
}: {
  view: CastleView | null;
  notices: readonly CastleBossNotice[];
  result: DefenseResult | null;
}) {
  const [text, setText] = useState('');
  const wave = view?.wave ?? 0;
  const arrival = [...notices].reverse().find((n) => n.kind === 'arrival') ?? null;
  const arrivalRef = useRef(arrival);
  arrivalRef.current = arrival;
  const arrivalKey = arrival ? `${arrival.boss}:${arrival.atMs}` : '';
  useEffect(() => {
    if (wave > 0) setText(msg('mar.castillo.anuncio.oleada', { n: wave }));
  }, [wave]);
  useEffect(() => {
    const a = arrivalRef.current;
    if (a) setText(msg(CASTLE_NOTICE_KEYS.arrival, { nombre: msg(a.nameKey) }));
  }, [arrivalKey]);
  useEffect(() => {
    if (result) setText(msg(castleEndView(result).title));
  }, [result]);
  return (
    <div
      className="mar-canon-sr"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="mar-castillo-anuncio"
    >
      {text}
    </div>
  );
}

/** Arriba al centro: el tiempo y la pausa; la vida del castillo; la oleada y las monedas; el boss. */
function CastleTop({
  view,
  bar,
  onPause,
}: {
  view: CastleView;
  bar: BossBarView | null;
  onPause: () => void;
}) {
  const time = formatClock(view.timeLeftS);
  return (
    <section
      className="mar-canon-hud mar-castle-hud"
      data-testid="mar-castillo-hud"
      data-estado={view.status}
      data-jefe={bar ? bar.kind : undefined}
      aria-label={msg('mar.castillo.hud.aria')}
    >
      <div className="mar-canon-hud__row">
        <span
          className="mar-canon-hud__time"
          data-testid="mar-castillo-tiempo"
          data-segundos={view.timeLeftS}
          role="timer"
          aria-live="off"
          aria-label={msg('mar.castillo.hud.tiempo', { tiempo: time })}
        >
          {time}
        </span>
        <button
          type="button"
          className="mar-canon-pause"
          data-testid="mar-castillo-pausa"
          aria-label={msg('mar.canon.pausa.aria')}
          title={msg('mar.canon.pausa')}
          onClick={onPause}
        >
          <span aria-hidden="true" className="mar-canon-pause__icon" />
        </button>
      </div>
      <div
        className={`mar-castle-life is-${view.lifeLevel}`}
        data-testid="mar-castillo-vida"
        data-pct={view.lifePct}
        data-nivel={view.lifeLevel}
        role="meter"
        aria-label={msg('mar.castillo.hud.vida')}
        aria-valuemin={0}
        aria-valuemax={view.maxLife}
        aria-valuenow={view.life}
        aria-valuetext={msg('mar.castillo.hud.vida.valor', { pct: view.lifePct })}
      >
        <CastleIcon name="castillo" className="mar-castle-life__icon" />
        <span className="mar-castle-life__track" aria-hidden="true">
          <span className="mar-castle-life__fill" style={{ width: `${view.lifePct}%` }} />
        </span>
        <span className="mar-castle-life__pct" aria-hidden="true">
          {view.lifePct}
        </span>
      </div>
      <div className="mar-castle-hud__stats">
        <span
          className="mar-castle-stat"
          data-testid="mar-castillo-oleada"
          data-oleada={view.wave}
          aria-label={msg('mar.castillo.hud.oleada.aria', { n: view.wave, total: view.waves })}
        >
          <CastleIcon name="oleada" />
          <span aria-hidden="true">
            {msg('mar.castillo.hud.oleada', { n: view.wave, total: view.waves })}
          </span>
        </span>
        <span
          className="mar-castle-stat is-coins"
          data-testid="mar-castillo-monedas"
          data-monedas={view.coins}
          aria-label={msg('mar.castillo.hud.monedas.aria', { n: view.coins })}
        >
          <CastleIcon name="moneda" />
          <span aria-hidden="true">{view.coins}</span>
        </span>
      </div>
      {bar ? <BossBar bar={bar} /> : null}
    </section>
  );
}

/** El aviso grande bajo el HUD: sale un boss, cae, o golpea la muralla. */
function CastleBanner({ notice }: { notice: CastleBossNotice }) {
  return (
    <div
      key={`${notice.boss}:${notice.atMs}`}
      className={`mar-canon-boss-banner mar-castle-banner is-${notice.kind === 'defeated' ? 'defeated' : notice.kind} is-${notice.bossKind}`}
      data-testid="mar-castillo-jefe-aviso"
      data-aviso={notice.kind}
      data-jefe={notice.boss}
      style={{ animationDuration: `${BANNER_MS}ms` }}
      aria-hidden="true"
    >
      {msg(CASTLE_NOTICE_KEYS[notice.kind], { nombre: msg(notice.nameKey) })}
    </div>
  );
}

/** La franja en reposo: «Construir» y el daño del avión. */
function CastleActions({
  view,
  onBuild,
  onPlane,
}: {
  view: CastleView;
  onBuild: () => void;
  onPlane: () => void;
}) {
  const plane = view.plane;
  const maxed = plane.nextCost === null;
  return (
    <div className="mar-castle-actions">
      <button
        type="button"
        className="mar-castle-btn is-build"
        data-testid="mar-castillo-construir"
        aria-haspopup="true"
        aria-keyshortcuts="B"
        onClick={onBuild}
      >
        <CastleIcon name="construir" className="mar-castle-btn__icon" />
        <span>{msg('mar.castillo.construir')}</span>
      </button>
      <button
        type="button"
        className="mar-castle-btn is-plane"
        data-testid="mar-castillo-avion"
        data-nivel={plane.level}
        aria-disabled={!plane.affordable}
        onClick={() => {
          if (plane.affordable) onPlane();
        }}
      >
        <CastleIcon name="avion" className="mar-castle-btn__icon" />
        <span className="mar-castle-btn__text">
          <span>{msg('mar.castillo.avion', { n: plane.level, max: plane.maxLevel })}</span>
          <small>
            {maxed ? (
              say(planeLine(plane))
            ) : (
              <>
                {say(planeLine(plane))} <CastleIcon name="moneda" className="mar-castle-coin" />
              </>
            )}
          </small>
        </span>
      </button>
    </div>
  );
}

/** «Construir»: las siete islas con su icono y su precio (en gris si no llega el dinero). */
function CastleTray({
  options,
  onChoose,
  onClose,
}: {
  options: BuildOption[];
  onChoose: (o: BuildOption) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  return (
    <section className="mar-castle-tray" data-testid="mar-castillo-islas" aria-labelledby={titleId}>
      <header className="mar-castle-tray__head">
        <h2 id={titleId}>{msg('mar.castillo.construir.titulo')}</h2>
        <p className="mar-castle-tray__help">{msg('mar.castillo.construir.ayuda')}</p>
        <button
          type="button"
          className="mar-castle-x"
          data-testid="mar-castillo-islas-cerrar"
          aria-label={msg('mar.castillo.cerrar')}
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div className="mar-castle-tray__list" role="group" aria-labelledby={titleId}>
        {options.map((o, i) => {
          const name = msg(o.nameKey);
          return (
            <button
              key={o.kind}
              type="button"
              className={`mar-castle-isla${o.affordable ? '' : ' is-poor'}`}
              data-testid="mar-castillo-isla"
              data-isla={o.kind}
              data-coste={o.cost}
              aria-disabled={!o.affordable}
              aria-keyshortcuts={String(i + 1)}
              aria-label={msg(
                o.affordable ? 'mar.castillo.isla.aria' : 'mar.castillo.isla.aria.pobre',
                {
                  nombre: name,
                  coste: o.cost,
                  hace: msg(o.roleKey),
                },
              )}
              title={msg(o.roleKey)}
              onClick={() => onChoose(o)}
            >
              <span className="mar-castle-isla__key" aria-hidden="true">
                {i + 1}
              </span>
              <CastleIcon name={TOWER_ICON[o.kind]} className="mar-castle-isla__icon" />
              <span className="mar-castle-isla__name" aria-hidden="true">
                {name}
              </span>
              <span className="mar-castle-isla__cost" aria-hidden="true">
                <CastleIcon name="moneda" className="mar-castle-coin" />
                {o.cost}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** La isla que se coloca: dónde (verde o roja con el motivo), Cancelar y Construir aquí. */
function CastlePlacing({
  kind,
  placement,
  onCancel,
  onConfirm,
}: {
  kind: DefenseTowerKind;
  placement: PlacementView;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <section
      className={`mar-castle-place ${placement.ok ? 'is-ok' : 'is-bad'}`}
      data-testid="mar-castillo-colocar"
      data-isla={kind}
      data-valido={placement.ok ? 'si' : 'no'}
      data-motivo={placement.reason ?? undefined}
      aria-label={msg('mar.castillo.colocar.aria', { nombre: msg(TOWER_NAME_KEYS[kind]) })}
    >
      <div className="mar-castle-place__info">
        <CastleIcon name={TOWER_ICON[kind]} className="mar-castle-place__icon" />
        <div className="mar-castle-place__text">
          <strong>{msg(TOWER_NAME_KEYS[kind])}</strong>
          <span
            className="mar-castle-place__state"
            data-testid="mar-castillo-colocar-estado"
            role="status"
          >
            <span className="mar-castle-place__mark" aria-hidden="true">
              {placement.ok ? '✓' : '✕'}
            </span>
            {msg(placement.key)}
          </span>
          <small className="mar-castle-place__help">{msg('mar.castillo.colocar.ayuda')}</small>
        </div>
      </div>
      <div className="mar-castle-place__actions">
        <button
          type="button"
          className="mar-castle-btn is-ghost"
          data-testid="mar-castillo-colocar-no"
          aria-keyshortcuts="Escape"
          onClick={onCancel}
        >
          {msg('mar.castillo.cancelar')}
        </button>
        <button
          type="button"
          className="mar-castle-btn is-go"
          data-testid="mar-castillo-colocar-si"
          aria-disabled={!placement.ok}
          aria-keyshortcuts="Enter"
          onClick={onConfirm}
        >
          {msg('mar.castillo.colocar.si')}
          <span className="mar-castle-btn__cost">
            <CastleIcon name="moneda" className="mar-castle-coin" />
            {placement.cost}
          </span>
        </button>
      </div>
    </section>
  );
}

/** La ficha de una isla construida: nivel, lo que hace, Mejorar y Vender. */
function CastleTowerPanel({
  panel,
  onUpgrade,
  onSell,
  onClose,
}: {
  panel: TowerPanelView;
  onUpgrade: () => void;
  onSell: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const maxed = panel.upgradeCost === null;
  return (
    <section
      className="mar-castle-tower"
      data-testid="mar-castillo-ficha"
      data-isla={panel.kind}
      data-id={panel.id}
      data-nivel={panel.level}
      aria-labelledby={titleId}
    >
      <div className="mar-castle-tower__info">
        <CastleIcon name={TOWER_ICON[panel.kind]} className="mar-castle-place__icon" />
        <div className="mar-castle-place__text">
          <strong id={titleId}>{msg(panel.nameKey)}</strong>
          <span className="mar-castle-tower__level" data-testid="mar-castillo-ficha-nivel">
            <span className="mar-castle-pips" aria-hidden="true">
              {Array.from({ length: panel.maxLevel }, (_, k) => (
                <span key={k} className={k < panel.level ? 'is-on' : ''} />
              ))}
            </span>
            {say(levelLine(panel.level, panel.maxLevel))}
          </span>
          <small className="mar-castle-place__help">{msg(panel.roleKey)}</small>
        </div>
        <button
          type="button"
          className="mar-castle-x"
          data-testid="mar-castillo-ficha-cerrar"
          aria-label={msg('mar.castillo.cerrar')}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="mar-castle-place__actions">
        <button
          type="button"
          className="mar-castle-btn is-go"
          data-testid="mar-castillo-mejorar"
          aria-disabled={!panel.canUpgrade}
          aria-keyshortcuts="U"
          onClick={() => {
            if (panel.canUpgrade) onUpgrade();
          }}
        >
          {say(upgradeLine(panel))}
          {maxed ? null : <CastleIcon name="moneda" className="mar-castle-coin" />}
        </button>
        <button
          type="button"
          className="mar-castle-btn is-ghost"
          data-testid="mar-castillo-vender"
          aria-keyshortcuts="V"
          onClick={onSell}
        >
          {say(sellLine(panel))}
          <CastleIcon name="moneda" className="mar-castle-coin" />
        </button>
      </div>
    </section>
  );
}

/**
 * La tarjeta al acabar (T161, T162: la del Cañón). Al aguantar o caer:
 * «¡Castillo a salvo!» / «El castillo ha caído», la medalla, la duración y
 * la dificultad, el tiempo aguantado, los enemigos, la vida que le queda al
 * castillo y los puntos; si es tu mejor medalla de ese par, lo dice. Con
 * «Terminar partida», «Partida terminada» sin medalla ni puntos. Siempre
 * «Volver al mar» y «Otra vez» (la misma duración y dificultad).
 */
function CastleEnd({
  result,
  record,
  ranking,
  onAgain,
  onBack,
}: {
  result: DefenseResult;
  record: CastleMode['record'];
  ranking: CastleMode['ranking'];
  onAgain: () => void;
  onBack: () => void;
}) {
  const titleId = useId();
  const again = useRef<HTMLButtonElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const card = castleEndView(result);
  // El foco: «Otra vez» tras aguantar o caer (como el Cañón); «Volver al mar» si se terminó.
  const short = card.short;
  useEffect(() => (short ? back : again).current?.focus({ preventScroll: true }), [short]);
  const pair = castlePairLabel(card.runMin, card.difficulty);
  return (
    <div className="mar-canon-endwrap">
      <section
        className={`mar-canon-end mar-castle-end is-${card.short ? 'quit' : card.reason === 'held' ? 'survived' : 'flooded'}`}
        data-testid="mar-castillo-final"
        data-fin={card.reason}
        data-ranking={card.ranked ? 'si' : 'no'}
        data-medalla={card.short ? undefined : (card.medal ?? 'ninguna')}
        data-puntos={card.short ? undefined : card.score}
        role="dialog"
        aria-labelledby={titleId}
      >
        <div className="mar-canon-end__sky" aria-hidden="true" />
        <h2 id={titleId} className="mar-canon-end__title">
          {msg(card.title)}
        </h2>
        {card.short ? (
          <p className="mar-canon-end__line">{msg('mar.castillo.fin.sinMedalla')}</p>
        ) : (
          <>
            {card.line ? <p className="mar-canon-end__line">{msg(card.line)}</p> : null}
            <p
              className="mar-canon-end__medal"
              data-testid="mar-castillo-final-medalla"
              data-medalla={card.medal ?? 'ninguna'}
            >
              {msg(card.medalKey)}
            </p>
            <p className="mar-canon-end__run" data-testid="mar-castillo-final-partida">
              {pair}
            </p>
            {record?.improved ? (
              <p
                className="mar-canon-end__unlock"
                data-testid="mar-castillo-final-mejor"
                role="status"
              >
                {msg('mar.castillo.fin.medalla.mejor', { eleccion: pair })}
              </p>
            ) : null}
          </>
        )}
        <dl className="mar-canon-end__stats">
          <div>
            <dt>{msg('mar.canon.fin.tiempo')}</dt>
            <dd data-testid="mar-castillo-final-tiempo">{card.played}</dd>
          </div>
          <div>
            <dt>{msg('mar.canon.fin.enemigos')}</dt>
            <dd data-testid="mar-castillo-final-enemigos">{card.kills}</dd>
          </div>
          <div>
            <dt>{msg('mar.castillo.fin.castillo')}</dt>
            <dd data-testid="mar-castillo-final-vida">
              {msg('mar.castillo.fin.vida', { pct: card.lifePct })}
            </dd>
          </div>
          {card.short ? null : (
            <div>
              <dt>{msg('mar.castillo.fin.puntos')}</dt>
              <dd data-testid="mar-castillo-final-puntos">{card.score}</dd>
            </div>
          )}
        </dl>
        {ranking ? <CastleEndRanking ranking={ranking} /> : null}
        {!ranking && !card.short && !card.ranked ? (
          <p className="mar-canon-end__prize" data-testid="mar-castillo-final-prueba">
            {msg('mar.castillo.fin.prueba')}
          </p>
        ) : null}
        <div className="mar-canon-end__actions">
          <button
            ref={back}
            type="button"
            className="mar-canon-end__back"
            data-testid="mar-castillo-volver"
            onClick={onBack}
          >
            {msg('mar.canon.fin.volver')}
          </button>
          <button
            ref={again}
            type="button"
            className="mar-canon-end__again"
            data-testid="mar-castillo-otra"
            onClick={onAgain}
          >
            {msg('mar.canon.fin.otra')}
          </button>
        </div>
      </section>
    </div>
  );
}

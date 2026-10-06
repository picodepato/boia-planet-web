'use client';

import {
  type DefenseResult,
  type DefenseSpawn,
  type DefenseTargetPriority,
  type DefenseTowerKind,
  defenseSchedule,
} from '@boia/engine/defense';
import { type CSSProperties, useCallback, useEffect, useId, useRef, useState } from 'react';
import { type MessageKey, t as msg } from '../../lib/i18n';
import type { CastleIslandImage } from '../../lib/mundo/castle-island-images';
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
  type NextWaveView,
  PRIORITY_KEYS,
  type PlacementView,
  TOWER_NAME_KEYS,
  type TowerDetailView,
  type TowerPanelView,
  type UpgradeId,
  type UpgradeRow,
  anyUpgradeAffordable,
  buildOptions,
  callWaveLine,
  castleEndView,
  castleView,
  defenseBossBar,
  defenseBossNotices,
  formatClock,
  levelLine,
  placementView,
  priorityOptions,
  sameCastleView,
  seenBosses,
  sellLine,
  towerDetail,
  towerPanel,
  upgradeLine,
  upgradeRowLine,
  waveKindsText,
  waveWarningLine,
} from './castillo-hud-model';
import { CastleGuideLayer } from './castillo-guia';
import { CastleIcon, type CastleIconName } from './castillo-icons';
import type { CastleMode } from './castillo-mode';
import { castlePairLabel } from './castillo-previa';
import './castillo-hud.css';
import { CastleEndRanking } from './castillo-ranking';
import type { DefenseOverlayPrefs } from './engine/defense-overlays';

/**
 * La interfaz de «Defensa del Castillo» en `/mar` (plan 014 T161; v2 en el
 * plan 015 T171), con el estilo del HUD del Cañón (plan 013): arriba al
 * centro ×2, el tiempo y la pausa, la vida del castillo, la oleada y las
 * monedas (y la barra del boss del Cañón), y debajo el aviso de la oleada
 * siguiente (qué trae y si hay jefe). Abajo, encima de «Entradas», una sola
 * franja que cambia: «Construir», «Mejoras» y «Llamar oleada» → las siete
 * islas con su foto y su precio → el detalle de una (cómo hace daño, por
 * nivel) → la isla que se coloca (verde o roja con el motivo, Cancelar /
 * Instalar isla) → la ficha de una isla construida (nivel, a quién apunta,
 * Mejorar, Vender) → las mejoras del avión y del castillo. Con el teclado: B
 * construir, 1–7 colocar esa isla, Intro instalar, I elegir la isla más
 * cercana al avión (otra vez: la siguiente), U mejorar, V vender, M mejoras,
 * X ×2, O llamar oleada, Esc atrás o pausa; las flechas siguen llevando el
 * avión. Con el dedo, un toque en el agua mueve la isla que se coloca, elige
 * la isla tocada o manda el avión allí (`DefenseRun.tap`).
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
  scale: 1 | 2;
}

const EMPTY: HudState = {
  view: null,
  bar: null,
  placing: null,
  placement: null,
  panel: null,
  notices: [],
  scale: 1,
};

function sameState(a: HudState, b: HudState): boolean {
  const pa = a.placement;
  const pb = b.placement;
  const ta = a.panel;
  const tb = b.panel;
  return (
    a.view === b.view &&
    a.placing === b.placing &&
    a.scale === b.scale &&
    (pa === pb || (!!pa && !!pb && pa.ok === pb.ok && pa.key === pb.key && pa.cost === pb.cost)) &&
    (ta === tb ||
      (!!ta &&
        !!tb &&
        ta.id === tb.id &&
        ta.level === tb.level &&
        ta.priority === tb.priority &&
        ta.canUpgrade === tb.canUpgrade &&
        ta.sellValue === tb.sellValue)) &&
    (a.bar === b.bar ||
      (!!a.bar && !!b.bar && a.bar.id === b.bar.id && a.bar.hpPct === b.bar.hpPct)) &&
    a.notices === b.notices
  );
}

/** Lo que el HUD pinta, leído de la partida unas veces por segundo. */
function useCastleHud(castle: CastleMode): [HudState, () => void] {
  const [state, setState] = useState<HudState>(EMPTY);
  const schedule = useRef<{ run: DefenseRun; list: DefenseSpawn[] } | null>(null);
  const seen = useRef<{
    bosses: ReturnType<typeof seenBosses>;
    defeated: readonly string[];
  } | null>(null);
  const tickRef = useRef<() => void>(() => {});
  const on = castle.active && !castle.result;
  const { read, run: getRun } = castle;
  useEffect(() => {
    if (!on) {
      seen.current = null;
      tickRef.current = () => {};
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
      const view = castleView(s, schedule.current.list, run.config);
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
          scale: run.timeScale,
        };
        return sameState(prev, next) ? prev : next;
      });
    };
    tickRef.current = tick;
    tick();
    const id = window.setInterval(tick, READ_MS);
    return () => window.clearInterval(id);
  }, [on, read, getRun]);
  // Tras un toque en el HUD, leer ya (sin esperar a la siguiente lectura).
  const refresh = useCallback(() => window.setTimeout(() => tickRef.current(), 40), []);
  return [state, refresh];
}

const say = (l: Line) => msg(l.key, l.params);
const sayKey = (key: MessageKey, params?: Record<string, string | number>) => msg(key, params);

/** Lo que enseña la franja de abajo además de la isla que se coloca y la ficha. */
type Sheet = null | 'tray' | 'upgrades' | { detail: DefenseTowerKind };

/**
 * Todo lo del castillo encima del mar. `covered`: el menú o un panel encima
 * (la partida en pausa; el teclado es suyo). `onPause`: la pausa y Esc abren
 * el menú de `/mar`, con el sonido, las barras y números y «Terminar partida».
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
  const [hud, refresh] = useCastleHud(castle);
  const [sheet, setSheet] = useState<Sheet>(null);
  const playing = castle.active && !castle.result;
  const { view, placing, placement, panel } = hud;
  const run = castle.run;
  const detailKind = sheet && typeof sheet === 'object' ? sheet.detail : null;
  const listOpen = sheet === 'tray' || detailKind !== null;

  // Sin partida, la franja de abajo vuelve a empezar cerrada.
  useEffect(() => {
    if (!playing) setSheet(null);
  }, [playing]);
  // La lista (o el detalle de una isla) abierta lleva la cámara a la vista de salida (T170).
  useEffect(() => {
    run()?.setBuildMenu(listOpen);
  }, [listOpen, run, playing]);

  // Dónde acaba lo de arriba (HUD, aviso de oleada, aviso del boss): la franja
  // de abajo nunca crece por encima (se desplaza por dentro).
  const top = useRef<HTMLDivElement>(null);
  const [topEnd, setTopEnd] = useState<number | null>(null);
  const hasTop = playing && !!view;
  useEffect(() => {
    const el = top.current;
    if (!hasTop || !el) return;
    const measure = () => setTopEnd(Math.ceil(el.getBoundingClientRect().bottom));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [hasTop]);

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
    setSheet('tray');
    refresh();
  }, [run, refresh]);
  const openUpgrades = useCallback(() => {
    run()?.cancelPlacing();
    run()?.select(null);
    setSheet('upgrades');
    refresh();
  }, [run, refresh]);
  const closeSheet = useCallback(() => setSheet(null), []);
  const showDetail = useCallback((o: BuildOption) => {
    setSheet({ detail: o.kind });
  }, []);
  const place = useCallback(
    (kind: DefenseTowerKind) => {
      run()?.startPlacing(kind);
      setSheet(null);
      refresh();
    },
    [run, refresh],
  );
  const cancel = useCallback(() => {
    run()?.cancelPlacing();
    refresh();
  }, [run, refresh]);
  const confirm = useCallback(() => {
    const ok = run()?.confirmPlacing() ?? false;
    refresh();
    return ok;
  }, [run, refresh]);
  const closePanel = useCallback(() => {
    run()?.select(null);
    refresh();
  }, [run, refresh]);
  const act = useCallback(
    (fn: (r: DefenseRun) => void) => {
      const r = run();
      if (!r || r.ended) return;
      fn(r);
      refresh();
    },
    [run, refresh],
  );

  // El teclado de la partida (las flechas son del avión, en el motor).
  const latest = useRef({ covered, onPause, sheet, view, placing, panel, castle });
  latest.current = { covered, onPause, sheet, view, placing, panel, castle };
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
      const tray = l.sheet === 'tray';
      const detail = l.sheet && typeof l.sheet === 'object';
      if (k === 'Escape') {
        e.preventDefault();
        if (r.placing) {
          r.cancelPlacing();
          focusIn('[data-testid="mar-castillo-construir"]');
        } else if (detail) {
          setSheet('tray');
          focusIn('[data-testid="mar-castillo-isla"]');
        } else if (l.sheet) {
          setSheet(null);
          focusIn('[data-testid="mar-castillo-construir"]');
        } else if (r.selected !== null) r.select(null);
        else l.onPause();
        refresh();
        return;
      }
      if (e.repeat) return;
      if (k === 'b') {
        e.preventDefault();
        if (tray || detail) setSheet(null);
        else {
          r.cancelPlacing();
          r.select(null);
          setSheet('tray');
          focusIn('[data-testid="mar-castillo-isla"]');
        }
      } else if ((tray || detail) && /^[1-9]$/.test(k)) {
        const o = l.view ? buildOptions(r.config, l.view.coins)[Number(k) - 1] : undefined;
        if (!o) return;
        e.preventDefault();
        if (o.affordable) {
          r.startPlacing(o.kind);
          setSheet(null);
          focusIn('[data-testid="mar-castillo-colocar-si"]');
        }
      } else if (k === 'Enter' && r.placing && !onButton) {
        e.preventDefault();
        r.confirmPlacing();
      } else if (k === 'i') {
        e.preventDefault();
        setSheet(null);
        if (r.selectNext() !== null) focusIn('[data-testid="mar-castillo-mejorar"]');
      } else if (k === 'u' && r.selected !== null) {
        e.preventDefault();
        r.upgradeSelected();
      } else if (k === 'v' && r.selected !== null) {
        e.preventDefault();
        r.sellSelected();
        focusIn('[data-testid="mar-castillo-construir"]');
      } else if (k === 'm') {
        e.preventDefault();
        if (l.sheet === 'upgrades') setSheet(null);
        else {
          r.cancelPlacing();
          r.select(null);
          setSheet('upgrades');
          focusIn('[data-testid="mar-castillo-mejora"]');
        }
      } else if (k === 'x') {
        e.preventDefault();
        r.timeScale = r.timeScale === 2 ? 1 : 2;
      } else if (k === 'o') {
        e.preventDefault();
        r.callWave();
      } else return;
      refresh();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [castle.active, run, focusIn, refresh]);

  const mode: 'idle' | 'tray' | 'detail' | 'placing' | 'tower' | 'upgrades' = placing
    ? 'placing'
    : detailKind
      ? 'detail'
      : sheet === 'tray'
        ? 'tray'
        : sheet === 'upgrades'
          ? 'upgrades'
          : panel
            ? 'tower'
            : 'idle';
  const last = hud.notices[hud.notices.length - 1] ?? null;
  const config = castle.run()?.config ?? null;

  if (!castle.active) return <CastleAnnouncer view={null} notices={[]} result={null} />;
  return (
    <>
      <CastleAnnouncer view={view} notices={hud.notices} result={castle.result} />
      {playing ? <GameSoundMenu covered={covered} /> : null}
      {playing && view ? (
        <div ref={top} className="mar-castle-top">
          <CastleTop
            view={view}
            bar={hud.bar}
            scale={hud.scale}
            onScale={() => act((r) => (r.timeScale = r.timeScale === 2 ? 1 : 2))}
            onPause={onPause}
          />
          {view.next?.warn ? <CastleWaveWarning next={view.next} /> : null}
          {last ? <CastleBanner notice={last} /> : null}
        </div>
      ) : null}
      {playing && view && config ? (
        <div
          ref={dock}
          className={`mar-castle-dock is-${mode}`}
          data-testid="mar-castillo-franja"
          data-modo={mode}
          style={
            topEnd === null ? undefined : ({ '--castle-top-end': `${topEnd}px` } as CSSProperties)
          }
        >
          {mode === 'idle' ? (
            <CastleActions
              view={view}
              onBuild={openTray}
              onUpgrades={openUpgrades}
              onCall={() => act((r) => r.callWave())}
            />
          ) : mode === 'tray' ? (
            <CastleTray
              options={buildOptions(config, view.coins)}
              onChoose={(o) => {
                showDetail(o);
                focusIn('[data-testid="mar-castillo-detalle-colocar"]');
              }}
              onClose={() => {
                closeSheet();
                focusIn('[data-testid="mar-castillo-construir"]');
              }}
            />
          ) : mode === 'detail' && detailKind ? (
            <CastleDetail
              detail={towerDetail(config, detailKind, view.coins)}
              onPlace={() => {
                place(detailKind);
                focusIn('[data-testid="mar-castillo-colocar-si"]');
              }}
              onBack={() => {
                setSheet('tray');
                focusIn(`[data-testid="mar-castillo-isla"][data-isla="${detailKind}"]`);
              }}
            />
          ) : mode === 'placing' && placing && placement ? (
            <CastlePlacing
              kind={placing}
              placement={placement}
              image={buildOptions(config, view.coins).find((o) => o.kind === placing)!.image}
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
              onUpgrade={() => act((r) => r.upgradeSelected())}
              onSell={() => {
                act((r) => r.sellSelected());
                focusIn('[data-testid="mar-castillo-construir"]');
              }}
              onPriority={(p) => act((r) => r.setPriority(panel.id, p))}
              onClose={closePanel}
            />
          ) : mode === 'upgrades' ? (
            <CastleUpgrades
              rows={view.upgrades}
              onBuy={(id) => act((r) => (id === 'castle' ? r.upgradeCastle() : r.upgradePlane(id)))}
              onClose={() => {
                closeSheet();
                focusIn('[data-testid="mar-castillo-mejoras"]');
              }}
            />
          ) : null}
        </div>
      ) : null}
      {playing ? (
        <CastleGuideLayer
          castle={castle}
          mode={mode}
          hasPriority={!!panel && panel.priority !== null}
          covered={covered}
        />
      ) : null}
      {castle.result && !covered ? (
        <CastleEnd
          result={castle.result}
          record={castle.record}
          ranking={castle.ranking}
          unlocked={castle.unlocked}
          onAgain={castle.again}
          onBack={castle.leave}
        />
      ) : null}
    </>
  );
}

/**
 * Los avisos para lectores de pantalla: llega una oleada (lo que trae y si
 * hay jefe, unos segundos antes), empieza, llega un boss y el resultado. Una
 * región `aria-live` siempre en la página, que no se ve.
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
  const next = view?.next ?? null;
  const nextRef = useRef(next);
  nextRef.current = next;
  const warnWave = next?.warn ? next.wave : 0;
  useEffect(() => {
    if (wave > 0) setText(msg('mar.castillo.anuncio.oleada', { n: wave }));
  }, [wave]);
  useEffect(() => {
    const n = nextRef.current;
    if (warnWave > 0 && n) setText(say(waveWarningLine(n, sayKey)));
  }, [warnWave]);
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

/** Arriba al centro: ×2, el tiempo y la pausa; la vida del castillo; la oleada y las monedas; el boss. */
function CastleTop({
  view,
  bar,
  scale,
  onScale,
  onPause,
}: {
  view: CastleView;
  bar: BossBarView | null;
  scale: 1 | 2;
  onScale: () => void;
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
      <div className="mar-canon-hud__row mar-castle-hud__row">
        <button
          type="button"
          className={`mar-castle-speed${scale === 2 ? ' is-on' : ''}`}
          data-testid="mar-castillo-velocidad"
          data-escala={scale}
          aria-pressed={scale === 2}
          aria-label={msg('mar.castillo.velocidad.aria')}
          aria-keyshortcuts="X"
          title={msg('mar.castillo.velocidad.aria')}
          onClick={onScale}
        >
          {msg('mar.castillo.velocidad')}
        </button>
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

/**
 * El aviso de la oleada siguiente, unos segundos antes (decisión 10): cuándo,
 * qué trae y si hay jefe. Se lee en voz alta por `CastleAnnouncer`.
 */
function CastleWaveWarning({ next }: { next: NextWaveView }) {
  const kinds = waveKindsText(next, sayKey);
  return (
    <div
      className={`mar-castle-warn${next.boss ? ' is-boss' : ''}`}
      data-testid="mar-castillo-aviso-oleada"
      data-oleada={next.wave}
      data-jefe={next.boss ? 'si' : 'no'}
      aria-hidden="true"
    >
      <strong className="mar-castle-warn__title">
        <CastleIcon name="oleada" />
        {msg('mar.castillo.aviso.titulo', { n: next.wave, s: next.inS })}
      </strong>
      {kinds ? <span className="mar-castle-warn__kinds">{kinds}</span> : null}
      {next.bossNameKey ? (
        <span className="mar-castle-warn__boss" data-testid="mar-castillo-aviso-jefe">
          <CastleIcon name="jefe" />
          {msg('mar.castillo.aviso.jefe', { nombre: msg(next.bossNameKey) })}
        </span>
      ) : null}
    </div>
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

/** La foto de una isla (T172): su modelo de frente, fondo transparente. */
function IslandImage({
  image,
  size,
  className,
}: {
  image: CastleIslandImage;
  size: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- imágenes fijas pequeñas (T172), 1× y 2×
    <img
      className={className}
      src={image.src}
      srcSet={`${image.src} 1x, ${image.src2x} 2x`}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      decoding="async"
      draggable={false}
    />
  );
}

/** La franja en reposo: «Construir», «Mejoras» y «Llamar oleada» con su premio. */
function CastleActions({
  view,
  onBuild,
  onUpgrades,
  onCall,
}: {
  view: CastleView;
  onBuild: () => void;
  onUpgrades: () => void;
  onCall: () => void;
}) {
  const next = view.next;
  const canBuy = anyUpgradeAffordable(view.upgrades);
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
        className="mar-castle-btn is-upgrades"
        data-testid="mar-castillo-mejoras"
        data-hay={canBuy ? 'si' : 'no'}
        aria-haspopup="true"
        aria-keyshortcuts="M"
        aria-description={canBuy ? msg('mar.castillo.mejoras.hay') : undefined}
        onClick={onUpgrades}
      >
        <CastleIcon name="mejorar" className="mar-castle-btn__icon" />
        <span>{msg('mar.castillo.mejoras')}</span>
        {canBuy ? <span className="mar-castle-dot" aria-hidden="true" /> : null}
      </button>
      <button
        type="button"
        className="mar-castle-btn is-call"
        data-testid="mar-castillo-llamar"
        data-oleada={next?.wave}
        data-bono={next?.bonus}
        aria-disabled={!next}
        aria-keyshortcuts="O"
        aria-label={
          next
            ? msg('mar.castillo.llamar.aria', { n: next.wave, monedas: next.bonus })
            : msg('mar.castillo.llamar')
        }
        onClick={() => {
          if (next) onCall();
        }}
      >
        <CastleIcon name="oleada" className="mar-castle-btn__icon" />
        <span className="mar-castle-btn__text">
          <span>{msg('mar.castillo.llamar')}</span>
          {next ? (
            <small>
              {say(callWaveLine(next))} <CastleIcon name="moneda" className="mar-castle-coin" />
            </small>
          ) : null}
        </span>
      </button>
    </div>
  );
}

/** «Construir»: las siete islas con su foto y su precio (en gris si no llega el dinero). */
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
              data-pobre={o.affordable ? undefined : 'si'}
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
              <IslandImage image={o.image} size={96} className="mar-castle-isla__img" />
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

/**
 * El detalle de una isla de la lista (decisión 13): su foto, cómo hace daño
 * con sus números, la tabla por niveles y a quién apunta; «Colocar» (si
 * llega el dinero) y volver a la lista.
 */
function CastleDetail({
  detail,
  onPlace,
  onBack,
}: {
  detail: TowerDetailView;
  onPlace: () => void;
  onBack: () => void;
}) {
  const titleId = useId();
  return (
    <section
      className={`mar-castle-detail${detail.affordable ? '' : ' is-poor'}`}
      data-testid="mar-castillo-detalle"
      data-isla={detail.kind}
      aria-labelledby={titleId}
    >
      <div className="mar-castle-detail__head">
        <IslandImage image={detail.image} size={96} className="mar-castle-detail__img" />
        <div className="mar-castle-place__text">
          <strong id={titleId}>{msg(detail.nameKey)}</strong>
          <span className="mar-castle-detail__cost">
            <CastleIcon name="moneda" className="mar-castle-coin" />
            {detail.cost}
          </span>
          {detail.priority ? (
            <small className="mar-castle-place__help">
              {msg('mar.castillo.detalle.apunta', {
                prioridad: msg(PRIORITY_KEYS[detail.priority]),
              })}
            </small>
          ) : null}
        </div>
      </div>
      <p className="mar-castle-detail__how" data-testid="mar-castillo-detalle-texto">
        {say(detail.how)}
      </p>
      <table className="mar-castle-stats" data-testid="mar-castillo-detalle-tabla">
        <caption className="mar-canon-sr">{msg('mar.castillo.detalle.tabla')}</caption>
        <thead>
          <tr>
            <td />
            {[1, 2, 3].map((n) => (
              <th key={n} scope="col">
                {msg('mar.castillo.detalle.nivel', { n })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {detail.rows.map((r) => (
            <tr key={r.id} data-dato={r.id}>
              <th scope="row">{msg(r.labelKey)}</th>
              {r.values.map((v, i) => (
                <td key={i}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mar-castle-place__actions">
        <button
          type="button"
          className="mar-castle-btn is-ghost"
          data-testid="mar-castillo-detalle-atras"
          onClick={onBack}
        >
          {msg('mar.castillo.detalle.atras')}
        </button>
        <button
          type="button"
          className="mar-castle-btn is-go"
          data-testid="mar-castillo-detalle-colocar"
          aria-disabled={!detail.affordable}
          onClick={() => {
            if (detail.affordable) onPlace();
          }}
        >
          {detail.affordable
            ? msg('mar.castillo.detalle.colocar')
            : msg('mar.castillo.detalle.pobre')}
          <span className="mar-castle-btn__cost">
            <CastleIcon name="moneda" className="mar-castle-coin" />
            {detail.cost}
          </span>
        </button>
      </div>
    </section>
  );
}

/** La isla que se coloca: dónde (verde o roja con el motivo), Cancelar e «Instalar isla». */
function CastlePlacing({
  kind,
  placement,
  image,
  onCancel,
  onConfirm,
}: {
  kind: DefenseTowerKind;
  placement: PlacementView;
  image: CastleIslandImage;
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
        <IslandImage image={image} size={96} className="mar-castle-place__img" />
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

/** La ficha de una isla construida: nivel, lo que hace, a quién apunta, Mejorar y Vender. */
function CastleTowerPanel({
  panel,
  onUpgrade,
  onSell,
  onPriority,
  onClose,
}: {
  panel: TowerPanelView;
  onUpgrade: () => void;
  onSell: () => void;
  onPriority: (p: DefenseTargetPriority) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const prioId = useId();
  const maxed = panel.upgradeCost === null;
  const options = priorityOptions(panel.priority);
  return (
    <section
      className="mar-castle-tower"
      data-testid="mar-castillo-ficha"
      data-isla={panel.kind}
      data-id={panel.id}
      data-nivel={panel.level}
      data-prioridad={panel.priority ?? undefined}
      aria-labelledby={titleId}
    >
      <div className="mar-castle-tower__info">
        <IslandImage image={panel.image} size={96} className="mar-castle-place__img" />
        <div className="mar-castle-place__text">
          <strong id={titleId}>{msg(panel.nameKey)}</strong>
          <span className="mar-castle-tower__level" data-testid="mar-castillo-ficha-nivel">
            <Pips level={panel.level} max={panel.maxLevel} />
            {say(levelLine(panel.level, panel.maxLevel))}
          </span>
          <small className="mar-castle-place__help" data-testid="mar-castillo-ficha-texto">
            {say(panel.how)}
          </small>
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
      {options.length ? (
        <div className="mar-castle-prio" role="group" aria-labelledby={prioId}>
          <span id={prioId} className="mar-castle-prio__label">
            {msg('mar.castillo.prioridad')}
          </span>
          <div className="mar-castle-prio__list">
            {options.map((o) => (
              <button
                key={o.priority}
                type="button"
                className={`mar-castle-prio__btn${o.on ? ' is-on' : ''}`}
                data-testid="mar-castillo-prioridad"
                data-prioridad={o.priority}
                aria-pressed={o.on}
                title={msg(o.helpKey)}
                aria-description={msg(o.helpKey)}
                onClick={() => {
                  if (!o.on) onPriority(o.priority);
                }}
              >
                {msg(o.labelKey)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
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

function Pips({ level, max }: { level: number; max: number }) {
  return (
    <span className="mar-castle-pips" aria-hidden="true">
      {Array.from({ length: max }, (_, k) => (
        <span key={k} className={k < level ? 'is-on' : ''} />
      ))}
    </span>
  );
}

const UPGRADE_ICON: Readonly<Record<UpgradeId, CastleIconName>> = {
  speed: 'rapidez',
  damage: 'dano',
  castle: 'castillo',
};

/** «Mejoras»: velocidad de ataque y daño del avión (1–5) y la vida del castillo. */
function CastleUpgrades({
  rows,
  onBuy,
  onClose,
}: {
  rows: readonly UpgradeRow[];
  onBuy: (id: UpgradeId) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  return (
    <section
      className="mar-castle-tray mar-castle-upgrades"
      data-testid="mar-castillo-mejoras-panel"
      aria-labelledby={titleId}
    >
      <header className="mar-castle-tray__head">
        <h2 id={titleId}>{msg('mar.castillo.mejoras.titulo')}</h2>
        <p className="mar-castle-tray__help">{msg('mar.castillo.mejoras.ayuda')}</p>
        <button
          type="button"
          className="mar-castle-x"
          data-testid="mar-castillo-mejoras-cerrar"
          aria-label={msg('mar.castillo.cerrar')}
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <ul className="mar-castle-upgrades__list">
        {rows.map((r) => {
          const action = say(upgradeRowLine(r));
          const value = say(r.value);
          return (
            <li key={r.id} className="mar-castle-upgrade" data-mejora={r.id}>
              <CastleIcon name={UPGRADE_ICON[r.id]} className="mar-castle-upgrade__icon" />
              <span className="mar-castle-upgrade__text">
                <strong>{msg(r.nameKey)}</strong>
                <span className="mar-castle-upgrade__value">
                  <Pips level={r.level} max={r.maxLevel} />
                  {value}
                </span>
              </span>
              <button
                type="button"
                className="mar-castle-btn is-go"
                data-testid="mar-castillo-mejora"
                data-mejora={r.id}
                data-nivel={r.level}
                data-max={r.maxLevel}
                aria-disabled={!r.affordable}
                aria-label={msg('mar.castillo.mejora.aria', {
                  nombre: msg(r.nameKey),
                  n: r.level,
                  max: r.maxLevel,
                  valor: value,
                  accion: action,
                })}
                onClick={() => {
                  if (r.affordable) onBuy(r.id);
                }}
              >
                {action}
                {r.cost === null ? null : <CastleIcon name="moneda" className="mar-castle-coin" />}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Las opciones del castillo en la pausa (decisión 11): barras de vida y
 * números de daño en la arena, guardadas en el dispositivo.
 */
export function CastleOverlayOptions({
  overlays,
  onChange,
}: {
  overlays: DefenseOverlayPrefs;
  onChange: (prefs: DefenseOverlayPrefs) => void;
}) {
  const titleId = useId();
  const items: { id: keyof DefenseOverlayPrefs; key: MessageKey; testid: string }[] = [
    { id: 'bars', key: 'mar.castillo.opciones.barras', testid: 'mar-castillo-opcion-barras' },
    { id: 'numbers', key: 'mar.castillo.opciones.numeros', testid: 'mar-castillo-opcion-numeros' },
  ];
  return (
    <div className="mar-castle-options" role="group" aria-labelledby={titleId}>
      <p id={titleId} className="mar-castle-options__title">
        {msg('mar.castillo.opciones')}
      </p>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="switch"
          className="mar-castle-switch"
          data-testid={it.testid}
          aria-checked={overlays[it.id]}
          onClick={() => onChange({ ...overlays, [it.id]: !overlays[it.id] })}
        >
          <span>{msg(it.key)}</span>
          <span className="mar-castle-switch__track" aria-hidden="true">
            <span className="mar-castle-switch__knob" />
          </span>
        </button>
      ))}
    </div>
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
  unlocked = [],
  onAgain,
  onBack,
}: {
  result: DefenseResult;
  record: CastleMode['record'];
  ranking: CastleMode['ranking'];
  /** Los logros que acaba de completar (plan 015 T176): lo desbloqueado, por reclamar en «Logros». */
  unlocked?: CastleMode['unlocked'];
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
        {unlocked.length > 0 ? (
          <ul className="mar-castle-end__logros" data-testid="mar-castillo-final-logros" role="status">
            {unlocked.map((u) => (
              <li key={u.id} className="mar-canon-end__unlock" data-logro={u.id}>
                {msg(u.prize ? 'mar.castillo.fin.logro.premio' : 'mar.castillo.fin.logro', {
                  logro: u.title,
                  premio: u.prize ?? '',
                })}
              </li>
            ))}
          </ul>
        ) : null}
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

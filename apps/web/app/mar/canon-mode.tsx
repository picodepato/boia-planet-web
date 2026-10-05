'use client';

import {
  type MinigameRewardSink,
  type RewardOutcome,
  WorldMinigameSession,
  canon as canonEntry,
  canonConfigFor,
  canonEnd,
  pageAuthority,
} from '@boia/engine/minigames';
import {
  DEFAULT_DIFFICULTY,
  DIFFICULTY_IDS,
  type DefeatStyle,
  type DifficultyId,
  type EndReason,
  type SurvivorsSnapshot,
} from '@boia/engine/survivors';
import type { WorldConfig } from '@boia/world';
import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { emitSignal } from '../../lib/mundo/achievements';
import { type InWorldCopy, withWinSignal } from '../../lib/mundo/minigame-layer';
import { gameRepository } from '../../lib/mundo/repo';
import { type MessageKey, t as msg } from '../../lib/i18n';
import { type CanonPrize, type CanonResult, canonPrize, canonResult } from './canon-hud-model';
import type { Mar3D } from './engine/mar3d';
import { MAR_SHIP_CONFIG } from './engine/steering';
import {
  CANON_GAME_ID,
  type CanonHook,
  type HideLayer,
  SurvivorsRun,
  canonBlockKey,
  canonShortcut,
  devShortcutsEnabled,
  devStartRewards,
  isDevStart,
  nextDefeatStyle,
  startDefeatStyle,
  hideForGame,
  marHideHost,
  randomSeed,
  survivorsSea,
  withoutCanonShortcut,
} from './survivors';

/**
 * El Cañón «Que no pare la música» en `/mar` (plan 009, T99), del lado de
 * React: empezar donde está el barco (desde el panel de su isla o con el
 * atajo `?minijuego=canon&t=&seed=`), esconder el mundo durante la partida
 * y devolverlo igual al acabar, el bloqueo en carrera, la pausa con la
 * pestaña oculta y el estado para las pruebas (`data-testid="mar-canon"`).
 * `mar-client` sólo lo cablea.
 *
 * Cada partida abre su sesión de minijuego (T119, REQ-AVE-038) con la
 * semilla de la partida y la liquida al acabar con el tiempo activo; si se
 * llega al amanecer, el premio de siempre (150 puntos y 50 monedas una vez
 * por temporada) y la señal `win_minigame` de los logros `canon` y
 * `guardacostas`. Salir a mitad (o 5 min en pausa) abandona la sesión.
 * Una partida de prueba (`&t=`, `&seed=`, `&carta=1`) sólo da premio en
 * `pnpm dev` y en las e2e; en producción, con `?dev=1`, no (T121).
 */

const EMPTY: ReadonlySet<HideLayer> = new Set();
/** Cada cuánto se publica el estado de la partida (ms). */
const HOOK_MS = 250;
/** Cada cuánto, con la pestaña oculta, se apunta la pausa (ms). */
const HIDDEN_MS = 1000;
/** «Volver al mar» (T118): el fundido entero y cuándo, a oscuras, vuelve el mundo (ms). */
export const FADE_MS = 640;
const FADE_SWAP_MS = 300;

function reducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

export interface CanonEnd {
  reason: EndReason;
  snapshot: SurvivorsSnapshot;
}

export interface CanonMode {
  /** Hay partida en curso (también con la pantalla final, hasta volver al mar). */
  active: boolean;
  /** La pantalla final (T118): «¡Amanece!» o «¡Barco inundado!», o null. */
  result: CanonResult | null;
  /** El aviso corto de una partida abandonada (más de 5 min en pausa), o null. */
  notice: 'abandoned' | null;
  dismissNotice(): void;
  /** «Volver al mar» con su fundido en curso. */
  fading: boolean;
  /** El estado de la partida ahora (para el HUD; no guardarlo), o null. */
  read(): SurvivorsSnapshot | null;
  /** Elige la opción `index` de la carta de nivel abierta. */
  choose(index: number): void;
  /** «Otra vez»: una partida nueva donde está el barco. */
  again(): void;
  /** «Volver al mar»: el mundo vuelve con un fundido corto. */
  backToSea(): void;
  /** El último estado (también el final, hasta la siguiente). */
  hud: CanonHook | null;
  /** El premio de la última partida acabada (null: aún sin acabar o liquidándose). */
  reward: RewardOutcome | null;
  /** Lo mismo en una palabra, para las pruebas (`data-premio`). */
  prize: CanonPrize | null;
  /** Lo que la partida tiene escondido ahora. */
  hidden: ReadonlySet<HideLayer>;
  /** Empieza donde está el barco; false si no se puede ahora. */
  start(opts?: StartOptions): boolean;
  /** Pausa (un panel o el menú encima) o sigue. */
  setPaused(paused: boolean): void;
  /**
   * El interruptor de desarrollo del estilo de derrota (T117): sólo con los
   * atajos de desarrollo encendidos (`devShortcutsEnabled`).
   */
  dev: { enabled: boolean; defeatStyle: DefeatStyle | null; toggleDefeatStyle(): void };
  /** Lo que el panel de la isla necesita para el Cañón. */
  panel: {
    inWorld: readonly string[];
    onPlay: (gameId: string) => void;
    blockedReason: (gameId: string) => string | null;
    copy: (gameId: string) => InWorldCopy | null;
    /** Las tres dificultades junto a «Jugar» (T131). */
    extra: (gameId: string) => ReactNode;
  };
  /** La dificultad elegida para las próximas partidas (se recuerda durante la visita). */
  difficulty: DifficultyId;
}

interface StartOptions {
  t?: number;
  seed?: number | null;
  /** Estilo de derrota pedido (`&derrota=`); sólo cuenta con los atajos encendidos. */
  defeatStyle?: DefeatStyle | null;
  /** `&carta=1`: empezar con una carta de nivel abierta (sólo con los atajos encendidos). */
  card?: boolean;
  weapons?: boolean;
  /** `&carta=surtido`: la carta con una opción de cada clase (T130). */
  mix?: boolean;
  /** Dificultad pedida (`&dificultad=`); sólo cuenta con los atajos encendidos y se recuerda. */
  difficulty?: DifficultyId | null;
}

export function useCanonMode({
  engineRef,
  worldRef,
  ready,
  raceActive,
  isRaceActive,
  onStart,
  onOffer,
  onEnd,
  rewards,
}: {
  engineRef: RefObject<Mar3D | null>;
  worldRef: RefObject<WorldConfig | null>;
  /** El mar está listo (los atajos de la URL se leen entonces, una vez). */
  ready: boolean;
  /** Hay carrera (cuenta atrás o corriendo): el panel lo explica y no empieza. */
  raceActive: boolean;
  /** Lo mismo, leído en el momento de empezar. */
  isRaceActive: () => boolean;
  /** Al empezar: cerrar fichas, paneles, diálogos… */
  onStart: () => void;
  /** `&oferta=1`: el panel de la isla del Cañón, sin empezar. */
  onOffer: () => void;
  /**
   * Al acabar la partida (una vez, en ese momento): con abandono el mundo ya
   * ha vuelto; si no, sigue la pantalla final hasta «Volver al mar».
   */
  onEnd?: (end: CanonEnd) => void;
  /** El libro de los premios (`repo.progress`), o null. */
  rewards?: () => MinigameRewardSink | null;
}): CanonMode {
  const runRef = useRef<SurvivorsRun | null>(null);
  // La sesión de la partida en curso, hasta que se liquida (T119).
  const sessionRef = useRef<WorldMinigameSession | null>(null);
  const [ended, setEnded] = useState(false);
  const [reward, setReward] = useState<RewardOutcome | null>(null);
  const restoreRef = useRef<(() => void) | null>(null);
  const pausedRef = useRef(false);
  const [active, setActive] = useState(false);
  const [result, setResult] = useState<CanonResult | null>(null);
  const [notice, setNotice] = useState<'abandoned' | null>(null);
  const [fading, setFading] = useState(false);
  const fadeTimers = useRef<number[]>([]);
  const [hud, setHud] = useState<CanonHook | null>(null);
  const [hidden, setHiddenState] = useState<ReadonlySet<HideLayer>>(EMPTY);
  const hiddenRef = useRef<ReadonlySet<HideLayer>>(EMPTY);
  // El estilo de derrota elegido con el interruptor (se queda para la siguiente partida).
  const chosenStyle = useRef<DefeatStyle | null>(null);
  const styleRef = useRef<DefeatStyle | null>(null);
  const [defeatStyle, setDefeatStyle] = useState<DefeatStyle | null>(null);
  // La dificultad elegida en el panel de la isla: se recuerda mientras dure la visita (T131).
  const difficultyRef = useRef<DifficultyId>(DEFAULT_DIFFICULTY);
  const [difficulty, setDifficulty] = useState<DifficultyId>(DEFAULT_DIFFICULTY);
  const [devSwitch, setDevSwitch] = useState(false);
  useEffect(() => setDevSwitch(devShortcutsEnabled()), []);
  const latest = useRef({ onStart, onOffer, onEnd, isRaceActive, rewards });
  latest.current = { onStart, onOffer, onEnd, isRaceActive, rewards };

  /** Se acabó del todo: el barco se queda donde acabó y el mundo vuelve como estaba. */
  const teardown = useCallback(() => {
    const run = runRef.current;
    runRef.current = null;
    sessionRef.current?.abandon();
    sessionRef.current = null;
    engineRef.current?.stopSurvivors();
    restoreRef.current?.();
    restoreRef.current = null;
    if (run) setHud(run.hook());
    setResult(null);
    setActive(false);
  }, [engineRef]);

  /**
   * Fin de la partida (T118): con «¡Amanece!» o «¡Barco inundado!» la escena
   * se queda quieta detrás de la pantalla final hasta «Otra vez» o «Volver
   * al mar»; un abandono (más de 5 min en pausa) devuelve ya el mundo, con
   * un aviso corto.
   */
  const finish = useCallback(
    (run: SurvivorsRun, reason: EndReason, snapshot: SurvivorsSnapshot) => {
      if (runRef.current !== run) return;
      // La sesión se liquida con el tiempo activo; el premio llega después.
      const session = sessionRef.current;
      sessionRef.current = null;
      setEnded(true);
      if (session) {
        void session.finish(canonEnd(reason, snapshot.activeS)).then((s) => {
          if (runRef.current === run || !runRef.current) setReward(s.reward);
        });
      }
      latest.current.onEnd?.({ reason, snapshot });
      const r = canonResult(reason, snapshot);
      if (!r) {
        teardown();
        setNotice('abandoned');
        return;
      }
      setHud(run.hook());
      setResult(r);
    },
    [teardown],
  );

  const start = useCallback(
    ({
      t = 0,
      seed = null,
      defeatStyle: askedStyle = null,
      card = false,
      weapons = false,
      mix = false,
      difficulty: askedDifficulty = null,
    }: StartOptions = {}): boolean => {
      const g = engineRef.current;
      const w = worldRef.current;
      if (!g || !w || runRef.current || latest.current.isRaceActive()) return false;
      const sea = survivorsSea(
        w,
        g.runtime.bounds,
        { x: g.ship.x, y: g.ship.y, heading: g.ship.heading, turboCooldownS: g.turboCooldownS },
        g.solidDecor,
      );
      if (askedDifficulty) {
        difficultyRef.current = askedDifficulty;
        setDifficulty(askedDifficulty);
      }
      const run: SurvivorsRun = new SurvivorsRun(sea, {
        difficulty: difficultyRef.current,
        seed: seed ?? randomSeed(),
        quality: g.quality,
        ship: MAR_SHIP_CONFIG,
        startAtS: t,
        devWeapons: weapons && devShortcutsEnabled(),
        devMix: mix && devShortcutsEnabled(),
        onEnd: (reason, snapshot) => finish(run, reason, snapshot),
      });
      if (weapons) run.devAllWeapons();
      if (!g.startSurvivors(run)) return false;
      const gift = card && devShortcutsEnabled();
      if (gift && mix) run.devMixCard();
      else if (gift) run.devLevelUp();
      // La sesión de la partida (REQ-AVE-038): su semilla y lo que se saltó con `&t=`.
      // Una partida de prueba (atajo que la cambia) no da premio en producción (T121).
      const getSink = latest.current.rewards?.() ?? null;
      sessionRef.current = new WorldMinigameSession({
        def: canonEntry,
        config: canonConfigFor(run.config, run.difficulty),
        authority: pageAuthority(),
        sink: withWinSignal(getSink, CANON_GAME_ID, (game) => {
          void emitSignal(gameRepository(), { trigger: 'win_minigame', game });
        }),
        currentConfig: () => canonConfigFor(run.config, run.difficulty),
        seed: run.seed,
        skippedS: run.snapshot().activeS,
        devStart: isDevStart({ t, seed, card: gift, weapons: weapons && devShortcutsEnabled() }),
        devStartRewards: devStartRewards(),
      });
      setEnded(false);
      setReward(null);
      setNotice(null);
      if (askedStyle) chosenStyle.current = askedStyle;
      const style = startDefeatStyle(chosenStyle.current, run.config);
      g.setSurvivorsDefeatStyle(style);
      styleRef.current = style;
      setDefeatStyle(style);
      runRef.current = run;
      latest.current.onStart();
      run.setPaused(pausedRef.current);
      restoreRef.current = hideForGame(
        marHideHost(g, {
          get: () => hiddenRef.current,
          set: (next) => {
            hiddenRef.current = next;
            setHiddenState(next);
          },
        }),
      );
      setHud(run.hook());
      setActive(true);
      return true;
    },
    [engineRef, worldRef, finish],
  );

  const toggleDefeatStyle = useCallback(() => {
    const g = engineRef.current;
    const run = runRef.current;
    if (!g || !run || !devShortcutsEnabled()) return;
    const next = nextDefeatStyle(styleRef.current ?? run.config.defeatStyle);
    chosenStyle.current = next;
    styleRef.current = next;
    g.setSurvivorsDefeatStyle(next);
    setDefeatStyle(next);
  }, [engineRef]);

  const setPaused = useCallback((paused: boolean) => {
    pausedRef.current = paused;
    runRef.current?.setPaused(paused);
  }, []);

  const read = useCallback(() => runRef.current?.snapshot() ?? null, []);
  const choose = useCallback((index: number) => runRef.current?.choose(index), []);
  const dismissNotice = useCallback(() => setNotice(null), []);

  const again = useCallback(() => {
    teardown();
    start();
  }, [teardown, start]);

  const backToSea = useCallback(() => {
    if (!runRef.current || fadeTimers.current.length) return;
    if (reducedMotion()) {
      teardown();
      return;
    }
    setFading(true);
    fadeTimers.current = [
      window.setTimeout(teardown, FADE_SWAP_MS),
      window.setTimeout(() => {
        fadeTimers.current = [];
        setFading(false);
      }, FADE_MS),
    ];
  }, [teardown]);

  // El estado para las pruebas, unas veces por segundo.
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      const run = runRef.current;
      if (run) setHud(run.hook());
    }, HOOK_MS);
    return () => window.clearInterval(id);
  }, [active]);

  // Pestaña oculta: el bucle del 3D no corre; la pausa se apunta aquí (y a los 5 min, abandona).
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'hidden') runRef.current?.tick(performance.now(), true);
    }, HIDDEN_MS);
    return () => window.clearInterval(id);
  }, [active]);

  // Al irse del mar con la partida en curso, el mundo queda como estaba.
  useEffect(
    () => () => {
      for (const id of fadeTimers.current) window.clearTimeout(id);
      runRef.current = null;
      sessionRef.current?.abandon();
      sessionRef.current = null;
      restoreRef.current?.();
      restoreRef.current = null;
    },
    [],
  );

  // Los atajos de desarrollo (`?minijuego=canon&t=&seed=`, `&oferta=1`), una vez con el mar listo.
  const shortcutDone = useRef(false);
  useEffect(() => {
    if (!ready || shortcutDone.current) return;
    shortcutDone.current = true;
    const sc = canonShortcut(window.location.search);
    if (!sc) return;
    history.replaceState(history.state, '', withoutCanonShortcut(window.location.href));
    if (sc.offer) latest.current.onOffer();
    else {
      start({
        t: sc.t,
        seed: sc.seed,
        defeatStyle: sc.defeatStyle,
        card: sc.card,
        difficulty: sc.difficulty,
        weapons: sc.weapons,
        mix: sc.mix,
      });
    }
  }, [ready, start]);

  const blockKey = canonBlockKey({ raceActive });
  const panel = {
    inWorld: [CANON_GAME_ID],
    onPlay: (gameId: string) => {
      if (gameId === CANON_GAME_ID) start();
    },
    blockedReason: (gameId: string) =>
      gameId === CANON_GAME_ID && blockKey ? msg(blockKey) : null,
    extra: (gameId: string) =>
      gameId === CANON_GAME_ID ? (
        <CanonDifficultyPicker
          value={difficulty}
          onChange={(d) => {
            difficultyRef.current = d;
            setDifficulty(d);
          }}
        />
      ) : null,
    copy: (gameId: string) =>
      gameId === CANON_GAME_ID
        ? {
            title: msg('mar.canon.title'),
            summary: msg('mar.canon.summary'),
            badge: msg('mar.canon.beta'),
            badgeLabel: msg('mar.canon.beta.aria'),
          }
        : null,
  };

  const dev = { enabled: devSwitch, defeatStyle, toggleDefeatStyle };

  return {
    active,
    result,
    notice,
    dismissNotice,
    fading,
    read,
    choose,
    again,
    backToSea,
    hud,
    reward,
    prize: ended ? canonPrize(reward) : null,
    hidden,
    start,
    setPaused,
    dev,
    panel,
    difficulty,
  };
}

/**
 * Tranquila / Normal / Tormenta junto a «Jugar» en el panel de la isla (T131):
 * tres botones pequeños de un grupo de opciones (Normal marcado de entrada).
 * Se manejan con el teclado (Tab y flechas) y con el dedo.
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

const DEFEAT_STYLE_KEY: Readonly<Record<DefeatStyle, MessageKey>> = {
  puf: 'mar.canon.dev.derrota.puf',
  sumergirse: 'mar.canon.dev.derrota.sumergirse',
};

/**
 * El interruptor de desarrollo del estilo de derrota (T117): un botoncito
 * durante la partida que cambia entre `puf` y `sumergirse` en vivo, para
 * compararlos. Sólo con los atajos de desarrollo (`pnpm dev`, e2e o
 * `?dev=1`); se quita al lanzar, con los demás atajos.
 */
export function CanonDevSwitch({ canon }: { canon: CanonMode }) {
  const style = canon.dev.defeatStyle;
  if (!canon.active || !canon.dev.enabled || !style) return null;
  return (
    <button
      type="button"
      className="mar-canon-dev"
      data-testid="mar-canon-derrota"
      data-derrota={style}
      aria-label={msg('mar.canon.dev.derrota.aria')}
      onClick={canon.dev.toggleDefeatStyle}
    >
      {msg('mar.canon.dev.derrota', { estilo: msg(DEFEAT_STYLE_KEY[style]) })}
    </button>
  );
}

/**
 * El estado de la partida para las pruebas (como el cronómetro de la
 * carrera, `data-*`), sin nada que se vea (el HUD está en `canon-hud.tsx`).
 */
export function CanonTestHook({
  hud,
  prize = null,
}: {
  hud: CanonHook | null;
  prize?: CanonPrize | null;
}) {
  if (!hud) return null;
  return (
    <div
      hidden
      aria-hidden="true"
      data-testid="mar-canon"
      data-estado={hud.estado}
      data-tiempo={hud.tiempo}
      data-activo={hud.activo}
      data-agua={hud.agua}
      data-agua-max={hud.aguaMax}
      data-nivel={hud.nivel}
      data-enemigos={hud.enemigos}
      data-derrotados={hud.derrotados}
      data-notas={hud.notas}
      data-fin={hud.fin ?? undefined}
      data-semilla={hud.semilla}
      data-dificultad={hud.dificultad}
      data-calidad={hud.calidad}
      data-barco={hud.barco}
      data-mejoras={hud.mejoras}
      data-carta={hud.carta}
      data-premio={prize ?? undefined}
    />
  );
}

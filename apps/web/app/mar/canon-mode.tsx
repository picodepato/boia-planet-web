'use client';

import {
  type MinigameRewardSink,
  type RewardOutcome,
  WorldMinigameSession,
  canon as canonEntry,
  canonConfigFor,
  pageAuthority,
} from '@boia/engine/minigames';
import {
  DEFAULT_DIFFICULTY,
  type DefeatStyle,
  type DifficultyId,
  type EndReason,
  type SurvivorsSnapshot,
  survivorsMedal,
} from '@boia/engine/survivors';
import { type Settings, channelGain } from '@boia/engine/ui';
import type { WorldConfig } from '@boia/world';
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { accountSnapshot } from '../../lib/account/session';
import { emitSignals } from '../../lib/mundo/achievements';
import { memberCanonStanding } from '../../lib/mundo/ranking-canon-global';
import { browserCanonStorage } from '../../lib/mundo/ranking-canon';
import { isSupabaseConfigured } from '../../lib/supabase/config';
import type { InWorldCopy } from '../../lib/mundo/minigame-layer';
import { gameRepository, useRepoData } from '../../lib/mundo/repo';
import { type MessageKey, t as msg } from '../../lib/i18n';
import {
  type CampaignAct,
  type CampaignProgress,
  EMPTY_CAMPAIGN,
  actUnlocked,
  campaignActs,
  playableAct,
  readCampaign,
  recordFinalBoss,
} from './canon-campaign';
import { type CanonPrize, type CanonResult, canonPrize, canonResult } from './canon-hud-model';
import { type CanonRankDeps, type CanonRankingOutcome, rankCanonGame } from './canon-ranking-model';
import { canonSignals, settleCanonSession } from './canon-settle';
import type { CanonAudio, CanonAudioState } from './canon-audio';
import { soundPreferences } from './canon-sound-preferences';
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
 * gana medalla, su premio (T153: cada medalla una vez al día, y las de debajo
 * que aún no tuviera) y las señales de los logros del Cañón (`canonSignals`:
 * jugada, ganada y bosses vencidos). Salir a mitad (o 5 min en pausa)
 * abandona la sesión.
 * «Terminar partida» en la pausa (T148) también la abandona, pero enseña la
 * tarjeta final «Partida terminada»: sin medalla, premio, `win_minigame` ni
 * ranking.
 * Una partida de prueba (`&t=`, `&seed=`, `&carta=1`) sólo da premio en
 * `pnpm dev` y en las e2e; en producción, con `?dev=1`, no (T121).
 *
 * El ranking por boss (T155): cada partida que vale (ni de atajo ni de
 * «Terminar partida», validada por la sesión) se puntúa, se apunta como tu
 * mejor de este navegador y, con cuenta, va al ranking global; la tarjeta
 * final enseña la puntuación, tu mejor y tu puesto (`ranking`).
 */

/** El modo del ranking ahora: local sin Supabase; con él, miembro o invitado. */
function canonRankDeps(): CanonRankDeps {
  const mode = !isSupabaseConfigured()
    ? 'local'
    : accountSnapshot().status === 'member'
      ? 'member'
      : 'guest';
  return { mode, storage: browserCanonStorage(), submit: (s) => memberCanonStanding(s) };
}

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
  /**
   * «Terminar partida» desde la pausa (T148): acaba ya con `quit` y deja la
   * tarjeta «Partida terminada». Sin partida en marcha no hace nada.
   */
  quit(): void;
  /** El último estado (también el final, hasta la siguiente). */
  hud: CanonHook | null;
  /** El premio de la última partida acabada (null: aún sin acabar o liquidándose). */
  reward: RewardOutcome | null;
  /** Lo mismo en una palabra, para las pruebas (`data-premio`). */
  prize: CanonPrize | null;
  /**
   * El ranking de la última partida acabada (T155): puntuación, tu mejor y
   * tu puesto, o por qué no entra; null sin acabar, liquidándose o con
   * «Terminar partida».
   */
  ranking: CanonRankingOutcome | null;
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
  };
  /**
   * El pop-up antes de la partida (T151): «Jugar» en el panel de la isla lo
   * abre; en él se eligen acto y dificultad y se juega.
   */
  prep: CanonPrep;
  /** Los actos de la campaña tal y como salen en el pop-up (T144, T151). */
  acts: readonly CampaignAct[];
  /** La dificultad elegida para las próximas partidas (se recuerda durante la visita). */
  difficulty: DifficultyId;
  /** El acto elegido en el panel para las próximas partidas (T144; se recuerda durante la visita). */
  act: number;
  /** La campaña (T144): los actos cuyo boss final ya cayó. */
  campaign: CampaignProgress;
  /**
   * El acto que abrió la última partida al vencer a su boss final (T144,
   * para anunciarlo en la tarjeta final), o null.
   */
  unlocked: number | null;
  /** El sonido (T152): null hasta que se carga el módulo de audio. */
  sound: CanonAudioState | null;
  /** Los Ajustes de la web (música y efectos): su silencio también calla el Cañón. */
  setAudioSettings(settings: Settings | null): void;
}

export interface CanonPrep {
  open: boolean;
  /** Por qué ahora no se puede empezar (en plena carrera), o null. */
  blocked: string | null;
  chooseAct(act: number): void;
  chooseDifficulty(d: DifficultyId): void;
  /** «Jugar»: cierra el pop-up y empieza el acto y la dificultad elegidos. */
  play(): void;
  /** Esc, la × o tocar fuera: se cierra y vuelve el panel de la isla. */
  close(): void;
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
  /** `&botin=1` (T135): el botín siempre y de regalo al empezar. */
  loot?: boolean;
  /** `&acto=<n>` (T142): jugar ese acto; sólo con los atajos encendidos. */
  act?: number | null;
  /** `&vencer=1` (T144): los bosses caen en cuanto aparecen; sólo con los atajos encendidos. */
  win?: boolean;
  /** `&ranking=1` (T155): la partida de atajo entra en el ranking local; sólo donde los atajos dan premio. */
  rank?: boolean;
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
  onSea,
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
  /**
   * El ambiente del mar de `/mar` (T152): se calla durante la partida y
   * vuelve al acabar, cuando el bucle de batalla se funde.
   */
  onSea?: (on: boolean) => void;
}): CanonMode {
  const runRef = useRef<SurvivorsRun | null>(null);
  // La sesión de la partida en curso, hasta que se liquida (T119).
  const sessionRef = useRef<WorldMinigameSession | null>(null);
  const [ended, setEnded] = useState(false);
  const [reward, setReward] = useState<RewardOutcome | null>(null);
  const [ranking, setRanking] = useState<CanonRankingOutcome | null>(null);
  // El ayudante `&ranking=1` de la partida en curso (T155).
  const rankHelperRef = useRef(false);
  // La última partida acabó con «Terminar partida» (T148).
  const [quit, setQuit] = useState(false);
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
  // El acto elegido en el panel (T144): se recuerda mientras dure la visita; sólo los abiertos.
  const actRef = useRef(1);
  const [act, setAct] = useState(1);
  const [unlocked, setUnlocked] = useState<number | null>(null);
  // El pop-up antes de la partida (T151).
  const [prepOpen, setPrepOpen] = useState(false);
  // La campaña del progreso (local o de la cuenta), releída con cada cambio del repositorio.
  const { data: campaignData } = useRepoData((repo) => readCampaign(repo.progress));
  const campaign = campaignData ?? EMPTY_CAMPAIGN;
  const campaignRef = useRef<CampaignProgress>(campaign);
  campaignRef.current = campaign;
  const [devSwitch, setDevSwitch] = useState(false);
  useEffect(() => setDevSwitch(devShortcutsEnabled()), []);
  const latest = useRef({ onStart, onOffer, onEnd, isRaceActive, rewards, onSea });
  latest.current = { onStart, onOffer, onEnd, isRaceActive, rewards, onSea };

  // El sonido (T152): el módulo se carga aparte, al abrir el pop-up o al empezar.
  const audioRef = useRef<CanonAudio | null>(null);
  const audioLoading = useRef(false);
  const audioSettings = useRef<Settings | null>(null);
  const [sound, setSound] = useState<CanonAudioState | null>(null);
  const applyGlobal = useCallback((audio: CanonAudio) => {
    const s = audioSettings.current;
    if (s) audio.setGlobal({ music: channelGain(s.music), sfx: channelGain(s.sfx) });
  }, []);
  const loadAudio = useCallback(() => {
    if (audioRef.current || audioLoading.current || typeof window === 'undefined') return;
    audioLoading.current = true;
    import('./canon-audio')
      .then((m) => {
        const audio = m.createPageCanonAudio(soundPreferences(), (on) => latest.current.onSea?.(on));
        audioRef.current = audio;
        applyGlobal(audio);
        audio.setPaused(pausedRef.current);
        // Si la partida ya empezó mientras se cargaba, su bucle.
        const run = runRef.current;
        if (run && !run.ended) {
          audio.setMusic('battle');
          audio.setBoss(run.hook().jefes !== '');
        }
        audio.subscribe(() => setSound(audio.state()));
        setSound(audio.state());
      })
      .catch((err: unknown) => {
        audioLoading.current = false;
        console.warn('[boia] no se pudo cargar el sonido del Cañón', err);
      });
  }, [applyGlobal]);
  const setAudioSettings = useCallback(
    (settings: Settings | null) => {
      audioSettings.current = settings;
      if (audioRef.current) applyGlobal(audioRef.current);
    },
    [applyGlobal],
  );

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
      setUnlocked(null);
      setQuit(reason === 'quit');
      // «Terminar partida» (T148): la sesión se abandona, sin liquidar ni premio.
      const medal = survivorsMedal(
        { end: reason, bossesDefeated: snapshot.bossesDefeated, act: run.act },
        run.config,
      );
      const settling = session
        ? settleCanonSession(session, reason, snapshot.activeS, medal, run.config)
        : null;
      const r = canonResult(reason, snapshot);
      const rankHelper = rankHelperRef.current;
      setRanking(null);
      if (session && settling) {
        // La campaña (T144) y los logros (T153) cuentan como el premio: una
        // partida de prueba sólo donde el premio vale.
        const counts = !session.testStart || devStartRewards();
        void settling.then((s) => {
          const current = () => runRef.current === run || !runRef.current;
          if (current()) setReward(s.reward);
          // El ranking (T155): la puntuación ya; con cuenta, el puesto después.
          if (r) {
            const { now, later } = rankCanonGame(
              { result: r, testStart: session.testStart, testHelper: rankHelper, valid: s.validation.valid },
              canonRankDeps(),
              run.config,
            );
            if (current()) setRanking(now);
            void later?.then((o) => {
              if (current()) setRanking(o);
            });
          }
          void emitSignals(
            gameRepository(),
            canonSignals(s, counts, {
              medal,
              bosses: snapshot.bossesDefeated,
              difficulty: run.difficulty,
            }),
          );
          if (reason !== 'victory' || !counts || !s.validation.valid) return;
          const next = run.act + 1;
          const opened =
            campaignActs(campaignRef.current, run.config).find((a) => a.act === next)?.state === 'locked';
          void recordFinalBoss(gameRepository().progress, run.act, run.config).then(
            (ok) => {
              if (ok && opened && (runRef.current === run || !runRef.current)) setUnlocked(next);
            },
            (err: unknown) => console.warn('[boia] no se pudo guardar la campaña del Cañón', err),
          );
        });
      }
      latest.current.onEnd?.({ reason, snapshot });
      // El bucle se funde y vuelve el mar (sin el módulo cargado aún, sólo el mar).
      if (audioRef.current) audioRef.current.end(reason, run.hook().medalla || null);
      else latest.current.onSea?.(true);
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
      loot = false,
      act = null,
      win = false,
      rank = false,
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
      const devAct = act !== null && devShortcutsEnabled() ? act : null;
      // El acto del panel (T144), si está abierto; el atajo `&acto=` se salta la campaña.
      const playAct = devAct ?? playableAct(campaignRef.current, actRef.current);
      const devWin = win && devShortcutsEnabled();
      const run: SurvivorsRun = new SurvivorsRun(sea, {
        difficulty: difficultyRef.current,
        seed: seed ?? randomSeed(),
        quality: g.quality,
        ship: MAR_SHIP_CONFIG,
        startAtS: t,
        devWeapons: weapons && devShortcutsEnabled(),
        devMix: mix && devShortcutsEnabled(),
        devLoot: loot && devShortcutsEnabled(),
        act: playAct,
        devWin,
        onEnd: (reason, snapshot) => finish(run, reason, snapshot),
        onEvents: (events) => audioRef.current?.events(events),
      });
      if (weapons) run.devAllWeapons();
      if (loot) run.devLoot();
      if (!g.startSurvivors(run)) return false;
      const gift = card && devShortcutsEnabled();
      if (gift && mix) run.devMixCard();
      else if (gift) run.devLevelUp();
      // La sesión de la partida (REQ-AVE-038): su semilla y lo que se saltó con `&t=`.
      // Una partida de prueba (atajo que la cambia) no da premio en producción (T121).
      const getSink = latest.current.rewards?.() ?? null;
      sessionRef.current = new WorldMinigameSession({
        def: canonEntry,
        config: canonConfigFor(run.config, run.difficulty, run.act),
        authority: pageAuthority(),
        sink: getSink,
        currentConfig: () => canonConfigFor(run.config, run.difficulty, run.act),
        seed: run.seed,
        skippedS: run.snapshot().activeS,
        devStart: isDevStart({
          t,
          seed,
          card: gift,
          weapons: weapons && devShortcutsEnabled(),
          loot: loot && devShortcutsEnabled(),
          act: devAct,
          win: devWin,
        }),
        devStartRewards: devStartRewards(),
      });
      setPrepOpen(false);
      setEnded(false);
      setQuit(false);
      setReward(null);
      setRanking(null);
      rankHelperRef.current = rank && devStartRewards();
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
      // El sonido: dentro del gesto de «Jugar» si ya está cargado (iOS lo pide así).
      const audio = audioRef.current;
      if (audio) {
        audio.unlock();
        audio.setMusic('battle');
      } else {
        latest.current.onSea?.(false);
        loadAudio();
      }
      return true;
    },
    [engineRef, worldRef, finish, loadAudio],
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
    audioRef.current?.setPaused(paused);
  }, []);

  const quitGame = useCallback(() => {
    const run = runRef.current;
    if (run && !run.ended) run.quit();
  }, []);

  const read = useCallback(() => runRef.current?.snapshot() ?? null, []);
  const choose = useCallback((index: number) => {
    const run = runRef.current;
    if (!run || run.game.status !== 'card') return;
    run.choose(index);
    audioRef.current?.play('card');
  }, []);
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
      if (!run) return;
      const hook = run.hook();
      setHud(hook);
      // El bucle de boss mientras haya uno vivo (T152).
      if (!run.ended) audioRef.current?.setBoss(hook.jefes !== '');
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
      audioRef.current?.dispose();
      audioRef.current = null;
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
        loot: sc.loot,
        act: sc.act,
        win: sc.win,
        rank: sc.rank,
      });
    }
  }, [ready, start]);

  const blockKey = canonBlockKey({ raceActive });
  const panel = {
    inWorld: [CANON_GAME_ID],
    // «Jugar» en el panel abre el pop-up (T151); la partida empieza desde él.
    onPlay: (gameId: string) => {
      if (gameId === CANON_GAME_ID && !runRef.current) {
        setPrepOpen(true);
        loadAudio();
      }
    },
    blockedReason: (gameId: string) =>
      gameId === CANON_GAME_ID && blockKey ? msg(blockKey) : null,
    copy: (gameId: string) =>
      gameId === CANON_GAME_ID
        ? {
            title: msg('mar.canon.title'),
            summary: msg('mar.canon.summary'),
          }
        : null,
  };

  const dev = { enabled: devSwitch, defeatStyle, toggleDefeatStyle };

  const prep: CanonPrep = {
    open: prepOpen,
    blocked: blockKey ? msg(blockKey) : null,
    chooseAct: (a: number) => {
      if (!actUnlocked(campaignRef.current, a)) return;
      actRef.current = a;
      setAct(a);
    },
    chooseDifficulty: (d: DifficultyId) => {
      difficultyRef.current = d;
      setDifficulty(d);
    },
    play: () => {
      if (blockKey) return;
      if (start()) setPrepOpen(false);
    },
    close: () => {
      setPrepOpen(false);
      latest.current.onOffer();
    },
  };

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
    quit: quitGame,
    hud,
    reward,
    prize: ended ? (quit ? 'quit' : canonPrize(reward)) : null,
    ranking: ended && !quit ? ranking : null,
    hidden,
    start,
    setPaused,
    dev,
    panel,
    difficulty,
    act: playableAct(campaign, act),
    campaign,
    prep,
    acts: campaignActs(campaign),
    unlocked,
    sound,
    setAudioSettings,
  };
}

/** El bucle que suena, para las pruebas (`data-musica`). */
const MUSIC_ATTR: Readonly<Record<CanonAudioState['music'], string>> = {
  battle: 'batalla',
  boss: 'jefe',
  sea: 'mar',
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
  unlocked = null,
  sound = null,
}: {
  hud: CanonHook | null;
  prize?: CanonPrize | null;
  /** El acto que abrió la última partida (T144), o null. */
  unlocked?: number | null;
  /** El sonido (T152), o null sin cargar. */
  sound?: CanonAudioState | null;
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
      data-botin={hud.botin}
      data-botin-agua={hud.botinAgua}
      data-botin-cerca={hud.botinCerca || undefined}
      data-llama={hud.llama}
      data-acto={hud.acto}
      data-medalla={hud.medalla || undefined}
      data-vencidos={hud.vencidos || undefined}
      data-desbloqueado={unlocked ?? undefined}
      data-jefes={hud.jefes || undefined}
      data-cofre-cerca={hud.cofreCerca || undefined}
      data-premio={prize ?? undefined}
      data-sonido={sound ? (sound.unlocked ? (sound.hidden ? 'oculto' : 'activo') : 'bloqueado') : undefined}
      data-musica={sound ? MUSIC_ATTR[sound.music] : undefined}
    />
  );
}

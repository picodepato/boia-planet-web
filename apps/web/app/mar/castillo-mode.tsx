'use client';

import {
  DEFAULT_DEFENSE_RUN_MIN,
  type DefenseMedal,
  type DefenseResult,
  type DefenseRunMin,
  type DefenseSnapshot,
  type DifficultyId,
} from '@boia/engine/defense';
import { DEFAULT_DIFFICULTY } from '@boia/engine/survivors';
import type { Settings } from '@boia/engine/ui';
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { t as msg } from '../../lib/i18n';
import { accountSnapshot } from '../../lib/account/session';
import { isSupabaseConfigured } from '../../lib/supabase/config';
import { browserCastleStorage } from '../../lib/mundo/ranking-castle';
import { memberCastleStanding } from '../../lib/mundo/ranking-castle-global';
import { type CastleRankingOutcome, rankCastleGame } from './castillo-ranking-model';
import {
  type CastleMedals,
  EMPTY_CASTLE_MEDALS,
  readCastleMedals,
  recordCastleMedal,
} from '../../lib/mundo/castle-medals';
import { gameRepository, useRepoData } from '../../lib/mundo/repo';
import {
  type CastleHook,
  type CastleShortcut,
  DefenseRun,
  castleShortcut,
  withoutCastleShortcut,
} from './castillo';
import type { Mar3D } from './engine/mar3d';
import {
  type DefenseOverlayPrefs,
  readDefenseOverlays,
  saveDefenseOverlays,
} from './engine/defense-overlays';
import type { CanonAudioState } from './canon-audio';
import { useCastleAudio } from './castillo-audio-mode';
import { type CastleUnlock, castleSignals, recordCastleWin } from './castillo-logros';
import {
  CASTLE_GUIDE_PREF,
  type CastleGuideAnswer,
  type CastleGuideTally,
  EMPTY_GUIDE_TALLY,
  guideAnswer,
  playChoice,
  tallyGuide,
} from './castillo-guia-model';
import { type HideLayer, devStartRewards, hideForGame, marHideHost, randomSeed } from './survivors';

/**
 * «Defensa del Castillo» en `/mar` (plan 014 T160), del lado de React:
 * empezar la partida (desde el pop-up de su isla, T162, o con el atajo de
 * desarrollo `?minijuego=castillo`), esconder las capas del mundo
 * como el Cañón (`HideLayer`) mientras el motor hunde islas y decorado, y
 * devolverlo todo igual al acabar. El estado para las pruebas va en
 * `data-testid="mar-castillo"`. `mar-client` sólo lo cablea. El HUD (T161,
 * `castillo-hud.tsx`) lee la partida con `read()` y `run()`; al acabar (o con
 * «Terminar partida») la arena se queda con su tarjeta hasta «Volver al mar».
 */

const EMPTY: ReadonlySet<HideLayer> = new Set();
const NONE: readonly CastleUnlock[] = [];
/** Cada cuánto se publica el estado de la partida (ms). */
const HOOK_MS = 250;
/** Cada cuánto, con la pestaña oculta, se apunta la pausa (ms). */
const HIDDEN_MS = 1000;

/** Cómo empieza una partida: lo que se eligió en el pop-up y, si los hay, los atajos. */
interface CastleStart {
  runMin: DefenseRunMin;
  difficulty: DifficultyId;
  /** Los atajos de desarrollo de la URL (la partida no entra en el ranking), o null. */
  dev: CastleShortcut | null;
  /** Con la guía de la primera partida (plan 015 T173). */
  guide: boolean;
}

/**
 * El pop-up antes de la partida (T162, el patrón del Cañón de T151): «Jugar»
 * en el panel de la isla lo abre; en él se eligen dificultad y duración.
 */
export interface CastlePrep {
  open: boolean;
  /** Por qué ahora no se puede empezar (en plena carrera), o null. */
  blocked: string | null;
  runMin: DefenseRunMin;
  difficulty: DifficultyId;
  chooseRunMin(m: DefenseRunMin): void;
  chooseDifficulty(d: DifficultyId): void;
  /**
   * «Jugar»: cierra el pop-up y empieza con lo elegido; la primera vez
   * (sin respuesta guardada) antes pregunta «¿Empezar con la guía?».
   */
  play(): void;
  /** Se está preguntando «¿Empezar con la guía?» (plan 015 T173). */
  asking: boolean;
  /** Ya se respondió alguna vez: el pop-up deja repetir la guía. */
  answered: boolean;
  /** «Con la guía» marcado (repetirla en la próxima partida). */
  replay: boolean;
  setReplay(on: boolean): void;
  /** «Sí» / «No, jugar»: guarda la respuesta y empieza. */
  answer(withGuide: boolean): void;
  /** Vuelve de la pregunta a elegir dificultad y duración. */
  back(): void;
  /** Esc, la × o tocar fuera: se cierra y vuelve el panel de la isla. */
  close(): void;
}

/** La medalla de la última partida acabada, ya guardada (T162). */
export interface CastleMedalRecord {
  medal: DefenseMedal;
  /** Es la mejor que había en su par (duración × dificultad). */
  improved: boolean;
}

/** La guía de la partida en curso (plan 015 T173). */
export interface CastleGuide {
  /** La partida en curso va con la guía (hasta acabarla o saltarla). */
  on: boolean;
  /** Lo que el jugador ha hecho desde que empezó la guía (de los eventos de la partida). */
  tally(): CastleGuideTally;
  /** Acaba la guía («Saltar guía» o el último paso): la partida sigue igual. */
  end(): void;
}

export interface CastleMode {
  sound: CanonAudioState | null;
  prepareAudio(): void;
  setAudioSettings(settings: Settings | null): void;
  /** Hay partida del castillo en curso. */
  active: boolean;
  /** Lo que la partida tiene escondido ahora (las mismas capas que el Cañón). */
  hidden: ReadonlySet<HideLayer>;
  /** El último estado (también el final, hasta la siguiente). */
  hud: CastleHook | null;
  /** El estado de la partida ahora (para el HUD; no guardarlo), o null. */
  read(): DefenseSnapshot | null;
  /** La partida en curso (construir, elegir, mejorar… van por ella), o null. */
  run(): DefenseRun | null;
  /** El resumen de la partida acabada (la tarjeta final), o null mientras se juega. */
  result: DefenseResult | null;
  /** Pausa (un panel o el menú encima) o sigue. */
  setPaused(paused: boolean): void;
  /** «Terminar partida» (T148 en el Cañón): acaba ya; la tarjeta «Partida terminada» se queda. */
  quit(): void;
  /** Acaba la partida (si sigue) y devuelve el mundo como estaba. */
  leave(): void;
  /** «Otra vez» (T162): una partida nueva igual que la última. */
  again(): void;
  /** El pop-up antes de la partida (T162). */
  prep: CastlePrep;
  /** Lo que el panel de la isla necesita para el castillo. */
  panel: {
    onPlay: () => void;
    blockedReason: () => string | null;
  };
  /** La mejor medalla de cada par duración × dificultad (del progreso). */
  medals: CastleMedals;
  /** La medalla de la última partida, si la hubo y se guardó; null si no. */
  record: CastleMedalRecord | null;
  /** Tu mejor puntuación y puesto de esta partida (T163). */
  ranking: CastleRankingOutcome | null;
  /** Los logros que esta partida acaba de completar (plan 015 T176), para la tarjeta. */
  unlocked: readonly CastleUnlock[];
  /**
   * Barras de vida y números de daño en la arena (plan 015 T170, decisión
   * 11): encendidos al principio y guardados en el dispositivo. El
   * interruptor de la pausa (T171) llama a `setOverlays`.
   */
  overlays: DefenseOverlayPrefs;
  setOverlays(prefs: DefenseOverlayPrefs): void;
  /** La guía de la primera partida (plan 015 T173). */
  guide: CastleGuide;
}

export function useCastleMode({
  engineRef,
  ready,
  isBusy,
  raceActive = false,
  onStart,
  onOffer,
  onSea,
}: {
  engineRef: RefObject<Mar3D | null>;
  /** El mar está listo (el atajo de la URL se lee entonces, una vez). */
  ready: boolean;
  /** Hay otra cosa en marcha (el Cañón, la carrera): no empieza. */
  isBusy: () => boolean;
  /** Hay carrera (cuenta atrás o corriendo): el panel y el pop-up lo explican y no empieza. */
  raceActive?: boolean;
  /** Al empezar: cerrar fichas, paneles, diálogos… */
  onStart: () => void;
  /** El panel de la isla del castillo (al cerrar el pop-up y con `oferta=1`). */
  onOffer?: () => void;
  onSea?: (on: boolean) => void;
}): CastleMode {
  const runRef = useRef<DefenseRun | null>(null);
  const {
    start: startAudio,
    events: audioEvents,
    end: endAudio,
    sync: syncAudio,
    setPaused: pauseAudio,
    sound,
    prepare: prepareAudio,
    setAudioSettings,
  } = useCastleAudio(runRef, onSea);
  const restoreRef = useRef<(() => void) | null>(null);
  const pausedRef = useRef(false);
  const [active, setActive] = useState(false);
  const [hud, setHud] = useState<CastleHook | null>(null);
  const [hidden, setHiddenState] = useState<ReadonlySet<HideLayer>>(EMPTY);
  const hiddenRef = useRef<ReadonlySet<HideLayer>>(EMPTY);
  const [result, setResult] = useState<DefenseResult | null>(null);
  const latest = useRef({ onStart, isBusy, onOffer });
  latest.current = { onStart, isBusy, onOffer };
  // El pop-up (T162): lo elegido se recuerda durante la visita.
  const [prepOpen, setPrepOpen] = useState(false);
  const [runMin, setRunMin] = useState<DefenseRunMin>(DEFAULT_DEFENSE_RUN_MIN);
  const [difficulty, setDifficulty] = useState<DifficultyId>(DEFAULT_DIFFICULTY);
  // Los atajos de `oferta=1`, para la partida que se empiece desde el pop-up.
  const devPending = useRef<CastleShortcut | null>(null);
  // Cómo empezó la última partida («Otra vez» empieza otra igual).
  const lastStart = useRef<CastleStart | null>(null);
  // Las medallas (T162): del progreso, releídas con cada cambio del repositorio.
  const { data: medalData } = useRepoData((repo) => readCastleMedals(repo.progress));
  const medals = medalData ?? EMPTY_CASTLE_MEDALS;
  const [record, setRecord] = useState<CastleMedalRecord | null>(null);
  const [ranking, setRanking] = useState<CastleRankingOutcome | null>(null);
  const [unlocked, setUnlocked] = useState<readonly CastleUnlock[]>(NONE);
  // La guía (T173): la respuesta guardada, la pregunta, «Con la guía» y la de ahora.
  const { data: guidePref } = useRepoData((repo) => repo.progress.pref(CASTLE_GUIDE_PREF));
  const [savedAnswer, setSavedAnswer] = useState<CastleGuideAnswer | null>(null);
  const answer = guideAnswer(guidePref) ?? savedAnswer;
  const [asking, setAsking] = useState(false);
  const [replay, setReplay] = useState(false);
  const [guideOn, setGuideOn] = useState(false);
  const guideTally = useRef<CastleGuideTally>(EMPTY_GUIDE_TALLY);
  // Las barras y los números (decisión 11): lo guardado, al montar (en el servidor, lo de siempre).
  const [overlays, setOverlayState] = useState<DefenseOverlayPrefs>(() => readDefenseOverlays(null));
  useEffect(() => setOverlayState(readDefenseOverlays()), []);
  useEffect(() => {
    engineRef.current?.setDefenseOverlays(overlays);
  }, [engineRef, overlays, active]);
  const setOverlays = useCallback((prefs: DefenseOverlayPrefs) => {
    saveDefenseOverlays(prefs);
    setOverlayState({ bars: prefs.bars, numbers: prefs.numbers });
  }, []);

  const leave = useCallback(() => {
    const run = runRef.current;
    runRef.current = null;
    if (run && !run.ended) run.quit();
    engineRef.current?.stopDefense();
    restoreRef.current?.();
    restoreRef.current = null;
    if (run) setHud(run.hook());
    setResult(null);
    setRecord(null);
    setRanking(null);
    setUnlocked(NONE);
    setGuideOn(false);
    setActive(false);
  }, [engineRef]);

  const quit = useCallback(() => {
    const run = runRef.current;
    if (run && !run.ended) run.quit();
    if (run) setHud(run.hook());
  }, []);

  const start = useCallback(
    (how: CastleStart): boolean => {
      const g = engineRef.current;
      if (!g || runRef.current || latest.current.isBusy()) return false;
      const sc = how.dev;
      const run = new DefenseRun({
        seed: sc?.seed ?? randomSeed(),
        quality: g.quality,
        runMin: how.runMin,
        difficulty: how.difficulty,
        startAtS: sc?.t ?? 0,
        devIslands: sc?.islands ?? false,
        devFullArena: sc?.fullArena ?? false,
        ...(sc?.coins ? { devCoins: sc.coins } : {}),
        devWin: sc?.win ?? false,
        // Cualquier atajo (también `duracion=` o `dificultad=` solos): fuera del ranking.
        devStart: sc !== null,
        onEvents: (events) => {
          // La guía sólo cuenta lo que pasó (T173): nunca toca la partida.
          if (runRef.current === run) guideTally.current = tallyGuide(guideTally.current, events);
          audioEvents(events);
        },
        onEnd: (reason) => {
          endAudio(reason);
          // En el paso del bucle del mar: la tarjeta sale en el render siguiente.
          const r = run.game.result();
          setResult(r);
          setHud(run.hook());
          if (r) {
            const ranked = rankCastleGame(r, {
              mode: !isSupabaseConfigured()
                ? 'local'
                : accountSnapshot().status === 'member'
                  ? 'member'
                  : 'guest',
              storage: browserCastleStorage(),
              submit: memberCastleStanding,
            });
            setRanking(ranked.now);
            void ranked.later?.then((outcome) => {
              if (runRef.current === run) setRanking(outcome);
            });
          }
          // Una partida de atajo sólo cuenta donde los atajos dan premio (como el Cañón, T121).
          const counts = !run.devStart || devStartRewards();
          // Los logros (plan 015 T176): ganar en cada dificultad; la tarjeta dice qué se desbloqueó.
          void recordCastleWin(gameRepository(), castleSignals(r, counts)).then(
            (u) => {
              if (runRef.current === run && u.length > 0) setUnlocked(u);
            },
            (err: unknown) => console.warn('[boia] no se pudo apuntar el logro del castillo', err),
          );
          // La medalla (T162): la mejor de su par se queda en el progreso.
          if (!r?.medal || !counts) return;
          const medal = r.medal;
          void recordCastleMedal(gameRepository().progress, r.runMin, r.difficulty, medal).then(
            (o) => {
              if (runRef.current === run) setRecord({ medal, improved: o.improved });
            },
            (err: unknown) =>
              console.warn('[boia] no se pudo guardar la medalla del castillo', err),
          );
        },
      });
      if (!g.startDefense(run)) return false;
      runRef.current = run;
      // «Otra vez» empieza una igual, pero sin la guía.
      lastStart.current = { ...how, guide: false };
      guideTally.current = EMPTY_GUIDE_TALLY;
      setGuideOn(how.guide);
      setPrepOpen(false);
      setAsking(false);
      setReplay(false);
      setRecord(null);
      setRanking(null);
      setUnlocked(NONE);
      startAudio();
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
      setResult(null);
      setActive(true);
      return true;
    },
    [engineRef, startAudio, audioEvents, endAudio],
  );

  const setPaused = useCallback(
    (paused: boolean) => {
      pausedRef.current = paused;
      runRef.current?.setPaused(paused);
      pauseAudio(paused);
    },
    [pauseAudio],
  );

  const read = useCallback(() => runRef.current?.snapshot() ?? null, []);
  const run = useCallback(() => runRef.current, []);

  const again = useCallback(() => {
    const how = lastStart.current;
    leave();
    if (how) start(how);
  }, [leave, start]);

  // El estado para las pruebas, unas veces por segundo.
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      const run = runRef.current;
      if (run) setHud(run.hook());
      syncAudio();
    }, HOOK_MS);
    return () => window.clearInterval(id);
  }, [active, syncAudio]);

  // Pestaña oculta: el bucle del 3D no corre; la pausa se apunta aquí.
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
      runRef.current = null;
      restoreRef.current?.();
      restoreRef.current = null;
    },
    [],
  );

  // El atajo de desarrollo (`?minijuego=castillo&…`), una vez con el mar listo.
  const shortcutDone = useRef(false);
  useEffect(() => {
    if (!ready || shortcutDone.current) return;
    shortcutDone.current = true;
    const sc = castleShortcut(window.location.search);
    if (!sc) return;
    history.replaceState(history.state, '', withoutCastleShortcut(window.location.href));
    if (sc.runMin) setRunMin(sc.runMin);
    if (sc.difficulty) setDifficulty(sc.difficulty);
    if (sc.offer) {
      // El panel de la isla; los atajos esperan a «Jugar» en el pop-up.
      devPending.current = sc;
      latest.current.onOffer?.();
      return;
    }
    start({
      runMin: sc.runMin ?? DEFAULT_DEFENSE_RUN_MIN,
      difficulty: sc.difficulty ?? DEFAULT_DIFFICULTY,
      dev: sc,
      guide: false,
    });
  }, [ready, start]);

  const blocked = raceActive ? msg('mar.castillo.bloqueo.carrera') : null;
  const begin = (guide: boolean) => {
    if (blocked) return;
    const dev = devPending.current;
    if (start({ runMin, difficulty, dev, guide })) devPending.current = null;
  };
  const prep: CastlePrep = {
    open: prepOpen,
    blocked,
    runMin,
    difficulty,
    chooseRunMin: setRunMin,
    chooseDifficulty: setDifficulty,
    play: () => {
      if (blocked) return;
      const choice = playChoice(answer, replay);
      if (choice.ask) setAsking(true);
      else begin(choice.guide);
    },
    asking: prepOpen && asking,
    answered: answer !== null,
    replay,
    setReplay,
    answer: (withGuide) => {
      if (blocked) return;
      const value: CastleGuideAnswer = withGuide ? 'si' : 'no';
      setSavedAnswer(value);
      void gameRepository()
        .progress.setPref(CASTLE_GUIDE_PREF, value)
        .catch((err: unknown) =>
          console.warn('[boia] no se pudo guardar la respuesta de la guía del castillo', err),
        );
      begin(withGuide);
    },
    back: () => setAsking(false),
    close: () => {
      setPrepOpen(false);
      setAsking(false);
      latest.current.onOffer?.();
    },
  };
  const guide: CastleGuide = {
    on: guideOn && active,
    tally: () => guideTally.current,
    end: () => setGuideOn(false),
  };
  const panel = {
    onPlay: () => {
      if (runRef.current) return;
      setAsking(false);
      setPrepOpen(true);
      // El sonido se carga ya, para sonar en el gesto de «Jugar» (como el Cañón).
      prepareAudio();
    },
    blockedReason: () => blocked,
  };

  return {
    active,
    hidden,
    hud,
    read,
    run,
    result,
    setPaused,
    quit,
    leave,
    again,
    prep,
    panel,
    medals,
    record: result ? record : null,
    ranking: result ? ranking : null,
    unlocked: result ? unlocked : NONE,
    sound,
    prepareAudio,
    setAudioSettings,
    overlays,
    setOverlays,
    guide,
  };
}

/** El estado de la partida para las pruebas (`data-*`), sin nada que se vea. */
export function CastleTestHook({
  hud,
  sound,
  guide = false,
}: {
  hud: CastleHook | null;
  sound?: CanonAudioState | null;
  /** La partida va con la guía (T173). */
  guide?: boolean;
}) {
  if (!hud) return null;
  return (
    <div
      hidden
      aria-hidden="true"
      data-testid="mar-castillo"
      data-sonido={
        sound ? (sound.unlocked ? (sound.hidden ? 'oculto' : 'activo') : 'bloqueado') : undefined
      }
      data-musica={
        sound ? ({ battle: 'batalla', boss: 'jefe', sea: 'mar' } as const)[sound.music] : undefined
      }
      data-estado={hud.estado}
      data-tiempo={hud.tiempo}
      data-activo={hud.activo}
      data-vida={hud.vida}
      data-vida-max={hud.vidaMax}
      data-monedas={hud.monedas}
      data-enemigos={hud.enemigos}
      data-derrotados={hud.derrotados}
      data-islas={hud.islas}
      data-colocando={hud.colocando || undefined}
      data-seleccion={hud.seleccion || undefined}
      data-avion-nivel={hud.avionNivel}
      data-avion-velocidad={hud.avionVelocidad}
      data-castillo-nivel={hud.castilloNivel}
      data-escala={hud.escala}
      data-adelanto={hud.adelanto}
      data-avion={hud.avion}
      data-fin={hud.fin ?? undefined}
      data-semilla={hud.semilla}
      data-dificultad={hud.dificultad}
      data-duracion={hud.duracion}
      data-calidad={hud.calidad}
      data-guia={guide ? 'si' : 'no'}
    />
  );
}

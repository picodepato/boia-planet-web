'use client';

import type { DefenseResult, DefenseSnapshot } from '@boia/engine/defense';
import type { Settings } from '@boia/engine/ui';
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import {
  type CastleHook,
  type CastleShortcut,
  DefenseRun,
  castleShortcut,
  withoutCastleShortcut,
} from './castillo';
import type { Mar3D } from './engine/mar3d';
import type { CanonAudioState } from './canon-audio';
import { useCastleAudio } from './castillo-audio-mode';
import { type HideLayer, hideForGame, marHideHost, randomSeed } from './survivors';

/**
 * «Defensa del Castillo» en `/mar` (plan 014 T160), del lado de React:
 * empezar la partida (de momento, sólo con el atajo de desarrollo
 * `?minijuego=castillo`; el pop-up es de T162), esconder las capas del mundo
 * como el Cañón (`HideLayer`) mientras el motor hunde islas y decorado, y
 * devolverlo todo igual al acabar. El estado para las pruebas va en
 * `data-testid="mar-castillo"`. `mar-client` sólo lo cablea. El HUD (T161,
 * `castillo-hud.tsx`) lee la partida con `read()` y `run()`; al acabar (o con
 * «Terminar partida») la arena se queda con su tarjeta hasta «Volver al mar».
 */

const EMPTY: ReadonlySet<HideLayer> = new Set();
/** Cada cuánto se publica el estado de la partida (ms). */
const HOOK_MS = 250;
/** Cada cuánto, con la pestaña oculta, se apunta la pausa (ms). */
const HIDDEN_MS = 1000;

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
}

export function useCastleMode({
  engineRef,
  ready,
  isBusy,
  onStart,
  onSea,
}: {
  engineRef: RefObject<Mar3D | null>;
  /** El mar está listo (el atajo de la URL se lee entonces, una vez). */
  ready: boolean;
  /** Hay otra cosa en marcha (el Cañón, la carrera): no empieza. */
  isBusy: () => boolean;
  /** Al empezar: cerrar fichas, paneles, diálogos… */
  onStart: () => void;
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
  const latest = useRef({ onStart, isBusy });
  latest.current = { onStart, isBusy };

  const leave = useCallback(() => {
    const run = runRef.current;
    runRef.current = null;
    if (run && !run.ended) run.quit();
    engineRef.current?.stopDefense();
    restoreRef.current?.();
    restoreRef.current = null;
    if (run) setHud(run.hook());
    setResult(null);
    setActive(false);
  }, [engineRef]);

  const quit = useCallback(() => {
    const run = runRef.current;
    if (run && !run.ended) run.quit();
    if (run) setHud(run.hook());
  }, []);

  const start = useCallback(
    (sc: CastleShortcut): boolean => {
      const g = engineRef.current;
      if (!g || runRef.current || latest.current.isBusy()) return false;
      const run = new DefenseRun({
        seed: sc.seed ?? randomSeed(),
        quality: g.quality,
        ...(sc.runMin ? { runMin: sc.runMin } : {}),
        ...(sc.difficulty ? { difficulty: sc.difficulty } : {}),
        startAtS: sc.t,
        devIslands: sc.islands,
        ...(sc.coins ? { devCoins: sc.coins } : {}),
        onEvents: audioEvents,
        onEnd: (reason) => {
          endAudio(reason);
          // En el paso del bucle del mar: la tarjeta sale en el render siguiente.
          setResult(run.game.result());
          setHud(run.hook());
        },
      });
      if (!g.startDefense(run)) return false;
      runRef.current = run;
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
    start(sc);
  }, [ready, start]);

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
    sound,
    prepareAudio,
    setAudioSettings,
  };
}

/** El estado de la partida para las pruebas (`data-*`), sin nada que se vea. */
export function CastleTestHook({
  hud,
  sound,
}: {
  hud: CastleHook | null;
  sound?: CanonAudioState | null;
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
      data-avion={hud.avion}
      data-fin={hud.fin ?? undefined}
      data-semilla={hud.semilla}
      data-dificultad={hud.dificultad}
      data-duracion={hud.duracion}
      data-calidad={hud.calidad}
    />
  );
}

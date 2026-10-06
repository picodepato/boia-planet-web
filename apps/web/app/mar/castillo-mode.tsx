'use client';

import type { DefenseSnapshot } from '@boia/engine/defense';
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { t as msg } from '../../lib/i18n';
import {
  type CastleHook,
  type CastleShortcut,
  DefenseRun,
  castleShortcut,
  withoutCastleShortcut,
} from './castillo';
import type { Mar3D } from './engine/mar3d';
import { type HideLayer, devShortcutsEnabled, hideForGame, marHideHost, randomSeed } from './survivors';

/**
 * «Defensa del Castillo» en `/mar` (plan 014 T160), del lado de React:
 * empezar la partida (de momento, sólo con el atajo de desarrollo
 * `?minijuego=castillo`; el pop-up es de T162), esconder las capas del mundo
 * como el Cañón (`HideLayer`) mientras el motor hunde islas y decorado, y
 * devolverlo todo igual al acabar. El estado para las pruebas va en
 * `data-testid="mar-castillo"`. `mar-client` sólo lo cablea.
 */

const EMPTY: ReadonlySet<HideLayer> = new Set();
/** Cada cuánto se publica el estado de la partida (ms). */
const HOOK_MS = 250;
/** Cada cuánto, con la pestaña oculta, se apunta la pausa (ms). */
const HIDDEN_MS = 1000;

export interface CastleMode {
  /** Hay partida del castillo en curso. */
  active: boolean;
  /** Lo que la partida tiene escondido ahora (las mismas capas que el Cañón). */
  hidden: ReadonlySet<HideLayer>;
  /** El último estado (también el final, hasta la siguiente). */
  hud: CastleHook | null;
  /** El estado de la partida ahora (para el HUD de T161; no guardarlo), o null. */
  read(): DefenseSnapshot | null;
  /** Pausa (un panel o el menú encima) o sigue. */
  setPaused(paused: boolean): void;
  /** Acaba la partida y devuelve el mundo como estaba (sin tarjeta final hasta T162). */
  leave(): void;
  /** Los atajos de desarrollo están encendidos (el botón de salir de prueba). */
  dev: boolean;
}

export function useCastleMode({
  engineRef,
  ready,
  isBusy,
  onStart,
}: {
  engineRef: RefObject<Mar3D | null>;
  /** El mar está listo (el atajo de la URL se lee entonces, una vez). */
  ready: boolean;
  /** Hay otra cosa en marcha (el Cañón, la carrera): no empieza. */
  isBusy: () => boolean;
  /** Al empezar: cerrar fichas, paneles, diálogos… */
  onStart: () => void;
}): CastleMode {
  const runRef = useRef<DefenseRun | null>(null);
  const restoreRef = useRef<(() => void) | null>(null);
  const pausedRef = useRef(false);
  const [active, setActive] = useState(false);
  const [hud, setHud] = useState<CastleHook | null>(null);
  const [hidden, setHiddenState] = useState<ReadonlySet<HideLayer>>(EMPTY);
  const hiddenRef = useRef<ReadonlySet<HideLayer>>(EMPTY);
  const [dev, setDev] = useState(false);
  useEffect(() => setDev(devShortcutsEnabled()), []);
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
    setActive(false);
  }, [engineRef]);

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
      });
      if (!g.startDefense(run)) return false;
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
    [engineRef],
  );

  const setPaused = useCallback((paused: boolean) => {
    pausedRef.current = paused;
    runRef.current?.setPaused(paused);
  }, []);

  const read = useCallback(() => runRef.current?.snapshot() ?? null, []);

  // El estado para las pruebas, unas veces por segundo.
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      const run = runRef.current;
      if (run) setHud(run.hook());
    }, HOOK_MS);
    return () => window.clearInterval(id);
  }, [active]);

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

  return { active, hidden, hud, read, setPaused, leave, dev };
}

/** El estado de la partida para las pruebas (`data-*`), sin nada que se vea. */
export function CastleTestHook({ hud }: { hud: CastleHook | null }) {
  if (!hud) return null;
  return (
    <div
      hidden
      aria-hidden="true"
      data-testid="mar-castillo"
      data-estado={hud.estado}
      data-tiempo={hud.tiempo}
      data-activo={hud.activo}
      data-vida={hud.vida}
      data-vida-max={hud.vidaMax}
      data-monedas={hud.monedas}
      data-enemigos={hud.enemigos}
      data-derrotados={hud.derrotados}
      data-islas={hud.islas}
      data-avion={hud.avion}
      data-fin={hud.fin ?? undefined}
      data-semilla={hud.semilla}
      data-dificultad={hud.dificultad}
      data-duracion={hud.duracion}
      data-calidad={hud.calidad}
    />
  );
}

/**
 * Salir de la arena (desarrollo, T160): hasta que el HUD (T161) traiga la
 * pausa con «Terminar partida», un botoncito con los atajos encendidos.
 */
export function CastleDevExit({ castle }: { castle: CastleMode }) {
  if (!castle.active || !castle.dev) return null;
  return (
    <button
      type="button"
      className="mar-canon-dev"
      data-testid="mar-castillo-salir"
      onClick={castle.leave}
    >
      {msg('mar.castillo.dev.salir')}
    </button>
  );
}

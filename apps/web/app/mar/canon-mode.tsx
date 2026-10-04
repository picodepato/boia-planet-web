'use client';

import type { EndReason, SurvivorsSnapshot } from '@boia/engine/survivors';
import type { WorldConfig } from '@boia/world';
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import type { InWorldCopy } from '../../lib/mundo/minigame-layer';
import { t as msg } from '../../lib/i18n';
import type { Mar3D } from './engine/mar3d';
import { MAR_SHIP_CONFIG } from './engine/steering';
import {
  CANON_GAME_ID,
  type CanonHook,
  type HideLayer,
  SurvivorsRun,
  canonBlockKey,
  canonShortcut,
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
 */

const EMPTY: ReadonlySet<HideLayer> = new Set();
/** Cada cuánto se publica el estado de la partida (ms). */
const HOOK_MS = 250;
/** Cada cuánto, con la pestaña oculta, se apunta la pausa (ms). */
const HIDDEN_MS = 1000;

export interface CanonEnd {
  reason: EndReason;
  snapshot: SurvivorsSnapshot;
}

export interface CanonMode {
  /** Hay partida en curso. */
  active: boolean;
  /** El último estado (también el final, hasta la siguiente). */
  hud: CanonHook | null;
  /** Lo que la partida tiene escondido ahora. */
  hidden: ReadonlySet<HideLayer>;
  /** Empieza donde está el barco; false si no se puede ahora. */
  start(opts?: { t?: number; seed?: number | null }): boolean;
  /** Pausa (un panel o el menú encima) o sigue. */
  setPaused(paused: boolean): void;
  /** Lo que el panel de la isla necesita para el Cañón. */
  panel: {
    inWorld: readonly string[];
    onPlay: (gameId: string) => void;
    blockedReason: (gameId: string) => string | null;
    copy: (gameId: string) => InWorldCopy | null;
  };
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
  /** Al acabar, con el mundo ya de vuelta. T101 pone aquí la pantalla final. */
  onEnd?: (end: CanonEnd) => void;
}): CanonMode {
  const runRef = useRef<SurvivorsRun | null>(null);
  const restoreRef = useRef<(() => void) | null>(null);
  const pausedRef = useRef(false);
  const [active, setActive] = useState(false);
  const [hud, setHud] = useState<CanonHook | null>(null);
  const [hidden, setHiddenState] = useState<ReadonlySet<HideLayer>>(EMPTY);
  const hiddenRef = useRef<ReadonlySet<HideLayer>>(EMPTY);
  const latest = useRef({ onStart, onOffer, onEnd, isRaceActive });
  latest.current = { onStart, onOffer, onEnd, isRaceActive };

  /** Fin de la partida: el barco se queda donde acabó y el mundo vuelve como estaba. */
  const finish = useCallback(
    (run: SurvivorsRun, reason: EndReason, snapshot: SurvivorsSnapshot) => {
      if (runRef.current !== run) return;
      runRef.current = null;
      engineRef.current?.stopSurvivors();
      restoreRef.current?.();
      restoreRef.current = null;
      setHud(run.hook());
      setActive(false);
      latest.current.onEnd?.({ reason, snapshot });
    },
    [engineRef],
  );

  const start = useCallback(
    ({ t = 0, seed = null }: { t?: number; seed?: number | null } = {}): boolean => {
      const g = engineRef.current;
      const w = worldRef.current;
      if (!g || !w || runRef.current || latest.current.isRaceActive()) return false;
      const sea = survivorsSea(
        w,
        g.runtime.bounds,
        { x: g.ship.x, y: g.ship.y, heading: g.ship.heading },
        g.solidDecor,
      );
      const run: SurvivorsRun = new SurvivorsRun(sea, {
        seed: seed ?? randomSeed(),
        quality: g.quality,
        ship: MAR_SHIP_CONFIG,
        startAtS: t,
        onEnd: (reason, snapshot) => finish(run, reason, snapshot),
      });
      if (!g.startSurvivors(run)) return false;
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

  const setPaused = useCallback((paused: boolean) => {
    pausedRef.current = paused;
    runRef.current?.setPaused(paused);
  }, []);

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
      runRef.current = null;
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
    else start({ t: sc.t, seed: sc.seed });
  }, [ready, start]);

  const blockKey = canonBlockKey({ raceActive });
  const panel = {
    inWorld: [CANON_GAME_ID],
    onPlay: (gameId: string) => {
      if (gameId === CANON_GAME_ID) start();
    },
    blockedReason: (gameId: string) =>
      gameId === CANON_GAME_ID && blockKey ? msg(blockKey) : null,
    copy: (gameId: string) =>
      gameId === CANON_GAME_ID
        ? { title: msg('mar.canon.title'), summary: msg('mar.canon.summary') }
        : null,
  };

  return { active, hud, hidden, start, setPaused, panel };
}

/**
 * El estado de la partida para las pruebas (como el cronómetro de la
 * carrera, `data-*`), sin nada que se vea: el HUD llega en T101.
 */
export function CanonTestHook({ hud }: { hud: CanonHook | null }) {
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
      data-calidad={hud.calidad}
      data-barco={hud.barco}
    />
  );
}

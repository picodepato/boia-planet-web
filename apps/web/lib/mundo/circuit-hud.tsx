'use client';

import type { WorldEvent } from '@boia/engine';
import {
  CircuitRace,
  type CircuitSpec,
  type InvalidReason,
  type RaceEvent,
  type RaceView,
  circuitFromWorld,
  formatRaceTime,
  readRecord,
  submitRecord,
} from '@boia/engine/circuit';
import type { Notice } from '@boia/engine/ui';
import type { ProgressApi } from '@boia/store';
import { CIRCUIT_ID, type ComposedWorld } from '@boia/world';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { recordSignal } from './achievements';
import { t as msg } from '../i18n';

/**
 * El Freu en el 2D (T20, REQ-AVE-026…033): la carrera del motor
 * (`@boia/engine/circuit`), el cronómetro muy pequeño arriba a la izquierda
 * (ni grande, ni modal, ni centrado: REQ-AVE-028), el récord antes (al
 * acercarse a la salida) y después (en el aviso de meta), guardado en este
 * navegador con la versión del circuito. Textos `muestra`.
 */

/** Disparador de los logros del circuito en el catálogo de logros (`@boia/store`). */
export const CIRCUIT_TRIGGER = 'complete_circuit';

export interface LapResult {
  best: boolean;
  bestMs: number;
  /** Título del primer logro completado ahora, o null. */
  achievement: string | null;
  /** Avisos de los logros completados ahora (vuelta, atajo, vuelta rápida). */
  achievements: Notice[];
}

/**
 * Guarda una carrera válida (su tiempo total, T61) y completa los logros del
 * circuito que toquen (una vez; se reclaman aparte). `route`: las boias por
 * las que pasó (`finish.route` de la carrera), para el logro del atajo.
 */
export async function finishLap(
  progress: ProgressApi,
  spec: Pick<CircuitSpec, 'id' | 'version'>,
  ms: number,
  route: readonly string[] = [],
): Promise<LapResult> {
  // El récord no frena el logro: si no se puede guardar, la vuelta cuenta igual.
  const r = await submitRecord(progress, spec, ms).catch((err: unknown) => {
    console.warn('[boia] no se pudo guardar el récord', err);
    return { best: false, bestMs: ms };
  });
  const achievements = await recordSignal(
    { progress },
    { trigger: CIRCUIT_TRIGGER, circuit: spec.id, ms, via: route },
  );
  return { ...r, achievement: achievements[0]?.title ?? null, achievements };
}

export function lapNotices(ms: number, r: LapResult): Notice[] {
  const out: Notice[] = [
    {
      id: `circuito:meta:${Date.now()}`,
      kind: 'info',
      title: r.best
        ? msg('circuit.finish.record.title', { time: formatRaceTime(ms) })
        : msg('circuit.finish.title', { time: formatRaceTime(ms) }),
      body: r.best
        ? msg('juego.circuitHud.tuMejorVueltaEn')
        : msg('circuit.finish.body', { time: formatRaceTime(r.bestMs) }),
    },
  ];
  out.push(...r.achievements);
  return out;
}

const now = () => performance.now() / 1000;

const INVALID_TEXT: Record<InvalidReason, string> = {
  panel: msg('circuit.void.panel'),
  hidden: msg('circuit.void.tab'),
  teleport: msg('circuit.void'),
  timeout: msg('circuit.void.slow'),
  offroad: msg('circuit.void.offroad'),
};

export interface CircuitState {
  /** Lo que enseña el cronómetro, o null si no hay carrera. */
  label: string | null;
  phase: 'idle' | 'countdown' | 'racing';
  /** Récord al acercarse a la salida (antes de correr). */
  startInfo: string | null;
}

/**
 * La carrera en React: se alimenta de los eventos del mundo y avisa por
 * `notify`. `invalidate` anula el intento (paneles, pestaña oculta…).
 */
export function useCircuit(
  world: ComposedWorld,
  progress: () => ProgressApi | null,
  notify: (n: Notice) => void,
  onBoost?: () => void,
) {
  const spec = useMemo(() => circuitFromWorld(world.config, CIRCUIT_ID), [world]);
  const race = useMemo(() => (spec ? new CircuitRace(spec) : null), [spec]);
  const startId = spec?.gates.find((g) => g.order === 0)?.objectId ?? null;
  const [view, setView] = useState<RaceView | null>(null);
  const [startInfo, setStartInfo] = useState<string | null>(null);
  const latest = useRef({ notify, progress, onBoost });
  useEffect(() => {
    latest.current = { notify, progress, onBoost };
  });

  const apply = useCallback(
    (events: RaceEvent[]) => {
      for (const e of events) {
        if (e.type === 'countdown') setStartInfo(null);
        if (e.type === 'checkpoint') latest.current.onBoost?.();
        // Tres vueltas desde T61: cada vuelta y cada boia saltada se avisan.
        if (e.type === 'lap') {
          latest.current.notify({
            id: `circuito:vuelta:${e.lap}:${Date.now()}`,
            kind: 'info',
            title: msg('mar.race.lapDone', { lap: e.lap, time: formatRaceTime(e.lapMs) }),
          });
        }
        if (e.type === 'missed') {
          latest.current.notify({
            id: `circuito:falta:${Date.now()}`,
            kind: 'info',
            title: msg('mar.race.missed', { order: e.order }),
            body: msg('mar.race.missed.body'),
          });
        }
        if (e.type === 'invalid') {
          latest.current.notify({
            id: `circuito:anulada:${Date.now()}`,
            kind: 'info',
            title: INVALID_TEXT[e.reason],
          });
        }
        if (e.type === 'finish' && spec) {
          const p = latest.current.progress();
          if (!p) continue;
          void finishLap(p, spec, e.ms, e.route)
            .then((r) => {
              for (const n of lapNotices(e.ms, r)) latest.current.notify(n);
            })
            .catch((err: unknown) => console.warn('[boia] no se pudo guardar el récord', err));
        }
      }
      setView(race ? race.view(now()) : null);
    },
    [spec, race],
  );

  const active = view !== null && view.phase !== 'idle';
  useEffect(() => {
    if (!active || !race) return;
    const t = setInterval(() => apply(race.tick(now())), 100);
    return () => clearInterval(t);
  }, [active, race, apply]);

  // REQ-AVE-032: ocultar la pestaña anula la vuelta.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState !== 'hidden') return;
      const e = race?.invalidate('hidden');
      if (e) apply([e]);
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [race, apply]);

  const onWorldEvent = useCallback(
    (e: WorldEvent) => {
      const r = race;
      if (!r || !spec) return;
      if (e.type === 'checkpoint' && e.circuitId === spec.id) {
        apply(r.checkpoint(e.order, now(), e.objectId));
      } else if (e.type === 'teleport') {
        const x = r.invalidate('teleport');
        if (x) apply([x]);
      } else if (e.type === 'proximity_enter' && e.objectId === startId && !r.active) {
        const p = latest.current.progress();
        if (!p) return;
        void readRecord(p, spec).then((rec) =>
          setStartInfo(
            rec
              ? msg('juego.circuitHud.elFreuRecordPasa', {
                  formatRaceTime: formatRaceTime(rec.bestMs),
                })
              : msg('juego.circuitHud.elFreuPasaPor'),
          ),
        );
      } else if (e.type === 'proximity_exit' && e.objectId === startId) {
        setStartInfo(null);
      }
    },
    [race, spec, startId, apply],
  );

  const invalidate = useCallback(
    (reason: InvalidReason) => {
      const e = race?.invalidate(reason);
      if (e) apply([e]);
    },
    [race, apply],
  );

  let label: string | null = null;
  if (view?.phase === 'countdown') label = String(Math.max(1, Math.ceil(view.countdown ?? 0)));
  if (view?.phase === 'racing') label = formatRaceTime(view.elapsedMs ?? 0);
  const state: CircuitState = { label, phase: view?.phase ?? 'idle', startInfo };
  return { state, onWorldEvent, invalidate };
}

/** El cronómetro: una pastilla pequeña arriba a la izquierda, bajo el botón de inicio. */
export function CircuitTimer({
  state,
  rect,
}: {
  state: CircuitState;
  rect: { x: number; y: number };
}) {
  const text = state.label ?? state.startInfo;
  if (!text) return null;
  return (
    <div
      className={`juego-crono is-${state.phase}`}
      data-testid="circuito-crono"
      data-phase={state.phase}
      role="timer"
      aria-live="off"
      style={{ left: rect.x, top: rect.y }}
    >
      {state.phase === 'idle' ? text : `⏱ ${text}`}
    </div>
  );
}

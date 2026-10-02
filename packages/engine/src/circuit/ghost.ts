/**
 * El barco fantasma del circuito (T61), sin three.js ni DOM: se graba la
 * carrera (posición y rumbo cada `step` ms desde «¡Ya!»), se guarda la de la
 * mejor carrera y, en la siguiente, se reproduce a la vez que se corre.
 * `ghostPose` interpola entre dos muestras. Las posiciones van en u de motor
 * del mundo donde se grabó.
 */

export interface GhostRun {
  /** Tiempo total de la carrera grabada (ms). */
  ms: number;
  /** ms entre muestras. */
  step: number;
  /** x, y, rumbo de cada muestra, seguidos (la muestra i es del instante i · step). */
  points: number[];
}

export interface GhostPose {
  x: number;
  y: number;
  heading: number;
}

/** ms entre muestras: diez por segundo. muestra */
export const GHOST_STEP_MS = 100;
/** Muestras como mucho (diez minutos a 10 por segundo): una grabación más larga no se guarda. */
const MAX_SAMPLES = 6000;

const r1 = (v: number) => Math.round(v * 10) / 10;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** Graba una carrera: `sample` en cada paso, `finish` al llegar a meta. */
export class GhostRecorder {
  private points: number[] = [];

  constructor(readonly step = GHOST_STEP_MS) {}

  /** Empieza otra grabación. */
  reset(): void {
    this.points = [];
  }

  get samples(): number {
    return this.points.length / 3;
  }

  /**
   * El barco en `ms` desde «¡Ya!». Se guarda una muestra por cada `step`
   * cumplido (si un paso salta varias, se repite la posición).
   */
  sample(ms: number, pose: GhostPose): void {
    while (this.samples * this.step <= ms && this.samples < MAX_SAMPLES) {
      this.points.push(r1(pose.x), r1(pose.y), r3(pose.heading));
    }
  }

  /** La grabación de una carrera de `ms`, o null si no hay muestras. */
  finish(ms: number, pose?: GhostPose): GhostRun | null {
    if (pose) this.sample(ms, pose);
    if (this.samples === 0) return null;
    return { ms: Math.round(ms), step: this.step, points: [...this.points] };
  }
}

/** Ángulo de `a` a `b` por el camino corto. */
function lerpAngle(a: number, b: number, t: number): number {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * t;
}

/** Dónde iba el fantasma a los `ms` de carrera; null antes de empezar o pasada su meta. */
export function ghostPose(run: GhostRun, ms: number): GhostPose | null {
  const n = run.points.length / 3;
  if (n === 0 || ms < 0 || ms > run.ms) return null;
  const f = ms / run.step;
  const i = Math.min(n - 1, Math.floor(f));
  const j = Math.min(n - 1, i + 1);
  const t = j === i ? 0 : f - i;
  const p = run.points;
  return {
    x: p[i * 3]! + (p[j * 3]! - p[i * 3]!) * t,
    y: p[i * 3 + 1]! + (p[j * 3 + 1]! - p[i * 3 + 1]!) * t,
    heading: lerpAngle(p[i * 3 + 2]!, p[j * 3 + 2]!, t),
  };
}

/** Texto para guardar una grabación (JSON con versión de formato). */
export function encodeGhost(run: GhostRun): string {
  return JSON.stringify({ v: 1, ms: run.ms, step: run.step, points: run.points });
}

/** Una grabación guardada con `encodeGhost`, o null si no es válida. */
export function decodeGhost(text: string | null | undefined): GhostRun | null {
  if (!text) return null;
  try {
    const o = JSON.parse(text) as Record<string, unknown>;
    const { ms, step, points } = o;
    if (o.v !== 1 || typeof ms !== 'number' || !(ms > 0)) return null;
    if (typeof step !== 'number' || !(step > 0)) return null;
    if (!Array.isArray(points) || points.length === 0 || points.length % 3 !== 0) return null;
    if (points.length / 3 > MAX_SAMPLES) return null;
    if (!points.every((v) => typeof v === 'number' && Number.isFinite(v))) return null;
    return { ms, step, points: points as number[] };
  } catch {
    return null;
  }
}

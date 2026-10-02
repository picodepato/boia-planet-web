import type { WorldConfig, WorldObject } from '@boia/world';

/**
 * Las rampas de salto del circuito (T73), sin three.js ni DOM. Una rampa es
 * un impulso del mundo (COLISIÓN `boost`, no sólida) que además lleva
 * `params.jump`: pasar por encima lanza el barco al aire (sólo se ve: la
 * simulación sigue en el plano del mar) y al caer al agua salpica. La
 * aplicación oye el efecto `boost` de la rampa (`WorldEvent` `effect`), pide
 * aquí el salto con `launch` y lo avanza con `tick`; `height` da la altura
 * para pintar el barco y `pitch` el cabeceo.
 */

export interface JumpSpec {
  /** Altura máxima (u de motor). */
  height: number;
  /** s en el aire. */
  duration: number;
}

export type JumpEvent =
  /** Despega de la rampa `objectId`. */
  | { type: 'jump'; objectId: string; height: number; duration: number }
  /** Cae al agua: el chapuzón. `objectId`: la rampa de la que saltó. */
  | { type: 'splash'; objectId: string };

/** Sin `params.jump` completo en la rampa. muestra */
export const DEFAULT_JUMP: JumpSpec = { height: 40, duration: 1 };

const inRange = (v: unknown, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= max;

/** El salto de un objeto del mundo (`params.jump`), o null si no es una rampa. */
export function jumpOf(o: Pick<WorldObject, 'params'> | undefined): JumpSpec | null {
  const j = o?.params?.jump as { height?: unknown; duration?: unknown } | undefined;
  if (!j || typeof j !== 'object') return null;
  return {
    height: inRange(j.height, 400) ? j.height : DEFAULT_JUMP.height,
    duration: inRange(j.duration, 5) ? j.duration : DEFAULT_JUMP.duration,
  };
}

/** Las rampas de un mundo: id → su salto. */
export function rampsOf(world: WorldConfig): Map<string, JumpSpec> {
  const out = new Map<string, JumpSpec>();
  for (const o of world.objects) {
    if (!o.identity.active) continue;
    const j = jumpOf(o);
    if (j) out.set(o.identity.id, j);
  }
  return out;
}

/** El salto en curso del barco: despegue, vuelo en parábola y chapuzón. */
export class BoatJump {
  private from = '';
  private t0 = 0;
  private spec: JumpSpec | null = null;

  get airborne(): boolean {
    return this.spec !== null;
  }

  /**
   * Despega en `now` (s). En el aire, otra rampa no vuelve a lanzar (el
   * barco no la toca: va por encima).
   */
  launch(objectId: string, spec: JumpSpec, now: number): JumpEvent[] {
    if (this.spec) return [];
    this.from = objectId;
    this.t0 = now;
    this.spec = spec;
    return [{ type: 'jump', objectId, height: spec.height, duration: spec.duration }];
  }

  /** Avanza el reloj: al cumplirse el vuelo, el chapuzón. */
  tick(now: number): JumpEvent[] {
    if (!this.spec || now - this.t0 < this.spec.duration) return [];
    this.spec = null;
    return [{ type: 'splash', objectId: this.from }];
  }

  /** Fracción del vuelo (0…1), o null en el agua. */
  private progress(now: number): number | null {
    if (!this.spec) return null;
    return Math.min(1, Math.max(0, (now - this.t0) / this.spec.duration));
  }

  /** Altura sobre el agua en `now` (u): una parábola de 0 a `height` y de vuelta a 0. */
  height(now: number): number {
    const p = this.progress(now);
    return p === null ? 0 : 4 * this.spec!.height * p * (1 - p);
  }

  /** Cabeceo (rad, proa arriba positivo): sube mirando al cielo y cae de proa. */
  pitch(now: number): number {
    const p = this.progress(now);
    return p === null ? 0 : 0.35 * (1 - 2 * p);
  }

  /** Vuelve al agua sin chapuzón (cambio de mundo, teletransporte). */
  reset(): void {
    this.spec = null;
  }
}

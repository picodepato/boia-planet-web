/**
 * Las olas grandes de `/mar` (plan 029 T269): de vez en cuando (cada 1-2 min
 * de mar libre) se levanta una ola grande por delante del barco, visible unos
 * segundos antes. Cruzarla lanza el barco al aire (el salto visual de
 * `BoatJump`); cruzarla con turbo da la vuelta entera en el aire (el «salto
 * mortal», un logro). La simulación sigue en 2D: esto sólo decide cuándo hay
 * ola, dónde está y si el barco la cruzó.
 *
 * Sin DOM ni three.js: un reloj puro con el azar inyectado (`rng`). Nunca hay
 * ola durante una partida (el mismo `busy` que el tiempo, T268) y la que haya
 * se va. Todo en u de motor; el mar da la vuelta, así que las diferencias de
 * posición pasan por `period` (el tamaño del mar en u) cuando se pasa.
 * Todos los números son `muestra`. Se importa como `@boia/engine/swell`.
 */
import { rng as seeded } from '../minigames/rng';

/** Parámetro de desarrollo: `?ola=1` trae una ola justo delante. */
export const SWELL_PARAM = 'ola';

export interface JumpShape {
  /** s en el aire. */
  duration: number;
  /** Altura máxima (u). */
  height: number;
}

export interface SwellTuning {
  /** s de mar libre entre olas (mínimo y máximo). muestra */
  everyMin: number;
  everyMax: number;
  /** s de calma tras una partida antes de poder contar. muestra */
  afterBusy: number;
  /** s que dura una ola sin cruzar, fundidos incluidos. muestra */
  life: number;
  /** s que tarda en levantarse (y en bajar al irse). muestra */
  rise: number;
  /** Fuerza (0..1) desde la que la ola ya lanza el barco. muestra */
  armedAt: number;
  /** Medio largo de la cresta (u). muestra */
  halfLength: number;
  /** Sale a `max(minAhead, aheadS * velocidad)` u por delante. muestra */
  minAhead: number;
  aheadS: number;
  /** ± rad de azar en el sitio, respecto al rumbo. muestra */
  spread: number;
  /** u/s a los que avanza la cresta hacia el barco. muestra */
  drift: number;
  /** Fracción de la velocidad máxima desde la que el barco «va en marcha». muestra */
  minSpeed: number;
  /** El vuelo: normal, con vuelta y con movimiento reducido. muestra */
  jump: JumpShape;
  flipJump: JumpShape;
  reducedJump: JumpShape;
}

export const SWELL_TUNING: SwellTuning = {
  everyMin: 60,
  everyMax: 120,
  afterBusy: 15,
  life: 24,
  rise: 3,
  armedAt: 0.6,
  halfLength: 260,
  minAhead: 700,
  aheadS: 5,
  spread: 0.2,
  drift: 40,
  minSpeed: 0.25,
  jump: { duration: 0.95, height: 38 },
  flipJump: { duration: 1.5, height: 80 },
  reducedJump: { duration: 0.7, height: 14 },
};

export interface Point {
  x: number;
  y: number;
}

/** El tamaño del mar en u, para que dar la vuelta no rompa las distancias. */
export interface Period {
  w: number;
  h: number;
}

/** Una ola: su centro, hacia dónde mira la cresta (`n`, unitaria) y su medio largo. */
export interface Swell extends Point {
  id: number;
  nx: number;
  ny: number;
  halfLength: number;
  /** s de vida. */
  age: number;
}

export type SwellEvent =
  /** Se levanta una ola. */
  | { type: 'spawn'; swell: Swell }
  /** El barco la cruzó: salta; con turbo, da la vuelta. */
  | { type: 'cross'; swell: Swell; flip: boolean }
  /** Se fue sin cruzarse (o porque empezó una partida). */
  | { type: 'gone'; swell: Swell };

export interface SwellClockOptions {
  /** Azar en [0, 1); con semilla, siempre lo mismo. Por defecto, `Math.random`. */
  rng?: () => number;
  tuning?: Partial<SwellTuning>;
}

export const swellRng = seeded;

/** Sin novedades (lo normal en cada fotograma): siempre la misma lista vacía, sin basura. */
const NONE: readonly SwellEvent[] = Object.freeze([]);

/** ¿La URL de desarrollo pide una ola ya? (`?ola=1`) */
export function swellParam(search: string): boolean {
  const v = new URLSearchParams(search).get(SWELL_PARAM);
  return v !== null && v !== '' && v !== '0' && v !== 'no';
}

/** Fuerza de la ola (0..1): sube en `rise` s y baja en los últimos `rise`. */
export function swellStrength(age: number, life: number, rise: number): number {
  if (age <= 0 || age >= life) return 0;
  const k = Math.min(1, age / rise, (life - age) / rise);
  return k * k * (3 - 2 * k);
}

/** Diferencia más corta entre dos puntos de un mar que da la vuelta de largo `p`. */
function wrapDiff(d: number, p: number | undefined): number {
  if (!p) return d;
  return d - Math.round(d / p) * p;
}

/** Dónde ponerla: delante del barco, a `max(minAhead, aheadS * speed)` u, con `angle` rad de desvío. */
export function placeSwell(
  boat: Point,
  heading: number,
  speed: number,
  angle: number,
  tuning: SwellTuning = SWELL_TUNING,
): Point & { nx: number; ny: number } {
  const ahead = Math.max(tuning.minAhead, speed * tuning.aheadS);
  const a = heading + angle;
  // La cresta da la cara al barco: su normal apunta hacia atrás del rumbo.
  return {
    x: boat.x + Math.cos(a) * ahead,
    y: boat.y + Math.sin(a) * ahead,
    nx: -Math.cos(heading),
    ny: -Math.sin(heading),
  };
}

/**
 * ¿El barco cruzó la cresta al ir de `from` a `to`? La cresta es el segmento
 * de largo `2 * halfLength` por su centro, perpendicular a su normal. Cuenta
 * en los dos sentidos. `before`: dónde estaba el centro de la cresta cuando el
 * barco estaba en `from` (la cresta también avanza: un barco parado se cruza
 * con ella).
 */
export function crossesSwell(
  swell: Pick<Swell, 'x' | 'y' | 'nx' | 'ny' | 'halfLength'>,
  from: Point,
  to: Point,
  period?: Period,
  before: Point = swell,
): boolean {
  // Sin objetos nuevos: se llama en cada fotograma del mar.
  const r0x = wrapDiff(from.x - before.x, period?.w);
  const r0y = wrapDiff(from.y - before.y, period?.h);
  const r1x = wrapDiff(to.x - swell.x, period?.w);
  const r1y = wrapDiff(to.y - swell.y, period?.h);
  const a0 = r0x * swell.nx + r0y * swell.ny;
  const a1 = r1x * swell.nx + r1y * swell.ny;
  if (a0 === a1 || (a0 > 0 && a1 > 0) || (a0 < 0 && a1 < 0)) return false;
  const k = a0 / (a0 - a1);
  const px = r0x + (r1x - r0x) * k;
  const py = r0y + (r1y - r0y) * k;
  // A lo largo de la cresta: la perpendicular a la normal.
  return Math.abs(px * -swell.ny + py * swell.nx) <= swell.halfLength;
}

export interface BoatMotion extends Point {
  /** Rumbo (rad). */
  heading: number;
  /** u/s. */
  speed: number;
  /** u/s máxima del barco de ahora (para «va en marcha»). */
  maxSpeed: number;
  /** ¿Turbo activo? */
  turbo: boolean;
}

export class SwellClock {
  readonly tuning: SwellTuning;
  private readonly rng: () => number;
  private wait: number;
  private current: Swell | null = null;
  private nextId = 1;
  /** Dónde estaba la cresta antes de avanzar este paso (reutilizado). */
  private readonly before: Point = { x: 0, y: 0 };

  constructor(opts: SwellClockOptions = {}) {
    this.tuning = { ...SWELL_TUNING, ...opts.tuning };
    this.rng = opts.rng ?? Math.random;
    this.wait = this.gap();
  }

  /** La ola que hay, o null. */
  get swell(): Swell | null {
    return this.current;
  }

  /** s de mar libre que quedan hasta la próxima (0 si hay una). */
  get untilNext(): number {
    return this.current ? 0 : Math.max(0, this.wait);
  }

  /** Fuerza de la ola de ahora (0 si no hay). */
  get strength(): number {
    const s = this.current;
    return s ? swellStrength(s.age, this.tuning.life, this.tuning.rise) : 0;
  }

  /** Trae ya una ola delante, ya levantada (el parámetro de desarrollo); la que hubiera se quita. */
  spawn(boat: Point & { heading: number; speed: number }): SwellEvent[] {
    const out: SwellEvent[] = [];
    if (this.current) out.push({ type: 'gone', swell: this.current });
    out.push(this.raise(boat, 0));
    this.current!.age = this.tuning.rise;
    return out;
  }

  /**
   * Avanza `dt` s. `prev` es dónde estaba el barco en el paso anterior;
   * `boat`, dónde está. `busy`: hay una partida (el `busy` del tiempo).
   */
  step(
    dt: number,
    busy: boolean,
    boat: BoatMotion,
    prev: Point,
    period?: Period,
  ): readonly SwellEvent[] {
    const T = this.tuning;
    const s = this.current;
    if (!s) {
      this.wait -= dt;
      if (busy) this.wait = Math.max(this.wait, T.afterBusy);
      const moving = boat.speed >= boat.maxSpeed * T.minSpeed;
      if (this.wait <= 0 && !busy && moving) return [this.raise(boat, this.rng() * 2 - 1)];
      return NONE;
    }
    if (busy) {
      this.current = null;
      this.wait = Math.max(this.gap(), T.afterBusy);
      return [{ type: 'gone', swell: s }];
    }
    // La cresta avanza hacia el barco.
    s.age += dt;
    const before = this.before;
    before.x = s.x;
    before.y = s.y;
    s.x += s.nx * T.drift * dt;
    s.y += s.ny * T.drift * dt;
    if (s.age >= T.life) {
      this.current = null;
      this.wait = this.gap();
      return [{ type: 'gone', swell: s }];
    }
    if (this.strength >= T.armedAt && crossesSwell(s, prev, boat, period, before)) {
      // Cruzada: se deshace en espuma y se va.
      this.current = null;
      this.wait = this.gap();
      return [{ type: 'cross', swell: s, flip: boat.turbo }];
    }
    return NONE;
  }

  /** El vuelo que toca: con vuelta sólo si hay turbo y no hay movimiento reducido. */
  jumpFor(flip: boolean, reduced: boolean): JumpShape & { flip: boolean } {
    const T = this.tuning;
    if (reduced) return { ...T.reducedJump, flip: false };
    return flip ? { ...T.flipJump, flip: true } : { ...T.jump, flip: false };
  }

  private raise(boat: Point & { heading: number; speed: number }, k: number): SwellEvent {
    const T = this.tuning;
    const swell: Swell = {
      id: this.nextId++,
      ...placeSwell(boat, boat.heading, boat.speed, k * T.spread, T),
      halfLength: T.halfLength,
      age: 0,
    };
    this.current = swell;
    return { type: 'spawn', swell };
  }

  private gap(): number {
    const T = this.tuning;
    return T.everyMin + (T.everyMax - T.everyMin) * this.rng();
  }
}

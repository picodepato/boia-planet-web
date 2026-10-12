/**
 * El tiempo de `/mar` (plan 029 T268): episodios cortos encima del momento
 * del día que eligió el jugador (día, tarde o noche no cambian). Cada ~4 min
 * de juego (con algo de azar) entra uno de 30 s, con fundido de entrada y de
 * salida: levante, tormenta de verano o calima. Nunca durante una partida
 * (carreras, el Cañón, el Castillo u otro minijuego): si empieza una con un
 * episodio en curso, el episodio se va suave.
 *
 * Sin DOM ni three.js: un reloj puro con el azar inyectado (`rng`), que el
 * mar 3D avanza cada fotograma con el tiempo de juego. Se importa como
 * `@boia/engine/weather`. Todos los números son `muestra`.
 */
import { rng as seeded } from '../minigames/rng';

export type WeatherKind = 'levante' | 'tormenta' | 'calima';

export const WEATHER_KINDS: readonly WeatherKind[] = ['levante', 'tormenta', 'calima'];

/** Parámetro de desarrollo: `?clima=levante|tormenta|calima` lo trae ya. */
export const WEATHER_PARAM = 'clima';

export interface WeatherTuning {
  /** s de juego entre episodios (fin de uno a inicio del siguiente). muestra */
  every: number;
  /** ± s de azar sobre `every`. muestra */
  jitter: number;
  /** s que dura un episodio, fundidos incluidos. muestra */
  duration: number;
  /** s del fundido de entrada y del de salida. muestra */
  fade: number;
  /** s mínimos de calma tras acabar una partida antes de que entre un episodio. muestra */
  afterBusy: number;
  /** s entre rayos de la tormenta (mínimo y máximo). muestra */
  strikeMin: number;
  strikeMax: number;
  /** s entre el rayo y su trueno (mínimo y máximo). muestra */
  thunderMin: number;
  thunderMax: number;
  /** Fuerza del episodio por debajo de la cual no caen rayos. muestra */
  strikeFrom: number;
  /** s que tarda en apagarse el destello de un rayo. muestra */
  flashS: number;
}

export const WEATHER_TUNING: WeatherTuning = {
  every: 240,
  jitter: 30,
  duration: 30,
  fade: 4,
  afterBusy: 20,
  strikeMin: 3,
  strikeMax: 7,
  thunderMin: 0.5,
  thunderMax: 2.2,
  strikeFrom: 0.6,
  flashS: 0.35,
};

export type WeatherEvent =
  /** Entra un episodio (empieza su fundido de entrada). */
  | { type: 'start'; kind: WeatherKind }
  /** Empieza el fundido de salida: `fadeS` s hasta que se va del todo. */
  | { type: 'ending'; kind: WeatherKind; fadeS: number }
  /** Se fue del todo. */
  | { type: 'end'; kind: WeatherKind }
  /** Destello de un rayo (nunca con `noFlash`). */
  | { type: 'flash'; strength: number }
  /** El trueno de un rayo, un momento después. */
  | { type: 'thunder'; strength: number };

export interface WeatherState {
  /** El episodio que hay (también mientras se va), o null. */
  kind: WeatherKind | null;
  /** 0..1: cuánto se nota ahora (fundidos incluidos). */
  strength: number;
  /** 0..1: destello del último rayo (0 sin rayo o con `noFlash`). */
  flash: number;
}

export interface WeatherClockOptions {
  /** Azar en [0, 1); con semilla, siempre lo mismo. Por defecto, `Math.random`. */
  rng?: () => number;
  tuning?: Partial<WeatherTuning>;
  /** Movimiento reducido o calidad baja: sin destellos (sólo trueno). */
  noFlash?: boolean;
}

/** Un generador con semilla para el reloj (y las pruebas). */
export const weatherRng = seeded;

/** El episodio que pide la URL de desarrollo, o null. */
export function weatherParam(search: string): WeatherKind | null {
  const v = new URLSearchParams(search).get(WEATHER_PARAM);
  return v && (WEATHER_KINDS as readonly string[]).includes(v) ? (v as WeatherKind) : null;
}

/** Fuerza de un episodio de `duration` s a los `t` s de empezar (fundidos suaves). */
export function episodeStrength(t: number, duration: number, fade: number): number {
  if (t <= 0 || t >= duration) return 0;
  const k = Math.min(1, t / fade, (duration - t) / fade);
  return k * k * (3 - 2 * k);
}

type Phase =
  | { at: 'calm' }
  | { at: 'episode'; kind: WeatherKind; t: number }
  /** Se va suave desde `from` en `fadeS` s (una partida empezó, o se cortó). */
  | { at: 'ending'; kind: WeatherKind; t: number; from: number; fadeS: number };

export class WeatherClock {
  readonly tuning: WeatherTuning;
  noFlash: boolean;
  private readonly rng: () => number;
  private phase: Phase = { at: 'calm' };
  private wait: number;
  private last: WeatherKind | null = null;
  private strikeIn = 0;
  private thunders: { in: number; strength: number }[] = [];
  private sinceFlash = Infinity;
  private flashPeak = 0;

  constructor(opts: WeatherClockOptions = {}) {
    this.tuning = { ...WEATHER_TUNING, ...opts.tuning };
    this.rng = opts.rng ?? Math.random;
    this.noFlash = opts.noFlash ?? false;
    this.wait = this.gap();
  }

  /** s de calma que quedan hasta el próximo episodio (0 si hay uno). */
  get untilNext(): number {
    return this.phase.at === 'calm' ? this.wait : 0;
  }

  get state(): WeatherState {
    const p = this.phase;
    if (p.at === 'calm') return { kind: null, strength: 0, flash: this.flashNow() };
    const strength =
      p.at === 'episode'
        ? episodeStrength(p.t, this.tuning.duration, this.tuning.fade)
        : p.from * Math.max(0, 1 - p.t / p.fadeS);
    return { kind: p.kind, strength, flash: this.flashNow() };
  }

  /**
   * Avanza `dt` s de juego. `busy`: hay una partida (carrera, Cañón,
   * Castillo, minijuego): no entra nada y lo que hay se va suave.
   */
  step(dt: number, busy: boolean): WeatherEvent[] {
    const out: WeatherEvent[] = [];
    const T = this.tuning;
    this.sinceFlash += dt;
    // Los truenos ya pedidos suenan aunque el episodio se vaya.
    for (let i = this.thunders.length - 1; i >= 0; i--) {
      const th = this.thunders[i]!;
      th.in -= dt;
      if (th.in <= 0) {
        out.push({ type: 'thunder', strength: th.strength });
        this.thunders.splice(i, 1);
      }
    }
    const p = this.phase;
    if (p.at === 'calm') {
      this.wait -= dt;
      // Durante una partida, y un rato después, sigue la calma.
      if (busy) this.wait = Math.max(this.wait, T.afterBusy);
      if (this.wait <= 0) out.push(...this.begin(this.pick()));
      return out;
    }
    if (p.at === 'episode' && busy) {
      out.push(...this.softEnd());
      return out;
    }
    p.t += dt;
    if (p.at === 'episode') {
      if (p.t >= T.duration) out.push(...this.finish());
      else {
        if (p.t >= T.duration - T.fade && p.t - dt < T.duration - T.fade) {
          out.push({ type: 'ending', kind: p.kind, fadeS: T.duration - p.t });
        }
        if (p.kind === 'tormenta') out.push(...this.storm(dt));
      }
    } else if (p.t >= p.fadeS) out.push(...this.finish());
    return out;
  }

  /** Trae ya un episodio (el parámetro de desarrollo); el que hubiera se corta. */
  start(kind: WeatherKind): WeatherEvent[] {
    const out: WeatherEvent[] = [];
    if (this.phase.at !== 'calm') out.push({ type: 'end', kind: this.phase.kind });
    out.push(...this.begin(kind));
    return out;
  }

  /** El episodio en curso se va suave (si hay); vuelve a contar la calma. */
  softEnd(): WeatherEvent[] {
    const p = this.phase;
    if (p.at !== 'episode') return [];
    const from = this.state.strength;
    const fadeS = Math.max(0.01, this.tuning.fade * from);
    this.phase = { at: 'ending', kind: p.kind, t: 0, from, fadeS };
    return [{ type: 'ending', kind: p.kind, fadeS }];
  }

  private begin(kind: WeatherKind): WeatherEvent[] {
    this.phase = { at: 'episode', kind, t: 0 };
    this.last = kind;
    this.strikeIn = this.between(this.tuning.strikeMin, this.tuning.strikeMax) * 0.5;
    return [{ type: 'start', kind }];
  }

  private finish(): WeatherEvent[] {
    const p = this.phase;
    if (p.at === 'calm') return [];
    this.phase = { at: 'calm' };
    this.wait = this.gap();
    return [{ type: 'end', kind: p.kind }];
  }

  /** Rayos de la tormenta: espaciados (muy por debajo de 3 por segundo). */
  private storm(dt: number): WeatherEvent[] {
    if (this.state.strength < this.tuning.strikeFrom) return [];
    this.strikeIn -= dt;
    if (this.strikeIn > 0) return [];
    const T = this.tuning;
    this.strikeIn = this.between(T.strikeMin, T.strikeMax);
    const strength = 0.55 + this.rng() * 0.45;
    this.thunders.push({ in: this.between(T.thunderMin, T.thunderMax), strength });
    if (this.noFlash) return [];
    this.sinceFlash = 0;
    this.flashPeak = strength;
    return [{ type: 'flash', strength }];
  }

  private flashNow(): number {
    if (this.noFlash || this.sinceFlash >= this.tuning.flashS) return 0;
    const k = 1 - this.sinceFlash / this.tuning.flashS;
    return this.flashPeak * k * k;
  }

  /** Otro episodio, nunca el mismo dos veces seguidas. */
  private pick(): WeatherKind {
    const pool = WEATHER_KINDS.filter((k) => k !== this.last);
    return pool[Math.min(pool.length - 1, Math.floor(this.rng() * pool.length))]!;
  }

  private gap(): number {
    const T = this.tuning;
    return Math.max(T.fade, T.every + (this.rng() * 2 - 1) * T.jitter);
  }

  private between(a: number, b: number): number {
    return a + (b - a) * this.rng();
  }
}

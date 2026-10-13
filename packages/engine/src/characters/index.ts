/**
 * Los personajes del agua de `/mar` (plan 029 T270): la gaviota ladrona, el
 * cangrejo bailarín y el guiri del flamenco. Aquí va lo puro, sin DOM ni
 * three.js: el reloj de la gaviota (cuándo ataca, cuánto roba, si la pillan a
 * tiempo), la hora de Alicante para las frases del guiri y el compás del
 * cangrejo. El mar 3D lo avanza cada fotograma y pinta lo que sale. Se
 * importa como `@boia/engine/characters`. Todos los números son `muestra`.
 */
import { rng as seeded } from '../minigames/rng';

// --- La gaviota ladrona ---------------------------------------------------------

/** Parámetro de desarrollo: `?gaviota=1` trae el ataque ya. */
export const SEAGULL_PARAM = 'gaviota';

export interface SeagullTuning {
  /** s de navegación libre antes del primer ataque. muestra */
  first: number;
  /** s entre ataques (de que se va una a que llega la siguiente). muestra */
  every: number;
  /** ± s de azar sobre `every`. muestra */
  jitter: number;
  /** s mínimos de calma tras una partida antes de que ataque. muestra */
  afterBusy: number;
  /** Tope de monedas que se lleva de una vez. muestra (P24) */
  cap: number;
  /** Propina por pillarla, además de devolver lo robado. muestra (P24) */
  bonus: number;
  /** s que hay para pillarla desde el robo. muestra */
  catchS: number;
  /** s desde que se la ve bajar hasta que agarra las monedas. muestra */
  diveS: number;
  /** s que se queda riéndose antes de irse del todo. muestra */
  laughS: number;
}

export const SEAGULL_TUNING: SeagullTuning = {
  first: 75,
  every: 150,
  jitter: 45,
  afterBusy: 20,
  cap: 5,
  bonus: 3,
  catchS: 15,
  diveS: 2.4,
  laughS: 1.8,
};

/**
 * Cuántas monedas se lleva la gaviota de un bolsillo con `coins`: nunca más
 * de `cap`, nunca más de las que hay (el saldo no baja de cero) y ninguna
 * de un bolsillo vacío.
 */
export function stealAmount(coins: number, cap = SEAGULL_TUNING.cap): number {
  if (!Number.isFinite(coins) || coins <= 0) return 0;
  return Math.max(0, Math.min(Math.floor(cap), Math.floor(coins)));
}

export type SeagullEvent =
  /** Se la ve venir: baja hacia el barco. */
  | { type: 'dive' }
  /** Agarró las monedas y huye despacio con una en el pico. */
  | { type: 'steal'; coins: number }
  /** Bajó, pero no había nada que robar: se va. */
  | { type: 'nothing' }
  /** La pillaron a tiempo: lo robado vuelve y hay propina. */
  | { type: 'caught'; coins: number; bonus: number }
  /** Pasó el plazo: se ríe (graznido) y se queda con lo robado. */
  | { type: 'escaped'; coins: number }
  /** Empezó una partida mientras huía: suelta lo robado y se va. */
  | { type: 'dropped'; coins: number }
  /** Se fue del todo. */
  | { type: 'gone' };

export type SeagullPhase =
  | { at: 'away' }
  | { at: 'diving'; t: number }
  | { at: 'fleeing'; t: number; coins: number }
  | { at: 'laughing'; t: number };

export interface SeagullClockOptions {
  rng?: () => number;
  tuning?: Partial<SeagullTuning>;
}

/** Un generador con semilla para el reloj (y las pruebas). */
export const characterRng = seeded;

/** ¿La URL de desarrollo pide el ataque de la gaviota ya? */
export function seagullParam(search: string): boolean {
  return new URLSearchParams(search).get(SEAGULL_PARAM) === '1';
}

/**
 * El reloj de la gaviota ladrona. Cada ~2,5 min de navegación libre baja,
 * roba hasta `cap` monedas (nunca deja el saldo en negativo) y huye despacio;
 * `catch()` en los `catchS` s siguientes las devuelve con propina; si no, se
 * ríe y se va. Nada durante una partida (`busy`): ni ataca ni sigue el robo.
 */
export class SeagullClock {
  readonly tuning: SeagullTuning;
  private readonly rng: () => number;
  private phase: SeagullPhase = { at: 'away' };
  private wait: number;

  constructor(opts: SeagullClockOptions = {}) {
    this.tuning = { ...SEAGULL_TUNING, ...opts.tuning };
    this.rng = opts.rng ?? Math.random;
    this.wait = this.tuning.first;
  }

  get state(): SeagullPhase {
    return this.phase;
  }

  /** s que quedan hasta el próximo ataque (0 si hay uno en marcha). */
  get untilNext(): number {
    return this.phase.at === 'away' ? this.wait : 0;
  }

  /** s que quedan para pillarla (0 si no huye con nada). */
  get catchLeft(): number {
    return this.phase.at === 'fleeing' ? Math.max(0, this.tuning.catchS - this.phase.t) : 0;
  }

  /**
   * Avanza `dt` s de juego con el saldo de monedas de ahora. `busy`: hay una
   * partida (carrera, Cañón, Castillo, minijuego): no roba y, si huía, suelta
   * lo robado.
   */
  step(dt: number, busy: boolean, coins: number): SeagullEvent[] {
    const out: SeagullEvent[] = [];
    const T = this.tuning;
    const p = this.phase;
    if (p.at === 'away') {
      this.wait -= dt;
      if (busy) this.wait = Math.max(this.wait, T.afterBusy);
      if (this.wait <= 0) out.push(...this.begin());
      return out;
    }
    if (busy) {
      if (p.at === 'fleeing') out.push({ type: 'dropped', coins: p.coins });
      out.push(...this.leave());
      return out;
    }
    p.t += dt;
    if (p.at === 'diving' && p.t >= T.diveS) {
      const take = stealAmount(coins, T.cap);
      if (take <= 0) {
        out.push({ type: 'nothing' }, ...this.leave());
      } else {
        this.phase = { at: 'fleeing', t: 0, coins: take };
        out.push({ type: 'steal', coins: take });
      }
    } else if (p.at === 'fleeing' && p.t >= T.catchS) {
      this.phase = { at: 'laughing', t: 0 };
      out.push({ type: 'escaped', coins: p.coins });
    } else if (p.at === 'laughing' && p.t >= T.laughS) {
      out.push(...this.leave());
    }
    return out;
  }

  /** La pillaron: sólo cuenta mientras huye con las monedas. */
  catch(): SeagullEvent[] {
    const p = this.phase;
    if (p.at !== 'fleeing') return [];
    const out: SeagullEvent[] = [{ type: 'caught', coins: p.coins, bonus: this.tuning.bonus }];
    out.push(...this.leave());
    return out;
  }

  /** Trae el ataque ya (el parámetro de desarrollo); si había uno, se corta. */
  attack(): SeagullEvent[] {
    const out: SeagullEvent[] = [];
    if (this.phase.at === 'fleeing') out.push({ type: 'dropped', coins: this.phase.coins });
    if (this.phase.at !== 'away') out.push({ type: 'gone' });
    out.push(...this.begin());
    return out;
  }

  private begin(): SeagullEvent[] {
    this.phase = { at: 'diving', t: 0 };
    return [{ type: 'dive' }];
  }

  private leave(): SeagullEvent[] {
    this.phase = { at: 'away' };
    const T = this.tuning;
    this.wait = Math.max(T.afterBusy, T.every + (this.rng() * 2 - 1) * T.jitter);
    return [{ type: 'gone' }];
  }
}

// --- La hora de Alicante y el guiri del flamenco ---------------------------------

/** Parámetro de desarrollo, compartido con la isla del after (T273): `?hora=4` finge que son las 04:00 en Alicante. */
export const HOUR_PARAM = 'hora';

/** La zona horaria de Alicante. */
export const ALICANTE_TZ = 'Europe/Madrid';

/** La hora (0–23) que pide la URL de desarrollo, o null. */
export function hourParam(search: string): number | null {
  const v = new URLSearchParams(search).get(HOUR_PARAM);
  if (v === null || !/^\d{1,2}$/.test(v)) return null;
  const h = Number(v);
  return h >= 0 && h <= 23 ? h : null;
}

/** La hora (0–23) en Alicante en el instante `now`; `override` (el parámetro de desarrollo) manda. */
export function alicanteHour(now: Date = new Date(), override: number | null = null): number {
  if (override !== null) return override;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: ALICANTE_TZ,
      hour: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(now);
    const h = Number(parts.find((p) => p.type === 'hour')?.value);
    if (Number.isFinite(h)) return h % 24;
  } catch {
    // Sin Intl con zonas horarias: la hora local.
  }
  return now.getHours();
}

/** Las horas del after (T273): de 03:00 a 07:00 de Alicante. */
export const AFTER_HOURS = { from: 3, to: 7 } as const;

export function isAfterHours(hour: number): boolean {
  return hour >= AFTER_HOURS.from && hour < AFTER_HOURS.to;
}

/** Las frases del guiri, por id (el texto va por i18n: `mar.guiri.<id>`). */
export type GuiriLine = 'where' | 'always' | 'after';

/** Qué frases dice a esta hora: las dos de siempre y, en horas de after, la que señala la isla. */
export function guiriLines(hour: number): readonly GuiriLine[] {
  return isAfterHours(hour) ? ['where', 'always', 'after'] : ['where', 'always'];
}

/** La frase que toca al toque número `tap` (desde 0), a esta hora: van en círculo. */
export function guiriLine(tap: number, hour: number): GuiriLine {
  const lines = guiriLines(hour);
  const i = ((Math.floor(tap) % lines.length) + lines.length) % lines.length;
  return lines[i]!;
}

// --- El compás del cangrejo ---------------------------------------------------------

/** Pulsaciones por minuto con que baila cuando suena la radio (no hay BPM por canción). muestra */
export const CRAB_BPM = 124;

/** Fase del compás (0..1, un pulso por vuelta) a los `elapsedS` s de canción. */
export function crabBeatPhase(elapsedS: number, bpm = CRAB_BPM): number {
  if (!Number.isFinite(elapsedS) || bpm <= 0) return 0;
  const beats = (elapsedS * bpm) / 60;
  return beats - Math.floor(beats);
}

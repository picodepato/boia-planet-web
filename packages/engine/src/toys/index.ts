/**
 * Los juguetes del barco de `/mar` (plan 029 T271): la bocina y el barco
 * aburrido. Sin DOM ni three.js: relojes puros con el tiempo inyectado, que el
 * mar 3D avanza cada fotograma y a los que avisa de cada entrada del jugador.
 *
 * - Bocina (`HornClock`): cada pitido pide permiso; una pausa corta impide el
 *   ruido de pitar sin parar. Tres pitidos seguidos cerca de la Boia Fiestera
 *   la hacen bailar unos segundos (y dan el logro).
 * - Siesta (`NapClock`): tras un rato sin tocar nada con el barco quieto, el
 *   capitán se duerme (Zzz, ronquido, una gaviota en la proa). Cualquier toque
 *   lo despierta con un susto. Nunca con un menú, un diálogo o un minijuego
 *   abierto: ahí el reloj se pone a cero.
 *
 * Se importa como `@boia/engine/toys`. Todos los números son `muestra`.
 */

/** Parámetro de desarrollo: `?siesta=1` duerme al capitán a los 5 s. */
export const NAP_PARAM = 'siesta';

/** Encuentro del logro «Fiestera bailando» (secreto, sin sello del Carnet). */
export const FIESTERA_BAILANDO_ENCOUNTER = 'fiestera-bailando';

export interface ToysTuning {
  /** s mínimos entre dos pitidos. muestra */
  hornCooldownS: number;
  /** Pitidos cerca de la Fiestera que la hacen bailar. muestra */
  danceHonks: number;
  /** s en que tienen que caber esos pitidos. muestra */
  danceWindowS: number;
  /** s que baila. muestra */
  danceS: number;
  /** Distancia (escena) a la que la Fiestera oye la bocina. muestra */
  nearFiesteraD: number;
  /** s quieto y sin tocar nada hasta que se duerme. muestra */
  napAfterS: number;
  /** s hasta que la gaviota se posa en la proa, ya dormido. muestra */
  gullAfterS: number;
  /** s entre ronquidos. muestra */
  snoreEveryS: number;
  /** Velocidad (u de motor/s) por debajo de la cual el barco cuenta como quieto. muestra */
  stillBelow: number;
}

export const TOYS_TUNING: ToysTuning = {
  hornCooldownS: 0.9,
  danceHonks: 3,
  danceWindowS: 6,
  danceS: 5,
  nearFiesteraD: 18,
  napAfterS: 60,
  gullAfterS: 4,
  snoreEveryS: 3.2,
  stillBelow: 0.4,
};

/** `?siesta=N` (s hasta dormirse; sin número o `1`: 5 s), o null sin el parámetro. */
export function napParam(search: string): number | null {
  const v = new URLSearchParams(search).get(NAP_PARAM);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 1 ? n : 5;
}

// --- Bocina -----------------------------------------------------------------

export interface HornResult {
  /** ¿Suena? (false: dentro de la pausa) */
  ok: boolean;
  /** ¿Este pitido hace bailar a la Fiestera? */
  dance: boolean;
}

export class HornClock {
  private last = Number.NEGATIVE_INFINITY;
  private near: number[] = [];

  constructor(readonly tuning: ToysTuning = TOYS_TUNING) {}

  /** Un pitido en el instante `now` (s). `nearFiestera`: ¿está la Fiestera al alcance? */
  honk(now: number, nearFiestera: boolean): HornResult {
    const t = this.tuning;
    if (now - this.last < t.hornCooldownS) return { ok: false, dance: false };
    this.last = now;
    if (!nearFiestera) {
      this.near = [];
      return { ok: true, dance: false };
    }
    this.near = this.near.filter((n) => now - n <= t.danceWindowS);
    this.near.push(now);
    if (this.near.length >= t.danceHonks) {
      this.near = [];
      return { ok: true, dance: true };
    }
    return { ok: true, dance: false };
  }

  /** Segundos de pausa que le quedan a la bocina en `now`. */
  cooldown(now: number): number {
    return Math.max(0, this.last + this.tuning.hornCooldownS - now);
  }
}

/** Cómo suena la bocina de un barco: cada uno la suya, estable por su id. */
export interface HornVoice {
  /** Nota grave y nota alta del acorde (Hz). */
  low: number;
  high: number;
  wave: 'sawtooth' | 'square' | 'triangle';
  /** Duración (s). */
  length: number;
  /** Cuánto se cae el tono al final (0..0.3). */
  droop: number;
  /** Vibrato (Hz); 0: ninguno. */
  wobble: number;
}

const WAVES: HornVoice['wave'][] = ['sawtooth', 'square', 'triangle'];
const NOTES = [110, 123.5, 131, 147, 165, 175, 196, 220];

/** Hash pequeño y estable (FNV-1a) de un texto. */
export function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Bocinas con voz propia, por id de barco, que no salen del hash: el barco
 * del after (plan 029 T273) suena como su altavoz reventado, grave, largo,
 * cayéndose y con un temblor. muestra
 */
export const HORN_VOICES: Readonly<Record<string, HornVoice>> = {
  after: { low: 98, high: 98 * 1.2, wave: 'sawtooth', length: 0.66, droop: 0.28, wobble: 7 },
};

/** La bocina de un barco, sacada de su id: misma id, misma bocina. */
export function hornVoice(boatId: string | null | undefined): HornVoice {
  const own = boatId ? HORN_VOICES[boatId] : undefined;
  if (own) return own;
  const h = hashId(boatId ?? 'boia');
  const low = NOTES[h % NOTES.length]!;
  const interval = [1.25, 1.333, 1.5, 1.2][(h >>> 3) % 4]!;
  return {
    low,
    high: low * interval,
    wave: WAVES[(h >>> 6) % WAVES.length]!,
    length: 0.38 + ((h >>> 9) % 5) * 0.07,
    droop: ((h >>> 12) % 4) * 0.07,
    wobble: (h >>> 15) % 3 === 0 ? 7 : 0,
  };
}

// --- Siesta -----------------------------------------------------------------

export type NapEvent =
  /** El capitán se duerme. */
  | { type: 'sleep' }
  /** Ronquido (el sonido). */
  | { type: 'snore' }
  /** La gaviota se posa en la proa. */
  | { type: 'gull' }
  /** Se despierta con un susto. */
  | { type: 'wake' };

export interface NapContext {
  /** ¿Está el barco quieto (y sin mando en la mano)? */
  still: boolean;
  /** ¿Hay un menú, un diálogo, un minijuego o algo así encima, o un viaje en curso? */
  blocked: boolean;
}

/** Los sucesos, siempre los mismos objetos: el reloj corre cada fotograma sin crear basura. */
const SLEEP: NapEvent = Object.freeze({ type: 'sleep' });
const SNORE: NapEvent = Object.freeze({ type: 'snore' });
const GULL: NapEvent = Object.freeze({ type: 'gull' });
const WAKE: NapEvent = Object.freeze({ type: 'wake' });

/**
 * Lo que devuelven `input` y `step` es una lista reutilizada: vale hasta la
 * siguiente llamada (se lee en el momento, como hace el mar 3D).
 */
export class NapClock {
  private readonly out: NapEvent[] = [];
  private idle = 0;
  private sleeping = false;
  private asleepFor = 0;
  private snoreIn = 0;
  private gull = false;
  /** s de quietud hasta dormirse (se cambia con `?siesta=`). */
  napAfterS: number;

  constructor(readonly tuning: ToysTuning = TOYS_TUNING) {
    this.napAfterS = tuning.napAfterS;
  }

  get asleep(): boolean {
    return this.sleeping;
  }

  /** ¿Está la gaviota en la proa? */
  get gullOn(): boolean {
    return this.gull;
  }

  get idleS(): number {
    return this.idle;
  }

  /** El jugador tocó algo: la cuenta vuelve a cero; si dormía, despierta. */
  input(): readonly NapEvent[] {
    this.idle = 0;
    this.out.length = 0;
    this.wakeUp();
    return this.out;
  }

  private wakeUp(): void {
    if (!this.sleeping) return;
    this.sleeping = false;
    this.gull = false;
    this.asleepFor = 0;
    this.out.push(WAKE);
  }

  step(dt: number, ctx: NapContext): readonly NapEvent[] {
    const out = this.out;
    out.length = 0;
    // Algo encima, o el barco en marcha: no hay siesta (y si dormía, despierta).
    if (ctx.blocked || !ctx.still) {
      this.idle = 0;
      this.wakeUp();
      return out;
    }
    if (!this.sleeping) {
      this.idle += dt;
      if (this.idle >= this.napAfterS) {
        this.sleeping = true;
        this.asleepFor = 0;
        this.snoreIn = 1.2;
        out.push(SLEEP);
      }
      return out;
    }
    this.asleepFor += dt;
    this.snoreIn -= dt;
    if (this.snoreIn <= 0) {
      this.snoreIn += this.tuning.snoreEveryS;
      out.push(SNORE);
    }
    if (!this.gull && this.asleepFor >= this.tuning.gullAfterS) {
      this.gull = true;
      out.push(GULL);
    }
    return out;
  }
}

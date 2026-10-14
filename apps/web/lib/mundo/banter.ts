/**
 * Las frases de los personajes del mar (plan 029 T272), todo puro y sin DOM:
 * - el «montón» de frases que no se repite hasta agotarse, por personaje y
 *   por ambiente (día = resaca, tarde = calentando, noche = fiesta);
 * - el horóscopo boiero del día, el mismo para todos en Alicante, sacado de la
 *   fecha (Europe/Madrid) y no del azar;
 * - la bienvenida del Puerto: la primera vez y la de «ya estás aquí otra vez».
 * Los textos van por i18n (`es-mar-banter.ts`), todos `muestra` hasta que Álvaro los apruebe.
 */
import { alicanteDate } from '@boia/engine/characters';

// --- Frases por personaje y ambiente -----------------------------------------------

export const BANTER_SPEAKERS = ['fiestera', 'naufrago', 'delfin'] as const;
export type BanterSpeaker = (typeof BANTER_SPEAKERS)[number];

export const BANTER_MOODS = ['dia', 'tarde', 'noche'] as const;
export type BanterMood = (typeof BANTER_MOODS)[number];

/** Frases de cada personaje en cada ambiente (mínimo 6). muestra */
export const BANTER_POOL_SIZE = 8;

/** La clave i18n de la frase `n` (desde 1) de ese personaje y ambiente. */
export function banterKey(speaker: BanterSpeaker, mood: BanterMood, n: number): string {
  return `mar.banter.${speaker}.${mood}.${n}`;
}

/**
 * Un montón de `size` cosas que salen en orden aleatorio sin repetir hasta
 * vaciarse; al rebarajar, la primera nunca es la última que salió.
 */
export class BagPicker {
  private bag: number[] = [];
  private last = -1;

  constructor(
    readonly size: number,
    private readonly rng: () => number = Math.random,
  ) {}

  /** Cuántas quedan antes de rebarajar. */
  get left(): number {
    return this.bag.length;
  }

  next(): number {
    if (this.size <= 0) return 0;
    if (this.bag.length === 0) this.refill();
    this.last = this.bag.pop()!;
    return this.last;
  }

  private refill(): void {
    const a = Array.from({ length: this.size }, (_, i) => i);
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.min(i, Math.floor(this.rng() * (i + 1)));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    // `pop` saca del final: que no sea la última dicha.
    if (a.length > 1 && a[a.length - 1] === this.last) {
      [a[0], a[a.length - 1]] = [a[a.length - 1]!, a[0]!];
    }
    this.bag = a;
  }
}

/** El ambiente de las frases para un ambiente del menú (`dia` | `tarde` | `noche`). */
export function banterMood(mood: string): BanterMood {
  return (BANTER_MOODS as readonly string[]).includes(mood) ? (mood as BanterMood) : 'tarde';
}

/** Elige la frase que toca de cada personaje según el ambiente, sin repetir hasta agotar. */
export class BanterPicker {
  private readonly bags = new Map<string, BagPicker>();

  constructor(
    private readonly rng: () => number = Math.random,
    private readonly size: number = BANTER_POOL_SIZE,
  ) {}

  /** La clave i18n de la próxima frase de `speaker` con ese ambiente. */
  line(speaker: BanterSpeaker, mood: string): string {
    const m = banterMood(mood);
    const id = `${speaker}.${m}`;
    let bag = this.bags.get(id);
    if (!bag) {
      bag = new BagPicker(this.size, this.rng);
      this.bags.set(id, bag);
    }
    return banterKey(speaker, m, bag.next() + 1);
  }

  /**
   * Como `line`, pero callado si ese personaje habló hace menos de `BANTER_COOLDOWN_MS`
   * (dar vueltas junto al náufrago no llena la pantalla de avisos). `nowMs`: el reloj.
   */
  say(speaker: BanterSpeaker, mood: string, nowMs: number): string | null {
    const last = this.spoke.get(speaker);
    if (last !== undefined && nowMs - last < BANTER_COOLDOWN_MS) return null;
    this.spoke.set(speaker, nowMs);
    return this.line(speaker, mood);
  }

  private readonly spoke = new Map<BanterSpeaker, number>();
}

/** Lo mínimo entre dos frases del mismo personaje. muestra */
export const BANTER_COOLDOWN_MS = 30_000;

/**
 * ¿Puede la Fiestera soltar una frase al acercarse? Sólo fuera del rescate: mientras
 * espera entre cocodrilos o sube a bordo mandan sus bocadillos de la misión (`phase`
 * es la fase del rescate; null si el mundo no tiene misión).
 */
export function fiesteraMayChat(phase: string | null): boolean {
  return phase === null || phase === 'delivered';
}

// --- Dónde se ven los bocadillos ------------------------------------------------------

/**
 * Lo lejos (u del mundo de /mar) a lo que se ve el bocadillo de un personaje:
 * algo menos de lo que abarca la cámara de cubierta, para que quien habla
 * esté a la vista, junto al barco. muestra
 */
export const CHAT_RADIUS = 600;

/**
 * ¿Se enseña el bocadillo de un personaje (la charla, el guiri, la gaviota, la
 * Fiestera…)? Nunca en la vista de mapa (T279: desde lejos no se oye a nadie);
 * en la de cubierta, sólo con el barco a menos de `radius` de quien habla
 * (`distance`, u del mundo; null si no se sabe dónde está: no se enseña).
 */
export function chatShows(
  view: { map: boolean; distance: number | null },
  radius: number = CHAT_RADIUS,
): boolean {
  return !view.map && view.distance !== null && view.distance <= radius;
}

// --- El horóscopo boiero --------------------------------------------------------------

/** Parámetro de desarrollo: `?fecha=2026-12-31` finge ese día para el horóscopo. */
export const DATE_PARAM = 'fecha';

/** Cuántos horóscopos hay (mínimo 30). muestra */
export const HOROSCOPO_COUNT = 32;

/** La clave i18n del horóscopo `n` (desde 1). */
export function horoscopoKey(n: number): string {
  return `mar.horoscopo.${n}`;
}

/** La fecha que pide la URL de desarrollo (`AAAA-MM-DD` válida) o null. */
export function dateParam(search: string): string | null {
  const v = new URLSearchParams(search).get(DATE_PARAM);
  if (v === null || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : v;
}

/** El día de hoy en Alicante (`AAAA-MM-DD`): el mismo reloj que la hora del after (T270/T273). */
export { alicanteDate };

/** El día del horóscopo: el de Alicante en `now`, o el que pida `?fecha=` en `search`. */
export function horoscopoDay(search: string, now: Date = new Date()): string {
  return alicanteDate(now, dateParam(search));
}

/** Días desde 1970-01-01 de una fecha `AAAA-MM-DD`. */
function dayNumber(date: string): number {
  return Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 86_400_000);
}

/**
 * Qué horóscopo (0..count-1) toca ese día. Sale solo de la fecha: el mismo
 * día es el mismo para todos y al día siguiente cambia siempre (el paso 7 y
 * el número de horóscopos son primos entre sí: no hay dos días seguidos con
 * el mismo y no se repite hasta pasar todos).
 */
export function horoscopoIndex(date: string, count: number = HOROSCOPO_COUNT): number {
  const n = dayNumber(date);
  if (!Number.isFinite(n) || count <= 0) return 0;
  return (((n * 7) % count) + count) % count;
}

/** La clave i18n del horóscopo de esa fecha. */
export function horoscopoOf(date: string): string {
  return horoscopoKey(horoscopoIndex(date) + 1);
}

/** ¿Falta enseñar el horóscopo de hoy? (`last` es la fecha del último que se vio.) */
export function horoscopoPending(last: string | null, today: string): boolean {
  return last !== today;
}

// --- La bienvenida del Puerto -----------------------------------------------------------

/**
 * Las claves i18n de la bienvenida al Puerto (la primera vez o la de vuelta): un
 * título corto y el texto, que el aviso del móvil enseña en dos renglones.
 */
export function portWelcomeKey(firstVisit: boolean): { title: string; body: string } {
  const k = firstVisit ? 'mar.puerto.bienvenida' : 'mar.puerto.denuevo';
  return { title: k, body: `${k}.texto` };
}

/** La clave i18n del nombre de quien habla (el título del aviso con su frase). */
export const BANTER_NAME_KEY: Readonly<Record<BanterSpeaker, string>> = {
  fiestera: 'mapa.boia-fiestera',
  naufrago: 'mapa.naufrago',
  delfin: 'mapa.delfin',
};

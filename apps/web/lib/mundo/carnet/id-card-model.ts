/**
 * Lo que no es React del Carnet como documento (plan 008, T91, decisión 10;
 * diseño aprobado en docs/propuestas/2026-10-03-carnet.md): el número de
 * miembro, «Miembro desde», la línea de lectura mecánica, el tamaño del apodo
 * y el aspecto de cada sello (forma, tinta y giro salen del id del evento, así
 * el sello de una fiesta es siempre el mismo para todos).
 */

/** Nº de miembro con 4 cifras como mínimo (`0042`); sin servidor, «—». */
export function memberNumberLabel(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return '—';
  return String(Math.trunc(n)).padStart(4, '0');
}

function validDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** «jun 2026» (es-ES, Europe/Madrid). */
export function sinceShort(iso: string | null | undefined): string {
  const d = validDate(iso);
  if (!d) return '';
  return new Intl.DateTimeFormat('es-ES', {
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Madrid',
  }).format(d);
}

/** Día, mes y año de una fecha en Madrid: `['31', '10', '2026']`. */
export function dayMonthYear(iso: string | null | undefined): [string, string, string] | null {
  const d = validDate(iso);
  if (!d) return null;
  const parts = new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Madrid',
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return [get('day'), get('month'), get('year')];
}

/** «31 oct 2026» (es-ES, Europe/Madrid), la fecha legible de un sello. */
export function stampDateLabel(iso: string | null | undefined): string {
  const d = validDate(iso);
  if (!d) return '';
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Madrid',
  }).format(d);
}

/** El apodo baja de tamaño con su largo: hasta 12, hasta 20, hasta 30 caracteres. */
export function nicknameTier(nickname: string): 1 | 2 | 3 {
  const n = [...nickname].length;
  return n <= 12 ? 1 : n <= 20 ? 2 : 3;
}

/** Mayúsculas sin tildes; todo lo que no es letra o cifra, `<`. */
function mrzClean(s: string): string {
  return s
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]+/g, '<');
}

const MRZ_WIDTH = 34;

function mrzPad(s: string): string {
  return (s + '<'.repeat(MRZ_WIDTH)).slice(0, MRZ_WIDTH);
}

/** «AAMM» de una fecha en Madrid (`2606`). */
function yymm(iso: string | null | undefined): string {
  const dmy = dayMonthYear(iso);
  return dmy ? `${dmy[2].slice(2)}${dmy[1]}` : '0000';
}

/**
 * La línea de lectura mecánica del pie (decorativa): número, apodo, AAMM de
 * «Miembro desde», rango y puntos.
 */
export function mrzLines(input: {
  number: number | null | undefined;
  nickname: string;
  since: string | null | undefined;
  rank: string | null | undefined;
  points: number;
}): [string, string] {
  const num = memberNumberLabel(input.number).replace('—', '0000');
  const pts = String(Math.max(0, Math.trunc(input.points))).padStart(5, '0');
  return [
    mrzPad(`IDBOI${num}<<${mrzClean(input.nickname)}`),
    mrzPad(`${yymm(input.since)}<${mrzClean(input.rank ?? '')}<<<<${pts}`),
  ];
}

// ---------------------------------------------------------------------------
// Sellos

export const STAMP_SHAPES = ['circle', 'rect', 'oval'] as const;
export type StampShape = (typeof STAMP_SHAPES)[number];

/** Las tintas del sello (todas ≥ 4,9 : 1 sobre el papel `#edf0f6`). */
export const STAMP_INKS = {
  red: '#a32d12',
  blue: '#36278a',
  ink: '#1b1440',
  orange: '#c43a14',
} as const;
export type StampInk = keyof typeof STAMP_INKS;
const INK_KEYS = Object.keys(STAMP_INKS) as StampInk[];

export interface StampStyle {
  shape: StampShape;
  ink: StampInk;
  /** Grados, de −9 a +9. */
  rotation: number;
}

/** FNV-1a de 32 bits: estable entre navegadores. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Forma, tinta y giro del sello de un evento: siempre los mismos para ese id. */
export function stampStyle(eventId: string): StampStyle {
  const h = hash(eventId);
  return {
    shape: STAMP_SHAPES[h % STAMP_SHAPES.length]!,
    ink: INK_KEYS[Math.floor(h / 3) % INK_KEYS.length]!,
    rotation: (Math.floor(h / 12) % 19) - 9,
  };
}

/** Un sello tal como se pinta: el evento, su fecha y, si el Admin la puso, su imagen. */
export interface StampArt {
  eventId: string;
  name: string;
  /** ISO de la fiesta (o de cuando se concedió, si no se sabe la fiesta). */
  date: string | null;
  /** Imagen del sello (T94: subida o URL); sin ella, el sello generado. */
  image: string | null;
  /** Sello de muestra (un miembro o evento de ejemplo). */
  sample: boolean;
}

/** Celdas del reverso: 3 × 2. */
export const BACK_CELLS = 6;

/**
 * Lo que cabe en el reverso: hasta 6 sellos; con 7 o más, los 5 más
 * recientes y una celda «+N».
 */
export function backLayout<T>(stamps: readonly T[]): { shown: T[]; more: number; empty: number } {
  if (stamps.length > BACK_CELLS) {
    const shown = stamps.slice(0, BACK_CELLS - 1);
    return { shown, more: stamps.length - shown.length, empty: 0 };
  }
  return { shown: [...stamps], more: 0, empty: BACK_CELLS - stamps.length };
}

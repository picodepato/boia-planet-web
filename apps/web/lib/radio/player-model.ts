import type { RadioSong } from '@boia/contracts';

/**
 * El orden en que suena la radio (plan 022 T247, Hernán 2026-10-09): al
 * encenderla suena siempre «la primera» del catálogo (T246) y después
 * canciones al azar de la lista, sin repetir la que acaba de sonar. Aquí las
 * reglas puras, sin navegador: el reproductor (`player.ts`) las llama.
 *
 * - `shuffle` encendido (el de serie): la siguiente, al azar entre las que
 *   no son la actual (y, con filtro de género, sólo entre las del género).
 * - `shuffle` apagado: la lista en su orden, dando la vuelta al final.
 * - `repeat` `one`: la misma otra vez; `all`: como arriba; `off`: al acabar
 *   la lista en orden se para (con `shuffle`, la radio nunca se para).
 */

export type RepeatMode = 'off' | 'all' | 'one';

export interface OrderOptions {
  shuffle: boolean;
  repeat: RepeatMode;
  /** Id del género con el que se filtra la lista, o null (todas). */
  genreId: string | null;
  /** `Math.random`, o uno fijo en las pruebas. */
  random?: (() => number) | undefined;
}

/** Las canciones por su `order` (como el catálogo las lista). */
export function orderedSongs(songs: readonly RadioSong[]): RadioSong[] {
  return [...songs].sort((a, b) => a.order - b.order);
}

/** Las que pueden sonar con el filtro de género puesto (o todas). */
export function playable(songs: readonly RadioSong[], genreId: string | null): RadioSong[] {
  const all = orderedSongs(songs);
  if (!genreId) return all;
  const of = all.filter((s) => s.genreId === genreId);
  return of.length > 0 ? of : all;
}

/** La primera que suena al encender: la marcada, o la de arriba de la lista. */
export function firstSong(songs: readonly RadioSong[]): RadioSong | null {
  const all = orderedSongs(songs);
  return all.find((s) => s.first) ?? all[0] ?? null;
}

/**
 * La que sigue a `current` cuando acaba (`null`: se para). Con `shuffle`
 * elige al azar entre las demás; sin él, la siguiente de la lista.
 */
export function nextSong(
  songs: readonly RadioSong[],
  current: RadioSong | null,
  opts: OrderOptions,
): RadioSong | null {
  if (opts.repeat === 'one' && current) return current;
  const list = playable(songs, opts.genreId);
  if (list.length === 0) return null;
  if (!current) return opts.shuffle ? pickRandom(list, null, opts.random) : list[0]!;
  if (opts.shuffle) return pickRandom(list, current.id, opts.random);
  const i = list.findIndex((s) => s.id === current.id);
  if (i < 0) return list[0]!;
  if (i + 1 < list.length) return list[i + 1]!;
  return opts.repeat === 'all' ? list[0]! : null;
}

/** La de antes de `current` (botón «anterior»): la anterior de la lista, dando la vuelta. */
export function previousSong(
  songs: readonly RadioSong[],
  current: RadioSong | null,
  genreId: string | null,
): RadioSong | null {
  const list = playable(songs, genreId);
  if (list.length === 0) return null;
  if (!current) return list[list.length - 1]!;
  const i = list.findIndex((s) => s.id === current.id);
  if (i < 0) return list[0]!;
  return list[(i - 1 + list.length) % list.length]!;
}

function pickRandom(
  list: readonly RadioSong[],
  avoidId: string | null,
  random: () => number = Math.random,
): RadioSong {
  const pool = list.length > 1 && avoidId ? list.filter((s) => s.id !== avoidId) : list;
  const i = Math.min(pool.length - 1, Math.floor(random() * pool.length));
  return pool[i]!;
}

/**
 * El aviso «Sonando: título - artista» sale sólo si el reproductor está
 * cerrado y cambia la canción (al encender también: pasa de nada a una).
 */
export function shouldToast(
  playerOpen: boolean,
  previousId: string | null,
  nextId: string | null,
): boolean {
  return !playerOpen && nextId !== null && nextId !== previousId;
}

/** `m:ss` del LCD; los segundos que faltan van con «-» delante. */
export function lcdTime(seconds: number, remaining = false): string {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const text = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  return remaining ? `-${text}` : text;
}

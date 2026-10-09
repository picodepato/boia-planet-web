import { z } from 'zod';

/**
 * La radio de la web (plan 022 T246, Hernán 2026-10-09): un catálogo de
 * canciones (unas 100) por género que el Admin sube y ordena, y que el
 * reproductor (T247) lee. Una canción, y sólo una, es «la primera»: suena
 * siempre la primera al encender la radio; luego, al azar.
 *
 * Los géneros se editan en el Admin. Una canción nombra su género por id,
 * así que renombrar un género lo cambia en todas sus canciones; borrar un
 * género que aún tiene canciones no se deja (`genre_in_use`).
 *
 * Aquí, los tipos y las reglas puras (sin navegador ni Supabase): cada
 * operación devuelve un catálogo nuevo o lanza `RadioCatalogError`.
 */

export const RADIO_LIMITS = {
  genreName: 40,
  title: 120,
  artist: 120,
  /** Lo más largo que se admite de una canción, en segundos (20 min). */
  maxSeconds: 1200,
  /** Tope de canciones del catálogo (el objetivo es ~100). */
  maxSongs: 500,
  maxGenres: 40,
} as const;

/** El archivo de una canción subida en el Admin de la demo (IndexedDB, D-20). */
export const LOCAL_RADIO_PREFIX = 'local-radio:';

export const isLocalRadioRef = (src: string): boolean => src.startsWith(LOCAL_RADIO_PREFIX);
export const localRadioKey = (src: string): string => src.slice(LOCAL_RADIO_PREFIX.length);

const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

export const radioGenreSchema = z.object({
  id: z.string().regex(ID),
  name: z.string().trim().min(1).max(RADIO_LIMITS.genreName),
});
export type RadioGenre = z.infer<typeof radioGenreSchema>;

/** Dónde está el archivo: https (Supabase Storage), una ruta de la web o `local-radio:`. */
const songSrc = z
  .string()
  .min(1)
  .max(500)
  .refine(
    (s) => s.startsWith('https://') || /^\/[A-Za-z0-9._/-]+$/.test(s) || isLocalRadioRef(s),
    'src',
  );

export const radioSongSchema = z.object({
  id: z.string().regex(ID),
  title: z.string().trim().min(1).max(RADIO_LIMITS.title),
  artist: z.string().trim().min(1).max(RADIO_LIMITS.artist),
  genreId: z.string().regex(ID),
  durationSeconds: z.number().positive().max(RADIO_LIMITS.maxSeconds),
  src: songSrc,
  /** Posición en la lista (0, 1, 2…; sin huecos tras cada operación). */
  order: z.number().int().min(0),
  /** La que suena primero al encender la radio. Exactamente una si hay canciones. */
  first: z.boolean(),
});
export type RadioSong = z.infer<typeof radioSongSchema>;

/** Lo que lee el reproductor: un JSON pequeño. */
export interface RadioCatalog {
  genres: RadioGenre[];
  songs: RadioSong[];
}

export type RadioProblem =
  | 'duplicate_song'
  | 'duplicate_genre'
  | 'unknown_genre'
  | 'first_count'
  | 'genre_in_use'
  | 'genre_exists'
  | 'genre_name'
  | 'unknown_song'
  | 'too_many';

export class RadioCatalogError extends Error {
  constructor(readonly code: RadioProblem) {
    super(code);
    this.name = 'RadioCatalogError';
  }
}

/** Lo que está mal en un catálogo (vacío si vale). */
export function radioCatalogProblems(c: RadioCatalog): RadioProblem[] {
  const out = new Set<RadioProblem>();
  const genreIds = new Set<string>();
  for (const g of c.genres) {
    if (genreIds.has(g.id)) out.add('duplicate_genre');
    genreIds.add(g.id);
  }
  const songIds = new Set<string>();
  for (const s of c.songs) {
    if (songIds.has(s.id)) out.add('duplicate_song');
    songIds.add(s.id);
    if (!genreIds.has(s.genreId)) out.add('unknown_genre');
  }
  const firsts = c.songs.filter((s) => s.first).length;
  if (c.songs.length > 0 ? firsts !== 1 : firsts !== 0) out.add('first_count');
  return [...out];
}

export const radioCatalogSchema = z
  .object({ genres: z.array(radioGenreSchema), songs: z.array(radioSongSchema) })
  .superRefine((c, ctx) => {
    for (const p of radioCatalogProblems(c)) ctx.addIssue({ code: 'custom', message: p });
  });

/** Las canciones en su orden de lista. */
export function sortedRadioSongs(c: RadioCatalog): RadioSong[] {
  return [...c.songs].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

/** La primera canción (la que suena al encender), o null si no hay canciones. */
export function firstRadioSong(c: RadioCatalog): RadioSong | null {
  return c.songs.find((s) => s.first) ?? sortedRadioSongs(c)[0] ?? null;
}

/**
 * Deja el catálogo en regla: órdenes 0…n-1 por su orden actual y una sola
 * primera (si había varias, la de antes en la lista; si ninguna, la de arriba).
 */
export function normalizeRadioCatalog(c: RadioCatalog): RadioCatalog {
  const sorted = sortedRadioSongs(c);
  const keep = sorted.find((s) => s.first) ?? sorted[0];
  return {
    genres: c.genres.map((g) => ({ ...g })),
    songs: sorted.map((s, order) => ({ ...s, order, first: s.id === keep?.id })),
  };
}

function songIndex(c: RadioCatalog, id: string): number {
  const i = c.songs.findIndex((s) => s.id === id);
  if (i < 0) throw new RadioCatalogError('unknown_song');
  return i;
}

function requireGenre(c: RadioCatalog, genreId: string): void {
  if (!c.genres.some((g) => g.id === genreId)) throw new RadioCatalogError('unknown_genre');
}

export type NewRadioSong = Omit<RadioSong, 'order' | 'first'> & { first?: boolean };

/** Añade una canción al final. La primera de un catálogo vacío es la primera. */
export function addRadioSong(c: RadioCatalog, song: NewRadioSong): RadioCatalog {
  if (c.songs.some((s) => s.id === song.id)) throw new RadioCatalogError('duplicate_song');
  if (c.songs.length >= RADIO_LIMITS.maxSongs) throw new RadioCatalogError('too_many');
  requireGenre(c, song.genreId);
  const first = c.songs.length === 0 || song.first === true;
  const parsed = radioSongSchema.parse({ ...song, order: c.songs.length, first });
  const songs = c.songs.map((s) => (first ? { ...s, first: false } : s));
  return normalizeRadioCatalog({ genres: c.genres, songs: [...songs, parsed] });
}

export type RadioSongPatch = Partial<Pick<RadioSong, 'title' | 'artist' | 'genreId'>>;

/** Cambia el título, el artista o el género de una canción. */
export function updateRadioSong(c: RadioCatalog, id: string, patch: RadioSongPatch): RadioCatalog {
  const i = songIndex(c, id);
  if (patch.genreId !== undefined) requireGenre(c, patch.genreId);
  const next = radioSongSchema.parse({ ...c.songs[i], ...patch });
  return { genres: c.genres, songs: c.songs.map((s, j) => (j === i ? next : s)) };
}

/** Quita una canción. Si era la primera, pasa a serlo la de arriba de la lista. */
export function removeRadioSong(c: RadioCatalog, id: string): RadioCatalog {
  songIndex(c, id);
  return normalizeRadioCatalog({ genres: c.genres, songs: c.songs.filter((s) => s.id !== id) });
}

/** Mueve una canción a la posición `to` de la lista (se recorta a los límites). */
export function moveRadioSong(c: RadioCatalog, id: string, to: number): RadioCatalog {
  songIndex(c, id);
  const sorted = sortedRadioSongs(c);
  const from = sorted.findIndex((s) => s.id === id);
  const [song] = sorted.splice(from, 1);
  const at = Math.max(0, Math.min(sorted.length, Math.trunc(to)));
  sorted.splice(at, 0, song!);
  return normalizeRadioCatalog({
    genres: c.genres,
    songs: sorted.map((s, order) => ({ ...s, order })),
  });
}

/** Marca la primera canción (y desmarca la que lo era). */
export function setFirstRadioSong(c: RadioCatalog, id: string): RadioCatalog {
  songIndex(c, id);
  return { genres: c.genres, songs: c.songs.map((s) => ({ ...s, first: s.id === id })) };
}

/** Un id de género a partir de su nombre: `Reggaetón` → `reggaeton`. */
export function radioGenreId(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || 'genero';
}

/** El nombre de un género, limpio; vacío o de más de 40 letras, `genre_name`. */
export function cleanRadioGenreName(name: string): string {
  const parsed = radioGenreSchema.shape.name.safeParse(name);
  if (!parsed.success) throw new RadioCatalogError('genre_name');
  return parsed.data;
}

const sameName = (a: string, b: string) =>
  a.trim().localeCompare(b.trim(), 'es', { sensitivity: 'base' }) === 0;

/** Crea un género. Dos géneros no pueden llamarse igual. */
export function addRadioGenre(c: RadioCatalog, name: string): RadioCatalog {
  const clean = cleanRadioGenreName(name);
  if (c.genres.some((g) => sameName(g.name, clean))) throw new RadioCatalogError('genre_exists');
  if (c.genres.length >= RADIO_LIMITS.maxGenres) throw new RadioCatalogError('too_many');
  const base = radioGenreId(clean);
  let id = base;
  for (let n = 2; c.genres.some((g) => g.id === id); n++) id = `${base}-${n}`;
  return { genres: [...c.genres, { id, name: clean }], songs: c.songs };
}

/** Renombra un género: sus canciones lo siguen (lo nombran por id). */
export function renameRadioGenre(c: RadioCatalog, id: string, name: string): RadioCatalog {
  const clean = cleanRadioGenreName(name);
  requireGenre(c, id);
  if (c.genres.some((g) => g.id !== id && sameName(g.name, clean))) {
    throw new RadioCatalogError('genre_exists');
  }
  return {
    genres: c.genres.map((g) => (g.id === id ? { ...g, name: clean } : g)),
    songs: c.songs,
  };
}

/** Borra un género; no se deja mientras tenga canciones (`genre_in_use`). */
export function deleteRadioGenre(c: RadioCatalog, id: string): RadioCatalog {
  requireGenre(c, id);
  if (c.songs.some((s) => s.genreId === id)) throw new RadioCatalogError('genre_in_use');
  return { genres: c.genres.filter((g) => g.id !== id), songs: c.songs };
}

/** Cuántas canciones tiene cada género. */
export function radioGenreCounts(c: RadioCatalog): Map<string, number> {
  const out = new Map(c.genres.map((g) => [g.id, 0]));
  for (const s of c.songs) out.set(s.genreId, (out.get(s.genreId) ?? 0) + 1);
  return out;
}

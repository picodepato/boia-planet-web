import { describe, expect, it } from 'vitest';
import {
  type RadioCatalog,
  RadioCatalogError,
  addRadioGenre,
  addRadioSong,
  deleteRadioGenre,
  firstRadioSong,
  moveRadioSong,
  radioCatalogProblems,
  radioCatalogSchema,
  radioGenreCounts,
  radioGenreId,
  radioSongsWithoutGenre,
  removeRadioSong,
  renameRadioGenre,
  setFirstRadioSong,
  sortedRadioSongs,
  updateRadioSong,
} from './radio';

const base = (): RadioCatalog => ({
  genres: [
    { id: 'techno', name: 'Techno' },
    { id: 'house', name: 'House' },
  ],
  songs: [],
});

const song = (id: string, genreId = 'techno') => ({
  id,
  title: `Título ${id}`,
  artist: 'DJ Muestra',
  genreId,
  durationSeconds: 4,
  src: `/radio/muestra/${id}.mp3`,
});

const withSongs = (...ids: string[]) => ids.reduce((c, id) => addRadioSong(c, song(id)), base());

const firsts = (c: RadioCatalog) => c.songs.filter((s) => s.first).map((s) => s.id);

function codeOf(work: () => unknown): string | undefined {
  try {
    work();
  } catch (err) {
    return err instanceof RadioCatalogError ? err.code : 'other';
  }
  return undefined;
}

describe('radio: la primera canción (exactamente una)', () => {
  it('la primera que entra en un catálogo vacío es la primera; las demás no', () => {
    const c = withSongs('a', 'b', 'c');
    expect(firsts(c)).toEqual(['a']);
    expect(firstRadioSong(c)?.id).toBe('a');
    expect(radioCatalogProblems(c)).toEqual([]);
  });

  it('añadir una marcada como primera quita la marca a la anterior', () => {
    const c = addRadioSong(withSongs('a', 'b'), { ...song('c'), first: true });
    expect(firsts(c)).toEqual(['c']);
  });

  it('marcar otra deja sólo esa', () => {
    expect(firsts(setFirstRadioSong(withSongs('a', 'b', 'c'), 'b'))).toEqual(['b']);
  });

  it('al quitar la primera pasa a serlo la de arriba de la lista', () => {
    const c = moveRadioSong(withSongs('a', 'b', 'c'), 'c', 0);
    expect(firsts(removeRadioSong(c, 'a'))).toEqual(['c']);
    expect(firsts(removeRadioSong(removeRadioSong(c, 'a'), 'c'))).toEqual(['b']);
    expect(firsts(removeRadioSong(withSongs('a'), 'a'))).toEqual([]);
  });

  it('un catálogo con dos primeras o ninguna no vale', () => {
    const c = withSongs('a', 'b');
    const two = { ...c, songs: c.songs.map((s) => ({ ...s, first: true })) };
    const none = { ...c, songs: c.songs.map((s) => ({ ...s, first: false })) };
    expect(radioCatalogProblems(two)).toContain('first_count');
    expect(radioCatalogProblems(none)).toContain('first_count');
    expect(radioCatalogSchema.safeParse(two).success).toBe(false);
    expect(radioCatalogSchema.safeParse(c).success).toBe(true);
  });
});

describe('radio: canciones', () => {
  it('mover cambia el orden sin huecos y deja la primera donde estaba', () => {
    const c = moveRadioSong(withSongs('a', 'b', 'c', 'd'), 'd', 1);
    expect(sortedRadioSongs(c).map((s) => s.id)).toEqual(['a', 'd', 'b', 'c']);
    expect(c.songs.map((s) => s.order).sort()).toEqual([0, 1, 2, 3]);
    expect(firsts(c)).toEqual(['a']);
    // Fuera de los límites se recorta.
    expect(sortedRadioSongs(moveRadioSong(c, 'a', 99)).at(-1)?.id).toBe('a');
  });

  it('editar título, artista y género; un género que no existe no vale', () => {
    const c = updateRadioSong(withSongs('a'), 'a', { title: 'Nueva', genreId: 'house' });
    expect(c.songs[0]).toMatchObject({ title: 'Nueva', genreId: 'house' });
    expect(codeOf(() => updateRadioSong(c, 'a', { genreId: 'jazz' }))).toBe('unknown_genre');
    expect(codeOf(() => updateRadioSong(c, 'zz', { title: 'x' }))).toBe('unknown_song');
    expect(codeOf(() => addRadioSong(c, song('b', 'jazz')))).toBe('unknown_genre');
    expect(codeOf(() => addRadioSong(c, song('a')))).toBe('duplicate_song');
  });
});

describe('radio: géneros', () => {
  it('crear: id del nombre, nombres sin repetir', () => {
    expect(radioGenreId('Reggaetón Old School')).toBe('reggaeton-old-school');
    const c = addRadioGenre(base(), 'Reggaetón');
    expect(c.genres.at(-1)).toEqual({ id: 'reggaeton', name: 'Reggaetón' });
    expect(codeOf(() => addRadioGenre(c, 'reggaeton'))).toBe('genre_exists');
  });

  it('renombrar actualiza sus canciones (lo nombran por id)', () => {
    const c = renameRadioGenre(withSongs('a', 'b'), 'techno', 'Techno duro');
    expect(c.genres.find((g) => g.id === 'techno')?.name).toBe('Techno duro');
    expect(c.songs.every((s) => s.genreId === 'techno')).toBe(true);
    expect(codeOf(() => renameRadioGenre(c, 'house', 'techno duro'))).toBe('genre_exists');
  });

  it('nombre vacío o de más de 40 letras: genre_name', () => {
    expect(codeOf(() => addRadioGenre(base(), ' '))).toBe('genre_name');
    expect(codeOf(() => addRadioGenre(base(), 'x'.repeat(41)))).toBe('genre_name');
    expect(codeOf(() => renameRadioGenre(base(), 'techno', ''))).toBe('genre_name');
    expect(addRadioGenre(base(), ` ${'x'.repeat(40)} `).genres.at(-1)?.name).toHaveLength(40);
  });

  it('plan 023 T255: borrar un género con canciones las deja sin género, nunca las borra', () => {
    const c = updateRadioSong(withSongs('a', 'b'), 'b', { genreId: 'house' });
    const next = deleteRadioGenre(c, 'techno');
    expect(next.genres.map((g) => g.id)).toEqual(['house']);
    expect(next.songs.map((s) => [s.id, s.genreId])).toEqual([
      ['a', null],
      ['b', 'house'],
    ]);
    expect(radioSongsWithoutGenre(next).map((s) => s.id)).toEqual(['a']);
    expect(radioGenreCounts(next).get('house')).toBe(1);
    expect(radioCatalogProblems(next)).toEqual([]);
    expect(radioCatalogSchema.safeParse(next).success).toBe(true);
    expect(codeOf(() => deleteRadioGenre(next, 'techno'))).toBe('unknown_genre');
  });

  it('plan 023 T255: una canción cambia de género o se queda sin él', () => {
    const c = withSongs('a');
    const none = updateRadioSong(c, 'a', { genreId: null });
    expect(none.songs[0]?.genreId).toBeNull();
    expect(updateRadioSong(none, 'a', { genreId: 'house' }).songs[0]?.genreId).toBe('house');
    expect(codeOf(() => updateRadioSong(c, 'a', { genreId: 'nada' }))).toBe('unknown_genre');
    const added = addRadioSong(c, { ...song('b'), genreId: null });
    expect(added.songs.find((s) => s.id === 'b')?.genreId).toBeNull();
  });
});

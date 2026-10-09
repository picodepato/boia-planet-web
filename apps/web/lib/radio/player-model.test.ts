import type { RadioSong } from '@boia/contracts';
import { describe, expect, it } from 'vitest';
import { SAMPLE_RADIO_CATALOG } from './muestra';
import { firstSong, lcdTime, nextSong, playable, previousSong, shouldToast } from './player-model';

/** Un generador fijo: la misma secuencia en cada prueba. */
function seeded(seed: number): () => number {
  let x = seed;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}

const songs: RadioSong[] = SAMPLE_RADIO_CATALOG.songs;

describe('radio: el orden en que suena (plan 022 T247)', () => {
  it('al encender suena la primera marcada en el catálogo', () => {
    const first = firstSong(songs)!;
    expect(first.first).toBe(true);
    expect(songs.filter((s) => s.first)).toEqual([first]);
  });

  it('sin marca, la de arriba de la lista', () => {
    const unmarked = songs.map((s) => ({ ...s, first: false }));
    expect(firstSong(unmarked)?.id).toBe([...songs].sort((a, b) => a.order - b.order)[0]!.id);
    expect(firstSong([])).toBeNull();
  });

  it('después, al azar y nunca la que acaba de sonar', () => {
    const random = seeded(7);
    let current = firstSong(songs);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const next = nextSong(songs, current, {
        shuffle: true,
        repeat: 'all',
        genreId: null,
        random,
      });
      expect(next).not.toBeNull();
      expect(next!.id).not.toBe(current!.id);
      seen.add(next!.id);
      current = next;
    }
    // Se mueve por la lista entera, no por un rincón.
    expect(seen.size).toBeGreaterThan(songs.length / 2);
  });

  it('con filtro de género, sólo entre las de ese género', () => {
    const genre = songs[0]!.genreId;
    const random = seeded(3);
    let current: RadioSong | null = null;
    for (let i = 0; i < 50; i++) {
      current = nextSong(songs, current, { shuffle: true, repeat: 'all', genreId: genre, random });
      expect(current?.genreId).toBe(genre);
    }
    expect(playable(songs, genre).every((s) => s.genreId === genre)).toBe(true);
    // Un género sin canciones no deja la radio muda: todas.
    expect(playable(songs, 'no-existe')).toHaveLength(songs.length);
  });

  it('sin aleatorio: la lista en orden, y al final según «repetir»', () => {
    const ordered = playable(songs, null);
    const last = ordered[ordered.length - 1]!;
    const opts = { shuffle: false, genreId: null };
    expect(nextSong(songs, ordered[0]!, { ...opts, repeat: 'all' })?.id).toBe(ordered[1]!.id);
    expect(nextSong(songs, last, { ...opts, repeat: 'all' })?.id).toBe(ordered[0]!.id);
    expect(nextSong(songs, last, { ...opts, repeat: 'off' })).toBeNull();
    expect(nextSong(songs, null, { ...opts, repeat: 'off' })?.id).toBe(ordered[0]!.id);
  });

  it('«repetir esta» devuelve la misma; «anterior» da la vuelta', () => {
    const ordered = playable(songs, null);
    expect(nextSong(songs, ordered[3]!, { shuffle: true, repeat: 'one', genreId: null })?.id).toBe(
      ordered[3]!.id,
    );
    expect(previousSong(songs, ordered[0]!, null)?.id).toBe(ordered[ordered.length - 1]!.id);
    expect(previousSong(songs, ordered[5]!, null)?.id).toBe(ordered[4]!.id);
    expect(previousSong([], null, null)).toBeNull();
  });

  it('una sola canción: con aleatorio se repite ella (no hay otra)', () => {
    const one = [songs[0]!];
    expect(nextSong(one, one[0]!, { shuffle: true, repeat: 'all', genreId: null })?.id).toBe(
      one[0]!.id,
    );
  });

  it('el aviso «Sonando» sale sólo con el reproductor cerrado y al cambiar de canción', () => {
    expect(shouldToast(false, null, 'a')).toBe(true);
    expect(shouldToast(false, 'a', 'b')).toBe(true);
    expect(shouldToast(false, 'a', 'a')).toBe(false);
    expect(shouldToast(true, 'a', 'b')).toBe(false);
    expect(shouldToast(false, 'a', null)).toBe(false);
  });

  it('el tiempo de la pantalla: m:ss, y con «-» lo que queda', () => {
    expect(lcdTime(0)).toBe('0:00');
    expect(lcdTime(65.8)).toBe('1:05');
    expect(lcdTime(4, true)).toBe('-0:04');
    expect(lcdTime(Number.NaN)).toBe('0:00');
  });
});

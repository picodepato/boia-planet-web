import { createLocalRepository } from '@boia/store';
import { describe, expect, it } from 'vitest';
import { discoverPool, pickDiscover, pickMember, seededRandom } from './discover';

/**
 * «Descubrir a un BOIERO» (T66): un Carnet al azar entre miembros de muestra
 * y artistas; con la misma semilla, la misma serie; nunca repite el que se
 * está viendo si hay otro.
 */

async function members() {
  return createLocalRepository({ storage: null }).carnet.members();
}

describe('Descubrir a un BOIERO', () => {
  it('cualquiera de la lista puede salir: miembros y artistas', async () => {
    const list = await members();
    expect(list.some((m) => m.kind === 'member')).toBe(true);
    expect(list.some((m) => m.kind === 'artist')).toBe(true);
    expect(pickMember(list, () => 0)?.userId).toBe(list[0]!.userId);
    expect(pickMember(list, () => 0.999999)?.userId).toBe(list.at(-1)!.userId);
    const rand = seededRandom(66);
    const kinds = new Set(Array.from({ length: 200 }, () => pickMember(list, rand)!.kind));
    expect(kinds).toEqual(new Set(['member', 'artist']));
  });

  it('la misma semilla da la misma serie', async () => {
    const list = await members();
    const a = seededRandom(7);
    const b = seededRandom(7);
    const run = (r: () => number) => Array.from({ length: 10 }, () => pickMember(list, r)!.userId);
    expect(run(a)).toEqual(run(b));
  });

  it('no repite el que se ve si hay otro; sin nadie, nada', async () => {
    const list = await members();
    const first = list[0]!.userId;
    expect(pickMember(list, () => 0, first)?.userId).toBe(list[1]!.userId);
    expect(pickMember([list[0]!], () => 0, first)?.userId).toBe(first);
    expect(pickMember([], Math.random)).toBeNull();
  });
});

/**
 * Los «Descubre» bajo las respuestas de un Carnet (plan 023 T251): el mismo
 * azar, pero lo excluido (el propio, el artista que se ve) nunca sale.
 */
describe('Descubre bajo las respuestas', () => {
  it('nunca sale el propio ni el artista que se está viendo', async () => {
    const list = await members();
    for (const self of list) {
      const rand = seededRandom(251);
      for (let i = 0; i < 100; i++) {
        expect(pickDiscover(list, rand, { exclude: [self.userId] })?.userId).not.toBe(self.userId);
      }
    }
    // Aunque sea el único: no hay otro, no sale nada (a diferencia del ranking).
    expect(pickDiscover([list[0]!], () => 0, { exclude: [list[0]!.userId] })).toBeNull();
    // Excluir a nadie (sin Carnet propio todavía) deja a todos.
    expect(discoverPool(list, { exclude: [null, undefined] })).toEqual(list);
  });

  it('«Descubre un artista» sólo da artistas, nunca el de la ficha', async () => {
    const list = await members();
    const artists = list.filter((m) => m.kind === 'artist');
    expect(artists.length).toBeGreaterThan(1);
    const current = artists[0]!.userId;
    const pool = discoverPool(list, { exclude: [current], kind: 'artist' });
    expect(pool.map((m) => m.userId)).toEqual(artists.slice(1).map((m) => m.userId));
    const rand = seededRandom(23);
    const seen = new Set(
      Array.from({ length: 300 }, () => {
        const m = pickDiscover(list, rand, { exclude: [current], kind: 'artist' })!;
        expect(m.kind).toBe('artist');
        return m.userId;
      }),
    );
    expect(seen).toEqual(new Set(pool.map((m) => m.userId)));
    // Con un solo artista, que es el de la ficha: ninguno.
    expect(pickDiscover([artists[0]!], Math.random, { exclude: [current], kind: 'artist' })).toBeNull();
  });

  it('sin Carnets que descubrir, nada', async () => {
    expect(pickDiscover([], Math.random)).toBeNull();
    expect(pickDiscover([], Math.random, { kind: 'artist' })).toBeNull();
    const list = await members();
    const onlyMembers = list.filter((m) => m.kind === 'member');
    expect(pickDiscover(onlyMembers, Math.random, { kind: 'artist' })).toBeNull();
  });
});

import { createLocalRepository } from '@boia/store';
import { describe, expect, it } from 'vitest';
import { pickMember, seededRandom } from './discover';

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

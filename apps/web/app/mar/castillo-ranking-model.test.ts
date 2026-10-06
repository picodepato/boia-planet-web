import { describe, expect, it, vi } from 'vitest';
import { castleResult, memoryCastleStorage } from '../../lib/mundo/__fixtures__/castle-result';
import { readCastleBest } from '../../lib/mundo/ranking-castle';
import { rankCastleGame } from './castillo-ranking-model';

describe('tarjeta final: puntuación, mejor y puesto del Castillo', () => {
  const setup = (mode: 'local' | 'guest' | 'member' = 'local') => ({
    mode,
    storage: memoryCastleStorage(),
    submit: vi.fn(async () => ({
      kind: 'global' as const,
      position: 2,
      total: 30,
      bestScore: 4000,
      best: false,
    })),
  });
  it('local: usa el score de la sim sin multiplicador; el puesto es del mejor, no del intento peor', () => {
    const deps = setup();
    const r = castleResult({ difficulty: 'tormenta', castleLife: 90 });
    const first = rankCastleGame(r, deps);
    expect(first.now).toMatchObject({
      score: r.score,
      best: r.score,
      isBest: true,
      standing: { kind: 'local' },
    });
    expect(first.later).toBeNull();
    const low = rankCastleGame(castleResult({ difficulty: 'tormenta' }), deps);
    expect(low.now).toMatchObject({ best: r.score, isBest: false, standing: first.now.standing });
    expect(deps.submit).not.toHaveBeenCalled();
  });
  it('un miembro guarda local, envía una vez y recibe el mejor/puesto global', async () => {
    const deps = setup('member');
    const r = castleResult();
    const out = rankCastleGame(r, deps);
    expect(out.now.standing.kind).toBe('loading');
    expect(readCastleBest(deps.storage, 5, 'normal')?.score).toBe(r.score);
    expect(await out.later).toMatchObject({
      best: 4000,
      isBest: false,
      standing: { kind: 'global', position: 2, total: 30 },
    });
    expect(deps.submit).toHaveBeenCalledExactlyOnceWith(r);
  });
  it('invitado no envía; un fallo conserva el mejor local', async () => {
    const guest = setup('guest');
    expect(rankCastleGame(castleResult(), guest).now.standing.kind).toBe('guest');
    expect(guest.submit).not.toHaveBeenCalled();
    const deps = {
      ...setup('member'),
      submit: vi.fn(async () => {
        throw Error('offline');
      }),
    };
    const out = rankCastleGame(castleResult(), deps);
    expect(await out.later).toMatchObject({
      best: out.now.best,
      standing: { kind: 'unavailable' },
    });
  });
  it('rechazadas en cualquier modo: ni storage ni envío ni mejor nuevo', () => {
    for (const mode of ['local', 'guest', 'member'] as const)
      for (const result of [
        castleResult({ ranked: false }),
        castleResult({ end: 'quit' }),
        castleResult({ playedS: 5 }),
        castleResult({ score: 999999 }),
      ]) {
        const deps = setup(mode);
        const out = rankCastleGame(result, deps);
        expect(out.now).toMatchObject({ best: null, isBest: false, standing: { kind: 'off' } });
        expect(out.later).toBeNull();
        expect(deps.submit).not.toHaveBeenCalled();
        expect(readCastleBest(deps.storage, 5, 'normal')).toBeNull();
      }
  });
});

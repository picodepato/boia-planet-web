import {
  CANON_DEFAULTS,
  CANON_MEDAL_PRIZES,
  LocalSessionAuthority,
  WorldMinigameSession,
  canon,
  canonEnd,
} from '@boia/engine/minigames';
import { MemoryStorage, createLocalRepository } from '@boia/store';
import { describe, expect, it } from 'vitest';

/**
 * Premios de los minijuegos con el repositorio local de verdad (T16): la
 * política por medalla y día del Cañón aguanta recargas (la Vigilancia del
 * faro, con su capa 2D, se quitó en el plan 014, T157). Cada «visita»
 * es una carga de página: repositorio nuevo sobre el mismo almacenamiento y
 * autoridad de sesiones nueva (las sesiones no sobreviven a la recarga).
 */

function browser(start = '2026-09-29T18:00:00Z') {
  const storage = new MemoryStorage();
  let t = new Date(start).getTime();
  let seed = 1000;
  const clock = { now: () => t, advance: (ms: number) => (t += ms) };
  const visit = () => {
    const repo = createLocalRepository({ storage, now: () => new Date(t), watch: false });
    const authority = new LocalSessionAuthority(clock.now, () => (seed += 7919));
    return {
      repo,
      /**
       * Una partida del Cañón en el mar (T119): `activeS` de juego, y el
       * reloj pasa lo que dura (más `pausedS` de pausas).
       */
      async playCanon(reason: 'survived' | 'flooded', activeS: number, pausedS = 0) {
        const session = new WorldMinigameSession({ def: canon, authority, sink: repo.progress });
        clock.advance((activeS + pausedS) * 1000);
        return session.finish(canonEnd(reason, activeS));
      },
    };
  };
  return { clock, visit };
}

describe('premios de minijuego en el repositorio local', () => {
  it('«por medalla y día» (T153): el bronce del Cañón al amanecer se cobra una vez al día, también tras recargar', async () => {
    expect(CANON_DEFAULTS.reward.policy).toBe('daily');
    const { bronce } = CANON_MEDAL_PRIZES;
    const b = browser('2026-09-29T08:00:00Z');
    const first = b.visit();
    // 7:00 activos con pausas por medio: el tiempo activo es lo que cuenta.
    const won = await first.playCanon('survived', 420, 200);
    expect(won.validation).toEqual({ valid: true });
    expect(won.reward).toEqual({ granted: true, ...bronce, tiers: ['bronce'] });
    // El mismo día, otra carga de página: ya cobrado.
    const same = b.visit();
    expect((await same.playCanon('survived', 420)).reward).toEqual({
      granted: false,
      reason: 'duplicate',
    });
    b.clock.advance(2 * 24 * 3600 * 1000);
    const later = b.visit();
    expect((await later.playCanon('survived', 420)).reward.granted).toBe(true);
    expect(await later.repo.progress.balances()).toMatchObject({
      points: 2 * bronce.points,
      coins: 2 * bronce.coins,
    });
    const ids = (await later.repo.progress.ledger()).map((e) => e.id);
    expect(ids).toHaveLength(2);
    expect(ids.every((id) => id.startsWith('world_reward:minigame:canon:bronce@'))).toBe(true);
  });

  it('una partida perdida no toca el libro', async () => {
    const b = browser();
    const v = b.visit();
    const flooded = await v.playCanon('flooded', 95);
    expect(flooded.reward).toEqual({ granted: false, reason: 'not_won' });
    expect(await v.repo.progress.ledger()).toHaveLength(0);
  });
});

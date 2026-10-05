import {
  type BaseConfig,
  CANON_DEFAULTS,
  FARO_DEFAULTS,
  LocalSessionAuthority,
  MinigameController,
  type MinigameDefinition,
  WorldMinigameSession,
  canon,
  canonEnd,
  faro,
} from '@boia/engine/minigames';
import { type Bot, faroExpert, playHeadless } from '@boia/engine/minigames/testing';
import { MemoryStorage, createLocalRepository } from '@boia/store';
import { describe, expect, it } from 'vitest';

/**
 * Premios de los minijuegos con el repositorio local de verdad (T16): la
 * política única / diaria / por temporada aguanta recargas. Cada «visita»
 * es una carga de página: repositorio nuevo sobre el mismo almacenamiento y
 * autoridad de sesiones nueva (las sesiones no sobreviven a la recarga).
 */

function browser(start = '2026-09-29T18:00:00Z') {
  const storage = new MemoryStorage();
  let t = new Date(start).getTime();
  // Fixed seed sequence: the default random seed made an idle Faro sometimes win.
  let seed = 1000;
  const clock = { now: () => t, advance: (ms: number) => (t += ms) };
  const visit = () => {
    const repo = createLocalRepository({ storage, now: () => new Date(t), watch: false });
    const authority = new LocalSessionAuthority(clock.now, () => (seed += 7919));
    return {
      repo,
      async play<C extends BaseConfig>(def: MinigameDefinition<C>, bot: Bot, config?: C) {
        const controller = new MinigameController({
          def,
          ...(config ? { config } : {}),
          authority,
          sink: repo.progress,
        });
        playHeadless(controller, bot, clock.advance);
        return controller.settling!;
      },
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
  it('«una vez»: tras ganar y recargar, no vuelve a conceder', async () => {
    const once = { ...FARO_DEFAULTS, reward: { ...FARO_DEFAULTS.reward, policy: 'once' as const } };
    const b = browser();
    const first = await b.visit().play(faro, faroExpert, once);
    expect(first.ending.outcome).toBe('won');
    expect(first.reward.granted).toBe(true);

    b.clock.advance(3 * 24 * 3600 * 1000);
    const later = b.visit();
    const again = await later.play(faro, faroExpert, once);
    expect(again.ending.outcome).toBe('won');
    expect(again.reward).toEqual({ granted: false, reason: 'duplicate' });
    expect(await later.repo.progress.balances()).toMatchObject({
      points: once.reward.points,
      coins: once.reward.coins,
    });
  });

  it('«diaria»: una por día de Madrid, también tras recargar', async () => {
    expect(FARO_DEFAULTS.reward.policy).toBe('daily');
    const b = browser('2026-09-29T08:00:00Z');
    expect((await b.visit().play(faro, faroExpert)).reward.granted).toBe(true);

    // Mismo día, otra carga de página.
    b.clock.advance(4 * 3600 * 1000);
    expect((await b.visit().play(faro, faroExpert)).reward).toEqual({
      granted: false,
      reason: 'duplicate',
    });

    // Al día siguiente, otra vez.
    b.clock.advance(24 * 3600 * 1000);
    const next = b.visit();
    expect((await next.play(faro, faroExpert)).reward.granted).toBe(true);
    expect(await next.repo.progress.balances()).toMatchObject({
      points: 2 * FARO_DEFAULTS.reward.points,
      coins: 2 * FARO_DEFAULTS.reward.coins,
    });
    const ids = (await next.repo.progress.ledger()).map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith('world_reward:minigame:faro@'))).toBe(true);
  });

  it('«por temporada»: el Cañón en el mar da 150 + 50 al amanecer una vez, también tras recargar', async () => {
    expect(CANON_DEFAULTS.reward.policy).toBe('season');
    const b = browser();
    const first = b.visit();
    // 7:00 activos con pausas por medio: el tiempo activo es lo que cuenta.
    const won = await first.playCanon('survived', 420, 200);
    expect(won.validation).toEqual({ valid: true });
    expect(won.reward).toEqual({ granted: true, points: 150, coins: 50 });
    b.clock.advance(2 * 24 * 3600 * 1000);
    const later = b.visit();
    expect((await later.playCanon('survived', 420)).reward).toEqual({
      granted: false,
      reason: 'duplicate',
    });
    expect(await later.repo.progress.balances()).toMatchObject({ points: 150, coins: 50 });
    const ids = (await later.repo.progress.ledger()).map((e) => e.id);
    expect(ids).toHaveLength(1);
    expect(ids[0]).toMatch(/^world_reward:minigame:canon@/);
  });

  it('una partida perdida no toca el libro', async () => {
    const b = browser();
    const v = b.visit();
    const lost = await v.play(faro, () => ({}));
    expect(lost.ending.outcome).toBe('lost');
    const flooded = await v.playCanon('flooded', 95);
    expect(flooded.reward).toEqual({ granted: false, reason: 'not_won' });
    expect(await v.repo.progress.ledger()).toHaveLength(0);
  });
});

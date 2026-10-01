import {
  type BaseConfig,
  CANON_DEFAULTS,
  FARO_DEFAULTS,
  LocalSessionAuthority,
  MinigameController,
  type MinigameDefinition,
  canon,
  faro,
} from '@boia/engine/minigames';
import { type Bot, canonExpert, faroExpert, playHeadless } from '@boia/engine/minigames/testing';
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
  const clock = { now: () => t, advance: (ms: number) => (t += ms) };
  const visit = () => {
    const repo = createLocalRepository({ storage, now: () => new Date(t), watch: false });
    const authority = new LocalSessionAuthority(clock.now);
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

  it('«por temporada»: una por mundo activo, también tras recargar', async () => {
    expect(CANON_DEFAULTS.reward.policy).toBe('season');
    const b = browser();
    expect((await b.visit().play(canon, canonExpert)).reward.granted).toBe(true);
    b.clock.advance(2 * 24 * 3600 * 1000);
    expect((await b.visit().play(canon, canonExpert)).reward).toEqual({
      granted: false,
      reason: 'duplicate',
    });
  });

  it('una partida perdida no toca el libro', async () => {
    const b = browser();
    const v = b.visit();
    const lost = await v.play(canon, () => ({}));
    expect(lost.ending.outcome).toBe('lost');
    expect(await v.repo.progress.ledger()).toHaveLength(0);
  });
});

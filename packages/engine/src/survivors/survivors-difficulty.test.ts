import { describe, expect, it } from 'vitest';
import { configHash } from '../minigames/rng';
import { canonConfigFor } from '../minigames/world-canon';
import {
  DEFAULT_DIFFICULTY,
  DIFFICULTY_IDS,
  SURVIVORS_CONFIG,
  SURVIVORS_STEP_S,
  type DifficultyId,
  type SurvivorsConfig,
  asDifficulty,
} from './config';
import { createSurvivors, type SurvivorsEvent } from './sim';
import type { SurvivorsWorld } from './world';

const world: SurvivorsWorld = {
  bounds: { left: -3000, right: 3000, top: -3000, bottom: 3000 },
  obstacles: [],
  start: { x: 0, y: 0, heading: 0 },
};

/** Enemigos quietos: sólo cuenta lo que el guion echa. */
function still(): SurvivorsConfig {
  const c = structuredClone(SURVIVORS_CONFIG);
  c.salvavidas.offerChance = 0;
  for (const e of Object.values(c.enemies)) {
    e!.speed = 0;
    e!.acceleration = 0;
  }
  return c;
}

function steps(game: ReturnType<typeof createSurvivors>, seconds: number): SurvivorsEvent[] {
  const events: SurvivorsEvent[] = [];
  for (let i = 0; i < Math.ceil(seconds / SURVIVORS_STEP_S) && !game.ended; i++) {
    events.push(...game.step());
  }
  return events;
}

describe('T131: difficulties', () => {
  it('defines the three as data, Normal being neutral and the default', () => {
    expect([...DIFFICULTY_IDS].sort()).toEqual(Object.keys(SURVIVORS_CONFIG.difficulties).sort());
    expect(DEFAULT_DIFFICULTY).toBe('normal');
    const d = SURVIVORS_CONFIG.difficulties;
    expect([d.normal.enemyDamage, d.normal.enemyHp, d.normal.enemyCount]).toEqual([1, 1, 1]);
    expect(d.tranquila.enemyDamage).toBeLessThan(1);
    expect(d.tranquila.enemyHp).toBeLessThan(1);
    expect(d.tranquila.enemyCount).toBeLessThan(1);
    expect(d.tormenta.enemyDamage).toBeGreaterThan(1);
    expect(d.tormenta.enemyHp).toBeGreaterThan(1);
    expect(d.tormenta.enemyCount).toBeGreaterThan(1);
    expect(asDifficulty('tormenta')).toBe('tormenta');
    expect(asDifficulty('imposible')).toBeNull();
    expect(createSurvivors(SURVIVORS_CONFIG, 1, world).snapshot().difficulty).toBe('normal');
  });

  it.each(DIFFICULTY_IDS)(
    '%s scales the water a hit adds and the hp of a new enemy',
    (id: DifficultyId) => {
      const cfg = still();
      const m = cfg.difficulties[id];
      const game = createSurvivors(cfg, 5, world, { difficulty: id });
      const p = game.snapshot().player;
      const e = game.spawnEnemy('piranha', p.x, p.y)!;
      const def = cfg.enemies.piranha!;
      expect(e.hp).toBeCloseTo(def.hp * m.enemyHp, 9);
      const hit = steps(game, 0.2).find((ev) => ev.type === 'hit');
      expect(hit).toBeDefined();
      expect((hit as { water: number }).water).toBeCloseTo(def.contactWater * m.enemyDamage, 9);
    },
  );

  it('echoes more enemies the harder it is, for the same seed', () => {
    const count = (id: DifficultyId): number => {
      const cfg = still();
      cfg.caps.alta.enemies = 100000;
      const game = createSurvivors(cfg, 11, world, { difficulty: id });
      steps(game, 60);
      return game.snapshot().enemies.length;
    };
    const t = count('tranquila');
    const n = count('normal');
    const s = count('tormenta');
    expect(t).toBeLessThan(n);
    expect(n).toBeLessThan(s);
  });

  it('is deterministic per seed and difficulty, and differs between difficulties', () => {
    const run = (id: DifficultyId) => {
      const game = createSurvivors(SURVIVORS_CONFIG, 77, world, { difficulty: id });
      steps(game, 40);
      const s = game.snapshot();
      return JSON.stringify({
        w: s.water.level,
        d: s.defeated,
        e: s.enemies.map((e) => [e.id, e.type, Math.round(e.x * 100), Math.round(e.y * 100), e.hp]),
      });
    };
    expect(run('tormenta')).toBe(run('tormenta'));
    expect(run('tranquila')).toBe(run('tranquila'));
    expect(run('tormenta')).not.toBe(run('tranquila'));
  });

  it('is part of the session config hash and leaves reward and goal alone', () => {
    const base = canonConfigFor(SURVIVORS_CONFIG);
    const storm = canonConfigFor(SURVIVORS_CONFIG, 'tormenta');
    expect(configHash(storm)).not.toBe(configHash(base));
    expect(canonConfigFor(SURVIVORS_CONFIG, 'normal')).toEqual(base);
    expect(storm.reward).toEqual(base.reward);
    expect(storm.goal).toBe(base.goal);
  });
});

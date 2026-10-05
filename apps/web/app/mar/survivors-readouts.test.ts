import { DEFAULT_SHIP_CONFIG } from '@boia/engine/headless';
import { SURVIVORS_CONFIG, type SurvivorsConfig } from '@boia/engine/survivors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SurvivorsRun } from './survivors';
import { SurvivorsView } from './engine/survivors-view';

const prefs = vi.hoisted(() => ({ health: false, damage: true }));
vi.mock('./canon-readout-preferences', () => ({
  readoutPreferences: () => ({ get: () => prefs }),
}));

const config = (): SurvivorsConfig => ({
  ...SURVIVORS_CONFIG,
  acts: [{ act: 1, durationS: SURVIVORS_CONFIG.durationS, tracks: [], events: [] }],
});
const run = () =>
  new SurvivorsRun(
    {
      bounds: { left: -2000, right: 2000, top: -2000, bottom: 2000 },
      obstacles: [],
      start: { x: 0, y: 0, heading: 0 },
    },
    { config: config(), seed: 7, quality: 'baja', ship: DEFAULT_SHIP_CONFIG },
  );
const idle = { dirX: 0, dirY: 0, throttle: 0, drift: false };

describe('render readouts from fixed-step hits', () => {
  beforeEach(() => {
    prefs.health = false;
    prefs.damage = true;
  });

  it('captures a lethal cannon hit even though the enemy leaves the snapshot', () => {
    const r = run();
    const enemy = r.game.spawnEnemy('piranha', 100, 0)!;
    let damaged = false;
    for (let i = 0; i < 120 && !damaged; i++) {
      const events = r.step(idle);
      if (!events.some((e) => e.type === 'defeated' && e.id === enemy.id)) continue;
      expect(r.game.snapshot().enemyHits.find((h) => h.id === enemy.id)?.damage).toBeGreaterThan(0);
      expect(r.game.snapshot().enemies.find((e) => e.id === enemy.id)).toBeUndefined();
      damaged = true;
    }
    expect(damaged).toBe(true);
    for (let i = 0; i < 12; i++) r.step(idle);
    expect(r.snapshot().damageNumbers.find((d) => d.id === enemy.id)?.damage).toBeGreaterThan(0);
    expect('damageNumbers' in r.game.snapshot()).toBe(false);
    r.setPaused(true);
    r.step(idle);
    expect(r.game.snapshot().enemyHits).toHaveLength(0);
  });

  it('aggregates flame hits across several steps before a render and clears when disabled', () => {
    const r = run();
    r.game.spawnPickup('llama', 0, 0);
    r.step(idle);
    const enemy = r.game.spawnEnemy('crab', 65, 0)!;
    let total = 0;
    for (let i = 0; i < 11; i++) {
      r.step(idle);
      if (i < 10)
        total += r.game
          .snapshot()
          .enemyHits.filter((h) => h.id === enemy.id)
          .reduce((n, h) => n + h.damage, 0);
    }
    expect(total).toBeGreaterThan(0);
    const shown = r.snapshot().damageNumbers.filter((d) => d.id === enemy.id);
    expect(shown).toHaveLength(1);
    // The first ten steps belong to the fixed aggregation window.
    expect(shown[0]!.damage).toBeCloseTo(total, 5);
    prefs.damage = false;
    expect(r.snapshot().damageNumbers).toHaveLength(0);
    prefs.damage = true;
    expect(r.snapshot().damageNumbers).toHaveLength(0);
  });

  it('creates no overlay mesh with defaults, then creates/disposes its one render callback', () => {
    prefs.damage = false;
    const r = run();
    const view = new SurvivorsView(r.config, r.game.caps, { quality: 'baja', reduced: true });
    view.update(r.snapshot(), 0);
    expect(view.readouts.group.children).toHaveLength(0);
    prefs.health = true;
    view.update(r.snapshot(), 0.1);
    expect(view.readouts.group.children).toHaveLength(1);
    expect(view.readouts.group.children[0]!.visible).toBe(true);
    prefs.health = false;
    view.update(r.snapshot(), 0.2);
    expect(view.readouts.group.children[0]!.visible).toBe(false);
    view.dispose();
    expect(view.readouts.group.children).toHaveLength(0);
  });
});

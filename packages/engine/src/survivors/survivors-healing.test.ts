import { describe, expect, it } from 'vitest';
import { dodgeShip } from './bots';
import {
  SURVIVORS_CONFIG,
  SURVIVORS_CONFIG_VERSION,
  SURVIVORS_STEP_S,
  type SurvivorsConfig,
} from './config';
import { createSurvivors, type SurvivorsGame } from './sim';
import { inRingGap } from './bosses';
import { vecinoGapRad, vecinoRingArcs } from './vecino';

const sea = {
  bounds: { left: -2000, right: 2000, top: -2000, bottom: 2000 },
  start: { x: 0, y: 0 },
  obstacles: [],
};

function ringRuns(config: SurvivorsConfig, capacity = 20) {
  let survived = 0;
  let hits = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const c = structuredClone(config);
    c.acts = c.acts.map((a) => ({ ...a, tracks: [], events: [] }));
    c.weapons.canon!.base.damage = 0;
    // One-bronca capacity stress test isolates survival through the gaps.
    c.player.waterCapacity = capacity;
    const g = createSurvivors(c, seed, sea);
    const boss = g.spawnBoss('vecino', 300, 0)!;
    // Half HP exercises alternating bronca/onda; no weapons, healing or commons.
    g.flameBosses(boss.x, boss.y, 1, (boss.maxHp * 0.51) / c.bossFight.flameDps);
    for (let step = 0; step < 120 / SURVIVORS_STEP_S && !g.ended; step++) {
      hits += g.step({ ship: dodgeShip(g) }).filter((e) => e.type === 'bossHit').length;
    }
    if (!g.ended) survived++;
  }
  return { survived, hits };
}

function quiet() {
  const c = structuredClone(SURVIVORS_CONFIG);
  c.acts = c.acts.map((a) => ({ ...a, tracks: [], events: [] }));
  c.weapons.canon!.base.damage = 0;
  c.enemies.crab!.speed = 0;
  c.enemies.crab!.acceleration = 0;
  c.enemies.crab!.contactWater = 10;
  return c;
}
function steps(g: SurvivorsGame, count: number) {
  for (let i = 0; i < count; i++) g.step();
}

describe('T149 healing and Vecino', () => {
  it('keeps the greedy pilot aligned with the dodge pilot until a threatening ring passes', () => {
    const c = quiet();
    c.bosses.vecino!.phases = c.bosses.vecino!.phases.map((p) => ({ ...p, movement: 'still', firstAttackS: 0 }));
    const g = createSurvivors(c, 1, sea);
    g.spawnBoss('vecino', 300, 0);
    g.step();
    g.spawnNote(100, 0, 1);
    expect(g.snapshot().bossWarnings).toHaveLength(1);
    expect(dodgeShip(g, true)).toEqual(dodgeShip(g));
  });

  // Recorded on 2026-10-05 (40 seeds, 120 s, capacity 20 / 100): v14 rings with
  // the v14 pilot 30/40, 10 hits / 40/40, 12 hits; v15 rings with this pilot
  // 40/40, 0 hits / 40/40, 0 hits. The v14 pilot on v15 rings: 0/40.
  it('survives rings more often than v14 with the same dodge pilot, seeds and encounter', () => {
    const legacy = structuredClone(SURVIVORS_CONFIG);
    legacy.bosses.vecino!.attacks.onda!.gaps = 3;
    legacy.bosses.vecino!.attacks.onda!.gapRad = 0.65;
    delete legacy.bosses.vecino!.attacks.onda!.gapBoatWidths;
    legacy.bosses.vecino!.attacks.bronca!.gaps = 3;
    legacy.bosses.vecino!.attacks.bronca!.gapRad = 0.55;
    delete legacy.bosses.vecino!.attacks.bronca!.gapBoatWidths;
    const before = ringRuns(legacy);
    const after = ringRuns(SURVIVORS_CONFIG);
    const normalBefore = ringRuns(legacy, 100);
    const normalAfter = ringRuns(SURVIVORS_CONFIG, 100);
    console.info('T149 rings, 40 seeds / 120 s:', { before, after, normalBefore, normalAfter });
    expect(after.survived).toBeGreaterThanOrEqual(before.survived + 8);
    expect(after.hits).toBeLessThan(before.hits / 2);
    expect(normalAfter.survived).toBeGreaterThanOrEqual(normalBefore.survived);
    expect(normalAfter.hits).toBeLessThan(normalBefore.hits / 2);
  });

  it('applies each capacity/bailing level, including direct acquisition, without draining existing water', () => {
    expect(SURVIVORS_CONFIG_VERSION).toBeGreaterThanOrEqual(15);
    const c = quiet();
    const g = createSurvivors(c, 1, sea);
    g.spawnEnemy('crab', 0, 0);
    g.step();
    const water = g.snapshot().water.level;
    g.addVinyl('chill');
    for (let level = 1; level <= 5; level++) {
      const expected = {
        capacity: [100, 115, 130, 130, 130][level - 1],
        bail: level < 4 ? 0.4 : 0.8,
      };
      expect(g.snapshot().water).toEqual({ level: water, capacity: expected.capacity });
      expect(g.snapshot().stats.bailPerS).toBeCloseTo(expected.bail);
      expect(g.snapshot().shield.ready).toBe(level === 5);
      const direct = createSurvivors(c, 1, sea);
      direct.addVinyl('chill', level);
      expect(direct.snapshot().water.capacity).toBe(expected.capacity);
      expect(direct.snapshot().stats).toEqual(g.snapshot().stats);
      if (level < 5) expect(g.levelUpVinyl('chill')).toBe(true);
    }
  });

  it('floods at the increased maximum and uses it for Segunda vida and the Salvavidas drop', () => {
    const c = quiet();
    c.enemies.crab!.contactWater = 110;
    const g = createSurvivors(c, 1, sea);
    g.addVinyl('chill', 3);
    g.spawnEnemy('crab', 0, 0);
    g.step();
    expect(g.snapshot().water.level).toBe(110);
    expect(g.ended).toBe(false);
    g.spawnPickup('salvavidas', 0, 0);
    g.step();
    expect(g.snapshot().water.level).toBeCloseTo(
      110 - 0.4 * SURVIVORS_STEP_S - 130 * c.drops.salvavidas.waterFraction,
    );
    steps(g, 40);
    expect(g.snapshot().end).toBe('flooded');

    const saved = createSurvivors(c, 1, sea);
    saved.addVinyl('chill', 3);
    saved.addSalvavidas();
    saved.spawnEnemy('crab', 0, 0);
    saved.step();
    steps(saved, 40);
    expect(saved.snapshot().salvavidas).toBe('consumed');
    expect(saved.ended).toBe(false);
    expect(saved.snapshot().water.level).toBeLessThanOrEqual(
      130 * c.salvavidas.waterFractionAfterSave,
    );
  });

  it('absorbs a contact hit, blocks bosses for all 6 seconds, and recharges at 20 active seconds', () => {
    const c = quiet();
    const boss = c.bosses.prueba!;
    boss.phases = [
      {
        ...boss.phases[0]!,
        movement: 'still',
        attacks: ['onda'],
        firstAttackS: 0,
        attackEveryS: 100,
      },
    ];
    Object.assign(boss.attacks.onda!, {
      kind: 'circles',
      telegraphS: 0,
      activeS: 30,
      radius: 100,
      count: 1,
      water: 10,
    });
    const g = createSurvivors(c, 2, sea);
    g.addVinyl('chill', 5);
    g.spawnEnemy('crab', 0, 0);
    expect(g.step().some((e) => e.type === 'hit')).toBe(false);
    expect(g.snapshot().water.level).toBe(0);
    expect(g.snapshot().shield).toEqual({
      enabled: true,
      ready: false,
      rechargeS: 20,
      invulnerableS: 6,
    });
    g.spawnBoss('prueba', 300, 0);
    g.setPaused(true);
    steps(g, 60);
    expect(g.snapshot().shield.rechargeS).toBe(20);
    g.setPaused(false);
    steps(g, 359);
    expect(g.snapshot().water.level).toBe(0);
    expect(g.snapshot().shield.invulnerableS).toBeCloseTo(SURVIVORS_STEP_S);
    expect(g.step()).toContainEqual(expect.objectContaining({ type: 'bossHit' }));
    expect(g.snapshot().shield.invulnerableS).toBe(0);
    expect(g.snapshot().water.level).toBeGreaterThan(0);
    // Sail away from contact; the spent circle has already landed.
    for (let i = 0; i < 839; i++) g.step({ ship: { dirX: 1, dirY: 0, throttle: 1, drift: false } });
    expect(g.snapshot().shield.ready).toBe(false);
    expect(g.snapshot().shield.rechargeS).toBeCloseTo(SURVIVORS_STEP_S);
    g.step();
    expect(g.snapshot().shield.ready).toBe(true);
    g.spawnEnemy('crab', g.snapshot().player.x, g.snapshot().player.y);
    const before = g.snapshot().water.level;
    g.step();
    expect(g.snapshot().water.level).toBeCloseTo(Math.max(0, before - 0.8 * SURVIVORS_STEP_S));
    expect(g.snapshot().shield.rechargeS).toBe(20);
  });

  it('also absorbs the first boss attack and keeps eight physical gaps consistent with visible arcs', () => {
    const c = quiet();
    const g = createSurvivors(c, 1, sea);
    g.addVinyl('chill', 5);
    const boss = c.bosses.prueba!;
    boss.phases = [
      {
        ...boss.phases[0]!,
        movement: 'still',
        attacks: ['onda'],
        firstAttackS: 0,
        attackEveryS: 100,
      },
    ];
    Object.assign(boss.attacks.onda!, {
      kind: 'circles',
      telegraphS: 0,
      activeS: 30,
      radius: 100,
      count: 1,
      water: 10,
    });
    g.spawnBoss('prueba', 300, 0);
    expect(g.step().some((e) => e.type === 'bossHit')).toBe(false);
    expect(g.step().some((e) => e.type === 'bossHit')).toBe(false);
    expect(g.snapshot().shield.invulnerableS).toBe(6);
    for (const radius of [100, 300, 440, 480]) {
      const width = vecinoGapRad(radius, g.snapshot().player.radius, 8, 2.5);
      expect(width * radius).toBeCloseTo(2.5 * g.snapshot().player.radius * 2);
      const arcs = vecinoRingArcs(radius, 8, width, Math.PI / 8);
      for (let k = 0; k < 360; k++) {
        const angle = (k * Math.PI) / 180;
        const visible = arcs.some((a) => angle >= a.from && angle < a.to);
        expect(visible).toBe(!inRingGap(angle, 8, width, Math.PI / 8));
      }
    }
    expect(vecinoGapRad(0, 18, 8, 2.5)).toBe(Math.PI / 4);
  });

  it('rotates consecutive waves by half a gap step, including across the phase change', () => {
    const c = quiet();
    const g = createSurvivors(c, 9, sea);
    const b = g.spawnBoss('vecino', 300, 0)!;
    const phases: number[] = [];
    let lastAttack = '';
    for (let i = 0; i < 25 / SURVIVORS_STEP_S; i++) {
      for (const e of g.step())
        if (e.type === 'bossTelegraph') {
          phases.push(g.snapshot().bossWarnings[0]!.gapPhase);
          lastAttack = e.attack;
        }
      if (phases.length === 1 && lastAttack === 'onda') {
        g.flameBosses(b.x, b.y, 1, (b.maxHp * 0.51) / c.bossFight.flameDps);
        lastAttack = '';
      }
    }
    expect(phases.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < phases.length; i++)
      expect(Math.abs(phases[i]! - phases[i - 1]!)).toBeCloseTo(Math.PI / 8);
  });
});

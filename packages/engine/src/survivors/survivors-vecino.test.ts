import { describe, expect, it } from 'vitest';
import { inRingGap, validateBoss } from './bosses';
import { SURVIVORS_CONFIG, SURVIVORS_STEP_S, type SurvivorsConfig } from './config';
import { createSurvivors, type SurvivorsEvent, type SurvivorsGame } from './sim';
import { VECINO, vecinoRingArcs } from './vecino';
import type { SurvivorsWorld } from './world';

const sea = (obstacles: SurvivorsWorld['obstacles'] = []): SurvivorsWorld => ({
  bounds: { left: -2000, right: 2000, top: -2000, bottom: 2000 },
  start: { x: 0, y: 0 },
  obstacles,
});
function quiet(): SurvivorsConfig {
  const c = structuredClone(SURVIVORS_CONFIG);
  c.acts = c.acts.map((a) => ({ ...a, tracks: [], events: [] }));
  c.weapons.canon!.base.damage = 0;
  c.player.waterCapacity = 1e12;
  c.bosses.vecino!.phases = c.bosses.vecino!.phases.map((p) => ({
    ...p,
    movement: 'still',
    firstAttackS: 0.1,
    attackEveryS: 20,
  }));
  return c;
}
function run(g: SurvivorsGame, seconds: number): SurvivorsEvent[] {
  const events: SurvivorsEvent[] = [];
  for (let k = 0; k < Math.round(seconds / SURVIVORS_STEP_S); k++)
    events.push(...g.step({ choose: 0 }).map((e) => ({ ...e })));
  return events;
}

describe('El Vecino Quejica (T138)', () => {
  it('uses valid ring attacks, two phases and the real 2:30 slot in both acts', () => {
    expect(validateBoss(VECINO)).toEqual([]);
    expect(VECINO.phases).toHaveLength(2);
    for (const attack of Object.values(VECINO.attacks)) {
      expect(attack).toMatchObject({
        kind: 'ring',
        gaps: 8,
        gapBoatWidths: 2.5,
        blockedByIslands: true,
      });
      expect(attack.telegraphS).toBeGreaterThanOrEqual(1.2);
    }
    for (const act of [1, 2]) {
      const g = createSurvivors(SURVIVORS_CONFIG, 7, sea(), { act, startAtS: 149 });
      expect(g.snapshot().bosses).toEqual([]);
      const events = run(g, 1.1);
      expect(events).toContainEqual(expect.objectContaining({ type: 'bossSpawn', boss: 'vecino' }));
      expect(g.snapshot().bosses[0]!.boss).toBe('vecino');
    }
  });

  it('telegraphs every wave; an actual gap protects the boat while a solid segment hits', () => {
    let gapCases = 0,
      hits = 0;
    for (let seed = 1; seed <= 16; seed++) {
      const g = createSurvivors(quiet(), seed, sea());
      g.spawnBoss('vecino', 300, 0);
      const before = run(g, 0.2);
      const w = g.snapshot().bossWarnings[0]!;
      expect(w).toMatchObject({ kind: 'ring', hit: false, gaps: 8, ringRadius: 0 });
      expect(before.some((e) => e.type === 'bossAttack')).toBe(false);
      expect(before.some((e) => e.type === 'bossTelegraph')).toBe(true);
      // The physical gap has constant width; its angle widens at the nearer front.
      const gap = inRingGap(
        Math.PI,
        w.gaps,
        (2.5 * g.snapshot().player.radius * 2) / 300,
        w.gapPhase,
      );
      const events = run(g, 3.4);
      const hit = events.filter((e) => e.type === 'bossHit');
      expect(hit).toHaveLength(gap ? 0 : 1);
      expect(events).toContainEqual(
        expect.objectContaining({ type: 'bossAttack', attack: 'onda' }),
      );
      if (gap) gapCases++;
      else hits++;
    }
    expect(gapCases).toBeGreaterThan(0);
    expect(hits).toBeGreaterThan(0);
  });

  it('an island blocks only its ring segment, including across the map seam', () => {
    // Select a seed with the boat outside the actual gaps at contact radius.
    let seed = 1;
    for (; seed <= 16; seed++) {
      const g = createSurvivors(quiet(), seed, sea());
      g.spawnBoss('vecino', 300, 0);
      run(g, 0.2);
      const w = g.snapshot().bossWarnings[0]!;
      if (
        !inRingGap(Math.PI, w.gaps, (2.5 * g.snapshot().player.radius * 2) / 270, w.gapPhase) &&
        !inRingGap(0, w.gaps, (2.5 * g.snapshot().player.radius * 2) / 270, w.gapPhase)
      )
        break;
    }
    const hits = (obstacles: SurvivorsWorld['obstacles'], seam = false) => {
      const world = sea(obstacles);
      if (seam) world.start = { x: -1900, y: 0 };
      const g = createSurvivors(quiet(), seed, world);
      g.spawnBoss('vecino', seam ? 1800 : 300, 0);
      run(g, 0.2);
      if (obstacles.length)
        expect(g.snapshot().bossWarnings[0]!.ringObstacles).toContainEqual({
          x: -150,
          y: seam ? 0 : obstacles[0]!.y,
          radius: 50,
        });
      return run(g, 3.4).filter((e) => e.type === 'bossHit').length;
    };
    expect(hits([])).toBe(1);
    expect(hits([{ x: 150, y: 0, radius: 50 }])).toBe(0);
    expect(hits([{ x: 150, y: 180, radius: 50 }])).toBe(1);
    expect(hits([], true)).toBe(1);
    // Shortest path: 1800 → 2100 (= -1900), island at 1950.
    const g = createSurvivors(quiet(), seed, {
      ...sea([{ x: 1950, y: 0, radius: 50 }]),
      start: { x: -1900, y: 0 },
    });
    g.spawnBoss('vecino', 1800, 0);
    expect(run(g, 3.6).filter((e) => e.type === 'bossHit')).toHaveLength(0);
  });

  it('changes phase at half HP; act 2 has 50% more HP and difficulty still scales it', () => {
    const c = quiet();
    const one = createSurvivors(c, 1, sea(), { act: 1 });
    const two = createSurvivors(c, 1, sea(), { act: 2 });
    const storm = createSurvivors(c, 1, sea(), { act: 2, difficulty: 'tormenta' });
    const b = one.spawnBoss('vecino', 300, 0)!;
    expect(two.spawnBoss('vecino', 300, 0)!.maxHp).toBe(b.maxHp * 1.5);
    expect(storm.spawnBoss('vecino', 300, 0)!.maxHp).toBeCloseTo(
      b.maxHp * 1.5 * c.difficulties.tormenta.enemyHp,
    );
    one.flameBosses(b.x, b.y, 1, (b.maxHp * 0.51) / c.bossFight.flameDps);
    expect(one.step()).toContainEqual({ type: 'bossPhase', boss: 'vecino', id: b.id, phase: 1 });
    expect(one.snapshot().bosses[0]!.phase).toBe(1);
    expect(run(one, 0.2)).toContainEqual(
      expect.objectContaining({ type: 'bossTelegraph', attack: 'bronca' }),
    );
  });

  it('weapons hit the Vecino through boss targets; defeat drops the chest and big note and keeps playing', () => {
    const c = quiet();
    c.weapons.canon!.base.damage = 16;
    const g = createSurvivors(c, 1, sea());
    const b = g.spawnBoss('vecino', 200, 0)!;
    g.flameBosses(b.x, b.y, 1, (b.maxHp - 1) / c.bossFight.flameDps);
    const events = run(g, 1);
    expect(events).toContainEqual(expect.objectContaining({ type: 'bossDamaged', boss: 'vecino' }));
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'bossDefeated', boss: 'vecino' }),
    );
    expect(events).toContainEqual(expect.objectContaining({ type: 'chest', boss: 'vecino' }));
    expect(g.snapshot().notes).toContainEqual(
      expect.objectContaining({ value: VECINO.noteValue, figure: 'redonda' }),
    );
    expect(g.snapshot().chests).toHaveLength(1);
    expect(g.ended).toBe(false);
  });

  it('same seed and input reproduce waves and their gaps', () => {
    const a = createSurvivors(quiet(), 9, sea());
    const b = createSurvivors(quiet(), 9, sea());
    a.spawnBoss('vecino', 300, 0);
    b.spawnBoss('vecino', 300, 0);
    expect(run(a, 25)).toEqual(run(b, 25));
    expect(a.stateHash()).toBe(b.stateHash());
  });
});

describe('ring geometry for the view', () => {
  const visible = (angle: number, radius: number) =>
    vecinoRingArcs(radius, 0, 0, 0, [{ x: 150, y: 0, radius: 50 }]).some(
      (a) => angle > a.from && angle < a.to,
    );
  it('preserves exact gaps at the 0/2π seam', () => {
    const arcs = vecinoRingArcs(440, 3, 0.65, 0);
    expect(arcs).toHaveLength(3);
    expect(arcs[0]!.from).toBeCloseTo(0.325);
    expect(arcs.at(-1)!.to).toBeCloseTo(Math.PI * 2 - 0.325);
  });
  it('the island shadow begins at the island, persists beyond it, and leaves other directions visible', () => {
    expect(visible(0.05, 90)).toBe(true);
    expect(visible(0.05, 140)).toBe(false);
    expect(visible(0.05, 440)).toBe(false);
    expect(visible(Math.PI / 2, 440)).toBe(true);
  });
});

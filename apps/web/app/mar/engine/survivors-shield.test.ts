import { createSurvivors, SURVIVORS_CONFIG } from '@boia/engine/survivors';
import { describe, expect, it } from 'vitest';
import { toScene } from './compress';
import { SurvivorsView } from './survivors-view';

describe('T149 ready shield ring', () => {
  it('follows the boat, hides when spent and comes back after 20 active seconds in baja', () => {
    const config = structuredClone(SURVIVORS_CONFIG);
    config.acts = config.acts.map((a) => ({ ...a, tracks: [], events: [] }));
    config.bosses.vecino!.phases = config.bosses.vecino!.phases.map((p) => ({ ...p, movement: 'still', attacks: [] }));
    const g = createSurvivors(config, 1, {
      bounds: { left: -2000, right: 2000, top: -2000, bottom: 2000 },
      start: { x: 100, y: 200 },
      obstacles: [],
    });
    const view = new SurvivorsView(config, config.caps.baja, { quality: 'baja', reduced: true });
    const ring = view.meshes()['survivors-shield-ready']!;
    view.update(g.snapshot(), 0);
    expect(ring.visible).toBe(false);
    g.addVinyl('chill', 5);
    view.update(g.snapshot(), 0);
    expect(ring.visible).toBe(true);
    expect(ring.count).toBe(1);
    const matrix = ring.instanceMatrix.array;
    expect(matrix[12]).toBeCloseTo(toScene(100));
    expect(matrix[14]).toBeCloseTo(toScene(200));
    g.spawnBoss('vecino', 100, 200);
    g.step();
    view.update(g.snapshot(), 1);
    expect(ring.visible).toBe(false);
    for (let i = 0; i < 1200; i++) g.step(i < 300 ? { ship: { dirX: 1, dirY: 0, throttle: 1, drift: false } } : {});
    view.update(g.snapshot(), 21);
    expect(ring.visible).toBe(true);
    expect(matrix[12]).toBeCloseTo(toScene(g.snapshot().player.x));
    view.dispose();
    expect(view.group.parent).toBeNull();
  });
});

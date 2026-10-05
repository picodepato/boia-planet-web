import { SURVIVORS_CONFIG, createSurvivors } from '@boia/engine/survivors';
import {
  Group,
  type Material,
  type Mesh,
  PerspectiveCamera,
  Scene,
  type WebGLRenderer,
} from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SurvivorsReadouts } from './survivors-readouts';
import { planetUniforms } from './planet';

const prefs = vi.hoisted(() => ({ health: true, damage: true }));
vi.mock('../canon-readout-preferences', () => ({
  readoutPreferences: () => ({ get: () => prefs }),
}));

describe('single canvas combat overlay', () => {
  beforeEach(() => {
    prefs.health = true;
    prefs.damage = true;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function setup() {
    const ctx = {
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeText: vi.fn(),
      fillText: vi.fn(),
    };
    const canvas = {
      dataset: {} as Record<string, string>,
      style: {},
      width: 0,
      height: 0,
      hidden: false,
      setAttribute: vi.fn(),
      getContext: () => ctx,
      remove: vi.fn(),
    };
    const parent = { append: vi.fn() };
    vi.stubGlobal('document', { createElement: vi.fn(() => canvas) });
    vi.stubGlobal('window', { devicePixelRatio: 3 });
    let nowMs = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => (nowMs += 40));
    const game = createSurvivors(SURVIVORS_CONFIG, 7, {
      bounds: { left: -2000, right: 2000, top: -2000, bottom: 2000 },
      obstacles: [],
      start: { x: 0, y: 0 },
    });
    const damaged = game.spawnEnemy('crab', 0, 0)!;
    const healthy = game.spawnEnemy('crab', 20, 0)!;
    const boss = game.spawnBoss('vecino', 0, 20)!;
    const snapshot = {
      ...game.snapshot(),
      activeS: 0.4,
      enemies: [{ ...damaged, hp: damaged.maxHp / 2 }, healthy],
      bosses: [{ ...boss, hp: boss.maxHp / 2 }],
      damageNumbers: [
        {
          id: damaged.id,
          kind: 'enemy' as const,
          enemy: 'crab' as const,
          damage: 12,
          x: 0,
          y: 0,
          serial: 1,
          bornS: 0,
        },
      ],
    };
    const camera = new PerspectiveCamera(40, 360 / 640, 0.1, 1000);
    camera.position.set(0, 20, 20);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const renderer = {
      domElement: {
        parentElement: parent,
        clientWidth: 360,
        clientHeight: 640,
        offsetLeft: 0,
        offsetTop: 0,
      },
    } as unknown as WebGLRenderer;
    const overlay = new SurvivorsReadouts('baja', () => 0);
    const render = (reduced: boolean) => {
      overlay.update(snapshot, reduced);
      const mesh = overlay.group.children[0] as Mesh;
      mesh.onBeforeRender(
        renderer,
        new Scene(),
        camera,
        mesh.geometry,
        mesh.material as Material,
        new Group(),
      );
    };
    return { ctx, canvas, parent, snapshot, overlay, render };
  }

  it('draws one damaged-enemy bar, no healthy/boss bars, bounded baja resolution and cleanup', () => {
    const t = setup();
    t.render(false);
    expect(t.parent.append).toHaveBeenCalledTimes(1);
    expect(t.canvas.width).toBe(360);
    expect(t.canvas.height).toBe(640);
    expect(t.ctx.fillRect).toHaveBeenCalledTimes(2);
    expect(t.canvas.dataset.healthCount).toBe('1');
    expect(t.canvas.dataset.damageCount).toBe('1');
    expect(t.ctx.fillText).toHaveBeenCalledWith('12', expect.any(Number), expect.any(Number));
    prefs.health = false;
    t.render(false);
    expect(t.canvas.dataset.healthCount).toBe('0');
    expect(t.parent.append).toHaveBeenCalledTimes(1);
    prefs.damage = false;
    t.overlay.update(t.snapshot, false);
    expect(t.canvas.hidden).toBe(true);
    t.overlay.dispose();
    expect(t.canvas.remove).toHaveBeenCalledTimes(1);
  });

  it('does not float numbers with reduced motion and projects wrapped enemies to their nearest copy', () => {
    const t = setup();
    t.render(true);
    const firstY = t.ctx.fillText.mock.calls[0]![2];
    t.snapshot.activeS = 0.7;
    t.render(true);
    expect(t.ctx.fillText.mock.calls[1]![2]).toBe(firstY);
    t.render(false);
    expect(t.ctx.fillText.mock.calls[2]![2]).toBeLessThan(firstY);
    const period = planetUniforms.uPlanetPeriod.value.clone();
    try {
      planetUniforms.uPlanetPeriod.value.set(100, 100);
      t.snapshot.enemies = t.snapshot.enemies.map((e) => ({ ...e, x: e.x + 1600 }));
      t.render(true);
      expect(t.canvas.dataset.healthCount).toBe('1');
    } finally {
      planetUniforms.uPlanetPeriod.value.copy(period);
    }
    t.overlay.dispose();
  });
});

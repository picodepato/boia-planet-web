import {
  createSurvivors,
  SURVIVORS_CONFIG,
  SURVIVORS_STEP_S,
  type SurvivorsConfig,
} from '@boia/engine/survivors';
import {
  Box3,
  BoxGeometry,
  Color,
  Group,
  type Material,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  Vector3,
} from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { t } from '../../../lib/i18n';
import { toScene } from './compress';
import { EnemyModel } from './enemy-models';
import { SurvivorsVecino, VECINO_COLORS, vecinoGeometry } from './survivors-vecino';
import { SurvivorsView } from './survivors-view';

/** Un «GLB» del Vecino ya cargado: una caja de otro tamaño, para distinguirla de la de a mano. */
function fakeVecinoScene(): Object3D {
  const root = new Group();
  root.add(new Mesh(new BoxGeometry(4, 1, 2), new MeshStandardMaterial({ color: '#123456' })));
  return root;
}
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

function setup(reduced = false, quality: 'alta' | 'baja' = 'alta') {
  const config: SurvivorsConfig = structuredClone(SURVIVORS_CONFIG);
  config.acts = [{ act: 1, durationS: 420, tracks: [], events: [] }];
  config.weapons.canon!.base.damage = 0;
  config.player.waterCapacity = 1e12;
  config.bosses.vecino!.phases = config.bosses.vecino!.phases.map((p) => ({
    ...p,
    movement: 'still',
  }));
  const game = createSurvivors(config, 7, {
    bounds: { left: -2000, right: 2000, top: -2000, bottom: 2000 },
    obstacles: [{ x: 150, y: 0, radius: 50 }],
    start: { x: 0, y: 0 },
  });
  const view = new SurvivorsView(config, game.caps, { reduced, quality });
  const step = (seconds: number) => {
    for (let k = 0; k < Math.round(seconds / SURVIVORS_STEP_S); k++) game.step();
  };
  return { game, view, step, vecino: view.vecino! };
}
afterEach(() => vi.unstubAllGlobals());

describe('Vecino low-poly model and view', () => {
  it('builds a barge with a large cream megaphone and a dark mouth in one geometry', () => {
    const g = vecinoGeometry();
    const size = new Box3()
      .setFromBufferAttribute(g.getAttribute('position') as never)
      .getSize(new Vector3());
    expect(size.x / size.z).toBeGreaterThan(1.8);
    expect(size.y).toBeGreaterThan(1.8);
    expect(g.getAttribute('position').count).toBeLessThan(3000);
    const attribute = g.getAttribute('color');
    for (const hex of [VECINO_COLORS.hull, VECINO_COLORS.horn, VECINO_COLORS.mouth]) {
      const expected = new Color(hex);
      let found = false;
      for (let k = 0; k < attribute.count; k++) {
        if (
          Math.abs(attribute.getX(k) - expected.r) +
            Math.abs(attribute.getY(k) - expected.g) +
            Math.abs(attribute.getZ(k) - expected.b) <
          1e-6
        )
          found = true;
      }
      expect(found).toBe(true);
    }
    expect(t('survivors.boss.vecino')).toBeTruthy();
    g.dispose();
  });

  it('places the real boss and reports only a visible model; clears it after defeat', () => {
    const { game, view, vecino } = setup();
    view.update(game.snapshot(), 0);
    expect(vecino.barge.visible).toBe(false);
    expect(vecino.rings.visible).toBe(false);
    expect(view.bossesWhere(() => true)).toEqual([]);
    const b = game.spawnBoss('vecino', 300, 0)!;
    view.update(game.snapshot(), 1);
    expect(vecino.barge.position.x).toBe(toScene(b.x));
    expect(vecino.barge.scale.x).toBe(toScene(b.radius));
    expect(view.bossesWhere(() => true)).toEqual(['vecino']);
    expect(view.bossesWhere(() => false)).toEqual([]);
    game.flameBosses(b.x, b.y, 1, b.hp / game.config.bossFight.flameDps);
    game.step();
    view.update(game.snapshot(), 2);
    expect(vecino.barge.visible).toBe(false);
    expect(vecino.rings.visible).toBe(false);
    view.dispose();
  });

  for (const reduced of [false, true]) {
    it(`draws the warning with gaps and island shadows, then expands the anchored wave (reduced=${reduced})`, () => {
      const { game, view, vecino, step } = setup(reduced, 'baja');
      game.spawnBoss('vecino', 300, 0);
      step(3.2);
      view.update(game.snapshot(), 3.2);
      expect(vecino.rings.visible).toBe(true);
      const warning = game.snapshot().bossWarnings[0]!;
      expect(warning.hit).toBe(false);
      const pos = vecino.rings.geometry.getAttribute('position');
      const count = vecino.rings.geometry.drawRange.count;
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(64 * 6);
      const maxRadius = () => {
        let max = 0;
        for (let k = 0; k < vecino.rings.geometry.drawRange.count; k++) {
          max = Math.max(
            max,
            Math.hypot(pos.getX(k) - toScene(warning.x), pos.getZ(k) - toScene(warning.y)),
          );
        }
        return max;
      };
      expect(maxRadius()).toBeCloseTo(
        toScene(warning.radius + (warning.thickness / 2) * (0.25 + 0.75 * warning.progress)),
        4,
      );
      // No strip covers the direction of the island (π); it stays hidden beyond land.
      for (let k = 0; k < count; k++) {
        const dx = pos.getX(k) - toScene(warning.x),
          dz = pos.getZ(k) - toScene(warning.y);
        expect(Math.abs(Math.atan2(dz, dx))).toBeLessThan(Math.PI - Math.asin(50 / 150) + 1e-5);
      }
      const array = pos.array;
      step(1.5);
      view.update(game.snapshot(), 4.7);
      expect(game.snapshot().bossWarnings[0]!.hit).toBe(true);
      const small = maxRadius();
      step(0.5);
      view.update(game.snapshot(), 5.2);
      expect(maxRadius()).toBeGreaterThan(small);
      expect(pos.array).toBe(array);
      expect(vecino.rings.material.transparent).toBe(false);
      if (reduced) {
        expect(vecino.barge.position.y).toBe(0);
        expect(vecino.barge.rotation.z).toBe(0);
      }
      step(2);
      view.update(game.snapshot(), 7.2);
      expect(vecino.rings.visible).toBe(false);
      view.dispose();
    });
  }

  it('uses the i18n shout on a static placard; disposes every geometry, material and texture once', () => {
    const fillText = vi.fn();
    vi.stubGlobal('document', {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({ fillRect: vi.fn(), fillText }),
      }),
    });
    const { game, view, vecino, step } = setup(true);
    expect(fillText).toHaveBeenCalledWith(t('survivors.boss.vecino.grito'), 256, 48, 490);
    game.spawnBoss('vecino', 300, 0);
    step(3.2);
    view.update(game.snapshot(), 3.2);
    expect(vecino.placard!.visible).toBe(true);
    const resources = [
      vecino.barge.geometry,
      vecino.barge.material as Material,
      vecino.rings.geometry,
      vecino.rings.material,
      vecino.placard!.geometry,
      vecino.placard!.material,
      vecino.placard!.material.map!,
    ];
    const disposals = resources.map((r) => {
      const dispose = vi.fn();
      r.addEventListener('dispose', dispose);
      return dispose;
    });
    view.dispose();
    expect(vecino.group.parent).toBeNull();
    for (const disposed of disposals) expect(disposed).toHaveBeenCalledTimes(1);
  });

  it('can build and dispose independently in low quality', () => {
    const model = new SurvivorsVecino('baja');
    const disposed = vi.fn();
    model.barge.geometry.addEventListener('dispose', disposed);
    model.dispose();
    expect(disposed).toHaveBeenCalledOnce();
  });
});

describe('the Vecino with its Blender model (T174)', () => {
  it('starts with the handmade barge and swaps to the GLB geometry when it loads; bob and heading keep working', async () => {
    const model = new EnemyModel({ file: 'vecino.glb', radius: 1 }, async () => fakeVecinoScene());
    const { game, view } = setup();
    // The view built here has no model: give one to a fresh Vecino in the same way the view does.
    view.dispose();
    const v = new SurvivorsVecino('alta', model);
    const handmade = v.barge.geometry;
    expect(v.modelState).toBe('cargando');
    expect(handmade.getAttribute('color')).toBeTruthy();
    const handmadeDisposed = vi.fn();
    handmade.addEventListener('dispose', handmadeDisposed);
    await tick();
    expect(v.modelState).toBe('glb');
    expect(v.barge.geometry).not.toBe(handmade);
    expect(v.barge.geometry).toBe(model.loaded);
    expect(handmadeDisposed).toHaveBeenCalledOnce();
    // Same material (vertex colours, flat shading) and the same attributes as the handmade piece.
    expect(v.barge.geometry.getAttribute('color')).toBeTruthy();
    expect(v.barge.geometry.index).toBeNull();
    const size = new Box3().setFromBufferAttribute(v.barge.geometry.getAttribute('position') as never).getSize(new Vector3());
    expect(size.x).toBeCloseTo(4, 5);
    // The animation is on the mesh, not the geometry: it keeps running after the swap.
    const b = game.spawnBoss('vecino', 300, 0)!;
    v.update(game.snapshot(), 1, false);
    expect(v.barge.visible).toBe(true);
    expect(v.barge.position.x).toBe(toScene(b.x));
    expect(v.barge.scale.x).toBe(toScene(b.radius));
    expect(v.barge.rotation.y).toBe(-b.heading);
    expect(v.barge.position.y).not.toBe(0);
    // Disposing the view releases the model but never destroys the shared geometry itself.
    const shared = model.loaded!;
    const sharedDisposed = vi.fn();
    shared.addEventListener('dispose', sharedDisposed);
    // A second user keeps it alive.
    await model.acquire();
    v.dispose();
    expect(sharedDisposed).not.toHaveBeenCalled();
    expect(model.loaded).toBe(shared);
    model.release();
    expect(sharedDisposed).toHaveBeenCalledOnce();
  });

  it('keeps the handmade barge when the GLB fails to load', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const model = new EnemyModel({ file: 'vecino.glb', radius: 1 }, async () => {
      throw new Error('no');
    });
    const v = new SurvivorsVecino('baja', model);
    const handmade = v.barge.geometry;
    await tick();
    expect(v.modelState).toBe('error');
    expect(v.barge.geometry).toBe(handmade);
    const disposed = vi.fn();
    handmade.addEventListener('dispose', disposed);
    v.dispose();
    expect(disposed).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('a view disposed before the GLB arrives ignores it', async () => {
    let resolve!: (o: Object3D) => void;
    const model = new EnemyModel(
      { file: 'vecino.glb', radius: 1 },
      () => new Promise<Object3D>((r) => (resolve = r)),
    );
    const v = new SurvivorsVecino('baja', model);
    v.dispose();
    resolve(fakeVecinoScene());
    await tick();
    expect(v.modelState).toBe('cargando');
    expect(model.loaded).toBeNull();
  });

  it('the SurvivorsView passes the model to its Vecino', async () => {
    const model = new EnemyModel({ file: 'vecino.glb', radius: 1 }, async () => fakeVecinoScene());
    const config: SurvivorsConfig = structuredClone(SURVIVORS_CONFIG);
    const game = createSurvivors(config, 7, {
      bounds: { left: -2000, right: 2000, top: -2000, bottom: 2000 },
      obstacles: [],
      start: { x: 0, y: 0 },
    });
    const view = new SurvivorsView(config, game.caps, { quality: 'baja', vecinoModel: model });
    await tick();
    expect(view.vecino!.modelState).toBe('glb');
    expect(view.vecino!.barge.geometry).toBe(model.loaded);
    view.dispose();
    expect(model.loaded).toBeNull();
  });
});

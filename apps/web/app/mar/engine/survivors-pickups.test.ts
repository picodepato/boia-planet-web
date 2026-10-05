import {
  DROP_IDS,
  SURVIVORS_CONFIG,
  type SurvivorsConfig,
  type SurvivorsWorld,
  createSurvivors,
} from '@boia/engine/survivors';
import { describe, expect, it } from 'vitest';
import {
  FLAME_OPACITY,
  SurvivorsPickups,
  flameGlowGeometry,
  flameTongueGeometry,
  flameTongues,
  pickupGeometry,
} from './survivors-pickups';
import { SurvivorsView } from './survivors-view';

/**
 * El botín de las élites en el 3D (plan 012 T135): los tres objetos hechos
 * en código, instanciados y del tope del botín; la llama delante del barco
 * sólo mientras dura, quieta con movimiento reducido y de opacidad fija.
 */

const world: SurvivorsWorld = {
  bounds: { left: -2000, right: 2000, top: -2000, bottom: 2000 },
  obstacles: [],
  start: { x: 0, y: 0, heading: 0 },
};

const quiet = (): SurvivorsConfig => {
  const c = structuredClone(SURVIVORS_CONFIG);
  c.acts = [];
  return c;
};

function matrices(m: { instanceMatrix: { array: ArrayLike<number> }; count: number }): number[] {
  return Array.from(m.instanceMatrix.array).slice(0, m.count * 16);
}

describe('T135: el botín en el mar 3D', () => {
  it('cada objeto es una pieza low-poly con color por vértice y su aro dorado', () => {
    for (const id of DROP_IDS) {
      const g = pickupGeometry(id);
      const n = g.getAttribute('position').count;
      expect(n, id).toBeGreaterThan(30);
      expect(n / 3, id).toBeLessThan(1200);
      expect(g.getAttribute('color')?.count, id).toBe(n);
      g.computeBoundingSphere();
      expect(g.boundingSphere!.radius, id).toBeGreaterThan(0.6);
      expect(g.boundingSphere!.radius, id).toBeLessThan(2);
      g.dispose();
    }
    const tongue = flameTongueGeometry();
    tongue.computeBoundingBox();
    expect(tongue.boundingBox!.min.x).toBeCloseTo(0, 5);
    expect(tongue.boundingBox!.max.x).toBeCloseTo(1, 5);
    tongue.dispose();
    expect(flameGlowGeometry(0.4).getAttribute('position').count).toBeGreaterThan(3);
  });

  it('una pieza por objeto del tamaño del tope; la llama, menos lenguas en baja', () => {
    for (const q of ['alta', 'baja'] as const) {
      const p = new SurvivorsPickups(SURVIVORS_CONFIG, q);
      const byName = Object.fromEntries(p.meshes.map((m) => [m.name, m]));
      for (const id of DROP_IDS) {
        expect(byName[`survivors-pickup-${id}`]!.instanceMatrix.count).toBe(SURVIVORS_CONFIG.drops.max);
      }
      expect(byName['survivors-flame']!.instanceMatrix.count).toBe(flameTongues(q));
      expect((byName['survivors-flame']!.material as { opacity: number }).opacity).toBe(
        FLAME_OPACITY.tongue,
      );
    }
    expect(flameTongues('baja')).toBeLessThan(flameTongues('alta'));
  });

  it('pinta lo que flota y, con la Llama, su abanico; al apagarse, nada', () => {
    const cfg = quiet();
    const game = createSurvivors(cfg, 1, world);
    const view = new SurvivorsView(cfg, cfg.caps.alta);
    const meshes = view.meshes();
    game.spawnPickup('iman', 300, 0);
    game.spawnPickup('salvavidas', 0, 300);
    game.spawnPickup('salvavidas', -300, 0);
    view.update(game.snapshot(), 0);
    expect(meshes['survivors-pickup-iman']!.count).toBe(1);
    expect(meshes['survivors-pickup-salvavidas']!.count).toBe(2);
    expect(meshes['survivors-pickup-llama']!.visible).toBe(false);
    expect(meshes['survivors-flame']!.visible).toBe(false);
    game.spawnPickup('llama', 0, 0);
    game.step();
    expect(game.snapshot().flame).not.toBeNull();
    view.update(game.snapshot(), 0.5);
    expect(meshes['survivors-flame']!.count).toBe(flameTongues('alta'));
    expect(meshes['survivors-flame-glow']!.count).toBe(1);
    for (let i = 0; i < Math.ceil(cfg.drops.llama.durationS * 60) + 2; i++) game.step();
    view.update(game.snapshot(), 12);
    expect(meshes['survivors-flame']!.visible).toBe(false);
    expect(meshes['survivors-flame-glow']!.visible).toBe(false);
    view.dispose();
  });

  it('con movimiento reducido no se mece ni chisporrotea: lo mismo en cualquier instante', () => {
    const cfg = quiet();
    const game = createSurvivors(cfg, 1, world);
    game.spawnPickup('iman', 300, 0);
    game.spawnPickup('llama', 0, 0);
    game.step();
    const s = game.snapshot();
    const p = new SurvivorsPickups(cfg, 'alta');
    const byName = Object.fromEntries(p.meshes.map((m) => [m.name, m]));
    p.update(s, 1, true);
    const a = [matrices(byName['survivors-pickup-iman']!), matrices(byName['survivors-flame']!)];
    p.update(s, 2.37, true);
    const b = [matrices(byName['survivors-pickup-iman']!), matrices(byName['survivors-flame']!)];
    expect(b).toEqual(a);
    p.update(s, 3.11, false);
    const c = [matrices(byName['survivors-pickup-iman']!), matrices(byName['survivors-flame']!)];
    expect(c).not.toEqual(a);
  });
});

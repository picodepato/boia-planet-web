import {
  SURVIVORS_CONFIG,
  SURVIVORS_STEP_S,
  type SurvivorsConfig,
  type SurvivorsWorld,
  createSurvivors,
} from '@boia/engine/survivors';
import { describe, expect, it } from 'vitest';
import {
  CHEST_CAP,
  SHARK_CAP,
  SurvivorsShark,
  chestGeometry,
  hammerheadGeometry,
  summonRingGeometry,
} from './survivors-shark';
import { SurvivorsView } from './survivors-view';

/**
 * El Tiburón Martillo y el cofre en el 3D (plan 012 T139): piezas low-poly
 * hechas en código, instanciadas con tope fijo; el tiburón y la línea de
 * aviso de su embestida mientras avisa, el círculo de la llamada, el cofre
 * flotando; quieto con movimiento reducido; se crea y se libera con la vista.
 */

const world: SurvivorsWorld = {
  bounds: { left: -2000, right: 2000, top: -2000, bottom: 2000 },
  obstacles: [],
  start: { x: 0, y: 0, heading: 0 },
};

const quiet = (): SurvivorsConfig => {
  const c = structuredClone(SURVIVORS_CONFIG);
  c.acts = [{ act: 1, durationS: c.durationS, tracks: [], events: [] }];
  c.player.waterCapacity = 1e12;
  return c;
};

const byName = (s: SurvivorsShark) => Object.fromEntries(s.meshes.map((m) => [m.name, m]));

function matrices(m: { instanceMatrix: { array: ArrayLike<number> }; count: number }): number[] {
  return Array.from(m.instanceMatrix.array).slice(0, m.count * 16);
}

describe('T139: el Tiburón Martillo y el cofre en el mar 3D', () => {
  it('el tiburón, el cofre y el aro son piezas low-poly con color por vértice', () => {
    for (const [name, g] of [
      ['martillo', hammerheadGeometry()],
      ['cofre', chestGeometry()],
    ] as const) {
      const n = g.getAttribute('position').count;
      expect(n, name).toBeGreaterThan(30);
      expect(n / 3, name).toBeLessThan(1500);
      expect(g.getAttribute('color')?.count, name).toBe(n);
      g.computeBoundingSphere();
      expect(g.boundingSphere!.radius, name).toBeGreaterThan(0.6);
      expect(g.boundingSphere!.radius, name).toBeLessThan(2.5);
      g.dispose();
    }
    // El martillo es más ancho que el cuerpo: la silueta se reconoce desde arriba.
    const h = hammerheadGeometry();
    h.computeBoundingBox();
    expect(h.boundingBox!.max.z - h.boundingBox!.min.z).toBeGreaterThan(1.7);
    h.dispose();
    expect(summonRingGeometry().getAttribute('position').count).toBeGreaterThan(20);
  });

  it('se crea con la vista con sus topes y se libera con ella', () => {
    const view = new SurvivorsView(SURVIVORS_CONFIG, SURVIVORS_CONFIG.caps.baja);
    const m = view.meshes();
    expect(m['survivors-boss-martillo']!.instanceMatrix.count).toBe(SHARK_CAP);
    expect(m['survivors-chest']!.instanceMatrix.count).toBe(CHEST_CAP);
    for (const mesh of view.shark.meshes) expect(view.group.getObjectById(mesh.id)).toBeDefined();
    let disposed = 0;
    for (const mesh of view.shark.meshes) mesh.geometry.addEventListener('dispose', () => disposed++);
    view.dispose();
    expect(disposed).toBe(view.shark.meshes.length);
  });

  it('pinta el tiburón, la línea de su embestida mientras avisa, la llamada y el cofre', () => {
    const cfg = quiet();
    const game = createSurvivors(cfg, 1, world);
    const view = new SurvivorsView(cfg, cfg.caps.alta);
    const m = view.meshes();
    view.update(game.snapshot(), 0);
    expect(m['survivors-boss-martillo']!.visible).toBe(false);
    game.spawnBoss('martillo', 450, 0);
    let sawLine = false;
    let sawRing = false;
    for (let i = 0; i < Math.round(25 / SURVIVORS_STEP_S); i++) {
      game.step({ choose: 0 });
      const s = game.snapshot();
      view.update(s, i * SURVIVORS_STEP_S);
      expect(m['survivors-boss-martillo']!.count).toBe(1);
      // La línea de la embestida la pinta la vista con los demás avisos de boss (T140).
      const lineWarnings = s.bossWarnings.filter((w) => w.kind === 'line' && !w.hit).length;
      if (lineWarnings > 0) {
        sawLine = true;
        expect(m['survivors-boss-warning']!.count).toBeGreaterThanOrEqual(lineWarnings * 2);
      }
      if (m['survivors-boss-summon-warning']!.count > 0) sawRing = true;
    }
    expect(sawLine).toBe(true);
    expect(sawRing).toBe(true);
    game.spawnChest('martillo', 600, 600);
    view.update(game.snapshot(), 30);
    expect(m['survivors-chest']!.count).toBe(1);
    // Lo que se ve, por el mismo camino que `data-canon-jefes-*`.
    const seen = view.shark.markSeen(() => true);
    expect(seen.now).toEqual(['martillo', 'cofre']);
    expect(view.shark.markSeen(() => false)).toEqual({ now: [], seen: ['cofre', 'martillo'] });
    view.dispose();
  });

  it('con movimiento reducido el tiburón y el cofre no se mecen ni giran', () => {
    const cfg = quiet();
    const game = createSurvivors(cfg, 1, world);
    game.spawnBoss('martillo', 450, 0);
    game.spawnChest('martillo', 300, 300);
    game.step();
    const s = game.snapshot();
    const shark = new SurvivorsShark(cfg);
    const mm = byName(shark);
    const take = () => [matrices(mm['survivors-boss-martillo']!), matrices(mm['survivors-chest']!)];
    shark.update(s, 1, true);
    const a = take();
    shark.update(s, 2.37, true);
    expect(take()).toEqual(a);
    shark.update(s, 3.11, false);
    expect(take()).not.toEqual(a);
  });
});

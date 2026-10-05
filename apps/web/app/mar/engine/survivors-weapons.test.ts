import {
  SURVIVORS_CONFIG,
  SURVIVORS_STEP_S,
  type SurvivorsConfig,
  type SurvivorsSnapshot,
  type WeaponId,
  createSurvivors,
  resolveWeaponStats,
} from '@boia/engine/survivors';
import { Matrix4, type MeshBasicMaterial } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { SurvivorsRun } from '../survivors';
import { toScene } from './compress';
import { MAR_SHIP_CONFIG } from './steering';
import { SurvivorsView } from './survivors-view';
import {
  LASER_OPACITY,
  SurvivorsWeapons,
  WEAPON_Y,
  weaponGeometry,
  weaponVisualCapacity,
} from './survivors-weapons';

const ids = Object.keys(SURVIVORS_CONFIG.weapons) as WeaponId[];
const sea = {
  bounds: { left: -2000, right: 2000, top: -2000, bottom: 2000 },
  obstacles: [],
  start: { x: 0, y: 0 },
};
const meshName = (id: WeaponId) => (id === 'canon' ? 'survivors-balls' : `survivors-weapon-${id}`);
function quiet(id: WeaponId): SurvivorsConfig {
  const c = structuredClone(SURVIVORS_CONFIG);
  c.startingWeapon = id;
  c.acts = [{ act: 1, durationS: c.durationS, tracks: [], events: [] }];
  c.player.waterCapacity = 1e12;
  for (const e of Object.values(c.enemies)) {
    e!.speed = 0;
    e!.acceleration = 0;
    e!.hp = 1e9;
  }
  return c;
}
function sample(id: WeaponId, evolution?: string) {
  const c = quiet(id);
  const g = createSurvivors(c, 7, sea);
  while (g.levelUpWeapon(id)) {
    /* source level maximum */
  }
  if (evolution) {
    const e = c.evolutions.find((e) => e.id === evolution)!;
    g.addVinyl(e.passive);
    expect(g.evolveWeapon(e.id)).toBe(true);
  }
  g.spawnEnemy('crab', 280, 0);
  g.step();
  return g.snapshot();
}
function expected(s: SurvivorsSnapshot, id: WeaponId) {
  return (
    s.projectiles.filter((p) => p.weapon === id).length +
    s.auras.filter((a) => a.weapon === id).length * 2 +
    s.beams.filter((b) => b.weapon === id).length +
    s.orbitals.filter((o) => o.weapon === id).length +
    s.zones.filter((z) => z.weapon === id).length
  );
}
function empty(s: SurvivorsSnapshot): SurvivorsSnapshot {
  return { ...s, projectiles: [], auras: [], beams: [], orbitals: [], zones: [] };
}

describe.each(ids)('T128 visual builder: %s', (id) => {
  it('builds finite low-poly geometry and an empty, quality-bounded batch', () => {
    const g = weaponGeometry(id);
    const pos = g.getAttribute('position');
    expect(pos.count).toBeGreaterThan(0);
    for (const n of pos.array) expect(Number.isFinite(n)).toBe(true);
    expect(g.getAttribute('normal').count).toBe(pos.count);
    g.dispose();
    for (const quality of ['alta', 'baja'] as const) {
      const caps = SURVIVORS_CONFIG.caps[quality];
      const v = new SurvivorsWeapons(SURVIVORS_CONFIG, caps);
      const m = v.meshes[meshName(id)]!;
      const kind = SURVIVORS_CONFIG.weapons[id]!.kind;
      const cap =
        kind === 'zone'
          ? caps.areas
          : ['projectile', 'cone', 'rocket'].includes(kind)
            ? caps.projectiles
            : weaponVisualCapacity(SURVIVORS_CONFIG, id) * (kind === 'aura' ? 2 : 1);
      expect(m.instanceMatrix.count).toBe(cap);
      expect(m.count).toBe(0);
      expect(m.visible).toBe(false);
      v.dispose();
    }
  });

  it('updates the source attack positions, hides empty batches, and disposes every resource once', () => {
    const s = sample(id);
    const v = new SurvivorsWeapons(SURVIVORS_CONFIG, SURVIVORS_CONFIG.caps.baja);
    const m = v.meshes[meshName(id)]!;
    const matrices = m.instanceMatrix.array;
    const disposeGeometry = vi.fn(),
      disposeMaterial = vi.fn(),
      disposeMesh = vi.fn();
    m.geometry.addEventListener('dispose', disposeGeometry);
    (m.material as MeshBasicMaterial).addEventListener('dispose', disposeMaterial);
    m.addEventListener('dispose', disposeMesh);
    v.update(s, 1, false);
    expect(m.count).toBe(expected(s, id));
    expect(m.visible).toBe(true);
    expect(v.counts()[id]).toBe(expected(s, id));
    const source = [...s.projectiles, ...s.auras, ...s.beams, ...s.orbitals, ...s.zones].find(
      (a) => a.weapon === id,
    )!;
    expect(matrices[12]).toBeCloseTo(toScene(source.x));
    expect(matrices[14]).toBeCloseTo(toScene(source.y));
    const shift = <T extends { x: number }>(a: T): T => ({ ...a, x: a.x + 40 });
    v.update(
      {
        ...s,
        projectiles: s.projectiles.map(shift),
        auras: s.auras.map(shift),
        beams: s.beams.map(shift),
        orbitals: s.orbitals.map(shift),
        zones: s.zones.map(shift),
      },
      2,
      false,
    );
    expect(m.instanceMatrix.array).toBe(matrices);
    expect(matrices[12]).toBeCloseTo(toScene(source.x + 40));
    v.update(empty(s), 3, false);
    expect(m.count).toBe(0);
    expect(m.visible).toBe(false);
    expect(v.counts()).toEqual({});
    v.dispose();
    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();
    expect(disposeMesh).toHaveBeenCalledOnce();
  });

  it('has a steady reduced-motion variant while retaining gameplay positions', () => {
    const s = sample(id);
    const v = new SurvivorsWeapons(SURVIVORS_CONFIG, SURVIVORS_CONFIG.caps.baja);
    const m = v.meshes[meshName(id)]!;
    v.update(s, 1, true);
    const before = Array.from(m.instanceMatrix.array);
    v.update(s, 8, true);
    expect(Array.from(m.instanceMatrix.array)).toEqual(before);
    if (id === 'laser') {
      const mat = m.material as MeshBasicMaterial;
      const dim = mat.opacity;
      v.update(s, 9, false);
      expect(mat.opacity).toBeGreaterThan(dim);
      const normal = mat.opacity;
      for (let t = 9; t < 11; t += SURVIVORS_STEP_S) {
        v.update(s, t, false);
        expect(mat.opacity).toBe(normal); // no temporal alpha modulation, at any frequency
      }
      const beam = s.beams[0]!;
      v.update({ ...s, beams: [{ ...beam, angle: beam.angle + 0.5 }] }, 12, true);
      expect(Array.from(m.instanceMatrix.array)).not.toEqual(before);
      expect(mat.opacity).toBe(dim); // live preference change
    }
    v.dispose();
  });
});

describe('T128 evolutions, pools and integration', () => {
  it.each(SURVIVORS_CONFIG.evolutions)(
    '$id keeps its base silhouette with a stronger footprint or tint',
    (e) => {
      const base = sample(e.weapon);
      const evolved = sample(e.weapon, e.id);
      const v = new SurvivorsWeapons(SURVIVORS_CONFIG, SURVIVORS_CONFIG.caps.baja);
      const m = v.meshes[meshName(e.weapon)]!;
      v.update(base, 0, true);
      const size = new Matrix4().fromArray(m.instanceMatrix.array).elements[0]!;
      const baseTint = Array.from(m.instanceColor!.array).slice(0, 3);
      v.update(evolved, 0, true);
      expect(m.visible).toBe(true);
      expect(m.count).toBe(
        expected(evolved, e.weapon) -
          evolved.projectiles.filter(
            (p) => p.weapon === 'buoys' && (p.kind === 'orbit' || p.kind === 'projectile'),
          ).length,
      );
      expect(Array.from(m.instanceColor!.array).slice(0, 3)).not.toEqual(baseTint);
      expect(Math.abs(m.instanceMatrix.array[0]!)).toBeGreaterThanOrEqual(Math.abs(size));
      if (e.evolvedWeapon.effects?.flashes) {
        expect(v.meshes['survivors-disco-flashes']!.count).toBe(evolved.projectiles.length);
        expect(v.meshes['survivors-balls']!.count).toBe(0);
      }
      v.dispose();
    },
  );

  it('aura and rain pulses stop with reduced motion; life dims a dying rain zone', () => {
    const v = new SurvivorsWeapons(SURVIVORS_CONFIG, SURVIVORS_CONFIG.caps.baja);
    for (const id of ['subwoofer', 'acidRain'] as const) {
      const s = sample(id);
      const changed = {
        ...s,
        auras: s.auras.map((a) => ({ ...a, progress: 0.3 })),
        zones: s.zones.map((z) => ({ ...z, progress: 0.3 })),
      };
      const m = v.meshes[meshName(id)]!;
      v.update(s, 0, false);
      const normal = Array.from(m.instanceMatrix.array);
      v.update(changed, 0, false);
      expect(Array.from(m.instanceMatrix.array)).not.toEqual(normal);
      v.update(s, 0, true);
      const steady = Array.from(m.instanceMatrix.array);
      v.update(changed, 1, true);
      expect(Array.from(m.instanceMatrix.array)).toEqual(steady);
      if (id === 'acidRain') {
        const before = m.instanceColor!.array[1]!;
        v.update(
          { ...s, zones: s.zones.map((z) => ({ ...z, lifeS: z.durationS * 0.1 })) },
          1,
          true,
        );
        expect(m.instanceColor!.array[1]).toBeLessThan(before);
      }
    }
    v.dispose();
  });

  it('the laser strip reaches the full beam range, from the boat outwards', () => {
    const s = sample('laser');
    const v = new SurvivorsWeapons(SURVIVORS_CONFIG, SURVIVORS_CONFIG.caps.baja);
    const m = v.meshes[meshName('laser')]!;
    v.update(s, 0, false);
    expect(m.count).toBe(s.beams.length);
    for (let i = 0; i < s.beams.length; i++) {
      const e = new Matrix4().fromArray(m.instanceMatrix.array, i * 16).elements;
      const beam = s.beams[i]!;
      expect(Math.hypot(e[0]!, e[1]!, e[2]!)).toBeCloseTo(toScene(beam.length));
      // Its direction is the beam's angle (sim y is scene z).
      expect(Math.atan2(e[2]!, e[0]!)).toBeCloseTo(
        Math.atan2(Math.sin(beam.angle), Math.cos(beam.angle)),
      );
    }
    const g = m.geometry;
    g.computeBoundingBox();
    expect(g.boundingBox!.min.x).toBeCloseTo(0);
    expect(g.boundingBox!.max.x).toBeCloseTo(1);
    expect((m.material as MeshBasicMaterial).opacity).toBe(LASER_OPACITY.normal);
    v.dispose();
  });

  it('what flies over islands is lifted by the ground; auras stay on the water', () => {
    const ground = 5;
    const v = new SurvivorsWeapons(SURVIVORS_CONFIG, SURVIVORS_CONFIG.caps.baja, () => ground);
    const y = (id: WeaponId) => v.meshes[meshName(id)]!.instanceMatrix.array[13]!;
    for (const id of ['fireworks', 'buoys', 'laser', 'acidRain', 'subwoofer'] as const) {
      v.update(sample(id), 0, true);
      expect(v.meshes[meshName(id)]!.count).toBeGreaterThan(0);
      if (id === 'subwoofer') expect(y(id)).toBeCloseTo(WEAPON_Y.aura);
      else expect(y(id)).toBeGreaterThanOrEqual(ground);
    }
    expect(y('fireworks')).toBeCloseTo(ground + WEAPON_Y.rocket);
    v.dispose();
  });

  it('caps aggregate projectiles and rain even with an oversized snapshot', () => {
    const s = sample('canon');
    for (const quality of ['alta', 'baja'] as const) {
      const caps = SURVIVORS_CONFIG.caps[quality];
      const v = new SurvivorsWeapons(SURVIVORS_CONFIG, caps);
      const projectileIds = ids.filter((id) =>
        ['projectile', 'cone', 'rocket'].includes(SURVIVORS_CONFIG.weapons[id]!.kind),
      );
      const projectiles = Array.from(
        { length: caps.projectiles * projectileIds.length },
        (_, i) => ({
          ...s.projectiles[0]!,
          weapon: projectileIds[i % projectileIds.length]!,
          kind: SURVIVORS_CONFIG.weapons[projectileIds[i % projectileIds.length]!]!.kind,
        }),
      );
      const z = sample('acidRain').zones[0]!;
      v.update({ ...s, projectiles, zones: Array(caps.areas * 2).fill(z) }, 0, false);
      const counts = v.counts();
      expect(projectileIds.reduce((n, id) => n + (counts[id] ?? 0), 0)).toBe(caps.projectiles);
      expect(counts.acidRain).toBe(caps.areas);
      v.dispose();
    }
  });

  it('retains bounded explosions, including El Drop, then expires them without new matrices', () => {
    const caps = SURVIVORS_CONFIG.caps.baja;
    const v = new SurvivorsWeapons(SURVIVORS_CONFIG, caps);
    const s = empty(sample('fireworks'));
    const m = v.meshes['survivors-weapon-bursts']!;
    const matrices = m.instanceMatrix.array;
    v.update(s, 10, false);
    for (let i = 0; i < caps.areas * 3; i++)
      v.explode(
        'fireworks',
        i,
        0,
        resolveWeaponStats(
          SURVIVORS_CONFIG.weapons.fireworks!,
          SURVIVORS_CONFIG.weapons.fireworks!.maxLevel,
        ).area,
      );
    v.update(s, 10.2, false);
    expect(m.count).toBe(caps.areas);
    expect(m.visible).toBe(true);
    expect(v.counts(() => false)).toEqual({});
    expect(v.counts(() => true).fireworks).toBe(caps.areas);
    v.explode(
      'canon',
      30,
      40,
      SURVIVORS_CONFIG.evolutions.find((e) => e.weapon === 'canon')!.evolvedWeapon.base.area,
    );
    v.update(s, 10.3, true);
    expect(v.counts().canon).toBeGreaterThan(0);
    const steady = Array.from(m.instanceMatrix.array);
    v.update(s, 10.4, true);
    expect(Array.from(m.instanceMatrix.array)).toEqual(steady);
    v.update(s, 11, true);
    expect(m.count).toBe(0);
    expect(m.visible).toBe(false);
    expect(m.instanceMatrix.array).toBe(matrices);
    v.dispose();
  });

  it.each(['alta', 'baja'] as const)(
    'runs all max-level weapons in %s and disposes through SurvivorsView once',
    (quality) => {
      const run = new SurvivorsRun(sea, {
        seed: 7,
        quality,
        ship: MAR_SHIP_CONFIG,
        devWeapons: true,
        autoPickCards: true,
        startAtS: 240,
      });
      run.devAllWeapons();
      const view = new SurvivorsView(run.config, run.game.caps, { quality, groundAt: () => 20 });
      const seen = new Set<string>();
      const resources = Object.values(view.weapons.meshes).map((m) => {
        const disposed = vi.fn();
        m.geometry.addEventListener('dispose', disposed);
        return disposed;
      });
      for (let i = 0; i < 10 / SURVIVORS_STEP_S && !run.ended; i++) {
        const events = run.step({ dirX: 1, dirY: 0, throttle: 1, drift: false });
        for (const e of events)
          if (e.type === 'explode') view.weapons.explode(e.weapon, e.x, e.y, e.radius);
        const s = run.snapshot();
        view.update(s, i * SURVIVORS_STEP_S);
        for (const id of Object.keys(view.weapons.counts())) seen.add(id);
        for (const m of Object.values(view.weapons.meshes)) {
          expect(m.count).toBeLessThanOrEqual(m.instanceMatrix.count);
          expect(m.visible).toBe(m.count > 0);
        }
      }
      expect([...seen].sort()).toEqual([...ids].sort());
      expect(run.snapshot().weapons.map((w) => w.level)).toEqual(
        ids.map((id) => SURVIVORS_CONFIG.weapons[id]!.maxLevel),
      );
      view.dispose();
      for (const dispose of resources) expect(dispose).toHaveBeenCalledOnce();
    },
  );
});

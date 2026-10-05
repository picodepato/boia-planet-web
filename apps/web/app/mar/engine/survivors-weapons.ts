import {
  type QualityCaps,
  type SurvivorsConfig,
  type SurvivorsSnapshot,
  type WeaponId,
  resolveWeaponStats,
} from '@boia/engine/survivors';
import {
  BoxGeometry,
  type BufferGeometry,
  CircleGeometry,
  Color,
  type ColorRepresentation,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  type InstancedMesh,
  type Material,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { toScene } from './compress';
import { Kit } from './kit';
import {
  BALL_MIN,
  BALL_SCALE,
  ballMaterial,
  cannonBallGeometry,
  instanced,
  propsMaterial,
} from './survivors-props';

/**
 * Heights (scene units) above the local ground. Auras and puddles lie on the
 * water; the laser sweeps at deck height; buoys float; rockets fly. What the
 * sim lets pass over islands (laser, buoys, rockets, rain) is lifted by the
 * ground under it so it never sinks into a hill.
 */
export const WEAPON_Y = {
  shot: 0.6,
  aura: 0.15,
  beam: 1.1,
  orbit: 0.5,
  rocket: 2.6,
  zone: 0.1,
  burst: 1.2,
} as const;
/** s a burst stays on screen (rockets, El Drop). */
export const BURST_S = 0.65;

/** Low-poly, merged pieces: one draw per active weapon, no lights or textures. */
export function weaponGeometry(id: WeaponId) {
  if (id === 'canon') return cannonBallGeometry();
  // A flat strip from the boat (x = 0) to the beam's reach (x = 1), 1 wide.
  if (id === 'laser') return new PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0.5, 0, 0);
  if (id === 'subwoofer') return new RingGeometry(0.94, 1, 32).rotateX(-Math.PI / 2);
  const k = new Kit();
  // Kit clones its inputs; release the short-lived modelling primitives as well.
  const add = (g: Parameters<Kit['add']>[0], color: string, at?: Parameters<Kit['add']>[2]) => {
    k.add(g, color, at);
    g.dispose();
  };
  if (id === 'buoys') {
    add(new TorusGeometry(0.72, 0.24, 4, 10), '#ff9a33', { r: [Math.PI / 2, 0, 0] });
    add(new CylinderGeometry(0.38, 0.55, 1.1, 8), '#ffffff', { p: [0, 0.5, 0] });
    add(new ConeGeometry(0.42, 0.65, 8), '#843fd4', { p: [0, 1.35, 0] });
    add(new BoxGeometry(0.85, 0.35, 0.12), '#142745', { p: [0, 0.85, 0.4] });
  } else if (id === 'confetti') {
    // Three coloured streamers in each fan projectile; not a particle emitter.
    for (let i = 0; i < 3; i++) {
      add(new BoxGeometry(1.7, 0.13, 0.35), ['#ff64be', '#ffd650', '#67dce5'][i]!, {
        p: [-i * 0.3, i * 0.18, (i - 1) * 0.38],
        r: [0, (i - 1) * 0.2, 0],
      });
    }
  } else if (id === 'fireworks') {
    add(new CylinderGeometry(0.3, 0.3, 1.5, 6), '#ff64be', { r: [0, 0, -Math.PI / 2] });
    add(new ConeGeometry(0.43, 0.7, 6), '#ffd650', { p: [1.1, 0, 0], r: [0, 0, -Math.PI / 2] });
    add(new ConeGeometry(0.3, 1, 5), '#ffa352', { p: [-1.1, 0, 0], r: [0, 0, Math.PI / 2] });
  } else {
    add(new RingGeometry(0.92, 1, 24).rotateX(-Math.PI / 2), '#b5ff35');
    add(new CircleGeometry(0.95, 20).rotateX(-Math.PI / 2), '#70bb18', { p: [0, 0.02, 0] });
    // A cloud and a sparse curtain of rain occupy the same instanced geometry.
    add(new SphereGeometry(1, 8, 4), '#b5ff35', { p: [0, 3, 0], s: [0.75, 0.45, 0.65] });
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      add(new BoxGeometry(0.03, 1.5, 0.03), '#ceff78', {
        p: [Math.cos(a) * 0.65, 1.7, Math.sin(a) * 0.65],
      });
    }
  }
  return k.build();
}

/**
 * Transparent only where the shape must let the sea show through (aura rings,
 * the beam, the rain puddle): thin rings and one strip keep the overdraw low,
 * and `depthWrite: false` keeps them from hiding enemies. Steady alpha, never
 * animated (no strobing, REQ-AVE-039).
 */
export function weaponMaterial(id: WeaponId) {
  if (id === 'canon') return ballMaterial();
  if (id === 'subwoofer' || id === 'laser' || id === 'acidRain') {
    return new MeshBasicMaterial({
      color: id === 'laser' ? '#e98dff' : id === 'subwoofer' ? '#b993ff' : '#ffffff',
      vertexColors: id === 'acidRain',
      transparent: true,
      opacity: id === 'acidRain' ? 0.35 : id === 'laser' ? LASER_OPACITY.normal : 0.45,
      depthWrite: false,
      side: DoubleSide,
      forceSinglePass: true,
    });
  }
  return propsMaterial();
}

/** The laser is dimmer with reduced motion (it still turns: that is the attack). */
export const LASER_OPACITY = { normal: 0.5, reduced: 0.28 } as const;

/** Count maxima come from the actual level/evolution tables, including Rumba. */
export function weaponVisualCapacity(config: SurvivorsConfig, id: WeaponId): number {
  const def = config.weapons[id];
  if (!def) return 0;
  const rumba = config.passives.rumba;
  const extraProjectiles = rumba?.levels.reduce((n, l) => n + l.amount, 0) ?? 0;
  const defs = [
    def,
    ...config.evolutions.filter((e) => e.weapon === id).map((e) => e.evolvedWeapon),
  ];
  return Math.max(
    ...defs.map(
      (d) =>
        resolveWeaponStats(d, d.maxLevel, {
          damageBonus: 0,
          fireRateBonus: 0,
          areaBonus: 0,
          extraProjectiles,
        }).count,
    ),
  );
}

type Burst = { weapon: WeaponId; x: number; y: number; radius: number; born: number };
type Batch = { mesh: InstancedMesh; ids: WeaponId[]; radii: Float32Array; centers: Float32Array };
export type WeaponVisibleTest = (x: number, y: number, z: number, radius: number) => boolean;

/** Rings and rays of a burst (rockets, El Drop): one merged piece, tinted per instance. */
export function burstGeometry(): BufferGeometry {
  const k = new Kit();
  const ring = new RingGeometry(0.92, 1, 24).rotateX(-Math.PI / 2);
  for (const s of [0.45, 0.72, 1]) k.add(ring, '#ffffff', { s });
  ring.dispose();
  const ray = new BoxGeometry(0.28, 0.03, 0.05);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    k.add(ray, '#ffffff', { p: [Math.cos(a) * 0.8, 0, Math.sin(a) * 0.8], r: [0, -a, 0] });
  }
  ray.dispose();
  return k.build();
}

const glow = (color: string, opacity: number) =>
  new MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: DoubleSide });

/**
 * Fixed pools owned by this view: one `InstancedMesh` (one draw) per weapon,
 * plus the Disco Ball flashes and the bursts. Sizes come from the quality caps
 * and the level tables, never grow, and an empty pool is hidden (no draw
 * call). SurvivorsView attaches these meshes directly to its group.
 */
export class SurvivorsWeapons {
  readonly meshes: Record<string, InstancedMesh> = {};
  private readonly batches: Batch[] = [];
  private readonly byId = new Map<WeaponId, Batch>();
  private readonly flashes: Batch;
  private readonly bursts: Batch;
  private readonly pool: (Burst | null)[];
  private readonly dummy = new Object3D();
  private readonly color = new Color();
  private readonly center = new Vector3();
  private nextBurst = 0;
  private now = 0;

  constructor(
    config: SurvivorsConfig,
    private readonly caps: QualityCaps,
    /** Ground height (scene) under a point (scene); water by default. */
    private readonly groundAt: (x: number, z: number) => number = () => 0,
  ) {
    const batch = (
      name: string,
      geometry: BufferGeometry,
      material: Material,
      cap: number,
    ): Batch => {
      const mesh = instanced(geometry, material, cap, name);
      mesh.visible = false;
      mesh.geometry.computeBoundingSphere();
      const size = mesh.instanceMatrix.count;
      const b = {
        mesh,
        ids: Array<WeaponId>(size),
        radii: new Float32Array(size),
        centers: new Float32Array(size * 3),
      };
      this.meshes[name] = mesh;
      this.batches.push(b);
      return b;
    };
    for (const id of Object.keys(config.weapons) as WeaponId[]) {
      const kind = config.weapons[id]!.kind;
      const cap =
        kind === 'zone'
          ? caps.areas
          : ['projectile', 'cone', 'rocket'].includes(kind)
            ? caps.projectiles
            : weaponVisualCapacity(config, id) * (kind === 'aura' ? 2 : 1);
      this.byId.set(
        id,
        batch(
          id === 'canon' ? 'survivors-balls' : `survivors-weapon-${id}`,
          weaponGeometry(id),
          weaponMaterial(id),
          cap,
        ),
      );
    }
    this.flashes = batch(
      'survivors-disco-flashes',
      cannonBallGeometry(),
      glow('#ffe8a6', 0.6),
      caps.projectiles,
    );
    // The effect pool scales with the quality's area budget; rings and rays share one draw.
    this.bursts = batch(
      'survivors-weapon-bursts',
      burstGeometry(),
      glow('#ffffff', 0.55),
      caps.areas,
    );
    this.pool = Array<Burst | null>(caps.areas).fill(null);
  }

  explode(weapon: WeaponId, x: number, y: number, radius: number): void {
    if (!this.pool.length) return;
    this.pool[this.nextBurst] = { weapon, x, y, radius, born: this.now };
    this.nextBurst = (this.nextBurst + 1) % this.pool.length;
  }

  private place(
    b: Batch,
    id: WeaponId,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    angle = 0,
    tint: ColorRepresentation = '#ffffff',
    radius = Math.max(sx, sz) * 2,
  ) {
    const i = b.mesh.count;
    if (i >= b.radii.length) return;
    const d = this.dummy;
    d.position.set(x, y, z);
    d.rotation.set(0, -angle, 0);
    d.scale.set(sx, sy, sz);
    d.updateMatrix();
    b.mesh.setMatrixAt(i, d.matrix);
    b.mesh.setColorAt(i, this.color.set(tint));
    b.ids[i] = id;
    b.radii[i] = radius;
    this.center.copy(b.mesh.geometry.boundingSphere!.center).applyMatrix4(d.matrix);
    this.center.toArray(b.centers, i * 3);
    b.mesh.count++;
  }

  /** Ground under a point (scene), never below the water. */
  private lift(x: number, z: number): number {
    return Math.max(0, this.groundAt(x, z));
  }

  update(s: SurvivorsSnapshot, t: number, reduced: boolean): void {
    this.now = t;
    for (const b of this.batches) b.mesh.count = 0;
    const evolved = (id: WeaponId) => s.weapons.some((w) => w.id === id && w.evolutionId !== null);
    let np = 0;
    for (const p of s.projectiles) {
      if (np++ >= this.caps.projectiles) break;
      // Disco Ball flashes are projectiles of the orbit weapon: they get their own glow.
      const b =
        p.weapon === 'buoys' && (p.kind === 'orbit' || p.kind === 'projectile')
          ? this.flashes
          : this.byId.get(p.weapon);
      if (!b) continue;
      const x = toScene(p.x);
      const z = toScene(p.y);
      // Rockets fly over islands (the sim lets them); balls and confetti skim the water.
      const y = p.kind === 'rocket' ? this.lift(x, z) + WEAPON_Y.rocket : WEAPON_Y.shot;
      const size = Math.max(BALL_MIN, toScene(p.radius) * BALL_SCALE) * (p.evolutionId ? 1.5 : 1);
      this.place(
        b,
        p.weapon,
        x,
        y,
        z,
        size,
        size,
        size,
        Math.atan2(p.vy, p.vx),
        p.evolutionId ? '#ffe39b' : '#ffffff',
      );
    }
    for (const a of s.auras) {
      const b = this.byId.get(a.weapon);
      if (!b) continue;
      const r = toScene(a.radius);
      const tint = evolved(a.weapon) ? '#ffce78' : '#ffffff';
      for (let i = 0; i < 2; i++) {
        // Two rings travel outwards with the beat at constant alpha; with
        // reduced motion they stand still and mark the edge of the aura.
        const pulse = reduced ? 1 - i * 0.18 : 0.55 + ((a.progress + i * 0.5) % 1) * 0.45;
        const size = r * pulse;
        this.place(
          b,
          a.weapon,
          toScene(a.x),
          WEAPON_Y.aura + i * 0.03,
          toScene(a.y),
          size,
          1,
          size,
          0,
          tint,
          r,
        );
      }
    }
    const laser = this.byId.get('laser');
    if (laser) {
      (laser.mesh.material as MeshBasicMaterial).opacity = reduced
        ? LASER_OPACITY.reduced
        : LASER_OPACITY.normal;
    }
    for (const beam of s.beams) {
      const b = this.byId.get(beam.weapon);
      if (!b) continue;
      // Steady alpha, never a strobe. It still turns with reduced motion: that is the attack.
      const len = toScene(beam.length);
      const width = Math.max(0.3, toScene(beam.halfWidth) * 2);
      const x = toScene(beam.x);
      const z = toScene(beam.y);
      const tint = evolved(beam.weapon) ? '#ffdb9c' : '#ffffff';
      this.place(
        b,
        beam.weapon,
        x,
        this.lift(x, z) + WEAPON_Y.beam,
        z,
        len,
        1,
        width,
        beam.angle,
        tint,
        len * 0.5,
      );
    }
    for (const o of s.orbitals) {
      const b = this.byId.get(o.weapon);
      if (!b) continue;
      const size = Math.max(0.5, toScene(o.radius)) * (evolved(o.weapon) ? 1.3 : 1);
      const x = toScene(o.x);
      const z = toScene(o.y);
      const bob = reduced ? 0 : Math.sin(t * 2 + o.index) * 0.12;
      const tint = evolved(o.weapon) ? '#ffe0a4' : '#ffffff';
      this.place(
        b,
        o.weapon,
        x,
        this.lift(x, z) + WEAPON_Y.orbit + bob,
        z,
        size,
        size,
        size,
        reduced ? 0 : o.angle,
        tint,
        size * 2,
      );
    }
    for (const zone of s.zones) {
      const b = this.byId.get(zone.weapon);
      if (!b || zone.lifeS <= 0) continue;
      const r = toScene(zone.radius);
      const x = toScene(zone.x);
      const z = toScene(zone.y);
      // A dying cloud fades towards half brightness (colour, not alpha: no blinking).
      const life = Math.min(1, Math.max(0, zone.lifeS / Math.max(0.001, zone.durationS)));
      this.color.setRGB(0.5 + life * 0.5, 0.5 + life * 0.5, 0.5 + life * 0.5);
      const sway = reduced ? 1 : 1 + Math.sin(zone.progress * Math.PI * 2) * 0.06;
      this.place(
        b,
        zone.weapon,
        x,
        this.lift(x, z) + WEAPON_Y.zone,
        z,
        r,
        sway,
        r,
        0,
        this.color,
        Math.hypot(r, 4),
      );
    }
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p) continue;
      const age = Math.max(0, t - p.born);
      if (age >= BURST_S || t < p.born) {
        this.pool[i] = null;
        continue;
      }
      // Grows once (no flicker); with reduced motion it simply shows its full area.
      const r = toScene(p.radius) * (reduced ? 1 : 0.5 + (age / BURST_S) * 0.5);
      const x = toScene(p.x);
      const z = toScene(p.y);
      const y = p.weapon === 'fireworks' ? this.lift(x, z) + WEAPON_Y.burst : WEAPON_Y.aura;
      this.place(
        this.bursts,
        p.weapon,
        x,
        y,
        z,
        r,
        1,
        r,
        0,
        p.weapon === 'fireworks' ? '#ffd778' : '#c5eeff',
        r,
      );
    }
    for (const b of this.batches) {
      // An empty pool costs no draw call.
      b.mesh.visible = b.mesh.count > 0;
      if (!b.mesh.visible) continue;
      b.mesh.instanceMatrix.needsUpdate = true;
      if (b.mesh.instanceColor) b.mesh.instanceColor.needsUpdate = true;
    }
  }

  /** Drawn instances, optionally restricted to the actual camera view; never held-weapon state. */
  counts(test?: WeaponVisibleTest): Partial<Record<WeaponId, number>> {
    const out: Partial<Record<WeaponId, number>> = {};
    for (const b of this.batches) {
      for (let i = 0; i < b.mesh.count; i++) {
        const offset = i * 3;
        if (
          test &&
          !test(b.centers[offset]!, b.centers[offset + 1]!, b.centers[offset + 2]!, b.radii[i]!)
        )
          continue;
        const id = b.ids[i]!;
        out[id] = (out[id] ?? 0) + 1;
      }
    }
    return out;
  }

  dispose(): void {
    for (const b of this.batches) {
      b.mesh.removeFromParent();
      b.mesh.geometry.dispose();
      (b.mesh.material as Material).dispose();
      b.mesh.dispose();
    }
    this.pool.fill(null);
  }
}

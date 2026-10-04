import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  type PerspectiveCamera,
  RingGeometry,
  SphereGeometry,
  Vector3,
} from 'three';
import { rng } from './kit';
import { wrapD, type Period } from './wrap';

/** Small reusable ambient pools, driven only by the scene's existing frame clock. */
export const WILDLIFE = {
  fishCount: 2,
  gullCount: 5,
  fishDuration: 1.5,
  flockDuration: 7,
  firstFish: 3,
  firstFlock: 3,
  fishGap: [9, 18],
  flockGap: [18, 34],
  cloudHeight: 122,
  gullZoom: 0.7,
  fishZoom: 0.65,
  candidateAttempts: 12,
} as const;

export interface WildlifeFrame {
  ship: { x: number; z: number };
  focus: { x: number; z: number };
  period: Period;
  camera: PerspectiveCamera;
  zoom: number;
  cloudsVisible: boolean;
  flying: boolean;
}

/** Scene coordinates, with periodic collision checks: even a neighbouring world copy is land. */
export function waterClear(
  x: number,
  z: number,
  obstacles: readonly { x: number; z: number; radius: number }[],
  period: Period,
  padding = 1,
): boolean {
  return obstacles.every(
    (o) => Math.hypot(wrapD(x - o.x, period.w), wrapD(z - o.z, period.h)) > o.radius + padding,
  );
}

export function gullsEligible(
  frame: Pick<WildlifeFrame, 'zoom' | 'cloudsVisible' | 'flying' | 'camera'>,
): boolean {
  return (
    !frame.flying &&
    frame.cloudsVisible &&
    frame.zoom >= WILDLIFE.gullZoom &&
    frame.camera.position.y > WILDLIFE.cloudHeight
  );
}

interface Fish {
  root: Group;
  body: Group;
  splash: Mesh<RingGeometry, MeshBasicMaterial>;
  age: number;
  x: number;
  z: number;
  heading: number;
}

function triangle(points: number[]): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export class Wildlife {
  /** Fish follow planet curvature. Gulls are placed in the camera's cloud plane, without curvature. */
  readonly fish = new Group();
  readonly gulls = new Group();
  private readonly fishPool: Fish[] = [];
  private readonly wings: { left: Group; right: Group }[] = [];
  private readonly random: () => number;
  private fishClock = WILDLIFE.firstFish as number;
  private gullClock = WILDLIFE.firstFlock as number;
  private flockAge = -1;
  private time = 0;
  private reduced = false;
  private hidden = false;
  private destroyed = false;
  private direction = 1;
  private readonly forward = new Vector3();
  private readonly right = new Vector3();
  private readonly up = new Vector3();

  constructor(
    private readonly isWater: (x: number, z: number) => boolean,
    random = rng(102),
  ) {
    this.random = random;
    this.fish.name = 'peces';
    this.gulls.name = 'gaviotas';
    const fishBody = new SphereGeometry(0.35, 8, 4);
    const fishTail = triangle([-0.45, 0, 0, -0.9, 0.25, 0, -0.9, -0.25, 0]);
    const fishEye = new SphereGeometry(0.035, 5, 3);
    const silver = new MeshLambertMaterial({ color: '#c8edf0', flatShading: true });
    const blue = new MeshLambertMaterial({ color: '#3b8b9c', flatShading: true, side: DoubleSide });
    const black = new MeshBasicMaterial({ color: '#182639' });
    const ring = new RingGeometry(0.3, 0.38, 12);
    for (let i = 0; i < WILDLIFE.fishCount; i++) {
      const root = new Group();
      const body = new Group();
      const mesh = new Mesh(fishBody, silver);
      mesh.scale.set(1.5, 0.55, 0.55);
      body.add(mesh, new Mesh(fishTail, blue));
      for (const side of [-1, 1]) {
        const eye = new Mesh(fishEye, black);
        eye.position.set(0.3, 0.07, side * 0.16);
        body.add(eye);
      }
      const splash = new Mesh(
        ring,
        new MeshBasicMaterial({
          color: '#ffffff',
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      );
      splash.rotation.x = -Math.PI / 2;
      splash.position.y = 0.08;
      root.add(body, splash);
      root.visible = false;
      this.fish.add(root);
      this.fishPool.push({ root, body, splash, age: -1, x: 0, z: 0, heading: 0 });
    }
    const birdBody = new SphereGeometry(0.15, 6, 4);
    const wing = triangle([0, 0, 0, -0.78, -0.2, 0, -0.42, 0.16, 0.06]);
    const white = new MeshBasicMaterial({ color: '#fffaf0', side: DoubleSide });
    const tip = new MeshBasicMaterial({ color: '#586779' });
    for (let i = 0; i < WILDLIFE.gullCount; i++) {
      const bird = new Group();
      const body = new Mesh(birdBody, white);
      body.scale.set(0.7, 2, 0.55);
      bird.add(body);
      const left = new Group();
      const right = new Group();
      left.add(new Mesh(wing, white));
      const mirrored = new Mesh(wing, white);
      mirrored.scale.x = -1;
      right.add(mirrored);
      for (const [group, side] of [
        [left, -1],
        [right, 1],
      ] as const) {
        const dark = new Mesh(birdBody, tip);
        dark.scale.set(0.65, 0.35, 0.2);
        dark.position.set(side * 0.7, -0.16, 0);
        group.add(dark);
      }
      bird.add(left, right);
      bird.rotation.z = -Math.PI / 2;
      // A small loose V, with individual wing phases.
      bird.position.set(-i * 0.85, (i % 2 ? -1 : 1) * Math.ceil(i / 2) * 0.65, 0);
      this.gulls.add(bird);
      this.wings.push({ left, right });
    }
    this.gulls.visible = false;
  }

  /**
   * Fuera de escena (la partida del Cañón, T120): sin peces ni gaviotas ni
   * relojes que corran; al volver, empieza como recién creada.
   */
  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    if (hidden) this.clear();
  }

  get isHidden(): boolean {
    return this.hidden;
  }

  setReducedMotion(reduced: boolean): void {
    this.reduced = reduced;
    if (reduced) this.clear();
  }

  private clear(): void {
    this.flockAge = -1;
    this.gulls.visible = false;
    for (const fish of this.fishPool) {
      fish.age = -1;
      fish.root.visible = false;
    }
    this.fishClock = WILDLIFE.firstFish;
    this.gullClock = WILDLIFE.firstFlock;
  }

  private spawnFish(ship: WildlifeFrame['ship']): void {
    const fish = this.fishPool.find((f) => f.age < 0);
    if (!fish) return;
    for (let i = 0; i < WILDLIFE.candidateAttempts; i++) {
      const bearing = Math.PI + (this.random() - 0.5) * 0.6;
      const radius = 8 + this.random() * 10;
      const x = ship.x + Math.sin(bearing) * radius;
      const z = ship.z + Math.cos(bearing) * radius;
      const heading = this.random() * Math.PI * 2;
      // Validate the entire arc's footprint, not just the point where it leaves the sea.
      if (
        ![0, 0.25, 0.5, 0.75, 1].every((t) =>
          this.isWater(x + Math.cos(heading) * 3 * t, z + Math.sin(heading) * 3 * t),
        )
      )
        continue;
      Object.assign(fish, { x, z, heading, age: 0 });
      return;
    }
  }

  update(delta: number, frame: WildlifeFrame): void {
    if (this.destroyed || this.reduced || this.hidden) return;
    // No catch-up spawning after a tab has been hidden; the existing scene frame is our only timer.
    const dt = Math.max(0, Math.min(0.1, delta));
    this.time += dt;
    const near = !frame.flying && frame.zoom < WILDLIFE.fishZoom;
    if (near) {
      this.fishClock -= dt;
      if (this.fishClock <= 0) {
        this.spawnFish(frame.ship);
        this.fishClock =
          WILDLIFE.fishGap[0] + this.random() * (WILDLIFE.fishGap[1] - WILDLIFE.fishGap[0]);
      }
    } else {
      for (const fish of this.fishPool) {
        fish.age = -1;
        fish.root.visible = false;
      }
    }
    for (const fish of this.fishPool) {
      if (fish.age < 0) continue;
      fish.age += dt;
      const u = fish.age / WILDLIFE.fishDuration;
      if (u >= 1) {
        fish.age = -1;
        fish.root.visible = false;
        continue;
      }
      fish.root.visible = true;
      fish.root.position.set(
        frame.focus.x +
          wrapD(fish.x + Math.cos(fish.heading) * 3 * u - frame.focus.x, frame.period.w),
        0,
        frame.focus.z +
          wrapD(fish.z + Math.sin(fish.heading) * 3 * u - frame.focus.z, frame.period.h),
      );
      fish.body.position.y = -0.3 + Math.sin(Math.PI * u) * 2;
      fish.body.rotation.set(
        0,
        -fish.heading,
        Math.atan2(Math.PI * 2 * Math.cos(Math.PI * u), 3) * 0.7,
      );
      const ripple = u < 0.3 ? u / 0.3 : u > 0.75 ? (u - 0.75) / 0.25 : -1;
      fish.splash.visible = ripple >= 0;
      fish.splash.scale.setScalar(1 + Math.max(0, ripple) * 2);
      fish.splash.material.opacity = ripple >= 0 ? (1 - ripple) * 0.5 : 0;
    }
    if (!gullsEligible(frame)) {
      this.gulls.visible = false;
      this.flockAge = -1;
      this.gullClock = WILDLIFE.firstFlock;
      return;
    }
    this.gullClock -= dt;
    if (this.flockAge < 0 && this.gullClock <= 0) {
      this.flockAge = 0;
      this.direction = this.random() < 0.5 ? -1 : 1;
      this.gullClock =
        WILDLIFE.flockGap[0] + this.random() * (WILDLIFE.flockGap[1] - WILDLIFE.flockGap[0]);
    }
    if (this.flockAge < 0) return;
    this.flockAge += dt;
    const u = this.flockAge / WILDLIFE.flockDuration;
    if (u >= 1) {
      this.flockAge = -1;
      this.gulls.visible = false;
      return;
    }
    this.gulls.visible = true;
    frame.camera.getWorldDirection(this.forward);
    this.right.set(1, 0, 0).applyQuaternion(frame.camera.quaternion);
    this.up.set(0, 1, 0).applyQuaternion(frame.camera.quaternion);
    const distance = Math.max(24, (frame.camera.position.y - 95) / Math.max(0.3, -this.forward.y));
    const halfHeight = distance * Math.tan((frame.camera.fov * Math.PI) / 360);
    const halfWidth = halfHeight * frame.camera.aspect;
    const size = distance / 45;
    const across = this.direction * ((u * 2 - 1) * 1.25 * halfWidth);
    this.gulls.position
      .copy(frame.camera.position)
      .addScaledVector(this.forward, distance)
      .addScaledVector(this.right, across)
      .addScaledVector(this.up, halfHeight * (0.28 + 0.06 * Math.sin(u * Math.PI)));
    this.gulls.quaternion.copy(frame.camera.quaternion);
    this.gulls.scale.set(size * this.direction, size, size);
    this.wings.forEach(({ left, right }, i) => {
      const flap = Math.sin(this.time * 6 + i * 0.9) * 0.28;
      left.rotation.z = flap;
      right.rotation.z = -flap;
    });
  }

  get state(): { fish: number; gulls: number; reduced: boolean } {
    return {
      fish: this.fishPool.filter((f) => f.root.visible).length,
      gulls: this.gulls.visible ? WILDLIFE.gullCount : 0,
      reduced: this.reduced,
    };
  }

  dispose(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clear();
    this.fish.removeFromParent();
    this.gulls.removeFromParent();
    const geometry = new Set<BufferGeometry>();
    const materials = new Set<MeshBasicMaterial | MeshLambertMaterial>();
    for (const root of [this.fish, this.gulls])
      root.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh) return;
        geometry.add(m.geometry);
        for (const material of Array.isArray(m.material) ? m.material : [m.material])
          materials.add(material as MeshBasicMaterial);
      });
    geometry.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
  }
}

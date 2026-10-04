import { describe, expect, it, vi } from 'vitest';
import { Group, type Mesh, PerspectiveCamera, Vector3 } from 'three';
import { Wildlife, WILDLIFE, gullsEligible, waterClear, type WildlifeFrame } from './wildlife';

function frame(overrides: Partial<WildlifeFrame> = {}): WildlifeFrame {
  const camera = new PerspectiveCamera(40, 1.6, 0.5, 5000);
  camera.position.set(0, 180, 180);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return {
    ship: { x: 0, z: 0 },
    focus: { x: 0, z: 0 },
    period: { w: 100, h: 100 },
    camera,
    zoom: 0.2,
    cloudsVisible: false,
    flying: false,
    ...overrides,
  };
}

function advance(wildlife: Wildlife, scene: WildlifeFrame, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * 20); i++) wildlife.update(0.05, scene);
}

describe('ambient wildlife', () => {
  it('rejects land in both the current world and the neighbouring wrapped copy', () => {
    const obstacles = [{ x: -48, z: 0, radius: 4 }];
    const period = { w: 100, h: 100 };
    expect(waterClear(48, 0, obstacles, period)).toBe(false);
    expect(waterClear(-48, 0, obstacles, period)).toBe(false);
    expect(waterClear(40, 0, obstacles, period)).toBe(true);
  });

  it('rejects an arc whose endpoint is on land, even if its initial point is water', () => {
    const water = vi.fn((x: number) => x > -1);
    const wildlife = new Wildlife(water, () => 0.5);
    advance(wildlife, frame(), 3.2);
    expect(wildlife.state.fish).toBe(0);
    expect(water).toHaveBeenCalledWith(expect.any(Number), expect.any(Number));
    expect(water.mock.calls.length).toBeLessThanOrEqual(WILDLIFE.candidateAttempts * 5);
    wildlife.dispose();
  });

  it('only samples bounded candidates when no safe water exists', () => {
    const water = vi.fn(() => false);
    const wildlife = new Wildlife(water, () => 0.5);
    advance(wildlife, frame(), 3.2);
    expect(water).toHaveBeenCalledTimes(WILDLIFE.candidateAttempts);
    expect(wildlife.state.fish).toBe(0);
    wildlife.dispose();
  });

  it('reuses its fish pool, jumps and submerges, and chooses the nearest world copy', () => {
    const wildlife = new Wildlife(
      () => true,
      () => 0.5,
    );
    const scene = frame({ ship: { x: 49, z: 0 }, focus: { x: -49, z: 0 } });
    const pool = [...wildlife.fish.children];
    advance(wildlife, scene, 3.3);
    expect(wildlife.state.fish).toBe(1);
    const fish = wildlife.fish.children.find((child) => child.visible)!;
    expect(Math.abs(fish.position.x - scene.focus.x)).toBeLessThan(10);
    const body = fish.children[0]!;
    expect(body.position.y).toBeGreaterThan(0);
    advance(wildlife, scene, 2);
    expect(wildlife.state.fish).toBe(0);
    advance(wildlife, scene, 11.3);
    expect(wildlife.fish.children).toEqual(pool);
    expect(wildlife.fish.children.length).toBe(WILDLIFE.fishCount);
    wildlife.dispose();
  });

  it('requires the actual cloud layer, distant zoom and no flight for gulls', () => {
    const cloudy = frame({ zoom: 0.8, cloudsVisible: true });
    expect(gullsEligible(cloudy)).toBe(true);
    expect(gullsEligible({ ...cloudy, cloudsVisible: false })).toBe(false);
    expect(gullsEligible({ ...cloudy, zoom: 0.6 })).toBe(false);
    expect(gullsEligible({ ...cloudy, flying: true })).toBe(false);
    cloudy.camera.position.y = 120;
    expect(gullsEligible(cloudy)).toBe(false);
  });

  it('crosses the camera as one bounded flock, then disappears on returning to the sea', () => {
    const wildlife = new Wildlife(
      () => true,
      () => 0.5,
    );
    const cloudy = frame({ zoom: 0.8, cloudsVisible: true });
    advance(wildlife, cloudy, 4);
    expect(wildlife.state.gulls).toBe(WILDLIFE.gullCount);
    const before = wildlife.gulls.position.clone().project(cloudy.camera).x;
    advance(wildlife, cloudy, 2);
    const after = wildlife.gulls.position.clone().project(cloudy.camera).x;
    expect(after).toBeGreaterThan(before);
    const altitude = wildlife.gulls.position.y;
    expect(altitude).toBeGreaterThan(80);
    expect(altitude).toBeLessThan(cloudy.camera.position.y);
    wildlife.update(0.05, frame());
    expect(wildlife.state.gulls).toBe(0);
    expect(wildlife.gulls.visible).toBe(false);
    wildlife.dispose();
  });

  it('immediately clears and stops all animation under reduced motion', () => {
    const wildlife = new Wildlife(
      () => true,
      () => 0.5,
    );
    const cloudy = frame({ zoom: 0.8, cloudsVisible: true });
    advance(wildlife, cloudy, 4);
    expect(wildlife.state.gulls).toBe(5);
    wildlife.setReducedMotion(true);
    const before = wildlife.gulls.position.clone();
    advance(wildlife, cloudy, 50);
    expect(wildlife.state).toEqual({ fish: 0, gulls: 0, reduced: true });
    expect(wildlife.gulls.position).toEqual(before);
    wildlife.setReducedMotion(false);
    advance(wildlife, cloudy, 4);
    expect(wildlife.state.gulls).toBe(5);
    wildlife.dispose();
  });

  it('hides fish and gulls during the Cañón game and starts afresh after it (T120)', () => {
    const wildlife = new Wildlife(
      () => true,
      () => 0.5,
    );
    const cloudy = frame({ zoom: 0.8, cloudsVisible: true });
    const near = frame();
    advance(wildlife, cloudy, 4);
    expect(wildlife.state.gulls).toBe(WILDLIFE.gullCount);
    wildlife.setHidden(true);
    expect(wildlife.isHidden).toBe(true);
    expect(wildlife.state.gulls).toBe(0);
    advance(wildlife, cloudy, 50);
    advance(wildlife, near, 50);
    expect(wildlife.state).toEqual({ fish: 0, gulls: 0, reduced: false });
    wildlife.setHidden(false);
    expect(wildlife.isHidden).toBe(false);
    advance(wildlife, near, 3.3);
    expect(wildlife.state.fish).toBe(1);
    wildlife.dispose();
  });

  it('disposes each shared resource once, detaches pools and prevents later work', () => {
    const wildlife = new Wildlife(
      () => true,
      () => 0.5,
    );
    const scene = new Group().add(wildlife.fish, wildlife.gulls);
    const resources = new Set<{ dispose(): void }>();
    scene.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh) return;
      resources.add(mesh.geometry);
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
        resources.add(m);
    });
    const spies = [...resources].map((resource) => vi.spyOn(resource, 'dispose'));
    wildlife.dispose();
    wildlife.dispose();
    advance(wildlife, frame({ zoom: 0.8, cloudsVisible: true }), 100);
    expect(scene.children).toHaveLength(0);
    expect(wildlife.state.fish + wildlife.state.gulls).toBe(0);
    spies.forEach((spy) => expect(spy).toHaveBeenCalledOnce());
    expect(wildlife.gulls.position).toEqual(new Vector3());
  });
});

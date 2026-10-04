import { describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { CASTLE_MODEL_URL, DecorModel } from './decor-model';

function mesh() {
  return new Mesh(new BoxGeometry(), new MeshStandardMaterial());
}

describe('castle Blender replacement', () => {
  it('replaces exactly one fallback, prepares curvature and disposes removed geometry', async () => {
    const loaded = mesh();
    const load = vi.fn(async () => loaded);
    const store = new DecorModel(load);
    const fallback = mesh();
    const dispose = vi.spyOn(fallback.geometry, 'dispose');
    const slot = new Group().add(fallback);
    const prepare = vi.fn();
    expect(await store.mount(slot, fallback, prepare)).toBe(true);
    expect(load).toHaveBeenCalledWith(CASTLE_MODEL_URL);
    expect(slot.children).toHaveLength(1);
    expect(slot.children[0]).not.toBe(fallback);
    expect(prepare).toHaveBeenCalledOnce();
    expect(dispose).toHaveBeenCalledOnce();
    store.destroy();
  });

  it('keeps the navigable procedural fallback if the local GLB fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = new DecorModel(async () => {
      throw new Error('missing GLB');
    });
    const fallback = mesh();
    const slot = new Group().add(fallback);
    expect(await store.mount(slot, fallback, vi.fn())).toBe(false);
    expect(slot.children).toEqual([fallback]);
    store.destroy();
    warn.mockRestore();
  });

  it('cannot insert late geometry after scene destruction and releases it', async () => {
    let resolve!: (value: Group) => void;
    const store = new DecorModel(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const fallback = mesh();
    const slot = new Group().add(fallback);
    const pending = store.mount(slot, fallback, vi.fn());
    store.destroy();
    const late = mesh();
    const dispose = vi.spyOn(late.geometry, 'dispose');
    resolve(new Group().add(late));
    expect(await pending).toBe(false);
    expect(slot.children).toEqual([fallback]);
    expect(dispose).toHaveBeenCalledOnce();
  });
});

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { WORLD_REGISTRY } from '@boia/world';
import { Group, Mesh, MeshLambertMaterial, SphereGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { repoRoot } from '../../../lib/barco/load';
import {
  ISLAND_MODEL_TUNING,
  ISLAND_MODELS_URL,
  islandGlow,
  islandGlowIntensity,
  islandModelUrl,
  islandScale,
  islandStates,
  loadIslandManifest,
  parseIslandManifest,
} from './island-models';
import { MODEL_TUNING, ModelStore } from './models';

/**
 * Las islas de Blender del mar 3D (T69): el manifiesto de
 * tools/blender/export_islas_glb.py, cómo se escala y brilla cada modelo y
 * que se cargan por distancia con su propio alcance.
 */

const ROOT = repoRoot();
const MANIFEST = path.join(ROOT, 'art/islas/3d/manifest.json');
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as unknown;
const entries = parseIslandManifest(manifest);

describe('el manifiesto de las islas', () => {
  it('cada isla con modelo es una isla del mapa en todos los mundos y su GLB existe', () => {
    expect(entries.size).toBeGreaterThan(0);
    for (const wid of WORLD_REGISTRY.ids()) {
      const islands = WORLD_REGISTRY.get(wid)
        .config.objects.filter((o) => o.identity.category === 'isla')
        .map((o) => o.identity.id);
      for (const id of entries.keys()) expect(islands).toContain(id);
    }
    for (const e of entries.values()) {
      expect(existsSync(path.join(ROOT, 'art/islas/3d', e.file))).toBe(true);
      expect(e.tris).toBeLessThanOrEqual((manifest as { max_tris: number }).max_tris);
      expect(e.height).toBeGreaterThan(e.top);
    }
  });

  it('la Isla de Halloween tiene el suyo', () => {
    expect(entries.get('halloween')?.file).toBe('halloween.glb');
  });

  it('lo que no encaja se ignora', () => {
    const m = parseIslandManifest({
      islas: [
        { id: 'a', file: 'a.glb', radius: 2 },
        { id: 'b', file: '../fuera.glb', radius: 2 },
        { id: 'c', file: 'c.glb', radius: 0 },
        null,
      ],
    });
    expect([...m.keys()]).toEqual(['a']);
    expect(parseIslandManifest(null).size).toBe(0);
  });

  it('sin manifiesto (204 o error de red), ninguna isla con modelo', async () => {
    expect((await loadIslandManifest(async () => new Response(null, { status: 204 }))).size).toBe(
      0,
    );
    expect(
      (
        await loadIslandManifest(async () => {
          throw new Error('sin red');
        })
      ).size,
    ).toBe(0);
    const ok = await loadIslandManifest(async (url) => {
      expect(url).toBe(`${ISLAND_MODELS_URL}/manifest.json?optional=1`);
      return new Response(JSON.stringify(manifest), { status: 200 });
    });
    expect([...ok.keys()]).toEqual([...entries.keys()]);
  });
});

describe('el modelo de una isla', () => {
  it('se escala para que su orilla caiga en el radio de la isla', () => {
    expect(islandScale({ radius: 7 }, 7)).toBe(1);
    expect(islandScale({ radius: 7 }, 14)).toBe(2);
  });

  it('lo emisivo brilla más de noche', () => {
    const glowing = new MeshLambertMaterial({ color: '#ff8a2a', emissive: '#ff8a2a' });
    const plain = new MeshLambertMaterial({ color: '#5b5470' });
    const g = new Group();
    g.add(new Mesh(new SphereGeometry(1), glowing), new Mesh(new SphereGeometry(1), plain));
    const set = islandGlow(g);
    set(0);
    const day = glowing.emissiveIntensity;
    set(1);
    expect(glowing.emissiveIntensity).toBe(islandGlowIntensity(1));
    expect(glowing.emissiveIntensity).toBeGreaterThan(day);
    expect(plain.emissive.getHex()).toBe(0);
  });

  it('se pide antes que las boias (las islas se ven desde más lejos)', () => {
    expect(ISLAND_MODEL_TUNING.preload).toBeGreaterThan(MODEL_TUNING.preload);
    expect(ISLAND_MODEL_TUNING.release).toBeGreaterThan(ISLAND_MODEL_TUNING.preload);
  });

  it('el almacén de modelos pide cada isla por su archivo', async () => {
    const urls: string[] = [];
    const store = new ModelStore<string>(
      async (url) => {
        urls.push(url);
        return new Group();
      },
      (id) => islandModelUrl(entries.get(id)!),
    );
    await store.acquire('halloween');
    expect(urls).toEqual([`${ISLAND_MODELS_URL}/halloween.glb`]);
    store.release('halloween');
    expect(store.loaded).toEqual([]);
  });

  it('`data-islas-modelo` lista «id:estado» por id', () => {
    expect(
      islandStates([
        ['ultima', 'procedural'],
        ['halloween', 'glb'],
      ]),
    ).toBe('halloween:glb ultima:procedural');
  });
});

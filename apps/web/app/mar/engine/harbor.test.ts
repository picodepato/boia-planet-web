import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { HARBOR_PLACE_ID, WORLD_REGISTRY } from '@boia/world';
import { Group } from 'three';
import { describe, expect, it } from 'vitest';
import { repoRoot } from '../../../lib/barco/load';
import { marWorld } from './compact';
import {
  ISLAND_MODELS_URL,
  PLACE_MODEL_IDS,
  PLACE_MODELS_URL,
  islandModelUrl,
  islandScale,
  loadIslandManifest,
  loadIslandModels,
  loadPlaceManifests,
  parsePlaceManifest,
} from './island-models';
import { HARBOR_LAYOUT, buildIsland, islandShores } from './islands';
import { ModelStore } from './models';
import { toScene } from './compress';

/**
 * El Puerto de Alicante en /mar (T108): el modelo de Blender de T107
 * (`art/places/3d/cala/`, contrato de `tools/blender/places/`) sustituye a
 * la isla entera; la composición a mano (lejos, mientras llega o si falla)
 * tiene su misma huella, y ni una ni otra llenan la dársena.
 */

const ROOT = repoRoot();
const DIR = path.join(ROOT, 'art/places/3d', HARBOR_PLACE_ID);
interface PlaceManifest {
  id: string;
  file: string;
  radius: number;
  height: number;
  tris: number;
  bytes: number;
  max_tris: number;
  max_bytes: number;
  units: string;
  bounds: { min: number[]; max: number[]; coordinate_system: string };
  approach: { side: string };
}
const manifest = JSON.parse(readFileSync(path.join(DIR, 'manifest.json'), 'utf8')) as PlaceManifest;
const entry = parsePlaceManifest(manifest, HARBOR_PLACE_ID)!;

/** El JSON de un GLB (su primer trozo). */
function glbJson(file: string): {
  nodes: {
    mesh?: number;
    matrix?: number[];
    translation?: number[];
    rotation?: number[];
    scale?: number[];
  }[];
  meshes: { primitives: { attributes: { POSITION: number }; material?: number }[] }[];
  accessors: { min?: number[]; max?: number[] }[];
  materials: { name: string }[];
  animations?: unknown[];
} {
  const b = readFileSync(file);
  const len = b.readUInt32LE(12);
  return JSON.parse(b.subarray(20, 20 + len).toString('utf8'));
}

const okJson = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe('el modelo del Puerto de Alicante: manifiesto y GLB (fuente y /mar)', () => {
  it('es un lugar con modelo propio y una isla del mapa en todos los mundos', () => {
    expect(PLACE_MODEL_IDS).toContain(HARBOR_PLACE_ID);
    for (const wid of WORLD_REGISTRY.ids()) {
      const o = WORLD_REGISTRY.get(wid).config.objects.find(
        (x) => x.identity.id === HARBOR_PLACE_ID,
      );
      expect(o?.identity.category, wid).toBe('isla');
    }
    for (const id of PLACE_MODEL_IDS) {
      expect(existsSync(path.join(ROOT, 'art/places/3d', id, 'manifest.json')), id).toBe(true);
    }
  });

  it('su manifiesto se lee tal cual: su GLB, su radio y su alto, dentro de los límites', () => {
    expect(entry).toMatchObject({
      id: HARBOR_PLACE_ID,
      file: manifest.file,
      url: `${PLACE_MODELS_URL}/${HARBOR_PLACE_ID}/${manifest.file}`,
      radius: manifest.radius,
      height: manifest.height,
      tris: manifest.tris,
    });
    expect(islandModelUrl(entry)).toBe(entry.url);
    const glb = path.join(DIR, manifest.file);
    expect(statSync(glb).size).toBe(manifest.bytes);
    expect(manifest.tris).toBeLessThanOrEqual(manifest.max_tris);
    expect(manifest.bytes).toBeLessThanOrEqual(manifest.max_bytes);
  });

  it('el GLB es lo que dice el manifiesto: frente +z, agua en y = 0, sin moverlo ni girarlo', () => {
    // /mar no gira el modelo (frente +z, hacia El Varadero): el contrato tiene que decir lo mismo.
    expect(manifest.units).toContain('front +Z');
    expect(manifest.approach.side).toBe('+Z in glTF');
    const j = glbJson(path.join(DIR, manifest.file));
    for (const n of j.nodes) {
      expect(n.matrix ?? n.translation ?? n.rotation ?? n.scale).toBeUndefined();
    }
    expect(j.animations ?? []).toEqual([]);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    let land: { min: number[]; max: number[] } | null = null;
    for (const m of j.meshes) {
      for (const p of m.primitives) {
        const a = j.accessors[p.attributes.POSITION]!;
        for (let i = 0; i < 3; i++) {
          min[i] = Math.min(min[i]!, a.min![i]!);
          max[i] = Math.max(max[i]!, a.max![i]!);
        }
        if (p.material !== undefined && j.materials[p.material]?.name === 'sand') {
          land = { min: a.min!, max: a.max! };
        }
      }
    }
    // Los límites del manifiesto están en Blender (z arriba, frente −y): (x, y, z) → (x, z, −y).
    const b = manifest.bounds;
    expect(b.coordinate_system).toBe('Blender Z up; front -Y');
    const gMin = [b.min[0]!, b.min[2]!, -b.max[1]!];
    const gMax = [b.max[0]!, b.max[2]!, -b.min[1]!];
    for (let i = 0; i < 3; i++) {
      expect(min[i]).toBeCloseTo(gMin[i]!, 4);
      expect(max[i]).toBeCloseTo(gMax[i]!, 4);
    }
    // La tierra es el semicírculo de atrás (z ≤ 0); delante, la dársena es agua.
    expect(land).not.toBeNull();
    expect(land!.max[2]!).toBeLessThanOrEqual(1e-6);
    // Y la composición a mano tiene la misma huella.
    expect(land!.max[0]!).toBeCloseTo(HARBOR_LAYOUT.land, 2);
    expect(-land!.min[2]!).toBeCloseTo(HARBOR_LAYOUT.land, 2);
    expect(land!.max[1]!).toBeCloseTo(HARBOR_LAYOUT.landTop, 3);
  });

  it('se escala al radio de colisión de su isla, como pide el contrato', () => {
    const world = marWorld(WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config);
    const o = world.objects.find((x) => x.identity.id === HARBOR_PLACE_ID)!;
    const R = toScene(o.geometry.collision!.radius);
    expect(islandScale(entry, R) * manifest.radius).toBeCloseTo(R, 9);
  });

  it('lo que no encaja se ignora y la isla se queda con su composición a mano', async () => {
    expect(parsePlaceManifest({ ...manifest, id: 'fotos' }, HARBOR_PLACE_ID)).toBeNull();
    expect(parsePlaceManifest({ ...manifest, kind: 'island-glb' }, HARBOR_PLACE_ID)).toBeNull();
    expect(parsePlaceManifest({ ...manifest, file: '../fuera.glb' }, HARBOR_PLACE_ID)).toBeNull();
    expect(parsePlaceManifest({ ...manifest, radius: 0 }, HARBOR_PLACE_ID)).toBeNull();
    expect(parsePlaceManifest({ ...manifest, height: undefined }, HARBOR_PLACE_ID)).toBeNull();
    expect(parsePlaceManifest(null, HARBOR_PLACE_ID)).toBeNull();
    const none = await loadPlaceManifests(
      [HARBOR_PLACE_ID],
      async () => new Response(null, { status: 204 }),
    );
    expect(none.size).toBe(0);
    const broken = await loadPlaceManifests([HARBOR_PLACE_ID], async () => {
      throw new Error('sin red');
    });
    expect(broken.size).toBe(0);
  });

  it('entra con las islas de Blender: un mapa con las de art/islas/3d y los lugares', async () => {
    const islands = JSON.parse(
      readFileSync(path.join(ROOT, 'art/islas/3d/manifest.json'), 'utf8'),
    ) as unknown;
    const asked: string[] = [];
    const get = async (url: string) => {
      asked.push(url);
      return url.startsWith(PLACE_MODELS_URL) ? okJson(manifest) : okJson(islands);
    };
    const all = await loadIslandModels(get);
    const only = await loadIslandManifest(async () => okJson(islands));
    expect([...all.keys()].sort()).toEqual([...only.keys(), HARBOR_PLACE_ID].sort());
    expect(asked).toContain(`${ISLAND_MODELS_URL}/manifest.json?optional=1`);
    expect(asked).toContain(`${PLACE_MODELS_URL}/${HARBOR_PLACE_ID}/manifest.json?optional=1`);
    // El almacén de modelos pide el GLB del lugar en su carpeta.
    const urls: string[] = [];
    const store = new ModelStore<string>(
      async (url) => {
        urls.push(url);
        return new Group();
      },
      (id) => islandModelUrl(all.get(id)!),
    );
    await store.acquire(HARBOR_PLACE_ID);
    expect(urls).toEqual([`${PLACE_MODELS_URL}/${HARBOR_PLACE_ID}/${manifest.file}`]);
    store.destroy();
  });
});

describe('la composición a mano del puerto (lejos, mientras llega o sin GLB)', () => {
  const R = 7.8;
  const build = buildIsland(HARBOR_PLACE_ID, R);

  it('ya no es la cala del horno: sin humo ni nada que se anime', () => {
    expect(build.animated).toEqual([]);
    expect(build.update).toBeUndefined();
  });

  it('cabe en la huella del modelo y deja la dársena de delante en agua', () => {
    const geo = build.parts.lit.build();
    geo.computeBoundingBox();
    const box = geo.boundingBox!;
    expect(Math.max(-box.min.x, box.max.x)).toBeLessThanOrEqual(R);
    expect(-box.min.z).toBeLessThanOrEqual(R);
    // Lo más adelantado son los muelles y los pantalanes, no tierra.
    expect(box.max.z).toBeLessThanOrEqual(0.6 * R);
    // En la dársena no hay suelo; atrás, la tierra.
    for (const [x, z] of HARBOR_LAYOUT.berths) expect(build.heightAt(x * R, z * R)).toBe(0);
    expect(build.heightAt(0, -0.6 * R)).toBeCloseTo(HARBOR_LAYOUT.landTop * R, 6);
  });

  it('su orilla (bajío y espuma) sólo bajo la tierra de atrás, nunca en la dársena', () => {
    const shores = islandShores(build, R);
    expect(shores.length).toBeGreaterThan(0);
    for (const s of shores) {
      expect(s.dz + s.r).toBeLessThanOrEqual(1e-9);
      expect(Math.hypot(s.dx, s.dz) + s.r).toBeLessThanOrEqual(HARBOR_LAYOUT.land * R + 1e-9);
    }
  });

  it('las demás islas conservan su orilla redonda', () => {
    const other = buildIsland('tienda', R);
    expect(islandShores(other, R)).toEqual([{ dx: 0, dz: 0, r: R, w: Math.min(11, 3 + R * 0.7) }]);
  });
});

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { CALITAS_PLACE_ID, LIGHTHOUSE_PLACE_ID, WORLD_REGISTRY } from '@boia/world';
import { Group, Mesh, MeshLambertMaterial, SphereGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { repoRoot } from '../../../lib/barco/load';
import { DECOR_SIZE, marWorld } from './compact';
import { toScene } from './compress';
import { FARO_LANTERN, buildIsland } from './islands';
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

  it('las boias de las islas llevan el trazo negro del logo (T231: mascota.outline_parts)', () => {
    // Los materiales del GLB (el JSON de su primer trozo): la tinta del contorno es la de «ink» con «_contorno»,
    // de una cara (casco invertido: sólo asoma el borde).
    const materials = (file: string) => {
      const buf = readFileSync(path.join(ROOT, 'art/islas/3d', file));
      const len = buf.readUInt32LE(12);
      const gltf = JSON.parse(buf.subarray(20, 20 + len).toString('utf8')) as {
        materials: { name: string; doubleSided?: boolean }[];
      };
      return gltf.materials;
    };
    let withMascot = 0;
    for (const e of entries.values()) {
      const mats = materials(e.file);
      if (!mats.some((m) => m.name.startsWith('mascota_gltf') || m.name.startsWith('hw_ghost_gltf'))) continue;
      withMascot++;
      const rim = mats.find((m) => m.name === 'ink_gltf_contorno');
      expect(rim, e.id).toBeDefined();
      expect(rim!.doubleSided ?? false, e.id).toBe(false);
    }
    expect(withMascot).toBe(entries.size);
  });

  it('la Isla de Halloween tiene el suyo', () => {
    expect(entries.get('halloween')?.file).toBe('halloween.glb');
  });

  it('el Puig Campana, la isla del Cañón (plan 019, T221), tiene el suyo con el id de su lugar', () => {
    // El módulo se llama como la montaña; su `ID` es el del lugar del mapa y nombra el GLB.
    const source = readFileSync(path.join(ROOT, 'tools/blender/islas/puigcampana.py'), 'utf8');
    const id = /^ID = "([a-z0-9-]+)"/m.exec(source)?.[1];
    const label = /^LABEL = "([^"]+)"/m.exec(source)?.[1];
    expect(id).toBe('canon');
    const entry = entries.get(id!);
    expect(entry?.file).toBe(`${id}.glb`);
    expect(entry?.label).toBe(label);
    // La montaña es la protagonista: el modelo es tan alto como ancho (su radio).
    expect(entry!.height).toBeGreaterThan(entry!.radius);
  });

  it('Las Calitas, la isla de los comentarios (REQ-IDE-054, plan 020 T232), tiene el suyo con el nombre de su lugar', () => {
    const source = readFileSync(path.join(ROOT, 'tools/blender/islas/calitas.py'), 'utf8');
    const id = /^ID = "([a-z0-9-]+)"/m.exec(source)?.[1];
    const label = /^LABEL = "([^"]+)"/m.exec(source)?.[1];
    expect(id).toBe(CALITAS_PLACE_ID);
    const entry = entries.get(id!);
    expect(entry?.file).toBe(`${id}.glb`);
    expect(entry?.label).toBe(label);
    // El nombre del modelo es el del lugar en el mapa.
    const place = WORLD_REGISTRY.get('arcilla').places.find((p) => p.id === CALITAS_PLACE_ID);
    expect(place?.name).toBe(label);
    // El bocadillo del tablón brilla de noche: el GLB tiene su material emisivo.
    const buf = readFileSync(path.join(ROOT, 'art/islas/3d', entry!.file));
    const gltf = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8')) as {
      materials: { name: string; emissiveFactor?: number[] }[];
    };
    const bubble = gltf.materials.find((m) => m.name.startsWith('lc_bubble'));
    expect(bubble?.emissiveFactor?.some((c) => c > 0)).toBe(true);
  });

  describe('el Faro de Tabarca (plan 014, T166)', () => {
    const faro = entries.get(LIGHTHOUSE_PLACE_ID);
    // Las medidas del módulo de Blender, tal cual están escritas en su fuente.
    const source = readFileSync(path.join(ROOT, 'tools/blender/islas/faro.py'), 'utf8');
    const constant = (name: string) => {
      const m = new RegExp(`^${name} = ([0-9.]+)`, 'm').exec(source);
      expect(m, `${name} en tools/blender/islas/faro.py`).not.toBeNull();
      return Number(m![1]);
    };

    it('tiene su modelo, con el radio de su módulo de Blender y la linterna por encima de la casa', () => {
      expect(faro?.file).toBe(`${LIGHTHOUSE_PLACE_ID}.glb`);
      expect(faro?.radius).toBe(constant('RADIUS'));
      // El faro es el protagonista: el modelo es más alto que ancho (su radio).
      expect(faro!.height).toBeGreaterThan(faro!.radius * 1.5);
      expect(faro!.height).toBeGreaterThan(constant('LANTERN_Z'));
    });

    it('la composición de a mano pone el haz donde el modelo tiene la linterna', () => {
      expect(FARO_LANTERN.radius).toBe(constant('RADIUS'));
      expect(FARO_LANTERN.z).toBe(constant('LANTERN_Z'));
    });

    it('a su escala en /mar, el faro pesa en la vista como el castillo de antes', () => {
      const place = marWorld(WORLD_REGISTRY.get('arcilla').config).objects.find(
        (o) => o.identity.id === LIGHTHOUSE_PLACE_ID,
      )!;
      // Un solo círculo: el modelo se escala por él y el juego del castillo lo normaliza por él.
      expect(place.geometry.collisionParts).toBeUndefined();
      const R = toScene(place.geometry.collision!.radius);
      const top = faro!.height * islandScale(faro!, R);
      expect(top).toBeGreaterThan(DECOR_SIZE.castillo);
      expect(top).toBeLessThan(DECOR_SIZE.castillo * 1.6);
      // El haz de a mano (`keep`) queda en la linterna con el modelo puesto.
      const build = buildIsland(LIGHTHOUSE_PLACE_ID, R);
      expect(build.keep?.length).toBe(1);
      expect(build.keep![0]!.position.y).toBeCloseTo(FARO_LANTERN.z * islandScale(faro!, R), 5);
    });
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

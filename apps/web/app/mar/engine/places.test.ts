import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { repoRoot } from '../../../lib/barco/load';
import { marWorld, periodOfWorld } from './compact';
import { toScene } from './compress';
import {
  PLACE_MODEL_IDS,
  PLACE_MODELS_URL,
  islandModelUrl,
  islandScale,
  parsePlaceManifest,
} from './island-models';
import { BENIDORM_LAYOUT, IBIZA_LAYOUT, buildIsland, islandShores } from './islands';
import { modelLabelY } from './labels';
import { shortest } from './wrap';

/**
 * Benidorm (`fotos`) e Ibiza (`tienda`) en /mar (T112): sus modelos de
 * Blender (T110, T111; `art/places/3d/<id>/`) entran como el Puerto de
 * Alicante (T108): sustituyen a la isla entera, escalados a su radio de
 * colisión, que no cambia; su composición a mano (lejos, mientras llega o
 * si falla el GLB) tiene su misma silueta y el rótulo a la misma altura.
 */

const ROOT = repoRoot();
const PLACES = ['fotos', 'tienda'] as const;
const LAYOUT = { fotos: BENIDORM_LAYOUT, tienda: IBIZA_LAYOUT } as const;
const world = marWorld(WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config);
const period = periodOfWorld(world);
const objectOf = (id: string) => world.objects.find((o) => o.identity.id === id)!;
const manifestOf = (id: string) =>
  JSON.parse(readFileSync(path.join(ROOT, 'art/places/3d', id, 'manifest.json'), 'utf8')) as Record<
    string,
    unknown
  > & {
    file: string;
    radius: number;
    height: number;
    tris: number;
    bytes: number;
    max_tris: number;
    max_bytes: number;
    units: string;
    approach: { side: string };
  };
/** Hasta dónde llega la colisión de un lugar desde su centro (u de motor), con sus lóbulos. */
const extent = (o: (typeof world.objects)[number]) =>
  Math.max(
    o.geometry.collision!.radius,
    ...(o.geometry.collisionParts ?? []).map((c) => Math.hypot(c.dx, c.dy) + c.radius),
  );
/** El radio de la isla en escena: al que se escala su modelo (`buildPlaces`). */
const sceneR = (id: string) => toScene(objectOf(id).geometry.collision!.radius);

describe.each(PLACES)('el modelo de %s en /mar', (id) => {
  const manifest = manifestOf(id);
  const entry = parsePlaceManifest(manifest, id)!;
  const R = sceneR(id);

  it('es un lugar con modelo propio: su manifiesto se lee y su GLB está dentro de los límites', () => {
    expect(PLACE_MODEL_IDS).toContain(id);
    expect(objectOf(id).identity.category).toBe('isla');
    expect(entry).toMatchObject({ id, file: manifest.file, height: manifest.height });
    expect(islandModelUrl(entry)).toBe(`${PLACE_MODELS_URL}/${id}/${manifest.file}`);
    const glb = path.join(ROOT, 'art/places/3d', id, manifest.file);
    expect(statSync(glb).size).toBe(manifest.bytes);
    expect(manifest.tris).toBeLessThanOrEqual(manifest.max_tris);
    expect(manifest.bytes).toBeLessThanOrEqual(manifest.max_bytes);
    // /mar no lo gira ni lo mueve: frente +z, agua en y = 0.
    expect(manifest.units).toContain('front +Z');
    expect(manifest.approach.side).toBe('+Z in glTF');
  });

  it('se escala a su radio de colisión, que sigue siendo el del mapa', () => {
    expect(islandScale(entry, R) * manifest.radius).toBeCloseTo(R, 9);
  });

  it('su composición a mano no se anima, cabe en su huella y llega a su alto', () => {
    const build = buildIsland(id, R);
    expect(build.animated).toEqual([]);
    expect(build.update).toBeUndefined();
    const geo = build.parts.lit.build();
    geo.computeBoundingBox();
    const box = geo.boundingBox!;
    const top = manifest.height * (R / manifest.radius);
    expect(box.max.y).toBeLessThanOrEqual(top + 1e-6);
    expect(box.max.y).toBeGreaterThan(top * 0.9);
    expect(LAYOUT[id].height).toBe(manifest.height);
    // Lo que asoma sobre el agua no pasa de su orilla (la de a mano, irregular y con
    // sus rocas, como la de todas las islas: hasta 1.15 R, lo que /mar aparta a la fauna).
    const pos = geo.attributes.position!;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) <= 0.2) continue;
      expect(Math.hypot(pos.getX(i), pos.getZ(i))).toBeLessThanOrEqual(R * 1.15);
    }
  });

  it('su rótulo va a la misma altura con el modelo o sin él', () => {
    const build = buildIsland(id, R);
    expect(build.labelY).toBeCloseTo(modelLabelY(entry, R)!, 9);
  });

  it('su orilla es la redonda de siempre (su colisión no cambia)', () => {
    expect(islandShores(buildIsland(id, R), R)).toEqual([
      { dx: 0, dz: 0, r: R, w: Math.min(11, 3 + R * 0.7) },
    ]);
  });

  it('se llega por fuera: la proximidad abarca la colisión y nada choca al dar la vuelta', () => {
    const o = objectOf(id);
    const reach = o.geometry.proximityRadius!;
    // La colisión del mapa con sus lóbulos (la elipse; Ibiza, a 45°) cabe en la proximidad.
    expect(reach).toBeGreaterThan(extent(o));
    // Por el camino más corto del planeta, a ninguna otra isla le pisa la huella.
    for (const other of world.objects) {
      if (other.identity.id === id || other.identity.category !== 'isla') continue;
      const d = shortest(o.position, other.position, period);
      const gap = Math.hypot(d.dx, d.dy) - extent(o) - extent(other);
      expect(gap, `${id} – ${other.identity.id}`).toBeGreaterThan(0);
    }
  });
});

describe('Ibiza sigue siendo la tienda', () => {
  it('su contenido es el escaparate de la tienda y no se mueve nada en ella', () => {
    const raw = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config.objects.find(
      (o) => o.identity.id === 'tienda',
    )!;
    expect(JSON.stringify(raw)).toContain('"target":"store"');
    expect(parsePlaceManifest(manifestOf('tienda'), 'tienda')!.motion).toEqual([]);
  });
});

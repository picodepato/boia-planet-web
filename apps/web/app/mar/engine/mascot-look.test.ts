import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BackSide, CanvasTexture, Mesh, MeshBasicMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { MASCOT_COLORS, MASCOT_OUTLINE, createMascot } from './characters';
import { MODEL_FILES } from './models';
import { C } from './palette';

/**
 * T220: la boia se parece a la mascota del logo (art/marca/boia-mascota.svg):
 * el trazo negro alrededor, el gorro azul marino y, en la carga del mundo y en
 * la portada, la propia mascota del logo.
 */

const ROOT = join(__dirname, '..', '..', '..', '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

describe('la mascota a mano (capitana, Fiestera y boia mientras llega su modelo)', () => {
  const face = new CanvasTexture({} as HTMLCanvasElement);

  it('lleva el contorno negro del logo: casco invertido de la bola y del gorro', () => {
    for (const cap of ['beanie', 'party'] as const) {
      const g = createMascot(face, { cap });
      const rims = g.children.filter(
        (o): o is Mesh => o instanceof Mesh && o.material instanceof MeshBasicMaterial && o.material.side === BackSide,
      );
      // La bola y el gorro.
      expect(rims.length).toBe(2);
      for (const m of rims) expect((m.material as MeshBasicMaterial).color.getHexString()).toBe(MASCOT_COLORS.ink.slice(1));
      const ball = rims.find((m) => m.geometry.type === 'SphereGeometry')!;
      expect(ball.scale.x).toBeCloseTo(1 + MASCOT_OUTLINE);
    }
  });

  it('el gorro es el azul marino de la marca y ya no lleva bracitos', () => {
    expect(MASCOT_COLORS.cap).toBe(C.purple);
    expect(MASCOT_COLORS.body).toBe(C.orange);
    const g = createMascot(face, { cap: 'beanie' });
    // Bola, su contorno, las piezas (gorro y agujero) y el contorno del gorro.
    expect(g.children.length).toBe(4);
  });
});

/** Las cajas de las mallas de un GLB por material (POSITION min/max de sus primitivas). */
function boxesByMaterial(file: string): Map<string, { min: number[]; max: number[] }> {
  const buf = readFileSync(join(ROOT, 'art', 'barco', '3d', file));
  const len = buf.readUInt32LE(12);
  const gltf = JSON.parse(buf.subarray(20, 20 + len).toString('utf8')) as {
    materials: { name: string }[];
    meshes: { primitives: { attributes: { POSITION: number }; material: number }[] }[];
    accessors: { min?: number[]; max?: number[] }[];
  };
  const out = new Map<string, { min: number[]; max: number[] }>();
  for (const mesh of gltf.meshes) {
    for (const p of mesh.primitives) {
      const a = gltf.accessors[p.attributes.POSITION]!;
      const name = gltf.materials[p.material]!.name;
      const b = out.get(name) ?? { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
      for (let i = 0; i < 3; i++) {
        b.min[i] = Math.min(b.min[i]!, a.min![i]!);
        b.max[i] = Math.max(b.max[i]!, a.max![i]!);
      }
      out.set(name, b);
    }
  }
  return out;
}

describe('las boias de Blender (tools/blender/mascota.py, outline=True)', () => {
  it('cada una lleva el trazo de tinta por fuera del cuerpo naranja', () => {
    for (const file of Object.values(MODEL_FILES)) {
      const boxes = boxesByMaterial(file);
      const body = [...boxes].find(([n]) => n.startsWith('mascota_gltf'))?.[1];
      const ink = [...boxes].find(([n]) => n.startsWith('ink_gltf'))?.[1];
      expect(body, file).toBeDefined();
      expect(ink, file).toBeDefined();
      // Arriba (y del glTF) el contorno asoma por encima del cuerpo.
      expect(ink!.max[1]! - body!.max[1]!, file).toBeGreaterThan(0.01);
    }
  });
});

describe('la boia de la carga del mundo y de la portada', () => {
  it('es la mascota del logo, no una bola dibujada en CSS', () => {
    const rule = (css: string, cls: string) => css.slice(css.indexOf(`.${cls} {`)).split('}')[0]!;
    const mar = read('apps/web/app/mar/mar.css');
    const landing = read('apps/web/app/(landing)/landing.css');
    expect(rule(mar, 'mar-splash__boia')).toContain("url('../(landing)/_marca/boia-mascota.svg')");
    expect(rule(landing, 'intro-cover__boia')).toContain("url('./_marca/boia-mascota.svg')");
    expect(mar).not.toContain('.mar-splash__boia::before');
    expect(landing).not.toContain('.intro-cover__boia::before');
  });
});

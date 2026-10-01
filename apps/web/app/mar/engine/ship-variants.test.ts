import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Color } from 'three';
import { describe, expect, it } from 'vitest';
import { loadShipCatalog, repoRoot } from '../../../lib/barco/load';
import { type ShipModelEntry, rotateHue, withShipVariants } from './ship-model';

/**
 * El barco exclusivo de la Fiestera en el mar 3D (T59): una variante del
 * catálogo sin arte nuevo, con el GLB de su estilo en su skin y el tono
 * girado. Contra el manifiesto 3D y el registro de verdad.
 */

const ROOT = repoRoot();
const manifest = JSON.parse(
  readFileSync(path.join(ROOT, 'art/barco/3d/manifest.json'), 'utf8'),
) as { barcos: ShipModelEntry[] };
const catalog = loadShipCatalog(ROOT)!;
const variants = catalog.styles.filter((s) => s.variant);

describe('variantes del barco en 3D (T59)', () => {
  it('cada variante usa el GLB de su estilo en su skin, con su giro de tono', () => {
    expect(variants.length).toBeGreaterThan(0);
    const list = withShipVariants(manifest.barcos, catalog);
    expect(list.slice(0, manifest.barcos.length)).toEqual(manifest.barcos);
    for (const v of variants) {
      const entry = list.find((b) => b.id === v.id)!;
      const base = manifest.barcos.find((b) => b.id === v.variant!.of)!;
      expect(entry.file).toBe(base.skins?.[v.variant!.skin]);
      expect(entry.skins).toEqual({ base: entry.file });
      expect(entry.slot).toEqual(base.slot);
      expect(entry.hue).toBe(v.variant!.hue);
    }
    // Sin catálogo o sin el estilo del que sale, no se añade nada.
    expect(withShipVariants(manifest.barcos, null)).toEqual(manifest.barcos);
    expect(withShipVariants([], catalog)).toEqual([]);
  });

  it('girar el tono cambia el color y conserva saturación y luz', () => {
    const c = new Color('#3a9a4a');
    const before = c.getHSL({ h: 0, s: 0, l: 0 });
    const after = rotateHue(c.clone(), 210).getHSL({ h: 0, s: 0, l: 0 });
    expect(after.h).toBeCloseTo((before.h + 210 / 360) % 1, 2);
    expect(after.s).toBeCloseTo(before.s, 2);
    expect(after.l).toBeCloseTo(before.l, 2);
    expect(rotateHue(new Color('#3a9a4a'), 360).getHexString()).toBe('3a9a4a');
  });
});

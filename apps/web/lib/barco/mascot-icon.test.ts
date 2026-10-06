import { SAMPLE_COSMETICS } from '@boia/store';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CANONCITO_COLORS, MASCOT_KINDS, TORTUGA_COLORS } from './dressing';
import { MascotIcon } from './mascot-icon';
import { resolveRef, scriptConstants, toHex } from './python-constants';

const REPO = path.resolve(__dirname, '../../../..');

/**
 * Los dibujos de Mi Barco (T154, T175): cada mascota del catálogo tiene el
 * suyo, y los colores del Cañoncito y de la Tortuga turbo son los `ROLES`
 * de sus scripts de Blender (no se copian a mano sin más).
 */
describe('MascotIcon', () => {
  it('cada mascota del catálogo tiene dibujo; una desconocida, nada', () => {
    for (const c of SAMPLE_COSMETICS.filter((x) => x.slot === 'mascot')) {
      const svg = renderToStaticMarkup(createElement(MascotIcon, { id: c.id }));
      expect(svg, c.id).toContain(`data-mascota="${c.id}"`);
      expect(MASCOT_KINDS[c.id], c.id).toBeDefined();
    }
    expect(renderToStaticMarkup(createElement(MascotIcon, { id: 'mascota-que-no-existe' }))).toBe('');
  });

  it.each([
    ['canoncito.py', CANONCITO_COLORS, { wood: 'cn_wood', woodDark: 'cn_wood_dark', iron: 'cn_iron', ironDark: 'cn_iron_dark', band: 'cn_band', hub: 'cn_hub', spark: 'cn_spark' }],
    ['tortuga_turbo.py', TORTUGA_COLORS, { shell: 'tt_shell', plate: 'tt_plate', rim: 'tt_rim', skin: 'tt_skin', stripe: 'tt_stripe', goggle: 'tt_goggle', lens: 'tt_lens' }],
  ] as const)('los colores del dibujo son los ROLES de tools/blender/mascotas/%s', (file, colors, roles) => {
    const src = readFileSync(path.join(REPO, 'tools/blender/mascotas', file), 'utf8');
    const env = scriptConstants(src);
    for (const [key, role] of Object.entries(roles)) {
      expect(toHex(resolveRef(env, ['ROLES', role])).toLowerCase(), role).toBe(
        (colors as Record<string, string>)[key]!.toLowerCase(),
      );
    }
  });
});

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACUARELA_NAMES,
  ACUARELA_WORLD_ID,
} from '../../../../packages/world/src/worlds/acuarela/skin';
import { es } from '../i18n/es';
import { worlds } from './demo-world';

/**
 * La piel de Acuarela lleva claves i18n (plan 032 T303): su texto es el de
 * `mundos/acuarela/lugares.json` y el catálogo lo resuelve entero.
 */
const ROOT = path.resolve(__dirname, '../../../..');
const lugares = JSON.parse(
  readFileSync(path.join(ROOT, 'mundos/acuarela/lugares.json'), 'utf8'),
) as { lugares: { id: string; nombre: string }[] };

describe('textos de la piel de Acuarela', () => {
  it('los nombres propios son los de lugares.json', () => {
    for (const [id, key] of Object.entries(ACUARELA_NAMES)) {
      expect(key in es, `${id}: ${key}`).toBe(true);
      const src = lugares.lugares.find((l) => l.id === id || id.startsWith(`${l.id}-`));
      if (src) expect(es[key as keyof typeof es], id).toBe(src.nombre);
    }
  });

  it('el registro de la web no deja claves sin resolver', () => {
    const skin = worlds.skin(ACUARELA_WORLD_ID);
    const texts = [
      skin.name,
      skin.tagline ?? '',
      ...Object.values(skin.names),
      ...Object.values(skin.places).flatMap((p) => [
        ...Object.values(p.texts ?? {}),
        ...(p.lines ?? []).map((l) => l.text),
      ]),
    ];
    for (const t of texts) expect(t).not.toMatch(/^world\.acuarela\./);
  });
});

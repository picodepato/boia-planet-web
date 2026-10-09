import { ARCILLA_SKIN, WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { es } from '../i18n/es';
import { translateSkinText, worlds } from './demo-world';

/** Todos los textos visibles de una skin (nombre, historia, nombres, bocadillos, paneles). */
function visibleTexts(skin: typeof ARCILLA_SKIN): string[] {
  const parsed = WORLD_REGISTRY.skin(skin.id);
  return [
    parsed.name,
    ...(parsed.tagline ? [parsed.tagline] : []),
    ...Object.values(parsed.names),
    ...Object.values(parsed.places).flatMap((p) => [
      ...Object.values(p.texts ?? {}),
      ...(p.lines ?? []).map((l) => l.text),
    ]),
  ];
}

describe('textos de la skin de Arcilla en el catálogo i18n (plan 017, T195)', () => {
  it('cada texto de la skin es una clave del catálogo', () => {
    const notKeys = visibleTexts(ARCILLA_SKIN).filter((s) => !(s in es));
    expect(notKeys).toEqual([]);
  });

  it('el registro de la web enseña el texto de cada clave', () => {
    const skin = worlds.skin(ARCILLA_SKIN.id);
    const resolved = visibleTexts(ARCILLA_SKIN).map(translateSkinText);
    expect(resolved).toEqual([
      skin.name,
      ...(skin.tagline ? [skin.tagline] : []),
      ...Object.values(skin.names),
      ...Object.values(skin.places).flatMap((p) => [
        ...Object.values(p.texts ?? {}),
        ...(p.lines ?? []).map((l) => l.text),
      ]),
    ]);
    expect(resolved.filter((s) => s in es)).toEqual([]);
  });

  it('un texto que no es clave (Admin, Acuarela) se queda como está', () => {
    expect(translateSkinText('Un nombre escrito en el Admin')).toBe(
      'Un nombre escrito en el Admin',
    );
  });
});

/** Todos los textos visibles del mapa compartido (sectores, nombres de lugar, bocadillos de sus diálogos). */
function mapTexts(map: typeof WORLD_REGISTRY.map): string[] {
  return [
    ...map.sectors.map((s) => s.name),
    ...map.places.flatMap((p) => [
      p.name,
      ...p.behaviors.flatMap((b) =>
        b.type === 'dialogue' ? b.params.lines.map((l) => l.text) : [],
      ),
    ]),
  ];
}

describe('textos del mapa compartido en el catálogo i18n (plan 022, T242)', () => {
  it('cada texto del mapa es una clave del catálogo', () => {
    const notKeys = mapTexts(WORLD_REGISTRY.map).filter((s) => !(s in es));
    expect(notKeys).toEqual([]);
  });

  it('el registro de la web enseña el texto de cada clave del mapa', () => {
    expect(mapTexts(worlds.map)).toEqual(mapTexts(WORLD_REGISTRY.map).map(translateSkinText));
    expect(mapTexts(worlds.map).filter((s) => s in es)).toEqual([]);
  });
});

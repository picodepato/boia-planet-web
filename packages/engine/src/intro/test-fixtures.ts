import { SAMPLE_WORLD, parseWorldConfig } from '@boia/world';
import { readFileSync } from 'node:fs';
import { INTRO_MANIFEST_IDS, resolveIntroAssets, type IntroAssets } from './assets';
import { DEFAULT_INTRO_CONFIG, type IntroConfig } from './config';
import type { IntroGeometry } from './sphere';
import { worldIntroGeometry } from './world-geometry';

/** Sólo pruebas: los manifiestos reales de `art/`, leídos del disco. */
export function readArtManifests(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const id of INTRO_MANIFEST_IDS) {
    const url = new URL(`../../../../art/${id}/manifest.json`, import.meta.url);
    out[id] = JSON.parse(readFileSync(url, 'utf8'));
  }
  return out;
}

export function realAssets(): IntroAssets {
  const r = resolveIntroAssets(readArtManifests(), '/api/art', DEFAULT_INTRO_CONFIG);
  if (!r.ok) throw new Error(r.error);
  return r.assets;
}

/** El mundo de muestra de `@boia/world` (el de la demo). */
export const sampleWorld = () => parseWorldConfig(SAMPLE_WORLD);

/** Geometría del mini-mundo para el mundo de muestra, como la calcula la web. */
export function realGeometry(config: IntroConfig = DEFAULT_INTRO_CONFIG): IntroGeometry {
  const g = worldIntroGeometry(sampleWorld(), config, realAssets().artScale);
  if (!g) throw new Error('punto de aterrizaje fuera del mundo');
  return g;
}

/**
 * El arte de `art/` leído del disco (T47), para las herramientas de Node que
 * no pasan por `/api/art`: el constructor de atlas y el presupuesto de bytes.
 * Se ejecuta con `node --import ./packages/world/scripts/ts-resolve.mjs`.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type ArtManifest,
  type WorldConfig,
  parseArtManifest,
  parseAssetRef,
  placePartArt,
} from '../../packages/world/src/index';
import { worldAssetIds } from '../../packages/engine/src/streaming';

export const REPO = fileURLToPath(new URL('../../', import.meta.url));
export const ART = path.join(REPO, 'art');

const raw = new Map<string, ArtManifest | null>();

function readBase(base: string): ArtManifest | null {
  if (!raw.has(base)) {
    let m: ArtManifest | null = null;
    try {
      const r = parseArtManifest(JSON.parse(readFileSync(path.join(ART, base, 'manifest.json'), 'utf8')));
      if (r.ok) m = r.manifest;
    } catch {
      m = null;
    }
    raw.set(base, m);
  }
  return raw.get(base)!;
}

/** Los manifiestos de los assets de un mundo, por id (con las piezas de lugar resueltas). */
export function worldManifests(world: WorldConfig): Map<string, ArtManifest> {
  const out = new Map<string, ArtManifest>();
  for (const id of worldAssetIds(world)) {
    const ref = parseAssetRef(id);
    const m = readBase(ref.base);
    if (!m) continue;
    const got = ref.part ? placePartArt(m, ref.part, ref.variant) : m;
    if (got) out.set(id, got);
  }
  return out;
}

/** Bytes del manifiesto de la carpeta de un asset (se pide una vez por carpeta). */
export function manifestBytes(base: string): number {
  try {
    return readFileSync(path.join(ART, base, 'manifest.json')).length;
  } catch {
    return 0;
  }
}

export function artPath(key: string): string {
  return path.join(ART, key);
}

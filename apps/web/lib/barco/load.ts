import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { buildShipCatalog, type ShipCatalog, type ShipRegistry } from './catalog';

/**
 * Sólo servidor (al construir el 2D): lee `art/barco`, `docs/barcos/barcos.json`
 * y los scripts de Blender que nombra el registro. Si falta el arte del barco,
 * `null`: el juego sigue con el barco provisional y la sección no ofrece estilos.
 */

/** Raíz del monorepo: la carpeta con `pnpm-workspace.yaml` (desde apps/web o desde la raíz). */
export function repoRoot(from = process.cwd()): string {
  let dir = path.resolve(from);
  while (!existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
    const up = path.dirname(dir);
    if (up === dir) return path.resolve(from, '../..');
    dir = up;
  }
  return dir;
}

const readJson = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8'));

export function loadShipCatalog(root = repoRoot()): ShipCatalog | null {
  const shipDir = path.join(root, 'art', 'barco');
  let rootManifest: unknown;
  try {
    rootManifest = readJson(path.join(shipDir, 'manifest.json'));
  } catch {
    return null;
  }
  const variants = ((rootManifest as { style_variants?: unknown }).style_variants ?? []) as {
    manifest?: string;
  }[];
  const styleManifests: Record<string, unknown> = {};
  for (const v of variants) {
    if (!v.manifest) continue;
    try {
      styleManifests[v.manifest] = readJson(path.join(shipDir, v.manifest));
    } catch {
      // Sin manifiesto, el estilo no se ofrece.
    }
  }
  let registry: ShipRegistry = { barcos: [] };
  try {
    registry = readJson(path.join(root, 'docs', 'barcos', 'barcos.json')) as ShipRegistry;
  } catch {
    console.warn('[boia] sin docs/barcos/barcos.json: los estilos salen con el rótulo del arte');
  }
  const scripts: Record<string, string> = {};
  for (const b of registry.barcos) {
    try {
      scripts[b.script] = readFileSync(path.join(root, b.script), 'utf8');
    } catch {
      // Sin script, el estilo sale sin muestras de color.
    }
  }
  return buildShipCatalog({ root: rootManifest, styleManifests, registry, scripts });
}

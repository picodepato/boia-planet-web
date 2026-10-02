/**
 * Presupuesto de REQ-ARQ-014 (T47): bytes de arte que /juego descarga antes
 * de poder jugar, por mundo, con el barco en el puerto (el `spawn`). Suma lo
 * que pide el motor (`startArt`): las hojas de los sectores a la vista (o los
 * PNG sueltos si no hay atlas), las costas, los manifiestos de esas carpetas
 * y las vistas del barco del mundo. Sin gzip (PNG y WebP ya van
 * comprimidos) y con todas las animaciones del barco: es una cota por arriba.
 * El JavaScript no entra aquí; la e2e de T47 mide lo transferido de verdad.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { type AtlasIndex, parseAtlasIndex, sectorSheets, startArt } from '../../packages/engine/src/streaming';
import { readShipStyleIndex, resolveShipStyle } from '../../packages/engine/src/ship-style';
import {
  DIRECTIONS,
  WORLD_REGISTRY,
  type WorldRegistry,
  findShipAnimation,
  findShipImage,
  parseAssetRef,
  parseShipManifest,
} from '../../packages/world/src/index';
import { ART, REPO, artPath, manifestBytes, worldManifests } from './art-fs';

/** 5 MB del primer sector (REQ-ARQ-014). */
export const FIRST_SECTOR_BUDGET = 5 * 1024 * 1024;
export const ATLAS_DIR = path.join(REPO, 'apps/web/public/atlas');

export interface BudgetRow {
  world: string;
  /** Con qué se sirve: atlas por sector o los PNG sueltos. */
  mode: 'atlas' | 'png';
  sectors: string[];
  objects: number;
  art: number;
  manifests: number;
  ship: number;
  total: number;
}

const size = (p: string) => (existsSync(p) ? statSync(p).size : 0);

/** Bytes del barco de un estilo y skin: sus 8 vistas, con pasajera y con su bamboleo. */
export function shipBytes(style: string, skin: string | undefined): number {
  const rootPath = path.join(ART, 'barco/manifest.json');
  if (!existsSync(rootPath)) return 0;
  const root: unknown = JSON.parse(readFileSync(rootPath, 'utf8'));
  const option = resolveShipStyle(readShipStyleIndex(root), style);
  const manifestPath = path.join(ART, 'barco', option.manifest);
  const parsed = parseShipManifest(JSON.parse(readFileSync(manifestPath, 'utf8')));
  if (!parsed.ok) return size(rootPath);
  const m = parsed.manifest;
  const s = skin ?? 'base';
  const files = new Set<string>();
  for (const d of DIRECTIONS) {
    for (const passenger of [false, true]) {
      const img = findShipImage(m, s, d, passenger);
      if (img) files.add(img.file);
    }
    for (const b of findShipAnimation(m, 'bob', s, d, false)) files.add(b.file);
  }
  const dir = path.dirname(manifestPath);
  let total = size(rootPath) + (manifestPath === rootPath ? 0 : size(manifestPath));
  for (const f of files) total += size(path.join(dir, f));
  return total;
}

export function readAtlasIndex(dir = ATLAS_DIR): AtlasIndex | null {
  try {
    return parseAtlasIndex(JSON.parse(readFileSync(path.join(dir, 'index.json'), 'utf8')));
  } catch {
    return null;
  }
}

/** Bytes antes de jugar de cada mundo del registro, con los atlas de `atlas` si los hay. */
export function worldBudgets(
  atlas: AtlasIndex | null = readAtlasIndex(),
  registry: WorldRegistry = WORLD_REGISTRY,
  atlasDir = ATLAS_DIR,
): BudgetRow[] {
  return registry.ids().map((id) => {
    const composed = registry.get(id);
    const config = composed.config;
    const manifests = worldManifests(config);
    const spawn = config.spawn ?? {
      x: (config.bounds.left + config.bounds.right) / 2,
      y: config.bounds.bottom - 200,
    };
    const start = startArt(config, manifests, spawn);
    const aw = atlas?.worlds[config.id] ?? null;
    let art = 0;
    const covered = new Set<string>();
    if (aw) {
      for (const sid of start.sectors) {
        // La calidad más pesada de las dos: la cota del presupuesto.
        const sheets = [sectorSheets(aw, sid, 'alta'), sectorSheets(aw, sid, 'baja')].sort(
          (a, b) => b.reduce((s, x) => s + x.bytes, 0) - a.reduce((s, x) => s + x.bytes, 0),
        )[0]!;
        for (const sh of sheets) {
          art += size(path.join(atlasDir, sh.url)) + size(path.join(atlasDir, sh.image));
          for (const k of sh.keys) covered.add(k);
        }
      }
    }
    for (const f of start.files) {
      if (covered.has(f.key)) continue;
      const single = aw?.singles[f.key];
      art += single ? size(path.join(atlasDir, single.url)) : size(artPath(f.key));
    }
    const bases = new Set([
      ...start.objects.map((o) => o.appearance.asset),
      ...start.files.map((f) => f.base),
    ]);
    let manifestsTotal = 0;
    for (const b of new Set([...bases].map((x) => parseAssetRef(x).base))) manifestsTotal += manifestBytes(b);
    const ship = shipBytes(composed.theme.ship.style, composed.theme.ship.skin);
    return {
      world: id,
      mode: aw ? 'atlas' : 'png',
      sectors: start.sectors,
      objects: start.objects.length,
      art,
      manifests: manifestsTotal,
      ship,
      total: art + manifestsTotal + ship,
    };
  });
}

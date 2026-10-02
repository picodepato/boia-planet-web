/**
 * Atlas por sector (T47, REQ-MUN-012): para cada mundo del registro y cada
 * sector de su mapa, junta en hojas WebP los fotogramas que usan sus objetos
 * (recortados a lo opaco), en dos calidades: `alta` (tamaño del render) y
 * `baja` (la mitad, para dispositivos débiles; `meta.scale` 0.5, así Pixi
 * los ve del tamaño original y los pivotes no cambian). Las losas de costa
 * se repiten y no van en hoja: salen como WebP sueltos. Escribe
 * `apps/web/public/atlas/` con su `index.json` (formato en
 * `packages/engine/src/world/atlas-index.ts`); no toca `art/`.
 *
 * Si las fuentes no cambiaron (misma huella), no rehace nada.
 *
 * Uso: pnpm atlas [--force] [--out <carpeta>]
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import {
  ATLAS_INDEX_VERSION,
  type AtlasIndex,
  type AtlasSheetRef,
  type AtlasWorld,
  type ArtFile,
  QUALITY_TIERS,
  type QualityTier,
  packRects,
  worldArtPlan,
} from '../../packages/engine/src/streaming';
import { WORLD_REGISTRY } from '../../packages/world/src/index';
import { REPO, artPath, worldManifests } from './art-fs';

/** Sube si cambia el formato de salida: fuerza a rehacer los atlas. */
const BUILDER_VERSION = 2;
const TIER_SCALE: Record<QualityTier, number> = { alta: 1, baja: 0.5 };
/** Calidad WebP (con pérdida; el alfa, sin pérdida). muestra */
const TIER_QUALITY: Record<QualityTier, number> = { alta: 90, baja: 80 };

// sharp viene con Next (optimización de imágenes): se toma de su instalación.
const nextPkg = createRequire(path.join(REPO, 'apps/web/package.json')).resolve('next/package.json');
const sharp = createRequire(nextPkg)('sharp') as typeof import('sharp');

const args = process.argv.slice(2);
const force = args.includes('--force');
const outArg = args.indexOf('--out');
const OUT = path.resolve(outArg >= 0 ? args[outArg + 1]! : path.join(REPO, 'apps/web/public/atlas'));

interface WorldJob {
  id: string;
  sectors: Map<string, ArtFile[]>;
  coast: ArtFile[];
}

const jobs: WorldJob[] = WORLD_REGISTRY.ids().map((id) => {
  const config = WORLD_REGISTRY.get(id).config;
  const plan = worldArtPlan(config, worldManifests(config));
  return { id: config.id, sectors: plan.sectors, coast: plan.coast };
});

// Huella: versión del constructor, reparto por sectores y contenido de cada archivo.
const hash = createHash('sha1');
hash.update(`v${BUILDER_VERSION}`);
for (const j of jobs) {
  hash.update(`\n#${j.id}`);
  for (const [sid, files] of j.sectors) hash.update(`\n${sid}:${files.map((f) => f.key).join(',')}`);
  hash.update(`\ncosta:${j.coast.map((f) => f.key).join(',')}`);
}
const allKeys = [...new Set(jobs.flatMap((j) => [...j.sectors.values(), j.coast].flat().map((f) => f.key)))];
for (const k of allKeys.sort()) {
  const p = artPath(k);
  hash.update(k);
  hash.update(existsSync(p) ? readFileSync(p) : 'falta');
}
const source = hash.digest('hex').slice(0, 16);

const indexPath = path.join(OUT, 'index.json');
if (!force && existsSync(indexPath)) {
  try {
    const prev = JSON.parse(readFileSync(indexPath, 'utf8')) as { source?: string };
    if (prev.source === source) {
      console.log(`atlas: al día (${source}), nada que hacer`);
      process.exit(0);
    }
  } catch {
    // índice ilegible: se rehace
  }
}

const started = Date.now();
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

interface Trimmed {
  key: string;
  /** PNG recortado a lo opaco, ya a la escala de la calidad. */
  data: Buffer;
  w: number;
  h: number;
  /** Tamaño y desplazamiento del recorte en px de la calidad. */
  srcW: number;
  srcH: number;
  offX: number;
  offY: number;
}

async function trimmed(key: string, scale: number): Promise<Trimmed | null> {
  const p = artPath(key);
  if (!existsSync(p)) {
    console.warn(`atlas: falta ${key}; el motor usará un marcador`);
    return null;
  }
  const meta = await sharp(p).metadata();
  const W = Math.max(1, Math.round((meta.width ?? 1) * scale));
  const H = Math.max(1, Math.round((meta.height ?? 1) * scale));
  const scaled = await sharp(p).resize(W, H, { kernel: 'lanczos3' }).png().toBuffer();
  try {
    const { data, info } = await sharp(scaled)
      .trim({ threshold: 0 })
      .png()
      .toBuffer({ resolveWithObject: true });
    return {
      key,
      data,
      w: info.width,
      h: info.height,
      srcW: W,
      srcH: H,
      offX: -(info.trimOffsetLeft ?? 0),
      offY: -(info.trimOffsetTop ?? 0),
    };
  } catch {
    // Todo transparente (o nada que recortar): la imagen entera.
    return { key, data: scaled, w: W, h: H, srcW: W, srcH: H, offX: 0, offY: 0 };
  }
}

const short = (buf: Buffer | string) => createHash('sha1').update(buf).digest('hex').slice(0, 8);

async function buildSheets(world: string, sector: string, files: ArtFile[], tier: QualityTier) {
  const scale = TIER_SCALE[tier];
  const sprites = (await Promise.all(files.map((f) => trimmed(f.key, scale)))).filter(
    (s): s is Trimmed => s !== null,
  );
  if (sprites.length === 0) return [];
  const { placements, pages } = packRects(sprites);
  const out: AtlasSheetRef[] = [];
  for (let page = 0; page < pages.length; page++) {
    const size = pages[page]!;
    const here = placements.filter((p) => p.page === page);
    const image = await sharp({
      create: { width: size.w, height: size.h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite(here.map((p) => ({ input: sprites[p.index]!.data, left: p.x, top: p.y })))
      .webp({ quality: TIER_QUALITY[tier], alphaQuality: 100, effort: 5 })
      .toBuffer();
    const name = `${world}/${sector}.${tier}.${page}.${short(image)}`;
    const frames: Record<string, unknown> = {};
    for (const p of here) {
      const s = sprites[p.index]!;
      frames[s.key] = {
        frame: { x: p.x, y: p.y, w: s.w, h: s.h },
        rotated: false,
        trimmed: true,
        spriteSourceSize: { x: s.offX, y: s.offY, w: s.w, h: s.h },
        sourceSize: { w: s.srcW, h: s.srcH },
      };
    }
    const json = JSON.stringify({
      frames,
      meta: {
        app: 'boia-planet tools/atlas',
        image: path.basename(`${name}.webp`),
        format: 'RGBA8888',
        size: size,
        scale: String(scale),
      },
    });
    mkdirSync(path.join(OUT, world), { recursive: true });
    writeFileSync(path.join(OUT, `${name}.webp`), image);
    writeFileSync(path.join(OUT, `${name}.json`), json);
    out.push({
      url: `${name}.json`,
      image: `${name}.webp`,
      bytes: image.length + Buffer.byteLength(json),
      keys: here.map((p) => sprites[p.index]!.key),
    });
  }
  return out;
}

const index: AtlasIndex = { version: ATLAS_INDEX_VERSION, source, worlds: {} };
for (const job of jobs) {
  const w: AtlasWorld = { sectors: {}, singles: {} };
  // Sectores y calidades a la vez: sharp trabaja en sus hilos.
  await Promise.all(
    [...job.sectors].flatMap(([sid, files]) => {
      const tiers: Partial<Record<QualityTier, AtlasSheetRef[]>> = {};
      w.sectors[sid] = tiers;
      return QUALITY_TIERS.map(async (tier) => {
        tiers[tier] = await buildSheets(job.id, sid, files, tier);
      });
    }),
  );
  await Promise.all(
    job.coast.map(async (f) => {
      if (!existsSync(artPath(f.key))) return;
      const image = await sharp(artPath(f.key))
        .webp({ quality: TIER_QUALITY.alta, alphaQuality: 100, effort: 5 })
        .toBuffer();
      const name = `${job.id}/costa-${path.basename(f.key, path.extname(f.key))}.${short(image)}.webp`;
      mkdirSync(path.join(OUT, job.id), { recursive: true });
      writeFileSync(path.join(OUT, name), image);
      w.singles[f.key] = { url: name, bytes: image.length };
    }),
  );
  index.worlds[job.id] = w;
}
writeFileSync(indexPath, JSON.stringify(index));

const kb = (n: number) => `${(n / 1024).toFixed(0)} kB`;
for (const [id, w] of Object.entries(index.worlds)) {
  const sheets = Object.values(w.sectors).flatMap((t) => t.alta ?? []);
  const low = Object.values(w.sectors).flatMap((t) => t.baja ?? []);
  const singles = Object.values(w.singles).reduce((s, x) => s + x.bytes, 0);
  console.log(
    `atlas ${id}: ${Object.keys(w.sectors).length} sectores, ${sheets.length} hojas alta (${kb(
      sheets.reduce((s, x) => s + x.bytes, 0),
    )}), ${low.length} baja (${kb(low.reduce((s, x) => s + x.bytes, 0))}), costas ${kb(singles)}`,
  );
}
console.log(`atlas: ${source} en ${((Date.now() - started) / 1000).toFixed(1)} s → ${path.relative(REPO, OUT)}`);

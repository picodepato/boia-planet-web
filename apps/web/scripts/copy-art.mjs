#!/usr/bin/env node
/**
 * Copia `art/` (raíz del repo, D-16) a `apps/web/public/art/` para servirlo
 * como archivos estáticos (plan 027 T261): Cloudflare Workers no tiene disco,
 * así que nada puede leer `art/` al atender una petición. Corre antes de
 * `next dev` y de `next build` (los dos hosts, Vercel y Cloudflare, parten
 * del mismo `pnpm build`). La carpeta destino está en `.gitignore`.
 *
 * Sólo van los tipos que el motor pide por URL (manifiestos, sprites, modelos
 * y clips); las fuentes de Blender (`.blend`, `.py`, `.md`) se quedan fuera.
 * La copia es incremental (tamaño y fecha) y borra lo que ya no existe en
 * `art/`, para que `public/art/` sea siempre un espejo exacto.
 *
 * Uso: node scripts/copy-art.mjs [--json]
 */
import { mkdirSync, readdirSync, rmSync, statSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Extensiones servidas; las mismas que servía `app/api/art/[...path]/route.ts`. */
export const ART_EXTENSIONS = ['.json', '.png', '.webp', '.glb', '.mp4'];

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ART_SOURCE = resolve(WEB, '../../art');
export const ART_TARGET = join(WEB, 'public', 'art');

const toPosix = (p) => p.split(sep).join('/');

/** Archivos (relativos, con `/`) bajo `dir` cuya extensión está en `exts`. */
export function listFiles(dir, exts = ART_EXTENSIONS, base = dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return listFiles(p, exts, base);
    const ext = e.name.slice(e.name.lastIndexOf('.')).toLowerCase();
    return exts.includes(ext) ? [toPosix(relative(base, p))] : [];
  });
}

/**
 * Espeja `source` en `target`. Devuelve cuántos archivos hay, cuántos se
 * copiaron, cuántos se borraron y los bytes totales del destino.
 */
export function copyArt(source = ART_SOURCE, target = ART_TARGET) {
  const wanted = listFiles(source);
  const present = new Set(listFiles(target, ART_EXTENSIONS));
  let copied = 0;
  let bytes = 0;
  for (const rel of wanted) {
    const from = join(source, rel);
    const to = join(target, rel);
    const src = statSync(from);
    bytes += src.size;
    present.delete(rel);
    if (existsSync(to)) {
      const dst = statSync(to);
      if (dst.size === src.size && dst.mtimeMs >= src.mtimeMs) continue;
    }
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
    copied++;
  }
  // Lo que sobra en el destino (arte borrado o renombrado, u otra extensión).
  let removed = 0;
  if (existsSync(target)) {
    const extra = [...present, ...listFiles(target, allExtensions(target)).filter(notServed)];
    for (const rel of new Set(extra)) {
      rmSync(join(target, rel), { force: true });
      removed++;
    }
    pruneEmptyDirs(target);
  }
  return { files: wanted.length, copied, removed, bytes };
}

const notServed = (rel) => !ART_EXTENSIONS.includes(rel.slice(rel.lastIndexOf('.')).toLowerCase());

/** Todas las extensiones presentes bajo `dir` (para limpiar lo que no se sirve). */
function allExtensions(dir) {
  const exts = new Set();
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else exts.add(e.name.slice(e.name.lastIndexOf('.')).toLowerCase());
    }
  };
  walk(dir);
  return [...exts];
}

function pruneEmptyDirs(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const p = join(dir, e.name);
    pruneEmptyDirs(p);
    if (readdirSync(p).length === 0) rmSync(p, { recursive: true, force: true });
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (!existsSync(ART_SOURCE)) {
    console.error(`copy-art: no existe ${ART_SOURCE}`);
    process.exit(1);
  }
  const r = copyArt();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(r));
  } else {
    const mb = (r.bytes / 1024 / 1024).toFixed(1);
    console.log(
      `copy-art: ${r.files} archivos (${mb} MB) en public/art/; ${r.copied} copiados, ${r.removed} borrados`,
    );
  }
}

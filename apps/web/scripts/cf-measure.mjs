#!/usr/bin/env node
/**
 * Mide el Worker de Cloudflare contra el límite del plan gratuito (plan 027
 * T262): 3 MB comprimidos con gzip; el presupuesto propio es 2.800 KiB, para
 * dejar margen. Medido el 2026-10-09 (main 42edb09): 10.264 KiB sin comprimir,
 * 2.187 KiB gzip.
 *
 * La construcción de OpenNext en Windows sólo funciona con
 * `node-linker=hoisted` (los enlaces simbólicos de pnpm fallan con EPERM), y
 * el repo no cambia su `nodeLinker`. Por eso el script trabaja sobre una
 * copia: copia el repo (sin `.git`, `node_modules`, `docs/` ni salidas) a una
 * carpeta temporal, instala ahí con `nodeLinker: hoisted`, corre `pnpm cf:build`
 * (= `opennextjs-cloudflare build`, que a su vez corre `pnpm build`, más la
 * caché estática y `_headers`/`_redirects`) y `wrangler deploy --dry-run --outdir`, y suma el tamaño del
 * Worker resultante, crudo y gzip. También cuenta los archivos estáticos
 * (`.open-next/assets`) contra los límites de Workers Static Assets (20.000
 * archivos, 25 MiB por archivo). Sale con 1 si algo se pasa. Igual en Linux.
 *
 * Uso: node apps/web/scripts/cf-measure.mjs [--dir <carpeta>] [--keep] [--json]
 *   --dir <carpeta>  copia de trabajo fija (se reutiliza y la instalación es
 *                    incremental); sin ella, una carpeta temporal nueva.
 *   --keep           no borra la carpeta temporal al acabar (para
 *                    `pnpm cf:preview` desde ella); imprime su ruta.
 *   --json           resultado en JSON (una línea).
 */
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

export const BUDGET_GZIP = 2800 * 1024;
/** Límites de Workers Static Assets (plan gratuito incluido). */
export const ASSETS_MAX_FILES = 20_000;
export const ASSETS_MAX_FILE_BYTES = 25 * 1024 * 1024;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
/** Carpeta donde `wrangler deploy --dry-run` deja el Worker empaquetado. */
const DRY_RUN_OUT = '.open-next/dry-run';

/** Lo que no hace falta para construir (o se regenera): no se copia. */
const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  '.next',
  '.next-dev',
  '.open-next',
  '.wrangler',
  '.claude',
  '.orchestrator',
  '.vercel',
  'docs',
  'output',
  'reunion',
  'coverage',
  'test-results',
  'playwright-report',
]);
const SKIP_PATHS = new Set(['apps/web/public/art', 'apps/web/public/atlas', 'tools/blender/out']);

const toPosix = (p) => p.split(sep).join('/');

/** Si `path` (absoluto, dentro de `root`) entra en la copia. */
export function shouldCopy(path, root = ROOT) {
  const rel = toPosix(relative(root, path));
  if (rel === '') return true;
  const parts = rel.split('/');
  if (parts.some((p) => SKIP_DIRS.has(p))) return false;
  if (SKIP_PATHS.has(rel) || [...SKIP_PATHS].some((s) => rel.startsWith(`${s}/`))) return false;
  const name = parts[parts.length - 1];
  // Sin variables locales (.env, .env.local…): la copia construye en modo local.
  if (/^\.env(\..+)?$/.test(name) && name !== '.env.example') return false;
  if (/\.log$/.test(name)) return false;
  return true;
}

function run(cmd, args, cwd) {
  const shown = `${cmd} ${args.join(' ')}`;
  console.log(`\n$ ${shown}  (en ${cwd})`);
  // `shell: true`: pnpm es un .cmd en Windows y Node ya no lo lanza directo.
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: true, env: process.env });
  if (r.status !== 0) {
    console.error(`cf-measure: falló «${shown}» (código ${r.status ?? r.signal})`);
    process.exit(r.status ?? 1);
  }
}

/** Archivos bajo `dir`, recursivo, absolutos. */
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

/** Tamaño crudo y gzip del Worker que wrangler empaquetó (sin los .map). */
export function measureWorker(outDir) {
  const files = walk(outDir).filter((f) => !f.endsWith('.map'));
  let raw = 0;
  let gzip = 0;
  const parts = [];
  for (const f of files) {
    const buf = readFileSync(f);
    const g = gzipSync(buf, { level: 9 }).length;
    raw += buf.length;
    gzip += g;
    parts.push({ file: toPosix(relative(outDir, f)), raw: buf.length, gzip: g });
  }
  parts.sort((a, b) => b.gzip - a.gzip);
  return { raw, gzip, files: parts };
}

/** Cuántos archivos estáticos hay, cuánto pesan y cuál es el mayor. */
export function measureAssets(assetsDir) {
  const files = walk(assetsDir);
  let bytes = 0;
  let largest = { file: '', bytes: 0 };
  for (const f of files) {
    const size = statSync(f).size;
    bytes += size;
    if (size > largest.bytes) largest = { file: toPosix(relative(assetsDir, f)), bytes: size };
  }
  return { count: files.length, bytes, largest };
}

const kib = (n) => `${Math.round(n / 1024).toLocaleString('en-US')} KiB`;
const mib = (n) => `${(n / 1024 / 1024).toFixed(1)} MiB`;

/**
 * Lo que se pasa de los límites, en frases para Álvaro (vacío = todo bien).
 * `worker` y `assets` como los devuelven `measureWorker` y `measureAssets`.
 * La usan el script y el flujo `.github/workflows/cf-size.yml`.
 */
export function limitProblems(worker, assets) {
  const problems = [];
  if (worker.gzip > BUDGET_GZIP) {
    problems.push(
      `El Worker pesa ${kib(worker.gzip)} gzip, más que el presupuesto de ${kib(BUDGET_GZIP)} ` +
        '(el plan gratuito de Cloudflare corta en 3 MB)',
    );
  }
  if (assets.count > ASSETS_MAX_FILES) {
    problems.push(
      `Hay ${assets.count} archivos estáticos, más que el límite de ${ASSETS_MAX_FILES} de Cloudflare`,
    );
  }
  if (assets.largest.bytes > ASSETS_MAX_FILE_BYTES) {
    problems.push(
      `El archivo estático ${assets.largest.file} pesa ${mib(assets.largest.bytes)}, más que el límite de 25 MiB por archivo de Cloudflare`,
    );
  }
  return problems;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const argv = process.argv.slice(2);
  const at = argv.indexOf('--dir');
  const fixedDir = at >= 0 ? resolve(argv[at + 1] ?? '') : null;
  const keep = argv.includes('--keep') || fixedDir !== null;
  const json = argv.includes('--json');
  if (at >= 0 && !argv[at + 1]) {
    console.error('cf-measure: --dir necesita una carpeta');
    process.exit(2);
  }

  const dir = fixedDir ?? mkdtempSync(join(tmpdir(), 'boia-planet-cf-'));
  mkdirSync(dir, { recursive: true });
  if (resolve(dir) === ROOT || resolve(dir).startsWith(ROOT + sep)) {
    console.error('cf-measure: la copia no puede estar dentro del repo');
    process.exit(2);
  }
  console.log(`cf-measure: copiando ${ROOT} → ${dir}`);
  cpSync(ROOT, dir, { recursive: true, filter: (src) => shouldCopy(src) });
  // Instalación plana, sólo en la copia: el repo conserva su `nodeLinker`
  // (pnpm 11 lee sus ajustes de pnpm-workspace.yaml, no de .npmrc).
  const workspace = join(dir, 'pnpm-workspace.yaml');
  const yaml = readFileSync(workspace, 'utf8').replace(/^nodeLinker:.*\n/m, '');
  writeFileSync(
    workspace,
    `${yaml}\n# Copia de cf-measure: instalación plana.\nnodeLinker: hoisted\n`,
  );

  run('pnpm', ['install', '--frozen-lockfile'], dir);
  run('pnpm', ['--filter', '@boia/web', 'cf:build'], dir);
  const web = join(dir, 'apps', 'web');
  rmSync(join(web, DRY_RUN_OUT), { recursive: true, force: true });
  run('pnpm', ['exec', 'wrangler', 'deploy', '--dry-run', '--outdir', DRY_RUN_OUT], web);

  const worker = measureWorker(join(web, DRY_RUN_OUT));
  const assets = measureAssets(join(web, '.open-next', 'assets'));
  const problems = limitProblems(worker, assets);

  if (json) {
    console.log(
      JSON.stringify({
        workerRaw: worker.raw,
        workerGzip: worker.gzip,
        budgetGzip: BUDGET_GZIP,
        workerFiles: worker.files,
        assets,
        problems,
        dir: keep ? dir : null,
      }),
    );
  } else {
    console.log('\nWorker de Cloudflare (wrangler deploy --dry-run):');
    for (const p of worker.files) {
      console.log(
        `  ${kib(p.gzip).padStart(10)} gzip  ${kib(p.raw).padStart(10)} crudo  ${p.file}`,
      );
    }
    console.log(
      `  total: ${kib(worker.raw)} crudo / ${kib(worker.gzip)} gzip · presupuesto ${kib(
        BUDGET_GZIP,
      )} gzip (límite del plan gratuito 3 MB) · ${worker.gzip <= BUDGET_GZIP ? 'OK' : 'EXCEDIDO'}`,
    );
    console.log(
      `Archivos estáticos (.open-next/assets): ${assets.count} archivos, ${mib(
        assets.bytes,
      )}; el mayor ${assets.largest.file} (${mib(assets.largest.bytes)}) · límites ${ASSETS_MAX_FILES} archivos y 25 MiB por archivo`,
    );
    for (const p of problems) console.log(`  PROBLEMA: ${p}`);
  }
  // En GitHub Actions, cada problema sale como error en el resumen del flujo.
  if (process.env.GITHUB_ACTIONS === 'true') {
    for (const p of problems) {
      console.log(
        `::error title=Cloudflare: límite superado::${p}. Si se despliega así, Cloudflare puede rechazar el Worker y la web pública se queda en la versión anterior. Mide en local con «pnpm cf:measure» y recorta antes de subir.`,
      );
    }
  }

  if (keep) {
    console.log(`\ncf-measure: copia conservada en ${dir}`);
    console.log(`  vista previa: cd "${join(dir, 'apps', 'web')}" && pnpm cf:preview`);
  } else {
    rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
  }
  process.exit(problems.length === 0 ? 0 : 1);
}

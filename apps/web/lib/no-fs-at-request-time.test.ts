import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot } from './barco/load';

/**
 * Cloudflare Workers no tiene disco (plan 027 T261): ninguna ruta que se
 * ejecute al atender una petición puede leer `node:fs`. Las dos páginas que
 * leen `art/` al construir (`/`, con `lib/intro/load.ts`, y `/mar`, con
 * `lib/barco/load.ts`) se prerrenderizan y lo declaran con
 * `export const dynamic = 'force-static'`.
 *
 * La prueba recorre el grafo de importaciones de cada entrada de `app/`
 * (page, layout, route…) hasta los paquetes del workspace y exige que toda
 * entrada que llegue a `node:fs` esté marcada `force-static`. Si existe el
 * manifiesto de la última compilación, comprueba además que Next la
 * prerrenderizó de verdad.
 */

const ROOT = repoRoot();
const WEB = path.join(ROOT, 'apps', 'web');
const APP = path.join(WEB, 'app');

const FS_MODULES = new Set(['fs', 'node:fs', 'fs/promises', 'node:fs/promises']);
const ENTRY =
  /^(page|layout|route|template|default|loading|error|not-found|global-error|sitemap|robots|manifest|opengraph-image|twitter-image|icon|apple-icon)\.tsx?$/;
const EXTS = ['.ts', '.tsx', '/index.ts', '/index.tsx'];

/** Entradas de `app/` (las que Next ejecuta por ruta), relativas a `apps/web`. */
function entries(dir = APP): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return entries(p);
    return ENTRY.test(e.name) ? [p] : [];
  });
}

/** Especificadores importados en tiempo de ejecución (no `import type`). */
export function runtimeImports(source: string): string[] {
  const out: string[] = [];
  const re =
    /(?:^|\n)\s*(?:import|export)\s+(type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const m of source.matchAll(re)) {
    if (m[1]) continue; // import type / export type
    const spec = m[2] ?? m[3];
    if (spec) out.push(spec);
  }
  return out;
}

function resolveFile(base: string): string | null {
  for (const ext of ['', ...EXTS]) {
    const p = base + ext;
    if (existsSync(p) && /\.tsx?$/.test(p)) return p;
  }
  return null;
}

/** Un `@boia/<paquete>[/sub]` por el `exports` de su package.json. */
function resolveWorkspace(spec: string): string | null {
  const m = spec.match(/^@boia\/([^/]+)(\/.*)?$/);
  if (!m) return null;
  const dir = path.join(ROOT, 'packages', m[1]!);
  const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')) as {
    exports?: Record<string, string>;
  };
  const sub = `.${m[2] ?? ''}`;
  const exports = pkg.exports ?? {};
  if (exports[sub]) return path.join(dir, exports[sub]);
  for (const [key, target] of Object.entries(exports)) {
    if (!key.endsWith('/*')) continue;
    const prefix = key.slice(0, -1);
    if (sub.startsWith(prefix))
      return path.join(dir, target.replace('*', sub.slice(prefix.length)));
  }
  return null;
}

/** Los módulos de `fs` a los que llega `file` por su grafo de importaciones. */
export function fsReachedFrom(file: string, seen = new Set<string>()): string[] {
  if (seen.has(file)) return [];
  seen.add(file);
  const hits: string[] = [];
  for (const spec of runtimeImports(readFileSync(file, 'utf8'))) {
    if (FS_MODULES.has(spec)) {
      hits.push(`${path.relative(WEB, file).split(path.sep).join('/')} → ${spec}`);
      continue;
    }
    let next: string | null = null;
    if (spec.startsWith('.')) next = resolveFile(path.resolve(path.dirname(file), spec));
    else if (spec.startsWith('@boia/')) next = resolveFile(resolveWorkspace(spec) ?? '');
    if (next) hits.push(...fsReachedFrom(next, seen));
  }
  return hits;
}

const FORCE_STATIC = /export\s+const\s+dynamic\s*=\s*['"]force-static['"]/;

/** La ruta de una entrada de `app/` (sin grupos `(x)` ni el nombre del archivo). */
function routeOf(entry: string): string {
  const rel = path.relative(APP, path.dirname(entry)).split(path.sep);
  const route = rel.filter((s) => s && !/^\(.*\)$/.test(s)).join('/');
  return `/${route}`;
}

describe('ninguna ruta lee el disco al atender una petición (plan 027 T261)', () => {
  const all = entries();
  const readers = all.filter((e) => fsReachedFrom(e).length > 0);

  it('el rastreo encuentra node:fs detrás de las dos cargas de art/', () => {
    expect(fsReachedFrom(path.join(WEB, 'lib/intro/load.ts'))).not.toEqual([]);
    expect(fsReachedFrom(path.join(WEB, 'lib/barco/load.ts'))).not.toEqual([]);
    expect(runtimeImports("import type { A } from './a';\nimport { b } from './b';")).toEqual([
      './b',
    ]);
  });

  it('toda entrada de app/ que llega a node:fs es una página force-static', () => {
    expect(all.length).toBeGreaterThan(0);
    const offenders = readers
      .filter(
        (e) =>
          !(path.basename(e).startsWith('page.') && FORCE_STATIC.test(readFileSync(e, 'utf8'))),
      )
      .map((e) => `${path.relative(WEB, e)}: ${fsReachedFrom(e).join(', ')}`);
    expect(offenders).toEqual([]);
  });

  const manifest = path.join(WEB, '.next', 'prerender-manifest.json');
  it.skipIf(!existsSync(manifest))('la última compilación las prerrenderizó', () => {
    const { routes } = JSON.parse(readFileSync(manifest, 'utf8')) as {
      routes: Record<string, unknown>;
    };
    for (const e of readers) expect(Object.keys(routes), routeOf(e)).toContain(routeOf(e));
  });
});

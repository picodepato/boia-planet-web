#!/usr/bin/env node
/**
 * Atlas por sector antes de `next dev` y `next build` (T47): corre
 * `tools/atlas/build.ts` con este mismo Node (no rehace nada si el arte no
 * cambió). Si falla (sin sharp, p. ej.), deja un índice vacío y sigue: el
 * motor usa entonces los PNG de `/api/art`, igual que sin atlas.
 *
 * Uso: node scripts/atlas.mjs [--force]
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const r = spawnSync(
  process.execPath,
  [
    '--import',
    './packages/world/scripts/ts-resolve.mjs',
    'tools/atlas/build.ts',
    ...process.argv.slice(2),
  ],
  { cwd: repo, stdio: 'inherit' },
);
if (r.status !== 0) {
  console.warn('atlas: no se pudieron construir; /juego usará los PNG sueltos');
  const out = join(repo, 'apps/web/public/atlas');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'index.json'), JSON.stringify({ version: 1, source: '', worlds: {} }));
}

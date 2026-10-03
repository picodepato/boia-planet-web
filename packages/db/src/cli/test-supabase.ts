/**
 * `pnpm test:supabase`: las pruebas de integración contra el proyecto
 * Supabase de desarrollo (packages/db/src/supabase/*.supabase.ts): crean
 * cuentas `@example.test` con la clave de servicio, prueban cada RPC (lo que
 * acepta y lo que rechaza) y la RLS de anon, otra cuenta y el Admin, y
 * borran sus cuentas.
 *
 * Sin las variables de Supabase (en el entorno o en apps/web/.env.local)
 * escribe una línea de «se omite» y sale con 0: así corre en cualquier
 * máquina. Los argumentos se pasan a vitest.
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENV_FILE, REPO_ROOT, supabaseEnv } from '../supabase/env.ts';

const r = supabaseEnv();
if (!r.ok) {
  if (r.problem) {
    console.error(`test:supabase FALLA — ${r.problem}`);
    process.exit(1);
  }
  console.log(
    `test:supabase: se omite — sin Supabase (faltan ${r.missing.join(', ')} en el entorno y en ${ENV_FILE})`,
  );
  process.exit(0);
}

// El bin de vitest (su package.json no exporta vitest.mjs).
const vitest = join(
  dirname(createRequire(`${REPO_ROOT}package.json`).resolve('vitest/package.json')),
  'vitest.mjs',
);
const config = fileURLToPath(new URL('../../vitest.supabase.config.ts', import.meta.url));
const res = spawnSync(
  process.execPath,
  [vitest, 'run', '--config', config, ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    // Marca de las cuentas de esta ejecución (testkit.ts, testRunId).
    env: { ...process.env, BOIA_TEST_RUN: randomBytes(3).toString('hex') },
  },
);
process.exit(res.status ?? 1);

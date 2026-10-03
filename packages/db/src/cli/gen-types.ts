/**
 * `pnpm db:types`: aplica las migraciones a una base temporal y escribe
 * packages/db/src/database.types.ts. Una prueba comprueba que el archivo
 * versionado coincide con lo que generan las migraciones actuales.
 *
 * `pnpm db:types:dev` (`--dev`): lo mismo leyendo el catálogo del proyecto
 * Supabase de desarrollo, ya migrado con `pnpm db:migrate:dev` (sirve sin
 * PostgreSQL local).
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import { generateTypes } from '../gen-types.ts';
import { dropDatabase, freshDatabase, listMigrations } from '../harness.ts';
import { connectDev } from '../supabase/dev.ts';
import { supabaseEnv } from '../supabase/env.ts';

const OUT = fileURLToPath(new URL('../database.types.ts', import.meta.url));
const DB = 'boia_planet_test_types';

async function fromDev(): Promise<string> {
  const r = supabaseEnv();
  if (!r.ok) throw new Error(r.problem ?? `faltan ${r.missing.join(', ')}`);
  const client: pg.Client = await connectDev(r.env);
  try {
    const { rows } = await client.query<{ version: string }>(
      'select version from supabase_migrations.schema_migrations',
    );
    const done = new Set(rows.map((x) => x.version));
    const pending = listMigrations().filter((m) => !done.has(m.version));
    if (pending.length > 0) {
      throw new Error(
        `faltan migraciones en dev (pnpm db:migrate:dev): ${pending.map((m) => m.version).join(', ')}`,
      );
    }
    return await generateTypes(client);
  } finally {
    await client.end();
  }
}

async function fromLocal(): Promise<string> {
  const client = await freshDatabase(DB);
  try {
    return await generateTypes(client);
  } finally {
    await client.end();
    await dropDatabase(DB);
  }
}

async function main(): Promise<void> {
  const dev = process.argv.includes('--dev');
  writeFileSync(OUT, dev ? await fromDev() : await fromLocal());
  console.log(`db:types${dev ? ' (dev)' : ''} → ${OUT}`);
}

main().catch((err: unknown) => {
  console.error(`db:types FALLA — ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});

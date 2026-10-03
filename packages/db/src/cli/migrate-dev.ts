/**
 * `pnpm db:migrate:dev`: aplica `supabase/migrations/*.sql` al proyecto
 * Supabase de desarrollo (`SUPABASE_DB_URL`) y después las semillas de
 * muestra (`supabase/seeds`). Las migraciones quedan en
 * `supabase_migrations.schema_migrations`, como con la CLI de Supabase; las
 * semillas, por suma en `supabase_migrations.boia_seed_files`. Repetir no
 * aplica nada.
 *
 * Se niega si la base no es del proyecto de `NEXT_PUBLIC_SUPABASE_URL`.
 * Opciones: `--no-seed` (sólo migraciones).
 */
import { listMigrations, migrate } from '../harness.ts';
import { applySeedsTracked, connectDev } from '../supabase/dev.ts';
import { ENV_FILE, supabaseEnv } from '../supabase/env.ts';

async function main(): Promise<void> {
  const seed = !process.argv.includes('--no-seed');
  const r = supabaseEnv();
  if (!r.ok) {
    const why = r.problem ?? `faltan ${r.missing.join(', ')} (en el entorno o en ${ENV_FILE})`;
    throw new Error(why);
  }
  const client = await connectDev(r.env);
  try {
    const applied = await migrate(client);
    console.log(
      `[migraciones] ${applied.length} aplicadas de ${listMigrations().length}` +
        (applied.length ? `: ${applied.join(', ')}` : ' (al día)'),
    );
    if (seed) {
      const seeds = await applySeedsTracked(client);
      console.log(
        `[semillas] ${seeds.length} aplicadas` +
          (seeds.length ? `: ${seeds.join(', ')}` : ' (al día)'),
      );
    }
    // PostgREST vuelve a leer el esquema (funciones y tablas nuevas).
    await client.query(`notify pgrst, 'reload schema'`);
  } finally {
    await client.end();
  }
  console.log(
    'db:migrate:dev OK — proyecto comprobado (NEXT_PUBLIC_SUPABASE_URL = SUPABASE_DB_URL)',
  );
}

main().catch((err: unknown) => {
  console.error(`db:migrate:dev FALLA — ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});

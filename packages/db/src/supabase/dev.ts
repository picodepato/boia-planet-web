/**
 * Conexión directa (Postgres) al proyecto Supabase de desarrollo y la
 * aplicación de semillas con registro. Sólo para scripts y pruebas: nunca se
 * importa desde la web.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { SEEDS_DIR, listSqlFiles } from '../harness.ts';
import type { SupabaseEnv } from './env.ts';

export async function connectDev(env: SupabaseEnv): Promise<pg.Client> {
  // El pooler de Supabase usa TLS con su propia CA, que Node no trae.
  const client = new pg.Client({ connectionString: env.dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query(`set client_min_messages = warning`);
  // Comprobación extra: es una base de Supabase (tiene auth.users).
  const { rows } = await client.query<{ ok: boolean }>(
    `select to_regclass('auth.users') is not null as ok`,
  );
  if (!rows[0]?.ok) {
    await client.end();
    throw new Error('La base no tiene auth.users: no parece un proyecto Supabase');
  }
  return client;
}

/**
 * Aplica las semillas de `supabase/seeds` nuevas o cambiadas y las registra
 * por suma SHA-256 en `supabase_migrations.boia_seed_files`. Las semillas son
 * reejecutables, pero así repetir no aplica nada. Devuelve las aplicadas.
 */
export async function applySeedsTracked(client: pg.Client): Promise<string[]> {
  await client.query(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.boia_seed_files (
      name text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    );
  `);
  const { rows } = await client.query<{ name: string; checksum: string }>(
    'select name, checksum from supabase_migrations.boia_seed_files',
  );
  const done = new Map(rows.map((r) => [r.name, r.checksum]));
  const applied: string[] = [];
  for (const f of listSqlFiles(SEEDS_DIR)) {
    const sql = readFileSync(f.path, 'utf8');
    const name = `${f.version}_${f.name}`;
    const sum = createHash('sha256').update(sql).digest('hex');
    if (done.get(name) === sum) continue;
    await client.query('begin');
    try {
      await client.query(sql);
      await client.query(
        `insert into supabase_migrations.boia_seed_files (name, checksum) values ($1, $2)
         on conflict (name) do update set checksum = excluded.checksum, applied_at = now()`,
        [name, sum],
      );
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw new Error(`Falla la semilla ${name}: ${(err as Error).message}`, { cause: err });
    }
    applied.push(name);
  }
  return applied;
}

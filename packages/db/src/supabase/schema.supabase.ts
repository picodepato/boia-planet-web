/**
 * El esquema del proyecto de desarrollo, mirando el catálogo real: todas las
 * migraciones aplicadas, RLS en todas las tablas, ningún permiso de
 * escritura de cliente sobre lo protegido, las funciones de `private` sin
 * EXECUTE para PUBLIC ni anon salvo las de lectura, y los tipos versionados
 * al día. Lo mismo que `pnpm db:test` comprueba en un PostgreSQL local.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clientWriteLeaks, tablesWithoutRls } from '../checks.ts';
import { generateTypes } from '../gen-types.ts';
import { listMigrations } from '../harness.ts';
import { connectDev } from './dev.ts';
import { supabaseEnv } from './env.ts';

let client: pg.Client;

beforeAll(async () => {
  const r = supabaseEnv();
  if (!r.ok) throw new Error(r.problem ?? `faltan ${r.missing.join(', ')}`);
  client = await connectDev(r.env);
});

afterAll(async () => {
  await client?.end();
});

describe('esquema del proyecto de desarrollo', () => {
  it('tiene todas las migraciones del repositorio (pnpm db:migrate:dev)', async () => {
    const { rows } = await client.query<{ version: string }>(
      'select version from supabase_migrations.schema_migrations order by version',
    );
    expect(rows.map((r) => r.version)).toEqual(
      expect.arrayContaining(listMigrations().map((m) => m.version)),
    );
  });

  it('todas las tablas de public tienen RLS', async () => {
    expect(await tablesWithoutRls(client)).toEqual([]);
  });

  it('ningún cliente escribe saldos, libro, roles, sellos, Carnet, tiempos ni catálogos', async () => {
    expect(await clientWriteLeaks(client)).toEqual([]);
  });

  it('anon sólo ejecuta las RPC de lectura (rankings y botellas)', async () => {
    const { rows } = await client.query<{ name: string }>(`
      select p.proname as name
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype
        and has_function_privilege('anon', p.oid, 'execute')
      order by 1`);
    expect(rows.map((r) => r.name)).toEqual([
      'latest_bottles',
      'ranking_canon',
      'ranking_castle',
      'ranking_points',
      'ranking_race',
      'ranking_season',
    ]);
  });

  it('las funciones con SECURITY DEFINER viven en private, no en public', async () => {
    const { rows } = await client.query<{ name: string }>(`
      select p.proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef`);
    expect(rows).toEqual([]);
  });

  it('los tipos versionados coinciden con el esquema (pnpm db:types:dev)', async () => {
    const committed = readFileSync(
      fileURLToPath(new URL('../database.types.ts', import.meta.url)),
      'utf8',
    );
    expect(await generateTypes(client)).toBe(committed);
  });
});

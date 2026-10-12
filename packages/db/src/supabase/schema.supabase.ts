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

  it('anon sólo ejecuta las RPC de lectura (rankings, botellas, calitas) y la del Carnet 000', async () => {
    const { rows } = await client.query<{ name: string }>(`
      select p.proname as name
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype
        and has_function_privilege('anon', p.oid, 'execute')
      order by 1`);
    expect(rows.map((r) => r.name)).toEqual([
      // Entrar al Admin con el Carnet 000 (20261007100400_admin_access_export).
      'admin_sign_in_email',
      // El tablón de calitas se lee sin cuenta (20261008100500_calitas).
      'calitas_list',
      'latest_bottles',
      'ranking_canon',
      'ranking_castle',
      'ranking_points',
      'ranking_race',
      'ranking_season',
    ]);
  });

  it('las funciones con SECURITY DEFINER viven en private, salvo las que se conocen', async () => {
    const { rows } = await client.query<{ name: string }>(`
      select p.proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef order by 1`);
    // Las que dejaron en public las migraciones de los planes 019–023; una
    // nueva hace fallar esto. Moverlas a private es trabajo de seguridad
    // pendiente (T276, plans/seguridad-pendiente.md).
    expect(rows.map((r) => r.name)).toEqual([
      'admin_sign_in_email', // 20261007100400_admin_access_export
      'discount_code_for', // 20261008100100_event_fields_common_code (sin anon)
      'radio_reorder', // 20261009100100_radio (sin anon)
      'radio_set_first', // 20261009100100_radio (sin anon)
    ]);
  });

  it('los tipos versionados coinciden con el esquema (pnpm db:types:dev)', async () => {
    const committed = readFileSync(
      fileURLToPath(new URL('../database.types.ts', import.meta.url)),
      'utf8',
    );
    expect(await generateTypes(client)).toBe(committed);
  });
});

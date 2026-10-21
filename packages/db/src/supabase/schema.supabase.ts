/**
 * El esquema del proyecto de desarrollo, mirando el catálogo real: todas las
 * migraciones aplicadas, RLS en todas las tablas, ningún permiso de
 * escritura de cliente sobre lo protegido, las funciones de `private` sin
 * EXECUTE para PUBLIC ni anon salvo las de lectura, ninguna SECURITY DEFINER
 * en `public`, search_path fijo en todas (T278) y los tipos versionados al
 * día. Lo mismo que `pnpm db:test` comprueba en un PostgreSQL local.
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

  it('anon sólo ejecuta las RPC de lectura (rankings, botellas, calitas) y el embudo', async () => {
    const { rows } = await client.query<{ name: string }>(`
      select p.proname as name
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype
        and has_function_privilege('anon', p.oid, 'execute')
      order by 1`);
    // T278: `admin_sign_in_email` (daba el email del Carnet 000) ya no existe.
    expect(rows.map((r) => r.name)).toEqual([
      // La página del enlace para reclamar una ficha (plan 031 T296): sólo
      // dice si el código vale y el nombre de la ficha.
      'artist_claim_info',
      // El tablón de calitas se lee sin cuenta (20261008100500_calitas).
      'calitas_list',
      // El enlace de la puerta (plan 034 T307): de qué fiesta es y sellar
      // el Carnet escaneado; el código es la llave.
      'door_link_info',
      'door_link_stamp',
      // Suma un paso al contador del día del embudo (plan 032 T301): sólo
      // los pasos permitidos y con la analítica encendida.
      'funnel_hit',
      'latest_bottles',
      'ranking_canon',
      'ranking_castle',
      'ranking_points',
      'ranking_race',
      'ranking_season',
    ]);
  });

  it('de private, anon sólo ejecuta la lógica de esas lecturas y las ayudas de la RLS', async () => {
    const { rows } = await client.query<{ name: string }>(`
      select p.proname as name
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'private' and has_function_privilege('anon', p.oid, 'execute')
      order by 1`);
    expect(rows.map((r) => r.name)).toEqual([
      // Políticas de lectura de botellas y rankings (papelera, plan 020).
      'account_in_trash',
      // La página del enlace para reclamar una ficha (plan 031 T296).
      'artist_claim_info',
      'calitas_list',
      // El enlace de la puerta (plan 034 T307).
      'door_link_info',
      'door_link_stamp',
      // El contador del embudo (plan 032 T301).
      'funnel_hit',
      // Políticas de RLS de todo el esquema.
      'has_staff_role',
      'is_member',
      'latest_bottles',
      'page_limit',
      'ranking_canon',
      'ranking_castle',
      'ranking_points',
      'ranking_race',
      'staff_role',
    ]);
  });

  it('ninguna función de public ni private da EXECUTE a PUBLIC', async () => {
    const { rows } = await client.query<{ name: string }>(`
      select n.nspname || '.' || p.proname as name
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private')
        and (p.proacl is null or exists (
          select 1 from aclexplode(p.proacl) a where a.grantee = 0 and a.privilege_type = 'EXECUTE'))
      order by 1`);
    expect(rows).toEqual([]);
  });

  it('ninguna función con SECURITY DEFINER vive en public (T278)', async () => {
    const { rows } = await client.query<{ name: string }>(`
      select p.proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef order by 1`);
    // Las cuatro que dejaron los planes 019–023 (admin_sign_in_email,
    // discount_code_for, radio_reorder, radio_set_first) se fueron con
    // 20261013100200_security_definer_lockdown. Una nueva hace fallar esto:
    // la lógica va en private y en public una envoltura SECURITY INVOKER.
    expect(rows.map((r) => r.name)).toEqual([]);
  });

  it('toda función de public y private fija search_path vacío', async () => {
    const { rows } = await client.query<{ name: string; config: string[] | null }>(`
      select n.nspname || '.' || p.proname as name, p.proconfig as config
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private') and p.prokind = 'f'
        and not ('search_path=""' = any(coalesce(p.proconfig, '{}'))
                 or 'search_path=' = any(coalesce(p.proconfig, '{}')))
      order by 1`);
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

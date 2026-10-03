/**
 * Comprobaciones de permisos sobre el catálogo: las usan `pnpm db:test` y
 * las pruebas de vitest. Leen los privilegios reales, no los archivos SQL.
 */
import type pg from 'pg';

/** Datos que ningún cliente (anon, authenticated) escribe (REQ-ARQ-003). */
export const CLIENT_READ_ONLY_TABLES = [
  'audit_log',
  'coin_balances',
  'ledger_transactions',
  'point_balances',
  'purchases',
  'season_points',
  'seasons',
  'site_settings',
  'staff_roles',
  'stamps',
  'user_achievements',
  'user_cosmetics',
  // Plan 008: sólo se escriben con las RPC validadas (decisión 6).
  'account_snapshots',
  'carnets',
  'circuits',
  'consents',
  'cosmetics',
  'discounts',
  'equipped_cosmetics',
  'event_stamp_codes',
  'point_actions',
  'race_times',
  'user_discounts',
] as const;

/** Derivados del libro: sólo los escribe su disparador, ni service_role. */
export const LEDGER_DERIVED_TABLES = [
  'coin_balances',
  'point_balances',
  'season_points',
  'stamps',
  'user_achievements',
  'user_cosmetics',
] as const;

/** Sólo altas, también para service_role. */
export const APPEND_ONLY_TABLES = ['audit_log', 'ledger_transactions'] as const;

/** Columnas de estado y publicación que ningún cliente fija. */
export const CLIENT_READ_ONLY_COLUMNS: ReadonlyArray<readonly [string, string]> = [
  ['events', 'state'],
  ['events', 'state_locked'],
  ['events', 'published_at'],
  ['events', 'archived_at'],
  ['events', 'is_sample'],
  ['world_revisions', 'status'],
  ['world_revisions', 'published_at'],
  ['world_revisions', 'published_by'],
  ['home_revisions', 'status'],
  ['home_revisions', 'published_at'],
  ['home_revisions', 'published_by'],
  ['achievements', 'is_active'],
  ['achievements', 'is_sample'],
  ['carnets', 'member_since'],
  ['bottles', 'moderated_by'],
  ['bottles', 'moderated_at'],
  // T94: la posición sólo la fija place_bottle; la imagen del sello, su RPC.
  ['bottles', 'user_id'],
  ['bottles', 'x'],
  ['bottles', 'y'],
  ['events', 'stamp_image_url'],
];

const CLIENT_ROLES = ['anon', 'authenticated'] as const;

export async function tablesWithoutRls(client: pg.Client): Promise<string[]> {
  const { rows } = await client.query<{ relname: string }>(
    `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
     order by c.relname`,
  );
  return rows.map((r) => r.relname);
}

async function publicTables(client: pg.Client): Promise<string[]> {
  const { rows } = await client.query<{ relname: string }>(
    `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' order by c.relname`,
  );
  return rows.map((r) => r.relname);
}

async function can(
  client: pg.Client,
  role: string,
  table: string,
  privilege: string,
  column?: string,
): Promise<boolean> {
  const sql = column
    ? 'select has_column_privilege($1, $2, $3, $4) as ok'
    : privilege === 'DELETE' || privilege === 'TRUNCATE' || privilege === 'TRIGGER'
      ? 'select has_table_privilege($1, $2, $3) as ok'
      : 'select has_any_column_privilege($1, $2, $3) as ok';
  const params = column
    ? [role, `public.${table}`, column, privilege]
    : [role, `public.${table}`, privilege];
  const { rows } = await client.query<{ ok: boolean }>(sql, params);
  return rows[0]!.ok;
}

/** Lista de permisos de escritura indebidos; vacía si todo está bien. */
export async function clientWriteLeaks(client: pg.Client): Promise<string[]> {
  const leaks: string[] = [];
  const tables = await publicTables(client);

  for (const table of tables) {
    for (const privilege of ['INSERT', 'UPDATE', 'DELETE']) {
      if (await can(client, 'anon', table, privilege)) leaks.push(`anon ${privilege} ${table}`);
    }
    for (const role of CLIENT_ROLES) {
      for (const privilege of ['TRUNCATE', 'TRIGGER']) {
        if (await can(client, role, table, privilege)) leaks.push(`${role} ${privilege} ${table}`);
      }
    }
  }
  for (const table of CLIENT_READ_ONLY_TABLES) {
    for (const role of CLIENT_ROLES) {
      for (const privilege of ['INSERT', 'UPDATE', 'DELETE']) {
        if (await can(client, role, table, privilege)) leaks.push(`${role} ${privilege} ${table}`);
      }
    }
  }
  for (const table of LEDGER_DERIVED_TABLES) {
    for (const privilege of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) {
      if (await can(client, 'service_role', table, privilege)) {
        leaks.push(`service_role ${privilege} ${table}`);
      }
    }
  }
  for (const table of APPEND_ONLY_TABLES) {
    for (const privilege of ['UPDATE', 'DELETE', 'TRUNCATE']) {
      if (await can(client, 'service_role', table, privilege)) {
        leaks.push(`service_role ${privilege} ${table}`);
      }
    }
  }
  for (const [table, column] of CLIENT_READ_ONLY_COLUMNS) {
    for (const role of CLIENT_ROLES) {
      for (const privilege of ['INSERT', 'UPDATE']) {
        if (await can(client, role, table, privilege, column)) {
          leaks.push(`${role} ${privilege} ${table}.${column}`);
        }
      }
    }
  }
  return leaks;
}

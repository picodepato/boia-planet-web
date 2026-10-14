import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EVENT_STATES, HOME_BLOCK_TYPES } from '@boia/contracts';
import { WORLD_SCHEMA_VERSION, parseWorldConfig } from '@boia/world';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clientWriteLeaks, tablesWithoutRls } from './checks.ts';
import { Constants } from './database.types.ts';
import { generateTypes } from './gen-types.ts';
import { listMigrations } from './harness.ts';
import { openTestDatabase, type TestDatabase } from './testing.ts';

let db: TestDatabase;

beforeAll(async () => {
  db = await openTestDatabase();
}, 60_000);

afterAll(async () => {
  await db?.close();
}, 60_000);

describe('esquema', () => {
  it('las migraciones tienen versiones únicas y crecientes', () => {
    const versions = listMigrations().map((m) => m.version);
    expect(versions.length).toBeGreaterThan(0);
    expect(new Set(versions).size).toBe(versions.length);
    expect([...versions].sort()).toEqual(versions);
  });

  it('todas las tablas de public tienen RLS', async () => {
    expect(await tablesWithoutRls(db.client)).toEqual([]);
  });

  it('ningún cliente puede escribir saldos, roles, sellos, compras, libro ni estados', async () => {
    expect(await clientWriteLeaks(db.client)).toEqual([]);
  });

  it('los tipos versionados coinciden con las migraciones (pnpm db:types)', async () => {
    const committed = readFileSync(
      fileURLToPath(new URL('./database.types.ts', import.meta.url)),
      'utf8',
    );
    expect(await generateTypes(db.client)).toBe(committed);
  });

  it('los estados de evento son los siete de @boia/contracts (§49.4)', async () => {
    const { rows } = await db.client.query<{ label: string }>(
      `select unnest(enum_range(null::public.event_state))::text as label`,
    );
    expect(rows.map((r) => r.label)).toEqual([...EVENT_STATES]);
    expect([...Constants.public.Enums.event_state]).toEqual([...EVENT_STATES]);
  });

  it('los tipos de bloque de home son los de @boia/contracts', async () => {
    const { rows } = await db.client.query<{ label: string }>(
      `select unnest(enum_range(null::public.home_block_type))::text as label`,
    );
    expect(rows.map((r) => r.label)).toEqual([...HOME_BLOCK_TYPES]);
  });

  it('las 5 preguntas activas del Carnet son las de REQ-IDE-014', async () => {
    const spec = readFileSync(
      fileURLToPath(new URL('../../../docs/spec/05-identidad-y-comunidad.md', import.meta.url)),
      'utf8',
    );
    const line = spec.split('\n').find((l) => l.includes('REQ-IDE-014'))!;
    const fromSpec = [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    const { rows } = await db.client.query<{ prompt: string }>(
      `select prompt from public.carnet_questions where is_active order by position`,
    );
    expect(rows.map((r) => r.prompt)).toEqual(fromSpec);
  });

  it('el mundo publicado de muestra cumple el esquema de @boia/world', async () => {
    const { rows } = await db.client.query<{ snapshot: unknown; schema_version: number }>(
      `select r.snapshot, r.schema_version from public.world_revisions r
       join public.seasons s on s.active_world_revision_id = r.id where s.is_active`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.schema_version).toBe(WORLD_SCHEMA_VERSION);
    const world = parseWorldConfig(rows[0]!.snapshot);
    expect(world.objects.length).toBeGreaterThan(0);
  });
});

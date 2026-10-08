import { readFileSync } from 'node:fs';
import { COMMON_DISCOUNT_CODE_MAX } from '@boia/contracts';
import { describe, expect, it } from 'vitest';

/**
 * La migración de la ficha del evento y el código común de la ticketera
 * (plan 019 T215), leída como texto: lo que esta máquina puede comprobar sin
 * PostgreSQL. Las pruebas contra la base están en
 * packages/db/src/supabase/event-fields.supabase.ts (`pnpm test:supabase`).
 */
const read = (path: string) => readFileSync(new URL(`../../../../${path}`, import.meta.url), 'utf8');
const SQL = read('supabase/migrations/20261008100100_event_fields_common_code.sql');
const TYPES = read('packages/db/src/database.types.ts');
const CHECKS = read('packages/db/src/checks.ts');

describe('campos de la ficha del evento (T215)', () => {
  it('lugar anunciado, precio, «Solo en puerta» y su precio, editables por el equipo', () => {
    for (const col of [
      'place_announced boolean not null default true',
      'price_cents integer check (price_cents is null or price_cents >= 0)',
      'door_only boolean not null default false',
      'door_price_cents integer check (door_price_cents is null or door_price_cents >= 0)',
    ]) {
      expect(SQL).toContain(`add column ${col}`);
    }
    expect(SQL).toContain('check (door_only or door_price_cents is null)');
    for (const op of ['insert', 'update']) {
      expect(SQL).toContain(
        `grant ${op} (place_announced, price_cents, door_only, door_price_cents)\n  on public.events to authenticated;`,
      );
    }
    for (const col of ['place_announced', 'price_cents', 'door_only', 'door_price_cents']) {
      expect(TYPES).toContain(`          ${col}: `);
    }
    expect(SQL).not.toMatch(/grant (insert|update|delete)[^;]* to [^;]*anon/);
  });
});

describe('código común de la ticketera (T215, decisión 7)', () => {
  it('una sola fila, con RLS, que sólo lee el equipo y no escribe ningún cliente', () => {
    expect(SQL).toContain('create table public.ticketing_settings (');
    expect(SQL).toContain(
      `char_length(btrim(common_discount_code)) between 1 and ${COMMON_DISCOUNT_CODE_MAX}`,
    );
    expect(SQL).toContain('alter table public.ticketing_settings enable row level security;');
    expect(SQL).toContain('grant select on public.ticketing_settings to authenticated;');
    expect(SQL).toContain("using ((select private.has_staff_role('editor')));");
    expect(SQL).not.toMatch(/grant [^;]*(insert|update)[^;]* on public\.ticketing_settings to authenticated/);
    expect(CHECKS).toContain("'ticketing_settings',");
    expect(TYPES).toContain('ticketing_settings: {');
  });

  it('lo fija sólo un admin con segundo factor, con motivo en la auditoría', () => {
    expect(SQL).toContain("actor uuid := private.require_staff('admin');");
    expect(SQL).toContain("perform set_config(\n    'boia.audit_reason',");
    expect(SQL).toContain(
      'revoke all on function public.admin_set_common_discount_code(text, text) from public, anon;',
    );
    expect(TYPES).toContain('admin_set_common_discount_code: {');
  });

  it('el código sólo llega a quien encontró ese descuento de entradas', () => {
    expect(SQL).toContain("join public.discounts d on d.id = p_discount and d.scope = 'event'");
    expect(SQL).toContain('u.user_id = (select auth.uid())');
    expect(SQL).toContain(
      'revoke all on function public.discount_code_for(text) from public, anon;',
    );
    expect(TYPES).toContain('discount_code_for: {');
  });
});

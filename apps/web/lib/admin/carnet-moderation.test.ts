import { readFileSync } from 'node:fs';
import { RPC_REJECTIONS } from '@boia/db/rpc';
import { MemoryStorage, createLocalRepository } from '@boia/store';
import { WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { AdminError, createAdminActions } from './actions';

/**
 * Plan 020 T229: la moderación fina de un Carnet. En la demo local, por las
 * acciones del Admin; con cuentas, la migración 20261008200100 leída como
 * texto (lo que esta máquina comprueba sin PostgreSQL). Las pruebas contra la
 * base están en packages/db/src/supabase/carnet-moderation.supabase.ts
 * (`pnpm test:supabase`).
 */

const now = () => new Date('2026-10-08T10:00:00Z');
const SC = { platform: 'soundcloud', url: 'https://soundcloud.com/zeta' } as const;

function setup() {
  const repo = createLocalRepository({ storage: new MemoryStorage(), now, watch: false });
  return { repo, actions: createAdminActions({ repo, registry: WORLD_REGISTRY, now }) };
}

describe('el enlace a la música de un artista desde el Admin (demo local)', () => {
  it('pide motivo y un enlace que valga; vacío lo quita y «Deshacer» lo devuelve', async () => {
    const { repo, actions } = setup();
    const c = await repo.carnet.create({ nickname: 'Zeta', artistCode: 'abc', musicLink: SC });
    await expect(actions.setCarnetMusic(c.userId, '', '  ')).rejects.toBeInstanceOf(AdminError);
    await expect(
      actions.setCarnetMusic(c.userId, 'https://youtube.com/@zeta', 'otro'),
    ).rejects.toBeInstanceOf(AdminError);

    await actions.setCarnetMusic(c.userId, 'zeta.bandcamp.com', 'enlace roto');
    expect((await repo.carnet.get(c.userId))?.musicLink).toEqual({
      platform: 'bandcamp',
      url: 'https://zeta.bandcamp.com/',
    });
    await actions.setCarnetMusic(c.userId, '', 'spam');
    expect((await repo.carnet.get(c.userId))?.musicLink).toBeUndefined();

    const [last] = await repo.admin.changes();
    expect(last).toMatchObject({ area: 'carnets', targetId: `${c.userId}/music`, reason: 'spam' });
    await actions.revertChange(last!.id);
    expect((await repo.carnet.get(c.userId))?.musicLink?.platform).toBe('bandcamp');
  });
});

const read = (path: string) =>
  readFileSync(new URL(`../../../../${path}`, import.meta.url), 'utf8');
const SQL = read('supabase/migrations/20261008200100_carnet_answer_music_moderation.sql');
const TYPES = read('packages/db/src/database.types.ts');
const PUBLIC_RPCS = [
  'admin_carnet_content',
  'admin_remove_carnet_answer',
  'admin_set_carnet_music',
  'admin_list_moderation_trash',
  'admin_undo_carnet_moderation',
] as const;

/** El cuerpo de una función de la migración. */
function body(name: string): string {
  const start = SQL.indexOf(`create function ${name}(`);
  expect(start, name).toBeGreaterThanOrEqual(0);
  return SQL.slice(start, SQL.indexOf('$$;', start));
}

describe('moderación fina con cuentas: RPC y permisos (migración 20261008200100)', () => {
  it('cada RPC pide rol admin con aal2, es security definer y nunca la llama anon', () => {
    for (const name of PUBLIC_RPCS) {
      const fn = body(`private.${name}`);
      expect(fn, name).toContain("private.require_staff('admin')");
      expect(fn, name).toContain('security definer');
      expect(fn, name).toContain("set search_path = ''");
      expect(body(`public.${name}`), name).toContain(`private.${name}(`);
      expect(SQL).toMatch(
        new RegExp(`revoke all on function private\\.${name}\\([^)]*\\) from public;`),
      );
      expect(SQL).toMatch(
        new RegExp(`revoke all on function public\\.${name}\\([^)]*\\) from public, anon;`),
      );
      expect(SQL).toMatch(
        new RegExp(`grant execute on function public\\.${name}\\([^)]*\\) to authenticated;`),
      );
      expect(TYPES, name).toContain(`      ${name}: {`);
    }
  });

  it('retirar o cambiar pide motivo y deja auditoría; los rechazos están catalogados', () => {
    for (const name of ['admin_remove_carnet_answer', 'admin_set_carnet_music']) {
      const fn = body(`private.${name}`);
      expect(fn, name).toContain("raise exception 'reason_required'");
      expect(fn, name).toContain('insert into private.carnet_moderation_trash');
      expect(fn, name).toContain('insert into public.audit_log');
    }
    expect(body('private.admin_set_carnet_music')).toContain('private.music_url_ok(platform, url)');
    expect(body('private.admin_set_carnet_music')).toContain("raise exception 'artist_required'");
    for (const m of SQL.matchAll(/raise exception '([a-z_]+)'/g)) {
      expect(RPC_REJECTIONS).toContain(m[1]);
    }
  });

  it('deshacer no pisa lo que su dueño cambió después', () => {
    const fn = body('private.admin_undo_carnet_moderation');
    expect(fn).toContain("raise exception 'answer_exists'");
    expect(fn).toContain("raise exception 'music_changed'");
    expect(fn).toContain("raise exception 'unknown_trash'");
  });

  it('la papelera queda fuera del alcance de los clientes y dura 30 días', () => {
    expect(SQL).toContain('create table private.carnet_moderation_trash (');
    expect(SQL).toContain(
      'alter table private.carnet_moderation_trash enable row level security;',
    );
    expect(SQL).toContain(
      'revoke all on private.carnet_moderation_trash from public, anon, authenticated;',
    );
    expect(body('private.moderation_trash_days')).toMatch(/select 30\b/);
    expect(body('private.admin_list_moderation_trash')).toContain(
      'make_interval(days => private.moderation_trash_days())',
    );
    for (const name of ['admin_remove_carnet_answer', 'admin_set_carnet_music']) {
      expect(body(`private.${name}`)).toContain('private.purge_moderation_trash()');
    }
    // Ningún cliente toca las columnas de la música a mano.
    expect(SQL).not.toMatch(/grant (insert|update)[^;]*music_/);
  });
});

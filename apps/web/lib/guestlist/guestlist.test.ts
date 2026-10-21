import { readFileSync } from 'node:fs';
import { RPC_REJECTIONS } from '@boia/db/rpc';
import { createLocalRepository, HALLOWEEN_EVENT_ID } from '@boia/store';
import { describe, expect, it } from 'vitest';
import type { BoiaSupabase } from '../supabase/browser';
import {
  adminError,
  GuestListError,
  localGuestList,
  memberRejection,
  statusFromRpc,
  supabaseGuestList,
} from './index';

/**
 * El cliente de la lista (plan 034 T308): las RPC de
 * 20261021200100_guest_lists.sql traducidas a `GuestListApi`, y la demo.
 * Las reglas contra la base: packages/db/src/supabase/guest-list.supabase.ts.
 */
const SQL = readFileSync(
  new URL('../../../../supabase/migrations/20261021200100_guest_lists.sql', import.meta.url),
  'utf8',
);

type Call = { fn: string; args: Record<string, unknown> };

/** Un cliente de Supabase falso: cada RPC responde lo que diga `reply`. */
function fakeSb(reply: (c: Call) => { data?: unknown; error?: unknown }) {
  const calls: Call[] = [];
  const sb = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      const c = { fn, args };
      calls.push(c);
      const r = reply(c);
      return { data: r.data ?? null, error: r.error ?? null };
    },
  } as unknown as BoiaSupabase;
  return { sb, calls };
}

const STATUS = {
  event: 'halloween-2026',
  enabled: true,
  cap: 100,
  closes_at: '2026-10-31T21:30:00+00:00',
  open: true,
  past_closing: false,
  closed: false,
  full: false,
  mine: { list_name: 'Pepa', created_at: '2026-10-21T10:00:00+00:00' },
};

describe('la migración', () => {
  it('cada rechazo lo conoce la web y el cliente sabe traducir los del socio', () => {
    for (const m of SQL.matchAll(/raise exception '([a-z_]+)'/g)) {
      expect(RPC_REJECTIONS).toContain(m[1]);
    }
    for (const r of ['not_enabled', 'closed', 'full', 'carnet_required', 'unknown_event']) {
      expect(memberRejection({ message: r })).toBe(r);
    }
    expect(memberRejection({ message: 'invalid_input' })).toBe('invalid_name');
  });

  it('las inscripciones y los ajustes sólo se escriben con las RPC; RLS en las dos tablas', () => {
    for (const t of ['event_guest_lists', 'guest_list_signups']) {
      expect(SQL).toContain(`alter table public.${t} enable row level security;`);
      expect(SQL).not.toMatch(
        new RegExp(`grant (insert|update|delete)[^;]*${t} to (anon|authenticated)`),
      );
    }
    expect(SQL).toMatch(/create or replace function private\.guest_list_join[^$]*security definer/);
    expect(SQL).toContain(
      'revoke all on function public.guest_list_join(text, text) from public, anon;',
    );
  });

  it('Halloween va en lista: tope 100, cierra a las 22:30 del 31 (Europe/Madrid)', () => {
    expect(SQL).toContain("timestamp '2026-10-31 22:30' at time zone 'Europe/Madrid'");
    const seed = readFileSync(
      new URL('../../../../supabase/seeds/20261021200100_guest_lists.sql', import.meta.url),
      'utf8',
    );
    expect(seed).toContain("where e.slug = 'halloween-2026'");
    expect(seed).toContain("select e.id, true, 100, timestamp '2026-10-31 22:30'");
  });
});

describe('con cuentas (RPC)', () => {
  it('status: de snake_case a camelCase, sin contador', async () => {
    const { sb, calls } = fakeSb(() => ({ data: STATUS }));
    const s = await supabaseGuestList(sb).status('halloween-2026');
    expect(calls).toEqual([{ fn: 'guest_list_status', args: { p_event: 'halloween-2026' } }]);
    expect(s).toEqual({
      event: 'halloween-2026',
      enabled: true,
      cap: 100,
      closesAt: '2026-10-31T21:30:00+00:00',
      open: true,
      pastClosing: false,
      closed: false,
      full: false,
      mine: { listName: 'Pepa', createdAt: '2026-10-21T10:00:00+00:00' },
    });
    expect(statusFromRpc({ ...STATUS, count: 3 }).count).toBe(3);
  });

  it('status de una fiesta que no existe: no va en lista', async () => {
    const { sb } = fakeSb(() => ({ error: { message: 'unknown_event' } }));
    expect(await supabaseGuestList(sb).status('x')).toMatchObject({ enabled: false, closed: true });
  });

  it('join: created, existing o rejected; sin sesión, not_member', async () => {
    const replies = [
      { data: { created: true, event: 'h', list_name: 'Pepa', created_at: 't1' } },
      { data: { created: false, event: 'h', list_name: 'Pepa', created_at: 't1' } },
      { error: { message: 'full' } },
      { error: { code: '42501', message: 'permission denied for function guest_list_join' } },
    ];
    const { sb, calls } = fakeSb(() => replies.shift()!);
    const gl = supabaseGuestList(sb);
    expect(await gl.join('h', '  Pepa ')).toEqual({
      kind: 'created',
      signup: { listName: 'Pepa', createdAt: 't1' },
    });
    expect(calls[0]).toEqual({ fn: 'guest_list_join', args: { p_event: 'h', p_name: 'Pepa' } });
    expect((await gl.join('h')).kind).toBe('existing');
    expect(calls[1]!.args).toEqual({ p_event: 'h' });
    expect(await gl.join('h')).toEqual({ kind: 'rejected', reason: 'full' });
    expect(await gl.join('h')).toEqual({ kind: 'rejected', reason: 'not_member' });
  });

  it('join: un error que no es una regla se lanza', async () => {
    const { sb } = fakeSb(() => ({ error: { message: 'fetch failed' } }));
    await expect(supabaseGuestList(sb).join('h')).rejects.toThrow('fetch failed');
  });

  it('leave: removed, not_signed_up o closed', async () => {
    const replies = [
      { data: { removed: true, event: 'h' } },
      { data: { removed: false, event: 'h' } },
      { error: { message: 'closed' } },
    ];
    const { sb } = fakeSb(() => replies.shift()!);
    const gl = supabaseGuestList(sb);
    expect(await gl.leave('h')).toEqual({ kind: 'removed' });
    expect(await gl.leave('h')).toEqual({ kind: 'not_signed_up' });
    expect(await gl.leave('h')).toEqual({ kind: 'rejected', reason: 'closed' });
  });

  it('admin: la lista con «entró», borrar y ajustes; sin rol, GuestListError forbidden', async () => {
    const { sb, calls } = fakeSb(({ fn }) => {
      if (fn === 'admin_guest_list') {
        return {
          data: [
            {
              user_id: 'u1',
              list_name: 'Pepa',
              nickname: 'Pepa',
              email: 'pepa@example.test',
              created_at: 't1',
              attended: true,
              attended_at: 't2',
            },
          ],
        };
      }
      if (fn === 'admin_guest_list_remove') return { data: { removed: true, event: 'h' } };
      if (fn === 'admin_guest_list_settings') return { data: { ...STATUS, mine: null, count: 1 } };
      return { error: { message: 'forbidden', code: '42501' } };
    });
    const gl = supabaseGuestList(sb);
    expect(await gl.admin.list('h')).toEqual([
      {
        userId: 'u1',
        listName: 'Pepa',
        nickname: 'Pepa',
        email: 'pepa@example.test',
        createdAt: 't1',
        attended: true,
        attendedAt: 't2',
      },
    ]);
    expect(await gl.admin.remove('h', 'u1', ' duplicada ')).toEqual({ removed: true });
    expect(calls.at(-1)!.args).toEqual({ p_event: 'h', p_member: 'u1', p_reason: 'duplicada' });
    const s = await gl.admin.updateSettings('h', {
      enabled: true,
      cap: 100,
      closesAt: null,
      open: false,
    });
    expect(s.count).toBe(1);
    expect(calls.at(-1)!.args).toEqual({
      p_event: 'h',
      p_enabled: true,
      p_cap: 100,
      p_closes_at: null,
      p_open: false,
    });
    const err = await gl.admin.status('h').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GuestListError);
    expect((err as GuestListError).code).toBe('forbidden');
    expect(adminError({ message: 'invalid_input', details: 'tope' }).code).toBe('invalid_input');
  });

  it('door: en la lista, con qué nombre y si pasó la hora', async () => {
    const { sb, calls } = fakeSb(() => ({
      data: {
        event: 'h',
        enabled: true,
        on_list: true,
        list_name: 'Pepa',
        created_at: 't1',
        closes_at: 't9',
        past_closing: true,
      },
    }));
    expect(await supabaseGuestList(sb).door('h', 'u1')).toEqual({
      enabled: true,
      onList: true,
      listName: 'Pepa',
      createdAt: 't1',
      closesAt: 't9',
      pastClosing: true,
    });
    expect(calls[0]).toEqual({ fn: 'guest_list_door', args: { p_member: 'u1', p_event: 'h' } });
  });
});

describe('la demo (sin Supabase)', () => {
  it('apuntarse con el Carnet de este navegador en Halloween', async () => {
    const repo = createLocalRepository({ storage: null, watch: false });
    await repo.carnet.create({ nickname: 'Demo Lista' });
    const gl = localGuestList(repo);
    const r = await gl.join(HALLOWEEN_EVENT_ID);
    expect(r).toMatchObject({ kind: 'created', signup: { listName: 'Demo Lista' } });
    expect((await gl.status(HALLOWEEN_EVENT_ID)).mine?.listName).toBe('Demo Lista');
  });
});

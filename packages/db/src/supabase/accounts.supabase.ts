/**
 * Cuentas (plan 008, decisiones 3, 5 y 11) contra el proyecto de desarrollo:
 * save_profile, set_news_opt_in, delete_my_account, las RPC del Admin y la
 * RLS de consentimientos, emails y códigos de sello para anon, otra cuenta y
 * el Admin con y sin segundo factor.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ProfileResult } from '../rpc.ts';
import {
  context,
  dropEvents,
  expectDenied,
  expectRejected,
  ok,
  testEvent,
  type Member,
} from './context.ts';
import { elevateToAal2, testRunId } from './testkit.ts';

const ctx = context();
const POLICY = 'muestra-2026-10-03';
const run = testRunId();
const nick = (s: string) => `${s} ${run}`;
const events: string[] = [];

let a: Member;
let b: Member;
let admin: Member;

beforeAll(async () => {
  a = await ctx.member('cuenta-a');
  b = await ctx.member('cuenta-b');
  admin = await ctx.member('admin');
  await ok(ctx.service.from('staff_roles').insert({ user_id: admin.id, role: 'admin' }));
});

afterAll(async () => {
  await ctx.cleanup();
  await dropEvents(ctx, events);
});

describe('save_profile: el Carnet con apodo único, filtro y política aceptada', () => {
  it('sin aceptar la política no hay Carnet', async () => {
    await expectRejected(
      a.client.rpc('save_profile', { p_nickname: nick('Ana') }),
      'privacy_required',
    );
  });

  it('rechaza apodos cortos, ofensivos o con enlaces, emails o teléfonos', async () => {
    const p = { p_privacy_version: POLICY };
    await expectRejected(
      a.client.rpc('save_profile', { ...p, p_nickname: 'x' }),
      'nickname_invalid',
    );
    await expectRejected(
      a.client.rpc('save_profile', { ...p, p_nickname: 'Gilipollas 3000' }),
      'text_offensive',
    );
    await expectRejected(
      a.client.rpc('save_profile', { ...p, p_nickname: 'ven a boia.com' }),
      'text_link',
    );
    await expectRejected(
      a.client.rpc('save_profile', { ...p, p_nickname: 'yo@correo.es' }),
      'text_email',
    );
    await expectRejected(
      a.client.rpc('save_profile', { ...p, p_nickname: 'tel 600 123 456' }),
      'text_phone',
    );
  });

  it('crea el Carnet con número de socio y guarda la política con su versión', async () => {
    const profile = (await ok(
      a.client.rpc('save_profile', {
        p_nickname: nick('Ana'),
        p_privacy_version: POLICY,
        p_news: false,
      }),
    )) as unknown as ProfileResult;
    expect(profile.nickname).toBe(nick('Ana'));
    expect(profile.member_number).toBeGreaterThan(0);
    expect(profile.privacy_version).toBe(POLICY);
    expect(profile.news).toBe(false);
    expect(profile.is_artist).toBe(false);
  });

  it('el apodo es único sin distinguir mayúsculas', async () => {
    await expectRejected(
      b.client.rpc('save_profile', { p_nickname: nick('ANA'), p_privacy_version: POLICY }),
      'nickname_taken',
    );
    const profile = (await ok(
      b.client.rpc('save_profile', {
        p_nickname: nick('Berta'),
        p_privacy_version: POLICY,
        p_news: true,
      }),
    )) as unknown as ProfileResult;
    expect(profile.news).toBe(true);
  });

  it('cambiar el apodo después no pide otra vez la política', async () => {
    const profile = (await ok(
      a.client.rpc('save_profile', { p_nickname: nick('Ana María'), p_avatar_key: 'avatar-3' }),
    )) as unknown as ProfileResult;
    expect(profile.nickname).toBe(nick('Ana María'));
    expect(profile.avatar_key).toBe('avatar-3');
  });

  it('sin cuenta no se llama', async () => {
    await expectDenied(ctx.anon.rpc('save_profile', { p_nickname: nick('Nadie') }));
  });

  it('el cliente no escribe el Carnet directamente', async () => {
    await expectDenied(
      a.client
        .from('carnets')
        .update({ nickname: nick('Directo') })
        .eq('user_id', a.id),
    );
    await expectDenied(b.client.from('carnets').insert({ user_id: b.id, nickname: nick('Otro') }));
  });
});

describe('consentimientos y emails: sólo su dueño y el Admin con TOTP', () => {
  it('set_news_opt_in añade el consentimiento de noticias con su fecha', async () => {
    expect(await ok(a.client.rpc('set_news_opt_in', { p_news: true }))).toEqual({ news: true });
    const rows = await ok(
      a.client
        .from('consents')
        .select('kind, granted, policy_version, created_at')
        .eq('user_id', a.id),
    );
    expect(rows.map((r) => `${r.kind}:${r.granted}`)).toEqual(
      expect.arrayContaining(['privacy:true', 'news:false', 'news:true']),
    );
    expect(rows.every((r) => r.policy_version === POLICY && Boolean(r.created_at))).toBe(true);
    await expectRejected(
      a.client.rpc('set_news_opt_in', { p_news: null as unknown as boolean }),
      'invalid_input',
    );
  });

  it('otra cuenta no lee los consentimientos ajenos; anon, ninguno', async () => {
    expect(await ok(b.client.from('consents').select('id').eq('user_id', a.id))).toEqual([]);
    await expectDenied(ctx.anon.from('consents').select('id'));
  });

  it('nadie escribe consentimientos directamente', async () => {
    await expectDenied(
      a.client
        .from('consents')
        .insert({ user_id: a.id, kind: 'news', granted: true, policy_version: 'x' }),
    );
  });

  it('el Carnet público no lleva email', async () => {
    const rows = await ok(ctx.anon.from('carnets').select('*').eq('user_id', a.id));
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]!)).not.toContain('email');
    expect(JSON.stringify(rows[0])).not.toContain(a.email);
  });

  it('la lista de socios con email no es para anon ni para un socio', async () => {
    await expectDenied(ctx.anon.rpc('admin_list_members', {}));
    await expectRejected(b.client.rpc('admin_list_members', {}), 'forbidden');
  });
});

describe('Admin: rol del equipo y segundo factor (aal2)', () => {
  let stampEvent: { id: string; slug: string; code: string };

  beforeAll(async () => {
    const now = Date.now();
    stampEvent = await testEvent(ctx, `t86-${run}-admin`, {
      from: new Date(now - 3600_000),
      until: new Date(now + 3600_000),
    });
    events.push(stampEvent.id);
  });

  it('con el rol pero sin TOTP (aal1) no hay permisos', async () => {
    await expectRejected(admin.client.rpc('admin_list_members', {}), 'forbidden');
    await expectRejected(
      admin.client.rpc('admin_set_artist', { p_user: a.id, p_is_artist: true }),
      'forbidden',
    );
    expect(await ok(admin.client.from('event_stamp_codes').select('event_id'))).toEqual([]);
  });

  it('con TOTP lista los socios con su email y su consentimiento de noticias', async () => {
    await elevateToAal2(admin.client);
    const all = await ok(admin.client.rpc('admin_list_members', { p_search: run, p_limit: 1000 }));
    const byId = new Map(all.map((m) => [m.user_id, m]));
    expect(byId.get(a.id)?.email).toBe(a.email);
    expect(byId.get(a.id)?.news).toBe(true);
    expect(byId.get(a.id)?.privacy_version).toBe(POLICY);
    expect(byId.get(b.id)?.nickname).toBe(nick('Berta'));
    const optIn = await ok(
      admin.client.rpc('admin_list_members', { p_search: run, p_news_only: true, p_limit: 1000 }),
    );
    expect(optIn.every((m) => m.news)).toBe(true);
    expect(optIn.map((m) => m.user_id)).toEqual(expect.arrayContaining([a.id, b.id]));
  });

  it('marca y desmarca un Carnet como artista, y queda en la auditoría', async () => {
    const on = (await ok(
      admin.client.rpc('admin_set_artist', { p_user: a.id, p_is_artist: true, p_reason: 'prueba' }),
    )) as unknown as ProfileResult;
    expect(on.is_artist).toBe(true);
    const pub = await ok(ctx.anon.from('carnets').select('is_artist').eq('user_id', a.id).single());
    expect(pub.is_artist).toBe(true);
    const audit = await ok(
      admin.client
        .from('audit_log')
        .select('action, reason')
        .eq('entity_id', a.id)
        .eq('action', 'set_artist'),
    );
    expect(audit.length).toBeGreaterThan(0);
    await expectRejected(
      admin.client.rpc('admin_set_artist', {
        p_user: '00000000-0000-4000-8000-000000000000',
        p_is_artist: true,
      }),
      'unknown_member',
    );
  });

  it('lee y regenera el código del QR; nadie más lo lee', async () => {
    const codes = await ok(
      admin.client.from('event_stamp_codes').select('code').eq('event_id', stampEvent.id),
    );
    expect(codes).toEqual([{ code: stampEvent.code }]);
    expect(await ok(a.client.from('event_stamp_codes').select('code'))).toEqual([]);
    await expectDenied(ctx.anon.from('event_stamp_codes').select('code'));

    const from = new Date(Date.now() - 600_000).toISOString();
    const until = new Date(Date.now() + 600_000).toISOString();
    const res = (await ok(
      admin.client.rpc('admin_set_stamp_code', {
        p_event: stampEvent.slug,
        p_valid_from: from,
        p_valid_until: until,
      }),
    )) as { code: string };
    expect(res.code).not.toBe(stampEvent.code);
    await expectRejected(
      a.client.rpc('claim_stamp', { p_event: stampEvent.slug, p_code: stampEvent.code }),
      'invalid_code',
    );
    await expectRejected(
      admin.client.rpc('admin_set_stamp_code', {
        p_event: stampEvent.slug,
        p_valid_from: until,
        p_valid_until: from,
      }),
      'invalid_window',
    );
    await expectRejected(
      a.client.rpc('admin_set_stamp_code', {
        p_event: stampEvent.slug,
        p_valid_from: from,
        p_valid_until: until,
      }),
      'forbidden',
    );
  });

  // Desde el plan 020 T230 (20261008200200) borrar va a la papelera de 30
  // días: la cuenta sigue, bloqueada y sin Carnet. Lo prueba a fondo
  // trash.supabase.ts.
  it('borra una cuenta duplicada con motivo; no las del equipo; un socio no borra a nadie', async () => {
    const dup = await ctx.user('duplicada');
    await ok(ctx.service.from('carnets').insert({ user_id: dup.id, nickname: nick('Duplicada') }));
    await expectRejected(
      b.client.rpc('admin_delete_member', { p_user: dup.id, p_reason: 'duplicada' }),
      'forbidden',
    );
    await expectRejected(
      admin.client.rpc('admin_delete_member', { p_user: dup.id, p_reason: '' }),
      'reason_required',
    );
    await expectRejected(
      admin.client.rpc('admin_delete_member', { p_user: admin.id, p_reason: 'no se puede' }),
      'forbidden',
    );
    await ok(
      admin.client.rpc('admin_delete_member', { p_user: dup.id, p_reason: 'Carnet duplicado' }),
    );
    const banned = await ctx.service.auth.admin.getUserById(dup.id);
    expect(new Date(banned.data.user!.banned_until!).getTime()).toBeGreaterThan(Date.now());
    expect(await ok(ctx.anon.from('carnets').select('user_id').eq('user_id', dup.id))).toEqual([]);
    const audit = await ok(
      admin.client
        .from('audit_log')
        .select('action, reason')
        .eq('entity_id', dup.id)
        .eq('action', 'trash_member'),
    );
    expect(audit).toEqual([{ action: 'trash_member', reason: 'Carnet duplicado' }]);
  });
});

describe('delete_my_account: la cuenta se borra desde el Carnet', () => {
  it('borra la cuenta, su Carnet y sus puntos; sin sesión no se llama', async () => {
    await expectDenied(ctx.anon.rpc('delete_my_account'));
    const e = await ctx.member('se-borra');
    await ok(
      e.client.rpc('save_profile', { p_nickname: nick('Se Borra'), p_privacy_version: POLICY }),
    );
    await ok(
      e.client.rpc('award_points', { p_action: 'world', p_ref: 'lugar:cala:points', p_points: 20 }),
    );
    await ok(e.client.rpc('delete_my_account'));
    expect((await ctx.service.auth.admin.getUserById(e.id)).data.user).toBeNull();
    expect(await ok(ctx.anon.from('carnets').select('user_id').eq('user_id', e.id))).toEqual([]);
    expect(await ok(ctx.anon.from('point_balances').select('user_id').eq('user_id', e.id))).toEqual(
      [],
    );
  });
});

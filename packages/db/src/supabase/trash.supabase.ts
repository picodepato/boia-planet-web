/**
 * La papelera de 30 días con datos reales (plan 020 T230, decisión 6,
 * migración 20261008200200) contra el proyecto de desarrollo:
 *
 * - borrar un socio lo esconde en todas partes (Carnet, respuestas,
 *   rankings, botellas, Las Calitas, «Socios y emails») y lo deja sin entrar;
 *   devolverlo lo pone todo como estaba; si su apodo ya es de otra persona no
 *   se devuelve;
 * - borrar una fiesta la esconde (web, equipo, sello del QR); devolverla la
 *   vuelve a enseñar;
 * - la purga borra de verdad lo que pasó 30 días (el reloj se adelanta con
 *   service_role) y deja oculta la fiesta que alguien tiene en su historial;
 * - un socio, anon o un admin sin service_role no tocan nada de esto.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TrashList, TrashPurgeResult } from '../rpc.ts';
import {
  context,
  dropEvents,
  expectDenied,
  expectRejected,
  ok,
  testEvent,
  type Member,
} from './context.ts';
import { elevateToAal2, signIn, testRunId } from './testkit.ts';

const ctx = context();
const POLICY = 'muestra-2026-10-08';
const run = testRunId();
const nick = (s: string) => `${s} ${run}`.slice(0, 30);
const events: string[] = [];
const DAY = 24 * 3600_000;

let admin: Member;
let fan: Member;
let victim: Member;
let victimNick: string;
let victimNumber: number;
let victimBottle: string;
let questionId: string;

const trash = async () =>
  (await ok(admin.client.rpc('admin_list_trash', { p_limit: 500 }))) as unknown as TrashList;

const carnetOf = async (userId: string) =>
  ok(ctx.anon.from('carnets').select('nickname, member_number').eq('user_id', userId));

const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();

beforeAll(async () => {
  admin = await ctx.member('papelera-admin');
  await ok(ctx.service.from('staff_roles').insert({ user_id: admin.id, role: 'admin' }));
  await elevateToAal2(admin.client);
  fan = await ctx.member('papelera-socio');
  victim = await ctx.member('papelera-victima');
  await ok(
    fan.client.rpc('save_profile', { p_nickname: nick('Papelera Fan'), p_privacy_version: POLICY }),
  );
  victimNick = nick('Papelera Vic');
  const profile = (await ok(
    victim.client.rpc('save_profile', { p_nickname: victimNick, p_privacy_version: POLICY }),
  )) as unknown as { member_number: number };
  victimNumber = Number(profile.member_number);
  const q = await ok(
    ctx.anon
      .from('carnet_questions')
      .select('id, version')
      .eq('is_active', true)
      .order('position')
      .limit(1)
      .single(),
  );
  questionId = q.id;
  await ok(
    victim.client.from('carnet_answers').insert({
      user_id: victim.id,
      question_id: q.id,
      question_version: q.version,
      answer: `respuesta T230 ${run}`,
    }),
  );
  await ok(
    victim.client.rpc('place_bottle', { p_message: `botella T230 ${run}`, p_x: 0.3, p_y: 0.4 }),
  );
  const bottle = await ok(
    ctx.service
      .from('bottles')
      .select('id')
      .eq('user_id', victim.id)
      .eq('status', 'active')
      .single(),
  );
  victimBottle = bottle.id;
  await ok(victim.client.rpc('calitas_post', { p_body: `comentario T230 ${run}` }));
});

afterAll(async () => {
  await ctx.cleanup();
  await dropEvents(ctx, events);
});

describe('papelera con cuentas: permisos', () => {
  it('un socio no lista, ni borra, ni devuelve, ni purga; anon tampoco', async () => {
    await expectRejected(fan.client.rpc('admin_list_trash', {}), 'forbidden');
    await expectRejected(
      fan.client.rpc('admin_restore_member', { p_user: victim.id }),
      'forbidden',
    );
    await expectRejected(
      fan.client.rpc('admin_delete_event', { p_event: 'nada', p_reason: 'no puede' }),
      'forbidden',
    );
    await expectRejected(fan.client.rpc('admin_purge_expired_trash'), 'forbidden');
    await expectDenied(ctx.anon.rpc('admin_list_trash', {}));
    await expectDenied(ctx.anon.rpc('admin_restore_member', { p_user: victim.id }));
    // La purga diaria es de service_role (y del flujo de copias); ni un admin la llama.
    await expectDenied(fan.client.rpc('purge_expired_trash'));
    await expectDenied(admin.client.rpc('purge_expired_trash'));
    // La tabla de la papelera no la lee ningún cliente.
    await expectDenied(admin.client.from('member_trash').select('user_id'));
  });
});

describe('papelera con cuentas: socios', () => {
  it('borrar un socio lo esconde en todas partes y lo deja sin entrar', async () => {
    const before = (await ok(victim.client.rpc('ranking_points', { p_limit: 1 }))) as unknown as {
      mine: { user_id: string } | null;
    };
    expect(before.mine?.user_id).toBe(victim.id);

    await ok(
      admin.client.rpc('admin_delete_member', { p_user: victim.id, p_reason: 'prueba T230' }),
    );
    // Ni el Carnet ni sus respuestas.
    expect(await carnetOf(victim.id)).toEqual([]);
    expect(
      await ok(ctx.anon.from('carnet_answers').select('question_id').eq('user_id', victim.id)),
    ).toEqual([]);
    // Ni en los rankings, ni sus botellas, ni sus comentarios.
    const after = (await ok(victim.client.rpc('ranking_points', { p_limit: 1 }))) as unknown as {
      mine: unknown;
    };
    expect(after.mine).toBeNull();
    expect(await ok(ctx.anon.from('bottles').select('id').eq('id', victimBottle))).toEqual([]);
    const comments = (await ok(ctx.anon.rpc('calitas_list', {}))) as unknown as {
      body: string;
    }[];
    expect(comments.some((c) => c.body === `comentario T230 ${run}`)).toBe(false);
    // Ni en «Socios y emails» (ni en el CSV de noticias).
    const members = await ok(
      admin.client.rpc('admin_list_members', { p_search: victim.email, p_limit: 10 }),
    );
    expect(members).toEqual([]);
    // Su token aún vivo ya no es de socio; y no vuelve a entrar.
    await expectRejected(
      victim.client.rpc('save_profile', { p_nickname: victimNick, p_privacy_version: POLICY }),
      'not_member',
    );
    await expect(signIn(ctx.env, ctx.service, victim.email)).rejects.toThrow();
    // En la papelera, con su plazo de 30 días.
    const item = (await trash()).members.find((m) => m.user_id === victim.id);
    expect(item).toMatchObject({
      nickname: victimNick,
      member_number: victimNumber,
      reason: 'prueba T230',
      email: victim.email,
    });
    expect(new Date(item!.expires_at).getTime() - new Date(item!.deleted_at).getTime()).toBe(
      30 * DAY,
    );
    // Dos veces no.
    await expectRejected(
      admin.client.rpc('admin_delete_member', { p_user: victim.id, p_reason: 'otra vez' }),
      'unknown_member',
    );
  });

  it('devolverlo pone todo como estaba y vuelve a entrar', async () => {
    await ok(admin.client.rpc('admin_restore_member', { p_user: victim.id }));
    expect(await carnetOf(victim.id)).toEqual([
      { nickname: victimNick, member_number: victimNumber },
    ]);
    expect(
      await ok(ctx.anon.from('carnet_answers').select('question_id').eq('user_id', victim.id)),
    ).toEqual([{ question_id: questionId }]);
    expect(await ok(ctx.anon.from('bottles').select('id').eq('id', victimBottle))).toEqual([
      { id: victimBottle },
    ]);
    expect((await trash()).members.some((m) => m.user_id === victim.id)).toBe(false);
    const again = await signIn(ctx.env, ctx.service, victim.email);
    const mine = (await ok(again.rpc('ranking_points', { p_limit: 1 }))) as unknown as {
      mine: { user_id: string } | null;
    };
    expect(mine.mine?.user_id).toBe(victim.id);
    await expectRejected(
      admin.client.rpc('admin_restore_member', { p_user: victim.id }),
      'unknown_trash',
    );
  });

  it('no se devuelve si su apodo ya es de otra persona', async () => {
    const dup = await ctx.member('papelera-dup');
    const dupNick = nick('Papelera Dup');
    await ok(dup.client.rpc('save_profile', { p_nickname: dupNick, p_privacy_version: POLICY }));
    await ok(admin.client.rpc('admin_delete_member', { p_user: dup.id, p_reason: 'duplicado' }));
    const thief = await ctx.member('papelera-apodo');
    await ok(thief.client.rpc('save_profile', { p_nickname: dupNick, p_privacy_version: POLICY }));
    await expectRejected(
      admin.client.rpc('admin_restore_member', { p_user: dup.id }),
      'nickname_taken',
    );
    expect((await trash()).members.some((m) => m.user_id === dup.id)).toBe(true);
  });
});

describe('papelera con cuentas: fiestas', () => {
  it('borrar una fiesta la esconde (web, equipo y QR) y devolverla la enseña', async () => {
    const now = Date.now();
    const party = await testEvent(ctx, `t230-${run}-a`, {
      from: new Date(now - 3600_000),
      until: new Date(now + 3600_000),
    });
    events.push(party.id);
    expect(await ok(ctx.anon.from('events').select('id').eq('id', party.id))).toHaveLength(1);
    await expectRejected(
      admin.client.rpc('admin_delete_event', { p_event: party.slug, p_reason: '' }),
      'reason_required',
    );
    await ok(
      admin.client.rpc('admin_delete_event', { p_event: party.slug, p_reason: 'fiesta repetida' }),
    );
    expect(await ok(ctx.anon.from('events').select('id').eq('id', party.id))).toEqual([]);
    expect(await ok(admin.client.from('events').select('id').eq('id', party.id))).toEqual([]);
    await expectRejected(
      fan.client.rpc('claim_stamp', { p_event: party.slug, p_code: party.code }),
      'unknown_event',
    );
    const item = (await trash()).events.find((e) => e.id === party.id);
    expect(item).toMatchObject({ slug: party.slug, reason: 'fiesta repetida', kept: false });
    await expectRejected(
      admin.client.rpc('admin_delete_event', { p_event: party.slug, p_reason: 'otra vez' }),
      'unknown_event',
    );

    await ok(admin.client.rpc('admin_restore_event', { p_id: party.id }));
    const back = await ok(
      ctx.service
        .from('events')
        .select('deleted_at, archived_at, delete_reason')
        .eq('id', party.id)
        .single(),
    );
    expect(back).toEqual({ deleted_at: null, archived_at: null, delete_reason: null });
    expect(await ok(ctx.anon.from('events').select('id').eq('id', party.id))).toHaveLength(1);
    expect((await trash()).events.some((e) => e.id === party.id)).toBe(false);
    await expectRejected(
      admin.client.rpc('admin_restore_event', { p_id: party.id }),
      'unknown_trash',
    );
  });
});

describe('papelera con cuentas: purga a los 30 días', () => {
  it('borra de verdad lo caducado; deja oculta la fiesta con historial y lo reciente', async () => {
    const now = Date.now();
    const window = { from: new Date(now - 3600_000), until: new Date(now + 3600_000) };
    const plain = await testEvent(ctx, `t230-${run}-b`, window);
    const stamped = await testEvent(ctx, `t230-${run}-c`, window);
    const fresh = await testEvent(ctx, `t230-${run}-d`, window);
    events.push(plain.id, stamped.id, fresh.id);
    await ok(fan.client.rpc('claim_stamp', { p_event: stamped.slug, p_code: stamped.code }));
    for (const p of [plain, stamped, fresh]) {
      await ok(admin.client.rpc('admin_delete_event', { p_event: p.slug, p_reason: 'purga T230' }));
    }
    expect((await trash()).events.find((e) => e.id === stamped.id)?.kept).toBe(true);
    const gone = await ctx.member('papelera-purga');
    await ok(
      gone.client.rpc('save_profile', {
        p_nickname: nick('Papelera Purga'),
        p_privacy_version: POLICY,
      }),
    );
    await ok(admin.client.rpc('admin_delete_member', { p_user: gone.id, p_reason: 'purga T230' }));

    // El reloj, 31 días adelante para todos menos `fresh`.
    await ok(
      ctx.service
        .from('member_trash')
        .update({ deleted_at: daysAgo(31) })
        .eq('user_id', gone.id),
    );
    await ok(
      ctx.service
        .from('events')
        .update({ deleted_at: daysAgo(31) })
        .in('id', [plain.id, stamped.id]),
    );
    const r = (await ok(ctx.service.rpc('purge_expired_trash'))) as unknown as TrashPurgeResult;
    expect(r.members).toBeGreaterThanOrEqual(1);
    expect(r.events).toBeGreaterThanOrEqual(1);
    expect(r.events_kept).toBeGreaterThanOrEqual(1);

    expect((await ctx.service.auth.admin.getUserById(gone.id)).data.user).toBeNull();
    const left = await ok(
      ctx.service
        .from('events')
        .select('id, deleted_at')
        .in('id', [plain.id, stamped.id, fresh.id])
        .order('id'),
    );
    const ids = left.map((e) => e.id);
    expect(ids).not.toContain(plain.id);
    expect(ids).toContain(stamped.id);
    expect(ids).toContain(fresh.id);
    expect(left.every((e) => e.deleted_at !== null)).toBe(true);
    const list = await trash();
    expect(list.events.some((e) => e.id === fresh.id)).toBe(true);
    expect(list.members.some((m) => m.user_id === gone.id)).toBe(false);
    // Un admin también purga lo caducado desde el Admin.
    const again = (await ok(
      admin.client.rpc('admin_purge_expired_trash'),
    )) as unknown as TrashPurgeResult;
    expect(again.members).toBe(0);
  });
});

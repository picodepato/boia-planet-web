/**
 * Las Calitas (plan 019 T222, decisión 16; migración 20261008100500)
 * contra el proyecto de desarrollo:
 *
 * - leer es de todos (también sin cuenta): los comentarios visibles con sus
 *   respuestas, el apodo del autor, la puntuación y el voto de quien lee;
 * - comentar, responder y votar piden cuenta con Carnet; el propio no se
 *   vota; las respuestas son de un nivel;
 * - el filtro de insultos rechaza en la base (también escribiendo con
 *   service_role, por el trigger), con las letras deletreadas o repetidas;
 * - el Admin (admin con segundo factor) oculta con motivo y devuelve; lo
 *   oculto (y sus respuestas) deja de leerse; queda en la auditoría; un
 *   socio o un editor no pueden;
 * - nadie escribe las tablas a mano.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { context, expectDenied, expectRejected, ok, type Member } from './context.ts';
import { elevateToAal2, testRunId } from './testkit.ts';

const ctx = context();
const POLICY = 'muestra-2026-10-08';
const run = testRunId();

let admin: Member;
let editor: Member;
let ana: Member;
let bea: Member;
let noCarnet: Member;

interface Row {
  id: string;
  parent_id: string | null;
  body: string;
  author_nickname: string | null;
  is_mine: boolean;
  score: number;
  my_vote: number;
  hidden_at?: string | null;
  hidden_reason?: string | null;
}

const rows = (data: unknown) => data as unknown as Row[];
const created: string[] = [];

beforeAll(async () => {
  admin = await ctx.member('calitas-admin');
  editor = await ctx.member('calitas-editor');
  ana = await ctx.member('calitas-ana');
  bea = await ctx.member('calitas-bea');
  noCarnet = await ctx.member('calitas-sin-carnet');
  await ok(
    ctx.service.from('staff_roles').insert([
      { user_id: admin.id, role: 'admin' },
      { user_id: editor.id, role: 'editor' },
    ]),
  );
  await elevateToAal2(admin.client);
  await elevateToAal2(editor.client);
  for (const [m, nick] of [
    [ana, 'Calitas Ana'],
    [bea, 'Calitas Bea'],
  ] as const) {
    await ok(
      m.client.rpc('save_profile', { p_nickname: `${nick} ${run}`, p_privacy_version: POLICY }),
    );
  }
});

afterAll(async () => {
  if (created.length) await ctx.service.from('calitas_comments').delete().in('id', created);
  await ctx.cleanup();
});

async function post(m: Member, body: string, parent?: string): Promise<Row> {
  const r = (await ok(
    m.client.rpc('calitas_post', { p_body: body, ...(parent ? { p_parent: parent } : {}) }),
  )) as unknown as Row;
  created.push(r.id);
  return r;
}

describe('comentar, responder y votar', () => {
  let top: Row;
  let reply: Row;

  it('un socio con Carnet comenta y otro responde; todos lo leen, también sin cuenta', async () => {
    top = await post(ana, `Hola desde Las Calitas ${run}`);
    expect(top).toMatchObject({
      parent_id: null,
      author_nickname: `Calitas Ana ${run}`,
      is_mine: true,
      score: 0,
      my_vote: 0,
    });
    expect(top).not.toHaveProperty('hidden_at');
    reply = await post(bea, 'Y yo te respondo', top.id);
    expect(reply.parent_id).toBe(top.id);

    const seen = rows(await ok(ctx.anon.rpc('calitas_list', { p_limit: 100 })));
    expect(seen.find((r) => r.id === top.id)).toMatchObject({ is_mine: false, my_vote: 0 });
    expect(seen.find((r) => r.id === reply.id)?.parent_id).toBe(top.id);
  });

  it('las respuestas son de un nivel', async () => {
    await expectRejected(
      bea.client.rpc('calitas_post', { p_body: 'hola', p_parent: reply.id }),
      'unknown_comment',
    );
  });

  it('votar: uno por persona, cambiarlo y quitarlo; el propio no se vota', async () => {
    let r = (await ok(
      bea.client.rpc('calitas_vote', { p_comment: top.id, p_value: 1 }),
    )) as unknown as Row;
    expect(r).toMatchObject({ score: 1, my_vote: 1 });
    r = (await ok(
      bea.client.rpc('calitas_vote', { p_comment: top.id, p_value: -1 }),
    )) as unknown as Row;
    expect(r).toMatchObject({ score: -1, my_vote: -1 });
    r = (await ok(
      bea.client.rpc('calitas_vote', { p_comment: top.id, p_value: 0 }),
    )) as unknown as Row;
    expect(r).toMatchObject({ score: 0, my_vote: 0 });
    await ok(bea.client.rpc('calitas_vote', { p_comment: top.id, p_value: 1 }));
    await expectRejected(
      ana.client.rpc('calitas_vote', { p_comment: top.id, p_value: 1 }),
      'own_comment',
    );
    await expectRejected(
      bea.client.rpc('calitas_vote', { p_comment: top.id, p_value: 2 }),
      'invalid_input',
    );
    const mine = rows(await ok(bea.client.rpc('calitas_list', { p_limit: 100 })));
    expect(mine.find((x) => x.id === top.id)).toMatchObject({ score: 1, my_vote: 1 });
    // Cada cual lee sus votos, no los de otros.
    const own = await ok(bea.client.from('calitas_votes').select('user_id'));
    expect(new Set(own.map((v) => v.user_id))).toEqual(new Set([bea.id]));
    expect(await ok(ana.client.from('calitas_votes').select('user_id'))).toEqual([]);
  });

  it('sin Carnet o sin cuenta no se comenta ni se vota', async () => {
    await expectRejected(
      noCarnet.client.rpc('calitas_post', { p_body: 'hola' }),
      'carnet_required',
    );
    await expectRejected(
      noCarnet.client.rpc('calitas_vote', { p_comment: top.id, p_value: 1 }),
      'carnet_required',
    );
    await expectDenied(ctx.anon.rpc('calitas_post', { p_body: 'hola' }));
    await expectDenied(ctx.anon.rpc('calitas_vote', { p_comment: top.id, p_value: 1 }));
  });

  it('nadie escribe las tablas a mano', async () => {
    const insert = await ana.client
      .from('calitas_comments')
      .insert({ user_id: ana.id, body: 'a mano' });
    expect(insert.error).not.toBeNull();
    const vote = await ana.client
      .from('calitas_votes')
      .insert({ comment_id: reply.id, user_id: ana.id, value: 1 });
    expect(vote.error).not.toBeNull();
    const hide = await ana.client
      .from('calitas_comments')
      .update({ hidden_at: new Date().toISOString() })
      .eq('id', top.id)
      .select('id');
    expect(hide.error !== null || (hide.data ?? []).length === 0).toBe(true);
  });
});

describe('el filtro de insultos', () => {
  it('rechaza en la base los insultos, deletreados o alargados, y los datos de contacto', async () => {
    for (const [body, reason] of [
      ['eres un cabrón', 'text_offensive'],
      ['qué mamón', 'text_offensive'],
      ['p.u.t.a', 'text_offensive'],
      ['GILIPOLLAAAAS', 'text_offensive'],
      ['escríbeme a yo@ejemplo.es', 'text_email'],
      ['mira www.ejemplo.es', 'text_link'],
      ['612 345 678', 'text_phone'],
    ] as const) {
      await expectRejected(ana.client.rpc('calitas_post', { p_body: body }), reason);
    }
    await expectRejected(ana.client.rpc('calitas_post', { p_body: '   ' }), 'invalid_message');
    await expectRejected(
      ana.client.rpc('calitas_post', { p_body: 'x'.repeat(281) }),
      'invalid_message',
    );
  });

  it('el trigger lo aplica también a lo que se escribe con service_role', async () => {
    const r = await ctx.service
      .from('calitas_comments')
      .insert({ user_id: ana.id, body: 'soplapollas' });
    expect(r.error?.message).toBe('text_offensive');
  });

  it('deja pasar lo normal', async () => {
    const r = await post(ana, 'El pollo de la paella, buenísimo');
    expect(r.body).toBe('El pollo de la paella, buenísimo');
  });
});

describe('la moderación del Admin', () => {
  let top: Row;
  let reply: Row;

  beforeAll(async () => {
    top = await post(bea, `Para moderar ${run}`);
    reply = await post(ana, 'Respuesta que se va con él', top.id);
  });

  it('sólo admin con segundo factor; un editor, un socio o anon, no', async () => {
    await expectRejected(
      editor.client.rpc('admin_moderate_comment', {
        p_comment: top.id,
        p_action: 'hide',
        p_reason: 'spam',
      }),
      'forbidden',
    );
    await expectRejected(
      ana.client.rpc('admin_moderate_comment', {
        p_comment: top.id,
        p_action: 'hide',
        p_reason: 'spam',
      }),
      'forbidden',
    );
    await expectRejected(ana.client.rpc('admin_calitas_list', {}), 'forbidden');
    await expectDenied(ctx.anon.rpc('admin_calitas_list', {}));
  });

  it('ocultar pide motivo; oculto no se lee (ni sus respuestas) salvo el Admin y su autor', async () => {
    await expectRejected(
      admin.client.rpc('admin_moderate_comment', {
        p_comment: top.id,
        p_action: 'hide',
        p_reason: '',
      }),
      'reason_required',
    );
    await expectRejected(
      admin.client.rpc('admin_moderate_comment', {
        p_comment: top.id,
        p_action: 'borrar',
        p_reason: 'x',
      }),
      'invalid_action',
    );
    const hidden = (await ok(
      admin.client.rpc('admin_moderate_comment', {
        p_comment: top.id,
        p_action: 'hide',
        p_reason: 'Prueba de moderación',
      }),
    )) as unknown as Row;
    expect(hidden.hidden_reason).toBe('Prueba de moderación');
    const seen = rows(await ok(ctx.anon.rpc('calitas_list', { p_limit: 100 })));
    expect(seen.some((r) => r.id === top.id || r.id === reply.id)).toBe(false);
    // Su autor aún lo lee en la tabla; otro socio, no.
    expect(
      await ok(bea.client.from('calitas_comments').select('id').eq('id', top.id)),
    ).toHaveLength(1);
    expect(
      await ok(ana.client.from('calitas_comments').select('id').eq('id', top.id)),
    ).toHaveLength(0);
    // Oculto, no se vota ni se responde.
    await expectRejected(
      ana.client.rpc('calitas_vote', { p_comment: top.id, p_value: 1 }),
      'unknown_comment',
    );
    await expectRejected(
      ana.client.rpc('calitas_post', { p_body: 'hola', p_parent: top.id }),
      'unknown_comment',
    );
    const all = rows(await ok(admin.client.rpc('admin_calitas_list', { p_limit: 500 })));
    expect(all.find((r) => r.id === top.id)?.hidden_at).toBeTruthy();
  });

  it('mostrarlo lo devuelve con sus respuestas, y todo queda en la auditoría', async () => {
    await ok(admin.client.rpc('admin_moderate_comment', { p_comment: top.id, p_action: 'show' }));
    const seen = rows(await ok(ctx.anon.rpc('calitas_list', { p_limit: 100 })));
    expect(seen.some((r) => r.id === top.id)).toBe(true);
    expect(seen.some((r) => r.id === reply.id)).toBe(true);
    const audit = await ok(
      ctx.service
        .from('audit_log')
        .select('action, reason')
        .eq('entity_type', 'calitas_comments')
        .eq('entity_id', top.id)
        .order('created_at', { ascending: true }),
    );
    expect(audit.map((a) => a.action)).toEqual(['moderate_comment:hide', 'moderate_comment:show']);
    expect(audit[0]!.reason).toBe('Prueba de moderación');
  });
});

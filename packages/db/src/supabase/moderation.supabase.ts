/**
 * La moderación con datos reales (plan 017 T191, decisión 5, REQ-ADM-031,
 * `20261007100200_moderation.sql`) contra el proyecto de desarrollo:
 * ocultar y devolver un Carnet, su apodo y su foto (lo público lo refleja y
 * su dueño no lo deshace guardando lo mismo); devolver al mar una botella
 * retirada; anular y devolver una entrada de la carrera, del Cañón y del
 * Castillo. Todo pide rol admin con segundo factor y queda en la auditoría.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AdminCarnetPage, ModerateCarnetResult, RankingPage, VoidedEntry } from '../rpc.ts';
import { context, expectDenied, expectRejected, ok, type Member } from './context.ts';
import { elevateToAal2, testRunId } from './testkit.ts';

const ctx = context();
const run = testRunId();
const POLICY = 'muestra-2026-10-03';
const AVATAR = 'barco-01';
const CIRCUIT = { id: 'el-freu', version: 3 };

let admin: Member;
let owner: Member;
let author: Member;
let player: Member;

const nick = (name: string) => `${name} ${run}`.slice(0, 30);

async function carnet(m: Member, name: string, avatar: string | null = null): Promise<void> {
  await ok(
    m.client.rpc('save_profile', {
      p_nickname: nick(name),
      p_privacy_version: POLICY,
      ...(avatar ? { p_avatar_key: avatar } : {}),
    }),
  );
}

const moderate = (action: string, reason: string | null = 'prueba de moderación') =>
  admin.client.rpc('admin_moderate_carnet', {
    p_user: owner.id,
    p_action: action,
    ...(reason ? { p_reason: reason } : {}),
  });

const publicRow = async () =>
  ok(
    ctx.anon
      .from('carnets')
      .select('nickname, avatar_key, nickname_moderated, avatar_moderated')
      .eq('user_id', owner.id),
  );

beforeAll(async () => {
  admin = await ctx.member('mod-admin');
  owner = await ctx.member('mod-duena');
  author = await ctx.member('mod-autora');
  player = await ctx.member('mod-juega');
  await ok(ctx.service.from('staff_roles').insert({ user_id: admin.id, role: 'admin' }));
  await carnet(owner, 'Duena', AVATAR);
  await carnet(author, 'Autora');
  await carnet(player, 'Juega');
  await elevateToAal2(admin.client);
});

afterAll(async () => {
  await ctx.cleanup();
});

describe('Carnets: permisos', () => {
  it('sólo el equipo con aal2; un socio o anon, no', async () => {
    await expectRejected(
      owner.client.rpc('admin_moderate_carnet', {
        p_user: owner.id,
        p_action: 'hide',
        p_reason: 'yo mismo',
      }),
      'forbidden',
    );
    await expectDenied(
      ctx.anon.rpc('admin_moderate_carnet', { p_user: owner.id, p_action: 'hide' }),
    );
    await expectRejected(owner.client.rpc('admin_list_carnets', {}), 'forbidden');
    await expectRejected(moderate('borrar'), 'invalid_action');
    await expectRejected(moderate('hide', ''), 'reason_required');
  });
});

describe('Carnets: retirar y devolver el apodo y la foto', () => {
  it('lo público sale moderado y la lista del equipo enseña lo retirado', async () => {
    const res = (await ok(moderate('hide_nickname'))) as unknown as ModerateCarnetResult;
    expect(res).toMatchObject({ nickname_moderated: true, hidden: false });
    expect(res.nickname).toMatch(/^Miembro de BOIA /);
    await ok(moderate('hide_avatar'));
    expect(await publicRow()).toEqual([
      {
        nickname: res.nickname,
        avatar_key: null,
        nickname_moderated: true,
        avatar_moderated: true,
      },
    ]);
    const page = (await ok(
      admin.client.rpc('admin_list_carnets', { p_search: nick('Duena') }),
    )) as unknown as AdminCarnetPage;
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0]).toMatchObject({
      user_id: owner.id,
      original_nickname: nick('Duena'),
      has_original_avatar: true,
    });
  });

  it('su dueño guardando lo mismo no lo deshace; algo nuevo, sí', async () => {
    // Su navegador vuelve a mandar el apodo y la foto retirados.
    await ok(owner.client.rpc('save_profile', { p_nickname: nick('Duena'), p_avatar_key: AVATAR }));
    const [kept] = await publicRow();
    expect(kept).toMatchObject({ avatar_key: null, nickname_moderated: true });
    expect(kept!.nickname).toMatch(/^Miembro de BOIA /);
    // Ni el propio socio puede tocar las marcas.
    await expectDenied(
      owner.client.from('carnets').update({ nickname_moderated: false }).eq('user_id', owner.id),
    );
    // Una foto nueva se ve (y quita su marca); el apodo sigue retirado.
    await ok(
      owner.client.rpc('save_profile', { p_nickname: nick('Duena'), p_avatar_key: 'barco-02' }),
    );
    expect((await publicRow())[0]).toMatchObject({
      avatar_key: 'barco-02',
      avatar_moderated: false,
      nickname_moderated: true,
    });
  });

  it('devolver el apodo lo vuelve a poner', async () => {
    await ok(moderate('restore_nickname', null));
    expect((await publicRow())[0]).toMatchObject({
      nickname: nick('Duena'),
      nickname_moderated: false,
    });
  });
});

describe('Carnets: ocultar el Carnet entero', () => {
  it('nadie lo lee salvo su dueño y el equipo; en el ranking sale con el apodo de moderación', async () => {
    await ok(
      owner.client
        .from('carnet_answers')
        .insert({
          user_id: owner.id,
          question_id: 'obra',
          question_version: 1,
          answer: 'Un disco',
        }),
    );
    expect(
      await ok(ctx.anon.from('carnet_answers').select('user_id').eq('user_id', owner.id)),
    ).toHaveLength(1);
    await ok(moderate('hide'));
    expect(await publicRow()).toEqual([]);
    expect(
      await ok(author.client.from('carnets').select('user_id').eq('user_id', owner.id)),
    ).toEqual([]);
    expect(
      await ok(ctx.anon.from('carnet_answers').select('user_id').eq('user_id', owner.id)),
    ).toEqual([]);
    expect(
      await ok(owner.client.from('carnets').select('nickname').eq('user_id', owner.id)),
    ).toHaveLength(1);
    expect(
      await ok(admin.client.from('carnets').select('hidden_at').eq('user_id', owner.id)),
    ).toHaveLength(1);
  });

  it('mostrarlo lo devuelve entero (apodo y foto) y todo queda en la auditoría', async () => {
    await ok(moderate('show', null));
    expect((await publicRow())[0]).toMatchObject({
      nickname: nick('Duena'),
      avatar_key: 'barco-02',
      nickname_moderated: false,
      avatar_moderated: false,
    });
    const audit = await ok(
      admin.client
        .from('audit_log')
        .select('action')
        .eq('entity_type', 'carnets')
        .eq('entity_id', owner.id)
        .like('action', 'moderate_carnet:%'),
    );
    expect(audit.map((a) => a.action)).toEqual(
      expect.arrayContaining([
        'moderate_carnet:hide_nickname',
        'moderate_carnet:hide_avatar',
        'moderate_carnet:restore_nickname',
        'moderate_carnet:hide',
        'moderate_carnet:show',
      ]),
    );
  });
});

describe('Botellas: devolver al mar', () => {
  it('una retirada vuelve; si su autor ya tiene otra en el mar, no', async () => {
    const b = (await ok(
      author.client.rpc('place_bottle', { p_message: `Moderada ${run}`, p_x: 7, p_y: 8 }),
    )) as { id: string };
    await expectRejected(
      admin.client.rpc('admin_restore_bottle', { p_bottle: b.id }),
      'invalid_status',
    );
    await ok(admin.client.rpc('admin_remove_bottle', { p_bottle: b.id, p_reason: 'spam' }));
    await expectRejected(
      author.client.rpc('admin_restore_bottle', { p_bottle: b.id }),
      'forbidden',
    );
    await ok(admin.client.rpc('admin_restore_bottle', { p_bottle: b.id, p_reason: 'no era' }));
    const sea = await ok(ctx.anon.rpc('latest_bottles', { p_limit: 50 }));
    expect(sea.some((x) => x.id === b.id)).toBe(true);

    await ok(admin.client.rpc('admin_remove_bottle', { p_bottle: b.id, p_reason: 'spam' }));
    await ok(author.client.rpc('place_bottle', { p_message: `Otra ${run}`, p_x: 9, p_y: 10 }));
    await expectRejected(
      admin.client.rpc('admin_restore_bottle', { p_bottle: b.id }),
      'bottle_conflict',
    );
  });
});

describe('Rankings: anular y devolver', () => {
  const inTable = async (rpc: Promise<{ data: unknown; error: unknown }>) =>
    ((await ok(rpc as never)) as unknown as RankingPage).rows.some((r) => r.user_id === player.id);
  const raceTable = () =>
    ctx.anon.rpc('ranking_race', {
      p_circuit: CIRCUIT.id,
      p_version: CIRCUIT.version,
      p_limit: 100,
    }) as unknown as Promise<{ data: unknown; error: unknown }>;
  const canonTable = () =>
    ctx.anon.rpc('ranking_canon', {
      p_boss: 'fantasma',
      p_version: 1,
      p_limit: 100,
    }) as unknown as Promise<{ data: unknown; error: unknown }>;
  const castleTable = () =>
    ctx.anon.rpc('ranking_castle', {
      p_run_min: 5,
      p_difficulty: 'normal',
      p_limit: 100,
    }) as unknown as Promise<{ data: unknown; error: unknown }>;

  beforeAll(async () => {
    await ok(
      player.client.rpc('submit_race_time', {
        p_circuit: CIRCUIT.id,
        p_version: CIRCUIT.version,
        p_ms: 45_123,
      }),
    );
    await ok(
      player.client.rpc('submit_canon_score', {
        p_boss: 'fantasma',
        p_version: 1,
        p_score: 9_000,
        p_ms: 200_000,
        p_difficulty: 'normal',
      }),
    );
    await ok(
      player.client.rpc('submit_castle_score', {
        p_run_min: 5,
        p_difficulty: 'normal',
        p_version: 1,
        p_score: 1200,
        p_ms: 300000,
        p_medal: 'oro',
        p_end: 'held',
        p_life: 60,
        p_ranked: true,
      }),
    );
  });

  it('las tres tablas: anular la saca, aparece en las anuladas, devolver la vuelve a meter', async () => {
    const boards = [
      { board: 'race', key: CIRCUIT.id, version: CIRCUIT.version, table: raceTable },
      { board: 'canon', key: 'fantasma', version: 1, table: canonTable },
      { board: 'castle', key: '5:normal', version: 1, table: castleTable },
    ] as const;
    for (const b of boards) {
      const target = { p_board: b.board, p_user: player.id, p_key: b.key, p_version: b.version };
      expect(await inTable(b.table()), b.board).toBe(true);
      await expectRejected(
        player.client.rpc('admin_void_score', { ...target, p_reason: 'yo mismo' }),
        'forbidden',
      );
      await expectRejected(
        admin.client.rpc('admin_void_score', { ...target, p_reason: '' }),
        'reason_required',
      );
      await ok(admin.client.rpc('admin_void_score', { ...target, p_reason: 'imposible' }));
      expect(await inTable(b.table()), b.board).toBe(false);
      const voided = (await ok(
        admin.client.rpc('admin_list_voided', { p_limit: 500 }),
      )) as unknown as VoidedEntry[];
      expect(voided).toContainEqual(
        expect.objectContaining({ board: b.board, user_id: player.id, key: b.key }),
      );
      await ok(admin.client.rpc('admin_restore_score', target));
      expect(await inTable(b.table()), b.board).toBe(true);
    }
    await expectRejected(
      admin.client.rpc('admin_void_score', {
        p_board: 'tetris',
        p_user: player.id,
        p_key: 'x',
        p_version: 1,
        p_reason: 'nada',
      }),
      'invalid_board',
    );
    await expectRejected(
      admin.client.rpc('admin_void_score', {
        p_board: 'canon',
        p_user: author.id,
        p_key: 'fantasma',
        p_version: 1,
        p_reason: 'sin partida',
      }),
      'unknown_entry',
    );
    const audit = await ok(
      admin.client
        .from('audit_log')
        .select('action')
        .eq('entity_type', 'rankings')
        .like('entity_id', `%|${player.id}|%`),
    );
    expect(audit.filter((a) => a.action === 'void_score')).toHaveLength(3);
    expect(audit.filter((a) => a.action === 'restore_score')).toHaveLength(3);
  });

  it('una partida mejor que la anulada del Castillo la vuelve a meter', async () => {
    const target = { p_board: 'castle', p_user: player.id, p_key: '5:normal', p_version: 1 };
    await ok(admin.client.rpc('admin_void_score', { ...target, p_reason: 'imposible' }));
    expect(await inTable(castleTable())).toBe(false);
    await ok(
      player.client.rpc('submit_castle_score', {
        p_run_min: 5,
        p_difficulty: 'normal',
        p_version: 1,
        p_score: 1300,
        p_ms: 300000,
        p_medal: 'oro',
        p_end: 'held',
        p_life: 60,
        p_ranked: true,
      }),
    );
    expect(await inTable(castleTable())).toBe(true);
  });
});

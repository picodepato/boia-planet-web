import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CARNET_QUESTIONS,
  CARNET_QUESTIONS_PER_MEMBER,
  NICKNAME_MAX,
  RETIRED_CARNET_QUESTION_IDS,
  carnetAnswerVisibility,
  carnetQuestionsFor,
  discountStatus,
} from '@boia/contracts';
import { SAMPLE_CREW, SAMPLE_DISCOUNTS, SAMPLE_EVENTS } from './sample';
import { discountSchema } from '@boia/contracts';
import { makeRepo } from './test-helpers';
import { localDocAccess } from './local';
import { applyServerState, applySnapshot, snapshotOf } from './member/hydrate';

const MIGRATION = new URL(
  '../../../supabase/migrations/20260928100100_identity.sql',
  import.meta.url,
);
const MIGRATION_V2 = new URL(
  '../../../supabase/migrations/20261014100100_carnet_questions_v2.sql',
  import.meta.url,
);

const MIGRATION_AUDIENCE = new URL(
  '../../../supabase/migrations/20261015100100_carnet_questions_audience.sql',
  import.meta.url,
);

describe('Carnet: preguntas por público (plan 030 T294)', () => {
  const ARTIST_IDS = [
    'momento-quiero-estar',
    'cancion-en-repeat',
    'creando-tramando',
    'disco-entero',
    'buena-fiesta',
  ];
  const PUBLIC_IDS = ['dia-siguiente', ...ARTIST_IDS.slice(1)];

  it('artistas: las 5 de siempre; el público: «al día siguiente…» y luego la 2 a la 5', () => {
    expect(carnetQuestionsFor(true).map((q) => q.id)).toEqual(ARTIST_IDS);
    expect(carnetQuestionsFor(false).map((q) => q.id)).toEqual(PUBLIC_IDS);
    expect(carnetQuestionsFor(false)[0]!.prompt).toBe(
      'Completa la frase: al día siguiente de una fiesta yo…',
    );
    for (const isArtist of [true, false]) {
      expect(carnetQuestionsFor(isArtist)).toHaveLength(CARNET_QUESTIONS_PER_MEMBER);
      expect(carnetQuestionsFor(isArtist).map((q) => q.position)).toEqual([1, 2, 3, 4, 5]);
    }
  });

  it('un Carnet de artista (enlace de artistas) muestra y acepta las 5 de artista, en orden', async () => {
    const { repo } = makeRepo();
    await repo.carnet.create({ nickname: 'Artista', artistCode: 'codigo-demo' });
    expect((await repo.carnet.questions()).map((q) => q.id)).toEqual(ARTIST_IDS);
    for (const id of [...ARTIST_IDS].reverse()) await repo.carnet.answer(id, `R ${id}`);
    const mine = (await repo.carnet.mine())!;
    expect(mine.answers.map((a) => a.questionId)).toEqual(ARTIST_IDS);
    await expect(repo.carnet.answer('dia-siguiente', 'x')).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('un Carnet normal muestra «al día siguiente…» primero; la de artistas no la acepta', async () => {
    const { repo } = makeRepo();
    await repo.carnet.create({ nickname: 'Normal' });
    expect((await repo.carnet.questions()).map((q) => q.id)).toEqual(PUBLIC_IDS);
    for (const id of [...PUBLIC_IDS].reverse()) await repo.carnet.answer(id, `R ${id}`);
    expect((await repo.carnet.mine())!.answers.map((a) => a.questionId)).toEqual(PUBLIC_IDS);
    await expect(repo.carnet.answer('momento-quiero-estar', 'x')).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('la respuesta antigua de un miembro normal a la 1 de artistas se guarda, no se enseña y la ve el Admin', async () => {
    const { repo } = makeRepo();
    await repo.carnet.create({ nickname: 'Antes del cambio' });
    await repo.carnet.answer('dia-siguiente', 'Desayuno a las cinco');
    const access = localDocAccess(repo)!;
    const userId = access.read().identity!.id;
    // Contestada antes de T294, cuando la 1 era de todos.
    access.write(['carnet'], (doc) => {
      doc.carnets[userId]!.answers['momento-quiero-estar'] = {
        answer: 'Un amanecer en la Cala',
        questionVersion: 1,
        updatedAt: doc.identity!.createdAt,
      };
    });
    const shown = ['dia-siguiente'];
    expect((await repo.carnet.mine())!.answers.map((a) => a.questionId)).toEqual(shown);
    expect((await repo.carnet.get(userId))!.answers.map((a) => a.questionId)).toEqual(shown);
    await repo.carnet.answer('buena-fiesta', 'Agua');
    expect(access.read().carnets[userId]!.answers['momento-quiero-estar']!.answer).toBe(
      'Un amanecer en la Cala',
    );
    const row = (await repo.admin.carnets()).find((r) => r.userId === userId)!;
    expect(row.carnet.answers.map((a) => [a.questionId, a.retired ?? false])).toEqual([
      ['dia-siguiente', false],
      ['buena-fiesta', false],
      ['momento-quiero-estar', true],
    ]);
    expect(carnetAnswerVisibility('momento-quiero-estar', false)).toBe('other_audience');
    expect(carnetAnswerVisibility('momento-quiero-estar', true)).toBe('shown');
    expect(carnetAnswerVisibility('cosa-mas-rara', true)).toBe('retired');
  });

  it('si pasa a ser artista, ve las de artista desde entonces (y su respuesta antigua vuelve)', async () => {
    const { repo } = makeRepo();
    await repo.carnet.create({ nickname: 'Luego artista' });
    await repo.carnet.answer('dia-siguiente', 'Churros');
    const access = localDocAccess(repo)!;
    const userId = access.read().identity!.id;
    access.write(['carnet'], (doc) => {
      doc.carnets[userId]!.answers['momento-quiero-estar'] = {
        answer: 'Un amanecer',
        questionVersion: 1,
        updatedAt: doc.identity!.createdAt,
      };
      doc.carnets[userId]!.isArtist = true;
    });
    expect((await repo.carnet.questions()).map((q) => q.id)).toEqual(ARTIST_IDS);
    expect((await repo.carnet.mine())!.answers.map((a) => a.questionId)).toEqual([
      'momento-quiero-estar',
    ]);
    // La del público tampoco se borra: queda guardada.
    expect(access.read().carnets[userId]!.answers['dia-siguiente']!.answer).toBe('Churros');
  });

  it('con cuentas, el «es artista» del servidor llega a la copia local (hidratación)', () => {
    const { repo } = makeRepo();
    const access = localDocAccess(repo)!;
    access.write(['identity', 'carnet'], (doc) => {
      applyServerState(
        doc,
        'u-artista',
        {
          ledger: [],
          equipped: {},
          times: [],
          discounts: [],
          carnet: {
            nickname: 'Del servidor',
            avatar_key: null,
            avatar_image: null,
            member_since: '2026-10-01T00:00:00Z',
            is_artist: true,
          },
          answers: [
            {
              question_id: 'momento-quiero-estar',
              question_version: 1,
              answer: 'Cuando sonó la primera',
              updated_at: null,
            },
          ],
          snapshot: null,
        },
        { snapshotVersion: null, now: () => new Date('2026-10-15T00:00:00Z') },
      );
    });
    expect(access.read().carnets['u-artista']!.isArtist).toBe(true);
  });
});

describe('Carnet', () => {
  it('las 5 preguntas activas son las de las migraciones, textuales; las retiradas no se borran', () => {
    const parse = (sql: string) =>
      [...sql.matchAll(/\('([a-z-]+)', (\d+), '((?:[^']|'')*)'\)/g)].map((m) => ({
        id: m[1],
        position: Number(m[2]),
        prompt: m[3]?.replace(/''/g, "'"),
      }));
    const first = parse(readFileSync(MIGRATION, 'utf8'));
    const v2sql = readFileSync(MIGRATION_V2, 'utf8');
    const v2 = parse(v2sql);
    const v3sql = readFileSync(MIGRATION_AUDIENCE, 'utf8');
    // T294: la nueva lleva su público; `momento-quiero-estar` pasa a artistas.
    const v3 = [
      ...v3sql.matchAll(/\('([a-z-]+)', (\d+), '((?:[^']|'')*)', '(all|artist|public)'\)/g),
    ].map((m) => ({
      id: m[1],
      position: Number(m[2]),
      prompt: m[3]?.replace(/''/g, "'"),
      audience: m[4] ?? '',
    }));
    expect(v3.map((r) => r.id)).toEqual(['dia-siguiente']);
    expect(v3sql).toMatch(/set audience = 'artist'\s+where id = 'momento-quiero-estar'/);
    // Estado final: lo sembrado, menos las retiradas, más lo nuevo, con su público.
    const active = [
      ...[...first.filter((r) => !RETIRED_CARNET_QUESTION_IDS.includes(r.id!)), ...v2].map((r) => ({
        ...r,
        audience: r.id === 'momento-quiero-estar' ? 'artist' : 'all',
      })),
      ...v3,
    ].sort((a, b) => a.position - b.position || a.audience.localeCompare(b.audience));
    expect(
      CARNET_QUESTIONS.map(({ id, position, prompt, audience }) => ({
        id,
        position,
        prompt,
        audience,
      })),
    ).toEqual(active);
    expect(v3sql).not.toMatch(/delete\s+from/i);
    for (const id of RETIRED_CARNET_QUESTION_IDS) expect(v2sql).toContain(`'${id}'`);
    expect(v2sql).toMatch(/is_active = false/);
    expect(v2sql).not.toMatch(/delete\s+from/i);
  });

  it('una respuesta a una pregunta retirada se conserva y no se enseña; buena-fiesta sobrevive', async () => {
    const { repo } = makeRepo();
    await repo.carnet.create({ nickname: 'Antigua' });
    await repo.carnet.answer('buena-fiesta', 'Agua y sombra');
    const access = localDocAccess(repo)!;
    const userId = access.read().identity!.id;
    access.write(['carnet'], (doc) => {
      doc.carnets[userId]!.answers['cosa-mas-rara'] = {
        answer: 'Una paella a las tres',
        questionVersion: 1,
        updatedAt: doc.identity!.createdAt,
      };
    });
    const mine = (await repo.carnet.mine())!;
    expect(mine.answers.map((a) => a.questionId)).toEqual(['buena-fiesta']);
    expect((await repo.carnet.get(userId))!.answers.map((a) => a.questionId)).toEqual([
      'buena-fiesta',
    ]);
    // Contestar otra pregunta no toca la guardada: sigue en el almacén.
    await repo.carnet.answer('disco-entero', 'Un disco de ambient');
    const stored = access.read().carnets[userId]!.answers;
    expect(stored['cosa-mas-rara']!.answer).toBe('Una paella a las tres');
    expect(stored['buena-fiesta']!.answer).toBe('Agua y sombra');
    await expect(repo.carnet.answer('cosa-mas-rara', 'x')).rejects.toMatchObject({
      code: 'not_found',
    });
    // La moderación del Admin la sigue viendo, marcada, y la puede ocultar.
    const row = (await repo.admin.carnets()).find((r) => r.userId === userId)!;
    expect(row.carnet.answers.map((a) => [a.questionId, a.retired ?? false])).toEqual([
      ['disco-entero', false],
      ['buena-fiesta', false],
      ['cosa-mas-rara', true],
    ]);
    await repo.admin.moderateCarnet(
      userId,
      { kind: 'hide_answer', questionId: 'cosa-mas-rara' },
      { reason: 'prueba' },
    );
    expect(access.read().carnets[userId]!.answers['cosa-mas-rara']!.answer).toBe(
      'Una paella a las tres',
    );
    expect((await repo.carnet.mine())!.answers.map((a) => a.questionId)).toEqual([
      'disco-entero',
      'buena-fiesta',
    ]);
  });

  it('se crea con apodo (sin email), «Miembro desde» y respuestas con su pregunta', async () => {
    const { repo, clock } = makeRepo();
    expect(await repo.carnet.mine()).toBeNull();
    const c = await repo.carnet.create({ nickname: '  Capitana   Paella ' });
    expect(c.nickname).toBe('Capitana Paella');
    expect(c.memberSince).toBe(clock.now().toISOString());
    expect(c.isMine).toBe(true);
    const q = CARNET_QUESTIONS[CARNET_QUESTIONS.length - 1];
    if (!q) throw new Error('sin preguntas');
    const withAnswer = await repo.carnet.answer(q.id, 'Agua y sombra');
    expect(withAnswer.answers).toEqual([
      { questionId: q.id, question: q.prompt, questionVersion: q.version, answer: 'Agua y sombra' },
    ]);
    expect((await repo.carnet.answer(q.id, '')).answers).toEqual([]);
    await expect(repo.carnet.answer('inventada', 'x')).rejects.toMatchObject({ code: 'not_found' });
    await expect(repo.carnet.create({ nickname: 'Otra' })).rejects.toMatchObject({
      code: 'conflict',
    });
  });

  it('el apodo tiene límites y es único sin distinguir mayúsculas', async () => {
    const { repo } = makeRepo();
    await expect(repo.carnet.create({ nickname: 'a' })).rejects.toMatchObject({ code: 'invalid' });
    await expect(
      repo.carnet.create({ nickname: 'x'.repeat(NICKNAME_MAX + 1) }),
    ).rejects.toMatchObject({ code: 'invalid' });
    const crew = SAMPLE_CREW[0];
    if (!crew) throw new Error('sin tripulación de muestra');
    await expect(
      repo.carnet.create({ nickname: crew.nickname.toUpperCase() }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('el Carnet muestra puntos, rango, logros y sellos del libro', async () => {
    const { repo } = makeRepo();
    await repo.carnet.create({ nickname: 'Coleccionista' });
    await repo.progress.completeAchievement('primera-boia');
    // Completado aún no está en el Carnet: sólo lo reclamado.
    expect((await repo.carnet.mine())?.achievements).toEqual([]);
    await repo.progress.claimAchievement('primera-boia');
    const c = await repo.carnet.mine();
    expect(c?.achievements.map((a) => a.id)).toEqual(['primera-boia']);
    expect(c?.points).toBe((await repo.progress.balances()).points);
    expect(c?.rank).not.toBeNull();
  });

  it('olvidar al invitado empieza otro sin su progreso', async () => {
    const { repo } = makeRepo();
    const a = await repo.identity.ensure();
    await repo.carnet.create({ nickname: 'Pasajera' });
    await repo.progress.grantWorldReward({ sourceRef: 'boia-1', coins: 2 });
    await repo.bottles.place({ message: 'adiós', x: 1, y: 1 });
    const b = await repo.identity.reset();
    expect(b.id).not.toBe(a.id);
    expect(await repo.carnet.mine()).toBeNull();
    expect((await repo.progress.balances()).coins).toBe(0);
    expect((await repo.bottles.list()).some((x) => x.authorId === a.id)).toBe(false);
  });
});

describe('compras de prueba y sellos', () => {
  // Uno a la venta con un código del mundo (para probar el descuento).
  const onSale = SAMPLE_EVENTS.find(
    (e) => e.state === 'on_sale' && SAMPLE_DISCOUNTS.some((d) => d.eventId === e.id),
  );
  const notOnSale = SAMPLE_EVENTS.find((e) => e.state !== 'on_sale');
  if (!onSale || !notOnSale) throw new Error('muestra sin eventos a la venta y no a la venta');

  it('el sello entra una vez por compra aunque se confirme dos veces', async () => {
    const { repo, reload } = makeRepo();
    const a = await repo.purchases.confirmSandbox({ purchaseId: 'p-1', eventId: onSale.id });
    const b = await reload().purchases.confirmSandbox({ purchaseId: 'p-1', eventId: onSale.id });
    expect([a.first, a.stamp.granted, b.first, b.stamp.granted]).toEqual([
      true,
      true,
      false,
      false,
    ]);
    const later = reload();
    expect((await later.progress.stamps()).map((s) => s.eventId)).toEqual([onSale.id]);
    expect(await later.purchases.list()).toHaveLength(1);
    // Una segunda compra del mismo evento no da un segundo sello.
    const c = await later.purchases.confirmSandbox({ purchaseId: 'p-2', eventId: onSale.id });
    expect(c.stamp).toMatchObject({ granted: false, reason: 'already_stamped' });
    expect(await later.progress.stamps()).toHaveLength(1);
  });

  it('un evento que no está a la venta no se compra', async () => {
    const { repo } = makeRepo();
    await expect(
      repo.purchases.confirmSandbox({ purchaseId: 'p-x', eventId: notOnSale.id }),
    ).rejects.toMatchObject({ code: 'forbidden' });
    await expect(
      repo.purchases.confirmSandbox({ purchaseId: 'p-y', eventId: 'no-existe' }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('el descuento sólo vale encontrado, vigente y de su evento', async () => {
    const { repo, clock } = makeRepo();
    const discounts = SAMPLE_DISCOUNTS.map((d) => discountSchema.parse(d));
    const usable = discounts.find(
      (d) => d.eventId === onSale.id && discountStatus(d, clock.now()) === 'active',
    );
    // Otro código encontrado que caduca (desde T59 la muestra no trae uno caducado).
    const expired = discounts.find((d) => d.id !== usable?.id && d.endsAt);
    if (!usable || !expired) throw new Error('muestra sin dos descuentos con fecha de fin');
    await expect(
      repo.purchases.confirmSandbox({
        purchaseId: 'p-1',
        eventId: onSale.id,
        discountId: usable.id,
      }),
    ).rejects.toMatchObject({ code: 'invalid' });
    const found = await repo.progress.findDiscount(usable.id);
    expect(found).toMatchObject({ first: true, status: 'active' });
    expect((await repo.progress.findDiscount(usable.id)).first).toBe(false);
    const p = await repo.purchases.confirmSandbox({
      purchaseId: 'p-1',
      eventId: onSale.id,
      discountId: usable.id,
    });
    expect(p.purchase.discountId).toBe(usable.id);
    clock.advance(new Date(expired.endsAt!).getTime() - clock.now().getTime() + 1);
    expect((await repo.progress.findDiscount(expired.id)).status).toBe('expired');
  });
});

it('T106: sample projection respects cancelled/refunded purchases and explicit stamp compensation while QR stays separate', async () => {
  const { repo } = makeRepo();
  await repo.carnet.create({ nickname: 'Sellos separados' });
  const event = SAMPLE_EVENTS.find((e) => e.state === 'on_sale')!;
  await repo.purchases.confirmSandbox({ purchaseId: 't106-revoked', eventId: event.id });
  const owner = (await repo.identity.current())!.id;
  const access = localDocAccess(repo)!;
  access.write(['progress'], (doc) => {
    const stamp = doc.ledger.find((e) => e.purchaseId === 't106-revoked')!;
    doc.ledger.push({
      id: 'compensation:t106',
      userId: owner,
      kind: 'compensation',
      pointsDelta: 0,
      coinsDelta: 0,
      seasonId: null,
      sourceRef: undefined,
      metadata: {},
      createdAt: stamp.createdAt,
      compensatesId: stamp.id,
      reason: 'sample revoked',
    });
    doc.ledger.push({
      id: 'stamp:qr:t106',
      userId: owner,
      kind: 'stamp',
      eventId: event.id,
      purchaseId: 'qr:t106',
      pointsDelta: 0,
      coinsDelta: 0,
      seasonId: null,
      sourceRef: 'qr:t106',
      metadata: {},
      createdAt: stamp.createdAt,
    });
  });
  expect(await repo.progress.stamps()).toEqual([
    expect.objectContaining({ isSample: false, purchaseId: 'qr:t106' }),
  ]);
  const snapshot = access.view((doc) => snapshotOf(doc, owner));
  access.write(['progress'], (doc) => {
    doc.ledger = doc.ledger.filter((e) => e.sourceRef === 'qr:t106');
    applySnapshot(doc, owner, snapshot);
  });
  expect(await repo.progress.stamps()).toHaveLength(1);
  for (const status of ['cancelled', 'refunded'] as const) {
    const purchase = {
      ...snapshot.purchases[0]!,
      id: `t106-${status}`,
      eventId: 'other-event',
      status,
    };
    access.write(['purchases'], (doc) => {
      doc.purchases.push(purchase);
    });
  }
  expect(await repo.progress.stamps()).toHaveLength(1);
  expect(await repo.progress.balances()).toEqual({ points: 0, coins: 0, seasonPoints: {} });
});

it('T106: sin cuentas (D-20), recargar conserva sello de prueba, premio del Carnet y náufrago', async () => {
  const { repo, reload } = makeRepo();
  const event = SAMPLE_EVENTS.find((e) => e.state === 'on_sale')!;
  await repo.carnet.create({ nickname: 'Recarga' });
  await repo.purchases.confirmSandbox({ purchaseId: 't106-local', eventId: event.id });
  await repo.progress.completeAchievement('carnet');
  await repo.progress.claimAchievement('carnet');
  await repo.progress.findDiscount('dto-naufrago');
  await repo.progress.discover('personaje:rescatado:naufrago');
  await repo.progress.completeAchievement('naufrago-fiesta');
  const balances = await repo.progress.balances();
  const again = reload();
  expect((await again.carnet.mine())?.stamps).toEqual([
    expect.objectContaining({ eventId: event.id, purchaseId: 't106-local', isSample: true }),
  ]);
  const state = async (id: string) =>
    (await again.progress.achievements()).find((a) => a.definition.id === id)?.state;
  expect(await state('carnet')).toBe('claimed');
  expect(await state('naufrago-fiesta')).toBe('ready');
  expect((await again.progress.discounts()).map((d) => d.discount.id)).toContain('dto-naufrago');
  expect(await again.progress.balances()).toEqual(balances);
  // Volver a confirmar la misma compra no da otro sello.
  await again.purchases.confirmSandbox({ purchaseId: 't106-local', eventId: event.id });
  expect((await again.carnet.mine())?.stamps).toHaveLength(1);
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CARNET_QUESTIONS, NICKNAME_MAX, discountStatus } from '@boia/contracts';
import { SAMPLE_CREW, SAMPLE_DISCOUNTS, SAMPLE_EVENTS } from './sample';
import { discountSchema } from '@boia/contracts';
import { makeRepo } from './test-helpers';

const MIGRATION = new URL(
  '../../../supabase/migrations/20260928100100_identity.sql',
  import.meta.url,
);

describe('Carnet', () => {
  it('las 5 preguntas son las del esquema de T06, textuales (REQ-IDE-014)', () => {
    const sql = readFileSync(MIGRATION, 'utf8');
    const rows = [...sql.matchAll(/\('([a-z-]+)', (\d+), '((?:[^']|'')*)'\)/g)].map((m) => ({
      id: m[1],
      position: Number(m[2]),
      prompt: m[3]?.replace(/''/g, "'"),
    }));
    expect(rows.length).toBeGreaterThan(0);
    expect(CARNET_QUESTIONS.map(({ id, position, prompt }) => ({ id, position, prompt }))).toEqual(
      rows,
    );
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

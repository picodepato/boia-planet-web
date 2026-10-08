import { describe, expect, it } from 'vitest';
import { CARNET_MODERATED_ANSWER } from './local';
import { SAMPLE_CREW } from './sample';
import { TRASH_RETENTION_DEFAULT_DAYS } from './schema';
import { makeRepo } from './test-helpers';

/**
 * Plan 020 T229: la moderación fina de un Carnet en modo local. El Admin
 * retira una sola respuesta y cambia o quita el enlace a la música de un
 * Carnet de artista sin ocultar el Carnet; cada cambio va a la papelera de
 * cambios (30 días) y «Deshacer» lo devuelve.
 */

const DAY = 86_400_000;
const answered = SAMPLE_CREW.find((c) => Object.keys(c.answers).length > 1)!;
const SC = { platform: 'soundcloud', url: 'https://soundcloud.com/zeta' } as const;
const BC = { platform: 'bandcamp', url: 'https://zeta.bandcamp.com/' } as const;

describe('una respuesta de un Carnet', () => {
  it('se retira sola (el Carnet y las demás siguen) y se deshace desde la papelera', async () => {
    const { repo } = makeRepo();
    const [q1, q2] = Object.keys(answered.answers);
    const a1 = answered.answers[q1!];
    const a2 = answered.answers[q2!];
    await repo.admin.moderateCarnet(
      answered.userId,
      { kind: 'hide_answer', questionId: q1! },
      { reason: 'ofensiva' },
    );
    let view = (await repo.carnet.get(answered.userId))!;
    expect(view.answers.find((a) => a.questionId === q1)!.answer).toBe(CARNET_MODERATED_ANSWER);
    expect(view.answers.find((a) => a.questionId === q2)!.answer).toBe(a2);

    const [change] = await repo.admin.changes();
    expect(change).toMatchObject({
      area: 'carnets',
      targetId: `${answered.userId}/${q1}`,
      kind: 'edit',
      reason: 'ofensiva',
    });
    expect(new Date(change!.expiresAt).getTime() - new Date(change!.changedAt).getTime()).toBe(
      TRASH_RETENTION_DEFAULT_DAYS * DAY,
    );
    await repo.admin.revertChange(change!.id);
    view = (await repo.carnet.get(answered.userId))!;
    expect(view.answers.find((a) => a.questionId === q1)!.answer).toBe(a1);
    expect(view.moderated.answers).toBe(0);
  });

  it('deshacer una retirada no deshace las de después', async () => {
    const { repo } = makeRepo();
    const [q1, q2] = Object.keys(answered.answers);
    await repo.admin.moderateCarnet(answered.userId, { kind: 'hide_answer', questionId: q1! });
    await repo.admin.moderateCarnet(answered.userId, { kind: 'hide_answer', questionId: q2! });
    const first = (await repo.admin.changes()).find(
      (c) => c.targetId === `${answered.userId}/${q1}`,
    )!;
    await repo.admin.revertChange(first.id);
    const view = (await repo.carnet.get(answered.userId))!;
    expect(view.answers.find((a) => a.questionId === q1)!.answer).toBe(answered.answers[q1!]);
    expect(view.answers.find((a) => a.questionId === q2)!.answer).toBe(CARNET_MODERATED_ANSWER);
  });

  it('pasado el plazo de la papelera ya no se deshace', async () => {
    const { repo, clock } = makeRepo();
    const [q1] = Object.keys(answered.answers);
    await repo.admin.moderateCarnet(answered.userId, { kind: 'hide_answer', questionId: q1! });
    const [change] = await repo.admin.changes();
    clock.advance(TRASH_RETENTION_DEFAULT_DAYS * DAY + 1);
    await expect(repo.admin.revertChange(change!.id)).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('el enlace a la música de un Carnet de artista', () => {
  async function artistRepo() {
    const r = makeRepo();
    const c = await r.repo.carnet.create({ nickname: 'Zeta', artistCode: 'abc', musicLink: SC });
    return { ...r, userId: c.userId };
  }

  it('el Admin lo cambia y lo quita sin ocultar el Carnet; cada cambio se deshace', async () => {
    const { repo, userId } = await artistRepo();
    await repo.admin.setCarnetMusic(userId, BC, { reason: 'enlace roto' });
    expect((await repo.carnet.get(userId))?.musicLink).toEqual(BC);
    await repo.admin.setCarnetMusic(userId, null, { reason: 'spam' });
    const view = (await repo.carnet.get(userId))!;
    expect(view.musicLink).toBeUndefined();
    expect(view.nickname).toBe('Zeta');

    const changes = (await repo.admin.changes()).filter((c) => c.targetId === `${userId}/music`);
    expect(changes.map((c) => [c.before, c.after])).toEqual([
      [BC, null],
      [SC, BC],
    ]);
    await repo.admin.revertChange(changes[0]!.id);
    expect((await repo.carnet.get(userId))?.musicLink).toEqual(BC);
    await repo.admin.revertChange(changes[1]!.id);
    expect((await repo.carnet.get(userId))?.musicLink).toEqual(SC);
  });

  it('si el artista lo cambió después, deshacer no lo pisa', async () => {
    const { repo, userId } = await artistRepo();
    await repo.admin.setCarnetMusic(userId, null, { reason: 'quitar' });
    const [change] = await repo.admin.changes();
    await repo.carnet.update({ musicLink: BC });
    await expect(repo.admin.revertChange(change!.id)).rejects.toMatchObject({ code: 'conflict' });
    expect((await repo.carnet.get(userId))?.musicLink).toEqual(BC);
  });

  it('un enlace que no vale, o un Carnet que no es de artista, se rechaza', async () => {
    const { repo, userId } = await artistRepo();
    await expect(
      repo.admin.setCarnetMusic(userId, { platform: 'spotify', url: 'https://soundcloud.com/x' }),
    ).rejects.toMatchObject({ code: 'invalid' });
    const plain = makeRepo();
    const mine = await plain.repo.carnet.create({ nickname: 'Socia' });
    await expect(plain.repo.admin.setCarnetMusic(mine.userId, SC)).rejects.toMatchObject({
      code: 'invalid',
    });
    await expect(plain.repo.admin.setCarnetMusic('nadie', null)).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('guardar el mismo enlace no deja un cambio en la papelera', async () => {
    const { repo, userId } = await artistRepo();
    await repo.admin.setCarnetMusic(userId, SC, { reason: 'igual' });
    expect(await repo.admin.changes()).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { moderatedNickname } from './local';
import { SAMPLE_CREW } from './sample';
import { makeRepo } from './test-helpers';

/**
 * Plan 017 T191 (REQ-ADM-031): moderación de Carnets y botellas en el
 * repositorio local (la demo del Admin). Ocultar un Carnet entero y
 * devolverlo, devolver el apodo y la foto, y devolver al mar una botella
 * retirada; lo público (Carnet, descubrir, ranking, botellas) lo refleja.
 */

const member = SAMPLE_CREW.find((c) => c.avatarKey) ?? SAMPLE_CREW[0]!;

describe('moderación de Carnets: ocultar y devolver', () => {
  it('lista todos los Carnets de personas, los moderados primero', async () => {
    const { repo } = makeRepo();
    const all = await repo.admin.carnets();
    expect(all.map((r) => r.userId).sort()).toEqual(SAMPLE_CREW.map((c) => c.userId).sort());
    expect(all.every((r) => !r.carnet.artist)).toBe(true);
    await repo.admin.moderateCarnet(member.userId, { kind: 'hide_carnet' }, { reason: 'spam' });
    const [first] = await repo.admin.carnets();
    expect(first).toMatchObject({ userId: member.userId, moderation: { hidden: true } });
    // La moderación ve el Carnet tal cual, aunque esté oculto.
    expect(first!.carnet.nickname).toBe(member.nickname);
  });

  it('un Carnet oculto desaparece de lo público y vuelve al mostrarlo', async () => {
    const { repo, reload } = makeRepo();
    await repo.admin.moderateCarnet(member.userId, { kind: 'hide_carnet' }, { reason: 'spam' });
    const fresh = reload();
    expect(await fresh.carnet.get(member.userId)).toBeNull();
    expect((await fresh.carnet.members()).some((m) => m.userId === member.userId)).toBe(false);
    const row = (await fresh.progress.ranking()).rows.find((r) => r.userId === member.userId)!;
    expect(row.nickname).toBe(moderatedNickname(member.userId));
    // Nadie reporta lo que no se ve.
    await expect(fresh.carnet.report(member.userId)).rejects.toMatchObject({ code: 'not_found' });

    await fresh.admin.moderateCarnet(member.userId, { kind: 'show_carnet' }, { reason: 'error' });
    const back = (await fresh.carnet.get(member.userId))!;
    expect(back.nickname).toBe(member.nickname);
    expect(back.moderated).toEqual({ photo: false, nickname: false, answers: 0 });
    expect((await fresh.carnet.members()).some((m) => m.userId === member.userId)).toBe(true);
    // Sin nada retirado, la moderación del Carnet desaparece.
    const listed = (await fresh.admin.carnets()).find((r) => r.userId === member.userId)!;
    expect(listed.moderation).toBeNull();
    const audit = await fresh.admin.audit({ area: 'carnets' });
    expect(audit.slice(0, 2).map((e) => [e.action, e.reason])).toEqual([
      ['moderate', 'error'],
      ['moderate', 'spam'],
    ]);
  });

  it('el dueño de un Carnet oculto lo sigue viendo', async () => {
    const { repo } = makeRepo();
    const mine = await repo.carnet.create({ nickname: 'Pirata Oculto' });
    await repo.admin.moderateCarnet(mine.userId, { kind: 'hide_carnet' }, { reason: 'prueba' });
    expect((await repo.carnet.get(mine.userId))!.nickname).toBe('Pirata Oculto');
    expect((await repo.carnet.mine())!.nickname).toBe('Pirata Oculto');
  });

  it('el apodo y la foto se retiran y se devuelven', async () => {
    const { repo } = makeRepo();
    await repo.admin.moderateCarnet(member.userId, { kind: 'reset_nickname' }, { reason: 'a' });
    await repo.admin.moderateCarnet(member.userId, { kind: 'hide_photo' }, { reason: 'b' });
    let view = (await repo.carnet.get(member.userId))!;
    expect(view.nickname).toBe(moderatedNickname(member.userId));
    expect(view.avatarKey).toBeNull();

    await repo.admin.moderateCarnet(member.userId, { kind: 'restore_nickname' }, { reason: 'c' });
    view = (await repo.carnet.get(member.userId))!;
    expect(view.nickname).toBe(member.nickname);
    expect(view.moderated).toEqual({ photo: true, nickname: false, answers: 0 });

    await repo.admin.moderateCarnet(member.userId, { kind: 'restore_photo' }, { reason: 'd' });
    view = (await repo.carnet.get(member.userId))!;
    expect(view.avatarKey).toBe(member.avatarKey);
    expect(view.moderated).toEqual({ photo: false, nickname: false, answers: 0 });
  });

  it('una respuesta oculta se devuelve', async () => {
    const { repo } = makeRepo();
    const answered = SAMPLE_CREW.find((c) => Object.keys(c.answers).length > 0)!;
    const [questionId, answer] = Object.entries(answered.answers)[0]!;
    await repo.admin.moderateCarnet(answered.userId, { kind: 'hide_answer', questionId });
    await repo.admin.moderateCarnet(answered.userId, { kind: 'restore_answer', questionId });
    const view = (await repo.carnet.get(answered.userId))!;
    expect(view.answers.find((a) => a.questionId === questionId)!.answer).toBe(answer);
  });

  it('devolver algo no da por revisados los reportes abiertos; retirarlo, sí', async () => {
    const { repo } = makeRepo();
    await repo.carnet.report(member.userId, 'foto rara');
    await repo.admin.moderateCarnet(member.userId, { kind: 'restore_photo' });
    expect((await repo.admin.carnetReports())[0]!.open).toBe(1);
    await repo.admin.moderateCarnet(member.userId, { kind: 'hide_carnet' });
    const [row] = await repo.admin.carnetReports();
    expect(row!.open).toBe(0);
    expect(row!.reports[0]!.resolution).toBe('Carnet oculto');
  });
});

describe('moderación de botellas: devolver al mar', () => {
  it('una botella retirada vuelve al mar y queda en la auditoría', async () => {
    const { repo } = makeRepo();
    const bottle = (await repo.bottles.list())[0]!;
    await repo.admin.removeBottle(bottle.id, { reason: 'spam' });
    expect((await repo.bottles.list()).some((b) => b.id === bottle.id)).toBe(false);
    await expect(
      repo.admin.restoreBottle(bottle.id, { reason: 'no era' }),
    ).resolves.toBeUndefined();
    expect((await repo.bottles.list()).some((b) => b.id === bottle.id)).toBe(true);
    const row = (await repo.admin.bottles()).find((b) => b.id === bottle.id)!;
    expect(row).toMatchObject({ status: 'active', moderationReason: null });
    const [entry] = await repo.admin.audit({ area: 'bottles' });
    expect(entry).toMatchObject({ action: 'restore', targetId: bottle.id, reason: 'no era' });
    // Sólo una retirada por moderación vuelve.
    await expect(repo.admin.restoreBottle(bottle.id)).rejects.toMatchObject({ code: 'invalid' });
  });

  it('si su autor ya tiene otra en el mar, no vuelve', async () => {
    const { repo } = makeRepo();
    await repo.carnet.create({ nickname: 'Marinera' });
    const first = await repo.bottles.place({ message: 'primera', x: 1, y: 1 });
    await repo.admin.removeBottle(first.id, { reason: 'spam' });
    await repo.bottles.place({ message: 'segunda', x: 2, y: 2 });
    await expect(repo.admin.restoreBottle(first.id)).rejects.toMatchObject({ code: 'conflict' });
  });

  it('el autor de una botella sale con el apodo moderado', async () => {
    const { repo } = makeRepo();
    const bottle = (await repo.bottles.list()).find((b) => b.authorNickname)!;
    const author = SAMPLE_CREW.find((c) => c.nickname === bottle.authorNickname)!;
    await repo.admin.moderateCarnet(author.userId, { kind: 'hide_carnet' }, { reason: 'spam' });
    const after = (await repo.bottles.list()).find((b) => b.id === bottle.id)!;
    expect(after.authorNickname).toBe(moderatedNickname(author.userId));
  });
});

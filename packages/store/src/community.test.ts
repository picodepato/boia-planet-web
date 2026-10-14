import { carnetQuestionsFor } from '@boia/contracts';
import { describe, expect, it } from 'vitest';
import { CARNET_MODERATED_ANSWER, moderatedNickname } from './local';
import { migrate } from './migrations';
import { SAMPLE_CREW } from './sample';
import { SCHEMA_VERSION } from './schema';
import { MemoryStorage, STORE_KEY } from './storage';
import { makeRepo } from './test-helpers';

/**
 * T45: ranking local (REQ-IDE-053), reporte y moderación de Carnets
 * (REQ-ADM-040) y destino de las misiones por mundo con migración auditada
 * (REQ-AVE-010, REQ-AVE-011), sobre el repositorio local.
 */

const byPoints = [...SAMPLE_CREW].sort((a, b) => b.showcase.points - a.showcase.points);
const top = byPoints[0]!;
const bottom = byPoints.at(-1)!;

describe('ranking local de este navegador', () => {
  it('ordena por puntos, con el visitante siempre dentro y su puesto', async () => {
    const { repo } = makeRepo();
    const empty = await repo.progress.ranking();
    expect(empty.scope).toBe('all');
    expect(empty.rows.map((r) => r.points)).toEqual(
      [...byPoints.map((c) => c.showcase.points), 0].sort((a, b) => b - a),
    );
    expect(empty.mine).toMatchObject({ isMine: true, points: 0, nickname: null });
    expect(empty.mine.position).toBe(SAMPLE_CREW.length + 1);

    // Con más puntos que el último miembro de muestra, sube por encima de él.
    const points = bottom.showcase.points + 5;
    await repo.progress.grantWorldReward({ sourceRef: 'lugar:prueba:points', points });
    await repo.carnet.create({ nickname: 'Grumete de Prueba' });
    const r = await repo.progress.ranking();
    const mine = r.rows.findIndex((x) => x.isMine);
    const last = r.rows.findIndex((x) => x.userId === bottom.userId);
    expect(mine).toBeLessThan(last);
    expect(r.mine).toMatchObject({ points, nickname: 'Grumete de Prueba', hasCarnet: true });
    expect(r.mine.position).toBe(mine + 1);
    expect(r.rows[0]!.userId).toBe(top.userId);
    for (let i = 1; i < r.rows.length; i++) {
      expect(r.rows[i - 1]!.points).toBeGreaterThanOrEqual(r.rows[i]!.points);
    }
  });

  it('cuentan los puntos, nunca las monedas; la temporada sólo cuenta su mundo', async () => {
    const { repo } = makeRepo();
    await repo.progress.grantWorldReward({
      sourceRef: 'lugar:a:points',
      points: 7,
      coins: 500,
      seasonId: 'arcilla',
    });
    await repo.progress.grantWorldReward({
      sourceRef: 'lugar:b:points',
      points: 3,
      seasonId: 'acuarela',
    });
    expect((await repo.progress.ranking()).mine.points).toBe(10);
    const season = await repo.progress.ranking({ season: 'acuarela' });
    expect(season).toMatchObject({ scope: 'season', seasonId: 'acuarela' });
    expect(season.mine.points).toBe(3);
    for (const c of SAMPLE_CREW) {
      const row = season.rows.find((x) => x.userId === c.userId)!;
      expect(row.points).toBe(c.showcase.seasonPoints?.acuarela ?? 0);
    }
  });

  it('los empatados comparten puesto', async () => {
    const { repo } = makeRepo();
    await repo.progress.grantWorldReward({
      sourceRef: 'lugar:empate:points',
      points: bottom.showcase.points,
    });
    const r = await repo.progress.ranking();
    const tied = r.rows.filter((x) => x.points === bottom.showcase.points);
    expect(tied).toHaveLength(2);
    expect(tied[0]!.position).toBe(tied[1]!.position);
    expect(tied[0]!.isMine).toBe(true);
  });
});

describe('reporte y moderación de Carnets', () => {
  const member = SAMPLE_CREW.find((c) => Object.keys(c.answers).length >= 2)!;
  const questionId = Object.keys(member.answers)[0]!;

  it('un Carnet reportado aparece en Moderación; reportar dos veces no duplica', async () => {
    const { repo } = makeRepo();
    expect(await repo.admin.carnetReports()).toEqual([]);
    expect(await repo.carnet.report(member.userId, '  apodo feo  ')).toEqual({ first: true });
    expect(await repo.carnet.report(member.userId, 'otra vez')).toEqual({ first: false });
    const list = await repo.admin.carnetReports();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ userId: member.userId, open: 1 });
    expect(list[0]!.reports[0]).toMatchObject({ reason: 'apodo feo', resolvedAt: null });
    expect(list[0]!.carnet.nickname).toBe(member.nickname);
  });

  it('el propio no se reporta y uno que no existe tampoco', async () => {
    const { repo } = makeRepo();
    const mine = await repo.carnet.create({ nickname: 'Yo Mismo' });
    await expect(repo.carnet.report(mine.userId)).rejects.toMatchObject({ code: 'forbidden' });
    await expect(repo.carnet.report('nadie')).rejects.toMatchObject({ code: 'not_found' });
  });

  it('ocultar una respuesta, la foto o el apodo queda en la auditoría y no borra el Carnet', async () => {
    const { repo, reload } = makeRepo();
    await repo.carnet.report(member.userId, 'respuesta ofensiva');
    await repo.admin.moderateCarnet(
      member.userId,
      { kind: 'hide_answer', questionId },
      { reason: 'lenguaje' },
    );
    const seen = (await reload().carnet.get(member.userId))!;
    const hidden = seen.answers.find((a) => a.questionId === questionId)!;
    expect(hidden).toMatchObject({ answer: CARNET_MODERATED_ANSWER, moderated: true });
    // La pregunta sigue con su respuesta retirada; las demás no cambian.
    expect(seen.answers).toHaveLength(Object.keys(member.answers).length);
    expect(seen.moderated).toEqual({ photo: false, nickname: false, answers: 1 });

    const audit = await repo.admin.audit({ area: 'carnets' });
    expect(audit[0]).toMatchObject({
      action: 'moderate',
      targetId: `${member.userId}/${questionId}`,
      reason: 'lenguaje',
      actor: 'admin-demo',
    });
    // El reporte queda revisado con lo que se hizo.
    const [row] = await repo.admin.carnetReports();
    expect(row).toMatchObject({ open: 0 });
    expect(row!.reports[0]!.resolution).toBe('respuesta retirada');
    // La moderación ve lo guardado, sin tapar.
    expect(row!.carnet.answers.find((a) => a.questionId === questionId)!.answer).toBe(
      member.answers[questionId],
    );

    await repo.admin.moderateCarnet(member.userId, { kind: 'reset_nickname' }, { reason: 'apodo' });
    await repo.admin.moderateCarnet(member.userId, { kind: 'hide_photo' }, { reason: 'foto' });
    const after = (await repo.carnet.get(member.userId))!;
    expect(after.nickname).toBe(moderatedNickname(member.userId));
    expect(after.avatarKey).toBeNull();
    expect(after.moderated).toEqual({ photo: true, nickname: true, answers: 1 });
    expect((await repo.admin.audit({ area: 'carnets' })).map((e) => e.action)).toEqual([
      'moderate',
      'moderate',
      'moderate',
    ]);
    // El ranking usa el apodo restablecido.
    const ranking = await repo.progress.ranking();
    expect(ranking.rows.find((r) => r.userId === member.userId)!.nickname).toBe(
      moderatedNickname(member.userId),
    );
  });

  it('en el Carnet propio, lo nuevo que escribe su dueño se vuelve a ver', async () => {
    const { repo } = makeRepo();
    const q = carnetQuestionsFor(false)[0]!.id;
    const mine = await repo.carnet.create({ nickname: 'Pirata Feo' });
    await repo.carnet.answer(q, 'algo que no debía');
    await repo.admin.moderateCarnet(mine.userId, { kind: 'hide_answer', questionId: q });
    await repo.admin.moderateCarnet(mine.userId, { kind: 'reset_nickname' });
    let view = (await repo.carnet.mine())!;
    expect(view.answers[0]!.moderated).toBe(true);
    expect(view.nickname).toBe(moderatedNickname(mine.userId));
    await repo.carnet.answer(q, 'otra respuesta');
    await repo.carnet.update({ nickname: 'Pirata Majo' });
    view = (await repo.carnet.mine())!;
    expect(view.answers[0]).toMatchObject({ answer: 'otra respuesta' });
    expect(view.answers[0]!.moderated).toBeUndefined();
    expect(view.nickname).toBe('Pirata Majo');
  });

  it('descartar un reporte también queda en la auditoría', async () => {
    const { repo } = makeRepo();
    await repo.carnet.report(member.userId);
    const [row] = await repo.admin.carnetReports();
    await repo.admin.resolveCarnetReport(row!.reports[0]!.id, 'descartado', { reason: 'sin más' });
    expect((await repo.admin.carnetReports())[0]!.open).toBe(0);
    expect((await repo.admin.audit())[0]).toMatchObject({
      area: 'carnets',
      action: 'resolve_report',
      reason: 'sin más',
    });
  });
});

describe('destino de las misiones por mundo', () => {
  const rescued = { step: 'rescued', data: { destination: 'ultima', season: 'arcilla' } };

  it('fija el destino de las nuevas sin tocar las empezadas ni las terminadas', async () => {
    const { repo } = makeRepo();
    await repo.progress.setMission('fiestera', { ...rescued, worldId: 'arcilla' });
    const impact = await repo.admin.missionImpact('arcilla', 'fiestera', 'cala');
    expect(impact).toMatchObject({ started: 1, affected: 1, completed: 0, current: null });
    await repo.admin.setMissionDestination('arcilla', 'fiestera', 'cala', { reason: 'prueba' });
    expect(await repo.content.missionDestinations()).toEqual({ arcilla: { fiestera: 'cala' } });
    expect((await repo.progress.mission('fiestera'))!.data.destination).toBe('ultima');
    // En otro mundo no cuenta.
    expect(await repo.admin.missionImpact('acuarela', 'fiestera', 'cala')).toMatchObject({
      started: 0,
      affected: 0,
    });
    expect((await repo.admin.audit())[0]).toMatchObject({
      area: 'missionDestinations',
      action: 'set',
      targetId: 'arcilla/fiestera',
      after: 'cala',
    });
  });

  it('la migración lleva las empezadas al destino nuevo, con motivo y auditoría', async () => {
    const { repo } = makeRepo();
    await repo.progress.setMission('fiestera', { ...rescued, worldId: 'arcilla' });
    await expect(
      repo.admin.setMissionDestination('arcilla', 'fiestera', 'cala', { migrate: true }),
    ).rejects.toMatchObject({ code: 'invalid' });
    const r = await repo.admin.setMissionDestination('arcilla', 'fiestera', 'cala', {
      migrate: true,
      reason: 'la última isla está en obras',
    });
    expect(r).toMatchObject({ current: 'cala', started: 1, affected: 0 });
    const m = (await repo.progress.mission('fiestera'))!;
    expect(m.data).toMatchObject({ destination: 'cala', migratedFrom: 'ultima' });
    const audit = await repo.admin.audit();
    expect(audit[0]).toMatchObject({ area: 'missions', action: 'migrate' });
    expect(audit[0]!.reason).toBe('la última isla está en obras');
    expect(audit[1]).toMatchObject({ area: 'missionDestinations', action: 'set' });
  });

  it('una misión terminada nunca cambia de destino', async () => {
    const { repo } = makeRepo();
    await repo.progress.setMission('fiestera', {
      step: 'delivered',
      data: { destination: 'ultima' },
      worldId: 'arcilla',
      completed: true,
    });
    const r = await repo.admin.setMissionDestination('arcilla', 'fiestera', 'cala', {
      migrate: true,
      reason: 'x',
    });
    expect(r).toMatchObject({ started: 0, completed: 1 });
    expect((await repo.progress.mission('fiestera'))!.data.destination).toBe('ultima');
  });

  it('null vuelve al destino del mapa; migrar a ninguno no se puede', async () => {
    const { repo } = makeRepo();
    await repo.admin.setMissionDestination('arcilla', 'fiestera', 'cala');
    await repo.admin.setMissionDestination('arcilla', 'fiestera', null);
    expect(await repo.content.missionDestinations()).toEqual({});
    await expect(
      repo.admin.setMissionDestination('arcilla', 'fiestera', null, { migrate: true }),
    ).rejects.toMatchObject({ code: 'invalid' });
    await expect(
      repo.admin.setMissionDestination('arcilla', 'fiestera', 'No Vale'),
    ).rejects.toMatchObject({ code: 'invalid' });
  });
});

describe('migración v5 → v6', () => {
  it('añade reportes, moderación y destinos vacíos sin tocar el progreso', async () => {
    const v5 = {
      schemaVersion: 5,
      identity: { id: 'yo', kind: 'guest', createdAt: '2026-09-01T10:00:00Z' },
      players: {
        yo: {
          discoveries: {},
          discounts: {},
          missions: {
            fiestera: {
              id: 'fiestera',
              step: 'rescued',
              data: { destination: 'ultima' },
              worldId: 'arcilla',
              startedAt: '2026-09-01T10:00:00Z',
              updatedAt: '2026-09-01T10:00:00Z',
              completedAt: null,
            },
          },
          records: {},
          counters: {},
          equipped: {},
          prefs: {},
          achievements: {},
        },
      },
      content: { items: {}, order: {}, places: {}, skins: {}, texts: {} },
    };
    const m = migrate(v5);
    expect(m.status).toBe('ok');
    if (m.status !== 'ok') return;
    expect(m.doc).toMatchObject({
      schemaVersion: SCHEMA_VERSION,
      carnetReports: [],
      carnetModeration: {},
      content: { missionDestinations: {} },
    });
    const storage = new MemoryStorage();
    storage.setItem(STORE_KEY, JSON.stringify(v5));
    const { repo } = makeRepo({ storage });
    expect((await repo.progress.mission('fiestera'))!.data.destination).toBe('ultima');
    expect(await repo.admin.carnetReports()).toEqual([]);
    expect(repo.status().schemaVersion).toBe(SCHEMA_VERSION);
  });
});

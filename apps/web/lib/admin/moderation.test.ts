import type { AdminCarnetRow, VoidedEntry } from '@boia/db/rpc';
import { createLocalRepository, MemoryStorage, SAMPLE_CREW } from '@boia/store';
import { describe, expect, it } from 'vitest';
import { t } from '../i18n';
import { publicModeration } from '../mundo/carnet/public-carnet';
import { canonBoardOptions, castleBoardOptions } from '../mundo/ranking-boards';
import {
  CARNET_ACTION_LABEL,
  carnetActions,
  carnetBadges,
  demoCarnetActions,
  gameBoardOptions,
  needsReason,
  scoreTarget,
  voidedBoardLabel,
} from './moderation';

/**
 * Plan 017 T191 (REQ-ADM-031): el estado de moderación de cada cosa decide
 * qué botones ofrece el Admin, con cuentas y en la demo, y lo que el Carnet
 * público avisa.
 */

const row = (over: Partial<AdminCarnetRow> = {}): AdminCarnetRow => ({
  user_id: '00000000-0000-4000-8000-000000000001',
  nickname: 'Pirata',
  member_number: 7,
  member_since: '2026-10-01T00:00:00Z',
  is_artist: false,
  hidden_at: null,
  nickname_moderated: false,
  avatar_moderated: false,
  has_avatar: true,
  original_nickname: null,
  has_original_avatar: false,
  ...over,
});

describe('Carnets con cuentas: botones según su estado', () => {
  it('visible: ocultarlo, retirar el apodo y la foto (si tiene)', () => {
    expect(carnetActions(row())).toEqual(['hide', 'hide_nickname', 'hide_avatar']);
    expect(carnetActions(row({ has_avatar: false }))).toEqual(['hide', 'hide_nickname']);
  });

  it('con algo retirado: devolverlo', () => {
    expect(
      carnetActions(row({ nickname_moderated: true, avatar_moderated: true, has_avatar: false })),
    ).toEqual(['hide', 'restore_nickname', 'restore_avatar']);
  });

  it('oculto: sólo mostrarlo (devuelve también apodo y foto)', () => {
    expect(
      carnetActions(row({ hidden_at: '2026-10-07T10:00:00Z', nickname_moderated: true })),
    ).toEqual(['show']);
  });

  it('retirar pide motivo; devolver, no; cada acción tiene su texto', () => {
    for (const [action, key] of Object.entries(CARNET_ACTION_LABEL)) {
      expect(needsReason(action as keyof typeof CARNET_ACTION_LABEL)).toBe(
        action.startsWith('hide'),
      );
      expect(t(key)).not.toBe(key);
    }
  });

  it('las etiquetas dicen lo retirado', () => {
    expect(carnetBadges({ hidden: false, nickname: false, avatar: false })).toEqual([]);
    expect(carnetBadges({ hidden: true, nickname: true, avatar: true })).toEqual([
      'admin.moderation.carnets.hidden',
      'admin.moderation.carnets.nicknameHidden',
      'admin.moderation.carnets.avatarHidden',
    ]);
  });
});

describe('Carnets en la demo: los mismos botones sobre el repositorio local', () => {
  const member = SAMPLE_CREW.find((c) => c.avatarKey) ?? SAMPLE_CREW[0]!;
  const repo = () => createLocalRepository({ storage: new MemoryStorage() });
  const view = async (r: ReturnType<typeof repo>) =>
    (await r.admin.carnets()).find((x) => x.userId === member.userId)!;

  it('cada botón aplica su acción y el siguiente estado ofrece la contraria', async () => {
    const r = repo();
    const actions = demoCarnetActions(await view(r));
    expect(actions.map((a) => a.action)).toEqual(['hide', 'hide_nickname', 'hide_avatar']);
    await r.admin.moderateCarnet(member.userId, actions[1]!.demo, { reason: 'apodo' });
    await r.admin.moderateCarnet(member.userId, actions[2]!.demo, { reason: 'foto' });
    expect(demoCarnetActions(await view(r)).map((a) => a.action)).toEqual([
      'hide',
      'restore_nickname',
      'restore_avatar',
    ]);
    await r.admin.moderateCarnet(member.userId, actions[0]!.demo, { reason: 'oculto' });
    const hidden = demoCarnetActions(await view(r));
    expect(hidden.map((a) => a.action)).toEqual(['show']);
    await r.admin.moderateCarnet(member.userId, hidden[0]!.demo);
    expect((await view(r)).moderation).toBeNull();
  });
});

describe('el Carnet público con cuentas avisa de lo retirado', () => {
  it('lee las marcas de la fila; sin columnas (base sin migrar), nada', () => {
    expect(publicModeration({ nickname_moderated: true, avatar_moderated: false })).toEqual({
      photo: false,
      nickname: true,
      answers: 0,
    });
    expect(publicModeration({})).toEqual({ photo: false, nickname: false, answers: 0 });
  });
});

describe('rankings: las tablas de juego y las anuladas', () => {
  it('todas las tablas del Cañón y del Castillo, con los argumentos de la RPC', () => {
    const options = gameBoardOptions();
    expect(options).toHaveLength(canonBoardOptions().length + castleBoardOptions().length);
    for (const o of options) {
      const target = scoreTarget(o.board);
      if (o.board.kind === 'canon') {
        expect(target).toEqual({
          p_board: 'canon',
          p_key: o.board.boss,
          p_version: o.board.version,
        });
      } else {
        expect(target).toEqual({
          p_board: 'castle',
          p_key: `${o.board.runMin}:${o.board.difficulty}`,
          p_version: o.board.version,
        });
        // La clave del Castillo es la que espera la migración.
        expect(target.p_key).toMatch(/^[0-9]+:[a-z]+$/);
      }
    }
  });

  it('una anulada dice de qué ranking es', () => {
    const entry = (over: Partial<VoidedEntry>): VoidedEntry => ({
      board: 'race',
      user_id: 'u',
      nickname: 'Pirata',
      key: 'el-freu',
      version: 3,
      value: 45_000,
      voided_at: '2026-10-07T10:00:00Z',
      void_reason: 'tiempo imposible',
      ...over,
    });
    expect(voidedBoardLabel(entry({}))).toBe(
      t('admin.real.rankings.race', { circuit: 'el-freu', version: 3 }),
    );
    const canon = canonBoardOptions()[0]!;
    if (canon.board.kind !== 'canon') throw new Error('tabla del Cañón');
    expect(voidedBoardLabel(entry({ board: 'canon', key: canon.board.boss }))).toBe(
      t('admin.real.rankings.canon', { board: canon.label }),
    );
    const castle = castleBoardOptions()[0]!;
    if (castle.board.kind !== 'castle') throw new Error('tabla del Castillo');
    expect(
      voidedBoardLabel(
        entry({ board: 'castle', key: `${castle.board.runMin}:${castle.board.difficulty}` }),
      ),
    ).toBe(t('admin.real.rankings.castle', { board: castle.label }));
    // Una tabla desconocida sale con su clave.
    expect(voidedBoardLabel(entry({ board: 'castle', key: '99:rara' }))).toContain('99:rara');
  });
});

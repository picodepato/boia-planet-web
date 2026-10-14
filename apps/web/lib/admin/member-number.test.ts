import { MEMBER_NUMBER_FIRST, MemoryStorage, STORE_KEY, createLocalRepository } from '@boia/store';
import { WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { t } from '../i18n';
import { AdminError, createAdminActions } from './actions';

/**
 * Plan 029 T282: el Admin local cambia el nº de un Carnet de este navegador
 * con avisos en castellano (número no válido, número ocupado). Las reglas
 * del repositorio están en packages/store/src/member-number.test.ts.
 */

const now = () => new Date('2026-10-14T10:00:00Z');

async function setup() {
  const storage = new MemoryStorage();
  const first = createLocalRepository({ storage, now, watch: false });
  const mine = await first.carnet.create({
    nickname: 'Numerada',
    avatarKey: null,
    avatarImage: null,
  });
  const doc = JSON.parse(storage.getItem(STORE_KEY)!);
  doc.carnets.otro = {
    ...doc.carnets[mine.userId],
    userId: 'otro',
    nickname: 'Otra',
    memberNumber: 33,
  };
  storage.setItem(STORE_KEY, JSON.stringify(doc));
  const repo = createLocalRepository({ storage, now, watch: false });
  return { repo, mine, actions: createAdminActions({ repo, registry: WORLD_REGISTRY, now }) };
}

async function failure(p: Promise<unknown>): Promise<unknown> {
  return p.then(
    () => null,
    (e: unknown) => e,
  );
}

describe('cambiar el nº de un Carnet desde el Admin local', () => {
  it('rechaza el 0, decimales y texto con el aviso de número no válido', async () => {
    const { actions, mine } = await setup();
    for (const typed of ['0', '000', '-4', '2.5', 'doce', '', '123456789']) {
      const err = await failure(actions.setMemberNumber(mine.userId, typed));
      expect(err, typed).toBeInstanceOf(AdminError);
      expect((err as Error).message, typed).toBe(t('admin.real.error.invalidNumber'));
    }
  });

  it('un número de otro Carnet: aviso de número ocupado y nada cambia', async () => {
    const { actions, repo, mine } = await setup();
    const err = await failure(actions.setMemberNumber(mine.userId, '33'));
    expect(err).toBeInstanceOf(AdminError);
    expect((err as Error).message).toBe(t('admin.real.error.numberTaken'));
    expect((await repo.carnet.mine())!.memberNumber).toBe(MEMBER_NUMBER_FIRST);
  });

  it('uno libre se guarda (también del 1 al 9) y el Carnet lo enseña', async () => {
    const { actions, repo, mine } = await setup();
    await actions.setMemberNumber(mine.userId, ' 3 ', '');
    expect((await repo.carnet.mine())!.memberNumber).toBe(3);
    const [entry] = await repo.admin.audit({ area: 'carnets' });
    expect(entry).toMatchObject({
      action: 'member_number',
      reason: t('admin.real.socios.numberReason'),
      after: { memberNumber: 3 },
    });
  });
});

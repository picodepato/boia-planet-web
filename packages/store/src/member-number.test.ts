import { describe, expect, it } from 'vitest';
import {
  MEMBER_NUMBER_FIRST,
  MEMBER_NUMBER_MAX,
  memberNumberProblem,
  nextMemberNumber,
  numberUnnumbered,
} from './member-number';
import { SAMPLE_CREW } from './sample';
import { STORE_KEY } from './storage';
import { makeRepo } from './test-helpers';

/**
 * Plan 029 T282: números de Carnet seguidos desde el 10 en modo local (el 0
 * es del Admin, del 1 al 9 reservados) y el cambio de número desde el Admin.
 */

describe('nextMemberNumber', () => {
  it('sin contador empieza en el 10 y sigue de uno en uno', () => {
    expect(nextMemberNumber(undefined, [])).toBe(MEMBER_NUMBER_FIRST);
    expect(nextMemberNumber(MEMBER_NUMBER_FIRST, [])).toBe(MEMBER_NUMBER_FIRST + 1);
  });

  it('nunca da del 0 al 9 aunque el contador esté por debajo', () => {
    for (const c of [0, 1, 5, 8, 9]) expect(nextMemberNumber(c, [])).toBe(MEMBER_NUMBER_FIRST);
  });

  it('salta los números ocupados', () => {
    const f = MEMBER_NUMBER_FIRST;
    expect(nextMemberNumber(undefined, [f, f + 1, f + 3])).toBe(f + 2);
    expect(nextMemberNumber(f + 2, [f + 3, f + 4])).toBe(f + 5);
  });
});

describe('memberNumberProblem', () => {
  it('entero de 1 al máximo; ni el 0 ni decimales ni negativos', () => {
    for (const bad of [0, -1, 1.5, Number.NaN, MEMBER_NUMBER_MAX + 1, '12', null]) {
      expect(memberNumberProblem(bad, []), String(bad)).toBe('invalid');
    }
    for (const good of [1, 9, MEMBER_NUMBER_FIRST, MEMBER_NUMBER_MAX]) {
      expect(memberNumberProblem(good, []), String(good)).toBeNull();
    }
  });

  it('ocupado por otro, no; el suyo, sí', () => {
    expect(memberNumberProblem(12, [11, 12])).toBe('taken');
    expect(memberNumberProblem(12, [11, 12], 12)).toBeNull();
  });
});

describe('numberUnnumbered', () => {
  it('da número por orden de alta a los que no lo tienen, sin tocar los demás', () => {
    const carnets = {
      b: { memberSince: '2026-10-02T00:00:00Z' } as { memberNumber?: number; memberSince: string },
      a: { memberSince: '2026-10-01T00:00:00Z' } as { memberNumber?: number; memberSince: string },
      c: { memberSince: '2026-09-01T00:00:00Z', memberNumber: MEMBER_NUMBER_FIRST },
    };
    const last = numberUnnumbered(carnets, undefined);
    expect(carnets.c.memberNumber).toBe(MEMBER_NUMBER_FIRST);
    expect(carnets.a.memberNumber).toBe(MEMBER_NUMBER_FIRST + 1);
    expect(carnets.b.memberNumber).toBe(MEMBER_NUMBER_FIRST + 2);
    expect(last).toBe(MEMBER_NUMBER_FIRST + 2);
  });
});

describe('el Carnet de este navegador', () => {
  const create = (repo: ReturnType<typeof makeRepo>['repo'], nickname: string) =>
    repo.carnet.create({ nickname, avatarKey: null, avatarImage: null });

  it('el primero lleva el 10; tras empezar de cero, el siguiente lleva el 11', async () => {
    const { repo } = makeRepo();
    expect((await create(repo, 'Primera')).memberNumber).toBe(MEMBER_NUMBER_FIRST);
    expect((await repo.carnet.mine())!.memberNumber).toBe(MEMBER_NUMBER_FIRST);
    await repo.identity.reset();
    expect((await create(repo, 'Segunda')).memberNumber).toBe(MEMBER_NUMBER_FIRST + 1);
  });

  it('salta un número que ya tiene otro Carnet guardado', async () => {
    const { repo, storage, reload } = makeRepo();
    const mine = await create(repo, 'Primera');
    const doc = JSON.parse(storage.getItem(STORE_KEY)!);
    const own = doc.carnets[mine.userId];
    doc.carnets.otro = { ...own, userId: 'otro', nickname: 'Otra', memberNumber: 11 };
    storage.setItem(STORE_KEY, JSON.stringify(doc));
    const again = reload();
    await again.identity.reset();
    expect((await create(again, 'Tercera')).memberNumber).toBe(12);
  });

  it('un Carnet guardado antes de T282 recibe número al leerse, y el siguiente sigue', async () => {
    const { repo, storage, reload } = makeRepo();
    const mine = await create(repo, 'Antigua');
    const doc = JSON.parse(storage.getItem(STORE_KEY)!);
    delete doc.carnets[mine.userId].memberNumber;
    delete doc.memberCounter;
    storage.setItem(STORE_KEY, JSON.stringify(doc));
    const again = reload();
    expect((await again.carnet.mine())!.memberNumber).toBe(MEMBER_NUMBER_FIRST);
    await again.identity.reset();
    expect((await create(again, 'Nueva')).memberNumber).toBe(MEMBER_NUMBER_FIRST + 1);
  });

  it('los miembros de muestra no llevan número', async () => {
    const { repo } = makeRepo();
    const view = await repo.carnet.get(SAMPLE_CREW[0]!.userId);
    expect(view?.memberNumber).toBeUndefined();
  });
});

describe('el Admin cambia el número', () => {
  it('valida el rango, rechaza uno ocupado y deja el cambio en la auditoría', async () => {
    const { repo, storage, reload } = makeRepo();
    const mine = await repo.carnet.create({
      nickname: 'Cambia',
      avatarKey: null,
      avatarImage: null,
    });
    const doc = JSON.parse(storage.getItem(STORE_KEY)!);
    doc.carnets.otro = {
      ...doc.carnets[mine.userId],
      userId: 'otro',
      nickname: 'Otra',
      memberNumber: 42,
    };
    storage.setItem(STORE_KEY, JSON.stringify(doc));
    const r = reload();

    for (const bad of [0, -3, 2.5, MEMBER_NUMBER_MAX + 1]) {
      await expect(r.admin.setMemberNumber(mine.userId, bad), String(bad)).rejects.toMatchObject({
        code: 'invalid',
      });
    }
    await expect(r.admin.setMemberNumber(mine.userId, 42)).rejects.toMatchObject({
      code: 'conflict',
    });
    await expect(r.admin.setMemberNumber(SAMPLE_CREW[0]!.userId, 77)).rejects.toMatchObject({
      code: 'not_found',
    });
    expect((await r.carnet.mine())!.memberNumber).toBe(MEMBER_NUMBER_FIRST);

    // Del 1 al 9 los reserva el alta, no el Admin.
    await r.admin.setMemberNumber(mine.userId, 7, { reason: 'número bonito' });
    expect((await r.carnet.mine())!.memberNumber).toBe(7);
    const [entry] = await r.admin.audit({ area: 'carnets' });
    expect(entry).toMatchObject({
      action: 'member_number',
      targetId: mine.userId,
      reason: 'número bonito',
      before: { memberNumber: MEMBER_NUMBER_FIRST },
      after: { memberNumber: 7 },
    });

    // El 10 queda libre, pero el contador sigue: el siguiente alta lleva el 11.
    await r.identity.reset();
    const next = await r.carnet.create({ nickname: 'Despues', avatarKey: null, avatarImage: null });
    expect(next.memberNumber).toBe(MEMBER_NUMBER_FIRST + 1);
  });
});

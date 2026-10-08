import { describe, expect, it } from 'vitest';
import { isStoreError } from './errors';
import { SAMPLE_CREW, SAMPLE_EVENTS } from './sample';
import { makeRepo } from './test-helpers';

/**
 * La puerta de la fiesta en modo local (plan 019 T218, decisión 11): el
 * lector del equipo y el Admin a mano ponen el sello de la fiesta en un
 * Carnet y lo apuntan como asistencia. Con cuentas, lo mismo va por
 * `staff_stamp` (supabase/migrations/20261008100300_door_stamps.sql).
 */
const event = SAMPLE_EVENTS.find((e) => e.state === 'on_sale') ?? SAMPLE_EVENTS[0]!;

async function failure(p: Promise<unknown>): Promise<unknown> {
  return p.then(
    () => null,
    (e: unknown) => e,
  );
}

describe('sellos del equipo: la puerta y el Admin', () => {
  it('la puerta sella el Carnet una vez por fiesta y lo apunta como asistencia', async () => {
    const { repo, reload } = makeRepo();
    const mine = await repo.carnet.create({ nickname: 'Puerta Uno' });
    const first = await repo.admin.stampCarnet(mine.userId, event.id, { source: 'door' });
    expect(first).toMatchObject({
      granted: true,
      userId: mine.userId,
      nickname: 'Puerta Uno',
      eventId: event.id,
      eventName: event.name,
    });
    const again = await reload().admin.stampCarnet(mine.userId, event.id, { source: 'door' });
    expect(again).toMatchObject({ granted: false, at: first.at });

    const carnet = await reload().carnet.mine();
    expect(carnet?.stamps.map((s) => s.eventId)).toEqual([event.id]);
    expect(carnet?.stamps[0]?.isSample).toBe(false);
    expect(await reload().admin.attendance(event.id)).toEqual([
      { userId: mine.userId, nickname: 'Puerta Uno', source: 'door', at: first.at },
    ]);
    const audit = await repo.admin.audit({ area: 'ledger' });
    expect(audit.filter((a) => a.action === 'stamp')).toHaveLength(1);
  });

  it('el sello de la compra de prueba no es asistencia: la puerta lo verifica', async () => {
    const { repo } = makeRepo();
    const mine = await repo.carnet.create({ nickname: 'Puerta Dos' });
    const onSale = SAMPLE_EVENTS.find((e) => e.state === 'on_sale');
    if (!onSale) return;
    await repo.purchases.confirmSandbox({ purchaseId: 'p-puerta', eventId: onSale.id });
    expect((await repo.carnet.mine())?.stamps[0]?.isSample).toBe(true);
    const r = await repo.admin.stampCarnet(mine.userId, onSale.id, { source: 'door' });
    expect(r.granted).toBe(true);
    const stamps = (await repo.carnet.mine())?.stamps ?? [];
    expect(stamps).toHaveLength(1);
    expect(stamps[0]?.isSample).toBe(false);
  });

  it('a mano desde el Admin pide motivo y queda como manual', async () => {
    const { repo } = makeRepo();
    const mine = await repo.carnet.create({ nickname: 'Puerta Tres' });
    const noReason = await failure(
      repo.admin.stampCarnet(mine.userId, event.id, { source: 'manual' }),
    );
    expect(isStoreError(noReason, 'invalid')).toBe(true);
    const r = await repo.admin.stampCarnet(mine.userId, event.id, {
      source: 'manual',
      reason: 'vino sin móvil',
    });
    expect(r.granted).toBe(true);
    expect((await repo.admin.attendance(event.id))[0]?.source).toBe('manual');
    const audit = await repo.admin.audit({ area: 'ledger' });
    expect(audit.find((a) => a.action === 'stamp')?.reason).toBe('vino sin móvil');
  });

  it('sin Carnet, con uno de muestra o con una fiesta que no existe: no_found', async () => {
    const { repo } = makeRepo();
    const mine = await repo.carnet.create({ nickname: 'Puerta Cuatro' });
    for (const [userId, eventId] of [
      ['no-existe', event.id],
      [SAMPLE_CREW[0]!.userId, event.id],
      [mine.userId, 'fiesta-que-no-existe'],
    ] as const) {
      const err = await failure(repo.admin.stampCarnet(userId, eventId, { source: 'door' }));
      expect(isStoreError(err, 'not_found'), `${userId} ${eventId}`).toBe(true);
    }
    const badSource = await failure(
      repo.admin.stampCarnet(mine.userId, event.id, { source: 'qr' as 'door' }),
    );
    expect(isStoreError(badSource, 'invalid')).toBe(true);
    expect((await repo.carnet.mine())?.stamps).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { SAMPLE_DISCOUNTS } from './sample';
import { makeRepo } from './test-helpers';

/**
 * El código común de la ticketera (plan 019 T215, decisión 7): fijado en los
 * ajustes del Admin, todos los descuentos de entradas que ve el visitante
 * enseñan ese código; vacío, cada uno el suyo. El Admin sigue viendo y
 * editando el código propio de cada descuento.
 */

const ticketCodes = SAMPLE_DISCOUNTS.filter((d) => (d.scope ?? 'event') === 'event');

async function findAll(repo: ReturnType<typeof makeRepo>['repo']) {
  for (const d of ticketCodes) await repo.progress.findDiscount(d.id);
  return repo.progress.discounts();
}

describe('código común de la ticketera', () => {
  it('sin código común, cada descuento enseña el suyo', async () => {
    const { repo } = makeRepo();
    expect((await repo.admin.settings()).commonDiscountCode).toBeUndefined();
    const found = await findAll(repo);
    expect(found.map((f) => [f.discount.id, f.discount.code])).toEqual(
      ticketCodes.map((d) => [d.id, d.code]),
    );
  });

  it('con código común, todos los descuentos de entradas enseñan ese código', async () => {
    const { repo } = makeRepo();
    await repo.admin.setSettings({ commonDiscountCode: '  BOIATICKET  ' }, { reason: 'prueba' });
    expect((await repo.admin.settings()).commonDiscountCode).toBe('BOIATICKET');
    const found = await findAll(repo);
    expect(found).toHaveLength(ticketCodes.length);
    for (const f of found) expect(f.discount.code).toBe('BOIATICKET');
    // Uno recién encontrado también lo enseña.
    const again = await repo.progress.findDiscount(ticketCodes[0]!.id);
    expect(again.discount.code).toBe('BOIATICKET');
    // El Admin sigue viendo el código propio de cada uno.
    const own = await repo.content.list('discounts');
    for (const d of ticketCodes) expect(own.find((x) => x.id === d.id)?.code).toBe(d.code);
  });

  it('al vaciarlo, vuelve el código propio de cada uno', async () => {
    const { repo } = makeRepo();
    await repo.admin.setSettings({ commonDiscountCode: 'BOIATICKET' });
    await repo.admin.setSettings({ commonDiscountCode: undefined });
    expect((await repo.admin.settings()).commonDiscountCode).toBeUndefined();
    const found = await findAll(repo);
    for (const f of found)
      expect(f.discount.code).toBe(ticketCodes.find((d) => d.id === f.discount.id)!.code);
  });

  it('un descuento de la tienda conserva su código (lo valida la tienda)', async () => {
    const { repo } = makeRepo();
    await repo.admin.upsert('discounts', {
      id: 'dto-tienda',
      code: 'TIENDA5',
      label: '5 € en la tienda',
      kind: 'amount',
      value: 500,
      scope: 'store',
    });
    await repo.admin.setSettings({ commonDiscountCode: 'BOIATICKET' });
    const found = await repo.progress.findDiscount('dto-tienda');
    expect(found.discount.code).toBe('TIENDA5');
  });

  it('un código común vacío o demasiado largo no se guarda', async () => {
    const { repo } = makeRepo();
    await expect(repo.admin.setSettings({ commonDiscountCode: '   ' })).rejects.toThrow();
    await expect(repo.admin.setSettings({ commonDiscountCode: 'X'.repeat(41) })).rejects.toThrow();
  });
});

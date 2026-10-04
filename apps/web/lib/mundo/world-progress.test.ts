import type { WorldEvent } from '@boia/engine';
import { MemoryStorage, createLocalRepository } from '@boia/store';
import { WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { discountFound, persistWorldEvent } from './world-progress';

/**
 * Descuentos escondidos con el repositorio local de verdad (T20,
 * REQ-COM-021): el código se concede una sola vez, también tras recargar, y
 * el caducado se enseña como caducado. Cada «visita» es un repositorio nuevo
 * sobre el mismo almacenamiento.
 */

function browser(now = '2026-09-29T18:00:00Z') {
  const storage = new MemoryStorage();
  return () => createLocalRepository({ storage, now: () => new Date(now), watch: false });
}

const world = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId);

/** Los descuentos que el mapa esconde (lugar → id de descuento), leídos de los datos. */
const hidden = world.config.objects.flatMap((o) =>
  o.behaviors.flatMap((b) => {
    const p = b.params as { kind?: unknown; ref?: unknown };
    return b.type === 'reward' && p.kind === 'discount' && typeof p.ref === 'string'
      ? [{ objectId: o.identity.id, ref: p.ref }]
      : [];
  }),
);

const ctx = (sessionId: string) => ({ sessionId, worldId: world.id });

function discountEvent(objectId: string, ref: string): WorldEvent {
  return {
    type: 'reward',
    objectId,
    kind: 'discount',
    amount: 1,
    ref,
    frequency: 'once',
    key: null,
  };
}

describe('descuentos escondidos (REQ-COM-021)', () => {
  it('el mapa esconde descuentos y todos existen en el contenido', async () => {
    expect(hidden.length).toBeGreaterThan(0);
    const repo = browser()();
    for (const h of hidden) {
      const f = await repo.progress.findDiscount(h.ref, { worldId: world.id });
      expect(f.discount.id).toBe(h.ref);
    }
  });

  it('un código se concede una vez: ni en la misma visita ni al recargar', async () => {
    const visit = browser();
    const first = visit();
    for (const h of hidden) {
      const out = await persistWorldEvent(
        first.progress,
        discountEvent(h.objectId, h.ref),
        ctx('a'),
      );
      expect(out).toHaveLength(h.ref === 'dto-naufrago' ? 2 : 1);
      expect(out[0]!.kind).toBe('discount');
      // Otra vez en la misma visita: nada.
      expect(
        await persistWorldEvent(first.progress, discountEvent(h.objectId, h.ref), ctx('a')),
      ).toEqual([]);
    }
    // Otra visita (recarga): tampoco; siguen guardados, uno por código.
    const again = visit();
    for (const h of hidden) {
      expect(await discountFound(again.progress, h.ref, ctx('b'))).toEqual([]);
    }
    const saved = await again.progress.discounts();
    expect(saved.map((d) => d.discount.id).sort()).toEqual(
      [...new Set(hidden.map((h) => h.ref))].sort(),
    );
  });

  it('el caducado se guarda y se enseña como caducado', async () => {
    // Desde T59 ningún escondido de la muestra está caducado hoy: se mira
    // uno después de su fecha de fin.
    const repo = browser()();
    const all = await Promise.all(
      hidden.map((h) => repo.progress.findDiscount(h.ref, { worldId: world.id })),
    );
    const ending = all.find((f) => f.discount.endsAt)!;
    expect(ending).toBeDefined();
    const after = new Date(new Date(ending.discount.endsAt!).getTime() + 60_000).toISOString();
    const fresh = browser(after)();
    const out = await discountFound(fresh.progress, ending.discount.id, ctx('a'));
    expect(out[0]!.kind === 'discount' && out[0]!.found.status).toBe('expired');
    expect(out[0]!.notice.title).toMatch(/caducado/i);
  });

  it('un descuento que ya no existe no hace nada', async () => {
    const repo = browser()();
    expect(await discountFound(repo.progress, 'no-existe', ctx('a'))).toEqual([]);
  });

  it('T115: el primer rescate completa sin pagar; recargar y reclamar conserva el descuento y paga una vez', async () => {
    const visit = browser();
    const repo = visit();
    const event = discountEvent('naufrago', 'dto-naufrago');
    const out = await persistWorldEvent(repo.progress, event, ctx('rescate'));
    expect(out.map((o) => o.notice.id)).toEqual([
      'descuento:dto-naufrago',
      'logro:naufrago-fiesta',
    ]);
    expect(
      (await repo.progress.achievements()).find((a) => a.definition.id === 'naufrago-fiesta'),
    ).toMatchObject({
      state: 'ready',
      hidden: false,
      definition: { trigger: 'rescue_character', points: 80, coins: 40, sample: true },
    });
    expect(await repo.progress.balances()).toMatchObject({ points: 0, coins: 0 });
    expect(await repo.progress.ledger()).toEqual([]);
    expect((await repo.progress.discoveries()).map((d) => d.key)).not.toContain(
      'personaje:entregado:naufrago',
    );

    const back = visit();
    expect(await persistWorldEvent(back.progress, event, ctx('vuelta'))).toEqual([]);
    expect((await back.progress.claimAchievement('naufrago-fiesta')).claimed).toBe(true);
    const later = visit();
    expect(await persistWorldEvent(later.progress, event, ctx('otra'))).toEqual([]);
    expect((await later.progress.claimAchievement('naufrago-fiesta')).claimed).toBe(false);
    expect(await later.progress.balances()).toMatchObject({ points: 80, coins: 40 });
    expect((await later.progress.discounts()).map((d) => d.discount.id)).toContain('dto-naufrago');
    expect(
      (await later.progress.ledger()).filter((e) => e.achievementId === 'naufrago-fiesta'),
    ).toHaveLength(1);
  });

  it('T115: repetir el encuentro con un descuento antiguo recupera el rescate sin conceder otro descuento', async () => {
    const visit = browser();
    await visit().progress.findDiscount('dto-naufrago');
    const back = visit();
    const out = await discountFound(back.progress, 'dto-naufrago', ctx('vuelta'));
    expect(out.map((o) => o.notice.id)).toEqual(['logro:naufrago-fiesta']);
    expect(await discountFound(back.progress, 'dto-naufrago', ctx('otra'))).toEqual([]);
    expect(await back.progress.ledger()).toEqual([]);
  });
});

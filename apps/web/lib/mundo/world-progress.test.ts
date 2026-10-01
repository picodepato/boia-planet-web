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
      expect(out).toHaveLength(1);
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
    const repo = browser()();
    const all = await Promise.all(
      hidden.map((h) => repo.progress.findDiscount(h.ref, { worldId: world.id })),
    );
    const expired = all.filter((f) => f.status === 'expired');
    expect(expired.length).toBeGreaterThan(0);
    const fresh = browser()();
    const out = await discountFound(fresh.progress, expired[0]!.discount.id, ctx('a'));
    expect(out[0]!.kind === 'discount' && out[0]!.found.status).toBe('expired');
    expect(out[0]!.notice.title).toMatch(/caducado/i);
  });

  it('un descuento que ya no existe no hace nada', async () => {
    const repo = browser()();
    expect(await discountFound(repo.progress, 'no-existe', ctx('a'))).toEqual([]);
  });
});

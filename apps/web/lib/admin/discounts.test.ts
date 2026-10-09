import { discountStatus } from '@boia/contracts';
import { WorldRuntime, simulate } from '@boia/engine';
import { IDLE_INPUT } from '@boia/engine/headless';
import { MemoryStorage, SAMPLE_EVENTS, createLocalRepository } from '@boia/store';
import { WORLD_REGISTRY, type WorldObject } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { applicableDiscount, samplePriceCents } from '../ticketing/pricing';
import { AdminError, createAdminActions } from './actions';
import { EMPTY_WORLD_CONTENT, composeLiveWorld, discountHidingPlaces } from './world';

/**
 * Descuentos en el Admin de la demo (T43, REQ-COM-020): un código creado en
 * el Admin se esconde en un lugar del mapa, se encuentra navegando, vale en
 * la compra de su evento y queda en la auditoría; caducarlo lo deja
 * caducado para quien ya lo tenía.
 */

const NOW = '2026-09-29T10:00:00Z';
const registry = WORLD_REGISTRY;
const onSale = SAMPLE_EVENTS.find((e) => e.state === 'on_sale' && e.islandId)!;
/** Un escondite del mapa que no nombra ya ningún código. */
const hideout = discountHidingPlaces(registry.map).find(
  (p) => !p.behaviors.some((b) => b.type === 'reward' && b.params.kind === 'discount'),
)!;
/** Un escondite que ya da un código del mapa. */
const mapHideout = discountHidingPlaces(registry.map).find((p) =>
  p.behaviors.some((b) => b.type === 'reward' && b.params.kind === 'discount'),
)!;

function setup() {
  const repo = createLocalRepository({
    storage: new MemoryStorage(),
    now: () => new Date(NOW),
    watch: false,
  });
  const actions = createAdminActions({ repo, registry, now: () => new Date(NOW) });
  return { repo, actions };
}

/** Los códigos de descuento que da un lugar en el mundo compuesto. */
function discountRefs(o: WorldObject | undefined): string[] {
  return (o?.behaviors ?? []).flatMap((b) =>
    b.type === 'reward' && b.params.kind === 'discount' && b.params.ref ? [b.params.ref] : [],
  );
}

async function liveObject(repo: ReturnType<typeof setup>['repo'], placeId: string) {
  const world = composeLiveWorld(registry, registry.defaultId, {
    ...EMPTY_WORLD_CONTENT,
    places: await repo.content.places(),
    events: await repo.content.events(),
    discounts: await repo.content.list('discounts'),
  });
  return world.config.objects.find((o) => o.identity.id === placeId);
}

describe('descuentos creados en el Admin (T43)', () => {
  it('la muestra tiene lo que estas pruebas necesitan', () => {
    expect(onSale).toBeDefined();
    expect(hideout).toBeDefined();
    expect(mapHideout).toBeDefined();
  });

  it('un código creado en el Admin se encuentra navegando, se aplica y queda auditado', async () => {
    const { repo, actions } = setup();
    const saved = await actions.saveDiscount({
      code: 'admin20',
      label: '-20 % creado en el Admin',
      scope: 'event',
      eventId: onSale.id,
      kind: 'percent',
      value: 20,
      priority: 5,
      hiddenAt: hideout.id,
    });
    expect(saved).toMatchObject({ code: 'ADMIN20', sample: false, hiddenAt: hideout.id });

    // Auditado: autor, área, antes (nada) y después.
    const [entry] = await repo.admin.audit({ area: 'discounts' });
    expect(entry).toMatchObject({
      area: 'discounts',
      action: 'upsert',
      targetId: saved.id,
      actor: 'admin-demo',
      before: null,
    });
    expect(await repo.admin.overridden('discounts')).toContain(saved.id);

    // Escondido: el lugar del mapa lo da en el mundo que se juega.
    expect(discountRefs(await liveObject(repo, hideout.id))).toContain(saved.id);

    // Encontrado: se guarda una vez y vale en la compra de su evento.
    const found = await repo.progress.findDiscount(saved.id);
    expect(found).toMatchObject({ first: true, status: 'active', usedAt: null });
    const price = samplePriceCents(onSale);
    expect(applicableDiscount(onSale.id, [found], price, new Date(NOW))?.id).toBe(saved.id);
  });

  it('REQ-AVE-021: un resto configurado entrega un código de tienda', async () => {
    const { repo, actions } = setup();
    const restos = discountHidingPlaces(registry.map).find((p) => p.category === 'restos')!;
    expect(restos).toBeDefined();
    const saved = await actions.saveDiscount({
      code: 'tienda5',
      label: '-5 € en la tienda',
      scope: 'store',
      kind: 'amount',
      value: 5,
      hiddenAt: restos.id,
    });
    const live = await liveObject(repo, restos.id);
    expect(discountRefs(live)).toEqual([saved.id]);
    // Pasar por encima del resto suelta el código (el mismo runtime que /mar).
    const world = composeLiveWorld(registry, registry.defaultId, {
      ...EMPTY_WORLD_CONTENT,
      places: await repo.content.places(),
      events: await repo.content.events(),
      discounts: await repo.content.list('discounts'),
    });
    const rt = new WorldRuntime(world.config, { seed: 3, sessionId: 's1' });
    const at = rt.objectState(restos.id)!;
    const run = simulate(world.config, {
      runtime: rt,
      seconds: 1,
      start: { x: at.x, y: at.y },
      input: () => IDLE_INPUT,
    });
    const drop = run.events.find(
      (e) => e.type === 'reward' && e.objectId === restos.id && e.kind === 'discount',
    );
    expect(drop && drop.type === 'reward' ? drop.ref : null).toBe(saved.id);
    const found = await repo.progress.findDiscount(saved.id);
    expect(found).toMatchObject({ first: true, status: 'active' });
    expect(found.discount).toMatchObject({ code: 'TIENDA5', scope: 'store' });
  });

  it('esconderlo donde el mapa ya tenía otro código lo sustituye', async () => {
    const { repo, actions } = setup();
    const before = discountRefs(await liveObject(repo, mapHideout.id));
    expect(before.length).toBe(1);
    const saved = await actions.saveDiscount({
      code: 'OTRO-CODIGO',
      label: 'Otro',
      scope: 'store',
      kind: 'amount',
      value: 300,
      hiddenAt: mapHideout.id,
    });
    expect(discountRefs(await liveObject(repo, mapHideout.id))).toEqual([saved.id]);
  });

  it('caducarlo lo deja caducado para quien ya lo tenía y deja de aplicarse', async () => {
    const { repo, actions } = setup();
    const saved = await actions.saveDiscount({
      code: 'CADUCA',
      label: 'Caduca',
      eventId: onSale.id,
      kind: 'percent',
      value: 10,
    });
    await repo.progress.findDiscount(saved.id);
    const expired = await actions.expireDiscount(saved.id);
    expect(discountStatus(expired, new Date(NOW))).toBe('expired');
    const [mine] = await repo.progress.discounts();
    expect(mine?.status).toBe('expired');
    expect(applicableDiscount(onSale.id, [mine!], 2000, new Date(NOW))).toBeNull();
    const actions2 = (await repo.admin.audit({ area: 'discounts' })).map((e) => e.reason);
    expect(actions2).toContain('caducar');
  });

  it('rechaza con su motivo lo que no vale y no guarda nada', async () => {
    const { repo, actions } = setup();
    const base = { label: 'x', kind: 'percent' as const, value: 10 };
    const bad = [
      { ...base, code: 'a' },
      { ...base, code: 'NAUFRAGO10' },
      { ...base, code: 'NUEVO', eventId: 'no-existe' },
      { ...base, code: 'NUEVO', hiddenAt: 'no-es-escondite' },
      { ...base, code: 'NUEVO', value: 150 },
      {
        ...base,
        code: 'NUEVO',
        startsAt: '2027-01-02T00:00:00+01:00',
        endsAt: '2027-01-01T00:00:00+01:00',
      },
    ];
    for (const input of bad) {
      await expect(actions.saveDiscount(input)).rejects.toBeInstanceOf(AdminError);
    }
    expect(await repo.admin.audit({ area: 'discounts' })).toEqual([]);
  });
});

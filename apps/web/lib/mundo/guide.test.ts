import { missionDestination, rescueMissionOf } from '@boia/engine/mission';
import {
  MemoryStorage,
  SAMPLE_ACHIEVEMENTS,
  SAMPLE_COSMETICS,
  SAMPLE_DISCOUNTS,
  createLocalRepository,
} from '@boia/store';
import { WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import {
  type GuideState,
  discountMarks,
  discountRefOf,
  guideSpots,
  helpNow,
  pendingGuideMark,
  missionDiscountOf,
  nearestSpot,
} from './guide';
import { deliveryDiscount, missedDeliveryDiscount } from './mission';

/**
 * La Boia Fiestera como misión central y los tres descuentos del mundo
 * (T59): todo sale del mapa y de la muestra. La entrega da un código de
 * entradas y el barco exclusivo; los «?» son los códigos pendientes; el
 * delfín guía a la Fiestera, a los códigos y a los minijuegos, y el «?» de
 * ayuda (T68) da el objetivo y una pista; los secretos sin código siguen escondidos y premian.
 */

const world = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId);
const objects = world.config.objects;
const spec = rescueMissionOf(world.config)!;
const none = { has: () => false };
const fresh: GuideState = {
  phase: 'waiting',
  destination: null,
  found: none,
  foundDiscounts: none,
};
const byId = (id: string) => objects.find((o) => o.identity.id === id)!;
const missionDiscount = missionDiscountOf(objects, spec.destination)!;
/** Los lugares que esconden un código en el mapa. */
const hiding = objects.filter((o) => discountRefOf(o) !== null);

function browser() {
  const storage = new MemoryStorage();
  return () =>
    createLocalRepository({
      storage,
      now: () => new Date('2026-10-02T12:00:00Z'),
      watch: false,
    });
}

describe('tres descuentos en el mundo (T59)', () => {
  it('la muestra tiene exactamente tres: el náufrago, el ánfora y el de la Fiestera', () => {
    const inWorld = new Set([...hiding.map((o) => discountRefOf(o)!), missionDiscount]);
    expect(SAMPLE_DISCOUNTS).toHaveLength(3);
    expect(new Set(SAMPLE_DISCOUNTS.map((d) => d.id))).toEqual(inWorld);
    // Ni un código caducado en los restos ni uno de tienda escondido en el mundo.
    expect(SAMPLE_DISCOUNTS.filter((d) => d.scope === 'store' || d.hiddenAt)).toEqual([]);
    expect(objects.filter((o) => o.identity.category === 'restos' && discountRefOf(o))).toEqual([]);
    const castaway = objects.find((o) => o.identity.category === 'naufrago')!;
    expect(hiding.map((o) => o.identity.id).sort()).toEqual(
      [castaway.identity.id, 'secreto-anfora'].sort(),
    );
    // Todos son `muestra` (P16).
    expect(SAMPLE_DISCOUNTS.every((d) => d.sample)).toBe(true);
  });

  it('el de la Fiestera vale para cualquier entrada y gana a los demás', () => {
    const d = SAMPLE_DISCOUNTS.find((x) => x.id === missionDiscount)!;
    expect(d.eventId).toBeUndefined();
    expect(d.scope ?? 'event').toBe('event');
    const others = SAMPLE_DISCOUNTS.filter((x) => x.id !== d.id);
    expect(others.every((x) => (x.priority ?? 0) < (d.priority ?? 0))).toBe(true);
  });

  it('cada uno es un «?» del minimapa hasta que se encuentra', () => {
    const marks = discountMarks(guideSpots(objects, fresh));
    expect(marks.map((m) => m.discountId).sort()).toEqual(SAMPLE_DISCOUNTS.map((d) => d.id).sort());
    // El de la Fiestera, en ella mientras espera…
    expect(marks.find((m) => m.discountId === missionDiscount)!.placeId).toBe(spec.characterId);
    // …y en su destino mientras va a bordo.
    const aboard = discountMarks(
      guideSpots(objects, { ...fresh, phase: 'aboard', destination: spec.destination }),
    );
    expect(aboard.find((m) => m.discountId === missionDiscount)!.placeId).toBe(spec.destination);
    // Encontrado, su «?» se va; entregada, la misión ya no se señala.
    const found = new Set([SAMPLE_DISCOUNTS[0]!.id]);
    expect(discountMarks(guideSpots(objects, { ...fresh, foundDiscounts: found }))).toHaveLength(2);
    const done = guideSpots(objects, {
      ...fresh,
      phase: 'delivered',
      foundDiscounts: new Set([missionDiscount]),
    });
    expect(done.some((s) => s.kind === 'mission')).toBe(false);
  });

  it('los secretos sin código no se señalan y siguen ocultos, con su premio', () => {
    const spots = guideSpots(objects, fresh);
    const secrets = objects.filter(
      (o) => o.identity.category === 'secreto' && discountRefOf(o) === null,
    );
    expect(secrets.map((o) => o.identity.id).sort()).toEqual(
      ['secreto-campana', 'secreto-circulo', 'secreto-cueva'].sort(),
    );
    for (const o of secrets) {
      expect(
        spots.some((s) => s.objectId === o.identity.id),
        o.identity.id,
      ).toBe(false);
      expect(o.identity.tags, o.identity.id).toContain('oculto');
      const prize = o.behaviors.some(
        (b) =>
          (b.type === 'reward' && (b.params.kind === 'coins' || b.params.kind === 'points')) ||
          b.type === 'achievement',
      );
      expect(prize, o.identity.id).toBe(true);
    }
  });
});

describe('el delfín y las boies guían (T59)', () => {
  const kinds = (spots: { kind: string }[]) => [...new Set(spots.map((s) => s.kind))].sort();

  it('lo que se señala: la Fiestera, los códigos y los minijuegos', () => {
    const spots = guideSpots(objects, fresh);
    expect(kinds(spots)).toEqual(['discount', 'minigame', 'mission']);
    const minigames = objects.filter((o) => o.behaviors.some((b) => b.type === 'start_minigame'));
    expect(spots.filter((s) => s.kind === 'minigame').map((s) => s.objectId)).toEqual(
      minigames.map((o) => o.identity.id),
    );
    // Un minijuego ya visitado deja de señalarse.
    const visited = new Set([minigames[0]!.identity.id]);
    expect(
      guideSpots(objects, { ...fresh, found: visited }).some(
        (s) => s.objectId === minigames[0]!.identity.id,
      ),
    ).toBe(false);
  });

  it('el delfín lleva a lo pendiente más cercano, no a lo que ya está al alcance', () => {
    const spots = guideSpots(objects, fresh);
    const at = byId(spec.characterId).position;
    expect(nearestSpot(spots, at)!.objectId).toBe(spec.characterId);
    expect(nearestSpot(spots, at, 400)!.objectId).not.toBe(spec.characterId);
  });

  it('el «?» de ayuda (T68): el objetivo por paso de la misión y una pista con rumbo', () => {
    const spots = guideSpots(objects, fresh);
    const port = { x: 0, y: 0 };
    // Esperando: encontrarla; su rumbo, a ella. La pista: lo pendiente más cercano que no es ella.
    const waiting = helpNow(spots, 'waiting', port);
    expect(waiting.objective).toBe('find');
    expect(waiting.objectiveSpot?.placeId).toBe(spec.characterId);
    expect(waiting.hint).toEqual(
      nearestSpot(
        spots.filter((s) => s.kind !== 'mission'),
        port,
      ),
    );
    expect(waiting.hint?.kind).not.toBe('mission');
    // A bordo: llevarla; el rumbo, a su destino.
    const aboard = helpNow(guideSpots(objects, { ...fresh, phase: 'aboard' }), 'aboard', port);
    expect(aboard.objective).toBe('deliver');
    expect(aboard.objectiveSpot?.placeId).toBe(spec.destination);
    // Entregada: cumplido, sin rumbo; la pista sigue mientras quede algo.
    const done = helpNow(guideSpots(objects, { ...fresh, phase: 'delivered' }), 'delivered', port);
    expect(done.objective).toBe('done');
    expect(done.objectiveSpot).toBeNull();
    expect(done.hint).not.toBeNull();
    // Sin nada pendiente, sin pista.
    expect(helpNow([], 'delivered', port).hint).toBeNull();
  });
});

describe('el premio de la misión central (T59)', () => {
  const delivered = {
    type: 'delivered' as const,
    missionId: spec.missionId,
    character: spec.character,
    destination: spec.destination,
    reward: missionDestination(world.config, spec.destination)!.reward,
  };
  const ctx = { sessionId: 's1', worldId: world.id };

  it('entregarla da su código de entradas, una sola vez', async () => {
    const open = browser();
    const repo = open();
    const out = await deliveryDiscount(repo.progress, delivered, ctx);
    expect(out).toHaveLength(1);
    expect(out[0]!.kind === 'discount' && out[0]!.found.discount.id).toBe(missionDiscount);
    expect(out[0]!.kind === 'discount' && out[0]!.found.status).toBe('active');
    expect(await deliveryDiscount(open().progress, delivered, ctx)).toEqual([]);
    expect((await open().progress.discounts()).map((f) => f.discount.id)).toEqual([
      missionDiscount,
    ]);
  });

  it('quien la entregó antes de que diera código lo recibe al volver, y sólo entonces', async () => {
    const open = browser();
    const repo = open();
    expect(
      await missedDeliveryDiscount(repo.progress, spec.missionId, missionDiscount, ctx),
    ).toEqual([]);
    await repo.progress.setMission(spec.missionId, {
      step: 'delivered',
      data: { destination: spec.destination },
      completed: true,
    });
    const out = await missedDeliveryDiscount(open().progress, spec.missionId, missionDiscount, ctx);
    expect(out.map((o) => o.kind)).toEqual(['discount']);
    expect(
      await missedDeliveryDiscount(open().progress, spec.missionId, missionDiscount, ctx),
    ).toEqual([]);
  });

  it('el barco exclusivo es de quien completa la misión, sin logro ni precio', async () => {
    const ship = SAMPLE_COSMETICS.find((c) => c.slot === 'ship' && c.unlockMission)!;
    expect(ship.unlockMission).toBe(spec.missionId);
    expect(ship.priceCoins).toBeNull();
    expect(SAMPLE_ACHIEVEMENTS.some((a) => a.cosmeticKey === ship.id)).toBe(false);
    const open = browser();
    const repo = open();
    const item = async () => (await open().progress.shop()).find((i) => i.cosmetic.id === ship.id)!;
    expect(await item()).toMatchObject({
      owned: false,
      canBuy: false,
      unlock: { kind: 'mission', missionId: spec.missionId },
    });
    await expect(repo.progress.equip('ship', ship.id)).rejects.toMatchObject({
      code: 'forbidden',
    });
    await expect(repo.progress.buyCosmetic(ship.id)).rejects.toMatchObject({ code: 'forbidden' });
    // Rescatada pero sin entregar: todavía no.
    await repo.progress.setMission(spec.missionId, {
      step: 'rescued',
      data: { destination: spec.destination },
    });
    expect((await item()).owned).toBe(false);
    await repo.progress.setMission(spec.missionId, {
      step: 'delivered',
      data: { destination: spec.destination },
      completed: true,
    });
    expect((await item()).owned).toBe(true);
    const ships = await open().progress.ships();
    expect(ships.find((s) => s.cosmeticId === ship.id)).toMatchObject({
      owned: true,
      unlockMission: spec.missionId,
    });
    expect(await open().progress.equip('ship', ship.id)).toMatchObject({ ship: ship.id });
  });
});

it('T99: markers clear on completed hints and mission-stage change', () => {
  const spots = guideSpots(objects, fresh);
  const mission = spots.find((spot) => spot.kind === 'mission')!;
  expect(pendingGuideMark(mission, spots)).toEqual(mission);
  expect(pendingGuideMark(mission, guideSpots(objects, { ...fresh, phase: 'aboard' }))).toBeNull();
  expect(
    pendingGuideMark(mission, guideSpots(objects, { ...fresh, phase: 'delivered' })),
  ).toBeNull();
  const hint = spots.find((spot) => spot.kind === 'discount')!;
  expect(
    pendingGuideMark(
      hint,
      guideSpots(objects, {
        ...fresh,
        foundDiscounts: new Set([hint.discountId!]),
      }),
    ),
  ).toBeNull();
  const game = spots.find((spot) => spot.kind === 'minigame')!;
  expect(
    pendingGuideMark(
      game,
      guideSpots(objects, {
        ...fresh,
        found: new Set([game.placeId]),
      }),
    ),
  ).toBeNull();
  expect(pendingGuideMark(null, spots)).toBeNull();
});

import type { WorldEvent } from '@boia/engine';
import { DiscoveryTracker, discoveryTargets } from '@boia/engine/ui';
import { MemoryStorage, createLocalRepository } from '@boia/store';
import {
  type ComposedWorld,
  WORLD_REGISTRY,
  type WorldObject,
  chooseWorld,
  storedWorldChoice,
} from '@boia/world';
import { describe, expect, it } from 'vitest';
import { discoverPlace, discoveredPlaces, persistWorldEvent } from './world-progress';

/**
 * Cambiar de mundo conserva el progreso (T24, REQ-AVE-011): lo hecho en
 * Arcilla (lugares descubiertos, premios de una vez, descuentos) sigue en
 * Acuarela y al volver a Arcilla, con el repositorio local de verdad. Los
 * lugares y premios se leen de los datos del mundo.
 */

const [first, second] = WORLD_REGISTRY.ids().map((id) => WORLD_REGISTRY.get(id)) as [
  ComposedWorld,
  ComposedWorld,
];

type Params = Record<string, unknown>;
const rewardsOf = (o: WorldObject) =>
  o.behaviors.filter((b) => b.type === 'reward').map((b) => b.params as Params);

/** Un lugar con premio de monedas o puntos «una vez», y uno con descuento escondido. */
const coinPlace = first.config.objects.find((o) =>
  rewardsOf(o).some((p) => (p.kind === 'coins' || p.kind === 'points') && p.frequency === 'once'),
)!;
const coinReward = rewardsOf(coinPlace).find((p) => p.frequency === 'once')!;
const discountPlace = first.config.objects.find((o) =>
  rewardsOf(o).some((p) => p.kind === 'discount'),
)!;
const discountRef = rewardsOf(discountPlace).find((p) => p.kind === 'discount')!.ref as string;
const island = discoveryTargets(first.config).find((t) => t.kind === 'island')!;

function reward(objectId: string, p: Params): WorldEvent {
  return {
    type: 'reward',
    objectId,
    kind: p.kind as 'coins',
    amount: (p.amount as number | undefined) ?? 1,
    ...(typeof p.ref === 'string' ? { ref: p.ref } : {}),
    frequency: p.frequency as 'once',
    key: null,
  };
}

describe('cambiar de mundo conserva el progreso (T24)', () => {
  it('hay dos mundos con los mismos lugares', () => {
    expect(first.id).not.toBe(second.id);
    for (const o of [coinPlace, discountPlace]) {
      expect(second.config.objects.some((x) => x.identity.id === o.identity.id)).toBe(true);
    }
  });

  it('lo hecho en Arcilla sigue en Acuarela y al volver a Arcilla', async () => {
    const storage = new MemoryStorage();
    const repo = () => createLocalRepository({ storage, watch: false });
    const saved = new Map<string, string>();
    const choice = storedWorldChoice(
      { getItem: (k) => saved.get(k) ?? null, setItem: (k, v) => void saved.set(k, v) },
      'boia:mundo',
    );
    const ctx = (w: ComposedWorld) => ({ sessionId: 'visita-1', worldId: w.id });

    // En Arcilla: descubre una isla, cobra un premio y encuentra un descuento.
    const inFirst = repo();
    expect(await discoverPlace(inFirst.progress, island.id, ctx(first))).toBe(true);
    const got = await persistWorldEvent(
      inFirst.progress,
      reward(coinPlace.identity.id, coinReward),
      ctx(first),
    );
    expect(got).toHaveLength(1);
    const found = await persistWorldEvent(
      inFirst.progress,
      reward(discountPlace.identity.id, { kind: 'discount', ref: discountRef, frequency: 'once' }),
      ctx(first),
    );
    expect(found[0]?.kind).toBe('discount');
    const before = await inFirst.progress.balances();

    // Cambia a Acuarela (y recarga): nada se pierde ni se vuelve a dar.
    expect(chooseWorld(WORLD_REGISTRY, choice, second.id)?.id).toBe(second.id);
    expect(choice.get()).toBe(second.id);
    const inSecond = repo();
    expect(await discoveredPlaces(inSecond.progress)).toContain(island.id);
    const tracker = new DiscoveryTracker(
      discoveryTargets(second.config),
      await discoveredPlaces(inSecond.progress),
    );
    expect(tracker.isDiscovered(island.id)).toBe(true);
    expect(await discoverPlace(inSecond.progress, island.id, ctx(second))).toBe(false);
    expect(
      await persistWorldEvent(
        inSecond.progress,
        reward(coinPlace.identity.id, coinReward),
        ctx(second),
      ),
    ).toEqual([]);
    expect(
      await persistWorldEvent(
        inSecond.progress,
        reward(discountPlace.identity.id, {
          kind: 'discount',
          ref: discountRef,
          frequency: 'once',
        }),
        ctx(second),
      ),
    ).toEqual([]);
    expect(await inSecond.progress.balances()).toEqual(before);
    expect((await inSecond.progress.discounts()).map((d) => d.discount.id)).toEqual([discountRef]);

    // Y de vuelta a Arcilla, igual.
    expect(chooseWorld(WORLD_REGISTRY, choice, first.id)?.id).toBe(first.id);
    const back = repo();
    expect(await discoveredPlaces(back.progress)).toContain(island.id);
    expect(await back.progress.balances()).toEqual(before);
    expect((await back.progress.discounts()).map((d) => d.discount.id)).toEqual([discountRef]);
    expect(
      await persistWorldEvent(back.progress, reward(coinPlace.identity.id, coinReward), ctx(first)),
    ).toEqual([]);
  });
});

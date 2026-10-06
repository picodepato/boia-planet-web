import type { WorldEvent } from '@boia/engine';
import {
  LocalSessionAuthority,
  WorldMinigameSession,
  canon,
  canonEnd,
} from '@boia/engine/minigames';
import { SURVIVORS_CONFIG } from '@boia/engine/survivors';
import { type BoiaRepository, MemoryStorage, createLocalRepository } from '@boia/store';
import { WORLD_REGISTRY, type WorldObject } from '@boia/world';
import { describe, expect, it } from 'vitest';
import {
  TIME_PLAYED_TICK_S,
  grantCarnetReward,
  recordSignal,
  signalFromWorldEvent,
  worldBuoys,
} from './achievements';
import { type ProgressContext, persistWorldEvent } from './world-progress';

/**
 * La economía de la decisión 2026-10-02 (T72): con unos 10 minutos de juego
 * normal se desbloquean al menos 3 barcos y alguna skin. Una visita de
 * guion, con el repositorio local de verdad, los premios del mapa compartido
 * (`@boia/world`), un minijuego jugado entero y el catálogo de logros de
 * muestra: nada de cifras escritas aquí, todo sale de lo que el juego da.
 *
 * La ruta, prudente: 6 de los 8 restos flotantes, un Cofre fugaz, 4 islas
 * (Cala, Isla del Sonido, Ibiza y la del Cañón, donde se juega una partida
 * hasta el amanecer; desde el plan 014 ya no hay minijuego en el faro), 3
 * boies, el Carnet BOIA y 10 minutos a bordo. Sin secretos, sin delfín, sin
 * circuito ni misión de la Fiestera. Al final se reclama lo completado y se
 * compra en la tienda lo que llegue, como haría quien juega.
 */

const world = WORLD_REGISTRY.get(WORLD_REGISTRY.defaultId).config;
const byCategory = (category: string) =>
  world.objects.filter((o) => o.identity.active && o.identity.category === category);
const object = (id: string) => world.objects.find((o) => o.identity.id === id)!;

/** Los eventos de premio que da un lugar al tocarlo o recogerlo (monedas y puntos). */
function rewardsOf(o: WorldObject): WorldEvent[] {
  return o.behaviors.flatMap((b): WorldEvent[] =>
    b.type === 'reward' && (b.params.kind === 'coins' || b.params.kind === 'points')
      ? [
          {
            type: 'reward',
            objectId: o.identity.id,
            kind: b.params.kind,
            amount: b.params.amount ?? 0,
            frequency: b.params.frequency ?? 'once',
            key: null,
          },
        ]
      : [],
  );
}

async function reach(repo: BoiaRepository, o: WorldObject, ctx: ProgressContext) {
  for (const e of rewardsOf(o)) await persistWorldEvent(repo.progress, e, ctx);
  for (const b of o.behaviors) {
    if (b.type !== 'achievement') continue;
    const s = signalFromWorldEvent(
      { type: 'achievement', objectId: o.identity.id, trigger: b.params.trigger, amount: 1 },
      world,
    );
    if (s) await recordSignal(repo, s);
  }
}

describe('10 minutos de juego (decisión 2026-10-02)', () => {
  it('una visita normal da para 3 barcos y una skin', async () => {
    const storage = new MemoryStorage();
    let t = new Date('2026-10-02T18:00:00Z').getTime();
    const repo = createLocalRepository({ storage, now: () => new Date(t), watch: false });
    const ctx: ProgressContext = { sessionId: 'visita-1', worldId: world.id };

    // Restos flotantes y un Cofre fugaz.
    const restos = byCategory('restos');
    expect(restos.length).toBeGreaterThanOrEqual(6);
    for (const o of restos.slice(0, 6)) await reach(repo, o, ctx);
    await reach(repo, byCategory('cofre')[0]!, ctx);

    // Cuatro islas, la del Cañón entre ellas.
    for (const id of ['cala', 'allday', 'tienda', 'canon']) await reach(repo, object(id), ctx);

    // Tres boies.
    for (const id of worldBuoys(world).slice(0, 3)) {
      await recordSignal(repo, { trigger: 'find_buoy', objectId: id });
    }

    // Una partida del Cañón hasta el amanecer, con su premio (el bronce) y sus logros.
    const authority = new LocalSessionAuthority(() => t);
    const session = new WorldMinigameSession({ def: canon, authority, sink: repo.progress });
    t += SURVIVORS_CONFIG.durationS * 1000;
    const played = await session.finish(canonEnd('survived', SURVIVORS_CONFIG.durationS));
    expect(played.reward.granted).toBe(true);
    await recordSignal(repo, { trigger: 'play_minigame', game: 'canon' });
    await recordSignal(repo, { trigger: 'win_minigame', game: 'canon' });

    // El Carnet BOIA: su premio llega al crearlo.
    await repo.carnet.create({ nickname: 'Diez minutos' });
    await grantCarnetReward(repo);

    // Diez minutos a bordo, apuntados como en el juego.
    for (let s = 0; s < 600; s += TIME_PLAYED_TICK_S) {
      await recordSignal(repo, { trigger: 'time_played', seconds: TIME_PLAYED_TICK_S });
    }

    // Se reclama todo lo completado.
    for (const a of await repo.progress.achievements()) {
      if (a.state === 'ready') await repo.progress.claimAchievement(a.definition.id);
    }

    // A la tienda: barcos a la venta del más barato al más caro, luego una skin.
    const shop = () => repo.progress.shop();
    for (const item of (await shop())
      .filter((i) => i.cosmetic.slot === 'ship' && i.unlock.kind === 'coins' && !i.owned)
      .sort((a, b) => a.cosmetic.priceCoins! - b.cosmetic.priceCoins!)) {
      const now = (await shop()).find((i) => i.cosmetic.id === item.cosmetic.id)!;
      if (now.canBuy) await repo.progress.buyCosmetic(item.cosmetic.id);
    }
    const skin = (await shop())
      .filter((i) => i.cosmetic.slot === 'skin' && i.canBuy)
      .sort((a, b) => a.cosmetic.priceCoins! - b.cosmetic.priceCoins!)[0];
    expect(skin, 'una skin a tiro').toBeDefined();
    await repo.progress.buyCosmetic(skin!.cosmetic.id);

    const items = await shop();
    const ships = items.filter((i) => i.cosmetic.slot === 'ship' && i.owned && !i.cosmetic.base);
    const balances = JSON.stringify(await repo.progress.balances());
    expect(
      ships.length,
      `barcos: ${ships.map((i) => i.cosmetic.id)} · ${balances}`,
    ).toBeGreaterThanOrEqual(3);
    expect(
      items.filter((i) => i.cosmetic.slot === 'skin' && i.owned).length,
    ).toBeGreaterThanOrEqual(1);
    // Tres caminos: el regalo del Carnet, el umbral de puntos y la compra con monedas.
    expect(new Set(ships.map((i) => i.unlock.kind))).toEqual(
      new Set(['achievement', 'points', 'coins']),
    );
    // Y el tiempo de juego que hizo falta cabe en la visita (la partida, dentro).
    expect(t - new Date('2026-10-02T18:00:00Z').getTime()).toBeLessThan(10 * 60 * 1000);
  });
});

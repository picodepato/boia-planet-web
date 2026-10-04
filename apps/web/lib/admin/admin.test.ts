import { type BoiaEvent, canBuy } from '@boia/contracts';
import {
  CONTENT_AREAS,
  DEFAULT_SAMPLE_INPUT,
  MemoryStorage,
  SAMPLE_BOTTLES,
  SAMPLE_EVENTS,
  createLocalRepository,
} from '@boia/store';
import { WORLD_REGISTRY, type WorldObject } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { SAMPLE_CONTENT } from '../landing/sample-content';
import { AdminError, createAdminActions } from './actions';
import { worldProblem } from './validate';
import {
  EMPTY_WORLD_CONTENT,
  MAP_POINTS,
  composeLiveWorld,
  eventIslands,
  islandEvent,
  islandMemories,
} from './world';

/**
 * El Admin de la demo (T26) sobre el repositorio local de verdad: un cambio
 * del mundo que no se puede jugar se rechaza con su motivo y no toca nada,
 * volver a la muestra la deja como estaba y cada cambio queda en la
 * auditoría. Las posiciones salen del mapa compartido, nunca escritas a mano.
 */

const NOW = '2026-09-29T10:00:00Z';
const registry = WORLD_REGISTRY;
const map = registry.map;
const placeOf = (id: string) => {
  const p = map.places.find((x) => x.id === id);
  if (!p) throw new Error(`falta el lugar ${id}`);
  return p;
};
/** Una isla del mapa que admite eventos y otra isla sólida cualquiera. */
const eventIsland = eventIslands(map).find((p) =>
  p.behaviors.some((b) => b.type === 'content' && b.params.target === 'event'),
)!;
const solidIsland = map.places.find(
  (p) => p.category === 'isla' && p.id !== eventIsland.id && p.geometry.collision,
)!;
/** Un recogible pequeño del mapa (lo tapa una isla encima). */
const collectible = map.places.find(
  (p) =>
    p.behaviors.some((b) => b.type === 'collectible') &&
    !p.behaviors.some((b) => b.type === 'spawn'),
)!;

function setup() {
  const storage = new MemoryStorage();
  const repo = createLocalRepository({ storage, now: () => new Date(NOW), watch: false });
  const actions = createAdminActions({ repo, registry, now: () => new Date(NOW) });
  return { repo, actions };
}

const objectIn = (worldId: string, content: Parameters<typeof composeLiveWorld>[2], id: string) =>
  composeLiveWorld(registry, worldId, content).config.objects.find((o) => o.identity.id === id) as
    WorldObject | undefined;

const behaviorParams = (o: WorldObject | undefined, type: string) =>
  o?.behaviors.filter((b) => b.type === type).map((b) => b.params as Record<string, unknown>) ?? [];

describe('validación del mundo (reglas de T09)', () => {
  it('el mapa de muestra se puede jugar tal cual', () => {
    expect(worldProblem(registry, EMPTY_WORLD_CONTENT)).toBeNull();
  });

  it('un cambio inválido se rechaza con su motivo y no guarda nada', async () => {
    const { repo, actions } = setup();
    const cases: [string, Promise<unknown>, RegExp][] = [
      [
        'isla sobre la salida',
        actions.editPlace(solidIsland.id, { x: map.spawn.x, y: map.spawn.y }),
        /Salida del barco.*tierra/,
      ],
      [
        'isla encima de un recogible',
        actions.editPlace(solidIsland.id, collectible.position),
        new RegExp(`cortaría el paso.*${collectible.name}`),
      ],
      [
        'fuera del mapa',
        actions.editPlace(solidIsland.id, { x: map.bounds.right + 100 }),
        /fuera del mapa/,
      ],
      ['un id que no existe', actions.editPlace('no-existe', { x: 0 }), /no existe el lugar/],
      [
        'salida en tierra',
        actions.setMapPoint('spawn', solidIsland.position),
        /Salida del barco.*tierra/,
      ],
      [
        'isla de evento que no existe',
        actions.saveEvent({
          ...SAMPLE_EVENTS[1]!,
          id: undefined,
          name: 'X',
          islandId: 'nada',
        } as never),
        /no admite eventos/,
      ],
    ];
    for (const [what, p, reason] of cases) {
      const err = await p.then(
        () => null,
        (e: unknown) => e,
      );
      expect(err, what).toBeInstanceOf(AdminError);
      expect((err as Error).message, what).toMatch(reason);
    }
    expect(await repo.content.places()).toEqual({});
    expect(await repo.admin.audit()).toEqual([]);
  });

  it('un cambio válido se guarda, vale en todos los mundos y queda en la auditoría', async () => {
    const { repo, actions } = setup();
    const to = { x: eventIsland.position.x + 600, y: eventIsland.position.y };
    await actions.editPlace(eventIsland.id, to);
    const places = await repo.content.places();
    for (const w of registry.ids()) {
      const o = objectIn(w, { places, skins: {}, events: null }, eventIsland.id);
      expect(o?.position, w).toMatchObject(to);
    }
    const [last] = await repo.admin.audit();
    expect(last).toMatchObject({ area: 'places', targetId: eventIsland.id, actor: 'admin-demo' });
  });
});

describe('eventos e islas', () => {
  const sampleIslandEvent = SAMPLE_EVENTS.find((e) => e.islandId === eventIsland.id)!;

  it('la isla abre su evento vigente; sin evento, su panel de isla y sus recuerdos', () => {
    const now = new Date(NOW);
    const events = SAMPLE_CONTENT.events;
    expect(islandEvent(eventIsland.id, events, now)?.id).toBe(sampleIslandEvent.id);
    const earlier: BoiaEvent = {
      ...events.find((e) => e.id === sampleIslandEvent.id)!,
      id: 'ev-nuevo',
      startsAt: new Date(now.getTime() + 86_400_000).toISOString(),
    };
    const o = objectIn(
      registry.defaultId,
      { places: {}, skins: {}, events: [...events, earlier], now },
      eventIsland.id,
    );
    expect(behaviorParams(o, 'content')[0]).toMatchObject({ target: 'event', ref: 'ev-nuevo' });
    expect(behaviorParams(o, 'ticket')[0]).toMatchObject({ eventId: 'ev-nuevo' });

    // Todos sus eventos terminados: la isla sigue, sin vender, con sus recuerdos.
    const finished = [...events, earlier].map((e) =>
      e.islandId === eventIsland.id ? { ...e, state: 'finished' as const } : e,
    );
    const lone = objectIn(
      registry.defaultId,
      { places: {}, skins: {}, events: finished, now },
      eventIsland.id,
    );
    expect(lone).toBeDefined();
    expect(behaviorParams(lone, 'content')[0]).toMatchObject({ target: 'info' });
    expect(behaviorParams(lone, 'ticket')).toEqual([]);
    expect(islandMemories(eventIsland.id, finished, now).map((e) => e.id)).toContain('ev-nuevo');
  });

  it('crear un evento y ligarlo a una isla', async () => {
    const { repo, actions } = setup();
    const created = await actions.saveEvent({
      ...SAMPLE_EVENTS[1]!,
      id: undefined,
      slug: undefined,
      name: 'Noche de prueba',
      state: 'on_sale',
      artistIds: [],
    } as never);
    expect(created.id).toBe('ev-noche-de-prueba');
    await actions.linkEventToIsland(created.id, eventIsland.id);
    const ev = await repo.content.get('events', created.id);
    expect(ev?.islandId).toBe(eventIsland.id);
    expect(canBuy(ev!)).toBe(true);
    expect((await repo.content.home()).events.map((e) => e.id)).toContain(created.id);
  });
});

describe('volver a la muestra y auditoría', () => {
  it('cada cambio escribe una entrada en la auditoría', async () => {
    const { repo, actions } = setup();
    const blocks = SAMPLE_CONTENT.blocks;
    const steps: [string, () => Promise<unknown>][] = [
      ['events', () => actions.setEventState(SAMPLE_EVENTS[1]!.id, 'sold_out')],
      ['events', () => actions.duplicateEvent(SAMPLE_EVENTS[0]!.id)],
      ['homeBlocks', () => actions.moveBlock(blocks[2]!.id, -1)],
      ['homeBlocks', () => actions.setBlockVisible(blocks[3]!.id, false)],
      ['homeBlocks', () => actions.scheduleBlock(blocks[3]!.id, '2026-10-01T00:00:00+02:00', null)],
      ['homeBlocks', () => actions.setPriorityEvent(SAMPLE_EVENTS[1]!.id)],
      ['places', () => actions.editPlace(eventIsland.id, { enabled: false })],
      ['places', () => actions.setMapPoint('introLanding', { x: map.spawn.x, y: map.spawn.y })],
      [
        'skins',
        () => actions.renamePlace(eventIsland.id, 'Isla nueva', { world: registry.defaultId }),
      ],
      ['skins', () => actions.setPlaceTexts(registry.defaultId, eventIsland.id, { body: 'Hola' })],
      ['skins', () => actions.setHiddenInWorld(registry.defaultId, solidIsland.id, true)],
      ['activeWorld', () => actions.setActiveWorld(registry.playableIds().at(-1)!)],
      ['bottles', () => actions.removeBottle(SAMPLE_BOTTLES[0]!.id, 'prueba de moderación')],
      ['places', () => actions.reset('places')],
    ];
    let before = 0;
    for (const [area, run] of steps) {
      await run();
      const audit = await repo.admin.audit();
      expect(audit.length, area).toBeGreaterThan(before);
      expect(audit[0]?.area, area).toBe(area);
      expect(audit[0]?.actor).toBe('admin-demo');
      before = audit.length;
    }
    // Renombrar en todos los mundos: una entrada por mundo.
    await actions.renamePlace(eventIsland.id, 'Isla común', 'all');
    expect((await repo.admin.audit()).length).toBe(before + registry.ids().length);
  });

  it('volver a la muestra deja home, mundo, temporada y textos como la muestra', async () => {
    const { repo, actions } = setup();
    await actions.saveEvent({
      ...SAMPLE_EVENTS[1]!,
      id: undefined,
      slug: undefined,
      name: 'Otra noche',
      islandId: eventIsland.id,
    } as never);
    await actions.moveBlock(SAMPLE_CONTENT.blocks[3]!.id, -1);
    await actions.editPlace(eventIsland.id, { x: eventIsland.position.x + 600 });
    await actions.setMapPoint('port', { x: map.spawn.x, y: map.spawn.y - 40 });
    await actions.renamePlace(solidIsland.id, 'Otro nombre', 'all');
    await actions.setActiveWorld(registry.playableIds().at(-1)!);
    await repo.admin.setText('hero.explore', 'Zarpa');
    await repo.admin.upsert('artists', { id: 'nuevo', name: 'Nuevo', genres: ['House'] });
    expect(await repo.content.activeWorldId()).toBe(registry.playableIds().at(-1));
    expect(Object.keys(await repo.content.places())).toContain(MAP_POINTS.port);

    await actions.reset('all');
    expect(await repo.content.home()).toEqual(SAMPLE_CONTENT);
    expect(await repo.content.places()).toEqual({});
    expect(await repo.content.skins()).toEqual({});
    expect(await repo.content.texts()).toEqual(DEFAULT_SAMPLE_INPUT.texts);
    expect(await repo.content.activeWorldId()).toBe(DEFAULT_SAMPLE_INPUT.activeWorldId);
    for (const area of CONTENT_AREAS) expect(await repo.admin.overridden(area), area).toEqual([]);
    // El mundo vuelve a ser el del mapa.
    const o = objectIn(
      registry.defaultId,
      {
        places: await repo.content.places(),
        skins: await repo.content.skins(),
        events: (await repo.content.home()).events,
        now: new Date(NOW),
      },
      eventIsland.id,
    );
    expect(o?.position).toMatchObject({ x: eventIsland.position.x, y: eventIsland.position.y });
    expect(o?.identity.name).toBe(
      registry.get(registry.defaultId).places.find((p) => p.id === eventIsland.id)?.name,
    );
  });

  it('renombrar: sólo en este mundo o en todos', async () => {
    const { repo, actions } = setup();
    const [a, b] = registry.ids();
    const nameIn = async (w: string) =>
      objectIn(w, { places: {}, skins: await repo.content.skins(), events: null }, solidIsland.id)
        ?.identity.name;
    await actions.renamePlace(solidIsland.id, 'Sólo aquí', { world: a! });
    expect(await nameIn(a!)).toBe('Sólo aquí');
    if (b) expect(await nameIn(b)).not.toBe('Sólo aquí');
    await actions.renamePlace(solidIsland.id, 'En todos', 'all');
    for (const w of registry.ids()) expect(await nameIn(w)).toBe('En todos');
    expect(placeOf(solidIsland.id).name).not.toBe('En todos');
  });
});

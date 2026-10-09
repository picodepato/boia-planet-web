import { MemoryStorage, SAMPLE_EVENTS, createLocalRepository } from '@boia/store';
import { WORLD_REGISTRY } from '@boia/world';
import { describe, expect, it } from 'vitest';
import { alphabeticalArtists, resolveHome, shownPriorityEvent } from '../landing/resolve';
import { createAdminActions } from './actions';
import { EMPTY_WORLD_CONTENT, composeLiveWorld } from './world';

/**
 * Lo que el Admin de la demo cambia sin desplegar, con el repositorio local de
 * verdad: lo que se lee después (la home, el mar compuesto) ya es lo nuevo.
 */

const NOW = '2026-09-29T10:00:00Z';
const now = new Date(NOW);
const registry = WORLD_REGISTRY;
const onSale = SAMPLE_EVENTS.find((e) => e.state === 'on_sale' && e.islandId)!;
const other = SAMPLE_EVENTS.find((e) => e.state === 'on_sale' && e.id !== onSale.id)!;

function setup() {
  const repo = createLocalRepository({
    storage: new MemoryStorage(),
    now: () => now,
    watch: false,
  });
  const actions = createAdminActions({ repo, registry, now: () => now });
  return { repo, actions };
}

describe('contenido como datos (REQ-ADM-001): prioritario, cartel, URL y salida', () => {
  it('el evento prioritario, su cartel y su URL de entradas cambian en la home al publicar', async () => {
    const { repo, actions } = setup();
    const target = shownPriorityEvent(await repo.content.home(), now)?.id === onSale.id ? other : onSale;
    await actions.setPriorityEvent(target.id);
    await actions.publish('prioritario');
    expect(shownPriorityEvent(await repo.content.home(), now)?.id).toBe(target.id);

    const posterUrl = '/carteles/prueba-admin.webp';
    const ticketUrl = 'https://entradas.example.com/prueba-admin';
    const stored = (await repo.content.events()).find((e) => e.id === target.id)!;
    await actions.saveEvent({ ...stored, posterUrl, ticketUrl }, 'cartel y URL');
    const shown = shownPriorityEvent(await repo.content.home(), now)!;
    expect(shown).toMatchObject({ id: target.id, posterUrl, ticketUrl });
  });

  it('mover la salida en el Admin la mueve en el mar compuesto', async () => {
    const { repo, actions } = setup();
    const spawn = registry.map.spawn;
    const moved = { x: spawn.x + 30, y: spawn.y + 30 };
    await actions.setMapPoint('spawn', moved);
    const world = composeLiveWorld(registry, registry.defaultId, {
      ...EMPTY_WORLD_CONTENT,
      places: await repo.content.places(),
    });
    expect(world.config.spawn).toMatchObject(moved);
  });
});

describe('restaurar sin revertir transacciones (REQ-ADM-016, P2 prueba 8)', () => {
  it('borrar y restaurar un evento no toca compras, sellos, saldos ni logros', async () => {
    const { repo, actions } = setup();
    await repo.carnet.create({ nickname: 'Compradora' });
    await repo.purchases.confirmSandbox({ purchaseId: 'p-adm-016', eventId: onSale.id });
    await repo.progress.grantWorldReward({ sourceRef: 'cofre-adm-016', points: 30, coins: 12 });
    const snapshot = async () => ({
      purchases: await repo.purchases.list(),
      stamps: await repo.progress.stamps(),
      balances: await repo.progress.balances(),
      ledger: await repo.progress.ledger(),
      achievements: (await repo.progress.achievements()).map((a) => [a.definition.id, a.state]),
    });
    const before = await snapshot();
    expect(before.purchases).toHaveLength(1);
    expect(before.stamps.length).toBeGreaterThan(0);

    await actions.trashItem('events', onSale.id, onSale.name);
    expect((await repo.content.events()).some((e) => e.id === onSale.id)).toBe(false);
    await repo.admin.restore('events', onSale.id);
    expect((await repo.content.events()).some((e) => e.id === onSale.id)).toBe(true);

    expect(await snapshot()).toEqual(before);
  });
});

describe('artistas, fotos y textos (REQ-ADM-019)', () => {
  it('editar un artista en el Admin se ve publicado en la lista de la landing', async () => {
    const { repo } = setup();
    const [artist] = await repo.content.list('artists');
    expect(artist).toBeDefined();
    const name = 'Zzz Artista Editada';
    await repo.admin.upsert('artists', { ...artist!, name }, { reason: 'artista' });
    const view = resolveHome(await repo.content.home(), now);
    const names = alphabeticalArtists(view.artists).map((a) => a.name);
    expect(names).toContain(name);
    expect(names).not.toContain(artist!.name);
    expect(names.at(-1)).toBe(name);
  });

  it('editar los textos de la portada en el Admin se ve publicado en la landing', async () => {
    const { repo, actions } = setup();
    await actions.setHeroTexts('Titular del Admin', 'Posicionamiento del Admin');
    const heroOf = async () =>
      resolveHome(await repo.content.home(), now).main.find((b) => b.type === 'hero');
    // En borrador no se ve; al publicar, sí.
    expect(await heroOf()).not.toMatchObject({ title: 'Titular del Admin' });
    await actions.publish('portada');
    expect(await heroOf()).toMatchObject({
      title: 'Titular del Admin',
      positioning: 'Posicionamiento del Admin',
    });
  });
});

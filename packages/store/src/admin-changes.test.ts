import { describe, expect, it } from 'vitest';
import { SAMPLE_ARTISTS, SAMPLE_EVENTS, SAMPLE_HOME_BLOCKS } from './sample';
import { TRASH_RETENTION_DEFAULT_DAYS } from './schema';
import { makeRepo } from './test-helpers';

/**
 * La papelera de cambios (plan 019 T223, decisión 17): lo cambiado desde el
 * Admin, además de lo borrado, se puede deshacer durante el plazo de la
 * papelera.
 */

const DAY = 86_400_000;
const onSale = SAMPLE_EVENTS.find((e) => e.state === 'on_sale')!;
const hero = SAMPLE_HOME_BLOCKS.find((b) => b.type === 'hero')!;
const artist = SAMPLE_ARTISTS[0]!;

describe('papelera de cambios', () => {
  it('editar y borrar un evento: los dos se deshacen', async () => {
    const { repo, reload } = makeRepo();
    await repo.admin.upsert('events', { ...onSale, name: 'Nombre cambiado' } as never);
    const [edit] = await repo.admin.changes();
    expect(edit).toMatchObject({ area: 'events', targetId: onSale.id, kind: 'edit' });
    expect(edit!.before).toMatchObject({ name: onSale.name });

    await repo.admin.revertChange(edit!.id);
    expect((await repo.content.get('events', onSale.id))?.name).toBe(onSale.name);

    await repo.admin.remove('events', onSale.id);
    expect(await repo.content.get('events', onSale.id)).toBeNull();
    await repo.admin.restore('events', onSale.id);
    expect((await reload().content.get('events', onSale.id))?.name).toBe(onSale.name);
  });

  it('deshacer es un cambio más: se puede rehacer', async () => {
    const { repo } = makeRepo();
    await repo.admin.upsert('artists', { ...artist, name: 'Otro nombre' } as never);
    const first = (await repo.admin.changes())[0]!;
    await repo.admin.revertChange(first.id);
    const undo = (await repo.admin.changes())[0]!;
    expect(undo).toMatchObject({ area: 'artists', targetId: artist.id, kind: 'edit' });
    expect(undo.before).toMatchObject({ name: 'Otro nombre' });
    await repo.admin.revertChange(undo.id);
    expect((await repo.content.get('artists', artist.id))?.name).toBe('Otro nombre');
  });

  it('deshacer una creación la lleva a la papelera de borrados', async () => {
    const { repo } = makeRepo();
    const fresh = { ...artist, id: 'artista-nuevo', name: 'Nueva' };
    await repo.admin.upsert('artists', fresh as never);
    const created = (await repo.admin.changes())[0]!;
    expect(created.kind).toBe('create');
    await repo.admin.revertChange(created.id);
    expect(await repo.content.get('artists', 'artista-nuevo')).toBeNull();
    expect((await repo.admin.trash()).map((t) => t.id)).toContain('artista-nuevo');
  });

  it('una publicación se deshace elemento a elemento, también los textos', async () => {
    const { repo } = makeRepo();
    await repo.admin.draftUpsert('homeBlocks', { ...hero, title: 'Titular nuevo' } as never);
    await repo.admin.draftText('hero.explore', 'Zarpa ya');
    await repo.admin.publish();
    const changes = await repo.admin.changes();
    const block = changes.find((c) => c.area === 'homeBlocks' && c.targetId === hero.id)!;
    const text = changes.find((c) => c.area === 'texts' && c.targetId === 'hero.explore')!;
    expect(block.before).toMatchObject({ title: hero.title });
    await repo.admin.revertChange(block.id);
    expect((await repo.content.home()).blocks.find((b) => b.id === hero.id)).toMatchObject({
      title: hero.title,
    });
    expect((await repo.content.texts())['hero.explore']).toBe('Zarpa ya');
    await repo.admin.revertChange(text.id);
    expect((await repo.content.texts())['hero.explore']).toBeUndefined();
  });

  it('lugares, textos, ajustes y «volver a la muestra» también', async () => {
    const { repo } = makeRepo();
    await repo.admin.setPlace('lugar-prueba', { x: 1, y: 2 });
    await repo.admin.setText('hero.title', 'Otro titular');
    await repo.admin.setSettings({ analyticsEnabled: true });
    await repo.admin.reset('texts');
    const changes = await repo.admin.changes();
    expect(changes.map((c) => [c.area, c.kind])).toEqual([
      ['texts', 'reset'],
      ['settings', 'edit'],
      ['texts', 'edit'],
      ['places', 'edit'],
    ]);
    await repo.admin.revertChange(changes[0]!.id);
    expect((await repo.content.texts())['hero.title']).toBe('Otro titular');
    await repo.admin.revertChange(changes[1]!.id);
    expect((await repo.admin.settings()).analyticsEnabled).toBeUndefined();
    await repo.admin.revertChange(changes[3]!.id);
    expect((await repo.content.places())['lugar-prueba']).toBeUndefined();
  });

  it('pasado el plazo de la papelera ya no se deshace', async () => {
    const { repo, clock } = makeRepo();
    await repo.admin.upsert('events', { ...onSale, name: 'Viejo cambio' } as never);
    const [edit] = await repo.admin.changes();
    expect(new Date(edit!.expiresAt).getTime() - new Date(edit!.changedAt).getTime()).toBe(
      TRASH_RETENTION_DEFAULT_DAYS * DAY,
    );
    clock.advance(TRASH_RETENTION_DEFAULT_DAYS * DAY + 1);
    expect(await repo.admin.changes()).toEqual([]);
    await expect(repo.admin.revertChange(edit!.id)).rejects.toMatchObject({ code: 'not_found' });
  });

  it('lo purgado no vuelve deshaciendo un cambio viejo', async () => {
    const { repo } = makeRepo();
    await repo.admin.upsert('artists', { ...artist, name: 'Cambio' } as never);
    const [edit] = await repo.admin.changes();
    await repo.admin.remove('artists', artist.id);
    await repo.admin.purge('artists', artist.id);
    await expect(repo.admin.revertChange(edit!.id)).rejects.toMatchObject({ code: 'forbidden' });
  });
});

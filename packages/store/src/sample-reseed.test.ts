import { resolvePriorityEvent, type BoiaEvent, type HomeBlock } from '@boia/contracts';
import { describe, expect, it } from 'vitest';
import { resolveEntities } from './content';
import { SAMPLE_RESEEDS } from './sample-reseed';
import { HALLOWEEN_EVENT_ID, SAMPLE_EVENTS, SAMPLE_HOME_BLOCKS, SONIDO_EVENT_ID } from './sample';
import { SAMPLE_CONTENT_REVISION, SCHEMA_VERSION, emptyDoc } from './schema';
import { STORE_KEY } from './storage';
import { makeRepo } from './test-helpers';

/**
 * Plan 023 T248: un navegador con cambios del Admin guardados con la muestra
 * de antes del T67 (2026-10-02) enseñaba otro «Próximo evento» que un
 * navegador limpio. Al cargar, esos cambios de la muestra dejan paso a la
 * muestra de hoy; lo creado en el Admin se queda.
 */
const NOW = new Date('2026-10-09T12:00:00+02:00');
const AT = '2026-09-30T10:00:00.000Z';

const sonido = SAMPLE_EVENTS.find((e) => e.id === SONIDO_EVENT_ID)!;
const priorityBlock = SAMPLE_HOME_BLOCKS.find((b) => b.type === 'priority_event')!;

/** El All Day de primavera de la muestra vieja, tal como lo guardó el Admin. */
const oldAllDay = {
  ...sonido,
  id: 'ev-all-day-primavera',
  slug: 'all-day-primavera',
  name: 'All Day BOIA · Primavera',
  startsAt: '2027-04-17T12:00:00+02:00',
  endsAt: undefined,
};
/** Una fiesta creada en el Admin: no es de la muestra. */
const ownEvent = {
  ...sonido,
  id: 'mi-fiesta',
  slug: 'mi-fiesta',
  name: 'Mi fiesta',
  startsAt: '2027-02-01T23:00:00+01:00',
  endsAt: undefined,
};
const edit = (value: unknown) => ({ value, deleted: false, at: AT });

/** Documento guardado antes de la revisión de la muestra (sin `sampleRevision`). */
function staleDoc() {
  const doc = emptyDoc(SCHEMA_VERSION) as unknown as Record<string, unknown> & {
    content: Record<string, unknown>;
  };
  delete doc.content.sampleRevision;
  doc.content.items = {
    // El bloque guardado con el evento prioritario de entonces.
    homeBlocks: { [priorityBlock.id]: edit({ ...priorityBlock, eventId: oldAllDay.id }) },
    events: {
      [oldAllDay.id]: edit(oldAllDay),
      [ownEvent.id]: edit(ownEvent),
      // Halloween con su copia de entonces, en el borrador.
    },
  };
  doc.content.drafts = {
    items: { events: { [HALLOWEEN_EVENT_ID]: edit({ ...sonido, id: HALLOWEEN_EVENT_ID }) } },
    order: {},
    texts: {},
  };
  doc.content.texts = { 'hero.explore': 'Zarpa' };
  return doc;
}

const open = (doc: unknown) => {
  const { storage } = makeRepo();
  storage.setItem(STORE_KEY, JSON.stringify(doc));
  return { storage, repo: makeRepo({ storage }).reload() };
};

const priorityOf = (blocks: HomeBlock[], events: BoiaEvent[]) => {
  const block = blocks.find((b) => b.type === 'priority_event');
  return resolvePriorityEvent(
    events,
    block?.type === 'priority_event' ? block.eventId : undefined,
    NOW,
  );
};

describe('muestra renovada en un navegador con datos viejos (T248)', () => {
  it('sin renovar, los cambios viejos dan otro próximo evento (la causa)', () => {
    const doc = staleDoc();
    const items = doc.content.items as Record<string, never>;
    const blocks = resolveEntities(
      'homeBlocks',
      SAMPLE_HOME_BLOCKS as never,
      items.homeBlocks,
      undefined,
    );
    const events = resolveEntities('events', SAMPLE_EVENTS as never, items.events, undefined);
    expect(priorityOf(blocks as HomeBlock[], events as BoiaEvent[])?.name).toBe(oldAllDay.name);
  });

  it('al cargar, el próximo evento es el de la muestra de hoy (Halloween)', async () => {
    const { repo } = open(staleDoc());
    const home = await repo.content.home();
    const shown = priorityOf(home.blocks, home.events);
    expect(shown?.id).toBe(HALLOWEEN_EVENT_ID);
    expect(shown?.id).toBe(priorityBlock.type === 'priority_event' ? priorityBlock.eventId : null);
    expect(home.events.map((e) => e.id)).not.toContain(oldAllDay.id);
    // El borrador viejo de Halloween tampoco queda.
    const drafts = await repo.admin.draftList('events');
    expect(drafts.find((e) => e.id === HALLOWEEN_EVENT_ID)?.name).toBe(
      SAMPLE_EVENTS.find((e) => e.id === HALLOWEEN_EVENT_ID)!.name,
    );
  });

  it('lo creado en el Admin y los textos se quedan', async () => {
    const { repo } = open(staleDoc());
    const home = await repo.content.home();
    expect(home.events.find((e) => e.id === ownEvent.id)?.name).toBe(ownEvent.name);
    expect((await repo.content.texts())['hero.explore']).toBe('Zarpa');
  });

  it('se renueva una sola vez: lo que se cambia después sobrevive a recargar', async () => {
    const { storage, repo } = open(staleDoc());
    const saved = JSON.parse(storage.getItem(STORE_KEY)!);
    expect(saved.content.sampleRevision).toBe(SAMPLE_CONTENT_REVISION);
    await repo.admin.upsert('homeBlocks', { ...priorityBlock, eventId: SONIDO_EVENT_ID } as never);
    const again = makeRepo({ storage }).reload();
    const home = await again.content.home();
    expect(priorityOf(home.blocks, home.events)?.id).toBe(SONIDO_EVENT_ID);
  });

  it('lo purgado para siempre no vuelve', async () => {
    const doc = staleDoc();
    (doc.content.items as Record<string, Record<string, unknown>>).events![SONIDO_EVENT_ID] = {
      value: null,
      deleted: true,
      purged: true,
      at: AT,
    };
    const { repo } = open(doc);
    const home = await repo.content.home();
    expect(home.events.map((e) => e.id)).not.toContain(SONIDO_EVENT_ID);
  });

  it('un documento nuevo nace con la muestra de hoy y los pasos llegan a la revisión', () => {
    expect(emptyDoc().content.sampleRevision).toBe(SAMPLE_CONTENT_REVISION);
    expect(Math.max(...SAMPLE_RESEEDS.map((s) => s.revision))).toBe(SAMPLE_CONTENT_REVISION);
  });
});

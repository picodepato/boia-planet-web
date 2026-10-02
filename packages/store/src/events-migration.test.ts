import { eventState } from '@boia/contracts';
import { describe, expect, it } from 'vitest';
import { V3_EVENT_PRICES_CENTS, migrate } from './migrations';
import { STORE_KEY } from './storage';
import { MemoryStorage } from './storage';
import { makeRepo } from './test-helpers';

/**
 * v2 → v3 (T42): los eventos que el Admin guardó con el formato de texto
 * libre y el estado a mano pasan a la forma nueva sin cambiar lo que se ve.
 */
const at = '2026-09-20T10:00:00.000Z';
/** El All Day de primavera de la muestra de entonces (ya no está en la muestra: T67). */
const primavera = { id: 'ev-all-day-primavera' };

/** Un evento tal como lo guardaba el Admin en la v2 (sin los campos nuevos). */
function v2Event(id: string, format: string, state: string) {
  return {
    id,
    slug: id,
    name: `Evento ${id}`,
    format,
    startsAt: '2027-05-22T23:00:00+02:00',
    timeZone: 'Europe/Madrid',
    placeLabel: 'Alicante',
    state,
    description: '',
    artistIds: [],
    ticketUrl: 'https://example.com/boia-sandbox/tickets/x',
    sample: false,
  };
}

const v2Doc = {
  schemaVersion: 2,
  identity: null,
  carnets: {},
  players: {},
  ledger: [],
  purchases: [],
  bottles: [],
  bottleReads: [],
  bottleReports: [],
  content: {
    items: {
      events: {
        [primavera.id]: {
          value: { ...v2Event(primavera.id, 'All Day BOIA', 'sold_out'), islandId: 'allday' },
          deleted: false,
          at,
        },
        'ev-noche-del-admin': {
          value: v2Event('ev-noche-del-admin', 'Noche', 'on_sale'),
          deleted: false,
          at,
        },
      },
    },
    order: {},
    places: {},
    skins: {},
    texts: {},
  },
  audit: [],
};

describe('migración v2 → v3: eventos (T42)', () => {
  it('formato cerrado, serie, estado a mano y precio de la tabla vieja', () => {
    const out = migrate(v2Doc);
    expect(out.status).toBe('ok');
    if (out.status !== 'ok') return;
    const events = (out.doc.content as { items: { events: Record<string, { value: unknown }> } })
      .items.events;
    expect(events[primavera.id]!.value).toMatchObject({
      format: 'all_day',
      stateSource: 'manual',
      state: 'sold_out',
      priceCents: V3_EVENT_PRICES_CENTS[primavera.id],
    });
    expect(events['ev-noche-del-admin']!.value).toMatchObject({
      format: 'satelite',
      series: 'noche',
      stateSource: 'manual',
    });
    expect(events['ev-noche-del-admin']!.value).not.toHaveProperty('priceCents');
  });

  it('el repositorio carga el documento sin perder ningún evento y con el mismo estado', async () => {
    const storage = new MemoryStorage();
    storage.setItem(STORE_KEY, JSON.stringify(v2Doc));
    const { repo } = makeRepo({ storage });
    expect(repo.status().droppedOnLoad).toBe(0);
    const events = await repo.content.events();
    const p = events.find((e) => e.id === primavera.id)!;
    // Estaba agotado a mano: sigue agotado aunque pasen las fechas.
    expect(eventState(p, new Date('2030-01-01T00:00:00Z'))).toBe('sold_out');
    expect(events.find((e) => e.id === 'ev-noche-del-admin')?.format).toBe('satelite');
  });
});

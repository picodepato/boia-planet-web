import { describe, expect, it } from 'vitest';
import {
  ALL_DAY_ISLAND_ID,
  EVENT_DEFAULT_HOURS,
  EVENT_STATES,
  EVENT_STATE_BEHAVIOR,
  canBuy,
  commonIslandId,
  eventState,
  islandUpcomingEvents,
  nextAllDay,
  resolvePriorityEvent,
  upcomingEvents,
  type BoiaEvent,
  type EventState,
} from './events';
import { eventKicker } from './event-labels';
import { CLIENT_FUNNEL_EVENTS, FUNNEL_EVENTS } from './analytics';
import { homeBlocksSchema } from './home-blocks';

const NOW = new Date('2030-01-10T10:00:00Z');

function ev(id: string, state: EventState, daysFromNow: number): BoiaEvent {
  return {
    id,
    slug: id,
    name: id,
    format: 'all_day',
    startsAt: new Date(NOW.getTime() + daysFromNow * 86_400_000).toISOString(),
    timeZone: 'Europe/Madrid',
    placeLabel: 'Alicante',
    placeAnnounced: true,
    state,
    description: '',
    artistIds: [],
    ticketUrl: 'https://example.com/t',
    stateSource: 'dates',
    activities: [],
    priceSample: true,
    sample: true,
  };
}

const DAY = 86_400_000;
const HOUR = 3_600_000;
const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

describe('estados de evento', () => {
  it('sólo «a la venta» es comprable', () => {
    for (const s of EVENT_STATES) expect(canBuy(ev('x', s, 5))).toBe(s === 'on_sale');
  });

  it('borrador y finalizado no salen en próximos; el resto sí, por fecha', () => {
    const events = EVENT_STATES.map((s, i) => ev(s, s, 10 - i));
    const listed = upcomingEvents(events, NOW).map((e) => e.state);
    expect(new Set(listed)).toEqual(
      new Set(EVENT_STATES.filter((s) => EVENT_STATE_BEHAVIOR[s].listed)),
    );
    expect(listed).not.toContain('draft');
    expect(listed).not.toContain('finished');
    const dates = upcomingEvents(events, NOW).map((e) => e.startsAt);
    expect(dates).toEqual([...dates].sort());
  });

  it('un evento pasado o excluido a mano no sale en próximos', () => {
    const events = [ev('pasado', 'on_sale', -3), ev('fuera', 'on_sale', 3), ev('ok', 'on_sale', 4)];
    expect(upcomingEvents(events, NOW, ['fuera']).map((e) => e.id)).toEqual(['ok']);
  });

  it('el prioritario cae al primer comprable si el elegido ya no está vigente', () => {
    const events = [
      ev('cancelado', 'cancelled', 2),
      ev('pronto', 'coming_soon', 3),
      ev('venta', 'on_sale', 9),
    ];
    expect(resolvePriorityEvent(events, 'cancelado', NOW)?.id).toBe('venta');
    expect(resolvePriorityEvent(events, 'pronto', NOW)?.id).toBe('pronto');
    expect(resolvePriorityEvent([], undefined, NOW)).toBeUndefined();
  });
});

describe('estado por fechas (REQ-COM-004)', () => {
  // Cada uno de los siete estados sale de las fechas y de lo que puso el Admin.
  const cases: Array<[EventState, Partial<BoiaEvent>]> = [
    ['draft', { state: 'draft', saleOpensAt: at(-DAY) }],
    ['coming_soon', { state: 'on_sale', saleOpensAt: at(DAY) }],
    ['on_sale', { state: 'coming_soon', saleOpensAt: at(-DAY) }],
    ['sold_out', { state: 'sold_out', saleOpensAt: at(-DAY) }],
    ['postponed', { state: 'postponed' }],
    ['cancelled', { state: 'cancelled' }],
    ['finished', { state: 'on_sale', startsAt: at(-2 * DAY) }],
  ];

  it.each(cases)('%s', (want, patch) => {
    expect(eventState({ ...ev('x', 'on_sale', 5), ...patch }, NOW)).toBe(want);
  });

  it('los siete estados salen de la tabla de casos', () => {
    expect(new Set(cases.map(([s]) => s))).toEqual(new Set(EVENT_STATES));
  });

  it('pasado el fin, agotado finaliza; cancelado y pospuesto conservan su aviso', () => {
    const past = { startsAt: at(-(EVENT_DEFAULT_HOURS + 1) * HOUR) };
    expect(eventState({ ...ev('x', 'sold_out', 0), ...past }, NOW)).toBe('finished');
    expect(eventState({ ...ev('x', 'cancelled', 0), ...past }, NOW)).toBe('cancelled');
    expect(eventState({ ...ev('x', 'postponed', 0), ...past }, NOW)).toBe('postponed');
    // Aún dentro de su duración, sigue a la venta.
    const live = { startsAt: at(-(EVENT_DEFAULT_HOURS - 1) * HOUR) };
    expect(eventState({ ...ev('x', 'on_sale', 0), ...live }, NOW)).toBe('on_sale');
    expect(eventState({ ...ev('x', 'on_sale', 0), ...live, endsAt: at(-HOUR) }, NOW)).toBe(
      'finished',
    );
  });

  it('a mano, las fechas no lo cambian', () => {
    const e = { ...ev('x', 'on_sale', -3), stateSource: 'manual' as const };
    expect(eventState(e, NOW)).toBe('on_sale');
    expect(canBuy(e, NOW)).toBe(true);
    expect(canBuy({ ...e, stateSource: 'dates' }, NOW)).toBe(false);
  });

  it('un evento terminado por fecha nunca se compra ni sale en próximos', () => {
    const e = ev('x', 'on_sale', -2);
    expect(canBuy(e)).toBe(true); // sin `now`, el estado guardado
    expect(canBuy(e, NOW)).toBe(false);
    expect(upcomingEvents([e], NOW)).toEqual([]);
    expect(resolvePriorityEvent([e], 'x', NOW)).toBeUndefined();
  });
});

describe('satélites (REQ-COM-010, O7)', () => {
  const club: BoiaEvent = { ...ev('club', 'on_sale', 2), format: 'satelite', series: 'boia-club' };
  const allDay: BoiaEvent = { ...ev('allday', 'on_sale', 30), islandId: 'isla-x' };

  it('un satélite sin isla sale en los próximos de la isla del próximo All Day', () => {
    const events = [club, allDay, ev('otro', 'on_sale', 40)];
    expect(nextAllDay(events, NOW)?.id).toBe('allday');
    expect(commonIslandId(events, NOW)).toBe('isla-x');
    expect(islandUpcomingEvents('isla-x', events, NOW).map((e) => e.id)).toEqual([
      'club',
      'allday',
    ]);
    // La isla ya enseña su evento arriba: en el bloque sólo queda el satélite.
    expect(islandUpcomingEvents('isla-x', events, NOW, 'allday').map((e) => e.id)).toEqual([
      'club',
    ]);
    expect(islandUpcomingEvents('otra-isla', events, NOW)).toEqual([]);
  });

  it('sin All Day próximo, la localización común es la isla All Day y no hay enlace', () => {
    expect(nextAllDay([club], NOW)).toBeUndefined();
    expect(commonIslandId([club], NOW)).toBe(ALL_DAY_ISLAND_ID);
    expect(islandUpcomingEvents(ALL_DAY_ISLAND_ID, [club], NOW).map((e) => e.id)).toEqual(['club']);
  });

  it('un All Day cancelado no es el próximo', () => {
    expect(nextAllDay([{ ...allDay, state: 'cancelled' }], NOW)).toBeUndefined();
  });

  it('la tarjeta enseña la serie; sin serie, el formato', () => {
    expect(eventKicker(club)).toBe('BOIA Club');
    expect(eventKicker(allDay)).toBe('All Day BOIA');
    expect(eventKicker({ format: 'satelite', series: 'nueva-serie' })).toBe('nueva-serie');
  });
});

describe('contratos', () => {
  it('purchase_confirmed no es un evento de cliente', () => {
    expect(FUNNEL_EVENTS).toContain('purchase_confirmed');
    expect(CLIENT_FUNNEL_EVENTS).not.toContain('purchase_confirmed');
    expect(CLIENT_FUNNEL_EVENTS).toHaveLength(FUNNEL_EVENTS.length - 1);
  });

  it('la lista de bloques rechaza ids repetidos', () => {
    const block = {
      id: 'a',
      type: 'store',
      visible: true,
      url: 'https://example.com',
      products: [],
    };
    expect(homeBlocksSchema.safeParse([block, { ...block }]).success).toBe(false);
    expect(homeBlocksSchema.safeParse([block, { ...block, id: 'b' }]).success).toBe(true);
  });
});

import {
  EVENT_STATES,
  type BoiaEvent,
  type EventState,
  canBuy,
  eventEndMs,
  isIslandlessSatellite,
  islandUpcomingEvents,
  nextAllDay,
} from '@boia/contracts';
import { HALLOWEEN_EVENT_ID, NOCHEVIEJA_EVENT_ID, SONIDO_EVENT_ID } from '@boia/store';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventPageBody } from '../../app/(landing)/components/event-page';
import { EventCard } from '../../app/(landing)/components/event-card';
import { IslandUpcoming } from '../mundo/place-panels';
import { EventBlock } from '../../app/mar/sheet';
import { eventSailHref } from '../world-handoff';
import { EVENTOS_COPY } from './eventos-copy';
import {
  GENERAL_GALLERY,
  eventPageView,
  galleryAnchor,
  photoGalleries,
  publicEventSlugs,
} from './eventos';
import { resolveBlock, resolveHome } from './resolve';
import { SAMPLE_ALBUM_CONTENT, SAMPLE_CONTENT } from './sample-content';

const content = { ...SAMPLE_CONTENT, albums: SAMPLE_ALBUM_CONTENT };
const byId = (id: string) => SAMPLE_CONTENT.events.find((e) => e.id === id)!;
const halloween = byId(HALLOWEEN_EVENT_ID);
// «Ahora»: un día antes del primer evento listado de la muestra.
const firstListed = Math.min(
  ...SAMPLE_CONTENT.events
    .filter((e) => e.state !== 'draft' && e.state !== 'finished')
    .map((e) => Date.parse(e.startsAt)),
);
const NOW = new Date(firstListed - 24 * 3600_000);
const onSale = SAMPLE_CONTENT.events.find((e) => canBuy(e, NOW) && e.islandId)!;
/** Pasado su fin: las fechas lo finalizan aunque nadie lo toque. */
const after = (e: BoiaEvent) => new Date(eventEndMs(e) + 60_000);

const BUY = 'data-testid="comprar-';
const page = (e: BoiaEvent, now: Date, events = SAMPLE_CONTENT.events) => {
  const view = eventPageView(
    { ...content, events: [...events.filter((x) => x.id !== e.id), e] },
    e.slug,
    now,
  );
  return view ? renderToStaticMarkup(createElement(EventPageBody, { view })) : '';
};

afterEach(() => {
  vi.useRealTimers();
});

describe('ficha de evento (REQ-COM-012)', () => {
  it('cada evento publicado tiene ficha; el borrador no', () => {
    const slugs = publicEventSlugs(SAMPLE_CONTENT.events);
    for (const e of SAMPLE_CONTENT.events) {
      expect(slugs.includes(e.slug), e.id).toBe(e.state !== 'draft');
      expect(eventPageView(content, e.slug, NOW) === null, e.id).toBe(e.state === 'draft');
    }
  });

  it('a la venta: compra, precio y «Ir a su isla»', () => {
    const html = page(onSale, NOW);
    expect(html).toContain(`${BUY}${onSale.id}"`);
    expect(html).toContain('data-testid="evento-precio"');
    expect(html).toContain(`href="${eventSailHref(onSale.id)}"`);
    expect(eventSailHref(onSale.id)).toMatch(/^\/mar\?/);
    expect(html).toContain(EVENTOS_COPY.sailToIsland);
  });

  it('un evento finalizado nunca enseña compra: ni a mano ni por fecha', () => {
    const manual: BoiaEvent = { ...onSale, state: 'finished' };
    for (const html of [page(manual, NOW), page(onSale, after(onSale))]) {
      expect(html).toContain('data-estado="finished"');
      expect(html).not.toContain(BUY);
      expect(html).toContain('data-testid="evento-recuerdos"');
    }
    // Tampoco en la tarjeta de la landing ni en su isla.
    const past = after(onSale);
    const view = resolveHome(SAMPLE_CONTENT, past);
    expect(view.buyable).not.toContain(onSale.id);
    const panel = renderToStaticMarkup(
      createElement(EventBlock, {
        event: { ...onSale, state: 'finished' },
        onBuy: () => {},
        onSteer: () => false,
      }),
    );
    expect(panel).not.toContain('mar-comprar');
  });

  it('sólo «a la venta» enseña compra en la ficha', () => {
    for (const state of EVENT_STATES.filter((s) => s !== 'draft')) {
      const e: BoiaEvent = { ...onSale, state, stateSource: 'manual' };
      expect(page(e, NOW).includes(BUY), state).toBe(state === 'on_sale');
    }
  });

  it('agotado, pospuesto y cancelado llevan su aviso y otros próximos', () => {
    const notices: Array<[EventState, string]> = [
      ['sold_out', EVENTOS_COPY.stateBody.sold_out],
      ['postponed', EVENTOS_COPY.stateBody.postponed],
      ['cancelled', EVENTOS_COPY.stateBody.cancelled],
    ];
    for (const [state, text] of notices) {
      const html = page({ ...onSale, state, stateSource: 'manual' }, NOW);
      expect(html).toContain('data-testid="evento-aviso"');
      expect(html).toContain(text);
      expect(html).toContain('evento-proximos');
    }
  });

  it('sin cartel: «Cartel próximamente»', () => {
    const html = page({ ...halloween }, NOW);
    expect(halloween.posterUrl).toBeUndefined();
    expect(html).toContain(EVENTOS_COPY.posterSoon);
  });
});

describe('los tres eventos con entradas, cada uno en su isla (2026-10-02)', () => {
  it('HALLOWEEN IN THE CLUB en el Kiki García, ALL DAY BOIA y BOIA Nochevieja: reales, con precio de muestra', () => {
    const want = [
      [HALLOWEEN_EVENT_ID, 'HALLOWEEN IN THE CLUB', '2026-10-31', 'halloween'],
      [SONIDO_EVENT_ID, 'ALL DAY BOIA', '2026-12-05', 'allday'],
      [NOCHEVIEJA_EVENT_ID, 'BOIA Nochevieja', '2026-12-31', 'ultima'],
    ];
    expect(
      want.map(([id]) => {
        const e = byId(id!);
        return [e.id, e.name, e.startsAt.slice(0, 10), e.islandId];
      }),
    ).toEqual(want);
    expect(halloween.placeLabel).toBe('Kiki García');
    for (const [id] of want) {
      expect(byId(id!)).toMatchObject({ sample: false, priceSample: true });
      expect(isIslandlessSatellite(byId(id!))).toBe(false);
    }
  });
});

describe('un satélite sin isla (D-23, O7)', () => {
  // Desde el 2026-10-02 la muestra no tiene satélites sin isla: uno como el BOIA Club de antes.
  const club: BoiaEvent = { ...halloween, id: 'club-sin-isla', slug: 'club-sin-isla' };
  delete club.islandId;
  const events = [...SAMPLE_CONTENT.events, club];
  const withClub = { ...content, events };

  it('vive en la localización común', () => {
    expect(isIslandlessSatellite(club)).toBe(true);
  });

  it('su ficha y su tarjeta de Tickets enlazan al próximo All Day', () => {
    const next = nextAllDay(events, NOW)!;
    expect(next.format).toBe('all_day');
    const view = eventPageView(withClub, club.slug, NOW)!;
    expect(view.warmup?.next?.slug).toBe(next.slug);
    expect(view.kicker).toBe('BOIA Club');
    // «Ir a su isla»: la isla del próximo All Day.
    expect(view.islandHref).toBe(eventSailHref(next.id));

    const tickets = resolveHome({ ...SAMPLE_CONTENT, events }, NOW).tickets;
    expect(tickets.nextAllDay?.slug).toBe(next.slug);
    const card = renderToStaticMarkup(
      createElement(EventCard, {
        event: club,
        artists: [],
        buyable: true,
        source: 'tickets_panel',
        nextAllDay: tickets.nextAllDay,
      }),
    );
    expect(card).toContain(`data-testid="calienta-${club.id}"`);
    expect(card).toContain(`href="/eventos/${next.slug}"`);
    expect(card).toContain('BOIA Club');
  });

  it('sin próximo All Day, no inventa el enlace', () => {
    const noAllDay = events.filter((e) => e.format !== 'all_day');
    const view = eventPageView({ ...content, events: noAllDay }, club.slug, NOW)!;
    expect(view.warmup).toEqual({ next: null });
    expect(page(club, NOW, noAllDay)).toContain(EVENTOS_COPY.warmupNone);
  });

  it('sale en los «Próximos eventos» de la isla del próximo All Day, con su enlace', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    const next = nextAllDay(events, NOW)!;
    const own = islandUpcomingEvents(next.islandId!, events, NOW, next.id);
    expect(own.map((e) => e.id)).toContain(club.id);
    // El panel de la isla lee el contenido vivo (la muestra): sin el satélite,
    // enseña los de la isla y luego el resto de próximos.
    const html = renderToStaticMarkup(
      createElement(IslandUpcoming, { islandId: next.islandId!, excludeId: next.id }),
    );
    const order = [...html.matchAll(/data-evento="([^"]+)"/g)].map((m) => m[1]);
    const mine = islandUpcomingEvents(next.islandId!, SAMPLE_CONTENT.events, NOW, next.id);
    expect(order.slice(0, mine.length)).toEqual(mine.map((e) => e.id));
  });
});

describe('«Fotos y eventos» (REQ-COM-031)', () => {
  const islands = [
    { id: 'cala', name: 'Cala Cantalar' },
    { id: 'allday', name: 'ALL DAY BOIA' },
    { id: 'ultima', name: 'Isla de Nochevieja' },
    { id: 'halloween', name: 'HALLOWEEN IN THE CLUB' },
  ];
  const galleries = photoGalleries(
    { events: SAMPLE_CONTENT.events, albums: SAMPLE_ALBUM_CONTENT, photos: SAMPLE_CONTENT.photos },
    islands,
  );

  it('una galería por isla (aunque esté vacía), con las fotos de sus eventos', () => {
    expect(galleries.slice(0, islands.length).map((g) => g.id)).toEqual(islands.map((i) => i.id));
    for (const album of SAMPLE_ALBUM_CONTENT) {
      const event = album.eventId ? byId(album.eventId) : undefined;
      const anchor = event ? galleryAnchor(event) : (album.islandId ?? GENERAL_GALLERY);
      const g = galleries.find((x) => x.id === anchor)!;
      expect(g, album.id).toBeDefined();
      const photos = SAMPLE_CONTENT.photos.filter((p) => p.albumId === album.id);
      expect(g.sections.find((s) => s.album.id === album.id)?.photos).toEqual(photos);
    }
    const total = galleries.reduce((n, g) => n + g.count, 0);
    expect(total).toBe(SAMPLE_CONTENT.photos.length);
  });

  it('un evento sin isla con álbum tiene su propia galería; un borrador no', () => {
    const club: BoiaEvent = { ...halloween, id: 'club-sin-isla', slug: 'club-sin-isla' };
    delete club.islandId;
    const own = photoGalleries(
      {
        events: [...SAMPLE_CONTENT.events, club],
        albums: [
          { id: 'a-hal', title: 'Halloween', eventId: club.id, sample: true },
          { id: 'a-draft', title: 'Borrador', eventId: 'ev-borrador', sample: true },
        ],
        photos: [{ id: 'p', albumId: 'a-hal', alt: 'x', width: 1, height: 1, selection: false }],
      },
      [],
    );
    expect(own.map((g) => g.id)).toEqual([club.slug]);
    expect(own[0]!.count).toBe(1);
  });

  it('la home enseña sólo la selección', () => {
    const block = SAMPLE_CONTENT.blocks.find((b) => b.type === 'photos')!;
    const resolved = resolveBlock(block, SAMPLE_CONTENT, NOW);
    const want = SAMPLE_CONTENT.photos.filter((p) => p.selection).slice(0, 6);
    expect(want.length).toBeGreaterThan(0);
    expect(resolved?.type === 'photos' && resolved.photos).toEqual(want);
    // Sin ninguna selección, el bloque no sale.
    const none = {
      ...SAMPLE_CONTENT,
      photos: SAMPLE_CONTENT.photos.map((p) => ({ ...p, selection: false })),
    };
    expect(resolveBlock(block, none, NOW)).toBeNull();
  });
});

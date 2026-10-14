import { type BoiaEvent, buyButtonShown, canBuy } from '@boia/contracts';
import {
  HALLOWEEN_EVENT_ID,
  MemoryStorage,
  NOCHEVIEJA_EVENT_ID,
  SONIDO_EVENT_ID,
  createLocalRepository,
} from '@boia/store';
import { WORLD_REGISTRY } from '@boia/world';
import { type ReactElement, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { BuyButton, NotYetBuy } from '../../app/(landing)/components/buy-button';
import { EventCard } from '../../app/(landing)/components/event-card';
import { draftOf, eventInputOf } from '../../app/admin/sections/events';
import { marPurchase, worldTickets } from '../../app/mar/entradas-model';
import { createAdminActions } from '../admin/actions';
import { t } from '../i18n/web';
import { eventPageView } from '../landing/eventos';
import { resolveHome } from '../landing/resolve';
import { SAMPLE_CONTENT } from '../landing/sample-content';
import { EventPageBody } from '../../app/(landing)/components/event-page';

/**
 * «Tickets todavía no disponibles» (plan 030 T292, Álvaro 2026-10-14): ALL
 * DAY BOIA y BOIA Nochevieja enseñan «Comprar entradas», pero al tocarlo lo
 * dicen en vez de abrir el checkout o la ticketera (tampoco sin JavaScript).
 * Halloween («Solo en puerta») sigue igual. El Admin lo quita para abrir la
 * venta.
 */

const NOW = new Date('2026-10-14T12:00:00+02:00');
const MESSAGE = 'Tickets todavía no disponibles';
const byId = (id: string) => SAMPLE_CONTENT.events.find((e) => e.id === id)!;
const sonido = byId(SONIDO_EVENT_ID);
const nochevieja = byId(NOCHEVIEJA_EVENT_ID);
const halloween = byId(HALLOWEEN_EVENT_ID);

const card = (event: BoiaEvent) =>
  renderToStaticMarkup(
    createElement(EventCard, {
      event,
      artists: SAMPLE_CONTENT.artists,
      buyable: buyButtonShown(event),
      source: 'tickets_panel',
    }),
  );

describe('«Tickets todavía no disponibles» (T292)', () => {
  it('el texto es el aprobado por Álvaro', () => {
    expect(t('ticketing.notYet')).toBe(MESSAGE);
  });

  it('ALL DAY BOIA y Nochevieja: no se compran, pero llevan el botón; Halloween, igual que antes', () => {
    for (const e of [sonido, nochevieja]) {
      expect(e.ticketsNotYet, e.id).toBe(true);
      expect(canBuy(e, NOW), e.id).toBe(false);
      expect(buyButtonShown(e, NOW), e.id).toBe(true);
    }
    expect(halloween.ticketsNotYet).toBe(false);
    expect(canBuy(halloween, NOW)).toBe(true);
    expect(halloween.boxOfficeOnly).toBeDefined();
  });

  it('sin JavaScript: el botón despliega el aviso y no hay enlace a la ticketera', () => {
    const html = card(sonido);
    expect(html).toContain(`data-testid="no-todavia-${SONIDO_EVENT_ID}"`);
    expect(html).not.toContain(`data-testid="comprar-${SONIDO_EVENT_ID}"`);
    expect(html).toContain('<summary class="button button--buy"');
    expect(html).toContain(
      `role="status" data-testid="no-todavia-${SONIDO_EVENT_ID}-aviso">${MESSAGE}`,
    );
    expect(html).not.toContain(sonido.ticketUrl!);
    expect(html).not.toContain('ticket_click_out');
    // Halloween sigue con su aviso «Solo en puerta».
    const door = card(halloween);
    expect(door).toContain('data-testid="box-office-message"');
    expect(door).not.toContain(MESSAGE);
  });

  it('tocar «Comprar entradas» enseña el aviso y no abre el checkout', () => {
    const onTap = vi.fn();
    const props = { eventId: sonido.id, eventName: sonido.name, hydrated: true, onTap };
    const before = NotYetBuy({ ...props, shown: false }) as ReactElement<{
      children: ReactElement<{ onClick: () => void; href?: string; 'aria-haspopup'?: string }>[];
    }>;
    const button = before.props.children[0]!;
    expect(button.type).toBe('button');
    expect(button.props.href).toBeUndefined();
    expect(button.props['aria-haspopup']).toBeUndefined();
    const closed = renderToStaticMarkup(before);
    expect(closed).toContain('>Comprar entradas</button>');
    expect(closed).not.toContain(MESSAGE);
    expect(closed).not.toContain('role="dialog"');
    button.props.onClick();
    expect(onTap).toHaveBeenCalledTimes(1);
    const after = renderToStaticMarkup(NotYetBuy({ ...props, shown: true }));
    expect(after).toContain(
      `role="status" data-testid="no-todavia-${SONIDO_EVENT_ID}-aviso">${MESSAGE}`,
    );
    expect(after).not.toContain('checkout');
  });

  it('el BuyButton con `notYet` nunca pinta el enlace de la ticketera', () => {
    const html = renderToStaticMarkup(
      createElement(BuyButton, {
        eventId: sonido.id,
        eventName: sonido.name,
        ticketUrl: sonido.ticketUrl,
        source: 'upcoming_events',
        notYet: true,
      }),
    );
    expect(html).not.toContain('href=');
    expect(html).toContain(MESSAGE);
  });

  it('landing, panel de Tickets, ficha y mar: el botón sigue, con el aviso en vez del checkout', () => {
    const view = resolveHome(SAMPLE_CONTENT, NOW);
    expect(view.buyable).toEqual(expect.arrayContaining([sonido.id, nochevieja.id, halloween.id]));
    const listed = [view.tickets.featured, ...view.tickets.others].map((e) => e?.id);
    expect(listed).toEqual(expect.arrayContaining([sonido.id, nochevieja.id]));
    expect(view.tickets.onSale).toBe(true);

    const page = eventPageView({ ...SAMPLE_CONTENT, albums: [] }, sonido.slug, NOW)!;
    expect(page.buyable).toBe(true);
    const html = renderToStaticMarkup(createElement(EventPageBody, { view: page }));
    expect(html).toContain(MESSAGE);
    expect(html).not.toContain(sonido.ticketUrl!);

    const mar = worldTickets(SAMPLE_CONTENT, NOW, () => null);
    expect(mar.entries.find((x) => x.event.id === sonido.id)?.buyable).toBe(true);
    expect(marPurchase(sonido)).toBe('not_yet');
    expect(marPurchase(nochevieja)).toBe('not_yet');
    expect(marPurchase(halloween)).toBe('box_office');
    expect(marPurchase({ ...sonido, ticketsNotYet: false })).toBe('checkout');
  });

  it('el interruptor del Admin abre la venta (y la vuelve a cerrar)', async () => {
    const repo = createLocalRepository({
      storage: new MemoryStorage(),
      now: () => NOW,
      watch: false,
    });
    const actions = createAdminActions({ repo, registry: WORLD_REGISTRY, now: () => NOW });
    const stored = (await repo.content.get('events', SONIDO_EVENT_ID))!;
    const draft = draftOf(stored);
    expect(draft.ticketsNotYet).toBe(true);

    await actions.saveEvent(eventInputOf({ ...draft, ticketsNotYet: false }), 'abrir la venta');
    const open = (await repo.content.get('events', SONIDO_EVENT_ID))!;
    expect(open.ticketsNotYet).toBe(false);
    expect(canBuy(open, NOW)).toBe(true);
    expect(marPurchase(open)).toBe('checkout');

    await actions.saveEvent(eventInputOf({ ...draftOf(open), ticketsNotYet: true }), 'cerrar');
    const closed = (await repo.content.get('events', SONIDO_EVENT_ID))!;
    expect(closed.ticketsNotYet).toBe(true);
    expect(canBuy(closed, NOW)).toBe(false);
    // Halloween no se toca.
    expect(canBuy((await repo.content.get('events', HALLOWEEN_EVENT_ID))!, NOW)).toBe(true);
  });
});

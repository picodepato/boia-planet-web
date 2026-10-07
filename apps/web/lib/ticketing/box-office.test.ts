import { canBuy, eventSchema, EVENT_STATES } from '@boia/contracts';
import { HALLOWEEN_EVENT_ID, SAMPLE_DISCOUNTS, SONIDO_EVENT_ID } from '@boia/store';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SAMPLE_CONTENT } from '../landing/sample-content';
import { CARNET_CREATE_HREF } from '../landing/access';
import { BuyButton } from '../../app/(landing)/components/buy-button';
import { BoxOfficeDialog } from './box-office';

const events = SAMPLE_CONTENT.events;
const taquilla = events.filter((e) => e.boxOfficeOnly);
const message = 'Entradas sólo en taquilla, el mismo día. Enseña tu Carnet BOIA en la puerta y te descontamos 2 €.';

describe('taquilla por evento (T199, decisión 8)', () => {
  it('sólo Halloween y Sonido llevan la regla, con 2 EUR de descuento', () => {
    expect(taquilla.map((e) => e.id)).toEqual([HALLOWEEN_EVENT_ID, SONIDO_EVENT_ID]);
    for (const e of taquilla) {
      expect(e.boxOfficeOnly).toEqual({ carnetDiscountCents: 200 });
      expect(e.priceSample).toBe(true);
      expect(eventSchema.parse(e).boxOfficeOnly).toEqual(e.boxOfficeOnly);
    }
  });

  it('taquilla no necesita ticketera y sigue respetando los estados', () => {
    for (const state of EVENT_STATES) {
      expect(canBuy({ ...taquilla[0]!, state, ticketUrl: undefined })).toBe(state === 'on_sale');
    }
    expect(canBuy({ ...taquilla[0]!, boxOfficeOnly: undefined, ticketUrl: undefined })).toBe(false);
    expect(eventSchema.safeParse({ ...taquilla[0], boxOfficeOnly: { carnetDiscountCents: -200 } }).success).toBe(false);
  });

  it('antes de hidratar muestra el aviso desplegable y el Carnet, sin enlace a la ticketera', () => {
    for (const e of taquilla) {
      const html = renderToStaticMarkup(createElement(BuyButton, {
        eventId: e.id, eventName: e.name, ticketUrl: e.ticketUrl,
        boxOfficeOnly: e.boxOfficeOnly, source: 'tickets_panel',
      }));
      expect(html).toContain('<details');
      expect(html).toContain(message);
      expect(html).toContain('¿Aún no tienes Carnet?');
      expect(html).toContain('Hazte el tuyo');
      expect(html.indexOf('¿Aún no tienes Carnet?')).toBeGreaterThan(html.indexOf(message));
      expect(html).toContain(`href="${CARNET_CREATE_HREF}"`);
      expect(html).not.toContain(`href="${e.ticketUrl}"`);
    }
  });

  it('el diálogo del mar tiene el mismo mensaje y botón al Carnet, sin checkout', () => {
    const html = renderToStaticMarkup(createElement(BoxOfficeDialog, {
      eventName: taquilla[0]!.name, rule: taquilla[0]!.boxOfficeOnly!,
      carnet: { onOpen: () => {} }, onClose: () => {}, className: 'checkout--mar',
    }));
    expect(html).toContain(message);
    expect(html).toContain('data-testid="box-office-carnet"');
    expect(html).toContain('Hazte el tuyo</button>');
    expect(html).not.toContain('checkout-confirmar');
  });

  it('ningún código de descuento apunta a un evento de taquilla (no se podría canjear online)', () => {
    const ids = new Set(taquilla.map((e) => e.id));
    expect(SAMPLE_DISCOUNTS.filter((d) => d.eventId && ids.has(d.eventId))).toEqual([]);
  });

  it('los demás eventos conservan su enlace de checkout', () => {
    for (const e of events.filter((e) => !e.boxOfficeOnly && canBuy(e))) {
      const html = renderToStaticMarkup(createElement(BuyButton, {
        eventId: e.id, eventName: e.name, ticketUrl: e.ticketUrl, source: 'tickets_panel',
      }));
      expect(html).toContain(`href="${e.ticketUrl}"`);
      expect(html).not.toContain('box-office-message');
    }
  });
});

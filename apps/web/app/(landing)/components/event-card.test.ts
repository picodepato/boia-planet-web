import { EVENT_STATES, EVENT_STATE_BEHAVIOR, type BoiaEvent, canBuy } from '@boia/contracts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EventPanel } from '../../../lib/mundo/world-ui';
import { SAMPLE_CONTENT } from '../../../lib/landing/sample-content';
import { CHECKOUT_COPY } from '../../../lib/ticketing/copy';
import { EventCard } from './event-card';

const base = SAMPLE_CONTENT.events.find((e) => canBuy(e))!;
const withState = (state: BoiaEvent['state']): BoiaEvent => ({ ...base, state });

function card(event: BoiaEvent): string {
  return renderToStaticMarkup(
    createElement(EventCard, {
      event,
      artists: SAMPLE_CONTENT.artists,
      buyable: canBuy(event),
      source: 'tickets_panel',
    }),
  );
}

function panel(event: BoiaEvent): string {
  return renderToStaticMarkup(
    createElement(EventPanel, { event, showTicket: true, onBuy: () => {}, onClose: () => {} }),
  );
}

describe('CTA de compra (REQ-COM-035, REQ-COM-005)', () => {
  it('un evento a la venta muestra compra en la landing y en su isla', () => {
    // En el HTML (sin JavaScript) es el enlace a la ticketera; al hidratar, la compra de prueba.
    expect(card(base)).toContain(`data-testid="comprar-${base.id}"`);
    expect(panel(base)).toContain('data-testid="panel-evento-comprar"');
  });

  it('un evento finalizado nunca muestra compra, ni en la landing ni en su isla', () => {
    const finished = withState('finished');
    for (const html of [card(finished), panel(finished)]) {
      expect(html).not.toContain('data-testid="comprar-');
      expect(html).not.toContain('panel-evento-comprar');
      expect(html).not.toContain(CHECKOUT_COPY.buy);
      expect(html).not.toContain(`>${CHECKOUT_COPY.islandBuy}<`);
    }
  });

  it('sólo los estados comprables muestran compra', () => {
    for (const state of EVENT_STATES) {
      const e = withState(state);
      const buys = EVENT_STATE_BEHAVIOR[state].purchasable;
      expect(card(e).includes('data-testid="comprar-'), state).toBe(buys);
      expect(panel(e).includes('panel-evento-comprar'), state).toBe(buys);
    }
  });

  it('la isla no ofrece compra hasta que su TICKET se activa', () => {
    const html = renderToStaticMarkup(
      createElement(EventPanel, {
        event: base,
        showTicket: false,
        onBuy: () => {},
        onClose: () => {},
      }),
    );
    expect(html).not.toContain('panel-evento-comprar');
  });
});

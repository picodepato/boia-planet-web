import type { Artist, BoiaEvent } from '@boia/contracts';
import { ACCESS_COPY, SEA_HREF, ticketsSailHref } from '../../../lib/landing/access';
import { t } from '../../../lib/landing/texts';
import { EventCard } from './event-card';

/**
 * Panel de Tickets en HTML (REQ-ENT-037, REQ-ENT-038). No depende del motor
 * ni de WebGL. Sin JavaScript se abre con el ancla `#tickets` (CSS :target);
 * con JavaScript, `LandingClient` gestiona foco, Escape, Atrás y analítica.
 * La URL `/#tickets` es compartible (REQ-ENT-036).
 */
export function TicketsPanel({
  featured,
  others,
  onSale,
  artists,
  buyable,
  nextAllDay = null,
  island,
}: {
  featured: BoiaEvent | undefined;
  others: readonly BoiaEvent[];
  onSale: boolean;
  artists: readonly Artist[];
  buyable: ReadonlySet<string>;
  /** Para la línea «Calienta para el próximo All Day» de los satélites (O7). */
  nextAllDay?: { name: string; slug: string } | null;
  /**
   * Isla del evento destacado (o la localización común): «Ver su isla en el
   * mar» abre el mar 3D con el barco navegando hasta allí y la ficha con la
   * compra al llegar (T44, T55, REQ-ENT-034). Sin isla, el enlace lleva al mar a secas.
   */
  island?: string;
}) {
  return (
    <section
      id="tickets"
      className="tickets-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tickets-title"
    >
      <div className="tickets-panel__sheet">
        <div className="tickets-panel__head">
          <h2 id="tickets-title" className="tickets-panel__title" tabIndex={-1}>
            {t('tickets.heading')}
          </h2>
          <a
            className="button button--ghost tickets-panel__close"
            href="#inicio"
            data-tickets-close
          >
            {t('tickets.close')}
          </a>
        </div>
        {featured && (
          <div className="tickets-panel__featured">
            <p className="tickets-panel__kicker">{t('tickets.featured')}</p>
            <EventCard
              event={featured}
              artists={artists}
              buyable={buyable.has(featured.id)}
              source="tickets_panel"
              featured
              nextAllDay={nextAllDay}
            />
          </div>
        )}
        {others.length > 0 && (
          <ul className="tickets-panel__list">
            {others.map((e) => (
              <li key={e.id}>
                <EventCard
                  event={e}
                  artists={artists}
                  buyable={buyable.has(e.id)}
                  source="tickets_panel"
                  nextAllDay={nextAllDay}
                />
              </li>
            ))}
          </ul>
        )}
        {!onSale && <p className="tickets-panel__empty">{t('tickets.empty')}</p>}
        <p className="tickets-panel__invite">
          {t('tickets.islandInvite')}{' '}
          <a
            className="sail-link"
            href={island ? ticketsSailHref(island, featured?.id) : SEA_HREF}
            data-track="explore_start"
            data-source="tickets_panel"
            data-testid="tickets-en-barco"
          >
            <span aria-hidden="true">⛵ </span>
            {ACCESS_COPY.sailTickets}
          </a>
        </p>
      </div>
    </section>
  );
}

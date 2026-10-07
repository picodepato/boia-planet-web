import { EVENT_FORMAT_LABELS, seriesLabel } from '@boia/contracts/event-labels';
import Link from 'next/link';
import { EVENTOS_COPY } from '../../../lib/landing/eventos-copy';
import { eventHref, type EventPageView } from '../../../lib/landing/eventos';
import { formatEventDate } from '../../../lib/landing/texts';
import { BuyButton } from './buy-button';
import { PhotoGrid } from './photo-tile';

const EUR = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone }).format(
    new Date(iso),
  );
}

/**
 * Ficha de un evento (`/eventos/<slug>`, REQ-COM-012, REQ-ENT-036): HTML sin
 * motor ni WebGL. Cartel, fecha, lugar, formato, actividades, precio, estado,
 * compra sólo si está a la venta (un finalizado nunca la enseña, REQ-COM-005),
 * recuerdos si ya pasó e «Ir a su isla».
 */
export function EventPageBody({ view }: { view: EventPageView }) {
  const { event } = view;
  const finished = event.state === 'finished';
  const body =
    event.state === 'sold_out' ||
    event.state === 'postponed' ||
    event.state === 'cancelled' ||
    event.state === 'finished'
      ? EVENTOS_COPY.stateBody[event.state]
      : null;
  const format = event.series
    ? `${EVENT_FORMAT_LABELS[event.format]} · ${seriesLabel(event.series)}`
    : EVENT_FORMAT_LABELS[event.format];

  return (
    <article
      className="event-page"
      data-testid="evento-ficha"
      data-evento={event.id}
      data-estado={event.state}
    >
      <div className="event-page__poster">
        {event.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- cartel del Admin, dominio aún sin fijar
          <img src={event.posterUrl} alt={EVENTOS_COPY.posterAlt(event.name)} />
        ) : (
          <div
            className="event-poster"
            role="img"
            aria-label={finished ? EVENTOS_COPY.posterAlt(event.name) : EVENTOS_COPY.posterSoon}
            data-testid="evento-cartel"
          >
            <span className="event-poster__kicker">{view.kicker}</span>
            <span className="event-poster__name">{event.name}</span>
            {finished ? null : (
              <span className="event-poster__soon">{EVENTOS_COPY.posterSoon}</span>
            )}
          </div>
        )}
      </div>

      <div className="event-page__main">
        <p className="event-card__meta">
          <span className="event-card__format">{view.kicker}</span>
          {event.state !== 'on_sale' && (
            <span className={`badge badge--${event.state}`} data-testid="evento-estado">
              {EVENTOS_COPY.state[event.state]}
            </span>
          )}
        </p>
        <h1 id="evento-title" className="section__title event-page__title">
          {event.name}
        </h1>

        {body || event.stateNote ? (
          <div className="event-page__notice" role="status" data-testid="evento-aviso">
            {body ? <p>{body}</p> : null}
            {event.stateNote ? <p>{event.stateNote}</p> : null}
          </div>
        ) : null}

        <dl className="event-page__facts">
          <div>
            <dt>{EVENTOS_COPY.when}</dt>
            <dd>
              <time dateTime={event.startsAt}>
                {formatEventDate(event.startsAt, event.timeZone)} ·{' '}
                {formatTime(event.startsAt, event.timeZone)}
              </time>
            </dd>
          </div>
          <div>
            <dt>{EVENTOS_COPY.where}</dt>
            <dd>{event.placeLabel}</dd>
          </div>
          <div>
            <dt>{EVENTOS_COPY.format}</dt>
            <dd>{format}</dd>
          </div>
          {event.priceCents !== undefined && !finished ? (
            <div>
              <dt>{EVENTOS_COPY.price}</dt>
              <dd data-testid="evento-precio">
                {EUR.format(event.priceCents / 100)}
                {event.priceSample ? ` · ${EVENTOS_COPY.priceSample}` : ''}
              </dd>
            </div>
          ) : null}
        </dl>

        {event.description ? <p className="event-page__desc">{event.description}</p> : null}

        {view.warmup ? (
          <p className="event-card__warmup" data-testid={`calienta-${event.id}`}>
            {view.warmup.next ? (
              <>
                {EVENTOS_COPY.warmup}:{' '}
                <Link href={eventHref(view.warmup.next.slug)} prefetch={false}>
                  {view.warmup.next.name}
                </Link>
              </>
            ) : (
              EVENTOS_COPY.warmupNone
            )}
          </p>
        ) : null}

        <div className="event-page__actions">
          {view.buyable ? (
            <BuyButton
              eventId={event.id}
              eventName={event.name}
              ticketUrl={event.ticketUrl}
              boxOfficeOnly={event.boxOfficeOnly}
              source="event_page"
            />
          ) : event.state === 'coming_soon' ? (
            <p className="event-card__soon">{EVENTOS_COPY.soon}</p>
          ) : null}
          {view.islandHref ? (
            <a
              className="button button--ghost"
              href={view.islandHref}
              data-testid="evento-ir-isla"
              data-track="explore_start"
              data-source="event"
            >
              {EVENTOS_COPY.sailToIsland}
            </a>
          ) : null}
        </div>

        <section className="event-page__block" aria-labelledby="evento-cartel">
          <h2 id="evento-cartel" className="event-page__subtitle">
            {EVENTOS_COPY.lineup}
          </h2>
          <p>{view.lineup.length > 0 ? view.lineup.join(' · ') : EVENTOS_COPY.lineupSoon}</p>
        </section>

        {event.activities.length > 0 ? (
          <section className="event-page__block" aria-labelledby="evento-actividades">
            <h2 id="evento-actividades" className="event-page__subtitle">
              {EVENTOS_COPY.activities}
            </h2>
            <ul className="chip-list">
              {event.activities.map((a) => (
                <li key={a} className="chip">
                  {a}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {finished ? (
          <section
            className="event-page__block"
            aria-labelledby="evento-recuerdos"
            data-testid="evento-recuerdos"
          >
            <h2 id="evento-recuerdos" className="event-page__subtitle">
              {EVENTOS_COPY.memories}
            </h2>
            {view.photos.length > 0 ? (
              <PhotoGrid photos={view.photos.slice(0, 6)} label={EVENTOS_COPY.memories} />
            ) : (
              <p>{EVENTOS_COPY.island.memoriesEmpty}</p>
            )}
          </section>
        ) : null}
        {view.photosHref ? (
          <p>
            <a className="button button--ghost" href={view.photosHref} data-testid="evento-fotos">
              {EVENTOS_COPY.memoriesPhotos}
            </a>
          </p>
        ) : null}

        {!view.buyable && view.upcoming.length > 0 ? (
          <section className="event-page__block" aria-labelledby="evento-proximos">
            <h2 id="evento-proximos" className="event-page__subtitle">
              {EVENTOS_COPY.upcoming}
            </h2>
            <ul className="link-list">
              {view.upcoming.map((e) => (
                <li key={e.id}>
                  <Link href={eventHref(e.slug)} prefetch={false}>
                    {e.name}
                  </Link>{' '}
                  · {formatEventDate(e.startsAt, e.timeZone)}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {event.sample ? <p className="site-footer__small">{EVENTOS_COPY.sampleNotice}</p> : null}
      </div>
    </article>
  );
}

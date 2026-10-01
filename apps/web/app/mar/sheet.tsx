'use client';

import {
  type BoiaEvent,
  EVENT_STATE_BEHAVIOR,
  eventKicker,
  foundDiscountState,
} from '@boia/contracts';
import type { FoundDiscount } from '@boia/store';
import type { WorldConfig, WorldObject } from '@boia/world';
import Link from 'next/link';
import { type CSSProperties, type ReactNode, useState } from 'react';
import { t, formatEventDate } from '../../lib/i18n';
import { EVENTOS_COPY } from '../../lib/landing/eventos-copy';
import { eventHref, photosHref } from '../../lib/landing/eventos';
import { liveContent } from '../../lib/landing/live-content';
import { EventDiscountBanner } from '../../lib/ticketing/discount-banner';
import {
  DiscountCard,
  ISLAND_EXPLORE,
  IslandMemories,
  IslandPhotosLink,
  IslandUpcoming,
} from '../../lib/mundo/place-panels';
import { useRepoData } from '../../lib/mundo/repo';

/**
 * La ficha de abajo del mar 3D: lo que abre un lugar al acercarse (evento,
 * isla, fotos, tienda, WhatsApp) o al tocar su rótulo, el descuento
 * encontrado y «Mis códigos». No tapa el mar: el barco sigue navegando y se
 * cierra sola al alejarse. Mismos datos y mismas piezas que los paneles de
 * /juego (T42, T43, T45): el estado del evento con su aviso, sus recuerdos,
 * «Ver fotos de la isla», «Próximos eventos» con los satélites, el aviso
 * «Tienes un código de descuento para este evento» junto a la compra y cada
 * código con «Ir a la isla». Textos `muestra` [pendiente Álvaro].
 */

export type SheetState =
  | { kind: 'preview'; placeId: string }
  | { kind: 'event'; placeId: string; eventId: string }
  | {
      kind: 'content';
      placeId: string;
      target: 'info' | 'photos' | 'store';
      ref?: string;
      /** Visita posterior a una isla ya descubierta: «Explorar la isla» (REQ-AVE-013). */
      revisit?: boolean;
    }
  | { kind: 'discount'; found: FoundDiscount }
  | { kind: 'codes' };

const block = (type: string) => liveContent().blocks.find((b) => b.type === type);

/** Un evento con su estado de ahora (REQ-COM-004). */
export const findEvent = (id: string | undefined) => liveContent().events.find((e) => e.id === id);

function textOf(o: WorldObject | undefined, key: string): string | undefined {
  const texts = o?.content?.texts as Record<string, string> | undefined;
  return texts?.[key];
}

/** El evento que abre una isla (su comportamiento CONTENIDO o TICKET). */
export function eventOfPlace(o: WorldObject | undefined): string | undefined {
  for (const b of o?.behaviors ?? []) {
    if (b.type === 'ticket') return b.params.eventId;
    if (b.type === 'content' && b.params.target === 'event') return b.params.ref;
  }
  return undefined;
}

/**
 * La isla de un evento en el mapa: la que el evento dice (`islandId`) o, si
 * no, la que lo abre. Sin isla (un satélite), null.
 */
export function islandOfEvent(world: WorldConfig, eventId: string): WorldObject | null {
  const e = findEvent(eventId);
  const byEvent = e?.islandId
    ? world.objects.find((o) => o.identity.id === e.islandId && o.identity.active)
    : undefined;
  return (
    byEvent ?? world.objects.find((o) => o.identity.active && eventOfPlace(o) === eventId) ?? null
  );
}

/**
 * Un viaje en turbo (REQ-ENT-040, T43): a la isla del evento vigente para
 * comprar («Entradas») o a la isla del evento de un código («Ir a la isla»),
 * que al llegar abre su ficha con el aviso del descuento.
 */
export interface EventTrip {
  placeId: string;
  placeName: string;
  eventId: string;
  /** Qué abre al llegar: la compra o la ficha del evento. */
  then?: 'checkout' | 'sheet';
}

/**
 * El evento vigente del mar (REQ-ENT-040): de las islas que abren un evento a
 * la venta (su TICKET o CONTENIDO de evento, ya re-ligado por el Admin), la
 * del evento destacado de la landing y, si no, la del más próximo. Sin
 * ninguno, null (el botón lleva a la sección de entradas de la landing).
 */
export function currentEventTrip(world: WorldConfig): EventTrip | null {
  const pb = block('priority_event');
  const priority = pb?.type === 'priority_event' ? pb.eventId : undefined;
  const trips: Array<EventTrip & { ev: BoiaEvent }> = [];
  for (const o of world.objects) {
    if (!o.identity.active) continue;
    const ev = findEvent(eventOfPlace(o));
    if (!ev || !EVENT_STATE_BEHAVIOR[ev.state].purchasable) continue;
    trips.push({ placeId: o.identity.id, placeName: o.identity.name, eventId: ev.id, ev });
  }
  trips.sort(
    (a, b) =>
      Number(b.ev.id === priority) - Number(a.ev.id === priority) ||
      a.ev.startsAt.localeCompare(b.ev.startsAt),
  );
  const best = trips[0];
  return best ? { placeId: best.placeId, placeName: best.placeName, eventId: best.eventId } : null;
}

export interface SheetProps {
  state: SheetState;
  object: WorldObject | undefined;
  onClose: () => void;
  onCourse: (placeId: string) => void;
  /** Ir en nave (experimento); sin él, sólo se puede navegar. */
  onFly?: (placeId: string) => void;
  onBuy: (eventId: string) => void;
  /** Rumbo a la isla de un evento; false si no tiene. */
  onSteerEvent: (eventId: string) => boolean;
  /** «Ir a la isla» de un código: el barco navega solo hasta ella (T43). */
  onGoToIsland: (eventId: string) => void;
  distance: number | null;
}

export function Sheet({
  state,
  object,
  onClose,
  onCourse,
  onFly,
  onBuy,
  onSteerEvent,
  onGoToIsland,
  distance,
}: SheetProps) {
  const name = object?.identity.name ?? '';
  let body: ReactNode;
  let label = name;
  let estado: string | undefined;

  if (state.kind === 'discount') {
    label = t('discount.found.title');
    body = (
      <>
        <p className="mar-sheet__kicker">{t('mar.sheet.descuentoEncontradoMuestra')}</p>
        <DiscountCard
          found={state.found}
          testId="mar-descuento"
          onGoToIsland={(id) => onGoToIsland(id)}
        />
        <p className="mar-sheet__note">{t('mar.sheet.loTienesGuardadoEn')}</p>
      </>
    );
  } else if (state.kind === 'codes') {
    label = t('menu.discounts');
    body = <MyCodes onGoToIsland={onGoToIsland} />;
  } else if (state.kind === 'event') {
    const e = findEvent(state.eventId);
    estado = e?.state;
    body = e ? <EventBlock event={e} onBuy={onBuy} onSteer={onSteerEvent} /> : null;
  } else if (state.kind === 'preview') {
    const eventId = eventOfPlace(object);
    const e = findEvent(eventId);
    estado = e?.state;
    const island = object?.identity.category === 'isla';
    body = (
      <>
        <p className="mar-sheet__kicker">
          {textOf(object, 'kicker') ?? kickerOf(object)}
          {distance !== null ? t('mar.sheet.m', { distance }) : ''}
          {e ? <StateTag event={e} /> : null}
        </p>
        <h2 className="mar-sheet__title">{e?.name ?? name}</h2>
        {e ? (
          <p className="mar-sheet__meta">
            {formatEventDate(e.startsAt, e.timeZone)} · {e.placeLabel}
          </p>
        ) : null}
        {textOf(object, 'body') ? <p>{textOf(object, 'body')}</p> : null}
        {island ? (
          <p className="juego-panel-links">
            {e ? (
              <Link href={eventHref(e.slug)} prefetch={false} data-testid="mar-evento-ficha">
                {EVENTOS_COPY.details}
              </Link>
            ) : null}
            <IslandPhotosLink islandId={state.placeId} />
          </p>
        ) : null}
        <div className="mar-sheet__actions">
          <button
            type="button"
            className="mar-btn mar-btn--primary"
            data-testid="mar-rumbo"
            onClick={() => onCourse(state.placeId)}
          >
            {onFly ? t('mar.sheet.navegar') : t('mar.sheet.navegarAqui')}
          </button>
          {onFly ? (
            <button
              type="button"
              className="mar-btn mar-btn--primary"
              data-testid="mar-volar"
              onClick={() => onFly(state.placeId)}
            >
              {t('mar.sheet.irEnNave')}
            </button>
          ) : null}
          {e && EVENT_STATE_BEHAVIOR[e.state].purchasable ? (
            <button type="button" className="mar-btn" onClick={() => onBuy(e.id)}>
              {t('mar.sheet.entradas')}
            </button>
          ) : null}
        </div>
      </>
    );
  } else if (state.target === 'photos') {
    const photos = liveContent().photos.slice(0, 6);
    body = (
      <>
        <p className="mar-sheet__kicker">{t('mar.sheet.puertoDeFotosMuestra')}</p>
        <h2 className="mar-sheet__title">{name}</h2>
        <p>{textOf(object, 'body') ?? t('mar.sheet.todasLasFotosDe')}</p>
        <ul className="mar-sheet__photos" aria-label={t('mar.sheet.galeria')}>
          {photos.map((p, i) => (
            <li
              key={p.id}
              role="img"
              aria-label={p.alt}
              title={p.alt}
              style={{ '--i': i } as CSSProperties}
            />
          ))}
        </ul>
        <div className="mar-sheet__actions">
          <Link
            className="mar-btn mar-btn--primary"
            href={photosHref()}
            prefetch={false}
            data-testid="mar-fotos-galeria"
          >
            {t('mar.sheet.verFotosYEventos')}
          </Link>
        </div>
      </>
    );
  } else if (state.target === 'store') {
    const sb = block('store');
    const url = sb?.type === 'store' ? sb.url : undefined;
    const products = sb?.type === 'store' ? sb.products : [];
    body = (
      <>
        <p className="mar-sheet__kicker">{t('mar.sheet.tiendaMuestra')}</p>
        <h2 className="mar-sheet__title">{name}</h2>
        <p>{textOf(object, 'body') ?? t('mar.sheet.camisetasToteBagsY')}</p>
        {products.length ? <p className="mar-sheet__meta">{products.join(' · ')}</p> : null}
        {url ? (
          <div className="mar-sheet__actions">
            <a
              className="mar-btn mar-btn--primary"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('discount.goToStore')}
            </a>
          </div>
        ) : null}
      </>
    );
  } else if (state.ref === 'whatsapp') {
    const cb = block('contact');
    const wa = cb?.type === 'contact' ? cb.links.find((l) => /whatsapp/i.test(l.label)) : undefined;
    body = (
      <>
        <p className="mar-sheet__kicker">{t('mar.sheet.provisionalMuestra')}</p>
        <h2 className="mar-sheet__title">{textOf(object, 'title') ?? name}</h2>
        <p>{textOf(object, 'body') ?? t('mar.sheet.elGrupoDeWhatsapp')}</p>
        {wa ? (
          <div className="mar-sheet__actions">
            <a
              className="mar-btn mar-btn--primary"
              href={wa.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('whatsapp.cta')}
            </a>
          </div>
        ) : null}
      </>
    );
  } else {
    body = (
      <IslandBlock
        key={state.placeId}
        placeId={state.placeId}
        object={object}
        revisit={!!state.revisit}
        onSteer={onSteerEvent}
      />
    );
  }

  return (
    <section
      className="mar-sheet"
      data-testid="mar-ficha"
      data-tipo={state.kind === 'content' ? state.target : state.kind}
      data-lugar={'placeId' in state ? state.placeId : undefined}
      data-estado={estado}
      aria-label={label || t('mar.sheet.ficha')}
    >
      <button
        type="button"
        className="mar-sheet__close"
        onClick={onClose}
        aria-label={t('mar.sheet.cerrar')}
      >
        ×
      </button>
      {body}
    </section>
  );
}

function kickerOf(o: WorldObject | undefined): string {
  switch (o?.identity.category) {
    case 'isla':
      return eventOfPlace(o) ? t('mar.sheet.islaDeEvento') : t('mar.sheet.isla');
    case 'naufrago':
      return t('mar.sheet.encuentro');
    case 'encuentro':
      return t('mar.sheet.mision');
    case 'circuito':
      return t('mar.sheet.circuito');
    case 'boia':
      return t('mar.sheet.boia');
    default:
      return t('mar.sheet.lugar');
  }
}

/** Nombre de un estado sin compra (el «a la venta» no se rotula). */
function StateTag({ event }: { event: BoiaEvent }) {
  if (event.state === 'on_sale') return null;
  return (
    <span className={`juego-estado is-${event.state}`} data-testid="mar-evento-estado">
      {EVENTOS_COPY.state[event.state]}
    </span>
  );
}

/** Aviso del estado en la isla (textos-zonas, zonas 4 y 11), como en /juego. */
function stateNotice(event: BoiaEvent): string | null {
  switch (event.state) {
    case 'sold_out':
      return EVENTOS_COPY.island.soldOut;
    case 'postponed':
    case 'cancelled':
      return EVENTOS_COPY.stateBody[event.state];
    case 'finished':
      return EVENTOS_COPY.island.memory;
    default:
      return null;
  }
}

/**
 * La isla de un evento (T42, T43): su estado con su aviso, el cartel si ya
 * pasó, la ficha y «Ver fotos de la isla», el aviso del código de descuento
 * junto a la compra (sólo a la venta), sus recuerdos y «Próximos eventos».
 */
function EventBlock({
  event: e,
  onBuy,
  onSteer,
}: {
  event: BoiaEvent;
  onBuy: (id: string) => void;
  onSteer: (eventId: string) => boolean;
}) {
  const buy = EVENT_STATE_BEHAVIOR[e.state].purchasable;
  const notice = stateNotice(e);
  return (
    <>
      <p className="mar-sheet__kicker">
        🎤 {eventKicker(e)}
        {e.sample ? t('mar.sheet.muestra') : ''}
        <StateTag event={e} />
      </p>
      <h2 className="mar-sheet__title">{e.name}</h2>
      <p className="mar-sheet__meta">
        {formatEventDate(e.startsAt, e.timeZone)} · {e.placeLabel}
      </p>
      {notice ? (
        <p className="juego-panel-aviso" role="status" data-testid="mar-evento-aviso">
          {notice}
          {e.stateNote ? ` ${e.stateNote}` : ''}
        </p>
      ) : null}
      {e.state === 'finished' ? (
        <p className="juego-cartel-fila">
          {e.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- cartel del Admin, dominio aún sin fijar
            <img className="juego-cartel" src={e.posterUrl} alt={EVENTOS_COPY.posterAlt(e.name)} />
          ) : (
            <span
              className="juego-cartel is-texto"
              role="img"
              aria-label={EVENTOS_COPY.posterAlt(e.name)}
            >
              {e.name}
            </span>
          )}
        </p>
      ) : (
        <p>{e.description}</p>
      )}
      <p className="juego-panel-links">
        <Link href={eventHref(e.slug)} prefetch={false} data-testid="mar-evento-ficha">
          {EVENTOS_COPY.details}
        </Link>
        {e.islandId ? <IslandPhotosLink islandId={e.islandId} /> : null}
      </p>
      {buy ? <EventDiscountBanner event={e} /> : null}
      {buy ? (
        <div className="mar-sheet__actions">
          <button
            type="button"
            className="mar-btn mar-btn--primary mar-btn--big"
            data-testid="mar-comprar"
            aria-haspopup="dialog"
            onClick={() => onBuy(e.id)}
          >
            {t('mar.sheet.comprarEntrada')}
          </button>
        </div>
      ) : null}
      {e.islandId ? <IslandMemories placeId={e.islandId} /> : null}
      <IslandUpcoming islandId={e.islandId} excludeId={e.id} onSteer={onSteer} />
    </>
  );
}

/**
 * Una isla sin evento: su relato, sus recuerdos, «Ver fotos de la isla» y
 * sus «Próximos eventos» (REQ-AVE-014). En una visita posterior empieza
 * recogida, con el acceso directo «Explorar la isla» (REQ-AVE-013).
 */
function IslandBlock({
  placeId,
  object,
  revisit,
  onSteer,
}: {
  placeId: string;
  object: WorldObject | undefined;
  revisit: boolean;
  onSteer: (eventId: string) => boolean;
}) {
  const [explored, setExplored] = useState(!revisit);
  const name = object?.identity.name ?? '';
  const kicker = (
    <p className="mar-sheet__kicker">
      {t('mar.sheet.muestra2', { v1: textOf(object, 'kicker') ?? t('mar.sheet.isla2') })}
    </p>
  );
  if (!explored) {
    return (
      <div data-visita="otra">
        {kicker}
        <h2 className="mar-sheet__title">{name}</h2>
        <div className="mar-sheet__actions">
          <button
            type="button"
            className="mar-btn mar-btn--primary"
            data-testid="isla-explorar"
            onClick={() => setExplored(true)}
          >
            {ISLAND_EXPLORE}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div data-visita={revisit ? 'otra' : 'primera'}>
      {kicker}
      <h2 className="mar-sheet__title">{name}</h2>
      {textOf(object, 'body') ? <p>{textOf(object, 'body')}</p> : null}
      <IslandMemories placeId={placeId} />
      <p className="juego-panel-links">
        <IslandPhotosLink islandId={placeId} />
      </p>
      <IslandUpcoming islandId={placeId} onSteer={onSteer} />
    </div>
  );
}

/** Orden de «Mis códigos»: primero los que valen, luego los usados y al final los caducados. */
const CODE_ORDER = { active: 0, upcoming: 1, used: 2, expired: 3 } as const;

/**
 * «Mis códigos» (T43, REQ-COM-021/022/036) en el mar 3D: los códigos
 * encontrados con su estado, copiar con un toque e «Ir a la isla».
 */
function MyCodes({ onGoToIsland }: { onGoToIsland: (eventId: string) => void }) {
  const { data } = useRepoData((r) => r.progress.discounts());
  return (
    <>
      <p className="mar-sheet__kicker">{t('mar.sheet.misCodigosMuestra')}</p>
      <h2 className="mar-sheet__title">{t('menu.discounts')}</h2>
      {data === undefined ? (
        <p>{t('empty.loading')}</p>
      ) : data.length === 0 ? (
        <p data-testid="mar-codigos-vacio">{t('discount.empty')}</p>
      ) : (
        <ul className="juego-descuentos mar-codes" data-testid="mar-codigos">
          {[...data]
            .sort(
              (a, b) =>
                CODE_ORDER[foundDiscountState(a)] - CODE_ORDER[foundDiscountState(b)] ||
                b.foundAt.localeCompare(a.foundAt),
            )
            .map((f) => (
              <li key={f.discount.id}>
                <DiscountCard
                  found={f}
                  testId={`descuento-${f.discount.id}`}
                  onGoToIsland={onGoToIsland}
                />
              </li>
            ))}
        </ul>
      )}
    </>
  );
}

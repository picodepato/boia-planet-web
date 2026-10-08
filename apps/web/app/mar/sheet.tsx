'use client';

import { emitSignal } from '../../lib/mundo/achievements';
import { gameRepository } from '../../lib/mundo/repo';

import { type BoiaEvent, EVENT_STATE_BEHAVIOR, foundDiscountState } from '@boia/contracts';
import type { FoundDiscount } from '@boia/store';
import { MERCHANDISE_NOTICE, MERCHANDISE_PATH } from '../../lib/merchandise/catalog';
import {
  BOARD_REF,
  CALITAS_REF,
  HARBOR_REF,
  type WorldConfig,
  type WorldObject,
} from '@boia/world';
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
import { CalitasPanel } from '../../lib/mundo/calitas/calitas-panel';
import { MarTablon } from './tablon';

/**
 * La ficha de abajo del mar 3D: lo que abre un lugar al acercarse (evento,
 * isla, fotos, tienda, WhatsApp) o al tocar su rótulo, el descuento
 * encontrado y «Mis códigos». No tapa el mar: el barco sigue navegando y se
 * cierra sola al alejarse. Mismos datos y mismas piezas que los paneles de
 * el 2D (T42, T43, T45): el estado del evento con su aviso, sus recuerdos,
 * «Ver fotos de la isla», «Próximos eventos» con los satélites, el aviso
 * «Tienes un código de descuento para este evento» junto a la compra y cada
 * código con «Ir a la isla». El Puerto de Alicante (T108) es un lugar
 * más, con su ficha al acercarse; su botón abre «Barco» para cambiar de
 * barco, y no anuncia eventos. El faro (plan 014 T157) abre el «Tablón del
 * faro»: sale compacto, con tres botones que abren la ficha de viaje.
 * Textos `muestra` [pendiente Álvaro].
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
 * Un viaje en turbo (REQ-ENT-040, T43): a la isla de un evento para comprar
 * («Ir a su isla» en «Elige tu evento», T58) o a la isla del evento de un
 * código («Ir a la isla»), que al llegar abre su ficha con el aviso del
 * descuento.
 */
export interface EventTrip {
  placeId: string;
  placeName: string;
  eventId: string;
  /** Qué abre al llegar: la compra o la ficha del evento. */
  then?: 'checkout' | 'sheet';
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
  /** «Cambiar de barco» en el puerto (T108): abre la tienda «Barco». */
  onShips?: () => void;
  distance: number | null;
  /** El mundo de ahora, para el «Tablón del faro» (T157). */
  world?: WorldConfig | null;
  /** Abre la misma ficha de destino que al tocar una isla en el minimapa. */
  onPreview: (placeId: string) => void;
}

/** La clave de una ficha: otra ficha (otro lugar u otro tipo) vuelve a abrirse pequeña. */
export function sheetKey(state: SheetState): string {
  switch (state.kind) {
    case 'discount':
      return `discount:${state.found.discount.id}`;
    case 'codes':
      return 'codes';
    case 'event':
      return `event:${state.placeId}:${state.eventId}`;
    case 'preview':
      return `preview:${state.placeId}`;
    default:
      return `${state.target}:${state.placeId}:${state.ref ?? ''}`;
  }
}

/**
 * Lo esencial de una ficha (T53): la tarjeta pequeña de abajo, unos 25 % de
 * la pantalla, con su rótulo, su título, una línea y un solo botón. Tocarla
 * la despliega entera.
 */
interface Compact {
  kicker: ReactNode;
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
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
  onShips,
  distance,
  world = null,
  onPreview,
}: SheetProps) {
  const board = state.kind === 'content' && state.ref === BOARD_REF;
  // Las Calitas (plan 019 T222): la isla de los comentarios.
  const calitas = state.kind === 'content' && state.ref === CALITAS_REF;
  // Las fichas se abren pequeñas; «Mis códigos» se pide desplegada desde el menú.
  const [expanded, setExpanded] = useState(state.kind === 'codes');
  const name = object?.identity.name ?? '';
  let body: ReactNode;
  let compact: Compact;
  let label = name;
  let estado: string | undefined;
  const expand = () => setExpanded(true);

  if (state.kind === 'discount') {
    label = t('discount.found.title');
    const d = state.found.discount;
    const ds = foundDiscountState(state.found);
    const event = d.scope === 'event' ? findEvent(d.eventId) : undefined;
    compact = {
      kicker: t('mar.sheet.descuentoEncontradoMuestra'),
      title: t('discount.found.title'),
      meta: (
        <>
          <code className="mar-sheet__code">{d.code}</code> · {d.label}
        </>
      ),
      action:
        event?.islandId && ds !== 'expired' && ds !== 'used' ? (
          <button
            type="button"
            className="mar-btn mar-btn--primary"
            data-testid="descuento-ir-isla"
            onClick={() => onGoToIsland(event.id)}
          >
            {t('discount.goToIsland')}
          </button>
        ) : undefined,
    };
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
    compact = { kicker: t('mar.sheet.misCodigosMuestra'), title: t('menu.discounts') };
    body = <MyCodes onGoToIsland={onGoToIsland} />;
  } else if (state.kind === 'event') {
    const e = findEvent(state.eventId);
    estado = e?.state;
    const buy = !!e && EVENT_STATE_BEHAVIOR[e.state].purchasable;
    // Las islas de las fiestas (T219, decisión 13): sólo nombre, fecha y lugar.
    compact = {
      kicker: null,
      title: e?.name ?? name,
      meta: e ? <EventWhen event={e} /> : undefined,
      action:
        e && buy ? (
          <button
            type="button"
            className="mar-btn mar-btn--primary"
            data-testid="mar-comprar"
            aria-haspopup="dialog"
            onClick={() => onBuy(e.id)}
          >
            {t('mar.sheet.comprarEntrada')}
          </button>
        ) : undefined,
    };
    body = e ? <EventBlock event={e} onBuy={onBuy} onSteer={onSteerEvent} /> : null;
  } else if (state.kind === 'preview') {
    const eventId = eventOfPlace(object);
    const e = findEvent(eventId);
    estado = e?.state;
    const island = object?.identity.category === 'isla';
    // Una isla de fiesta (T219, decisión 13) no lleva rótulo: nombre, fecha y lugar.
    const kicker = e ? null : (
      <>
        {textOf(object, 'kicker') ?? kickerOf(object)}
        {distance !== null ? t('mar.sheet.m', { distance }) : ''}
      </>
    );
    const course = (
      <button
        type="button"
        className="mar-btn mar-btn--primary"
        data-testid="mar-rumbo"
        onClick={() => onCourse(state.placeId)}
      >
        {onFly ? t('mar.sheet.navegar') : t('mar.sheet.navegarAqui')}
      </button>
    );
    const fly = onFly ? (
      <button
        type="button"
        className="mar-btn mar-btn--primary"
        data-testid="mar-volar"
        onClick={() => onFly(state.placeId)}
      >
        {t('mar.sheet.irEnNave')}
      </button>
    ) : null;
    compact = {
      kicker,
      title: e?.name ?? name,
      meta: e ? <EventWhen event={e} /> : textOf(object, 'body'),
      // Las dos maneras de ir, a la vista sin desplegar la ficha (T96: en el
      // móvil, «Ir en nave» quedaba escondida dentro).
      action: (
        <>
          {course}
          {fly}
        </>
      ),
    };
    body = (
      <>
        {kicker ? <p className="mar-sheet__kicker">{kicker}</p> : null}
        <h2 className="mar-sheet__title">{e?.name ?? name}</h2>
        {e ? (
          <p className="mar-sheet__meta">
            <EventWhen event={e} />
          </p>
        ) : textOf(object, 'body') ? (
          <p>{textOf(object, 'body')}</p>
        ) : null}
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
          {course}
          {fly}
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
    const text = textOf(object, 'body') ?? t('mar.sheet.todasLasFotosDe');
    const gallery = (
      <Link
        className="mar-btn mar-btn--primary"
        href={photosHref()}
        prefetch={false}
        data-testid="mar-fotos-galeria"
      >
        {t('mar.sheet.verFotosYEventos')}
      </Link>
    );
    compact = {
      kicker: t('mar.sheet.puertoDeFotosMuestra'),
      title: name,
      meta: text,
      action: gallery,
    };
    body = (
      <>
        <p className="mar-sheet__kicker">{t('mar.sheet.puertoDeFotosMuestra')}</p>
        <h2 className="mar-sheet__title">{name}</h2>
        <p>{text}</p>
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
        <div className="mar-sheet__actions">{gallery}</div>
      </>
    );
  } else if (state.target === 'store') {
    const sb = block('store');
    const products = sb?.type === 'store' ? sb.products : [];
    // Botiga Ibiza (T219, decisión 13): «Sección de merchandising oficial»;
    // desplegada, además, dónde se vende.
    const text = t('mar.sheet.tienda.seccion');
    const shop = (
      <Link
        className="mar-btn mar-btn--primary"
        href={`${MERCHANDISE_PATH}?from=mar`}
        prefetch={false}
        data-testid="mar-merchandise-open"
      >
        {t('discount.goToStore')}
      </Link>
    );
    compact = { kicker: t('mar.sheet.tiendaMuestra'), title: name, meta: text, action: shop };
    body = (
      <>
        <p className="mar-sheet__kicker">{t('mar.sheet.tiendaMuestra')}</p>
        <h2 className="mar-sheet__title">{name}</h2>
        <p>{text}</p>
        {products.length ? <p className="mar-sheet__meta">{products.join(' · ')}</p> : null}
        <p className="mar-sheet__note">{MERCHANDISE_NOTICE}</p>
        {shop ? <div className="mar-sheet__actions">{shop}</div> : null}
      </>
    );
  } else if (state.ref === 'whatsapp') {
    const cb = block('contact');
    const wa = cb?.type === 'contact' ? cb.links.find((l) => /whatsapp/i.test(l.label)) : undefined;
    const title = textOf(object, 'title') ?? name;
    const text = textOf(object, 'body') ?? t('mar.sheet.elGrupoDeWhatsapp');
    const join = wa ? (
      <a
        className="mar-btn mar-btn--primary"
        href={wa.url}
        data-testid="whatsapp-invitacion"
        onClick={() =>
          void emitSignal(gameRepository(), {
            trigger: 'complete_encounter',
            encounter: 'whatsapp',
          })
        }
        target="_blank"
        rel="noopener noreferrer"
      >
        {t('whatsapp.cta')}
      </a>
    ) : undefined;
    compact = { kicker: t('mar.sheet.provisionalMuestra'), title, meta: text, action: join };
    body = (
      <>
        <p className="mar-sheet__kicker">{t('mar.sheet.provisionalMuestra')}</p>
        <h2 className="mar-sheet__title">{title}</h2>
        <p>{text}</p>
        {join ? <div className="mar-sheet__actions">{join}</div> : null}
      </>
    );
  } else if (calitas) {
    // Recogida: qué es y «Leer y comentar», que la despliega con los comentarios.
    const open = (
      <button
        type="button"
        className="mar-btn mar-btn--primary"
        data-testid="calitas-abrir"
        onClick={expand}
      >
        {t('calitas.open')}
      </button>
    );
    compact = { kicker: t('calitas.kicker'), title: name, meta: t('calitas.intro'), action: open };
    body = (
      <>
        <p className="mar-sheet__kicker">{t('calitas.kicker')}</p>
        <h2 className="mar-sheet__title">{name}</h2>
        <p className="mar-sheet__meta">{t('calitas.intro')}</p>
        <CalitasPanel />
      </>
    );
  } else if (board) {
    // Los mismos destinos tanto en la ficha pequeña como desplegada.
    label = t('mar.tablon.titulo');
    compact = {
      kicker: t('mar.tablon.kicker'),
      title: t('mar.tablon.titulo'),
      meta: t('mar.tablon.intro'),
      action: <MarTablon world={world} expanded={false} onPreview={onPreview} />,
    };
    body = (
      <>
        <p className="mar-sheet__kicker">{t('mar.tablon.kicker')}</p>
        <h2 className="mar-sheet__title">{t('mar.tablon.titulo')}</h2>
        <p className="mar-sheet__meta">{t('mar.tablon.intro')}</p>
        <MarTablon world={world} expanded onPreview={onPreview} />
      </>
    );
  } else {
    // El puerto (T108): su botón abre «Barco»; nunca se abre solo al llegar.
    const harbor = state.ref === HARBOR_REF;
    const ships =
      harbor && onShips ? (
        <button
          type="button"
          className="mar-btn mar-btn--primary"
          data-testid="puerto-barcos"
          aria-haspopup="dialog"
          onClick={onShips}
        >
          {t('mar.sheet.puerto.cambiarBarco')}
        </button>
      ) : null;
    // Otra visita a una isla ya descubierta: pequeña, con «Explorar la isla» (REQ-AVE-013).
    const explore = state.revisit ? (
      <button
        type="button"
        className={ships ? 'mar-btn' : 'mar-btn mar-btn--primary'}
        data-testid="isla-explorar"
        onClick={expand}
      >
        {ISLAND_EXPLORE}
      </button>
    ) : null;
    compact = {
      kicker: harbor ? harborKicker(object) : islandKicker(object),
      title: name,
      meta: textOf(object, 'body'),
      action:
        ships || explore ? (
          <>
            {ships}
            {explore}
          </>
        ) : undefined,
    };
    body = (
      <IslandBlock
        placeId={state.placeId}
        object={object}
        revisit={!!state.revisit}
        onSteer={onSteerEvent}
        harbor={harbor}
        actions={ships}
      />
    );
  }

  const more = expanded ? t('mar.sheet.verMenos') : t('mar.sheet.verMas');
  return (
    <section
      className={`mar-sheet ${expanded ? 'is-expanded' : 'is-compact'}${board ? ' is-tablon' : ''}`}
      data-testid="mar-ficha"
      data-tipo={state.kind === 'content' ? state.target : state.kind}
      data-lugar={'placeId' in state ? state.placeId : undefined}
      data-estado={estado}
      data-expandida={expanded ? 'si' : 'no'}
      aria-label={label || t('mar.sheet.ficha')}
      onClick={
        expanded
          ? undefined
          : (ev) => {
              // Tocar la tarjeta la despliega; sus botones y enlaces hacen lo suyo.
              if (!(ev.target as Element).closest('a, button')) expand();
            }
      }
    >
      <div className="mar-sheet__tools">
        <button
          type="button"
          className="mar-sheet__more"
          data-testid="mar-ficha-mas"
          aria-expanded={expanded}
          aria-label={more}
          title={more}
          onClick={() => setExpanded((x) => !x)}
        >
          <span aria-hidden="true">›</span>
        </button>
        <button
          type="button"
          className="mar-sheet__close"
          onClick={onClose}
          aria-label={t('mar.sheet.cerrar')}
        >
          ×
        </button>
      </div>
      {expanded ? (
        body
      ) : (
        <>
          {compact.kicker ? <p className="mar-sheet__kicker">{compact.kicker}</p> : null}
          <h2 className="mar-sheet__title">{compact.title}</h2>
          {compact.meta ? <p className="mar-sheet__meta mar-sheet__clamp">{compact.meta}</p> : null}
          {compact.action ? <div className="mar-sheet__actions">{compact.action}</div> : null}
        </>
      )}
    </section>
  );
}

function islandKicker(object: WorldObject | undefined): string {
  return t('mar.sheet.muestra2', { v1: textOf(object, 'kicker') ?? t('mar.sheet.isla2') });
}

function harborKicker(object: WorldObject | undefined): string {
  return t('mar.sheet.puerto.kicker', {
    v1: textOf(object, 'kicker') ?? t('mar.sheet.puerto.nombre'),
  });
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
export function StateTag({ event }: { event: BoiaEvent }) {
  if (event.state === 'on_sale') return null;
  return (
    <span className={`juego-estado is-${event.state}`} data-testid="mar-evento-estado">
      {EVENTOS_COPY.state[event.state]}
    </span>
  );
}

/**
 * Fecha y lugar de una fiesta (T219, decisión 13: su isla sólo enseña nombre,
 * fecha y lugar), con su estado si no está a la venta.
 */
function EventWhen({ event: e }: { event: BoiaEvent }) {
  return (
    <>
      {formatEventDate(e.startsAt, e.timeZone)} · {e.placeLabel}
      <StateTag event={e} />
    </>
  );
}

/** Aviso del estado en la isla (textos-zonas, zonas 4 y 11), como en el 2D. */
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
export function EventBlock({
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
      <h2 className="mar-sheet__title">{e.name}</h2>
      <p className="mar-sheet__meta">
        <EventWhen event={e} />
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
      ) : null}
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
 * Una isla sin evento, desplegada: su relato, sus recuerdos, «Ver fotos de la
 * isla» y sus «Próximos eventos» (REQ-AVE-014). En una visita posterior la
 * tarjeta pequeña ofrece el acceso directo «Explorar la isla» (REQ-AVE-013).
 * El puerto (T108) lleva su botón «Cambiar de barco» y no anuncia eventos.
 */
export function IslandBlock({
  placeId,
  object,
  revisit,
  onSteer,
  harbor = false,
  actions = null,
}: {
  placeId: string;
  object: WorldObject | undefined;
  revisit: boolean;
  onSteer: (eventId: string) => boolean;
  harbor?: boolean;
  actions?: ReactNode;
}) {
  const name = object?.identity.name ?? '';
  return (
    <div data-visita={revisit ? 'otra' : 'primera'} data-puerto={harbor ? 'si' : undefined}>
      <p className="mar-sheet__kicker">{harbor ? harborKicker(object) : islandKicker(object)}</p>
      <h2 className="mar-sheet__title">{name}</h2>
      {textOf(object, 'body') ? <p>{textOf(object, 'body')}</p> : null}
      {actions ? <div className="mar-sheet__actions">{actions}</div> : null}
      <IslandMemories placeId={placeId} />
      <p className="juego-panel-links">
        <IslandPhotosLink islandId={placeId} />
      </p>
      {harbor ? null : <IslandUpcoming islandId={placeId} onSteer={onSteer} />}
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

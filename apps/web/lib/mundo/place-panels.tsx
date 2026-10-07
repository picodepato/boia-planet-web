'use client';

import { emitSignal } from './achievements';
import { gameRepository } from './repo';

import {
  type BoiaEvent,
  type FoundDiscountState,
  eventKicker,
  foundDiscountState,
  isIslandlessSatellite,
  islandUpcomingEvents,
  nextAllDay,
  upcomingEvents as listedUpcoming,
} from '@boia/contracts';
import type { FoundDiscount } from '@boia/store';
import type { WorldObject } from '@boia/world';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { type IslandMemory, islandMemoryGalleries } from '../admin/world';
import { EVENTOS_COPY } from '../landing/eventos-copy';
import { eventHref, galleryAnchor, photosHref } from '../landing/eventos';
import { liveContent } from '../landing/live-content';
import { PhotoImage } from '../photo-image';
import { voyageHref } from './autopilot';
import './place-panels.css';
import { t as msg } from '../i18n';

/**
 * Paneles de los lugares que no son de evento (T20): la isla con su relato y
 * sus Próximos eventos (REQ-AVE-014), el Puerto de Fotos con la galería
 * (REQ-AVE-022), la tienda con su enlace externo (REQ-COM-033), la boia de
 * WhatsApp (REQ-AVE-023) y el descuento encontrado (REQ-COM-021/022). No
 * son modales: el barco sigue navegando y se cierran al alejarse. Textos
 * `muestra` [pendiente Álvaro].
 */

export type PlaceTarget = 'info' | 'photos' | 'store';

export interface PlacePanelState {
  objectId: string;
  target: PlaceTarget;
  ref?: string;
  /**
   * Visita posterior a una isla ya descubierta: el panel se abre recogido,
   * con el acceso directo «Explorar la isla» (REQ-AVE-013).
   */
  revisit?: boolean;
}

/** «Explorar la isla» (textos-zonas, zona 11). muestra */
export const ISLAND_EXPLORE = msg('island.explore');

/** Bloques de la home con los cambios del Admin de la demo (T26). */
const block = (type: string) => liveContent().blocks.find((b) => b.type === type);

function formatDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone,
  }).format(new Date(iso));
}

/**
 * Próximos eventos de una isla (REQ-AVE-014, REQ-COM-005): primero los suyos
 * y, si es la localización común, los satélites sin isla (O7); después, hasta
 * `limit`, los demás próximos por fecha. `excludeId`: el que la isla ya
 * enseña arriba. Con su estado de ahora (REQ-COM-004).
 */
export function upcomingEvents(islandId?: string, limit = 4, excludeId?: string): BoiaEvent[] {
  const now = new Date();
  const events = liveContent(now).events;
  const own = islandId ? islandUpcomingEvents(islandId, events, now, excludeId) : [];
  const ids = new Set([...own.map((e) => e.id), excludeId]);
  const rest = listedUpcoming(events, now).filter((e) => !ids.has(e.id));
  return [...own, ...rest].slice(0, Math.max(limit, own.length));
}

function textOf(o: WorldObject | undefined, key: string): string | undefined {
  const texts = o?.content?.texts as Record<string, string> | undefined;
  return texts?.[key];
}

function Close({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      className="juego-panel-close"
      onClick={onClose}
      aria-label={msg('juego.placePanels.cerrar')}
    >
      ×
    </button>
  );
}

/** Nombre de un estado sin compra, para la lista (el «a la venta» no se rotula). */
function StateTag({ event }: { event: BoiaEvent }) {
  if (event.state === 'on_sale') return null;
  return (
    <span className={`juego-estado is-${event.state}`} data-testid="estado-evento">
      {EVENTOS_COPY.state[event.state]}
    </span>
  );
}

/**
 * «Próximos eventos» de una isla (REQ-AVE-014), con la línea «Calienta para
 * el próximo All Day» de los satélites sin isla (REQ-COM-010, O7). Cada
 * evento enlaza a su ficha; los que tienen isla, además, ponen rumbo a ella.
 */
export function IslandUpcoming({
  islandId,
  excludeId,
  onSteer,
}: {
  islandId?: string | undefined;
  excludeId?: string | undefined;
  onSteer?: ((eventId: string) => boolean) | undefined;
}) {
  const events = upcomingEvents(islandId, 4, excludeId);
  if (events.length === 0) return null;
  const now = new Date();
  const next = nextAllDay(liveContent(now).events, now);
  return (
    <div className="juego-panel-block" data-testid="panel-proximos">
      <h3>{EVENTOS_COPY.island.upcomingHeading}</h3>
      <ul>
        {events.map((e) => (
          <li key={e.id} data-evento={e.id}>
            <Link href={eventHref(e.slug)} prefetch={false}>
              <strong>{e.name}</strong>
            </Link>{' '}
            · {formatDate(e.startsAt, e.timeZone)}
            {e.series ? ` · ${eventKicker(e)}` : ''}
            {e.sample ? msg('juego.placePanels.muestra') : ''} <StateTag event={e} />
            {isIslandlessSatellite(e) ? (
              <span className="juego-panel-warmup" data-testid={`calienta-${e.id}`}>
                {next ? (
                  <>
                    {EVENTOS_COPY.warmup}:{' '}
                    <Link href={eventHref(next.slug)} prefetch={false}>
                      {next.name}
                    </Link>
                  </>
                ) : (
                  EVENTOS_COPY.warmupNone
                )}
              </span>
            ) : onSteer && e.islandId && e.islandId !== islandId ? (
              <>
                {' '}
                <button type="button" className="juego-link-button" onClick={() => onSteer(e.id)}>
                  {EVENTOS_COPY.island.steer}
                </button>
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** «Ver fotos de la isla» (D-23, punto 7): «Fotos y eventos» en la galería de esta isla. */
export function IslandPhotosLink({ islandId }: { islandId: string }) {
  return (
    <a
      className="juego-panel-link"
      href={photosHref(galleryAnchor({ islandId, slug: islandId }))}
      data-testid="ver-fotos-isla"
    >
      {EVENTOS_COPY.island.photosCta}
    </a>
  );
}

/** Cartel de un evento: la imagen o un cartel de texto con su nombre. */
function Poster({ event }: { event: BoiaEvent }) {
  if (event.posterUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- cartel del Admin, dominio aún sin fijar
      <img
        className="juego-cartel"
        src={event.posterUrl}
        alt={EVENTOS_COPY.posterAlt(event.name)}
      />
    );
  }
  return (
    <span
      className="juego-cartel is-texto"
      role="img"
      aria-label={EVENTOS_COPY.posterAlt(event.name)}
    >
      {event.name}
    </span>
  );
}

/** Fotos que se ven en cada recuerdo; el resto, en «Fotos y eventos». */
const MEMORY_PHOTOS = 6;

/** La galería de un recuerdo (T189): sus fotos y, si hay más, el enlace a todas. */
function MemoryGallery({ memory }: { memory: IslandMemory }) {
  const { event, photos } = memory;
  if (photos.length === 0) return null;
  return (
    <div className="juego-recuerdo-galeria">
      <ul
        className="juego-recuerdo-fotos"
        aria-label={msg('juego.placePanels.fotosDelRecuerdo', { name: event.name })}
        data-testid={`recuerdo-fotos-${event.id}`}
      >
        {photos.slice(0, MEMORY_PHOTOS).map((p) => (
          <li key={p.id} data-foto={p.id}>
            {p.src ? (
              <PhotoImage photo={p} className="juego-recuerdo-foto" />
            ) : (
              <span className="juego-recuerdo-foto is-muestra" role="img" aria-label={p.alt}>
                📷
              </span>
            )}
          </li>
        ))}
      </ul>
      {photos.length > MEMORY_PHOTOS && event.islandId ? (
        <a
          className="juego-panel-link"
          href={photosHref(galleryAnchor({ islandId: event.islandId, slug: event.slug }))}
        >
          {msg('juego.placePanels.masFotos', { n: photos.length })}
        </a>
      ) : null}
    </div>
  );
}

/**
 * Los eventos que ya pasaron por esta isla, con su cartel y sus fotos: la
 * isla se queda con ellos (T26, REQ-COM-002, REQ-COM-005; galería, T189).
 */
export function IslandMemories({ placeId }: { placeId: string }) {
  const memories = islandMemoryGalleries(placeId, liveContent(), new Date());
  if (memories.length === 0) {
    return <p className="juego-panel-pending">{EVENTOS_COPY.island.memoriesEmpty}</p>;
  }
  return (
    <div className="juego-panel-block" data-testid="panel-recuerdos">
      <h3>{EVENTOS_COPY.island.memoriesHeading}</h3>
      <ul className="juego-recuerdos">
        {memories.map((m) => {
          const e = m.event;
          return (
            <li key={e.id} data-evento={e.id} data-estado={e.state}>
              <Poster event={e} />
              <span>
                <Link href={eventHref(e.slug)} prefetch={false}>
                  <strong>{e.name}</strong>
                </Link>{' '}
                · {formatDate(e.startsAt, e.timeZone)} <StateTag event={e} />
              </span>
              <MemoryGallery memory={m} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function PlacePanel({
  state,
  object,
  onClose,
  onSteer,
}: {
  state: PlacePanelState;
  object: WorldObject | undefined;
  onClose: () => void;
  /** Pone la brújula rumbo a la isla de un evento (false si no tiene isla). */
  onSteer: (eventId: string) => boolean;
}) {
  const name = object?.identity.name ?? '';
  // En una visita posterior, la isla empieza recogida hasta «Explorar la isla».
  const [explored, setExplored] = useState(!state.revisit);
  if (state.target === 'photos') {
    const photos = liveContent().photos.slice(0, 6);
    return (
      <section className="juego-panel" data-testid="panel-fotos" aria-label={name}>
        <Close onClose={onClose} />
        <p className="juego-panel-kicker">{msg('juego.placePanels.puertoDeFotosMuestra')}</p>
        <h2>{name}</h2>
        <p>{textOf(object, 'body') ?? msg('juego.placePanels.todasLasFotosDe')}</p>
        <ul className="juego-panel-photos" aria-label={msg('juego.placePanels.galeria')}>
          {photos.map((p) => (
            <li key={p.id} role="img" aria-label={p.alt} title={p.alt}>
              📷
            </li>
          ))}
        </ul>
        <Link
          className="juego-panel-cta"
          href={photosHref()}
          prefetch={false}
          data-testid="panel-fotos-galeria"
        >
          {msg('juego.placePanels.verFotosYEventos')}
        </Link>
      </section>
    );
  }
  if (state.target === 'store') {
    const storeBlock = block('store');
    const url = storeBlock?.type === 'store' ? storeBlock.url : undefined;
    const products = storeBlock?.type === 'store' ? storeBlock.products : [];
    return (
      <section className="juego-panel" data-testid="panel-tienda" aria-label={name}>
        <Close onClose={onClose} />
        <p className="juego-panel-kicker">{msg('juego.placePanels.tiendaMuestra')}</p>
        <h2>{name}</h2>
        <p>{textOf(object, 'body') ?? msg('juego.placePanels.camisetasToteBagsY')}</p>
        {products.length ? <p className="juego-panel-meta">{products.join(' · ')}</p> : null}
        {url ? (
          <a
            className="juego-panel-cta"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="panel-tienda-enlace"
          >
            {msg('discount.goToStore')}
          </a>
        ) : null}
      </section>
    );
  }
  if (state.ref === 'whatsapp') {
    const contactBlock = block('contact');
    const wa =
      contactBlock?.type === 'contact'
        ? contactBlock.links.find((l) => /whatsapp/i.test(l.label))
        : undefined;
    return (
      <section className="juego-panel" data-testid="panel-whatsapp" aria-label={name}>
        <Close onClose={onClose} />
        <p className="juego-panel-kicker">{msg('juego.placePanels.provisionalMuestra')}</p>
        <h2>{textOf(object, 'title') ?? name}</h2>
        <p>{textOf(object, 'body') ?? msg('juego.placePanels.elGrupoDeWhatsapp')}</p>
        {wa ? (
          <a
            className="juego-panel-cta"
            href={wa.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              void emitSignal(gameRepository(), {
                trigger: 'complete_encounter',
                encounter: 'whatsapp',
              })
            }
          >
            {msg('whatsapp.cta')}
          </a>
        ) : null}
      </section>
    );
  }
  // Otra visita: sólo el nombre y el acceso directo a «Explorar la isla» (REQ-AVE-013).
  if (!explored) {
    return (
      <section
        className="juego-panel"
        data-testid="panel-isla"
        data-visita="otra"
        aria-label={name}
      >
        <Close onClose={onClose} />
        <p className="juego-panel-kicker">
          {msg('juego.placePanels.muestra2', {
            v1: textOf(object, 'kicker') ?? msg('juego.placePanels.isla'),
          })}
        </p>
        <h2>{name}</h2>
        <button
          type="button"
          className="juego-panel-cta"
          data-testid="isla-explorar"
          onClick={() => setExplored(true)}
        >
          {ISLAND_EXPLORE}
        </button>
      </section>
    );
  }
  // Una isla: su relato, sus recuerdos y los Próximos eventos (REQ-AVE-014).
  return (
    <section
      className="juego-panel"
      data-testid="panel-isla"
      data-visita={state.revisit ? 'otra' : 'primera'}
      aria-label={name}
    >
      <Close onClose={onClose} />
      <p className="juego-panel-kicker">
        {msg('juego.placePanels.muestra2', {
          v1: textOf(object, 'kicker') ?? msg('juego.placePanels.isla'),
        })}
      </p>
      <h2>{name}</h2>
      {textOf(object, 'body') ? <p>{textOf(object, 'body')}</p> : null}
      <IslandMemories placeId={state.objectId} />
      <IslandPhotosLink islandId={state.objectId} />
      <IslandUpcoming islandId={state.objectId} onSteer={onSteer} />
    </section>
  );
}

/** Estado de un código en «Mis códigos» (T43): activo, usado o caducado. */
export const DISCOUNT_STATE_LABEL: Record<FoundDiscountState, string> = {
  active: msg('juego.placePanels.activo'),
  used: msg('juego.placePanels.usado'),
  upcoming: msg('discount.state.pending'),
  expired: msg('discount.state.expired'),
};

/** Copia un texto con un toque; `true` si pudo. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** URL de la tienda externa (bloque «Tienda» de la home, con los cambios del Admin). */
function storeUrl(): string | undefined {
  const b = block('store');
  return b?.type === 'store' ? b.url : undefined;
}

/**
 * Una tarjeta de descuento (REQ-COM-022, REQ-COM-036): código con su estado,
 * evento, fecha, condiciones, copiar con un toque y a dónde lleva. Uno de
 * entradas con isla lleva «Ir a la isla» (el barco navega solo si
 * `onGoToIsland`; si no, abre el mar rumbo a esa isla); sin isla, a la ficha del
 * evento; uno de tienda (O8), «Ir a la tienda» (externa, la valida ella).
 */
export function DiscountCard({
  found,
  testId,
  onGoToIsland,
}: {
  found: FoundDiscount;
  testId?: string;
  /** El barco pone rumbo solo a la isla del evento del código (T43). */
  onGoToIsland?: ((eventId: string) => void) | undefined;
}) {
  const d = found.discount;
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(t);
  }, [copied]);
  const state = foundDiscountState(found);
  const event =
    d.scope === 'event' && d.eventId
      ? liveContent().events.find((e) => e.id === d.eventId)
      : undefined;
  const expired = state === 'expired';
  const shop = d.scope === 'store' ? (d.url ?? storeUrl()) : undefined;
  return (
    <div
      className="juego-descuento"
      data-testid={testId}
      data-status={found.status}
      data-estado={state}
    >
      <p className="juego-descuento-label">{d.label}</p>
      <p className="juego-descuento-code">
        <code data-testid="descuento-codigo">{d.code}</code>{' '}
        <span className={`juego-descuento-status is-${state}`} data-testid="descuento-estado">
          {DISCOUNT_STATE_LABEL[state]}
        </span>
      </p>
      {event ? (
        <p className="juego-panel-meta">
          {event.name} · {formatDate(event.startsAt, event.timeZone)}
        </p>
      ) : d.scope === 'store' ? (
        <p className="juego-panel-meta">{msg('juego.placePanels.tiendaDeBoia')}</p>
      ) : null}
      {d.endsAt ? (
        <p className="juego-panel-pending">
          {msg('juego.placePanels.el', {
            v1: expired ? msg('juego.placePanels.caduco') : msg('juego.placePanels.valeHasta'),
            formatDate: formatDate(d.endsAt, 'Europe/Madrid'),
          })}
        </p>
      ) : null}
      {found.usedAt ? (
        <p className="juego-panel-pending">
          {msg('juego.placePanels.usadoEnTuCompra', {
            formatDate: formatDate(found.usedAt, 'Europe/Madrid'),
          })}
        </p>
      ) : null}
      {d.conditions ? <p className="juego-panel-pending">{d.conditions}</p> : null}
      <div className="juego-descuento-acciones">
        <button
          type="button"
          className="juego-panel-cta"
          data-testid="descuento-copiar"
          disabled={expired}
          onClick={() => void copyText(d.code).then((ok) => setCopied(ok ? 'ok' : 'fail'))}
        >
          {expired
            ? msg('juego.placePanels.caducadoYaNoVale')
            : copied === 'ok'
              ? msg('discount.copied')
              : copied === 'fail'
                ? msg('discount.copyManual', { code: d.code })
                : msg('discount.copy')}
        </button>
        {expired || state === 'used' ? null : shop ? (
          <a
            className="juego-panel-cta is-secundario"
            href={shop}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="descuento-ir-tienda"
          >
            {msg('discount.goToStore')}
          </a>
        ) : event?.islandId ? (
          onGoToIsland ? (
            <button
              type="button"
              className="juego-panel-cta is-secundario"
              data-testid="descuento-ir-isla"
              onClick={() => onGoToIsland(event.id)}
            >
              {msg('discount.goToIsland')}
            </button>
          ) : (
            <a
              className="juego-panel-cta is-secundario"
              href={voyageHref(event.id)}
              data-testid="descuento-ir-isla"
            >
              {msg('discount.goToIsland')}
            </a>
          )
        ) : event ? (
          <Link
            className="juego-panel-cta is-secundario"
            href={eventHref(event.slug)}
            prefetch={false}
            data-testid="descuento-ver-evento"
          >
            {msg('juego.placePanels.verElEvento')}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function DiscountPanel({
  found,
  onClose,
  onGoToIsland,
}: {
  found: FoundDiscount;
  onClose: () => void;
  onGoToIsland?: ((eventId: string) => void) | undefined;
}) {
  return (
    <section
      className="juego-panel"
      data-testid="panel-descuento"
      aria-label={msg('discount.found.title')}
    >
      <Close onClose={onClose} />
      <p className="juego-panel-kicker">{msg('juego.placePanels.descuentoEncontradoMuestra')}</p>
      <DiscountCard found={found} onGoToIsland={onGoToIsland} />
      <p className="juego-panel-pending">{msg('juego.placePanels.loTienesGuardadoEn')}</p>
    </section>
  );
}

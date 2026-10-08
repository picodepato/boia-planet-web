'use client';

import type { BoiaEvent } from '@boia/contracts';
import type { BoiaRepository } from '@boia/store';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { gameRepository } from '../repo';
import './checkout.css';
import { CHECKOUT_COPY } from './copy';
import { type DiscountBannerInfo, discountBannerFor, formatEuros } from './pricing';

/**
 * «Tienes un código de descuento para este evento» (D-23, puntos 5 y 6;
 * REQ-COM-036): el código y lo que se ahorra, bien visible donde se compra
 * (la isla del evento y el checkout, que es también el de su ficha). Sólo
 * sale si el visitante tiene un código que la compra de prueba aplicaría.
 */
export function DiscountBanner({ info }: { info: DiscountBannerInfo }) {
  return (
    <div
      className="discount-banner"
      role="status"
      data-testid="banner-descuento"
      data-discount-id={info.discountId}
      data-kind="code"
    >
      <p className="discount-banner__title">
        <span aria-hidden="true">🏷️ </span>
        {CHECKOUT_COPY.banner.title}
      </p>
      <p className="discount-banner__code">
        <code data-testid="banner-descuento-codigo">{info.code}</code>{' '}
        <span data-testid="banner-descuento-ahorro">
          {CHECKOUT_COPY.banner.saving(formatEuros(info.savingCents))}
        </span>
      </p>
      <p className="discount-banner__note">
        {info.label} · {CHECKOUT_COPY.banner.applied}
      </p>
    </div>
  );
}

const noop = () => () => {};

/**
 * El aviso de un evento con los códigos de este navegador; vuelve a mirar
 * con cada cambio del repositorio (un código recién encontrado o ya usado).
 */
export function useDiscountBanner(
  event: Pick<BoiaEvent, 'id' | 'priceCents'> | null,
): DiscountBannerInfo | null {
  const [repo, setRepo] = useState<BoiaRepository | null>(null);
  useEffect(() => setRepo(gameRepository()), []);
  const revision = useSyncExternalStore(
    repo ? repo.subscribe : noop,
    repo ? repo.revision : () => -1,
    () => -1,
  );
  const [info, setInfo] = useState<DiscountBannerInfo | null>(null);
  const eventId = event?.id ?? null;
  const price = event?.priceCents;
  useEffect(() => {
    if (!repo || !eventId) return;
    let alive = true;
    // El código encontrado que la compra aplicaría (el Carnet ya no descuenta).
    repo.progress.discounts().then(
      (found) => {
        if (!alive) return;
        setInfo(discountBannerFor({ id: eventId, priceCents: price }, found, new Date()));
      },
      (err: unknown) => console.warn('[boia] no se pudieron leer los descuentos', err),
    );
    return () => {
      alive = false;
    };
  }, [repo, revision, eventId, price]);
  return eventId ? info : null;
}

/** El aviso de un evento, si toca. */
export function EventDiscountBanner({
  event,
}: {
  event: Pick<BoiaEvent, 'id' | 'priceCents'> | null;
}) {
  const info = useDiscountBanner(event);
  return info ? <DiscountBanner info={info} /> : null;
}

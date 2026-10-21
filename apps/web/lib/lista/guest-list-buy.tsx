'use client';

import { type ComponentType, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GuestListDialog } from './guest-list-dialog';
import { type ListEvent, listDoorPrice, listNotice, tlb } from './model';

/**
 * «Apuntarse en la lista» (plan 034 T309) en la landing (la tarjeta del
 * evento y el panel de Tickets) y en la ficha `/eventos/<slug>`, en vez de
 * «Comprar entrada». Debajo, el precio en la puerta («5 € con carnet en
 * puerta») y el aviso de la hora («La lista vale hasta las 22:30; después,
 * por orden de llegada», con la hora de cierre del contenido; el diálogo
 * enseña la del estado vivo). El diálogo se carga al pulsar, fuera de la
 * ruta crítica de la landing. Sin JavaScript el botón queda desactivado.
 */
export function GuestListBuy({ event }: { event: ListEvent }) {
  const [Dialog, setDialog] = useState<ComponentType<Parameters<typeof GuestListDialog>[0]> | null>(
    null,
  );
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const door = listDoorPrice(event);
  const notice = listNotice(event.guestList?.closesAt, event.timeZone);

  const onClick = () => {
    if (Dialog) return setOpen(true);
    import('./guest-list-dialog')
      .then((m) => {
        setDialog(() => m.GuestListDialog);
        setOpen(true);
      })
      .catch((err: unknown) => {
        // El botón sigue ahí: otro toque lo vuelve a intentar.
        console.warn('[boia] no se pudo cargar la lista', err);
      });
  };

  return (
    <>
      <button
        type="button"
        className="button button--buy"
        data-testid={`lista-${event.id}`}
        disabled={!hydrated}
        onClick={onClick}
      >
        {tlb('lista.join')}
      </button>
      {/* Una sola nota, sin testid: la landing va justa de presupuesto (T14). */}
      {door || notice ? (
        <p className="event-card__note">
          {door ? <strong>{door}</strong> : null}
          {door && notice ? <br /> : null}
          {notice}
        </p>
      ) : null}
      {open && Dialog
        ? createPortal(<Dialog event={event} onClose={() => setOpen(false)} />, document.body)
        : null}
    </>
  );
}

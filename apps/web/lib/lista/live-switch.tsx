'use client';

import type { ReactNode } from 'react';
import type { ListEvent } from './model';
import { useLiveList } from './use-live-list';

/**
 * Lo de la ficha que depende de si la fiesta va en lista (plan 034 T311): con
 * cuentas lo dice el Admin (`useLiveList`); antes, y en la demo, el contenido.
 */
interface LiveProps {
  eventId: string;
  /** `listEventOf(event)` si el contenido la pone en lista. */
  content: ListEvent | undefined;
  children: ReactNode;
}

/** `children` sólo si la fiesta va (`listed`) o no va en lista. */
export function WhenListed({ listed, ...props }: LiveProps & { listed: boolean }) {
  const list = useLiveList(props.eventId, props.content);
  return !!list === listed ? props.children : null;
}

/**
 * La caja del botón de la ficha: en lista, con el precio y la hora debajo
 * (`evento-lista`); si no, no cambia nada (`display: contents`). Siempre la
 * misma caja, para que el botón no se vuelva a montar al saber lo del Admin.
 */
export function ListBox(props: LiveProps) {
  const list = useLiveList(props.eventId, props.content);
  return list ? (
    <div className="event-page__list" data-testid="evento-lista">
      {props.children}
    </div>
  ) : (
    <div style={{ display: 'contents' }}>{props.children}</div>
  );
}

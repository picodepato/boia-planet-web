'use client';

import { useEffect, useState } from 'react';
import type { ListEvent } from './model';

// Lo ya sabido en esta página: lo que se monta después empieza con ello.
const known = new Map<string, ListEvent | null | undefined>();

/**
 * ¿Va `eventId` en lista? (plan 034 T311). Primero lo del contenido
 * (`content`, `listEventOf(event)` si va en lista); tras hidratar, con
 * cuentas, lo que diga el Admin (`./live`, un trozo perezoso: la landing va
 * justa de presupuesto). Con `onOpen`, se llama una vez si se vuelve del
 * alta del Carnet con `?abrir=<id>` (con true si va en lista).
 */
export function useLiveList(
  eventId: string,
  content: ListEvent | undefined,
  onOpen?: (list: boolean) => void,
): ListEvent | undefined {
  const [live, setLive] = useState(() => known.get(eventId));
  useEffect(() => {
    import('./live')
      .then((m) => m.liveList(eventId, !!onOpen))
      .then((r) => {
        known.set(eventId, r.list);
        setLive(r.list);
        if (r.open) onOpen!(r.list === undefined ? !!content : !!r.list);
      }, console.warn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);
  return live === undefined ? content : live || undefined;
}

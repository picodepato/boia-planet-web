'use client';

import { useEffect, useState } from 'react';
import { CarnetInvite } from '../../../lib/mundo/carnet/carnet-invite';
import { CARNET_CREATE_HREF } from '../../../lib/landing/access';
import { browserInvitations } from '../../../lib/landing/invitations';
import { gameRepository } from '../../../lib/repo';

/**
 * Después de una compra de prueba en la landing, la invitación a crear el
 * Carnet (REQ-IDE-008, T44), si toca: sin Carnet, una por sesión y nunca si
 * ya dijo «Ahora no» a ésta. Se carga con la compra, fuera de la ruta crítica.
 */
export function PurchaseInvite({ onDone }: { onDone: () => void }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let alive = true;
    gameRepository()
      .carnet.mine()
      .then((carnet) => {
        if (!alive) return;
        const ok = browserInvitations().offer('purchase', {
          hasCarnet: carnet !== null,
          blocked: false,
        });
        if (ok) setShow(true);
        else onDone();
      })
      .catch(() => alive && onDone());
    return () => {
      alive = false;
    };
    // Una vez por compra: `onDone` sólo cierra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!show) return null;
  return (
    <CarnetInvite
      reason="purchase"
      className="carnet-invite--landing"
      create={{ href: CARNET_CREATE_HREF }}
      onLater={() => {
        browserInvitations().decline('purchase');
        onDone();
      }}
    />
  );
}

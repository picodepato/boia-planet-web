'use client';

import { useEffect, useState } from 'react';
import { t } from '../i18n';
import { cancelRequest, myRequest } from './artist-request';
import { accountClient } from './session';
import { useAccount } from './use-account';

/**
 * En el Carnet propio (plan 031 T297): la solicitud para reclamar una ficha,
 * mientras BOIA la revisa: «Solicitud enviada: BOIA la revisará» y «Retirar
 * solicitud». Sin solicitud pendiente (o sin cuentas) no pinta nada.
 */

export type RequestStatusView =
  { kind: 'pending'; name: string; busy: boolean; error: boolean } | { kind: 'cancelled' };

/** La vista, sin efectos (se prueba sola). */
export function ArtistRequestStatusView({
  view,
  onCancel,
}: {
  view: RequestStatusView;
  onCancel?: () => void;
}) {
  if (view.kind === 'cancelled') {
    return (
      <p className="carnet-notice" role="status" data-testid="carnet-solicitud-retirada">
        {t('carnet.request.cancelled')}
      </p>
    );
  }
  return (
    <div className="carnet-notice" data-testid="carnet-solicitud" data-estado="pending">
      <p data-testid="carnet-solicitud-texto">{t('carnet.request.sent', { name: view.name })}</p>
      <button
        type="button"
        className="idc-btn"
        disabled={view.busy}
        data-testid="carnet-solicitud-retirar"
        onClick={onCancel}
      >
        {t('carnet.request.cancel')}
      </button>
      {view.error ? (
        <p role="alert" data-testid="carnet-solicitud-error">
          {t('carnet.request.cancelError')}
        </p>
      ) : null}
    </div>
  );
}

export function ArtistRequestStatus() {
  const account = useAccount();
  const isArtist = account.status === 'member' && account.profile?.isArtist === true;
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    if (!isArtist) return;
    let alive = true;
    void (async () => {
      const sb = await accountClient();
      if (!sb) return;
      const req = await myRequest(sb);
      if (alive) setName(req ? req.profile_name : null);
    })();
    return () => {
      alive = false;
    };
  }, [isArtist, account.userId]);

  if (cancelled) return <ArtistRequestStatusView view={{ kind: 'cancelled' }} />;
  if (!isArtist || name === null) return null;
  const onCancel = () => {
    setBusy(true);
    setError(false);
    void (async () => {
      const sb = await accountClient();
      const done = sb ? await cancelRequest(sb) : false;
      setBusy(false);
      if (done) {
        setCancelled(true);
        setName(null);
      } else setError(true);
    })();
  };
  return (
    <ArtistRequestStatusView view={{ kind: 'pending', name, busy, error }} onCancel={onCancel} />
  );
}

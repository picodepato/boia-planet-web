'use client';

import Link from 'next/link';
import { MAR_CARNET_HREF, MAR_PATH } from '../../lib/world-handoff';
import '../../lib/mundo/hud.css';
import '../../lib/mundo/carnet/carnet.css';
import { AccountSection } from '../../lib/account/account-section';
import { useAccount } from '../../lib/account/use-account';
import { t } from '../../lib/i18n';
import { CarnetCard } from '../../lib/mundo/carnet/carnet-card';
import { CarnetReport } from '../../lib/mundo/carnet/carnet-report';
import { LOCAL_ONLY_NOTICE } from '../../lib/mundo/carnet/carnet-editor';
import { OwnCarnet } from '../../lib/mundo/carnet/own-carnet';
import { INVITE_COPY } from '../../lib/landing/invitations';
import { useCarnet } from '../../lib/mundo/carnet/use-carnet';

/**
 * El Carnet a pantalla completa (REQ-IDE-010, REQ-IDE-017): el propio en
 * /carnet y el de cualquiera en /carnet/<id>, con la tarjeta ID-1 como objeto
 * iluminado sobre la noche de la landing (plan 008, T91; T87, marco 05).
 *
 * - Modo local (D-20): se abren el propio y los de muestra, y se dice que
 *   todo se guarda en este navegador.
 * - Con cuentas: el Carnet público de cualquier miembro se lee del servidor
 *   (apodo, rango, sellos; nunca el email), y el propio trae «Escanear sello».
 */
export function CarnetPage({ userId }: { userId: string | null }) {
  const { data } = useCarnet(userId);
  const account = useAccount();
  const local = account.status === 'local';
  return (
    <main className="carnet-page" data-testid="carnet-pagina">
      <header className="carnet-page-head">
        <Link href="/" className="carnet-page-wm" aria-label="BOIA.PLANET" />
        <Link href={MAR_PATH} className="carnet-page-back">
          {t('carnet.page.back')}
        </Link>
      </header>
      <div className="carnet-page-inner">
        {data === undefined ? (
          <p>{t('carnet.page.loading')}</p>
        ) : data.carnet ? (
          <>
            {data.carnet.isMine ? (
              <div className="carnet-page-own">
                <OwnCarnet
                  carnet={data.carnet}
                  extras={data.extras}
                  editHref={MAR_CARNET_HREF}
                  dark
                />
              </div>
            ) : (
              <CarnetCard carnet={data.carnet} extras={data.extras} dark />
            )}
            {local ? (
              <p className="carnet-page-note" data-testid="carnet-aviso-local">
                {LOCAL_ONLY_NOTICE}
              </p>
            ) : null}
            {data.carnet.isMine ? (
              // Con cuentas (plan 008, T89): cerrar sesión y borrar la cuenta.
              <div className="carnet-page-cuenta">
                <AccountSection />
              </div>
            ) : (
              // REQ-ADM-040 (O9): el Carnet público de otra persona se puede reportar.
              <div className="carnet-page-cuenta">
                <CarnetReport carnet={data.carnet} />
              </div>
            )}
          </>
        ) : userId ? (
          <>
            <h1>{t('carnet.notFound.title')}</h1>
            <p>{local ? t('carnet.notFound.body') : t('carnet.page.notFoundOnline')}</p>
          </>
        ) : (
          <>
            <h1>{t('carnet.page.noneTitle')}</h1>
            <p>{t('carnet.page.noneBody')}</p>
            <Link className="idc-btn" href={MAR_CARNET_HREF}>
              {t('carnet.create')}
            </Link>
            {/* REQ-IDE-007 (T44): los límites del progreso local, antes de registrarse. */}
            <p className="carnet-page-note" data-testid="aviso-progreso-local">
              {INVITE_COPY.localLimit}
            </p>
          </>
        )}
      </div>
    </main>
  );
}

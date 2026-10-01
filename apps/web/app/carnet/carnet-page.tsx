'use client';

import Link from 'next/link';
import '../../lib/mundo/hud.css';
import '../../lib/mundo/carnet/carnet.css';
import { CarnetCard } from '../../lib/mundo/carnet/carnet-card';
import { CarnetReport } from '../../lib/mundo/carnet/carnet-report';
import { LOCAL_ONLY_NOTICE } from '../../lib/mundo/carnet/carnet-editor';
import { INVITE_COPY } from '../../lib/landing/invitations';
import { useCarnet } from '../../lib/mundo/carnet/use-carnet';

/**
 * El Carnet a pantalla completa (REQ-IDE-010, REQ-IDE-017): el propio en
 * /carnet y el de cualquiera en /carnet/<id>. Será la vista para compartir
 * cuando haya servidor; en la versión de prueba nada se comparte
 * (REQ-IDE-051, D-20): aquí se abren el propio y los de muestra, y se dice
 * que todo se guarda en este navegador.
 */
export function CarnetPage({ userId }: { userId: string | null }) {
  const { data } = useCarnet(userId);
  return (
    <main className="carnet-page" data-testid="carnet-pagina">
      <div className="carnet-page-inner">
        <p className="carnet-page-nav">
          <Link href="/juego">← Volver al mar</Link>
        </p>
        {data === undefined ? (
          <p>Cargando…</p>
        ) : data.carnet ? (
          <>
            <CarnetCard carnet={data.carnet} extras={data.extras} />
            <p className="juego-muted" data-testid="carnet-aviso-local">
              {LOCAL_ONLY_NOTICE}
            </p>
            {data.carnet.isMine ? (
              <div className="carnet-actions">
                <Link className="juego-button" href="/juego?menu=carnet">
                  Editar mi Carnet
                </Link>
              </div>
            ) : (
              // REQ-ADM-040 (O9): el Carnet público de otra persona se puede reportar.
              <CarnetReport carnet={data.carnet} />
            )}
          </>
        ) : userId ? (
          <>
            <h1>Carnet no encontrado</h1>
            <p>
              En esta versión de prueba cada Carnet se guarda en el navegador de quien lo crea, así
              que este enlace sólo se abre allí.
            </p>
          </>
        ) : (
          <>
            <h1>Aún no tienes Carnet</h1>
            <p>
              Tu Carnet BOIA es tu identidad musical en el mar. Se crea en un momento, sin email.
            </p>
            <Link className="juego-button" href="/juego?menu=carnet">
              Crear mi Carnet
            </Link>
            {/* REQ-IDE-007 (T44): los límites del progreso local, antes de registrarse. */}
            <p className="juego-muted" data-testid="aviso-progreso-local">
              {INVITE_COPY.localLimit}
            </p>
          </>
        )}
      </div>
    </main>
  );
}

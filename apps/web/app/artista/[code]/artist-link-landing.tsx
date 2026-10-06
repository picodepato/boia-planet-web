'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import '../../../lib/mundo/hud.css';
import '../../../lib/mundo/carnet/carnet.css';
import { rememberArtistCode } from '../../../lib/account/artist-link';
import { t } from '../../../lib/i18n';
import { MAR_CARNET_HREF } from '../../../lib/world-handoff';

/**
 * Lo que se ve un instante al abrir el enlace de artistas: guarda el código
 * en la pestaña y pasa al alta del Carnet en el mar. Un código con forma
 * rara no se guarda y se dice.
 */
export function ArtistLinkLanding({ code }: { code: string }) {
  const router = useRouter();
  const [bad, setBad] = useState(false);
  useEffect(() => {
    if (rememberArtistCode(code)) router.replace(MAR_CARNET_HREF);
    else setBad(true);
  }, [code, router]);
  return (
    <main className="carnet-page" data-testid="enlace-artista">
      <div className="carnet-page-inner">
        <p>{bad ? t('carnet.artistLink.bad') : t('carnet.artistLink.opening')}</p>
        <Link className="idc-btn" href={MAR_CARNET_HREF}>
          {t('carnet.artistLink.go')}
        </Link>
      </div>
    </main>
  );
}

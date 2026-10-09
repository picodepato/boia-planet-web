'use client';

import type { CarnetMember } from '@boia/store';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { t } from '../../i18n';
import { discoverPool, discoverRandom, pickDiscover } from '../discover';
import { useRepoData } from '../repo';
import { carnetPath } from './share';

/**
 * Los «Descubre» bajo las respuestas de un Carnet (plan 023 T251), con el
 * mismo azar y el mismo botón que «Descubrir a un BOIERO» del ranking:
 *
 * - «Descubre otro miembro BOIA»: cualquier Carnet (miembro o artista), nunca
 *   el que se está viendo (en el propio, nunca el tuyo).
 * - En el de un artista, además «Descubre un artista»: otro artista, nunca este.
 *
 * Abre el Carnet que sale en /carnet/<id>. Si no queda ninguno que pueda
 * salir, lo dice («Aún no hay Carnets que descubrir.»).
 */
export function CarnetDiscover({ selfId, artist }: { selfId: string; artist: boolean }) {
  const router = useRouter();
  const { data: members } = useRepoData((r) => r.carnet.members());
  const [empty, setEmpty] = useState(false);
  const exclude = [selfId];
  const open = (kind?: CarnetMember['kind']) => {
    const next = pickDiscover(members ?? [], discoverRandom, { exclude, kind });
    if (!next) {
      setEmpty(true);
      return;
    }
    router.push(carnetPath(next.userId));
  };
  const noneLeft = !!members && discoverPool(members, { exclude }).length === 0;
  return (
    <div className="carnet-descubre" data-testid="carnet-descubre">
      <div className="carnet-descubre-botones">
        {artist ? (
          <button
            type="button"
            className="juego-button"
            data-testid="carnet-descubre-artista"
            disabled={!members}
            onClick={() => open('artist')}
          >
            {t('lib.carnet.descubreArtista')}
          </button>
        ) : null}
        <button
          type="button"
          className="juego-button"
          data-testid="carnet-descubre-miembro"
          disabled={!members}
          onClick={() => open()}
        >
          {t('lib.carnet.descubreMiembro')}
        </button>
      </div>
      {empty || noneLeft ? (
        <p className="juego-muted" role="status" data-testid="carnet-descubre-vacio">
          {t('lib.ranking.descubrirVacio')}
        </p>
      ) : null}
    </div>
  );
}

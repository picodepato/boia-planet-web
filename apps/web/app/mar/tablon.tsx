'use client';

import { circuitFromWorld, readRecord } from '@boia/engine/circuit';
import { CIRCUIT_ID, type WorldConfig } from '@boia/world';
import { useEffect, useMemo, useState } from 'react';
import {
  BOARD_CARDS,
  type BoardCardId,
  type BoardMedal,
  boardDestinations,
  canonBoardMedal,
  raceBoardMedal,
} from '../../lib/mundo/board';
import { browserCanonStorage } from '../../lib/mundo/ranking-canon';
import { useRepoData } from '../../lib/mundo/repo';
import { type MessageKey, t } from '../../lib/i18n';

/**
 * El «Tablón del faro» (plan 014 T157) dentro de la ficha del faro: tres
 * tarjetas (Cañón, Castillo, Carrera) con su línea, la mejor medalla del
 * jugador si la tiene (el Castillo, ninguna hasta T162) y «Rumbo a…», que
 * marca el destino en el mar y en el minimapa como el «!» de ayuda; navegar
 * sigue siendo cosa de quien juega. Botones de verdad: teclado y toque.
 */

const ICON: Record<BoardCardId, string> = { canon: '💣', castillo: '🏰', carrera: '🏁' };

const TITLE: Record<BoardCardId, MessageKey> = {
  canon: 'mar.tablon.canon.titulo',
  castillo: 'mar.tablon.castillo.titulo',
  carrera: 'mar.tablon.carrera.titulo',
};
const LINE: Record<BoardCardId, MessageKey> = {
  canon: 'mar.tablon.canon.linea',
  castillo: 'mar.tablon.castillo.linea',
  carrera: 'mar.tablon.carrera.linea',
};
const MEDAL: Record<BoardMedal, MessageKey> = {
  oro: 'mar.tablon.medalla.oro',
  plata: 'mar.tablon.medalla.plata',
  bronce: 'mar.tablon.medalla.bronce',
};

export function MarTablon({
  world,
  marked,
  onMark,
}: {
  world: WorldConfig | null;
  /** El lugar marcado ahora (el destino del objetivo), o null. */
  marked: string | null;
  onMark: (placeId: string) => void;
}) {
  const destinations = useMemo(() => boardDestinations(world?.objects ?? []), [world]);
  const spec = useMemo(() => (world ? circuitFromWorld(world, CIRCUIT_ID) : null), [world]);
  // La medalla del Cañón vive en este navegador (su ranking local); se lee al montar.
  const [canon, setCanon] = useState<BoardMedal | null>(null);
  useEffect(() => setCanon(canonBoardMedal(browserCanonStorage())), []);
  const { data: record } = useRepoData(
    (r) => (spec ? readRecord(r.progress, spec) : Promise.resolve(null)),
    [spec?.id, spec?.version],
  );
  const medals: Record<BoardCardId, BoardMedal | null> = {
    canon,
    // Hasta que T162 guarde sus medallas, el Castillo no tiene ninguna.
    castillo: null,
    carrera: spec ? raceBoardMedal(record?.bestMs, spec.medals) : null,
  };
  const nameOf = (id: string) =>
    world?.objects.find((o) => o.identity.id === id)?.identity.name ?? id;

  return (
    <ul className="mar-tablon" data-testid="tablon" aria-label={t('mar.tablon.titulo')}>
      {BOARD_CARDS.map((card) => {
        const place = destinations[card];
        const medal = medals[card];
        const on = !!place && marked === place;
        return (
          <li
            key={card}
            className={`mar-tablon__card is-${card}${on ? ' is-marcado' : ''}`}
            data-testid={`tablon-${card}`}
            data-destino={place ?? undefined}
            data-medalla={medal ?? undefined}
          >
            <span className="mar-tablon__icon" aria-hidden="true">
              {ICON[card]}
            </span>
            <div className="mar-tablon__text">
              <h3 className="mar-tablon__title">{t(TITLE[card])}</h3>
              <p className="mar-tablon__line">{t(LINE[card])}</p>
              {medal ? (
                <p className="mar-tablon__medal" data-testid={`tablon-medalla-${card}`}>
                  {t('mar.tablon.medalla', { medal: t(MEDAL[medal]) })}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              className={`mar-btn mar-tablon__go${on ? '' : ' mar-btn--primary'}`}
              data-testid={`tablon-rumbo-${card}`}
              aria-pressed={on}
              disabled={!place}
              onClick={() => place && onMark(place)}
            >
              {on ? t('mar.tablon.marcado') : t('mar.tablon.rumbo', { place: nameOf(place ?? '') })}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

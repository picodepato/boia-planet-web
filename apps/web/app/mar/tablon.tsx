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
import { castleBestMedal, readCastleMedals } from '../../lib/mundo/castle-medals';
import { browserCanonStorage } from '../../lib/mundo/ranking-canon';
import { useRepoData } from '../../lib/mundo/repo';
import { type MessageKey, t } from '../../lib/i18n';
import { MenuIcon, type MenuIconName } from '../../lib/mundo/menu/icons';

/**
 * El tablón compacto ofrece tres destinos; desplegado cuenta cada juego y
 * muestra su mejor medalla. Abre la misma ficha de viaje que el minimapa.
 */

const ICON: Record<BoardCardId, MenuIconName> = {
  canon: 'controles',
  castillo: 'logros',
  carrera: 'ranking',
};

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
  expanded,
  onPreview,
}: {
  world: WorldConfig | null;
  expanded: boolean;
  onPreview: (placeId: string) => void;
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
  // Las del castillo (T162) viven en el progreso (local o de la cuenta).
  const { data: castleMedals } = useRepoData((r) => readCastleMedals(r.progress));
  const medals: Record<BoardCardId, BoardMedal | null> = {
    canon,
    castillo: castleMedals ? castleBestMedal(castleMedals) : null,
    carrera: spec ? raceBoardMedal(record?.bestMs, spec.medals) : null,
  };
  return (
    <ul
      className={`mar-tablon${expanded ? '' : ' is-compact'}`}
      data-testid="tablon"
      aria-label={t('mar.tablon.titulo')}
    >
      {BOARD_CARDS.map((card) => {
        const place = destinations[card];
        const medal = medals[card];
        return (
          <li
            key={card}
            className={`mar-tablon__card is-${card}`}
            data-testid={`tablon-${card}`}
            data-destino={place ?? undefined}
            data-medalla={expanded ? (medal ?? undefined) : undefined}
          >
            {expanded ? (
              <div className="mar-tablon__text">
                <p className="mar-tablon__line">{t(LINE[card])}</p>
                {medal ? (
                  <p className="mar-tablon__medal" data-testid={`tablon-medalla-${card}`}>
                    {t('mar.tablon.medalla', { medal: t(MEDAL[medal]) })}
                  </p>
                ) : null}
              </div>
            ) : null}
            <button
              type="button"
              className="mar-btn mar-btn--primary mar-tablon__go"
              data-testid={`tablon-ir-${card}`}
              disabled={!place}
              onClick={() => place && onPreview(place)}
            >
              <MenuIcon name={ICON[card]} />
              {t(TITLE[card])}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

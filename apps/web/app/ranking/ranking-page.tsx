'use client';

import Link from 'next/link';
import '../../lib/mundo/hud.css';
import '../../lib/mundo/carnet/carnet.css';
import { t } from '../../lib/i18n';
import { worlds } from '../../lib/mundo/demo-world';
import { RankingPanel } from '../../lib/mundo/menu/sections/ranking';
import { MAR_PATH } from '../../lib/world-handoff';
import './ranking-page.css';

/**
 * El ranking del menú de la web (plan 017 T188, decisión 2): el mismo panel
 * que el menú de /mar, con sus cuatro tablas (carrera, Cañón, Castillo y
 * puntos), sobre la noche de la página del Carnet. Cada fila abre su Carnet.
 */
export function RankingPage() {
  return (
    <main className="carnet-page ranking-page" data-testid="ranking-pagina">
      <header className="carnet-page-head">
        <Link href="/" className="carnet-page-wm" aria-label="BOIA.PLANET" />
        <Link href={MAR_PATH} className="carnet-page-back">
          {t('carnet.page.back')}
        </Link>
      </header>
      <div className="carnet-page-inner">
        <h1>{t('juego.ranking.ranking')}</h1>
        <div className="ranking-page-card">
          <RankingPanel season={worlds.defaultId} />
        </div>
      </div>
    </main>
  );
}

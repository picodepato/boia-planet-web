'use client';

import type { RankingRow } from '@boia/store';
import Link from 'next/link';
import { useState } from 'react';
import { carnetPath } from '../../carnet/share';
import { useRepoData } from '../../repo';
import type { MenuContext, MenuSection } from '../types';
import './ranking.css';
import { t } from '../../../i18n';

/**
 * Textos del ranking (docs/propuestas/textos-zonas.md, zona 25). muestra
 * hasta que pasen a las claves de i18n (T49).
 */
export const RANKING_COPY = {
  heading: t('juego.ranking.ranking'),
  localLabel: t('ranking.localLabel'),
  localNotice: t('ranking.localNotice'),
  allTime: t('ranking.tab.allTime'),
  season: (world: string) => t('ranking.tab.season', { world }),
  position: t('juego.ranking.puesto'),
  member: t('juego.ranking.miembro'),
  points: t('juego.ranking.puntos'),
  you: t('juego.ranking.tu'),
  yourPosition: (n: number, points: number) => t('ranking.yourPosition', { n, points }),
  pointsNote: t('ranking.pointsNote'),
  sampleTag: 'muestra',
  openCarnet: (name: string) => t('ranking.openCarnet.aria', { name }),
} as const;

type Scope = 'all' | 'season';

function rowName(r: RankingRow): string {
  if (r.isMine) return r.nickname ? `${r.nickname} (${RANKING_COPY.you})` : RANKING_COPY.you;
  return r.nickname ?? r.userId;
}

/** Cada fila abre su Carnet; la propia sin Carnet, la invitación a crearlo. */
function rowHref(r: RankingRow): string {
  return r.isMine && !r.hasCarnet ? '/carnet' : carnetPath(r.userId);
}

/**
 * 🏆 Ranking local (REQ-IDE-053, D-23 punto 8): los puntos de este navegador
 * junto a los miembros de muestra, de siempre y de la temporada (el mundo que
 * se juega), con el puesto propio destacado. Rotulado como local: nunca se
 * presenta como compartido ni validado (REQ-IDE-038 es el de la versión
 * final). Cada fila abre su Carnet (REQ-IDE-017).
 */
function Ranking({ ctx }: { ctx: MenuContext }) {
  const [scope, setScope] = useState<Scope>('all');
  const season = ctx.world.current;
  const worldName = ctx.world.worlds.find((w) => w.id === season)?.name ?? season;
  const { data } = useRepoData(
    (r) => r.progress.ranking(scope === 'season' ? { season } : {}),
    [scope, season],
  );
  return (
    <div className="juego-ranking" data-testid="ranking">
      <p className="juego-ranking-rotulo" data-testid="ranking-rotulo">
        {RANKING_COPY.localLabel}
      </p>
      <p className="juego-muted">{RANKING_COPY.localNotice}</p>
      <div
        className="juego-ranking-tabs"
        role="group"
        aria-label={t('juego.ranking.queRankingVer')}
      >
        {(
          [
            ['all', RANKING_COPY.allTime],
            ['season', RANKING_COPY.season(worldName)],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className="juego-ranking-tab"
            aria-pressed={scope === id}
            data-testid={`ranking-tab-${id === 'all' ? 'siempre' : 'temporada'}`}
            onClick={() => setScope(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {!data || data.scope !== scope ? (
        <p className="juego-muted">{t('empty.loading')}</p>
      ) : (
        <>
          <p className="juego-ranking-mio" data-testid="ranking-mi-puesto">
            {RANKING_COPY.yourPosition(data.mine.position, data.mine.points)}
          </p>
          <table className="juego-ranking-tabla" data-testid="ranking-lista">
            <thead>
              <tr>
                <th scope="col">{RANKING_COPY.position}</th>
                <th scope="col">{RANKING_COPY.member}</th>
                <th scope="col">{RANKING_COPY.points}</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr
                  key={r.userId || 'yo'}
                  className={r.isMine ? 'is-mine' : undefined}
                  aria-current={r.isMine ? 'true' : undefined}
                  data-testid={r.isMine ? 'ranking-fila-mia' : `ranking-fila-${r.userId}`}
                  data-puesto={r.position}
                >
                  <td className="juego-ranking-puesto">{r.position}.º</td>
                  <td>
                    <Link
                      href={rowHref(r)}
                      prefetch={false}
                      aria-label={RANKING_COPY.openCarnet(rowName(r))}
                    >
                      {rowName(r)}
                    </Link>
                    {r.isSample ? (
                      <span className="juego-ranking-muestra"> {RANKING_COPY.sampleTag}</span>
                    ) : null}
                  </td>
                  <td className="juego-ranking-puntos">{r.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="juego-muted">{RANKING_COPY.pointsNote}</p>
        </>
      )}
    </div>
  );
}

export const rankingSection: MenuSection = {
  id: 'ranking',
  icon: '🏆',
  label: RANKING_COPY.heading,
  group: 'progress',
  Component: Ranking,
};

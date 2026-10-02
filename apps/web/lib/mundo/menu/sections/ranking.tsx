'use client';

import { circuitFromWorld, formatRaceTime, readRecord } from '@boia/engine/circuit';
import type { RankingRow } from '@boia/store';
import { CIRCUIT_ID, type WorldConfig } from '@boia/world';
import Link from 'next/link';
import { useState } from 'react';
import { CarnetCard } from '../../carnet/carnet-card';
import '../../carnet/carnet.css';
import { carnetPath } from '../../carnet/share';
import { useCarnet } from '../../carnet/use-carnet';
import { worlds } from '../../demo-world';
import { discoverRandom, pickMember } from '../../discover';
import { type CircuitRow, circuitName, circuitRanking } from '../../ranking-circuit';
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
  circuit: t('ranking.tab.circuit'),
  time: t('lib.ranking.tiempo'),
  noTime: t('lib.ranking.sinVuelta'),
  circuitEmpty: (place: string) => t('ranking.circuit.empty', { place }),
  circuitMine: (place: string, time: string, n: number) =>
    t('lib.ranking.tuVuelta', { place, time, n }),
  circuitNote: t('circuit.localRecord'),
  position: t('juego.ranking.puesto'),
  member: t('juego.ranking.miembro'),
  points: t('juego.ranking.puntos'),
  you: t('juego.ranking.tu'),
  yourPosition: (n: number, points: number) => t('ranking.yourPosition', { n, points }),
  pointsNote: t('ranking.pointsNote'),
  sampleTag: 'muestra',
  openCarnet: (name: string) => t('ranking.openCarnet.aria', { name }),
  discover: t('lib.ranking.descubrir'),
  discoverAgain: t('lib.ranking.descubrirOtro'),
  discoverNote: t('lib.ranking.descubrirNota'),
  discoverEmpty: t('lib.ranking.descubrirVacio'),
  discoveredMember: t('lib.ranking.descubiertoMiembro'),
  discoveredArtist: t('lib.ranking.descubiertoArtista'),
  seeCarnet: t('lib.ranking.verSuCarnet'),
} as const;

type Scope = 'all' | 'season' | 'circuit';

const TAB_TEST_ID: Record<Scope, string> = {
  all: 'ranking-tab-siempre',
  season: 'ranking-tab-temporada',
  circuit: 'ranking-tab-circuito',
};

function rowName(r: Pick<RankingRow, 'isMine' | 'nickname' | 'userId'>): string {
  if (r.isMine) return r.nickname ? `${r.nickname} (${RANKING_COPY.you})` : RANKING_COPY.you;
  return r.nickname ?? r.userId;
}

/** Cada fila abre su Carnet; la propia sin Carnet, la invitación a crearlo. */
function rowHref(r: Pick<RankingRow, 'isMine' | 'hasCarnet' | 'userId'>): string {
  return r.isMine && !r.hasCarnet ? '/carnet' : carnetPath(r.userId);
}

/**
 * El nombre de la fila, que abre su Carnet (REQ-IDE-017). Con `onOwnCarnet`
 * (el mar 3D, T56), la fila propia abre «Mi Carnet» dentro del mundo.
 */
function RowLink({
  row,
  onOwnCarnet,
}: {
  row: Pick<RankingRow, 'isMine' | 'hasCarnet' | 'userId' | 'nickname'>;
  onOwnCarnet: (() => void) | undefined;
}) {
  return (
    <Link
      href={rowHref(row)}
      prefetch={false}
      aria-label={RANKING_COPY.openCarnet(rowName(row))}
      onClick={(e) => {
        if (!row.isMine || !onOwnCarnet) return;
        e.preventDefault();
        onOwnCarnet();
      }}
    >
      {rowName(row)}
    </Link>
  );
}

/** El mundo de una temporada (su id), o null si no está en el registro. */
function seasonWorld(season: string): WorldConfig | null {
  try {
    return worlds.get(season).config;
  } catch {
    return null;
  }
}

/** El récord del circuito de este navegador entre los tiempos de muestra (T56). */
function CircuitTable({
  season,
  onOwnCarnet,
}: {
  season: string;
  onOwnCarnet: (() => void) | undefined;
}) {
  const world = seasonWorld(season) ?? worlds.get(worlds.defaultId).config;
  const place = circuitName(world) ?? RANKING_COPY.circuit;
  const spec = circuitFromWorld(world, CIRCUIT_ID);
  const { data } = useRepoData(
    async (r) => {
      const [carnet, record] = await Promise.all([
        r.carnet.mine(),
        spec ? readRecord(r.progress, spec) : Promise.resolve(null),
      ]);
      return circuitRanking({
        nickname: carnet?.nickname ?? null,
        hasCarnet: !!carnet,
        bestMs: record?.bestMs ?? null,
        ...(carnet ? { userId: carnet.userId } : {}),
      });
    },
    [season],
  );
  if (!data) return <p className="juego-muted">{t('empty.loading')}</p>;
  const mine = data.mine;
  return (
    <>
      <p className="juego-ranking-mio" data-testid="ranking-mi-puesto">
        {mine.ms !== null && mine.position !== null
          ? RANKING_COPY.circuitMine(place, formatRaceTime(mine.ms), mine.position)
          : RANKING_COPY.circuitEmpty(place)}
      </p>
      <table className="juego-ranking-tabla" data-testid="ranking-lista" data-scope="circuit">
        <thead>
          <tr>
            <th scope="col">{RANKING_COPY.position}</th>
            <th scope="col">{RANKING_COPY.member}</th>
            <th scope="col">{RANKING_COPY.time}</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r: CircuitRow) => (
            <tr
              key={r.isMine ? 'yo' : r.userId}
              className={r.isMine ? 'is-mine' : undefined}
              aria-current={r.isMine ? 'true' : undefined}
              data-testid={r.isMine ? 'ranking-fila-mia' : `ranking-fila-${r.userId}`}
              data-puesto={r.position ?? undefined}
            >
              <td className="juego-ranking-puesto">
                {r.position !== null ? `${r.position}.º` : '–'}
              </td>
              <td>
                <RowLink row={r} onOwnCarnet={onOwnCarnet} />
                {r.isSample ? (
                  <span className="juego-ranking-muestra"> {RANKING_COPY.sampleTag}</span>
                ) : null}
              </td>
              <td className="juego-ranking-puntos">
                {r.ms !== null ? formatRaceTime(r.ms) : RANKING_COPY.noTime}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="juego-muted">{RANKING_COPY.circuitNote}</p>
    </>
  );
}

/** Los puntos de siempre o de la temporada (el mundo que se juega). */
function PointsTable({
  scope,
  season,
  onOwnCarnet,
}: {
  scope: 'all' | 'season';
  season: string;
  onOwnCarnet: (() => void) | undefined;
}) {
  const { data } = useRepoData(
    (r) => r.progress.ranking(scope === 'season' ? { season } : {}),
    [scope, season],
  );
  if (!data || data.scope !== scope) return <p className="juego-muted">{t('empty.loading')}</p>;
  return (
    <>
      <p className="juego-ranking-mio" data-testid="ranking-mi-puesto">
        {RANKING_COPY.yourPosition(data.mine.position, data.mine.points)}
      </p>
      <table className="juego-ranking-tabla" data-testid="ranking-lista" data-scope={scope}>
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
                <RowLink row={r} onOwnCarnet={onOwnCarnet} />
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
  );
}

/**
 * «Descubrir a un BOIERO» (T66): enseña aquí mismo el Carnet de un miembro
 * al azar, que también puede ser uno de los artistas (sus Carnets salen de
 * su ficha). Otro toque, otro distinto.
 */
function Discover() {
  const { data: members } = useRepoData((r) => r.carnet.members());
  const [shown, setShown] = useState<string | null>(null);
  const discover = () => {
    const next = pickMember(members ?? [], discoverRandom, shown);
    if (next) setShown(next.userId);
  };
  const kind = members?.find((m) => m.userId === shown)?.kind ?? null;
  return (
    <div className="juego-ranking-descubrir" data-testid="ranking-descubrir-zona">
      <button
        type="button"
        className="juego-button"
        data-testid="ranking-descubrir"
        disabled={!members}
        onClick={discover}
      >
        {shown ? RANKING_COPY.discoverAgain : RANKING_COPY.discover}
      </button>
      <p className="juego-muted">
        {members && members.length === 0 ? RANKING_COPY.discoverEmpty : RANKING_COPY.discoverNote}
      </p>
      {shown && kind ? <Discovered userId={shown} kind={kind} /> : null}
    </div>
  );
}

function Discovered({ userId, kind }: { userId: string; kind: 'member' | 'artist' }) {
  const { data } = useCarnet(userId);
  if (!data?.carnet) return null;
  return (
    <section
      className="juego-ranking-descubierto"
      data-testid="ranking-descubierto"
      data-user-id={userId}
      data-kind={kind}
      aria-live="polite"
    >
      <p className="juego-ranking-rotulo">
        {kind === 'artist' ? RANKING_COPY.discoveredArtist : RANKING_COPY.discoveredMember}
      </p>
      <CarnetCard carnet={data.carnet} extras={data.extras} />
      <p>
        <Link href={carnetPath(userId)} prefetch={false} className="juego-link">
          {RANKING_COPY.seeCarnet}
        </Link>
      </p>
    </section>
  );
}

/**
 * 🏆 Ranking local (REQ-IDE-053, D-23 punto 8): los puntos de este navegador
 * junto a los miembros de muestra, de siempre y de la temporada (el mundo que
 * se juega), con el puesto propio destacado, y el récord del circuito (T56).
 * Rotulado como local: nunca se presenta como compartido ni validado
 * (REQ-IDE-038 es el de la versión final). Cada fila abre su Carnet
 * (REQ-IDE-017). Lo usan el Menú de a bordo y /mar (T56).
 */
export function RankingPanel({
  season,
  worldName,
  onOwnCarnet,
}: {
  season: string;
  worldName: string;
  /** La fila propia abre esto en vez de /carnet (el Carnet dentro del mar, T56). */
  onOwnCarnet?: () => void;
}) {
  const [scope, setScope] = useState<Scope>('all');
  return (
    <div className="juego-ranking" data-testid="ranking">
      <p className="juego-ranking-rotulo" data-testid="ranking-rotulo">
        {RANKING_COPY.localLabel}
      </p>
      <p className="juego-muted">{RANKING_COPY.localNotice}</p>
      <Discover />
      <div
        className="juego-ranking-tabs"
        role="group"
        aria-label={t('juego.ranking.queRankingVer')}
      >
        {(
          [
            ['all', RANKING_COPY.allTime],
            ['season', RANKING_COPY.season(worldName)],
            ['circuit', RANKING_COPY.circuit],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className="juego-ranking-tab"
            aria-pressed={scope === id}
            data-testid={TAB_TEST_ID[id]}
            onClick={() => setScope(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {scope === 'circuit' ? (
        <CircuitTable season={season} onOwnCarnet={onOwnCarnet} />
      ) : (
        <PointsTable scope={scope} season={season} onOwnCarnet={onOwnCarnet} />
      )}
    </div>
  );
}

function Ranking({ ctx }: { ctx: MenuContext }) {
  const season = ctx.world.current;
  const worldName = ctx.world.worlds.find((w) => w.id === season)?.name ?? season;
  return <RankingPanel season={season} worldName={worldName} />;
}

export const rankingSection: MenuSection = {
  id: 'ranking',
  icon: '🏆',
  label: RANKING_COPY.heading,
  group: 'progress',
  Component: Ranking,
};

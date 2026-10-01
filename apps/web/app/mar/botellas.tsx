'use client';

import type { BottleView } from '@boia/store';
import type { Vec2 } from '@boia/world';
import { type BottleSheetMode, FoundBottle, MyBottle } from '../../lib/mundo/bottles/bottle-sheet';
import { carnetPath } from '../../lib/mundo/carnet/share';
import { RankingPanel } from '../../lib/mundo/menu/sections/ranking';
import { useRepoData } from '../../lib/mundo/repo';
import { t } from '../../lib/i18n';
import { MarHoja } from './hoja';
import '../../lib/mundo/carnet/carnet.css';
import './botellas.css';

/**
 * Botellas y Ranking en /mar (T56): las mismas piezas que el Menú del 2D (la
 * botella propia, la encontrada, el ranking local) en la hoja crema de /mar
 * (`MarHoja`), por encima del mar. Lo que pide Carnet lleva a «Mi Carnet»
 * dentro del mundo (T55); el Carnet de otro miembro se abre en /carnet/<id>.
 */

/**
 * La botella (REQ-IDE-040…044): la propia (echarla junto al barco, editarla
 * o retirarla; necesita Carnet) o una encontrada (leerla, ver el Carnet de
 * quien la escribió, reportarla).
 */
export function MarBotella({
  mode,
  dropSpot,
  onMine,
  onNeedCarnet,
  onClose,
}: {
  mode: BottleSheetMode;
  /** Dónde cae la botella propia (posición del mapa compartido), o null. */
  dropSpot: () => Vec2 | null;
  onMine: () => void;
  /** Sin Carnet: «Mi Carnet» dentro del mundo, para crearlo. */
  onNeedCarnet: () => void;
  onClose: () => void;
}) {
  const { repo } = useRepoData(async () => null);
  const title = mode.kind === 'mine' ? t('bottle.title.own') : t('bottle.title.found');
  return (
    <MarHoja
      title={title}
      label={title}
      closeLabel={t('mar.botella.cerrar')}
      testId="mar-botella"
      closeTestId="mar-botella-cerrar"
      onClose={onClose}
    >
      {!repo ? (
        <p className="juego-muted">{t('empty.loading')}</p>
      ) : mode.kind === 'mine' ? (
        <MyBottle repo={repo} dropSpot={dropSpot} onNeedCarnet={onNeedCarnet} onClose={onClose} />
      ) : (
        <FoundBottle
          key={mode.id}
          repo={repo}
          id={mode.id}
          onOpenCarnet={(userId) => window.location.assign(carnetPath(userId))}
          onNeedCarnet={onNeedCarnet}
          onMine={onMine}
        />
      )}
    </MarHoja>
  );
}

/** Las botellas que flotan cerca del barco, para leerlas (como mucho dos), encima de la barra. */
export function MarBottlesNear({
  ids,
  bottles,
  onRead,
}: {
  ids: readonly string[];
  bottles: readonly BottleView[];
  onRead: (id: string) => void;
}) {
  const near = ids.flatMap((id) => bottles.filter((b) => b.id === id)).slice(0, 2);
  if (!near.length) return null;
  return (
    <div className="mar-bottles" role="group" aria-label={t('mar.botella.cerca')}>
      {near.map((b) => (
        <button
          key={b.id}
          type="button"
          className={`mar-bottles__chip${b.read ? ' is-read' : ''}${b.isMine ? ' is-mine' : ''}`}
          data-testid={`mar-botella-cerca-${b.id}`}
          onClick={() => onRead(b.id)}
        >
          {b.isMine
            ? t('mar.botella.tuyaCerca')
            : b.authorNickname
              ? t('mar.botella.deCerca', { name: b.authorNickname })
              : t('bottle.title.found')}
        </button>
      ))}
    </div>
  );
}

/** El ranking local (De siempre, Temporada, Circuito), en la hoja de /mar. */
export function MarRanking({
  season,
  worldName,
  onOwnCarnet,
  onClose,
}: {
  season: string;
  worldName: string;
  /** La fila propia abre «Mi Carnet» dentro del mundo. */
  onOwnCarnet: () => void;
  onClose: () => void;
}) {
  return (
    <MarHoja
      title={t('mar.ranking.titulo')}
      label={t('ranking.heading')}
      closeLabel={t('mar.ranking.cerrar')}
      testId="mar-ranking"
      closeTestId="mar-ranking-cerrar"
      onClose={onClose}
    >
      <RankingPanel season={season} worldName={worldName} onOwnCarnet={onOwnCarnet} />
    </MarHoja>
  );
}

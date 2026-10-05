'use client';

import type { BossId } from '@boia/engine/survivors';
import { useEffect, useState } from 'react';
import { type MessageKey, t as msg } from '../../lib/i18n';
import { canonBoardTop } from '../../lib/mundo/ranking-canon-global';
import { browserCanonStorage, canonRanking, readCanonBest } from '../../lib/mundo/ranking-canon';
import { type GlobalPage, pinnedMine } from '../../lib/mundo/ranking-global';
import { isSupabaseConfigured } from '../../lib/supabase/config';
import type { CanonRankingOutcome } from './canon-ranking-model';
import './canon-ranking.css';

/**
 * El ranking por boss del Cañón a la vista (plan 013 T155): la tabla del
 * pop-up antes de la partida (el boss final del acto elegido) y lo que dice
 * la tarjeta final (puntuación, tu mejor y tu puesto). En modo local, tu
 * mejor de este navegador entre la tripulación de muestra; con cuentas, el
 * ranking global (los primeros y tu fila).
 */

/** Filas del pop-up con cuentas: los primeros (más tu fila si quedas fuera). */
export const CANON_POPUP_ROWS = 5;

const NUMBER = new Intl.NumberFormat('es-ES');
export const formatCanonScore = (n: number) => NUMBER.format(Math.round(n));

interface ViewRow {
  key: string;
  position: number | null;
  name: string;
  score: number | null;
  mine: boolean;
}

function RankingList({ rows, boss }: { rows: readonly ViewRow[]; boss: BossId }) {
  return (
    <ol className="mar-canon-ranking" data-testid="mar-canon-ranking-tabla" data-boss={boss}>
      {rows.map((r) => (
        <li
          key={r.key}
          className={`mar-canon-ranking__row${r.mine ? ' is-mine' : ''}`}
          data-testid="mar-canon-ranking-fila"
          data-mio={r.mine ? 'si' : undefined}
          data-puesto={r.position ?? undefined}
          data-puntos={r.score ?? undefined}
          aria-label={
            r.score !== null && r.position !== null
              ? msg('mar.canon.ranking.fila', {
                  puesto: r.position,
                  nombre: r.name,
                  puntos: formatCanonScore(r.score),
                })
              : r.name
          }
        >
          <span className="mar-canon-ranking__pos" aria-hidden="true">
            {r.position ?? '–'}
          </span>
          <span className="mar-canon-ranking__name" aria-hidden="true">
            {r.name}
          </span>
          <span className="mar-canon-ranking__score" aria-hidden="true">
            {r.score !== null ? formatCanonScore(r.score) : ''}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Empty() {
  return (
    <p className="mar-canon-previa__empty" data-testid="mar-canon-previa-ranking-vacio">
      {msg('mar.canon.previa.ranking.vacio')}
    </p>
  );
}

/** La tabla de un boss en el pop-up previo (el hueco de T151). */
export function CanonBossRanking({ boss }: { boss: BossId | null }) {
  const global = isSupabaseConfigured();
  if (!boss) return <Empty />;
  return global ? <GlobalBossRanking boss={boss} /> : <LocalBossRanking boss={boss} />;
}

function LocalBossRanking({ boss }: { boss: BossId }) {
  // Se lee al abrir (el pop-up se monta cada vez): tras una partida, ya está.
  const best = readCanonBest(browserCanonStorage(), boss)?.score ?? null;
  const table = canonRanking({ nickname: null, bestScore: best }, boss);
  const rows: ViewRow[] = table.rows.map((r) => ({
    key: r.userId || 'yo',
    position: r.position,
    name: r.isMine
      ? msg(r.score === null ? 'mar.canon.ranking.tu.sin' : 'mar.canon.ranking.tu')
      : (r.nickname ?? ''),
    score: r.score,
    mine: r.isMine,
  }));
  return (
    <div data-testid="mar-canon-ranking" data-ranking="local">
      <RankingList rows={rows} boss={boss} />
      <p className="mar-canon-ranking__note">{msg('mar.canon.ranking.local')}</p>
    </div>
  );
}

function GlobalBossRanking({ boss }: { boss: BossId }) {
  const [page, setPage] = useState<{ boss: BossId; page: GlobalPage | null } | null>(null);
  useEffect(() => {
    let live = true;
    void canonBoardTop(boss, CANON_POPUP_ROWS).then((p) => {
      if (live) setPage({ boss, page: p });
    });
    return () => {
      live = false;
    };
  }, [boss]);
  if (!page || page.boss !== boss) {
    return (
      <p
        className="mar-canon-previa__empty"
        data-testid="mar-canon-ranking"
        data-ranking="cargando"
      >
        {msg('mar.canon.ranking.cargando')}
      </p>
    );
  }
  const p = page.page;
  if (!p || p.rows.length === 0) return <Empty />;
  const pinned = pinnedMine(p.rows, p.mine);
  const rows: ViewRow[] = [...p.rows, ...(pinned ? [pinned] : [])].map((r) => ({
    key: r.userId,
    position: r.position,
    name: r.nickname,
    score: r.value,
    mine: r.isMine,
  }));
  return (
    <div data-testid="mar-canon-ranking" data-ranking="global">
      <RankingList rows={rows} boss={boss} />
      <p className="mar-canon-ranking__note">{msg('mar.canon.ranking.formula')}</p>
    </div>
  );
}

const OFF_KEY: Partial<Record<string, MessageKey>> = {
  test: 'mar.canon.fin.ranking.prueba',
  too_short: 'mar.canon.fin.ranking.corta',
};

/**
 * El ranking en la tarjeta final, en una línea corta bajo el premio: tu
 * puesto y tu mejor (o por qué no entra). La puntuación va en la fila de
 * cifras de la tarjeta (`CanonEndScore`).
 */
export function CanonEndRanking({ ranking }: { ranking: CanonRankingOutcome }) {
  const s = ranking.standing;
  let line: string;
  switch (s.kind) {
    case 'off':
      line = msg(OFF_KEY[s.reason] ?? 'mar.canon.fin.ranking.fuera');
      break;
    case 'local':
      line = msg('mar.canon.fin.ranking.puesto', { puesto: s.position, total: s.of });
      break;
    case 'global':
      line = msg('mar.canon.fin.ranking.puesto', { puesto: s.position, total: s.total });
      break;
    case 'loading':
      line = msg('mar.canon.fin.ranking.cargando');
      break;
    case 'guest':
      line = msg('mar.canon.fin.ranking.invitado');
      break;
    case 'unavailable':
      line = msg('mar.canon.fin.ranking.sinDato');
      break;
  }
  const position = s.kind === 'local' || s.kind === 'global' ? s.position : undefined;
  return (
    <p
      className="mar-canon-end__ranking"
      data-testid="mar-canon-final-ranking"
      data-ranking={s.kind}
      data-motivo={s.kind === 'off' ? s.reason : undefined}
      data-boss={ranking.boss ?? undefined}
      data-puntos={ranking.score}
      data-mejor={ranking.best ?? undefined}
      data-puesto={position}
      role="status"
    >
      <span className="mar-canon-end__place" data-testid="mar-canon-final-puesto">
        {line}
      </span>
      {s.kind !== 'off' && ranking.best !== null ? (
        <>
          {' '}
          <span className="mar-canon-end__best" data-testid="mar-canon-final-mejor">
            {ranking.isBest
              ? msg('mar.canon.fin.ranking.nuevo')
              : msg('mar.canon.fin.ranking.mejor', { puntos: formatCanonScore(ranking.best) })}
          </span>
        </>
      ) : null}
    </p>
  );
}

/** La puntuación de la partida, como una cifra más de la tarjeta final. */
export function CanonEndScore({ ranking }: { ranking: CanonRankingOutcome }) {
  return (
    <div>
      <dt>{msg('mar.canon.fin.puntos')}</dt>
      <dd data-testid="mar-canon-final-puntos">{formatCanonScore(ranking.score)}</dd>
    </div>
  );
}

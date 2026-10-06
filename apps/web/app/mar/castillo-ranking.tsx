'use client';

import type { DefenseRunMin, DifficultyId } from '@boia/engine/defense';
import { useEffect, useState } from 'react';
import { t as msg } from '../../lib/i18n';
import {
  browserCastleStorage,
  castleBoardKey,
  castleRanking,
  readCastleBest,
} from '../../lib/mundo/ranking-castle';
import { castleBoardTop } from '../../lib/mundo/ranking-castle-global';
import { type GlobalPage, pinnedMine } from '../../lib/mundo/ranking-global';
import { isSupabaseConfigured } from '../../lib/supabase/config';
import type { CastleRankingOutcome } from './castillo-ranking-model';
import './canon-ranking.css';

const NUMBER = new Intl.NumberFormat('es-ES');
const formatScore = (n: number) => NUMBER.format(n);
interface Pair {
  runMin: DefenseRunMin;
  difficulty: DifficultyId;
}
interface ViewRow {
  key: string;
  position: number | null;
  name: string;
  score: number | null;
  mine: boolean;
}

function RankingList({ rows, runMin, difficulty }: Pair & { rows: ViewRow[] }) {
  return (
    <ol
      className="mar-canon-ranking"
      data-testid="mar-castillo-ranking-tabla"
      data-duracion={runMin}
      data-dificultad={difficulty}
    >
      {rows.map((r) => (
        <li
          key={r.key}
          className={`mar-canon-ranking__row${r.mine ? ' is-mine' : ''}`}
          data-testid="mar-castillo-ranking-fila"
          data-mio={r.mine ? 'si' : undefined}
          data-puesto={r.position ?? undefined}
          data-puntos={r.score ?? undefined}
          aria-label={
            r.score !== null && r.position !== null
              ? msg('mar.castillo.ranking.fila', {
                  puesto: r.position,
                  nombre: r.name,
                  puntos: formatScore(r.score),
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
            {r.score !== null ? formatScore(r.score) : ''}
          </span>
        </li>
      ))}
    </ol>
  );
}
export function CastlePairRanking(pair: Pair) {
  return isSupabaseConfigured() ? <GlobalRanking {...pair} /> : <LocalRanking {...pair} />;
}
function LocalRanking(pair: Pair) {
  const best = readCastleBest(browserCastleStorage(), pair.runMin, pair.difficulty)?.score ?? null;
  const table = castleRanking(best, pair.runMin, pair.difficulty);
  const rows = table.rows.map((r) => ({
    key: r.userId || 'yo',
    position: r.position,
    name: r.isMine
      ? msg(r.score === null ? 'mar.castillo.ranking.tu.sin' : 'mar.castillo.ranking.tu')
      : (r.nickname ?? ''),
    score: r.score,
    mine: r.isMine,
  }));
  return (
    <div data-testid="mar-castillo-ranking" data-ranking="local">
      <RankingList {...pair} rows={rows} />
      <p className="mar-canon-ranking__note">{msg('mar.castillo.ranking.local')}</p>
    </div>
  );
}
function GlobalRanking({ runMin, difficulty }: Pair) {
  const key = castleBoardKey(runMin, difficulty);
  const [loaded, setLoaded] = useState<{ key: string; page: GlobalPage | null } | null>(null);
  useEffect(() => {
    let live = true;
    void castleBoardTop(runMin, difficulty, 5).then((page) => {
      if (live) setLoaded({ key, page });
    });
    return () => {
      live = false;
    };
  }, [runMin, difficulty, key]);
  if (loaded?.key !== key)
    return (
      <p
        className="mar-canon-previa__empty"
        data-testid="mar-castillo-ranking"
        data-ranking="cargando"
      >
        {msg('mar.castillo.ranking.cargando')}
      </p>
    );
  const p = loaded.page;
  if (!p || (p.rows.length === 0 && !p.mine))
    return (
      <p className="mar-canon-previa__empty" data-testid="mar-castillo-previa-ranking-vacio">
        {msg(p ? 'mar.castillo.previa.ranking.vacio' : 'mar.castillo.fin.ranking.sinDato')}
      </p>
    );
  const pinned = pinnedMine(p.rows, p.mine);
  const rows = [...p.rows, ...(pinned ? [pinned] : [])].map((r) => ({
    key: r.userId,
    position: r.position,
    name: r.nickname,
    score: r.value,
    mine: r.isMine,
  }));
  return (
    <div data-testid="mar-castillo-ranking" data-ranking="global">
      <RankingList runMin={runMin} difficulty={difficulty} rows={rows} />
      <p className="mar-canon-ranking__note">{msg('mar.castillo.ranking.formula')}</p>
    </div>
  );
}

export function CastleEndRanking({ ranking }: { ranking: CastleRankingOutcome }) {
  const s = ranking.standing;
  let line: string;
  switch (s.kind) {
    case 'off':
      line = msg(
        s.reason === 'test'
          ? 'mar.castillo.fin.prueba'
          : s.reason === 'too_short'
            ? 'mar.castillo.fin.ranking.corta'
            : 'mar.castillo.fin.ranking.fuera',
      );
      break;
    case 'local':
      line = msg('mar.castillo.fin.ranking.puesto', { puesto: s.position, total: s.of });
      break;
    case 'global':
      line = msg('mar.castillo.fin.ranking.puesto', { puesto: s.position, total: s.total });
      break;
    case 'loading':
      line = msg('mar.castillo.fin.ranking.cargando');
      break;
    case 'guest':
      line = msg('mar.castillo.fin.ranking.invitado');
      break;
    case 'unavailable':
      line = msg('mar.castillo.fin.ranking.sinDato');
      break;
  }
  return (
    <p
      className="mar-canon-end__ranking"
      data-testid="mar-castillo-final-ranking"
      data-ranking={s.kind}
      data-motivo={s.kind === 'off' ? s.reason : undefined}
      data-puntos={ranking.score}
      data-mejor={ranking.best ?? undefined}
      data-puesto={s.kind === 'local' || s.kind === 'global' ? s.position : undefined}
      role="status"
    >
      <span className="mar-canon-end__place" data-testid="mar-castillo-final-puesto">
        {s.kind === 'off' && s.reason === 'test' ? (
          <span data-testid="mar-castillo-final-prueba">{line}</span>
        ) : (
          line
        )}
      </span>
      {s.kind !== 'off' && ranking.best !== null ? (
        <>
          {' '}
          <span className="mar-canon-end__best" data-testid="mar-castillo-final-record">
            {ranking.isBest
              ? msg('mar.castillo.fin.ranking.nuevo')
              : msg('mar.castillo.fin.ranking.mejor', { puntos: formatScore(ranking.best) })}
          </span>
        </>
      ) : null}
    </p>
  );
}

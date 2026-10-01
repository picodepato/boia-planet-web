'use client';

import { isStoreError } from '@boia/store';
import { type CSSProperties, useCallback, useRef, useState } from 'react';
import { CLAIM_LABEL, logroRows, obtainedCount } from './model';
import { type ClaimedReward, ClaimReward } from './reward';
import { useCountUp, useLogros } from './use-logros';
import './logros.css';
import { t } from '../i18n';

/**
 * El panel de logros (T37, D-22 punto 5, REQ-IDE-024…028), el mismo en /mar
 * (desde el icono del HUD) y en el 2D (sección «Logros» del Menú de a
 * bordo): «X de Y logros», saldos y rango arriba, y cada logro con su barra,
 * lo que le queda y su premio; los ocultos, «???» hasta completarlos. Los
 * completados llevan «Reclamar»: el premio llega entonces (una sola vez, lo
 * decide el repositorio) con una animación corta. Todo `muestra`.
 */
export function AchievementsPanel() {
  const { data, repo } = useLogros();
  const [claiming, setClaiming] = useState<string | null>(null);
  const [shown, setShown] = useState<ClaimedReward | null>(null);
  const seq = useRef(0);
  const points = useCountUp(data?.balances.points ?? 0);
  const coins = useCountUp(data?.balances.coins ?? 0);
  const hide = useCallback(() => setShown(null), []);

  if (data === undefined || !repo) return <p className="juego-muted">{t('empty.loading')}</p>;
  const rows = logroRows(data.list, data.facts, data.names);

  const claim = async (id: string, title: string) => {
    if (claiming) return;
    setClaiming(id);
    try {
      const r = await repo.progress.claimAchievement(id);
      if (r.claimed) setShown({ key: ++seq.current, title, reward: r.reward });
    } catch (err) {
      // Desactivado por el Admin entre medias: no pasa nada, se queda como estaba.
      if (!isStoreError(err, 'forbidden')) console.warn('[boia] no se pudo reclamar', err);
    } finally {
      setClaiming(null);
    }
  };

  return (
    <div className="logros" data-testid="logros-panel">
      <p className="logros-saldos" data-testid="logros-saldos">
        <span data-testid="logros-puntos" data-value={data.balances.points}>
          {t('logros.panel.puntos', { points })}
        </span>
        <span data-testid="logros-monedas" data-value={data.balances.coins}>
          {t('logros.panel.monedas', { coins })}
        </span>
        {data.rank ? (
          <span data-testid="logros-rango">{t('balances.rank', { rank: data.rank })}</span>
        ) : null}
      </p>
      <h3 className="logros-cabecera" data-testid="logros-cabecera">
        {t('achievements.counter', { got: obtainedCount(data.list), total: data.list.length })}
      </h3>
      <ul className="logros-lista" data-testid="logros">
        {rows.map((row) => (
          <li
            key={row.id}
            data-testid={`logro-${row.id}`}
            data-estado={row.state}
            data-obtenido={row.state === 'in_progress' ? 'no' : 'si'}
            data-oculto={row.hidden ? 'si' : undefined}
            className={`logro is-${row.state}${row.hidden ? ' is-hidden' : ''}`}
          >
            <span className="logro__icon" aria-hidden="true">
              {row.state === 'claimed'
                ? '🏅'
                : row.state === 'ready'
                  ? '🎁'
                  : row.hidden
                    ? '❔'
                    : '○'}
            </span>
            <span className="logro__main">
              <span className="logro__title">
                <strong>{row.title}</strong>
                {row.count ? <span className="logro__count">{row.count}</span> : null}
              </span>
              {row.description ? <span className="logro__desc">{row.description}</span> : null}
              {row.progress !== null && row.state === 'in_progress' ? (
                <span
                  className="logro__bar"
                  role="progressbar"
                  aria-label={t('logros.panel.progresoDe', { title: row.title })}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(row.progress * 100)}
                  style={{ '--p': row.progress } as CSSProperties}
                >
                  <span />
                </span>
              ) : null}
              <span className="logro__hint" data-testid={`logro-pista-${row.id}`}>
                {row.hint}
              </span>
              {row.reward ? (
                <span className="logro__reward">
                  {row.state === 'claimed' ? t('logros.panel.ganaste') : t('logros.panel.premio')}
                  {row.reward}
                </span>
              ) : null}
            </span>
            {row.state === 'ready' ? (
              <button
                type="button"
                className="logro__claim"
                data-testid={`logro-reclamar-${row.id}`}
                disabled={claiming !== null}
                aria-label={t('logros.panel.elPremioDe', { CLAIM_LABEL, title: row.title })}
                onClick={() => void claim(row.id, row.title)}
              >
                {CLAIM_LABEL}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {shown ? (
        <ClaimReward key={shown.key} shown={shown} names={data.names} onDone={hide} />
      ) : null}
    </div>
  );
}

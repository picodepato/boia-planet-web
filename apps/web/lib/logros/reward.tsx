'use client';

import type { AchievementReward } from '@boia/store';
import { useEffect } from 'react';
import { CarnetIcon } from '../carnet-icon';
import { CoinIcon } from '../coin-icon';
import { type CosmeticNames, REWARD_MS } from './model';
import { useCountUp } from './use-logros';
import { t as msg } from '../i18n';

export interface ClaimedReward {
  /** Para volver a montar la animación con cada reclamo. */
  key: number;
  title: string;
  reward: AchievementReward;
}

/**
 * La animación corta al reclamar (T37): los puntos y las monedas suben
 * contando, la insignia vuela al Carnet y el barco se desbloquea. Se va sola
 * a los `REWARD_MS` o al tocarla; con movimiento reducido, sin movimiento.
 */
export function ClaimReward({
  shown,
  names,
  onDone,
}: {
  shown: ClaimedReward;
  names: CosmeticNames;
  onDone: () => void;
}) {
  const { reward, title } = shown;
  const points = useCountUp(reward.points, 900, 0);
  const coins = useCountUp(reward.coins, 900, 0);
  useEffect(() => {
    const t = window.setTimeout(onDone, REWARD_MS);
    return () => window.clearTimeout(t);
  }, [onDone]);
  const cosmetic = reward.cosmeticKey ? (names[reward.cosmeticKey] ?? reward.cosmeticKey) : null;

  return (
    <button
      type="button"
      className={`logros-premio is-${reward.kind}`}
      data-testid="logro-premio"
      data-kind={reward.kind}
      aria-label={msg('logros.reward.premioDeReclamadoToca', { title })}
      onClick={onDone}
    >
      <span className="logros-premio__burst" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <i key={i} style={{ ['--i' as string]: i }} />
        ))}
      </span>
      <span className="logros-premio__kicker">{msg('logros.reward.premio')}</span>
      <strong className="logros-premio__title">{title}</strong>
      {reward.points > 0 || reward.coins > 0 ? (
        <span className="logros-premio__nums" role="status">
          {reward.points > 0 ? <span data-testid="logro-premio-puntos">+{points} ★</span> : null}
          {reward.coins > 0 ? (
            <span data-testid="logro-premio-monedas">
              +{coins} <CoinIcon label={msg('logros.reward.monedas')} />
            </span>
          ) : null}
        </span>
      ) : null}
      {reward.kind === 'badge' ? (
        <span className="logros-premio__badge">
          <span className="logros-premio__carnet" aria-hidden="true">
            <CarnetIcon />
          </span>
          <span className="logros-premio__fly" aria-hidden="true">
            🎖️
          </span>
          <span>{msg('logros.reward.insigniaATuCarnet')}</span>
        </span>
      ) : null}
      {reward.kind === 'ship' ? (
        <span className="logros-premio__ship">
          <span className="logros-premio__lock" aria-hidden="true">
            <span>🔒</span>
            <span>⛵</span>
          </span>
          <span>
            {msg('logros.reward.barcoDesbloqueado', { v1: cosmetic ? `: ${cosmetic}` : '' })}
          </span>
        </span>
      ) : null}
      {reward.kind === 'cosmetic' && cosmetic ? (
        <span className="logros-premio__extra">
          {msg('logros.reward.nuevoParaTuBarco', { cosmetic })}
        </span>
      ) : null}
    </button>
  );
}

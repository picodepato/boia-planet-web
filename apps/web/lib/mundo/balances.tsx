'use client';

import type { Rect } from '@boia/engine/ui';
import { useRepoData } from './repo';
import { t } from '../i18n';

/**
 * Puntos y monedas en el HUD (REQ-IDE-027): dos saldos separados, derivados
 * del libro del repositorio local; gastar monedas nunca toca los puntos.
 * Se refresca con cada cambio del repositorio.
 */
export function BalancesChip({ rect }: { rect: Rect }) {
  const { data } = useRepoData((r) => r.progress.balances());
  return (
    <div
      className="juego-balances"
      data-testid="saldos"
      data-hud="saldos"
      data-points={data?.points}
      data-coins={data?.coins}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
    >
      <span title={t('juego.balances.puntos')} aria-label={`${data?.points ?? 0} puntos`}>
        ★ {data?.points ?? '–'}
      </span>
      <span title={t('juego.balances.monedas')} aria-label={`${data?.coins ?? 0} monedas`}>
        ● {data?.coins ?? '–'}
      </span>
    </div>
  );
}

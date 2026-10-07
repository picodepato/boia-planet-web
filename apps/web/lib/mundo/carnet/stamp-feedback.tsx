import { t } from '../../i18n';
import type { ClaimOutcome } from './claim';

/** El mismo resultado tras leer el QR con la cámara o abrir /sello. */
export function StampFeedback({
  outcome,
}: {
  outcome: Extract<ClaimOutcome, { kind: 'granted' }>;
}) {
  return (
    <div className="idc-notice" role="status" data-testid="sello-progreso">
      <p data-testid="carnet-puntos-cambio">
        {outcome.pointsChange
          ? t('stamp.pointsChip', outcome.pointsChange)
          : t('stamp.pointsAwarded', { points: outcome.points })}
      </p>
      <p data-testid="sello-puesto">
        {outcome.position === null
          ? t('stamp.rankUnavailable')
          : t('stamp.nowRank', { rank: outcome.position })}
      </p>
    </div>
  );
}

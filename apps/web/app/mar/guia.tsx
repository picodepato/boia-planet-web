'use client';

import type { WorldConfig } from '@boia/world';
import type { GuideSpot } from '../../lib/mundo/guide';
import { t as msg } from '../../lib/i18n';

/**
 * Lo que señala una boia informativa al terminar de hablar (T59): un chip
 * con rumbo a la Boia Fiestera, a un código escondido o a un minijuego.
 * Tocarlo fija el rumbo (el barco va solo); la × lo quita. Un código
 * escondido no dice dónde está: sólo «un código escondido».
 */
export function guideLabel(spot: GuideSpot, world: WorldConfig | null): string {
  const name = (id: string) => world?.objects.find((o) => o.identity.id === id)?.identity.name ?? id;
  if (spot.kind === 'discount') return msg('mar.guide.discount');
  if (spot.kind === 'minigame') return msg('mar.guide.minigame', { place: name(spot.placeId) });
  // La misión: a ella mientras espera; a su destino, a bordo.
  return spot.placeId === spot.objectId
    ? msg('mar.guide.fiestera')
    : msg('mar.guide.mission', { place: name(spot.placeId) });
}

export function MarGuideChip({
  spot,
  world,
  onGo,
  onClose,
}: {
  spot: GuideSpot;
  world: WorldConfig | null;
  onGo: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="mar-chip mar-chip--guide"
      data-testid="mar-guia"
      data-guia={spot.kind}
      data-destino={spot.placeId}
    >
      <button type="button" className="mar-chip__go" data-testid="mar-guia-ir" onClick={onGo}>
        {guideLabel(spot, world)}
      </button>
      <button
        type="button"
        className="mar-chip__x"
        aria-label={msg('mar.guide.cerrar')}
        onClick={onClose}
      >
        ×
      </button>
    </div>
  );
}

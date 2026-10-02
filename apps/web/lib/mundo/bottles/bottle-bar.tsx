'use client';

import {
  HUD_BUTTON,
  HUD_GAP,
  HUD_MARGIN,
  type Rect,
  type Viewport,
  joystickZone,
} from '@boia/engine/ui';
import type { BottleView } from '@boia/store';
import { t } from '../../i18n';

/**
 * Barra de botellas del HUD (T22): justo encima de la zona del joystick,
 * centrada. A la izquierda, el botón de la botella propia; a su lado, las
 * botellas que flotan cerca del barco para leerlas (como mucho dos).
 */

export const BOTTLE_BAR_MAX_WIDTH = 380;
export const BOTTLE_BAR_MAX_FOUND = 2;

export function bottleBarRect(vp: Viewport): Rect {
  const joy = joystickZone(vp);
  const w = Math.min(BOTTLE_BAR_MAX_WIDTH, vp.width - 2 * HUD_MARGIN);
  return {
    x: Math.round((vp.width - w) / 2),
    y: joy.y - HUD_GAP - HUD_BUTTON,
    w,
    h: HUD_BUTTON,
  };
}

export function BottleBar({
  rect,
  found,
  hasOwn,
  onOwn,
  onRead,
}: {
  rect: Rect;
  /** Botellas cerca, de la más cercana a la más lejana. */
  found: readonly BottleView[];
  hasOwn: boolean;
  onOwn: () => void;
  onRead: (id: string) => void;
}) {
  return (
    <div
      className="juego-bottle-bar"
      data-testid="botella-hud"
      data-hud="botellas"
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
    >
      <button
        type="button"
        className="juego-hud-button juego-bottle-own"
        data-testid="botella-propia"
        aria-label={hasOwn ? t('bottle.title.own') : t('juego.bottleBar.echarUnaBotella')}
        title={hasOwn ? t('bottle.title.own') : t('juego.bottleBar.echarUnaBotella')}
        onClick={onOwn}
      >
        <span aria-hidden="true">✉️</span>
      </button>
      {found.slice(0, BOTTLE_BAR_MAX_FOUND).map((b) => (
        <button
          key={b.id}
          type="button"
          className={`juego-bottle-chip${b.read ? ' is-read' : ''}`}
          data-testid={`botella-cerca-${b.id}`}
          onClick={() => onRead(b.id)}
        >
          <span aria-hidden="true">🍾</span>{' '}
          {b.isMine
            ? t('bottle.title.own')
            : t('bottle.title.from', { name: b.authorNickname ?? 'alguien' })}
        </button>
      ))}
    </div>
  );
}
